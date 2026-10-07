import type { TalkTag } from './smalltalk';

// NPCの性格（行動の傾向）。セリフの言い回しは「言葉遣い」（data/speech.ts）で決まる。
// 数値はすべて 0〜1。大きいほどその傾向が強い。
// ※ 強欲さ（greed）は性格ではなくNPCの種類で決まる（data/rules.ts の npcTypes.greed）。通常NPCは強欲さを持たない。
// 性格を増やすときは、PERSONALITIES に1ブロック追加する。

export interface Personality {
  label: string;
  aggression: number; // 自分から勝負を挑む
  acceptRate: number; // 勝負を受ける
  sociability: number; // 他のNPCに話しかける
  honesty: number; // 情報を正しく伝える（低いと嘘や間違いが混ざる）
  gossip: number; // プレイヤーの噂を広める
  infoChance: number; // プレイヤーに情報を教えてくれる
  skill: number; // 情報をうまく使ってカードを選ぶ
  targetPlayer: number; // プレイヤーを勝負の相手に選ぶ

  // ゲームの流れの中での行動の重み（src/sim/NpcBrain.ts で使う）
  ai: {
    phase: [number, number, number]; // 序盤・中盤・終盤それぞれの対戦意欲の倍率
    infoDrive: number; // 情報収集（会話）の好み。1が普通、大きいほど中盤に情報を集める
    caution: number; // 0〜1。カードも星も少ないとき、どれだけ慎重になるか
    gamble: number; // 0〜1。カードがたくさん残っていても勝負したがる度合い
    needInfo: number; // 0〜1。相手の情報がこれより少ないと勝負を避ける（0 = 気にしない）
    bully: number; // 0〜1。「弱い者いじめ」傾向：星の少ない相手を狙い、星の多い相手を避ける（0 = しない）
  };

  // 人間関係（src/sim/Relations.ts・NpcBrain.ts で使う）
  social: {
    rematch: number; // 同じ相手と短い間に何回まで続けて勝負を受けるか
    sulk: number; // 0〜1。負けた直後に、その相手からの勝負を拒否する確率
    revenge: number; // 0〜1。負けた相手に怒って、逆に勝負を挑む（受ける）度合い
    cooldownSec: number; // 同じ相手からの勝負を続けて断ったあと、その相手と勝負しにくくなる時間（秒）
    trust: number; // 0〜1。人から教えられた情報を素直に信じる度合い
    generosity: number; // 気前の良さ 0〜1。カードを譲るときに何枚まで譲るか（0.6以上ならプレイヤーに足りなそうな種類を選ぶ）
    sore: number; // 負けず嫌い（プレイヤーに負けたときの友好度の下がり方の倍率。1 が普通、大きいほど大きく下がる）
    respect: number; // 0〜1。強者を認める（プレイヤーに負けても、逆に友好度が上がることがある）
    hateRefuseAt: number; // プレイヤーへの友好度がこれより低いと、対戦を断りやすくなる（-100〜0）
    likes: TalkTag[]; // 世間話で好きな答え（友好度が上がる）
    dislikes: TalkTag[]; // 世間話で嫌いな答え（友好度が下がる）
  };
}

export const PERSONALITIES = {
  cautious: {
    // 中盤まで情報収集を優先し、終盤に動く
    ai: { phase: [0.5, 0.7, 1.3], infoDrive: 1.4, caution: 0.8, gamble: 0, needInfo: 0.15, bully: 0 },
    social: { generosity: 0.4, sore: 0.9, respect: 0.3, hateRefuseAt: -30, rematch: 1, sulk: 0.6, revenge: 0.1, cooldownSec: 90, trust: 0.3, likes: ['careful', 'doubt', 'logic'], dislikes: ['bold', 'lucky'] },
    label: '慎重',
    aggression: 0.25, acceptRate: 0.45, sociability: 0.5, honesty: 0.85, gossip: 0.4,
    infoChance: 0.5, skill: 0.75, targetPlayer: 0.3,
  },
  friendly: {
    // 人と話すのが好き。勝負はほどほど
    ai: { phase: [0.7, 0.6, 1.1], infoDrive: 1.2, caution: 0.5, gamble: 0, needInfo: 0, bully: 0 },
    social: { generosity: 0.9, sore: 0.5, respect: 0.6, hateRefuseAt: -60, rematch: 2, sulk: 0.3, revenge: 0.05, cooldownSec: 40, trust: 0.8, likes: ['together', 'trust', 'honest'], dislikes: ['doubt', 'trick', 'alone'] },
    label: '友好的',
    aggression: 0.15, acceptRate: 0.6, sociability: 0.85, honesty: 0.95, gossip: 0.7,
    infoChance: 0.9, skill: 0.4, targetPlayer: 0.2,
  },
  liar: {
    // 噂を流しながら、そこそこ勝負する
    ai: { phase: [1.0, 0.8, 1.2], infoDrive: 1.3, caution: 0.3, gamble: 0.2, needInfo: 0, bully: 0.3 },
    social: { generosity: 0.3, sore: 1.0, respect: 0.1, hateRefuseAt: -40, rematch: 2, sulk: 0.3, revenge: 0.3, cooldownSec: 60, trust: 0.2, likes: ['trick', 'doubt'], dislikes: ['honest', 'trust'] },
    label: '不審',
    aggression: 0.45, acceptRate: 0.7, sociability: 0.75, honesty: 0.3, gossip: 0.9,
    infoChance: 0.85, skill: 0.6, targetPlayer: 0.5,
  },
  aggressive: {
    // 序盤から積極的に対戦
    ai: { phase: [1.6, 1.0, 1.4], infoDrive: 0.6, caution: 0.1, gamble: 0.3, needInfo: 0, bully: 0.5 },
    social: { generosity: 0.4, sore: 1.5, respect: 0.4, hateRefuseAt: -75, rematch: 4, sulk: 0.1, revenge: 0.8, cooldownSec: 30, trust: 0.4, likes: ['bold', 'alone'], dislikes: ['careful', 'together'] },
    label: '好戦的',
    aggression: 0.8, acceptRate: 0.9, sociability: 0.3, honesty: 0.7, gossip: 0.5,
    infoChance: 0.35, skill: 0.45, targetPlayer: 0.6,
  },
  timid: {
    // 終盤になって追い詰められてから対戦
    ai: { phase: [0.25, 0.35, 1.9], infoDrive: 1.0, caution: 0.9, gamble: 0, needInfo: 0.1, bully: 0 },
    social: { generosity: 0.7, sore: 0.7, respect: 0.2, hateRefuseAt: -20, rematch: 1, sulk: 0.8, revenge: 0, cooldownSec: 120, trust: 0.6, likes: ['careful', 'together'], dislikes: ['bold', 'trick'] },
    label: '臆病',
    aggression: 0.05, acceptRate: 0.25, sociability: 0.6, honesty: 0.9, gossip: 0.6,
    infoChance: 0.7, skill: 0.3, targetPlayer: 0.1,
  },
  broker: {
    // 中盤の情報収集を最優先
    ai: { phase: [0.6, 0.5, 1.2], infoDrive: 1.8, caution: 0.5, gamble: 0, needInfo: 0.1, bully: 0 },
    social: { generosity: 0.5, sore: 0.8, respect: 0.3, hateRefuseAt: -45, rematch: 1, sulk: 0.4, revenge: 0.1, cooldownSec: 60, trust: 0.5, likes: ['logic', 'together'], dislikes: ['lucky'] },
    label: '情報屋',
    aggression: 0.2, acceptRate: 0.5, sociability: 0.95, honesty: 0.75, gossip: 1.0,
    infoChance: 0.95, skill: 0.6, targetPlayer: 0.3,
  },
  calculating: {
    // 情報を集めつつ、計算して勝負する
    ai: { phase: [0.8, 0.8, 1.3], infoDrive: 1.2, caution: 0.6, gamble: 0, needInfo: 0.2, bully: 0.3 },
    social: { generosity: 0.3, sore: 1.0, respect: 0.5, hateRefuseAt: -50, rematch: 2, sulk: 0.5, revenge: 0.2, cooldownSec: 75, trust: 0.3, likes: ['logic', 'alone'], dislikes: ['lucky', 'trust'] },
    label: '計算高い',
    aggression: 0.4, acceptRate: 0.5, sociability: 0.45, honesty: 0.55, gossip: 0.5,
    infoChance: 0.4, skill: 0.9, targetPlayer: 0.45,
  },
  whimsical: {
    // 時間に関係なく気分で動く
    ai: { phase: [1.0, 1.0, 1.0], infoDrive: 1.0, caution: 0.2, gamble: 0.4, needInfo: 0, bully: 0.1 },
    social: { generosity: 0.6, sore: 0.8, respect: 0.3, hateRefuseAt: -35, rematch: 3, sulk: 0.2, revenge: 0.3, cooldownSec: 30, trust: 0.6, likes: ['lucky', 'bold'], dislikes: ['logic'] },
    label: '気まぐれ',
    aggression: 0.5, acceptRate: 0.65, sociability: 0.6, honesty: 0.5, gossip: 0.6,
    infoChance: 0.6, skill: 0.2, targetPlayer: 0.35,
  },
  gambler: {
    // カードがたくさん残っていても、時間に関係なく勝負したがる
    ai: { phase: [1.4, 1.3, 1.5], infoDrive: 0.5, caution: 0, gamble: 1, needInfo: 0, bully: 0.2 },
    social: { generosity: 0.5, sore: 1.2, respect: 0.4, hateRefuseAt: -85, rematch: 5, sulk: 0, revenge: 0.6, cooldownSec: 20, trust: 0.5, likes: ['lucky', 'bold'], dislikes: ['careful'] },
    label: 'ギャンブラー',
    aggression: 0.7, acceptRate: 0.9, sociability: 0.4, honesty: 0.6, gossip: 0.4,
    infoChance: 0.5, skill: 0.35, targetPlayer: 0.55,
  },
  kurouto: {
    // 玄人：強欲で非常に慎重。序盤は情報収集を優先し、十分な情報が集まってから中盤以降に勝負する。
    // 情報をほとんど話さない（強欲さは npcTypes.kurouto で「非常に強欲」に固定）
    ai: { phase: [0.08, 0.9, 2.4], infoDrive: 1.8, caution: 0.95, gamble: 0, needInfo: 0.45, bully: 0.2 },
    social: { generosity: 0.1, sore: 1.0, respect: 0.6, hateRefuseAt: -50, rematch: 2, sulk: 0.3, revenge: 0.2, cooldownSec: 60, trust: 0.1, likes: ['logic', 'doubt', 'alone'], dislikes: ['lucky', 'trust', 'together'] },
    label: '玄人',
    aggression: 0.5, acceptRate: 0.45, sociability: 0.6, honesty: 0.7, gossip: 0.1,
    infoChance: 0.1, skill: 0.97, targetPlayer: 0.5,
  },
} satisfies Record<string, Personality>;

export type PersonalityId = keyof typeof PERSONALITIES;
