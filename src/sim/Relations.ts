import { Rules } from '../data/rules';

// 人間関係のデータ。「A が B をどう思っているか」を1組ずつ別々に持つ。
//   NPC A → NPC B、NPC A → NPC C、NPC B → NPC C …… と、組み合わせごとに個別に管理する。
//   プレイヤーも1人の参加者として同じ仕組みで扱う（NPC → プレイヤーの友好度）。
//   NPC同士の最初の友好度はランダム（第一印象）。NPC → プレイヤーは「中程度」から始まる（seed で設定）。
// 必要になった組み合わせだけ作るので、人数が多くても軽い。

export interface Relation {
  affinity: number; // 友好度（-100〜+100）
  battleTimes: number[]; // この相手と勝負した時刻（最近のものだけ残す）
  lastLossAt: number; // この相手に最後に負けた時刻
  lossStreak: number; // この相手に続けて負けている回数
  refusalsInRow: number; // この相手からの勝負を続けて断った回数
  cooldownUntil: number; // 対戦クールダウン（この時刻までは、この相手と勝負しにくい）
}

export class Relations {
  private readonly map = new Map<string, Relation>();

  // from から見た to との関係（なければ作る）
  get(fromId: string, toId: string): Relation {
    const key = `${fromId}>${toId}`;
    let r = this.map.get(key);
    if (!r) {
      const s = Rules.relations.initialSpread;
      r = {
        affinity: Math.round((Math.random() * 2 - 1) * s),
        battleTimes: [],
        lastLossAt: -Infinity,
        lossStreak: 0,
        refusalsInRow: 0,
        cooldownUntil: -Infinity,
      };
      this.map.set(key, r);
    }
    return r;
  }

  // 最初の友好度を決めておく（NPC → プレイヤーは「中程度」から始めるため。ゲーム開始時に FloorSim が呼ぶ）
  seed(fromId: string, toId: string, affinity: number): void {
    this.get(fromId, toId).affinity = Math.max(-100, Math.min(100, affinity));
  }

  affinity(fromId: string, toId: string): number {
    return this.get(fromId, toId).affinity;
  }

  // 友好度を変える（-100〜+100 の範囲に収める）
  adjust(fromId: string, toId: string, delta: number): void {
    const r = this.get(fromId, toId);
    r.affinity = Math.max(-100, Math.min(100, r.affinity + delta));
  }

  // 勝負の結果を記録する。負けた側は勝った相手への友好度が下がる（連続で負けるほど大きく下がる）
  recordBattle(aId: string, bId: string, winnerId: string | null, now: number): void {
    const window = Rules.relations.rematchWindowSec;
    for (const [me, other] of [
      [aId, bId],
      [bId, aId],
    ]) {
      const r = this.get(me, other);
      r.battleTimes = r.battleTimes.filter((t) => now - t < window);
      r.battleTimes.push(now);
      r.refusalsInRow = 0;
      if (winnerId === other) {
        r.lossStreak++;
        r.lastLossAt = now;
        const table = Rules.relations.lossPenalty;
        this.adjust(me, other, table[Math.min(r.lossStreak, table.length) - 1]);
      } else if (winnerId === me) {
        r.lossStreak = 0;
      }
    }
  }

  // 最近（rematchWindowSec 以内に）この相手と何回勝負したか
  recentBattles(fromId: string, toId: string, now: number): number {
    const window = Rules.relations.rematchWindowSec;
    return this.get(fromId, toId).battleTimes.filter((t) => now - t < window).length;
  }

  // 勝負を断ったことを記録。続けて断ると対戦クールダウンになる
  recordRefusal(fromId: string, toId: string, now: number, cooldownSec: number): void {
    const r = this.get(fromId, toId);
    r.refusalsInRow++;
    if (r.refusalsInRow >= Rules.relations.refusalsForCooldown) {
      r.cooldownUntil = now + cooldownSec;
      r.refusalsInRow = 0;
    }
  }

  // フロアからいなくなった人の関係データを捨てる（メモリ節約）
  forget(id: string): void {
    for (const key of this.map.keys()) {
      const [a, b] = key.split('>');
      if (a === id || b === id) this.map.delete(key);
    }
  }
}

// 友好度から態度を決める（ただし毎回は表に出さない＝推測できるのは「たまに」）
export function mood(affinity: number): 'warm' | 'neutral' | 'cold' {
  const r = Rules.relations;
  if (Math.random() > r.moodShowChance) return 'neutral';
  if (affinity >= r.warmAt) return 'warm';
  if (affinity <= r.coldAt) return 'cold';
  return 'neutral';
}
