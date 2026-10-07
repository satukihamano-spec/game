import { PLAYER_HAND, type CardId } from '../card/Card';
import { Rules } from '../data/rules';
import type { Agent } from './Agent';
import { chooseCardFor, resolveBattle, type BattleRecord } from './Battle';
import { pushOutOfBox, type Box2D } from './collision';
import { SPEECH } from '../data/speech';
import type { TalkTag } from '../data/smalltalk';
import { distort, type Rumor } from './Knowledge';
import { Relations } from './Relations';
import { npcAnswer, pickQuestion, reactionTo } from './SmallTalk';
import { giftReason, probeChance } from './Conversation';
import type { GiftReason } from '../data/conversation';
import {
  acceptsGift,
  giftCards,
  giftDesire,
  respondToChallenge,
  type ChallengeResponse,
  decisionChances,
  searchScale,
  talkAppeal,
  targetAppeal,
  battleDrive,
  type FloorContext,
} from './NpcBrain';

// フロアで起きた出来事（画面表示や情報メモに使う）
export type SimEvent =
  | { type: 'battle'; rec: BattleRecord }
  | { type: 'talk'; a: Agent; b: Agent }
  | { type: 'eliminated'; agent: Agent } // 星0で消滅
  | { type: 'finished'; agent: Agent; won: boolean } // カードを使い切ってフロアを去った
  | { type: 'challengePlayer'; npc: Agent } // NPCがプレイヤーに勝負を挑んできた
  | { type: 'giftOffer'; npc: Agent; cards: Record<CardId, number>; reason: GiftReason } // NPCがプレイヤーにカードを譲ろうとしている（理由つき）
  | { type: 'probePlayer'; npc: Agent } // NPCがプレイヤーに話しかけてきた（情報収集）
  | { type: 'gift'; from: Agent; to: Agent }; // NPC同士でカードを譲った（中身はプレイヤーには見せない）

// NPCの行動の速さ（スマホの負荷とゲームのテンポに合わせて調整する）
const SIM = {
  npcSpeed: 2.0, // 歩く速さ（m/秒）
  // 考える間隔などAIの数値は data/rules.ts の npcAi にある
  talkSec: 2.5, // NPC同士の会話にかかる時間
  battleSec: 2.5, // NPC同士の勝負にかかる時間
  approachGiveUpSec: 10, // 相手に近づくのを諦めるまで
  reachDistance: 1.4, // この距離まで近づいたら話しかける
  searchRadius: 14, // 相手を探す範囲
  playerSearchRadius: 20, // プレイヤーを勝負相手として探す範囲
  playerTargetBias: 6, // プレイヤーを狙う強さ（大きいほどプレイヤーがよく挑まれる）
  npcRadius: 0.45,
} as const;

export class FloorSim {
  time = 0; // ゲーム開始からの経過秒数
  readonly player: Agent;
  readonly agents: Agent[]; // プレイヤーも含む全員
  playerAvailable = true; // プレイヤーが探索中（挑戦を受けられる）か
  // フロア全体のカード残数（生きている全員の手札の合計）。ゲーム全体でこれ1つだけを使う。
  // 5つの掲示板はすべてこれを表示する。カードが使われたり破棄されたりしたときに recountCards() で更新する
  readonly cardTotals: Record<CardId, number> = { rock: 0, scissors: 0, paper: 0 };
  // 人間関係（NPC↔NPC、NPC↔プレイヤーの友好度など）
  readonly relations = new Relations();
  private playerChallengeReadyAt = 15; // 開始直後15秒は挑まれない
  private playerProbeReadyAt = 60; // NPCがプレイヤーに話しかけて（情報収集）くるのは、この時刻から

  private readonly obstacles: Box2D[];
  private readonly half: number; // 部屋の半分の大きさ
  private readonly starsToWin: number;
  private readonly pace: number; // NPCが勝負を挑む頻度の倍率（モードで決まる）
  private readonly timeLimitSec: number;
  readonly perType: number; // このモードの通常参加者の初期枚数（種類ごと）
  readonly participants: number; // ゲーム開始時の総参加人数（プレイヤーを含む）
  private readonly initialCards: number; // ゲーム開始時のフロア全体のカード総数（100%）
  // フロア全体の状況（経過時間・カード残数など）。全NPCで共通なので、1フレームに1回だけ計算する
  ctx: FloorContext = { progress: 0, cardRatio: 1, starsToWin: 3, pace: 1 };
  private thinksThisFrame = 0;
  private readonly onEvent: (e: SimEvent) => void;

  constructor(
    player: Agent,
    npcs: Agent[],
    obstacles: Box2D[],
    opts: { roomSize: number; starsToWin: number; npcPace: number; timeLimitSec: number; perType?: number },
    onEvent: (e: SimEvent) => void,
  ) {
    this.player = player;
    this.agents = [player, ...npcs];
    this.obstacles = obstacles;
    this.half = opts.roomSize / 2 - 0.8;
    this.starsToWin = opts.starsToWin;
    this.pace = opts.npcPace;
    this.timeLimitSec = opts.timeLimitSec;
    this.perType = opts.perType ?? 3;
    this.participants = npcs.length + 1;
    this.onEvent = onEvent;
    this.recountCards();
    this.initialCards = this.cardTotals.rock + this.cardTotals.scissors + this.cardTotals.paper;
    for (const n of npcs) {
      // NPC → プレイヤーの最初の友好度（通常は「中程度」。NPCごとに npcs.ts で変更できる）
      // NPC同士（A→B と B→A は別々）は、必要になったときにランダムな第一印象で作られる
      this.relations.seed(n.id, player.id, n.traits.playerAffinity);
      n.nextThinkAt = Math.random() * Rules.npcAi.thinkMax; // 全員が同時に考えないようにずらす
      n.act = { k: 'idle', until: n.nextThinkAt };
    }
  }

  // フロア全体のカード残数を数え直す（カードが使われた・破棄されたときに呼ぶ）
  private recountCards(): void {
    const t = this.cardTotals;
    t.rock = t.scissors = t.paper = 0;
    for (const a of this.agents) {
      if (!a.alive) continue; // 消滅した人のカードは破棄されたので数えない
      for (const c of PLAYER_HAND) t[c] += a.hand.counts[c];
    }
  }


  // フロア全体の状況を更新する（全NPC共通）
  private updateContext(): void {
    const total = this.cardTotals.rock + this.cardTotals.scissors + this.cardTotals.paper;
    this.ctx = {
      progress: Math.min(1, this.time / this.timeLimitSec),
      cardRatio: this.initialCards > 0 ? total / this.initialCards : 0,
      starsToWin: this.starsToWin,
      pace: this.pace,
    };
  }

  // 今フロアにいる参加者の人数（プレイヤーを含む）
  aliveCount(): number {
    return this.agents.filter((a) => a.alive).length;
  }

  aliveNpcs(): Agent[] {
    return this.agents.filter((a) => a.alive && !a.isPlayer);
  }

  // ───────────── 毎フレームの処理 ─────────────

  update(dt: number): void {
    this.time += dt;
    this.updateContext();
    this.thinksThisFrame = 0;
    for (const a of this.agents) {
      if (!a.alive || a.isPlayer) continue;
      this.updateNpc(a, dt);
    }
  }

  private updateNpc(a: Agent, dt: number): void {
    const act = a.act;
    switch (act.k) {
      case 'idle':
        break;
      case 'wander':
        if (this.moveToward(a, act.tx, act.tz, dt, 0.3)) a.act = { k: 'idle', until: this.time + 1 + Math.random() * 2 };
        break;
      case 'approach': {
        const t = act.target;
        const targetOk =
          t.alive && (t.isPlayer || t.isInterruptible()) && (act.intent === 'talk' || act.intent === 'probe' || t.canBattle());
        if (!targetOk || this.time > act.giveUpAt) {
          a.act = { k: 'idle', until: this.time + 1 };
          break;
        }
        if (this.moveToward(a, t.x, t.z, dt, SIM.reachDistance)) this.arrive(a, t, act.intent);
        break;
      }
      case 'engaged':
        a.facing = Math.atan2(act.partner.x - a.x, act.partner.z - a.z);
        // 2人のうち「挑んだ側」が終了処理をする（二重に処理しないため）
        if (this.time >= act.until && act.partner.act.k === 'engaged') this.finishEngagement(a, act.partner, act.what);
        break;
      case 'withPlayer':
        a.facing = Math.atan2(this.player.x - a.x, this.player.z - a.z);
        return;
    }

    // 考える（毎フレームではなく、数秒おき。1フレームで考える人数にも上限を設けてCPU負荷を平らにする）
    if (
      (a.act.k === 'idle' || a.act.k === 'wander') &&
      this.time >= a.nextThinkAt &&
      this.thinksThisFrame < Rules.npcAi.maxThinksPerFrame
    ) {
      this.thinksThisFrame++;
      this.think(a);
      const ai = Rules.npcAi;
      const interval = ai.thinkMin + Math.random() * (ai.thinkMax - ai.thinkMin);
      a.nextThinkAt = this.time + interval * (this.aiLevel(a) === 'far' ? ai.farThinkScale : 1);
    }
  }

  // AIの細かさ：プレイヤーの近くは 'near'（詳細）、遠くは 'far'（簡略：考える間隔を長くする）
  // 将来、遠いNPCの判断をさらに簡単にしたいときは、ここで分けた結果を使う
  aiLevel(a: Agent): 'near' | 'far' {
    return Math.hypot(a.x - this.player.x, a.z - this.player.z) <= Rules.npcAi.nearDistance ? 'near' : 'far';
  }

  // 目的地へ歩く。stopDist 以内に着いたら true
  private moveToward(a: Agent, tx: number, tz: number, dt: number, stopDist: number): boolean {
    const dx = tx - a.x;
    const dz = tz - a.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= stopDist) return true;
    const step = Math.min(dist - stopDist, SIM.npcSpeed * dt);
    a.x += (dx / dist) * step;
    a.z += (dz / dist) * step;
    a.facing = Math.atan2(dx, dz);
    for (const b of this.obstacles) pushOutOfBox(a, SIM.npcRadius, b);
    return false;
  }

  // ───────────── NPCの判断 ─────────────

  private think(a: Agent): void {
    // 対戦するか・情報を集めるかの確率は NpcBrain.ts で、時間・カード残数・性格などから決まる
    // 勝利条件を満たしていてカードが余って焦っているなら、仲のいい相手にカードを譲りに行く
    if (Math.random() < giftDesire(a, this.ctx) * 0.25) {
      const friend = this.pickGiftTarget(a);
      if (friend) {
        a.act = { k: 'approach', target: friend, intent: 'gift', giveUpAt: this.time + this.giveUpSec(a, friend) };
        return;
      }
    }

    // プレイヤーに話しかけて情報を集める（積極的・社交的なNPCほど。臆病・慎重なNPCはあまり来ない）
    if (this.time >= a.probeReadyAt && this.time >= this.playerChallengeReadyAt && this.time >= this.playerProbeReadyAt) {
      const d = Math.hypot(this.player.x - a.x, this.player.z - a.z);
      if (d <= Rules.conversation.probe.radius && Math.random() < probeChance(a, this.ctx, this.relations.affinity(a.id, this.player.id))) {
        a.probeReadyAt = this.time + Rules.conversation.probe.npcCooldownSec;
        a.act = { k: 'approach', target: this.player, intent: 'probe', giveUpAt: this.time + this.giveUpSec(a, this.player) };
        return;
      }
    }

    const chances = decisionChances(a, this.ctx, SPEECH[a.speechStyle].talkative);
    const r = Math.random();
    const pChallenge = chances.challenge;
    const pTalk = chances.talk;

    if (r < pChallenge) {
      const target = this.pickChallengeTarget(a);
      if (target) {
        a.act = { k: 'approach', target, intent: 'challenge', giveUpAt: this.time + this.giveUpSec(a, target) };
        return;
      }
    } else if (r < pChallenge + pTalk) {
      const target = this.pickTalkTarget(a);
      if (target) {
        a.act = { k: 'approach', target, intent: 'talk', giveUpAt: this.time + this.giveUpSec(a, target) };
        return;
      }
    }

    if (Math.random() < 0.6) {
      // ぶらぶら歩く
      const ang = Math.random() * Math.PI * 2;
      const d = 3 + Math.random() * 6;
      const tx = Math.max(-this.half, Math.min(this.half, a.x + Math.cos(ang) * d));
      const tz = Math.max(-this.half, Math.min(this.half, a.z + Math.sin(ang) * d));
      a.act = { k: 'wander', tx, tz };
    } else {
      a.act = { k: 'idle', until: this.time + 2 };
    }
  }

  // 相手に近づくのを諦めるまでの時間（遠い相手ほど長く待つ）
  private giveUpSec(a: Agent, t: Agent): number {
    return Math.max(SIM.approachGiveUpSec, Math.hypot(t.x - a.x, t.z - a.z) / SIM.npcSpeed + 4);
  }

  private pickChallengeTarget(a: Agent): Agent | null {
    // 焦っているほど遠くまで相手を探す。とても焦っていればフロア全体から探す
    const scale = searchScale(a, this.ctx);
    const desperate = battleDrive(a, this.ctx) > 2.5;
    const candidates: { t: Agent; w: number }[] = [];
    for (const t of this.agents) {
      if (t === a || !t.canBattle()) continue;
      if (t.isPlayer) {
        if (this.time < this.playerChallengeReadyAt) continue;
      } else if (!t.isInterruptible()) continue;
      const d = Math.hypot(t.x - a.x, t.z - a.z);
      const radius = (t.isPlayer ? SIM.playerSearchRadius : SIM.searchRadius) * scale;
      if (d > radius && !desperate) continue;
      let w = targetAppeal(a, t, d, this.perType, this.relations, this.time, this.ctx);
      if (t.isPlayer) w *= a.targetPlayer * SIM.playerTargetBias;
      candidates.push({ t, w });
    }
    return weightedPick(candidates);
  }

  // カードを譲る相手：友好度が高い相手だけ（低い相手には基本的に譲らない）
  private pickGiftTarget(a: Agent): Agent | null {
    const candidates: { t: Agent; w: number }[] = [];
    for (const t of this.agents) {
      if (t === a || !t.alive) continue;
      if (t.isPlayer ? this.time < this.playerChallengeReadyAt : !t.isInterruptible()) continue;
      const aff = this.relations.affinity(a.id, t.id);
      if (aff < Rules.relations.warmAt) continue;
      const d = Math.hypot(t.x - a.x, t.z - a.z);
      if (d > SIM.searchRadius * 1.5) continue;
      candidates.push({ t, w: (aff / 30) ** 2 / (1 + d / 6) });
    }
    return weightedPick(candidates);
  }

  // カードを移す（譲渡）。フロア全体の枚数は変わらない
  transferCards(from: Agent, to: Agent, cards: Record<CardId, number>): void {
    for (const c of PLAYER_HAND) {
      const n = Math.min(cards[c], from.hand.counts[c]);
      from.hand.counts[c] -= n;
      to.hand.counts[c] += n;
    }
    this.relations.adjust(to.id, from.id, 6);
    this.relations.adjust(from.id, to.id, 3);
    to.knowledge.observeTotal(from.id, from.hand.total(), this.time);
    from.knowledge.observeTotal(to.id, to.hand.total(), this.time);
    this.recountCards();
  }

  private pickTalkTarget(a: Agent): Agent | null {
    const candidates: { t: Agent; w: number }[] = [];
    for (const t of this.agents) {
      if (t === a || t.isPlayer || !t.isInterruptible()) continue;
      const d = Math.hypot(t.x - a.x, t.z - a.z);
      if (d > SIM.searchRadius) continue;
      candidates.push({ t, w: talkAppeal(a, t, d, this.time, this.relations) }); // 最近情報を得た相手・親しい相手に話しかける
    }
    return weightedPick(candidates);
  }

  // 相手のところに着いた
  private arrive(a: Agent, t: Agent, intent: 'talk' | 'challenge' | 'gift' | 'probe'): void {
    if (intent === 'gift') {
      this.arriveGift(a, t);
      return;
    }
    if (intent === 'probe') {
      if (t.isPlayer && this.playerAvailable && this.time >= this.playerChallengeReadyAt && this.time >= this.playerProbeReadyAt) {
        a.act = { k: 'withPlayer' };
        this.playerChallengeReadyAt = this.time + Rules.challengeCooldownSec;
        this.playerProbeReadyAt = this.time + Rules.conversation.probe.floorCooldownSec;
        this.onEvent({ type: 'probePlayer', npc: a });
      } else {
        a.act = { k: 'idle', until: this.time + 1 };
      }
      return;
    }
    if (t.isPlayer) {
      // プレイヤーへの挑戦（プレイヤーが探索中のときだけ）
      if (this.playerAvailable && this.time >= this.playerChallengeReadyAt && t.canBattle() && a.canBattle()) {
        a.act = { k: 'withPlayer' };
        this.playerChallengeReadyAt = this.time + Rules.challengeCooldownSec;
        this.onEvent({ type: 'challengePlayer', npc: a });
      }
      return; // 待てない場合は近くで待機し、やがて諦める
    }

    if (!t.isInterruptible()) {
      a.act = { k: 'idle', until: this.time + 1 };
      return;
    }

    if (intent === 'talk') {
      if (Math.random() < 0.5 + 0.5 * t.personality.sociability) this.engage(a, t, 'talk', SIM.talkSec);
      else a.act = { k: 'idle', until: this.time + 1 };
      return;
    }

    // 勝負を挑む：相手は性格・友好度・直前の勝負・クールダウンなどで受けるか決める
    const res = a.canBattle() && t.canBattle() ? this.respond(t, a) : null;
    if (res?.accept) {
      const rec = resolveBattle(a, t, chooseCardFor(a, t), chooseCardFor(t, a), this.time);
      this.afterBattle(rec);
      this.engage(a, t, 'battle', SIM.battleSec);
      this.onEvent({ type: 'battle', rec });
    } else {
      a.act = { k: 'idle', until: this.time + 1 };
    }
  }

  // カードを譲りに来た：プレイヤーなら受け取るか聞く。NPCなら受け取るか判断する
  private arriveGift(a: Agent, t: Agent): void {
    // 相手が少なそうな種類を選ぶ（気前のいい性格だけ）ために、相手の手札を自分の知っている情報から見積もる
    const { cards, advice } = giftCards(a, a.knowledge.estimateRemaining(t.id, this.perType));
    if (t.isPlayer) {
      if (this.playerAvailable && this.time >= this.playerChallengeReadyAt) {
        a.act = { k: 'withPlayer' };
        this.playerChallengeReadyAt = this.time + Rules.challengeCooldownSec;
        const n = cards.rock + cards.scissors + cards.paper;
        const reason = giftReason(a, this.ctx, this.relations.affinity(a.id, t.id), n >= a.hand.total(), advice);
        this.onEvent({ type: 'giftOffer', npc: a, cards, reason });
      }
      return; // 待てない場合は近くで待機し、やがて諦める
    }
    if (t.isInterruptible() && acceptsGift(t, this.ctx, this.relations.affinity(t.id, a.id))) {
      this.transferCards(a, t, cards);
      this.onEvent({ type: 'gift', from: a, to: t });
      this.checkRemoval(a); // 全部譲ったらフロアを去る
    } else {
      this.relations.adjust(a.id, t.id, -2);
    }
    if (a.alive) a.act = { k: 'idle', until: this.time + 1 };
  }

  // 勝負を挑まれたときの反応を決め、断ったら記録する（続けて断るとクールダウン）
  private respond(t: Agent, challenger: Agent): ChallengeResponse {
    const res = respondToChallenge(t, challenger, this.ctx, this.relations, this.time);
    if (!res.accept) {
      this.relations.recordRefusal(t.id, challenger.id, this.time, t.personality.social.cooldownSec);
      this.relations.adjust(challenger.id, t.id, -2); // 断られた側は少し気分を害する
    }
    return res;
  }

  // 勝負のあとの共通処理：カード残数の更新・目撃・人間関係（負けた側の友好度が下がる）
  private afterBattle(rec: BattleRecord): void {
    this.recountCards();
    this.observe(rec);
    const winner = rec.outcome === 'win' ? rec.a.id : rec.outcome === 'lose' ? rec.b.id : null;
    // プレイヤーに負けたNPCの友好度の変化は、性格で変える（負けず嫌いほど大きく下がる・強者を認める性格は上がることも）
    const loser = winner === this.player.id ? (rec.a.isPlayer ? rec.b : rec.a) : null;
    const before = loser ? this.relations.affinity(loser.id, this.player.id) : 0;
    this.relations.recordBattle(rec.a.id, rec.b.id, winner, rec.t);
    if (loser) {
      const R = Rules.relations;
      const s = loser.personality.social;
      const rel = this.relations.get(loser.id, this.player.id);
      const delta = rel.affinity - before; // 基本の下がり幅（連敗ほど大きい）
      const respected = rel.lossStreak === 1 && Math.random() < s.respect * R.respectChance;
      this.relations.seed(loser.id, this.player.id, before + (respected ? R.respectGain : Math.round(delta * s.sore)));
    }
  }

  private engage(a: Agent, b: Agent, what: 'talk' | 'battle', sec: number): void {
    const until = this.time + sec;
    a.act = { k: 'engaged', partner: b, what, until };
    b.act = { k: 'engaged', partner: a, what, until: until + 0.01 }; // a が先に終了処理をする
    if (what === 'talk') this.onEvent({ type: 'talk', a, b });
  }

  private finishEngagement(a: Agent, b: Agent, what: 'talk' | 'battle'): void {
    if (what === 'talk') {
      this.smallTalk(a, b); // 世間話で友好度が変わる
      this.exchange(a, b);
      this.exchange(b, a);
      this.leak(a, b);
      this.leak(b, a);
    }
    for (const x of [a, b]) {
      x.act = { k: 'idle', until: this.time + 1 };
      this.checkRemoval(x);
    }
  }

  // NPC同士の世間話：お互いに質問に答え、好みに合えば仲良くなり、合わなければ険悪になる
  private smallTalk(a: Agent, b: Agent): void {
    if (Math.random() > (a.traits.smallTalk + b.traits.smallTalk) / 2) return;
    for (const [asker, answerer] of [
      [a, b],
      [b, a],
    ]) {
      const tag = npcAnswer(answerer, pickQuestion());
      this.relations.adjust(asker.id, answerer.id, reactionTo(asker, tag).delta);
      // 自分の気持ち（好き／嫌い）がはっきりしていれば、それも「情報」になって噂で広まる
      const aff = this.relations.affinity(asker.id, answerer.id);
      if (Math.abs(aff) >= Rules.relations.warmAt) asker.knowledge.observeRelation(asker.id, answerer.id, aff > 0, this.time);
    }
  }

  // ───────────── 情報 ─────────────

  // 実際に嘘をつく確率。次の要素を組み合わせる（数値は data/rules.ts の lying）
  //   ① 本人の嘘傾向（traits.lie）… 0 なら嘘をつかない
  //   ② 相手への友好度 … 高いほど嘘が減る（ただし0にはならない）。低いほど嘘が増える
  //   ③ 性格 … 正直さが低い性格ほど少し増える
  //   ④ 話の内容 … カード総数など大事な情報ほど嘘をつきやすい
  //   ⑤ 状況 … 星が足りないまま終盤になるほど、なりふり構わず嘘をつく
  // ※ プレイヤーが嘘を見抜いた「警戒度」はプレイヤー側の記録なので、ここでは使わない
  lieChance(teller: Agent, listener: Agent, r?: Rumor): number {
    const L = Rules.lying;
    const base = teller.traits.lie;
    if (base <= 0) return 0;
    const aff = this.relations.affinity(teller.id, listener.id);
    let p = aff >= 0 ? base * (1 - L.friendlyReduce * (aff / 100)) : base + L.hostileAdd * (-aff / 100);
    p *= L.personalityBase + L.personalityDishonesty * (1 - teller.personality.honesty);
    if (r) p *= L.byKind[r.kind];
    const starsShort = Math.max(0, this.starsToWin - teller.stars) / this.starsToWin;
    p *= 1 + L.pressure * starsShort * this.ctx.progress;
    if (r && L.byKind[r.kind] === 0) return 0; // ごまかしようのない話（誰と勝負したか）
    return Math.max(base * L.minRatio, Math.min(L.max, p));
  }

  // teller が listener に噂を話す（親しい相手には多めに話す）
  private exchange(teller: Agent, listener: Agent): void {
    const aff = this.relations.affinity(teller.id, listener.id);
    const count = (Math.random() < teller.personality.sociability ? 2 : 1) + (aff >= Rules.relations.warmAt ? 1 : 0) - (aff <= Rules.relations.coldAt ? 1 : 0);
    if (count <= 0) return;
    // 「プレイヤーがあなたのことを聞き回っていた」と、本人に伝わることがある（NPCの内部情報）
    const asked = teller.knowledge.playerNotes.knowsAbout.get(listener.id);
    const mine = listener.knowledge.playerNotes.knowsAbout;
    if (asked !== undefined && asked > (mine.get(listener.id) ?? -Infinity)) mine.set(listener.id, asked);
    const rumors = teller.knowledge.pickRumors(this.time, count, {
      gossip: teller.personality.gossip,
      playerId: this.player.id,
      excludeId: listener.id,
      isAlive: (id) => this.isAlive(id),
    });
    for (const r of rumors) listener.knowledge.hear(distort(r, this.lieChance(teller, listener, r), this.perType));
  }

  // 会話の中で、相手本人から手札の情報を直接聞き出す（自分で入手した情報 → ℹ マーク）
  private leak(listener: Agent, speaker: Agent): void {
    if (Math.random() >= Rules.talkLeakChance) return;
    // カード総数（重要な情報）を聞き出すこともある
    if (Math.random() < 0.4) {
      listener.knowledge.observeTotal(speaker.id, speaker.hand.total(), this.time);
      return;
    }
    const card = PLAYER_HAND[Math.floor(Math.random() * PLAYER_HAND.length)];
    listener.knowledge.observeRemaining(speaker.id, card, speaker.hand.counts[card], this.perType, this.time);
  }

  // NPCがプレイヤーに教える噂。友好度が高いほど教えてくれやすく、低いと隠したり嘘をついたりしやすい
  // ※ プレイヤー本人との会話では、プレイヤーの星の数の話はしない（NPC同士の会話では話題にする）
  //   hidden = 知っているのに教えなかった（冷たい態度）
  //   lied = このNPCが（自分の意思で）内容を変えて話した ＝ 嘘をついた
  rumorForPlayer(npc: Agent): { rumor: Rumor | null; hidden: boolean; lied: boolean } {
    const aff = this.relations.affinity(npc.id, this.player.id);
    const chance = Math.max(0.05, Math.min(1, npc.personality.infoChance * (1 + aff / 120)));
    const playerId = this.player.id;
    const [r] = npc.knowledge.pickRumors(this.time, 1, {
      gossip: npc.personality.gossip,
      playerId,
      excludeId: npc.id,
      isAlive: (id) => this.isAlive(id),
      skip: (x) => x.kind === 'stars' && x.subjectId === playerId,
    });
    if (!r) return { rumor: null, hidden: false, lied: false };
    if (Math.random() > chance) return { rumor: null, hidden: aff < 0, lied: false };
    const told = distort(r, this.lieChance(npc, this.player, r), this.perType);
    npc.knowledge.playerNotes.knowsAbout.set(r.subjectId, this.time); // 「プレイヤーはこの人の情報を持った」と覚える
    return { rumor: told, hidden: false, lied: told !== r };
  }

  // プレイヤーに嘘を見抜かれた：NPCは気まずくなり、プレイヤーへの友好度が少し下がる
  playerCaughtLie(npc: Agent): void {
    this.relations.adjust(npc.id, this.player.id, Rules.relations.caughtLying);
  }

  // プレイヤーとの世間話：プレイヤーの答え（tag）にNPCが反応し、友好度が変わる
  playerSmallTalk(npc: Agent, tag: TalkTag): 'good' | 'neutral' | 'bad' {
    const r = reactionTo(npc, tag);
    this.relations.adjust(npc.id, this.player.id, r.delta);
    return r.kind;
  }

  // プレイヤーがNPCに情報を教える：情報の新しさ・性格・友好度で反応が変わる
  playerTellsInfo(npc: Agent, rumor: Rumor): 'happy' | 'little' | 'none' | 'doubt' | 'wary' {
    const R = Rules.relations;
    const s = npc.personality.social;
    const aff = this.relations.affinity(npc.id, this.player.id);
    if (!npc.knowledge.isNewTo(rumor)) return 'none'; // もう知っている（価値がない）
    npc.knowledge.playerNotes.knowsAbout.set(rumor.subjectId, this.time); // プレイヤーはこの人の情報を持っている
    // プレイヤーの嘘に何度も気づいているNPCほど、話を疑う
    const doubtChance = (1 - s.trust) * 0.6 + (aff < 0 ? 0.2 : 0) + Math.min(0.3, npc.knowledge.playerNotes.lies * 0.15);
    const roll = Math.random();
    if (roll < doubtChance * 0.4 && npc.personality.ai.caution >= 0.5) {
      this.relations.adjust(npc.id, this.player.id, R.tellWary);
      return 'wary'; // 「なぜ教える？」と逆に警戒
    }
    if (roll < doubtChance) {
      if (Math.random() < 0.5) npc.knowledge.hear(rumor); // 疑いつつ半分は覚えておく
      return 'doubt';
    }
    npc.knowledge.hear(rumor);
    const happy = s.trust + Math.random() * 0.5 > 0.8;
    this.relations.adjust(npc.id, this.player.id, happy ? R.tellHappy : R.tellLittle);
    return happy ? 'happy' : 'little';
  }

  // 近くにいたNPCは勝負を目撃し、出したカードと星を覚える
  observe(rec: BattleRecord): void {
    for (const o of this.agents) {
      if (!o.alive || o.isPlayer || o === rec.a || o === rec.b) continue;
      if (Math.hypot(o.x - rec.x, o.z - rec.z) > Rules.npcSeeDistance) continue;
      o.knowledge.observeUse(rec.a.id, rec.cardA, rec.t);
      o.knowledge.observeUse(rec.b.id, rec.cardB, rec.t);
      o.knowledge.observeStars(rec.a.id, rec.a.stars, rec.t);
      o.knowledge.observeStars(rec.b.id, rec.b.stars, rec.t);
      o.knowledge.observeBattle(rec.a.id, rec.b.id, rec.t);
      o.knowledge.observeBattle(rec.b.id, rec.a.id, rec.t);
    }
  }

  // 星0 → 消滅（残りカードは破棄）。カード0 → フロアを去る
  checkRemoval(x: Agent): void {
    if (!x.alive || x.isPlayer) return;
    if (x.stars <= 0) {
      x.alive = false;
      x.removedReason = 'eliminated';
      x.hand.clear();
      this.recountCards(); // 消滅したNPCの残りカードが破棄された
      this.relations.forget(x.id); // 以後、誰のAIの対象にもならない
      this.onEvent({ type: 'eliminated', agent: x });
    } else if (x.hand.total() === 0) {
      x.alive = false;
      x.removedReason = 'finished';
      this.relations.forget(x.id);
      this.onEvent({ type: 'finished', agent: x, won: x.stars >= this.starsToWin });
    }
  }

  isAlive(id: string): boolean {
    return this.agents.some((a) => a.id === id && a.alive);
  }

  // ───────────── プレイヤーとのやりとり ─────────────

  holdForPlayer(npc: Agent): void {
    npc.act = { k: 'withPlayer' };
  }

  release(npc: Agent): void {
    if (npc.alive) npc.act = { k: 'idle', until: this.time + 2 };
    npc.nextThinkAt = this.time + 3;
  }

  // プレイヤーからの勝負への反応（性格・友好度・直前の勝負・クールダウンで変わる）
  respondToPlayer(npc: Agent): ChallengeResponse {
    if (!npc.canBattle()) return { accept: false, reason: 'general' };
    return this.respond(npc, this.player);
  }

  // プレイヤーとNPCの勝負（NPCはプレイヤーのカードを見る前に手を決める）
  battleWithPlayer(npc: Agent, playerCard: CardId): BattleRecord {
    const npcCard = chooseCardFor(npc, this.player);
    const rec = resolveBattle(this.player, npc, playerCard, npcCard, this.time);
    this.afterBattle(rec);
    // 対戦したので、プレイヤーに自分の手を見られた（NPCの内部情報）
    npc.knowledge.playerNotes.knowsAbout.set(npc.id, this.time); // カード残数・目撃・友好度（プレイヤーに負けたNPCは友好度が下がる。連敗ほど大きく）
    this.playerChallengeReadyAt = Math.max(this.playerChallengeReadyAt, this.time + 10);
    return rec;
  }

  // 逃げたときのリスク：時間を失い、一定確率で星を奪われる
  playerFled(npc: Agent): { starLost: boolean } {
    let starLost = false;
    if (Math.random() < Rules.flee.starLossChance && this.player.stars > 0) {
      this.player.stars--;
      npc.stars++;
      starLost = true;
    }
    npc.knowledge.observeStars(this.player.id, this.player.stars, this.time);
    this.relations.adjust(npc.id, this.player.id, -3); // 逃げられて少し気分を害する
    return { starLost };
  }
}

function weightedPick<T>(items: { t: T; w: number }[]): T | null {
  const total = items.reduce((s, i) => s + i.w, 0);
  if (total <= 0) return null;
  let x = Math.random() * total;
  for (const i of items) {
    x -= i.w;
    if (x <= 0) return i.t;
  }
  return items[items.length - 1].t;
}
