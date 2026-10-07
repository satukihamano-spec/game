import { PLAYER_HAND, type CardId } from '../card/Card';
import { Rules } from '../data/rules';
import type { Agent } from './Agent';
import type { Relations } from './Relations';

// NPCの「やる気」を計算する場所。
// 対戦したいか・情報を集めたいか・勝負を受けるかを、次の要素を組み合わせて決める：
//   経過時間 / 残り時間 / フロア全体のカード残数 / 自分の残りカード / 自分の星 / 性格 / 持っている情報
//   相手との友好度 / 直前に対戦したか・負けたか / 対戦クールダウン
//   強欲さ（一部の特殊NPCと玄人だけ）/ 弱い者いじめ傾向（相手の星の数）
// ※ 性別と言葉遣いは見た目と話し方に使い、行動の判断には使わない（性別で行動を決めつけないため）。
//   ただし言葉遣いの「おしゃべり度」は会話の頻度に少しだけ影響する。
//
// どの値も確率や倍率として「なめらかに」変化する（ある時点で急にON/OFFにならない）。
// バランス調整は、ここの数式ではなく data/rules.ts の npcAi と data/personalities.ts の ai で行う。

// フロア全体の状況（全NPCで共通。FloorSim がまとめて計算して渡す）
export interface FloorContext {
  progress: number; // 経過時間の割合（0 = 開始、1 = 終了）
  cardRatio: number; // フロア全体のカード残数の割合（1 = 最初と同じ、0 = 全部なくなった）
  starsToWin: number;
  pace: number; // モードごとの対戦頻度の倍率
}

// 折れ線 [[位置, 値], ...] の、位置 x での値（間はまっすぐつなぐ）
export function curve(points: readonly (readonly [number, number])[], x: number): number {
  const sorted = points[0][0] <= points[points.length - 1][0] ? points : [...points].reverse();
  if (x <= sorted[0][0]) return sorted[0][1];
  for (let i = 1; i < sorted.length; i++) {
    const [x1, y1] = sorted[i];
    if (x <= x1) {
      const [x0, y0] = sorted[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return sorted[sorted.length - 1][1];
}

// 性格ごとの「序盤・中盤・終盤」の重み（序盤→中盤→終盤をなめらかにつなぐ）
function phaseWeight(a: Agent, progress: number): number {
  const [early, mid, late] = a.personality.ai.phase;
  return curve([[0, early], [0.5, mid], [1, late]], progress);
}

// 自分の残りカードの割合
function ownCardRatio(a: Agent): number {
  return a.initialTotal > 0 ? a.hand.total() / a.initialTotal : 0;
}

// 勝利条件（目標の星）を満たしているか
export function hasEnoughStars(a: Agent, ctx: FloorContext): boolean {
  return a.stars >= ctx.starsToWin;
}

// 強欲さ（持っていなければ 0）。強欲さを持つのは一部の特殊NPCと玄人だけ
export function greedOf(a: Agent): number {
  return a.traits.greed ?? 0;
}

// 強欲（勝利条件を満たしても星を稼ぎ続ける）か
export function isGreedy(a: Agent): boolean {
  return greedOf(a) >= 0.5;
}

// 勝利条件を満たした後の対戦意欲
//   強欲なNPC … まだ稼げると考えて、むしろ積極的に勝負を続ける（強欲さに個体差あり）
//   強欲さを持たないNPC … 生き残り・勝利条件を優先し、星を減らさないよう慎重になる
//     （ただしカードが残っていて時間がなければ焦る ＝ urgency。カードの譲渡も考える ＝ giftDesire）
// ※ 序盤（星の数がまだ動いていない時期）は効果を弱め、中盤にかけて本来の強さにする
//   （10分モードのように最初から目標の星を持っているモードで、開始直後から全員が守りに入らないように）
function securedFactor(a: Agent, ctx: FloorContext): number {
  if (!hasEnoughStars(a, ctx)) return 1;
  const g = greedOf(a);
  const S = Rules.npcAi.secured;
  let raw = g >= 0.5 ? 1 + (g - 0.5) * 1.6 : S.safeDrive + g * 1.3;
  if (raw < 1) raw += (1 - raw) * safeRelax(ctx); // 終盤はカードを使い切るため、守りを少しずつ解く
  return 1 + (raw - 1) * Math.min(1, ctx.progress / 0.4);
}

// 強欲でないNPCが「星を守る」のをやめていく度合い（0 = 守る、1 = 普段どおり）
function safeRelax(ctx: FloorContext): number {
  const from = Rules.npcAi.secured.relaxFrom;
  return Math.max(0, Math.min(1, (ctx.progress - from) / (1 - from)));
}

// 焦り：残り時間に対して自分のカードが多いほど大きくなる（1 = 焦っていない）
export function urgency(a: Agent, ctx: FloorContext): number {
  const timeLeft = 1 - ctx.progress;
  return 1 + 3 * Math.max(0, ownCardRatio(a) - timeLeft);
}

// フロア全体のカード残数による緊迫感（1 = 普通）。ギャンブラーは最初から高め
function cardPressure(a: Agent, ctx: FloorContext): number {
  const base = curve(Rules.npcAi.battleByCards, ctx.cardRatio);
  return Math.max(base, 1 + a.personality.ai.gamble);
}

// 慎重さ：カードも星も少ないとき、慎重な性格ほど勝負を控える（1 = 控えない、最小 0.2）
function cautionFactor(a: Agent, ctx: FloorContext): number {
  const starsShort = Math.max(0, ctx.starsToWin - a.stars) / ctx.starsToWin; // 目標の星に足りない割合
  const fewCards = 1 - ownCardRatio(a);
  return Math.max(0.2, 1 - a.personality.ai.caution * starsShort * fewCards * 1.5);
}

// 対戦意欲（0以上。大きいほど勝負を挑みやすい）
export function battleDrive(a: Agent, ctx: FloorContext): number {
  if (!a.canBattle()) return 0;
  const p = a.personality;
  const base = (0.25 + 0.6 * p.aggression) * a.traits.battle;
  return (
    base *
    curve(Rules.npcAi.battleByTime, ctx.progress) *
    phaseWeight(a, ctx.progress) *
    cardPressure(a, ctx) *
    urgency(a, ctx) *
    cautionFactor(a, ctx) *
    securedFactor(a, ctx) *
    ctx.pace
  );
}

// カードを譲りたい気持ち（0〜1）。次の条件がそろったときだけ0より大きくなる
//   ① 勝利条件を満たす星を持っている ② カードがまだ余っている ③ このままだと使い切れないと焦っている
// 強欲なNPCは星を稼ぎたいので、カードを手放したがらない
export function giftDesire(a: Agent, ctx: FloorContext): number {
  if (!hasEnoughStars(a, ctx) || a.hand.total() === 0) return 0;
  const timeLeft = 1 - ctx.progress;
  const anxiety = ownCardRatio(a) - timeLeft * 0.8; // 残り時間に対してカードが多いほど焦る
  if (anxiety <= 0) return 0;
  return Math.min(1, anxiety * 2.5) * (1 - greedOf(a));
}

// 譲る枚数と種類：気前のいい性格ほど多く譲る。
//   ふつうは自分が多く持っている種類から譲る（余り物）。
//   とても気前のいい性格（generosity 0.6以上）は、相手が少なそうな種類を選んで譲る（advice = true）
//   ※ 相手の手札は「自分が知っている情報」から見積もる（targetEstimate）
export function giftCards(a: Agent, targetEstimate?: Record<CardId, number>): { cards: Record<CardId, number>; advice: boolean } {
  const total = a.hand.total();
  const n = Math.max(1, Math.min(total, Math.round(total * a.personality.social.generosity * (0.5 + Math.random() * 0.5))));
  const gift: Record<CardId, number> = { rock: 0, scissors: 0, paper: 0 };
  const left = { ...a.hand.counts };
  const advice = !!targetEstimate && a.personality.social.generosity >= 0.6;
  const theirs = targetEstimate ? { ...targetEstimate } : null;
  for (let i = 0; i < n; i++) {
    const pick = advice && theirs
      ? PLAYER_HAND.filter((c) => left[c] > 0).reduce<CardId | null>((best, c) => (best === null || theirs[c] < theirs[best] ? c : best), null)
      : PLAYER_HAND.reduce((best, c) => (left[c] > left[best] ? c : best), PLAYER_HAND[0]);
    if (!pick || left[pick] <= 0) break;
    left[pick]--;
    gift[pick]++;
    if (theirs) theirs[pick]++;
  }
  return { cards: gift, advice };
}

// カードを譲られたときに受け取るか：星が足りない人や強欲な人は受け取りやすい（勝負の機会が増える）
export function acceptsGift(t: Agent, ctx: FloorContext, affinityToGiver: number): boolean {
  const want = !hasEnoughStars(t, ctx) || isGreedy(t) ? 0.8 : 0.3;
  return Math.random() < want * (affinityToGiver >= 0 ? 1 : 0.4);
}

// 情報収集（会話）の意欲
export function infoDrive(a: Agent, ctx: FloorContext, talkative = 1): number {
  const p = a.personality;
  return (0.15 + 0.6 * p.sociability) * curve(Rules.npcAi.infoByTime, ctx.progress) * a.traits.info * talkative;
}

// 1回考えたときに「勝負を挑む」「話しかける」を選ぶ確率（意欲が大きいほど1に近づく）
export function decisionChances(a: Agent, ctx: FloorContext, talkative = 1): { challenge: number; talk: number } {
  const challenge = 1 - Math.exp(-0.45 * battleDrive(a, ctx));
  const talk = (1 - challenge) * (1 - Math.exp(-0.5 * infoDrive(a, ctx, talkative)));
  return { challenge, talk };
}

// 勝負を挑まれたときに受ける確率（終盤・カードが減ったとき・焦っているときほど受けやすい）
export function acceptChance(t: Agent, ctx: FloorContext): number {
  const pressure =
    urgency(t, ctx) * curve(Rules.npcAi.battleByCards, ctx.cardRatio) * Math.max(1, curve(Rules.npcAi.battleByTime, ctx.progress));
  return 1 - (1 - t.acceptRate) / Math.max(1, pressure);
}

// 相手を探す範囲の倍率（焦っているほど遠くまで相手を探しに行く）
export function searchScale(a: Agent, ctx: FloorContext): number {
  return 1 + 0.5 * (cardPressure(a, ctx) - 1) + 0.5 * (urgency(a, ctx) - 1);
}

// 自分の星 − 相手の星（相手の星は「自分が知っている数」。知らなければ null）。差は maxDiff までに収める
function starDiff(a: Agent, t: Agent): number | null {
  const theirs = a.knowledge.starsOf(t.id);
  if (theirs === null) return null;
  const m = Rules.npcAi.bully.maxDiff;
  return Math.max(-m, Math.min(m, a.stars - theirs));
}

// 弱い者いじめの強さ（0 = しない）。いつも同じ強さではなく、状況で弱まる：
//   終盤ほど・焦っているほど（カードが余って時間がない）、選り好みしていられなくなる
function bullyStrength(a: Agent, ctx: FloorContext): number {
  const b = a.traits.bully;
  if (b <= 0) return 0;
  return (b * (1 - Rules.npcAi.bully.lateSoften * ctx.progress)) / urgency(a, ctx);
}

// 勝負相手としての魅力（大きいほど選ばれやすい）
//   近い / 手が読める（情報がある）/ 危険でない / 友好度が低い（敵対的）/ 負けた相手への仕返し / クールダウン中は避ける
//   弱い者いじめ傾向があれば、星の少ない相手を狙い、星の多い相手を避ける
export function targetAppeal(
  a: Agent,
  t: Agent,
  distance: number,
  perType: number,
  rel: Relations,
  now: number,
  ctx: FloorContext,
): number {
  let w = 1 / (1 + distance / 5);
  const est = a.knowledge.estimateRemaining(t.id, perType);
  const spread = Math.max(est.rock, est.scissors, est.paper) - Math.min(est.rock, est.scissors, est.paper);
  w *= 1 + spread * a.skill;
  const theirStars = a.knowledge.starsOf(t.id);
  if (theirStars !== null && theirStars > a.stars + 1) {
    w /= 1 + a.personality.ai.caution * (theirStars - a.stars - 1);
  }

  // 弱い者いじめ（星の差が分かる相手だけ。差が大きいほど強く効くが、100%ではない）
  const bully = bullyStrength(a, ctx);
  const diff = starDiff(a, t);
  if (bully > 0 && diff !== null) {
    const B = Rules.npcAi.bully;
    if (diff > 0) w *= 1 + bully * diff * B.preferWeaker;
    else if (diff < 0) w /= 1 + bully * -diff * B.avoidStronger;
  }

  // 情報が少ない相手は避ける（玄人のように needInfo が高い性格ほど強く避ける）
  const need = a.personality.ai.needInfo;
  if (need > 0) {
    const info = a.knowledge.infoLevel(t.id);
    w *= info >= need ? 1 + info : Math.pow(info / need, 2) * 0.3 + 0.02;
  }

  const mine = rel.get(a.id, t.id);
  // 友好度が低い相手ほど狙いやすく、高い相手は狙いにくい（必ずではない）
  if (mine.affinity < 0) w *= 1 + -mine.affinity / 40;
  else w *= 1 / (1 + mine.affinity / 60);
  // 負けた相手に怒って仕返しに行く（怒りっぽい性格ほど）
  if (mine.lossStreak > 0) w *= 1 + a.personality.social.revenge * Math.min(3, mine.lossStreak) * 1.5;
  // 相手に断られ続けてクールダウン中なら、ほぼ狙わない
  if (rel.get(t.id, a.id).cooldownUntil > now) w *= 0.1;
  return w;
}

// 話しかける相手としての魅力：最近、自分で情報を手に入れた相手（勝負した・見た）ほど話を聞きたい。
// 友好度が高い相手ほど話しかけやすく、低い相手は避けがち
export function talkAppeal(a: Agent, t: Agent, distance: number, now: number, rel: Relations): number {
  const fresh = now - t.knowledge.lastFirsthandAt < 60 ? 2 : 0;
  const aff = rel.affinity(a.id, t.id);
  const friendly = aff >= 0 ? 1 + aff / 50 : 1 / (1 + -aff / 30);
  return ((1 + fresh) * friendly) / (1 + distance / 4);
}

// 勝負を挑まれたときの反応
export type ChallengeResponse =
  | { accept: true; angry: boolean } // angry = 負けた相手に怒って受ける
  | { accept: false; reason: 'general' | 'justLost' | 'tooMany' | 'wary' | 'cooldown' | 'needInfo' | 'dislike' };

export function respondToChallenge(
  t: Agent,
  challenger: Agent,
  ctx: FloorContext,
  rel: Relations,
  now: number,
): ChallengeResponse {
  const s = t.personality.social;
  const r = rel.get(t.id, challenger.id);
  const R = Rules.relations;

  // 対戦クールダウン中：ほぼ断る
  if (r.cooldownUntil > now && Math.random() < 0.85) return { accept: false, reason: 'cooldown' };

  // 負けた直後：怒って受けるか、すねて断るか（性格しだい）
  if (now - r.lastLossAt < R.justLostSec) {
    if (Math.random() < s.revenge) return { accept: true, angry: true };
    if (Math.random() < s.sulk) return { accept: false, reason: 'justLost' };
  }

  // 短い間に何度も挑まれた：性格ごとの回数を超えると断りやすい
  if (rel.recentBattles(t.id, challenger.id, now) >= s.rematch && Math.random() < 0.8) {
    return { accept: false, reason: 'tooMany' };
  }

  // 続けて負けている相手は警戒する（慎重な性格ほど）
  if (r.lossStreak >= 2 && Math.random() < t.personality.ai.caution) return { accept: false, reason: 'wary' };

  // 相手の情報が少ないと断る（玄人など）。終盤になるほど、選り好みしなくなる
  const need = t.personality.ai.needInfo;
  if (need > 0) {
    const info = t.knowledge.infoLevel(challenger.id);
    if (info < need && Math.random() < Math.min(0.97, (1 - info / need) * 1.1) * (1 - ctx.progress * 0.5)) {
      return { accept: false, reason: 'needInfo' };
    }
  }

  // プレイヤーからの挑戦だけの判断
  if (challenger.isPlayer) {
    // 友好度が低すぎると断る。ただし友好度だけで100%は決めない（しきい値は性格ごと）
    //   強欲なNPC（玄人など）は星のためなら嫌いな相手とも戦う / 星が足りない終盤は選んでいられない
    //   弱い者いじめなら、プレイヤーの星が少ないと知っているときは受けやすい / 焦っているときも受けやすい
    if (r.affinity < s.hateRefuseAt) {
      const H = Rules.relations.dislike;
      let p = Math.min(H.max, H.base + (s.hateRefuseAt - r.affinity) / H.slope);
      p *= 1 - H.greedOverride * greedOf(t);
      p *= 1 - H.needStars * (Math.max(0, ctx.starsToWin - t.stars) / ctx.starsToWin) * ctx.progress;
      const d = starDiff(t, challenger);
      if (d !== null && d > 0) p *= 1 - H.bullyOverride * Math.min(1, (t.traits.bully * d) / 2);
      p /= urgency(t, ctx);
      if (Math.random() < p) return { accept: false, reason: 'dislike' };
    }
    // プレイヤーに自分の情報を握られていると思うと、慎重なNPCほど警戒する（終盤は気にしなくなる）
    if (t.knowledge.playerKnowsAbout(t.id, now, Rules.conversation.knownBySec) && Math.random() < t.personality.ai.caution * 0.35 * (1 - ctx.progress)) {
      return { accept: false, reason: 'wary' };
    }
  }

  // ふだんの判断：時間・カード残数・焦り＋友好度（敵対的な相手ほど受けやすい、親しい相手は少し受けにくい）
  let chance = acceptChance(t, ctx);
  // 勝利条件を満たしている：強欲なら受けやすく、そうでなければ星を守るため断りやすい
  if (hasEnoughStars(t, ctx) && ctx.progress > 0.2) {
    const S = Rules.npcAi.secured;
    const k = isGreedy(t) ? S.greedyAccept : S.safeAccept + (1 - S.safeAccept) * safeRelax(ctx);
    chance = Math.min(1, chance * k);
  }
  // 弱い者いじめ：星の少ない相手からの挑戦は受けやすく、星の多い相手からは断りやすい
  const diff = starDiff(t, challenger);
  const b = bullyStrength(t, ctx);
  if (b > 0 && diff !== null) {
    if (diff > 0) chance = 1 - (1 - chance) / (1 + b * diff * 0.5);
    else if (diff < 0) chance /= 1 + b * -diff * 0.4;
  }
  if (r.affinity < 0) chance = 1 - (1 - chance) / (1 + -r.affinity / 50);
  else chance *= 1 - r.affinity / 300;
  if (Math.random() < chance) return { accept: true, angry: r.lossStreak > 0 && Math.random() < s.revenge };
  return { accept: false, reason: 'general' };
}
