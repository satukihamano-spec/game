// 対戦演出（2人のアップ画面）で使う「表情」のデータ。
//
//   EXPRESSIONS … 表情ごとの顔の形（眉の角度・目の開き・口の形・汗や怒りマークなど）
//   MOOD_EXPRESSION … 会話のムード（data/conversation.ts の PRE_BATTLE などのキー）→ NPC の表情
//   PLAYER_EXPRESSION … 場面と勝敗 → プレイヤーの表情
//   PLAYER_REPLIES … プレイヤーの返事の候補（ボタンに出す。どれを選んでもゲームの結果は変わらない）
//
// 表情を増やすときは EXPRESSIONS に1つ足し、MOOD_EXPRESSION でムードと結びつける。

export type MouthShape = 'smile' | 'grin' | 'flat' | 'frown' | 'open' | 'wavy';
export type Motion = 'calm' | 'bounce' | 'shake' | 'tremble' | 'droop' | 'lean';

export interface ExpressionDef {
  brow: number; // 眉の角度（＋で眉間が下がる＝怒り、−で眉尻が下がる＝困り・悲しみ）
  browY: number; // 眉の高さ（＋で上がる＝驚き）
  eye: number; // 目の開き（1 = 普通、0.3 = 細目、1.4 = 見開く）
  mouth: MouthShape;
  mouthSize: number; // 口の大きさの倍率
  blush?: boolean; // ほおの赤み（照れ・喜び）
  sweat?: boolean; // 汗（焦り・気まずさ）
  anger?: boolean; // 怒りマーク
  tears?: boolean; // 涙
  sparkle?: boolean; // きらきら（大喜び）
  headTilt: number; // 首の傾き（＋でうつむく、−で上を向く＝見下す）
  motion: Motion; // 体の動き
}

export const EXPRESSIONS = {
  neutral: { brow: 0, browY: 0, eye: 1, mouth: 'flat', mouthSize: 1, headTilt: 0, motion: 'calm' },
  smile: { brow: -0.1, browY: 0.01, eye: 0.85, mouth: 'smile', mouthSize: 1, blush: true, headTilt: -0.05, motion: 'bounce' },
  grin: { brow: 0.25, browY: 0, eye: 0.6, mouth: 'grin', mouthSize: 1.2, headTilt: -0.15, motion: 'lean' },
  angry: { brow: 0.55, browY: -0.015, eye: 0.9, mouth: 'frown', mouthSize: 1.1, anger: true, headTilt: 0.05, motion: 'shake' },
  frustrated: { brow: 0.45, browY: -0.01, eye: 0.7, mouth: 'wavy', mouthSize: 1.1, tears: true, anger: true, headTilt: 0.12, motion: 'tremble' },
  sad: { brow: -0.45, browY: 0.01, eye: 0.55, mouth: 'frown', mouthSize: 0.8, tears: true, headTilt: 0.3, motion: 'droop' },
  surprised: { brow: -0.1, browY: 0.035, eye: 1.45, mouth: 'open', mouthSize: 1.1, sweat: true, headTilt: -0.08, motion: 'shake' },
  nervous: { brow: -0.35, browY: 0.015, eye: 1.1, mouth: 'wavy', mouthSize: 0.9, sweat: true, headTilt: 0.1, motion: 'tremble' },
  relieved: { brow: -0.3, browY: 0.01, eye: 0.5, mouth: 'smile', mouthSize: 0.9, sweat: true, headTilt: 0.05, motion: 'calm' },
  awkward: { brow: -0.3, browY: 0.01, eye: 0.8, mouth: 'smile', mouthSize: 0.8, sweat: true, blush: true, headTilt: 0.08, motion: 'calm' },
  cold: { brow: 0.15, browY: -0.01, eye: 0.45, mouth: 'flat', mouthSize: 0.8, headTilt: -0.05, motion: 'calm' },
  thinking: { brow: 0.2, browY: 0, eye: 0.7, mouth: 'flat', mouthSize: 0.7, headTilt: 0.12, motion: 'calm' },
  determined: { brow: 0.35, browY: -0.005, eye: 1, mouth: 'flat', mouthSize: 1, headTilt: 0, motion: 'lean' },
  joy: { brow: -0.15, browY: 0.02, eye: 0.4, mouth: 'open', mouthSize: 1.2, blush: true, sparkle: true, headTilt: -0.1, motion: 'bounce' },
} satisfies Record<string, ExpressionDef>;

export type ExpressionId = keyof typeof EXPRESSIONS;

// 会話のムード → NPC の表情（ムードは src/data/conversation.ts で性格・友好度・状況から選ばれる）
export const MOOD_EXPRESSION: Record<string, ExpressionId> = {
  // 対戦前（PRE_BATTLE）
  confident: 'grin',
  timid: 'nervous',
  cautious: 'thinking',
  bully: 'grin',
  friendly: 'smile',
  reluctant: 'cold',
  greedy: 'grin',
  revenge: 'angry',
  calm: 'cold',
  desperate: 'determined',
  // 対戦後・NPCの勝ち（POST_NPC_WIN）
  joy: 'joy',
  relief: 'relieved',
  taunt: 'grin',
  sorry: 'awkward',
  // 対戦後・NPCの負け（POST_NPC_LOSE）
  frustrated: 'frustrated',
  surprised: 'surprised',
  angry: 'angry',
  down: 'sad',
  analyze: 'thinking',
  respect: 'smile',
  // 引き分け（POST_DRAW）
  plain: 'neutral',
  sore: 'determined',
};

// プレイヤーの表情（場面と勝敗で決まる。outcome はプレイヤーから見た結果）
export const PLAYER_EXPRESSION = {
  pre: 'determined',
  win: 'smile',
  lose: 'sad',
  draw: 'neutral',
} satisfies Record<string, ExpressionId>;

// プレイヤーの返事（候補から2つをボタンに出す）。表情はセリフを言ったときのもの
export interface PlayerReply {
  text: string;
  expression: ExpressionId;
}

export const PLAYER_REPLIES: Record<'pre' | 'win' | 'lose' | 'draw', PlayerReply[]> = {
  pre: [
    { text: '勝負だ。', expression: 'determined' },
    { text: 'よろしく。', expression: 'smile' },
    { text: '手加減はしない。', expression: 'grin' },
    { text: 'お手柔らかに。', expression: 'awkward' },
  ],
  win: [
    { text: 'いい勝負だった。', expression: 'smile' },
    { text: '悪いね。', expression: 'grin' },
    { text: '……ふう、危なかった。', expression: 'relieved' },
  ],
  lose: [
    { text: '……次は負けない。', expression: 'frustrated' },
    { text: '強いな。', expression: 'awkward' },
    { text: 'くっ……。', expression: 'sad' },
  ],
  draw: [
    { text: '決着はまた今度。', expression: 'determined' },
    { text: '引き分けか。', expression: 'neutral' },
  ],
};

// NPC の背景の色（ムードの雰囲気：敵意 → 赤、友好 → 青緑、それ以外 → 紫）
export const MOOD_TINT: Record<'hostile' | 'friendly' | 'neutral', number> = {
  hostile: 0x7a1a22,
  friendly: 0x1a5a6a,
  neutral: 0x3a2a5a,
};

export function tintOf(expr: ExpressionId): keyof typeof MOOD_TINT {
  if (expr === 'angry' || expr === 'frustrated' || expr === 'grin' || expr === 'cold' || expr === 'determined') return 'hostile';
  if (expr === 'smile' || expr === 'joy' || expr === 'relieved' || expr === 'awkward') return 'friendly';
  return 'neutral';
}
