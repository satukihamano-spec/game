import { Rules } from '../data/rules';

// プレイヤーが「このNPCの嘘を何度見抜いたか」の警戒度（プレイヤー側の記録）。
// NPCの嘘傾向・友好度とは別のデータで、NPCのAIには使わない。画面ではNPCの名前の色で表す。
//   ・嘘を見抜くたびに +1（0〜5）。見抜いたときは「その時点の警戒度」から上がる
//   ・最後に変化してから 3分（Rules.suspicion.decaySec）ごとに 1段階ずつ下がる
// 毎フレーム数え直さなくていいように、「最後に変化した時刻」から今の段階を計算する。
export class PlayerSuspicion {
  private readonly map = new Map<string, { level: number; since: number }>();

  // 今の警戒度（0 = 通常 〜 5 = 最も強い）
  levelOf(npcId: string, now: number): number {
    const s = this.map.get(npcId);
    if (!s) return 0;
    const decayed = Math.floor((now - s.since) / Rules.suspicion.decaySec);
    return Math.max(0, s.level - decayed);
  }

  // 嘘を見抜いた：今の段階から +1（最大5）。下がるまでの3分もここから数え直す
  raise(npcId: string, now: number): number {
    const level = Math.min(Rules.suspicion.max, this.levelOf(npcId, now) + 1);
    this.map.set(npcId, { level, since: now });
    return level;
  }

  // 名前の色（段階ごとの色は Rules.suspicion.colors）
  colorOf(npcId: string, now: number): string {
    const c = Rules.suspicion.colors;
    return c[Math.min(c.length - 1, this.levelOf(npcId, now))];
  }

  // フロアからいなくなったNPCの記録を消す
  forget(npcId: string): void {
    this.map.delete(npcId);
  }
}
