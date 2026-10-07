import { CARDS } from '../card/Card';
import { fill, SPEECH, type Gender, type RumorKey, type SpeechStyle } from '../data/speech';
import type { Rumor } from './Knowledge';

// 噂を、話す人の言葉遣いに合わせたセリフに変換する
//   同じ内容でも、言葉遣い（丁寧・乱暴・子供っぽい…）によって言い回しが変わる
export function rumorToText(
  r: Rumor,
  speaker: { style: SpeechStyle; gender: Gender },
  people: { nameOf: (id: string) => string; genderOf: (id: string) => Gender; playerId: string },
  now: number,
): string {
  const def = SPEECH[speaker.style];
  const age = now - r.t;
  const when = age < 45 ? 'さっき' : age < 150 ? '少し前に' : 'だいぶ前に';
  // 人の呼び方：プレイヤーなら二人称、NPCなら名前＋言葉遣いに合った呼び方（「さん」「ちゃん」など）
  const call = (id: string): string =>
    id === people.playerId ? def.you : people.nameOf(id) + def.honorific(people.genderOf(id));

  const vars: Record<string, string> = { S: call(r.subjectId), W: when };
  let key: RumorKey;
  if (r.kind === 'fought') {
    key = 'fought';
    vars.O = call(r.opponentId);
  } else if (r.kind === 'relation') {
    key = r.good ? 'relGood' : 'relBad';
    vars.O = call(r.otherId);
  } else if (r.kind === 'stars') {
    key = 'stars';
    vars.V = String(r.v);
  } else if (r.kind === 'total') {
    key = 'total';
    vars.V = String(r.v);
  } else {
    vars.C = CARDS[r.card].name;
    key = r.n >= 3 ? 'usedAll' : r.n === 2 ? 'used2' : r.n === 1 ? 'used1' : 'keep';
  }
  return fill(def.rumor[key], { I: def.I[speaker.gender], you: def.you, ...vars });
}
