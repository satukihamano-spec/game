import type { ExpressionId } from './expressions';

// 顔アップ演出（対戦・情報を聞く）で使う「2Dの顔画像」の設定。
//
// ■ 画像の置き場所
//   public/portraits/<顔ID>/<表情>.png   （.webp / .jpg でもよい）
//     例）public/portraits/npc03/neutral.png  … npc03 の「通常」の顔
//         public/portraits/npc03/angry.png    … npc03 の「怒り」の顔
//         public/portraits/player/neutral.png … プレイヤーの顔
//   ・顔ID は NPC ごとに決まっている（data/npcs.ts の並び順で npc01〜npc48。portrait で個別に指定も可）
//   ・表情の画像がなければ、その NPC の neutral（通常）画像を使う
//   ・neutral もなければ、自動で描いた顔（ui/PortraitArt.ts）を表示する
//   ・画像は縦長（3:4 くらい）、顔が上の方にある「胸から上」の構図がおすすめ。口は閉じた形で統一する
//
// ■ 表情（8種類）
export const PORTRAIT_EXPRESSIONS = ['neutral', 'smile', 'wary', 'confused', 'angry', 'nervous', 'surprised', 'sad'] as const;
export type PortraitExpression = (typeof PORTRAIT_EXPRESSIONS)[number];

export const PORTRAIT_LABEL: Record<PortraitExpression, string> = {
  neutral: '通常',
  smile: '笑顔',
  wary: '警戒',
  confused: '困惑',
  angry: '怒り',
  nervous: '緊張',
  surprised: '驚き',
  sad: '悲しみ',
};

// 会話の表情（data/expressions.ts の14種類）→ 顔画像の表情（8種類）
export const PORTRAIT_OF: Record<ExpressionId, PortraitExpression> = {
  neutral: 'neutral',
  smile: 'smile',
  grin: 'smile', // 見下した笑み
  angry: 'angry',
  frustrated: 'angry',
  sad: 'sad',
  surprised: 'surprised',
  nervous: 'nervous',
  relieved: 'smile',
  awkward: 'nervous',
  cold: 'wary',
  thinking: 'confused',
  determined: 'wary',
  joy: 'smile',
};

// 画像のファイル形式（この順に探す）
const EXTENSIONS = ['png', 'webp', 'jpg'];
export const PLAYER_PORTRAIT_ID = 'player';

// 顔IDと表情から、探す画像のURLの候補を作る
export function portraitUrls(id: string, expr: PortraitExpression): string[] {
  const base = `${import.meta.env.BASE_URL}portraits/${encodeURIComponent(id)}/`;
  const names = expr === 'neutral' ? ['neutral'] : [expr, 'neutral'];
  const list: string[] = [];
  for (const n of names) for (const ext of EXTENSIONS) list.push(`${base}${n}.${ext}`);
  return list;
}
