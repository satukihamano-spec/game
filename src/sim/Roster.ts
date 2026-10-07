import { normalNpcCount, type GameModeConfig } from '../data/modes';
import { NPC_PROFILES, type NpcData, type NpcProfile } from '../data/npcs';
import { NpcType, Rules, type NpcTypeId } from '../data/rules';

// モードの人数設定から、今回のゲームに登場するNPCを決める。
//   総参加人数 ＝ プレイヤー1人 ＋ 秀才 ＋ 戦略家 ＋ 玄人 ＋ 通常NPC（残り全部）
// 誰が特殊NPCになるかは毎回ランダム（並び順もシャッフルして、正体が分からないようにする）。
// 玄人は性格が「玄人（非常に慎重）」になり、強欲さは「非常に強欲」に固定（名前・性別・言葉遣いはプロフィールのまま）。
// 強欲さは一部の特殊NPCと玄人だけが持つ（通常NPCは持たない）→ greedFor()
export function buildRoster(mode: GameModeConfig): NpcData[] {
  const counts: [NpcTypeId, number][] = [
    [NpcType.KUROUTO, mode.special.kurouto],
    [NpcType.STRATEGIST, mode.special.strategist],
    [NpcType.SAISHO, mode.special.saisho],
    [NpcType.NORMAL, normalNpcCount(mode)],
  ];
  const total = counts.reduce((s, [, n]) => s + n, 0); // ＝ 総参加人数 − 1
  if (total > NPC_PROFILES.length) {
    throw new Error(`NPCの名前が足りません（必要 ${total}人 / 候補 ${NPC_PROFILES.length}人）。src/data/npcs.ts に追加してください`);
  }

  const profiles = shuffle([...NPC_PROFILES]).slice(0, total);
  const roster: NpcData[] = [];
  let i = 0;
  for (const [rank, n] of counts) {
    for (let k = 0; k < n; k++, i++) {
      const p = profiles[i];
      const portraitId = portraitIdOf(p);
      // 玄人：性格は「玄人」、カードはモード設定の kuroutoCardsPerType 枚ずつ（通常より1枚多い）
      const k = mode.kuroutoCardsPerType;
      const data: NpcData =
        rank === NpcType.KUROUTO
          ? { ...p, rank, portraitId, personality: 'kurouto', cards: { rock: k, scissors: k, paper: k } }
          : { ...p, rank, portraitId };
      data.greed = greedFor(rank, p.greed);
      roster.push(data);
    }
  }
  return shuffle(roster);
}

// 顔アップ画像の顔ID：プロフィールに portrait があればそれ、なければ data/npcs.ts の並び順で npc01〜npc48
// （並び順で決まるので、ゲームのたびに同じ人物には同じ顔が使われる）
export function portraitIdOf(p: NpcProfile): string {
  if (p.portrait) return p.portrait;
  const index = NPC_PROFILES.indexOf(p);
  return `npc${String(index + 1).padStart(2, '0')}`;
}

// NPCの種類から強欲さを決める（undefined = 強欲さを持たない）
//   通常NPC … 持たない（プロフィールに greed があっても使わない）
//   玄人 … 常に npcTypes.kurouto.greed（非常に強欲）
//   秀才・戦略家 … プロフィールに greed があればその値。なければ npcTypes の確率で持つ
function greedFor(rank: NpcTypeId, profileGreed: number | undefined): number | undefined {
  const g = Rules.npcTypes[rank].greed;
  if (!g) return undefined;
  if (rank === NpcType.KUROUTO) return g.max;
  if (profileGreed !== undefined) return profileGreed;
  return Math.random() < g.chance ? g.min + Math.random() * (g.max - g.min) : undefined;
}

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
