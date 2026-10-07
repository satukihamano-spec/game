import { PLAYER_HAND, type CardId } from '../card/Card';

// 手持ちのカード（グー・チョキ・パーそれぞれの残り枚数）
export class Hand {
  readonly counts: Record<CardId, number>;

  // perType：全種類同じ枚数 / または種類ごとの枚数 { rock, scissors, paper }
  constructor(perType: number | Record<CardId, number>) {
    this.counts =
      typeof perType === 'number' ? { rock: perType, scissors: perType, paper: perType } : { ...perType };
  }

  has(card: CardId): boolean {
    return this.counts[card] > 0;
  }

  // 1枚使う（使ったカードは手持ちからなくなる）
  use(card: CardId): void {
    if (this.counts[card] <= 0) throw new Error(`${card} はもう持っていません`);
    this.counts[card]--;
  }

  total(): number {
    return this.counts.rock + this.counts.scissors + this.counts.paper;
  }

  // まだ持っている種類
  available(): CardId[] {
    return PLAYER_HAND.filter((c) => this.counts[c] > 0);
  }

  // すべて破棄する（星0で消滅したとき）
  clear(): void {
    this.counts.rock = 0;
    this.counts.scissors = 0;
    this.counts.paper = 0;
  }
}
