// 世間話の質問。プレイヤーとNPC、NPC同士の両方で使う。
// 答えには「タグ」が付いていて、相手の性格の好み（personalities.ts の likes / dislikes）によって
// 友好度が上がったり下がったりする。質問を増やすときは、この配列に1つ足すだけでよい。

export type TalkTag =
  | 'careful' // 慎重
  | 'bold' // 大胆
  | 'trust' // 人を信じる
  | 'doubt' // 疑う
  | 'honest' // 正直
  | 'trick' // 駆け引き・嘘
  | 'lucky' // 運まかせ
  | 'logic' // 理屈・読み
  | 'together' // 誰かと協力
  | 'alone'; // 一人で

export interface SmallTalkQuestion {
  polite: string; // 丁寧な言葉遣いのNPCが聞くとき
  casual: string; // それ以外のNPCが聞くとき
  options: { label: string; tag: TalkTag }[];
}

export const SMALL_TALK: SmallTalkQuestion[] = [
  {
    polite: '今日はどうなさるおつもりですか？',
    casual: '今日はどうする？',
    options: [
      { label: '慎重に行く', tag: 'careful' },
      { label: '積極的に行く', tag: 'bold' },
    ],
  },
  {
    polite: 'ここで一番大事なものは何だと思いますか？',
    casual: 'ここで一番大事なのって何だと思う？',
    options: [
      { label: '情報', tag: 'logic' },
      { label: '運', tag: 'lucky' },
      { label: '仲間', tag: 'together' },
    ],
  },
  {
    polite: 'あなたは、人を信じる方ですか？',
    casual: '人を信じる方？',
    options: [
      { label: '信じる', tag: 'trust' },
      { label: 'まず疑う', tag: 'doubt' },
    ],
  },
  {
    polite: '勝つためなら、嘘をつくこともありますか？',
    casual: '勝つためなら嘘もつく？',
    options: [
      { label: 'つかない', tag: 'honest' },
      { label: '必要ならつく', tag: 'trick' },
    ],
  },
  {
    polite: 'お一人で動く派ですか？それとも誰かと組む派ですか？',
    casual: '一人で動く派？誰かと組む派？',
    options: [
      { label: '一人で動く', tag: 'alone' },
      { label: '誰かと組む', tag: 'together' },
    ],
  },
  {
    polite: 'じゃんけんは、運だと思いますか？',
    casual: 'じゃんけんって運だと思う？',
    options: [
      { label: '運だ', tag: 'lucky' },
      { label: '読み合いだ', tag: 'logic' },
    ],
  },
  {
    polite: 'ここから出られたら、何をしたいですか？',
    casual: 'ここから出たら何したい？',
    options: [
      { label: 'ゆっくり休む', tag: 'careful' },
      { label: 'パーッと遊ぶ', tag: 'bold' },
      { label: '大切な人に会う', tag: 'together' },
    ],
  },
  {
    polite: '負けそうになったら、どうしますか？',
    casual: '負けそうになったらどうする？',
    options: [
      { label: '一度引く', tag: 'careful' },
      { label: '勝負に出る', tag: 'bold' },
      { label: '誰かを頼る', tag: 'together' },
    ],
  },
];
