import type { NpcTypeId } from './rules';

// プレイヤーとNPCの「場面ごとの会話」のデータ（対戦前・対戦後・カード譲渡・NPCからの質問・正体の確認）。
//
// しくみ（巨大な固定文章にしないための工夫）：
//   ① NPCの性格・友好度・状況から「特徴」を0〜1の数値で作る（src/sim/Conversation.ts の features）
//   ② 各場面には「気分（ムード）」が複数あり、ムードごとに「どの特徴で選ばれやすいか（w）」を書いておく
//   ③ 重みの合計でムードを1つ選び、そのムードの台詞の中から1つをランダムに選ぶ
//   ④ 台詞は「丁寧（polite）」「くだけた（casual）」の2種類。言葉遣い（speech.ts の register）で使い分ける
//      {I} = 一人称、{you} = 二人称、{O} = 他の人の名前
//   act … 台詞の後に付く「しぐさ」（任意）。性格や友好度を推測する手がかりになる
//
// 台詞を増やしたいときは、lines の配列に1行足すだけでよい。ムードを増やすときは1ブロック足す。

// 会話で使う特徴（すべて 0〜1）
export type TalkFeature =
  | 'base' // 常に1（どのNPCにも少しだけ出るムード用）
  | 'bold' // 強気（積極性・ギャンブル好き）
  | 'timid' // 臆病
  | 'caution' // 慎重
  | 'social' // 社交的
  | 'calm' // 冷静・計算高い（技量が高い）
  | 'bully' // 弱い者いじめ（相手の星が自分より少ないと知っているときだけ）
  | 'greed' // 強欲（持っているNPCのみ）
  | 'warm' // プレイヤーへの友好度が高い
  | 'cold' // プレイヤーへの友好度が低い
  | 'grudge' // プレイヤーに負けて根に持っている
  | 'honest' // 正直
  | 'sly' // 嘘つき
  | 'sore' // 負けず嫌い
  | 'desperate' // 星が足りないまま終盤
  | 'respect' // （対戦後）負けたのにプレイヤーへの友好度が上がった＝強者を認めた
  | 'hurt'; // （対戦後）友好度が大きく下がった

export interface Lines {
  polite: string[];
  casual: string[];
}

export interface Mood {
  w: Partial<Record<TalkFeature, number>>; // 特徴ごとの重み（合計が大きいほど選ばれやすい）
  lines: Lines;
  act?: string[]; // しぐさ（ナレーション）
}

// ───── 対戦前（勝負を受けた／挑んだ直後） ─────
export const PRE_BATTLE: Record<string, Mood> = {
  confident: {
    w: { bold: 2, base: 0.15 },
    lines: {
      polite: ['いいでしょう。お相手します。', '受けて立ちます。手加減はしませんよ。', '{I}に勝てると思っているんですね。どうぞ。'],
      casual: ['いいよ。相手になってあげる。', '受けて立つよ。手加減しないからね。', 'へえ、{I}とやる気？ いい度胸だね。'],
    },
  },
  timid: {
    w: { timid: 3 },
    lines: {
      polite: ['……本当に、{I}とやるんですか？', 'あ、あの……お手柔らかにお願いします。', 'うう……逃げられそうにないですね。'],
      casual: ['……本当に{I}とやるの？', 'え、えっと……お手柔らかにね。', 'うう……やるしかないか。'],
    },
    act: ['（落ち着かない様子で手札を何度も確かめている）'],
  },
  cautious: {
    w: { caution: 1.6 },
    lines: {
      polite: ['少し待ってください。今やる必要がありますか？……いいでしょう。', '……慎重にいかせてもらいます。', '{you}の手、少し考えさせてください。'],
      casual: ['少し待って。今やる必要ある？……まあ、いいか。', '……慎重にいかせてもらうよ。', 'ちょっと考えさせて。……よし。'],
    },
  },
  bully: {
    w: { bully: 3 },
    lines: {
      polite: ['{you}なら……まあ、いいでしょう。', 'ふふ、ちょうどいいお相手です。', '{you}が相手なら、気が楽ですね。'],
      casual: ['{you}なら……まあ、いいかな。', 'ちょうどいい相手だね。', '{you}なら楽にいけそうだ。'],
    },
    act: ['（値踏みするような目でこちらを見ている）'],
  },
  friendly: {
    w: { warm: 3 },
    lines: {
      polite: ['お互い、頑張りましょう。', '{you}となら、気持ちよく勝負できそうです。', '恨みっこなしですよ。'],
      casual: ['お互い頑張ろう。', '{you}とならいい勝負ができそう。', '恨みっこなしだよ。'],
    },
  },
  reluctant: {
    w: { cold: 3 },
    lines: {
      polite: ['……仕方ありませんね。', '……早く済ませましょう。', '気は進みませんが、お受けします。'],
      casual: ['……仕方ないな。', '……さっさと終わらせよう。', '気は乗らないけど、やるよ。'],
    },
    act: ['（目を合わせようとしない）'],
  },
  greedy: {
    w: { greed: 2 },
    lines: {
      polite: ['星が増えるなら、断る理由はありません。', 'いただけるものは、いただきます。'],
      casual: ['星が増えるなら大歓迎だよ。', 'もらえるものはもらっておくよ。'],
    },
  },
  revenge: {
    w: { grudge: 3 },
    lines: {
      polite: ['先ほどの借りは、返させてもらいます。', '今度は負けません。'],
      casual: ['さっきの借り、返させてもらうよ。', '今度は負けないから。'],
    },
  },
  calm: {
    w: { calm: 1.5, base: 0.1 },
    lines: {
      polite: ['……では、始めましょう。', '結果は、もう見えています。'],
      casual: ['……じゃ、始めようか。', 'どう来るか、だいたい分かってるよ。'],
    },
    act: ['（表情を変えずに、こちらの手元をじっと見ている）'],
  },
  desperate: {
    w: { desperate: 3 },
    lines: {
      polite: ['もう後がないんです。本気でいきます。', '……ここで負けるわけにはいきません。'],
      casual: ['もう後がないんだ。本気でいくよ。', '……ここで負けるわけにはいかない。'],
    },
  },
};

// ───── 対戦後：NPCが勝った ─────
export const POST_NPC_WIN: Record<string, Mood> = {
  joy: {
    w: { social: 1.2, warm: 1, base: 0.1 },
    lines: { polite: ['やった！ {I}の勝ちです！', 'ふふ、嬉しいです。'], casual: ['やった！ {I}の勝ち！', 'へへ、嬉しいな。'] },
  },
  relief: {
    w: { timid: 2, desperate: 2 },
    lines: { polite: ['……よかった。ほっとしました。', '心臓が止まるかと思いました……。'], casual: ['……よかった。ほっとした。', '心臓止まるかと思った……。'] },
    act: ['（大きく息をついた）'],
  },
  confident: {
    w: { bold: 1.8 },
    lines: { polite: ['当然の結果です。', '{I}の読み通りでしたね。'], casual: ['ま、当然だね。', '{I}の読み通り。'] },
  },
  taunt: {
    w: { cold: 2, bully: 2, sly: 1 },
    lines: { polite: ['その程度ですか？', 'もう一度やっても同じですよ。'], casual: ['その程度？', '何回やっても同じだよ。'] },
    act: ['（鼻で笑った）'],
  },
  sorry: {
    w: { warm: 1.5, honest: 1, timid: 0.5 },
    lines: { polite: ['ごめんなさい……勝っちゃいました。', '悪く思わないでくださいね。'], casual: ['ごめんね……勝っちゃった。', '悪く思わないでね。'] },
  },
  calm: {
    w: { calm: 1.8 },
    lines: { polite: ['……そうなると思っていました。', '予想通りです。'], casual: ['……そうなると思った。', '予想通りだね。'] },
    act: ['（勝ったのに、表情ひとつ変えない）'],
  },
};

// ───── 対戦後：NPCが負けた ─────
export const POST_NPC_LOSE: Record<string, Mood> = {
  frustrated: {
    w: { sore: 2, grudge: 1 },
    lines: { polite: ['くっ……次は絶対に勝ちます。', '悔しい……覚えておいてください。'], casual: ['くっ……次は絶対に勝つ。', '悔しい……覚えてろよ。'] },
    act: ['（ぎゅっと拳を握っている）'],
  },
  surprised: {
    w: { bold: 1.2, bully: 1.5, base: 0.1 },
    lines: { polite: ['えっ……そんな手で来るとは。', 'まさか、{I}が負けるなんて。'], casual: ['えっ……そう来る？', 'まさか{I}が負けるなんて。'] },
  },
  angry: {
    w: { cold: 2, hurt: 2.5 },
    lines: { polite: ['……運が良かっただけでしょう。', '調子に乗らないでください。'], casual: ['……運が良かっただけだろ。', '調子に乗るなよ。'] },
    act: ['（あからさまに不機嫌な顔をしている）'],
  },
  down: {
    w: { timid: 2.5 },
    lines: { polite: ['もう……今日はやめておこうかな。', 'はぁ……やっぱり{I}じゃだめですね。'], casual: ['もう……今日はやめておこうかな。', 'はぁ……やっぱり{I}じゃだめか。'] },
    act: ['（肩を落としている）'],
  },
  analyze: {
    w: { caution: 1.2, calm: 1.5 },
    lines: {
      polite: ['今の手札なら……そう来ると思ったのですが。', '読みが一つずれましたね。次は修正します。'],
      casual: ['今の手札なら……そう来ると思ったんだけどな。', '読みが一つずれたか。次は直す。'],
    },
  },
  respect: {
    w: { respect: 4, warm: 1.5 },
    lines: { polite: ['負けてしまいました。でも、{you}は強いですね。', '見事です。完敗です。'], casual: ['負けちゃったか。でも{you}、強いね。', '見事だね。完敗だよ。'] },
    act: ['（どこか楽しそうに笑っている）'],
  },
};

// ───── 対戦後：引き分け ─────
export const POST_DRAW: Record<string, Mood> = {
  plain: { w: { base: 1 }, lines: { polite: ['引き分けですね。', '……決着はまた今度ですね。'], casual: ['引き分けか。', '……決着はまた今度だね。'] } },
  relief: { w: { timid: 2 }, lines: { polite: ['……引き分けで、よかったです。'], casual: ['……引き分けでよかった。'] } },
  sore: { w: { sore: 1.5, cold: 1 }, lines: { polite: ['……次は決着をつけましょう。'], casual: ['……次は決着つけるから。'] } },
};

// ───── カード譲渡の理由（NPCがプレイヤーにカードを渡しに来たとき） ─────
//   surplus … カードが余っている / timeShort … 時間がない / advice … プレイヤーに足りなそうな種類を選んだ
//   friend … 仲がいいから / leaving … 全部渡してフロアを去るつもり
export type GiftReason = 'surplus' | 'timeShort' | 'advice' | 'friend' | 'leaving';
export const GIFT_REASON: Record<GiftReason, Lines> = {
  surplus: {
    polite: ['これ、余っているので持っていきませんか？', '{I}にはもう使い道がなくて。'],
    casual: ['これ、余ってるから持っていかない？', '{I}にはもう使い道がないんだ。'],
  },
  timeShort: {
    polite: ['時間もありませんし、使わないカードをお渡しします。', 'もう時間がありません。使ってください。'],
    casual: ['時間もないし、使わないカードを渡すよ。', 'もう時間ないからさ、使って。'],
  },
  advice: {
    polite: ['これを持っておいた方がいいですよ。', 'この種類、{you}の役に立つと思います。'],
    casual: ['これを持っておいた方がいい。', 'この種類、{you}の役に立つと思うよ。'],
  },
  friend: {
    polite: ['{you}には、お世話になりましたから。', '仲良くしてくれたお礼です。'],
    casual: ['{you}には世話になったからね。', '仲良くしてくれたお礼だよ。'],
  },
  leaving: {
    polite: ['{I}はもう十分です。あとは{you}にお任せします。'],
    casual: ['{I}はもう十分。あとは{you}に任せるよ。'],
  },
};

// ───── NPCからプレイヤーへの質問（情報収集） ─────
// プレイヤーの星の数については聞かない（既存の仕様）
export type ProbeTopic = 'talked' | 'withX' | 'fought' | 'heard' | 'saw';
export const PROBE_OPEN: Lines = {
  polite: ['あの、少しよろしいですか？', 'すみません、ちょっとお聞きしたいことが。'],
  casual: ['ねえ、ちょっといい？', 'あ、ちょうどよかった。'],
};
export const PROBE_ASK: Record<ProbeTopic, Lines> = {
  talked: { polite: ['最近、誰かとお話ししましたか？'], casual: ['最近、誰かと話した？'] },
  withX: { polite: ['さっき、{O}と一緒にいませんでしたか？'], casual: ['さっき{O}と一緒にいた？'] },
  fought: { polite: ['最近、誰かと勝負されました？'], casual: ['最近、対戦した？'] },
  heard: { polite: ['誰かから、何か面白い話を聞きました？'], casual: ['今、誰かから情報聞いた？'] },
  saw: { polite: ['このあたりで、誰か見かけませんでしたか？'], casual: ['この辺で誰か見なかった？'] },
};
// プレイヤーの答えへの反応
export const PROBE_REACT: Record<'thanks' | 'doubt' | 'lieOk' | 'refused' | 'favor', Lines> = {
  thanks: { polite: ['なるほど、ありがとうございます。', 'そうでしたか。参考になります。'], casual: ['なるほど、ありがと。', 'へえ、そうなんだ。'] },
  doubt: { polite: ['……本当ですか？ 何か隠していませんか。', '……そうですか。嘘はよくありませんよ。'], casual: ['……本当に？ 嘘っぽいな。', 'ふうん。……嘘はよくないよ。'] },
  lieOk: { polite: ['そうですか。'], casual: ['そっか。'] },
  refused: { polite: ['……教えてはいただけないんですね。', 'そうですか。残念です。'], casual: ['……教えてくれないんだ。', 'ケチだなあ。'] },
  favor: { polite: ['お礼に、ひとつ教えてあげます。'], casual: ['お礼にひとつ教えてあげる。'] },
};

// ───── 「あなた、○○ですよね？」（特殊NPCの正体の確認） ─────
type SpecialId = Exclude<NpcTypeId, 'normal'>;
export const IDENTITY_ADMIT: Record<SpecialId, Lines> = {
  saisho: { polite: ['……よく分かりましたね。ええ、そうです。'], casual: ['……よく分かったね。うん、そうだよ。'] },
  strategist: { polite: ['ふふ……見抜かれるとは思いませんでした。'], casual: ['へえ……見抜かれるとは思わなかった。'] },
  kurouto: { polite: ['……よく分かりましたね。'], casual: ['……よく分かったね。'] },
};
// 能力の「匂わせ」（詳しくは明かさない）
export const IDENTITY_HINT: Record<SpecialId, Lines> = {
  saisho: { polite: ['勝負の前は、相手のことをよく見るようにしているんです。'], casual: ['勝負の前は、相手のことをよく見るようにしてるんだ。'] },
  strategist: { polite: ['相手の手は、出す前からある程度読めます。'], casual: ['相手の手は、出す前からある程度読めるよ。'] },
  kurouto: { polite: ['相手のカードをよく見てから動く。それだけです。'], casual: ['相手のカードをよく見てから動く。それだけ。'] },
};
// 正体を見破られて、能力が使いにくくなったことの匂わせ（具体的な数値は言わない）
export const IDENTITY_WEAKENED: Lines = {
  polite: ['……もっとも、ここまで知られてしまっては、少しやりにくくなりましたが。', '見抜かれた以上、前のようにはいきませんね。'],
  casual: ['……まあ、そこまで分かってるなら、少しやりにくくなったな。', '見抜かれた以上、前みたいにはいかないか。'],
};
export const IDENTITY_CLOSE: Lines = {
  polite: ['このことは、内緒にしておいてくださいね。', '{you}とは、仲良くしておいた方がよさそうですね。'],
  casual: ['このことは内緒ね。', '{you}とは仲良くしておいた方がよさそうだ。'],
};
// 外れたときの反応（性格で変わる）
export const IDENTITY_WRONG: Record<string, Mood> = {
  angry: {
    w: { bold: 1.5, sore: 1, cold: 1.5 },
    lines: { polite: ['……失礼じゃありませんか？', '何を言っているんですか。不愉快です。'], casual: ['……失礼じゃない？', 'は？ 何それ。'] },
    act: ['（明らかに気分を害したようだ）'],
  },
  calm: { w: { calm: 1.5, caution: 1 }, lines: { polite: ['違いますよ。'], casual: ['違うよ。', '……違う。'] } },
  timid: { w: { timid: 2.5 }, lines: { polite: ['……どうして、そう思ったんですか？'], casual: ['……なんでそう思ったの？'] }, act: ['（警戒するように一歩下がった）'] },
  confused: { w: { base: 0.6 }, lines: { polite: ['……は？ 何のことですか？'], casual: ['……は？ 何それ。'] } },
};
export const IDENTITY_QUESTION: Record<SpecialId, string> = {
  saisho: 'あなた、秀才ですよね？',
  strategist: 'あなた、戦略家ですよね？',
  kurouto: 'あなた、玄人ですよね？',
};

// ───── 友好度が低すぎて対戦を断る ─────
export const REFUSE_DISLIKE: Lines = {
  polite: ['……{you}とは、やりたくありません。', '申し訳ありませんが、お断りします。', '今は{you}と戦う気はありません。'],
  casual: ['……{you}とはやりたくない。', '悪いけど、断るよ。', '今は{you}と戦う気はない。'],
};
