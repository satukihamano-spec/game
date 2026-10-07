import type { Rank } from './rules';
import type { PersonalityId } from './personalities';
import type { Gender, SpeechStyle } from './speech';

// NPCの候補。ゲーム開始時に、この中からモードの人数分がランダムに選ばれる。
// 一番人数が多いモードより多く用意しておく。
// NPCを増やすときは、この配列に1行追加するだけでよい。
//
// 必須：name（名前）/ gender（性別）/ personality（性格）/ speechStyle（言葉遣い）
// 省略できる項目（書かなければ性格やルールの標準値になる）：
//   stars        … 初期の星
//   cards        … 初期のカード枚数 { rock, scissors, paper }
//   lie          … 嘘をつく傾向（0 = ほとんど嘘をつかない、0.2 = たまに、0.5 = 半分くらい、0.8 = 嘘ばかり）
//   info         … 情報収集傾向（1 が普通）
//   battle       … 対戦傾向（1 が普通）
//   smallTalk    … 世間話傾向（0〜1）
//   greed        … 強欲さ（0〜1。0.3 = 少し強欲、0.6 = 強欲、0.9以上 = 非常に強欲）
//                  ※ この人物が「特殊NPC（秀才・戦略家）」に選ばれたときだけ使う。通常NPCは強欲さを持たない
//                    （書いていない特殊NPCは data/rules.ts の npcTypes.greed の確率で決まる。玄人は常に非常に強欲）
//   bully        … 弱い者いじめ傾向（0〜1。星の少ない相手を狙い、星の多い相手を避ける）
//   playerAffinity … プレイヤーへの最初の友好度（-100〜+100。書かなければ「中程度」= rules.ts の relations.playerInitial）
export interface NpcProfile {
  name: string;
  gender: Gender;
  personality: PersonalityId;
  speechStyle: SpeechStyle;
  stars?: number;
  cards?: { rock: number; scissors: number; paper: number };
  lie?: number;
  info?: number;
  battle?: number;
  smallTalk?: number;
  greed?: number;
  bully?: number;
  playerAffinity?: number;
  portrait?: string; // 顔アップ画像の顔ID（public/portraits/<顔ID>/）。書かなければ並び順で npc01〜
}

// ゲームに実際に登場するNPC（プロフィール＋種類）
//   rank: 'normal' = 通常 / 'saisho' = 秀才 / 'strategist' = 戦略家 / 'kurouto' = 玄人（data/rules.ts の npcTypes）
// 特殊NPCは毎回ランダムに選ばれ、見た目も話し方も普通のNPCと同じ（正体は分からない）。
export interface NpcData extends NpcProfile {
  rank: Rank;
  portraitId: string; // 顔アップ画像の顔ID（Roster.ts が決める）
}

export const NPC_PROFILES: NpcProfile[] = [
  { name: '鷹野', gender: 'male', personality: 'cautious', speechStyle: 'taciturn' },
  { name: '小春', gender: 'female', personality: 'friendly', speechStyle: 'polite', lie: 0.02 },
  { name: '黒崎', gender: 'male', personality: 'liar', speechStyle: 'overfamiliar', lie: 0.8, greed: 0.7 },
  { name: '佐伯', gender: 'male', personality: 'aggressive', speechStyle: 'rough' },
  { name: '宮下', gender: 'female', personality: 'timid', speechStyle: 'polite' },
  { name: '早瀬', gender: 'male', personality: 'broker', speechStyle: 'chatty', lie: 0.05 },
  { name: '葛西', gender: 'male', personality: 'calculating', speechStyle: 'mature' },
  { name: '柚木', gender: 'female', personality: 'whimsical', speechStyle: 'childish' },
  { name: '真壁', gender: 'male', personality: 'aggressive', speechStyle: 'blunt' },
  { name: '藤代', gender: 'female', personality: 'cautious', speechStyle: 'cold' },
  { name: '永井', gender: 'male', personality: 'friendly', speechStyle: 'casual' },
  { name: '桐生', gender: 'male', personality: 'liar', speechStyle: 'mature' },
  { name: '白石', gender: 'female', personality: 'timid', speechStyle: 'childish' },
  { name: '大門', gender: 'male', personality: 'aggressive', speechStyle: 'rough', bully: 0.9 },
  { name: '三浦', gender: 'male', personality: 'gambler', speechStyle: 'overfamiliar' },
  { name: '久我', gender: 'male', personality: 'calculating', speechStyle: 'cold', greed: 0.6 },
  { name: '若林', gender: 'female', personality: 'broker', speechStyle: 'chatty' },
  { name: '篠原', gender: 'female', personality: 'friendly', speechStyle: 'casual' },
  { name: '堀田', gender: 'male', personality: 'whimsical', speechStyle: 'casual' },
  { name: '相沢', gender: 'female', personality: 'cautious', speechStyle: 'polite' },
  { name: '芦田', gender: 'male', personality: 'timid', speechStyle: 'casual' },
  { name: '千秋', gender: 'female', personality: 'liar', speechStyle: 'overfamiliar', lie: 0.5 },
  { name: '野々村', gender: 'female', personality: 'friendly', speechStyle: 'chatty' },
  { name: '戸川', gender: 'female', personality: 'aggressive', speechStyle: 'rough', bully: 0.7 },
  { name: '柏木', gender: 'male', personality: 'calculating', speechStyle: 'polite' },
  { name: '遠野', gender: 'female', personality: 'gambler', speechStyle: 'casual' },
  { name: '南雲', gender: 'male', personality: 'cautious', speechStyle: 'blunt' },
  { name: '不破', gender: 'male', personality: 'friendly', speechStyle: 'polite' },
  { name: '霧島', gender: 'female', personality: 'cautious', speechStyle: 'cold' },
  { name: '一ノ瀬', gender: 'male', personality: 'calculating', speechStyle: 'mature' },
  { name: '東條', gender: 'male', personality: 'aggressive', speechStyle: 'blunt', bully: 0 },
  { name: '九条', gender: 'female', personality: 'calculating', speechStyle: 'mature' },
  { name: '瀬川', gender: 'male', personality: 'friendly', speechStyle: 'chatty' },
  { name: '杉浦', gender: 'male', personality: 'timid', speechStyle: 'taciturn' },
  { name: '日向', gender: 'female', personality: 'whimsical', speechStyle: 'childish' },
  { name: '黒田', gender: 'male', personality: 'liar', speechStyle: 'casual', bully: 0.6 },
  { name: '北見', gender: 'female', personality: 'cautious', speechStyle: 'taciturn' },
  { name: '七瀬', gender: 'female', personality: 'broker', speechStyle: 'polite' },
  { name: '有馬', gender: 'male', personality: 'gambler', speechStyle: 'rough' },
  { name: '氷室', gender: 'female', personality: 'calculating', speechStyle: 'cold' },
  { name: '赤城', gender: 'female', personality: 'gambler', speechStyle: 'overfamiliar' },
  { name: '秋山', gender: 'male', personality: 'friendly', speechStyle: 'casual' },
  { name: '雨宮', gender: 'female', personality: 'timid', speechStyle: 'polite' },
  { name: '榊', gender: 'male', personality: 'liar', speechStyle: 'cold' },
  { name: '時任', gender: 'male', personality: 'broker', speechStyle: 'mature' },
  { name: '御影', gender: 'other', personality: 'gambler', speechStyle: 'chatty' },
  { name: '鳴海', gender: 'other', personality: 'cautious', speechStyle: 'taciturn' },
  { name: '朝倉', gender: 'female', personality: 'friendly', speechStyle: 'casual' },
];
