import { CARDS, PLAYER_HAND, type CardId } from './Card';

export type BattleOutcome = 'win' | 'lose' | 'draw'; // 1人目から見た結果

// 勝敗判定
export function judge(a: CardId, b: CardId): BattleOutcome {
  if (CARDS[a].beats.includes(b)) return 'win';
  if (CARDS[b].beats.includes(a)) return 'lose';
  return 'draw';
}

// 相手が各カードを出しそうな確率（oppDist）をもとに、一番得なカードを選ぶ。
// noise が大きいほど判断がぶれる（読みが下手）。
export function chooseBestCard(available: CardId[], oppDist: Record<CardId, number>, noise: number): CardId {
  let best = available[0];
  let bestScore = -Infinity;
  for (const mine of available) {
    let score = 0;
    for (const theirs of PLAYER_HAND) {
      const o = judge(mine, theirs);
      score += oppDist[theirs] * (o === 'win' ? 1 : o === 'lose' ? -1 : 0);
    }
    score += noise * (Math.random() * 2 - 1);
    if (score > bestScore) {
      bestScore = score;
      best = mine;
    }
  }
  return best;
}
