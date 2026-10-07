import { PROBE_ASK, PROBE_OPEN, PROBE_REACT, type ProbeTopic } from '../data/conversation';
import { Rules } from '../data/rules';
import { SPEECH } from '../data/speech';
import type { Agent } from '../sim/Agent';
import { line } from '../sim/Conversation';
import type { FloorSim } from '../sim/FloorSim';
import type { PlayerIntel } from '../sim/PlayerIntel';

// NPCがプレイヤーに話しかけて「情報を引き出そうとする」会話。
// NPCは質問の答えから、プレイヤーが誰と話したか・誰と対戦したか・誰の情報を持っていそうか を推測し、
// NPCの内部情報（knowledge.playerNotes など）に保存する。
// ※ プレイヤーの星の数については聞かない。
//
// プレイヤーは「正直に答える／嘘をつく／答えない」を選べる：
//   正直 … 友好度が少し上がり、ときどきお礼に噂を1つ教えてくれる。ただしNPCに自分の情報を渡すことになる
//   嘘   … バレなければ情報を渡さずに済む。バレると友好度が下がり、以後そのNPCに疑われやすくなる
//   答えない … 情報は渡さないが、少し気を悪くされる

// プレイヤーの最近の行動（NPCの質問の「本当の答え」を決めるために、Game が記録する）
export interface PlayerLog {
  talked: Map<string, number>; // 話したNPC → 時刻
  fought: Map<string, number>; // 対戦したNPC → 時刻
}

type AnswerKind = 'honest' | 'lie' | 'refuse';
export interface ProbeOption {
  label: string;
  kind: AnswerKind;
  apply?: () => void; // NPCが受け取る情報（正直なら本当の情報、嘘なら間違った情報）
}
export interface ProbeScene {
  text: string;
  options: ProbeOption[];
}
export interface ProbeResult {
  text: string;
  favor: boolean; // お礼に噂を1つ教えてくれる
}

export interface ProbeHost {
  sim: FloorSim;
  me: Agent;
  intel: PlayerIntel;
  log: PlayerLog;
  nameOf: (id: string) => string;
}

// 質問の場面を作る
export function buildProbe(h: ProbeHost, npc: Agent): ProbeScene {
  const now = h.sim.time;
  const recent = Rules.conversation.probe.recentSec;
  const notes = npc.knowledge.playerNotes;
  const others = h.sim.aliveNpcs().filter((a) => a !== npc);
  const randomOther = (): Agent | null => others[Math.floor(Math.random() * others.length)] ?? null;
  const latest = (m: Map<string, number>): string | null => {
    let best: string | null = null;
    let bt = -Infinity;
    for (const [id, t] of m) if (id !== npc.id && h.sim.isAlive(id) && now - t < recent && t > bt) [best, bt] = [id, t];
    return best;
  };
  const refuse: ProbeOption = { label: '答えない', kind: 'refuse' };
  const topics: ProbeTopic[] = ['talked', 'withX', 'fought', 'heard', 'saw'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const ask = (vars: Record<string, string> = {}): string => `${line(npc, PROBE_OPEN)}${line(npc, PROBE_ASK[topic], vars)}`;

  if (topic === 'talked' || topic === 'fought') {
    const map = topic === 'talked' ? h.log.talked : h.log.fought;
    const note = topic === 'talked' ? notes.talkedWith : notes.foughtWith;
    const verb = topic === 'talked' ? '話した' : '対戦した';
    const truth = latest(map);
    const fake = randomOther();
    const tell = (id: string) => () => {
      note.set(id, now);
      if (topic === 'fought') npc.knowledge.observeBattle(h.me.id, id, now);
    };
    const options: ProbeOption[] = truth
      ? [{ label: `${h.nameOf(truth)}と${verb}`, kind: 'honest', apply: tell(truth) }, { label: `誰とも${verb.replace('た', 'ていない')}`, kind: 'lie' }, refuse]
      : [{ label: `誰とも${verb.replace('た', 'ていない')}`, kind: 'honest' }, ...(fake ? [{ label: `${fake.name}と${verb}`, kind: 'lie' as const, apply: tell(fake.id) }] : []), refuse];
    return { text: ask(), options };
  }

  if (topic === 'withX') {
    const last = latest(h.log.talked);
    const x = last && Math.random() < 0.6 ? last : (randomOther()?.id ?? null);
    if (x) {
      const truth = last === x;
      const yes: ProbeOption = { label: 'うん、一緒にいた', kind: truth ? 'honest' : 'lie', apply: () => notes.talkedWith.set(x, now) };
      const no: ProbeOption = { label: 'いや、一緒じゃない', kind: truth ? 'lie' : 'honest' };
      const name = h.nameOf(x) + SPEECH[npc.speechStyle].honorific(h.sim.agents.find((a) => a.id === x)?.gender ?? 'other');
      return { text: ask({ O: name }), options: [yes, no, refuse] };
    }
  }

  if (topic === 'heard') {
    const item = h.intel.tellable(npc.id, 1)[0];
    if (item?.rumor) {
      const r = item.rumor;
      return {
        text: ask(),
        options: [
          {
            label: `${h.nameOf(item.subjectIds[0])}の話を聞いた`,
            kind: 'honest',
            apply: () => {
              npc.knowledge.hear(r); // プレイヤーが持っていた噂がNPCに伝わる
              notes.knowsAbout.set(r.subjectId, now);
            },
          },
          { label: '何も聞いていない', kind: 'lie' },
          refuse,
        ],
      };
    }
    return { text: ask(), options: [{ label: '何も聞いていない', kind: 'honest' }, refuse] };
  }

  // saw：近くで見かけた勝負など
  const seen = h.intel.latestOfKind('sighting', now, recent, npc.id);
  if (seen) {
    const ids = seen.subjectIds;
    const names = ids.map((id) => h.nameOf(id)).join('と');
    return {
      text: ask(),
      options: [
        {
          label: `${names}を見かけた`,
          kind: 'honest',
          apply: () => {
            for (const id of ids) notes.knowsAbout.set(id, now);
            if (ids.length === 2) npc.knowledge.observeBattle(ids[0], ids[1], now);
          },
        },
        { label: '誰も見ていない', kind: 'lie' },
        refuse,
      ],
    };
  }
  return { text: ask(), options: [{ label: '誰も見ていない', kind: 'honest' }, refuse] };
}

// プレイヤーが答えた：NPCの反応と、友好度・NPCの内部情報の変化
export function answerProbe(h: ProbeHost, npc: Agent, opt: ProbeOption): ProbeResult {
  const R = Rules.relations;
  const P = Rules.conversation.probe;
  const rel = h.sim.relations;
  const s = npc.personality.social;
  if (opt.kind === 'honest') {
    opt.apply?.();
    rel.adjust(npc.id, h.me.id, R.probeHonest);
    const favor = rel.affinity(npc.id, h.me.id) >= 0 && Math.random() < P.favorChance * npc.personality.infoChance;
    return { text: line(npc, PROBE_REACT.thanks), favor };
  }
  if (opt.kind === 'lie') {
    const detect = P.npcDetectBase + (1 - s.trust) * 0.3 + npc.skill * 0.1;
    if (Math.random() < detect) {
      rel.adjust(npc.id, h.me.id, R.probeLieCaught);
      npc.knowledge.playerNotes.lies++; // 以後、プレイヤーの話を疑いやすくなる
      return { text: `${line(npc, PROBE_REACT.doubt)}\n（……疑われているようだ）`, favor: false };
    }
    opt.apply?.(); // 間違った情報を信じた
    rel.adjust(npc.id, h.me.id, R.probeLieOk);
    return { text: line(npc, PROBE_REACT.lieOk), favor: false };
  }
  rel.adjust(npc.id, h.me.id, Math.round(R.probeRefuse * (0.5 + npc.personality.sociability)));
  return { text: line(npc, PROBE_REACT.refused), favor: false };
}
