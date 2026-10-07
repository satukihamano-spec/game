import { PLAYER_HAND, type CardId } from '../card/Card';
import { chooseBestCard, judge, type BattleOutcome } from '../card/RockPaperScissors';
import { Rules } from '../data/rules';
import type { Agent } from './Agent';

// 1回の勝負の記録
export interface BattleRecord {
  a: Agent;
  b: Agent;
  cardA: CardId;
  cardB: CardId;
  outcome: BattleOutcome; // a から見た結果
  starMoved: number; // 勝者に移った星の数
  t: number;
  x: number; // 勝負した場所
  z: number;
}

// 特殊NPCのカード把握能力の確率（整数％）。通常NPCは 0
//   正体をプレイヤーに見破られた本人だけ、元の確率の 1/3（秀才15→5・戦略家33→11・玄人45→15）
export function peekPercent(self: Agent): number {
  const ability = Rules.npcTypes[self.rank].peek;
  if (!ability) return 0;
  return self.specialIdentityDetectedByPlayer
    ? Math.round(ability.percent / Rules.identityExposedPeekDivisor)
    : ability.percent;
}

// 特殊NPC（秀才・戦略家・玄人）の能力：勝負の直前に相手の手札を見抜く
//   カードの種類ごとに独立して判定し、当たった種類だけ相手の所持数が正確に分かる（3種類すべて分かるとは限らない）
//   当たらなかった種類は分からない（噂などからの見積もりで考える）
export function peek(self: Agent, opp: Agent): Record<CardId, number> | null {
  const percent = peekPercent(self);
  if (percent <= 0) return null;
  const known: Record<CardId, number> = { rock: 0, scissors: 0, paper: 0 };
  for (const card of PLAYER_HAND) {
    if (Math.random() * 100 < percent) known[card] = opp.hand.counts[card];
  }
  return known;
}

// self が「opp は各カードをどれくらいの確率で出すか」をどう見積もっているか
export function estimateDist(self: Agent, opp: Agent, known: Record<CardId, number> | null): Record<CardId, number> {
  const est = self.knowledge.estimateRemaining(opp.id, self.basePerType);
  let estTotal = est.rock + est.scissors + est.paper;
  if (estTotal === 0) {
    est.rock = est.scissors = est.paper = 1;
    estTotal = 3;
  }

  const dist: Record<CardId, number> = { rock: 0, scissors: 0, paper: 0 };
  if (known) {
    // 見抜いたカードは確実にある。残りは噂などからの見積もりで割り振る
    const knownTotal = known.rock + known.scissors + known.paper;
    const unknown = Math.max(0, opp.hand.total() - knownTotal);
    for (const c of PLAYER_HAND) dist[c] = known[c] + (unknown * est[c]) / estTotal;
  } else {
    for (const c of PLAYER_HAND) dist[c] = est[c];
  }

  const sum = dist.rock + dist.scissors + dist.paper || 1;
  for (const c of PLAYER_HAND) dist[c] /= sum;
  return dist;
}

// NPCが出すカードを決める（ボスなら見抜きも使う）
export function chooseCardFor(self: Agent, opp: Agent): CardId {
  const known = peek(self, opp);
  const dist = estimateDist(self, opp, known);
  const noise = 0.05 + (1 - self.skill) * 1.0;
  return chooseBestCard(self.hand.available(), dist, noise);
}

// 勝負の結果を反映する：カードを消費し、星を移し、お互いの手を覚える
export function resolveBattle(a: Agent, b: Agent, cardA: CardId, cardB: CardId, t: number): BattleRecord {
  a.hand.use(cardA);
  b.hand.use(cardB);
  const outcome = judge(cardA, cardB);

  let starMoved = 0;
  if (outcome === 'win') {
    starMoved = Math.min(Rules.winReward, b.stars);
    b.stars -= starMoved;
    a.stars += starMoved;
  } else if (outcome === 'lose') {
    starMoved = Math.min(Rules.winReward, a.stars);
    a.stars -= starMoved;
    b.stars += starMoved;
  }

  a.knowledge.observeUse(b.id, cardB, t);
  a.knowledge.observeStars(b.id, b.stars, t);
  b.knowledge.observeUse(a.id, cardA, t);
  b.knowledge.observeStars(a.id, a.stars, t);
  a.knowledge.observeBattle(b.id, a.id, t);
  b.knowledge.observeBattle(a.id, b.id, t);
  // 勝負の相手の手札の枚数（総数）は見て分かる
  a.knowledge.observeTotal(b.id, b.hand.total(), t);
  b.knowledge.observeTotal(a.id, a.hand.total(), t);

  return { a, b, cardA, cardB, outcome, starMoved, t, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}
