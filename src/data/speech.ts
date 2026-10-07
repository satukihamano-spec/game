// NPCの「言葉遣い」。同じ内容でも、言葉遣いによって言い回しが変わる。
// セリフの中の {I} は一人称、{you} は二人称、{S} {O} は人の名前、{W} はいつ、{C} はカード、{V} は数に置き換わる。
// 言葉遣いを増やすときは、SPEECH に1ブロック追加する。

export type Gender = 'male' | 'female' | 'other';

export type SpeechStyle =
  | 'polite' // 丁寧な敬語
  | 'casual' // 普通
  | 'blunt' // ぶっきらぼう
  | 'rough' // 乱暴
  | 'childish' // 子供っぽい
  | 'mature' // 大人びている
  | 'overfamiliar' // 馴れ馴れしい
  | 'cold' // 冷たい
  | 'chatty' // おしゃべり
  | 'taciturn'; // 無口

export type LineKey =
  | 'greetWarm' | 'greetNeutral' | 'greetCold' // 初めて話しかけられたとき（友好度：高い／普通／低い）
  | 'againWarm' | 'againNeutral' | 'againCold' // 2回目以降
  | 'noInfo' | 'noInfoCold' // 情報を教えないとき（普通／友好度が低くて隠すとき）
  | 'accept' | 'acceptAngry' // 勝負を受ける（普通／負けた相手に怒って）
  | 'refuse' | 'refuseJustLost' | 'refuseTooMany' | 'refuseWary' | 'refuseCooldown' // 勝負を断る理由ごと
  | 'challenge' | 'challengeRevenge' // 勝負を挑む（普通／仕返し）
  | 'win' | 'lose' | 'draw' // 勝負の結果（NPCから見て）
  | 'stGood' | 'stNeutral' | 'stBad' // 世間話の答えへの反応
  | 'tellHappy' | 'tellLittle' | 'tellNone' | 'tellDoubt' | 'tellWary' // 情報を教えてもらったときの反応
  | 'busy' | 'noCards' // さっき話したばかり／もう賭けるものがない
  | 'refuseNeedInfo' // 相手の情報が少ないので勝負しない（玄人など）
  | 'giftOffer' | 'giftThanks' | 'giftDeclined'; // カードを譲る（{V} は枚数）

export type RumorKey = 'used1' | 'used2' | 'usedAll' | 'keep' | 'stars' | 'fought' | 'relGood' | 'relBad' | 'total';

export interface SpeechStyleDef {
  label: string;
  register: 'polite' | 'casual'; // 世間話の質問文をどちらで聞くか
  talkative: number; // おしゃべりな度合い（NPC同士の会話の頻度に少し影響）
  you: string; // 二人称
  I: Record<Gender, string>; // 一人称（性別で変わる）
  honorific: (gender: Gender) => string; // 他人の名前につける呼び方（「さん」など）
  lines: Record<LineKey, string[]>;
  rumor: Record<RumorKey, string>;
}

const none = (): string => '';

export const SPEECH: Record<SpeechStyle, SpeechStyleDef> = {
  polite: {
    label: '丁寧な敬語', register: 'polite', talkative: 1, you: 'あなた',
    I: { male: '私', female: '私', other: '私' }, honorific: () => 'さん',
    lines: {
      greetWarm: ['あ、こんにちは。お会いできて嬉しいです。'], greetNeutral: ['こんにちは。何かご用でしょうか。'], greetCold: ['……何かご用ですか。手短にお願いします。'],
      againWarm: ['またお話しできますね。'], againNeutral: ['また来られたんですね。'], againCold: ['……またですか。'],
      noInfo: ['申し訳ありません、今お話しできることはありません。'], noInfoCold: ['……お教えできることはありません。'],
      accept: ['わかりました。お受けします。'], acceptAngry: ['……先ほどの借りは、返させていただきます。'],
      refuse: ['すみません、今はお受けできません。'], refuseJustLost: ['負けたばかりですので、少し時間をください。'], refuseTooMany: ['続けて何度もは……ご遠慮します。'], refuseWary: ['{you}との勝負は、やめておきます。'], refuseCooldown: ['しばらくはお相手できません。'],
      challenge: ['あの、{I}と勝負していただけますか？'], challengeRevenge: ['先ほどの雪辱を果たさせてください。'],
      win: ['{I}の勝ちですね。'], lose: ['……参りました。'], draw: ['引き分けですね。'],
      stGood: ['まあ、気が合いますね。'], stNeutral: ['そうですか。'], stBad: ['……そういう考え方もあるんですね。'],
      tellHappy: ['本当ですか！ありがとうございます、助かります。'], tellLittle: ['なるほど、参考にします。'], tellNone: ['それなら、もう存じています。'], tellDoubt: ['……本当でしょうか。'], tellWary: ['……なぜ{I}にそれを？何か狙いがあるんですか。'],
      busy: ['先ほどお話ししたばかりですよ。'], noCards: ['もう賭けるものがありません。'],
      refuseNeedInfo: ['あなたのことをまだよく存じませんので、今はお受けできません。'], giftOffer: ['あの……{I}のカードを{V}枚、受け取っていただけませんか？'], giftThanks: ['ありがとうございます、助かりました。'], giftDeclined: ['そうですか……残念です。'],
    },
    rumor: {
      used1: '{S}は{W}{C}を使っていましたよ。', used2: '{S}は{W}までに{C}を2枚使っていたようです。',
      usedAll: '{S}はもう{C}をお持ちでないようです。（{W}聞いた話です）', keep: '{S}は{C}をまだ残しているそうです。（{W}聞いた話です）',
      stars: '{S}は{W}の時点で星を{V}個お持ちでした。', fought: '{S}は{W}{O}と勝負していましたよ。',
      relGood: '{S}は{O}と親しいようです。', relBad: '{S}は{O}と仲が悪いみたいです。',
      total: '{S}は、カードを全部で{V}枚お持ちのようです。',
    },
  },
  casual: {
    label: '普通', register: 'casual', talkative: 1, you: '君',
    I: { male: '僕', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['やあ、また会えてうれしいよ。', 'あ、君か。ちょうど話したかったんだ。'], greetNeutral: ['やあ。何か用？'], greetCold: ['……何か用？'],
      againWarm: ['お、また来たね。'], againNeutral: ['また来たんだ。'], againCold: ['またか……。'],
      noInfo: ['ごめん、今は特に何も知らないんだ。'], noInfoCold: ['別に話すことはないよ。'],
      accept: ['いいよ、やろう。'], acceptAngry: ['いいよ。さっきの借りを返す。'],
      refuse: ['ごめん、今はやめとく。'], refuseJustLost: ['負けたばっかりだし、ちょっと休ませて。'], refuseTooMany: ['さすがに続けてはちょっと。'], refuseWary: ['{you}とはやめておくよ。'], refuseCooldown: ['しばらくは{you}とはやらないよ。'],
      challenge: ['ねえ、勝負しない？'], challengeRevenge: ['さっきのリベンジ、させてよ。'],
      win: ['よし、勝った。'], lose: ['あー、負けた。'], draw: ['あいこか。'],
      stGood: ['わかる！気が合うね。'], stNeutral: ['ふーん、そっか。'], stBad: ['うーん、それはどうかな。'],
      tellHappy: ['ほんと？ありがとう、助かるよ！'], tellLittle: ['へえ、覚えとく。'], tellNone: ['それ、もう知ってるよ。'], tellDoubt: ['……それ、本当？'], tellWary: ['なんでそれを{I}に？……何か企んでる？'],
      busy: ['さっき話したばかりだよ。'], noCards: ['もう賭けるものがないんだ。'],
      refuseNeedInfo: ['君のこと、まだよく知らないからやめとく。'], giftOffer: ['ねえ、{I}のカード{V}枚もらってくれない？'], giftThanks: ['ありがとう、助かったよ。'], giftDeclined: ['そっか、残念。'],
    },
    rumor: {
      used1: '{S}、{W}{C}を使ってたよ。', used2: '{S}は{W}までに{C}を2枚使ってたよ。',
      usedAll: '{S}はもう{C}を持ってないみたい。（{W}聞いた話）', keep: '{S}は{C}をまだ残してるらしいよ。（{W}聞いた話）',
      stars: '{S}は{W}見たとき星を{V}個持ってたよ。', fought: '{S}は{W}{O}と勝負してたよ。',
      relGood: '{S}って{O}と仲いいみたい。', relBad: '{S}と{O}、仲悪いみたいだよ。',
      total: '{S}はカードを全部で{V}枚持ってるらしいよ。',
    },
  },
  blunt: {
    label: 'ぶっきらぼう', register: 'casual', talkative: 0.7, you: 'あんた',
    I: { male: '俺', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['……あんたか。まあ、悪くない。'], greetNeutral: ['……何だ。'], greetCold: ['用がないなら行け。'],
      againWarm: ['……また来たのか。まあいい。'], againNeutral: ['またか。'], againCold: ['しつこいな。'],
      noInfo: ['知らん。'], noInfoCold: ['教える気はない。'],
      accept: ['……いいだろう。'], acceptAngry: ['ちょうどいい。借りを返す。'],
      refuse: ['今はやらん。'], refuseJustLost: ['負けたばかりだ。後にしろ。'], refuseTooMany: ['続けてはやらん。'], refuseWary: ['あんたとはやらん。'], refuseCooldown: ['しばらく顔を見せるな。'],
      challenge: ['……勝負しろ。'], challengeRevenge: ['さっきの続きだ。'],
      win: ['……当然だ。'], lose: ['……ちっ。'], draw: ['……引き分けか。'],
      stGood: ['……悪くない答えだ。'], stNeutral: ['……そうか。'], stBad: ['……くだらん。'],
      tellHappy: ['……助かる。礼は言っておく。'], tellLittle: ['……覚えておく。'], tellNone: ['知ってる。'], tellDoubt: ['……本当か？'], tellWary: ['……何が目的だ。'],
      busy: ['さっき話しただろう。'], noCards: ['賭けるものがない。'],
      refuseNeedInfo: ['あんたのことはまだ分からん。やらん。'], giftOffer: ['……カードを{V}枚やる。受け取れ。'], giftThanks: ['……助かった。'], giftDeclined: ['……そうか。'],
    },
    rumor: {
      used1: '{S}は{W}{C}を使ってた。', used2: '{S}は{W}までに{C}を2枚使ってた。',
      usedAll: '{S}はもう{C}を持ってない。{W}聞いた話だ。', keep: '{S}は{C}を残してるらしい。',
      stars: '{S}は{W}、星{V}個だった。', fought: '{S}は{W}{O}とやり合ってた。',
      relGood: '{S}と{O}はつるんでる。', relBad: '{S}と{O}は険悪だ。',
      total: '{S}の手札は全部で{V}枚だ。',
    },
  },
  rough: {
    label: '乱暴', register: 'casual', talkative: 0.8, you: 'テメェ',
    I: { male: '俺', female: 'あたし', other: 'オレ' }, honorific: none,
    lines: {
      greetWarm: ['おう、テメェか。まあ嫌いじゃねえぜ。'], greetNeutral: ['あ？なんだテメェ。'], greetCold: ['ジロジロ見てんじゃねえよ。失せろ。'],
      againWarm: ['おう、また来たか。'], againNeutral: ['またテメェか。'], againCold: ['しつけえんだよ。'],
      noInfo: ['知らねえよ。'], noInfoCold: ['テメェに教えることなんかねえ。'],
      accept: ['上等だ！'], acceptAngry: ['ちょうどいい、さっきの礼をしてやるよ！'],
      refuse: ['今はそんな気分じゃねえ。'], refuseJustLost: ['負けたばっかなんだよ、後にしろ！'], refuseTooMany: ['何度もしつけえんだよ。'], refuseWary: ['テメェとはやらねえ。'], refuseCooldown: ['しばらくツラ見せんな。'],
      challenge: ['おい！{I}と勝負しろ！'], challengeRevenge: ['さっきの借り、返させてもらうぜ！'],
      win: ['ハッ、ザマァねえな！'], lose: ['クソがッ！'], draw: ['チッ、もう一回だ！'],
      stGood: ['へっ、わかってんじゃねえか。'], stNeutral: ['ふん。'], stBad: ['はぁ？ナメてんのか。'],
      tellHappy: ['マジか！やるじゃねえか。'], tellLittle: ['ふん、覚えとくぜ。'], tellNone: ['とっくに知ってんだよ。'], tellDoubt: ['あ？ホントかよ。'], tellWary: ['テメェ、何企んでやがる。'],
      busy: ['さっき話したろうが。'], noCards: ['賭けるもんがねえんだよ。'],
      refuseNeedInfo: ['テメェの手の内も分からねえのにやるかよ。'], giftOffer: ['おい、{I}のカード{V}枚、持ってけよ。'], giftThanks: ['へっ、恩に着るぜ。'], giftDeclined: ['チッ、いらねえのかよ。'],
    },
    rumor: {
      used1: '{S}のヤツ、{W}{C}出してたぜ。', used2: '{S}は{W}までに{C}を2枚使ってやがった。',
      usedAll: '{S}はもう{C}持ってねえってよ。', keep: '{S}は{C}をまだ溜め込んでるらしいぜ。',
      stars: '{S}は{W}の時点で星{V}個だったぜ。', fought: '{S}のヤツ、{W}{O}とやり合ってたぜ。',
      relGood: '{S}と{O}はツルんでやがる。', relBad: '{S}と{O}はバチバチだぜ。',
      total: '{S}のヤツ、手札は全部で{V}枚だってよ。',
    },
  },
  childish: {
    label: '子供っぽい', register: 'casual', talkative: 1.2, you: 'キミ',
    I: { male: 'ぼく', female: 'わたし', other: 'わたし' },
    honorific: (g) => (g === 'male' ? 'くん' : g === 'female' ? 'ちゃん' : 'さん'),
    lines: {
      greetWarm: ['あっ、キミだ！会いたかったよ〜！'], greetNeutral: ['ねえねえ、なあに？'], greetCold: ['……なに？今いそがしいの。'],
      againWarm: ['わーい、また来てくれた！'], againNeutral: ['また来たの？'], againCold: ['えー、また〜？'],
      noInfo: ['うーん、わかんない！'], noInfoCold: ['教えてあげなーい。'],
      accept: ['いいよー、やろやろ！'], acceptAngry: ['さっきのお返し、するもん！'],
      refuse: ['いまはやだー。'], refuseJustLost: ['負けたばっかりだもん、やだ！'], refuseTooMany: ['もうやだー、さっきやったじゃん！'], refuseWary: ['キミとはやらないもん。'], refuseCooldown: ['しばらくキミとは遊ばない！'],
      challenge: ['ねえ、じゃんけんしよ！'], challengeRevenge: ['さっきのリベンジするー！'],
      win: ['やったー！'], lose: ['うえーん、負けちゃった。'], draw: ['あはは、おんなじ！'],
      stGood: ['わーい、いっしょだね！'], stNeutral: ['ふーん。'], stBad: ['えー、なんかやだ。'],
      tellHappy: ['ほんと！？ありがとう！'], tellLittle: ['へー、そうなんだ。'], tellNone: ['それ知ってるよー。'], tellDoubt: ['ほんとにー？'], tellWary: ['……なんでそんなこと教えてくれるの？あやしい。'],
      busy: ['さっきお話ししたじゃん。'], noCards: ['もうカードないもん。'],
      refuseNeedInfo: ['キミのこと、まだよくわかんないからやだ。'], giftOffer: ['ねえねえ、{I}のカード{V}枚あげる！'], giftThanks: ['ありがとー！'], giftDeclined: ['えー、いらないの？'],
    },
    rumor: {
      used1: '{S}ね、{W}{C}出してたよ！', used2: '{S}、{W}までに{C}を2回も出してたよ！',
      usedAll: '{S}、もう{C}持ってないんだって！', keep: '{S}ね、{C}まだいっぱい持ってるんだって！',
      stars: '{S}、{W}は星{V}個だったよ！', fought: '{S}、{W}{O}と勝負してたよ！',
      relGood: '{S}と{O}、なかよしなんだって！', relBad: '{S}と{O}、けんかしてるんだって！',
      total: '{S}ね、カード{V}枚持ってるんだって！',
    },
  },
  mature: {
    label: '大人びている', register: 'polite', talkative: 0.9, you: 'あなた',
    I: { male: '私', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['ああ、あなたか。会えてよかった。'], greetNeutral: ['何か用かな。'], greetCold: ['……今は話す気分じゃない。'],
      againWarm: ['また来てくれたのか。'], againNeutral: ['また来たのか。'], againCold: ['……何度来ても同じだ。'],
      noInfo: ['今は話せることがないな。'], noInfoCold: ['それは教えられない。'],
      accept: ['いいだろう、受けて立とう。'], acceptAngry: ['ちょうどいい。さっきの借りを返そう。'],
      refuse: ['今はやめておこう。'], refuseJustLost: ['負けたばかりだ。少し頭を冷やさせてくれ。'], refuseTooMany: ['続けて何度もは付き合えない。'], refuseWary: ['あなたとは戦わない方がよさそうだ。'], refuseCooldown: ['しばらくは遠慮してもらおう。'],
      challenge: ['少し、付き合ってもらえるかな。'], challengeRevenge: ['さっきの続きをしよう。'],
      win: ['読み通りだ。'], lose: ['……やるね。'], draw: ['互角か。'],
      stGood: ['ふふ、気が合うね。'], stNeutral: ['なるほど。'], stBad: ['……その考えは危ういな。'],
      tellHappy: ['それは貴重な話だ。感謝する。'], tellLittle: ['参考にさせてもらう。'], tellNone: ['それなら既に知っている。'], tellDoubt: ['……裏は取れているのかな。'], tellWary: ['……なぜそれを{I}に？'],
      busy: ['さっき話したばかりだろう。'], noCards: ['もう賭けるものがない。'],
      refuseNeedInfo: ['あなたの手の内が見えないうちは、勝負はしない。'], giftOffer: ['{I}のカードを{V}枚、預かってくれないか。'], giftThanks: ['感謝する。'], giftDeclined: ['そうか、無理強いはしない。'],
    },
    rumor: {
      used1: '{S}は{W}{C}を使っていたよ。', used2: '{S}は{W}までに{C}を2枚使っている。',
      usedAll: '{S}はもう{C}を持っていないはずだ。{W}聞いた話だが。', keep: '{S}は{C}をまだ残しているらしい。',
      stars: '{S}は{W}、星を{V}個持っていた。', fought: '{S}は{W}{O}と勝負していた。',
      relGood: '{S}は{O}と懇意にしているようだ。', relBad: '{S}と{O}は反りが合わないらしい。',
      total: '{S}の手札は、全部で{V}枚のはずだ。',
    },
  },
  overfamiliar: {
    label: '馴れ馴れしい', register: 'casual', talkative: 1.3, you: 'キミ',
    I: { male: '俺', female: 'あたし', other: 'オレ' }, honorific: none,
    lines: {
      greetWarm: ['よっ、待ってたよ〜！{I}たち、もう友達だよな？'], greetNeutral: ['よう、新入り。いいこと教えてやろうか？'], greetCold: ['あれ、キミか。ま、いいけど。'],
      againWarm: ['おっ、来た来た！'], againNeutral: ['ククッ、また来たのか。'], againCold: ['またキミかよ〜。'],
      noInfo: ['今はネタ切れだな〜。'], noInfoCold: ['さあてね〜。'],
      accept: ['いいねえ、乗ってやるよ！'], acceptAngry: ['いいぜ、さっきのお礼をたっぷりしてやるよ。'],
      refuse: ['今はパスかな〜。'], refuseJustLost: ['負けたばっかなんだからさ〜、勘弁してよ。'], refuseTooMany: ['ちょっとちょっと、しつこいって。'], refuseWary: ['キミとはやめとくわ、なんか怖いし。'], refuseCooldown: ['しばらくキミとは距離置くわ〜。'],
      challenge: ['なあなあ、一勝負どう？'], challengeRevenge: ['さっきのやつ、もう一回やろうぜ〜。'],
      win: ['ありがとね〜！'], lose: ['チッ……運のいいやつ。'], draw: ['へえ、やるじゃん。'],
      stGood: ['だよな〜！わかってるじゃん！'], stNeutral: ['ふーん、そっか〜。'], stBad: ['え〜、ノリ悪くない？'],
      tellHappy: ['マジ？キミいいやつじゃん！'], tellLittle: ['へえ〜、覚えとく覚えとく。'], tellNone: ['それ、とっくに知ってるって〜。'], tellDoubt: ['ほんとぉ？盛ってない？'], tellWary: ['……タダで教えるなんて、何が狙い？'],
      busy: ['さっき話したじゃ〜ん。'], noCards: ['もう賭けるもんないんだよね〜。'],
      refuseNeedInfo: ['キミのことよく知らないし、今はパス〜。'], giftOffer: ['なあ、{I}のカード{V}枚もらってくんない？友達だろ？'], giftThanks: ['サンキュ〜、助かったわ！'], giftDeclined: ['え〜、つれないなあ。'],
    },
    rumor: {
      used1: '{S}ね、{W}{C}使ってたよ〜。', used2: '{S}、{W}までに{C}2枚も使ってたぜ。',
      usedAll: '{S}はもう{C}持ってないってさ〜。', keep: '{S}は{C}をまだ残してるらしいぜ〜。',
      stars: '{S}、{W}は星{V}個だったよ〜。', fought: '{S}さ、{W}{O}と勝負してたぜ。',
      relGood: '{S}と{O}って仲いいんだよね〜。', relBad: 'ここだけの話、{S}と{O}は仲悪いぜ〜。',
      total: '{S}ってさ、カード全部で{V}枚らしいぜ〜。',
    },
  },
  cold: {
    label: '冷たい', register: 'casual', talkative: 0.6, you: 'あなた',
    I: { male: '私', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['……あなたなら、少しくらい話してもいい。'], greetNeutral: ['……何。'], greetCold: ['話しかけないで。'],
      againWarm: ['……また来たの。別にいいけど。'], againNeutral: ['……また。'], againCold: ['迷惑。'],
      noInfo: ['知らない。'], noInfoCold: ['教える理由がない。'],
      accept: ['……いい。受ける。'], acceptAngry: ['……今度は負けない。'],
      refuse: ['断る。'], refuseJustLost: ['今は無理。'], refuseTooMany: ['しつこい。'], refuseWary: ['あなたとはやらない。'], refuseCooldown: ['しばらく近づかないで。'],
      challenge: ['……勝負して。'], challengeRevenge: ['……さっきの続き。'],
      win: ['当然。'], lose: ['……そう。'], draw: ['……引き分け。'],
      stGood: ['……悪くない。'], stNeutral: ['……そう。'], stBad: ['……くだらない。'],
      tellHappy: ['……ありがとう。役に立つ。'], tellLittle: ['……覚えておく。'], tellNone: ['知ってる。'], tellDoubt: ['……信じられない。'], tellWary: ['……何が目的。'],
      busy: ['さっき話した。'], noCards: ['もう賭けるものはない。'],
      refuseNeedInfo: ['あなたの情報が足りない。やらない。'], giftOffer: ['……カード{V}枚、引き取って。'], giftThanks: ['……助かった。'], giftDeclined: ['……そう。'],
    },
    rumor: {
      used1: '{S}は{W}{C}を使っていた。', used2: '{S}は{W}までに{C}を2枚使っていた。',
      usedAll: '{S}はもう{C}を持っていない。', keep: '{S}は{C}をまだ残している。',
      stars: '{S}は{W}、星{V}個。', fought: '{S}は{W}{O}と勝負していた。',
      relGood: '{S}と{O}は親しい。', relBad: '{S}と{O}は仲が悪い。',
      total: '{S}の手札は{V}枚。',
    },
  },
  chatty: {
    label: 'おしゃべり', register: 'casual', talkative: 1.5, you: 'あなた',
    I: { male: '僕', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['あっ、あなた！ちょうどよかった、聞いて聞いて！'], greetNeutral: ['やあやあ！ねえ、ここってほんと変な場所だよね〜。'], greetCold: ['あ、どうも。……で、何？'],
      againWarm: ['また来てくれたの？うれしいな〜！'], againNeutral: ['また会ったね！'], againCold: ['あ、またなんだ。'],
      noInfo: ['それがさ、今は面白い話がないんだよね〜。'], noInfoCold: ['さあ、どうだったかな〜。'],
      accept: ['いいよ、やろやろ！どれ出そうかな〜。'], acceptAngry: ['いいよ、さっきの分は取り返させてもらうからね！'],
      refuse: ['ごめんね、今はちょっと気分じゃないんだ。'], refuseJustLost: ['負けたばっかりなんだよ〜、少し休ませて！'], refuseTooMany: ['えー、また？さっきやったばかりじゃん。'], refuseWary: ['あなたとはやめとく、なんだか怖いもん。'], refuseCooldown: ['しばらくはあなたとはやらないって決めたんだ。'],
      challenge: ['ねえねえ、せっかくだし勝負しようよ！'], challengeRevenge: ['さっきの、もう一回やらせて！'],
      win: ['やった、勝っちゃった！ごめんね〜。'], lose: ['あーん、負けちゃった！'], draw: ['あいこだ！気が合うね〜。'],
      stGood: ['そうそう、そうだよね！わかる〜！'], stNeutral: ['へえ〜、そうなんだ。'], stBad: ['えっ、そうかな……{I}はちょっと違うかも。'],
      tellHappy: ['えっ本当？ありがとう、すっごく助かる！'], tellLittle: ['へえ〜、そうなんだ！覚えとくね。'], tellNone: ['あ、それなら知ってる知ってる！'], tellDoubt: ['えー、ほんとに？'], tellWary: ['……なんで{I}にそんなこと教えてくれるの？'],
      busy: ['さっきいっぱい話したじゃない〜。'], noCards: ['もう賭けるものがないんだよね。'],
      refuseNeedInfo: ['あなたのこと、まだよく知らないし……もうちょっとお話ししてからにしよ？'], giftOffer: ['ねえねえ、{I}のカード{V}枚もらってくれない？お願い！'], giftThanks: ['ありがとう〜！ほんと助かった！'], giftDeclined: ['そっかぁ、残念〜。'],
    },
    rumor: {
      used1: 'ねえ聞いて、{S}ね、{W}{C}使ってたんだよ！', used2: '{S}ったら、{W}までに{C}を2枚も使ってたんだって！',
      usedAll: '{S}ね、もう{C}持ってないらしいよ〜。', keep: '{S}って{C}をまだ残してるんだって！',
      stars: '{S}ね、{W}は星{V}個持ってたよ！', fought: 'そういえば{S}、{W}{O}と勝負してたよ！',
      relGood: '{S}と{O}って仲良しなんだって！', relBad: 'ここだけの話、{S}と{O}って仲悪いらしいよ〜。',
      total: 'そうそう、{S}ってカードが全部で{V}枚あるらしいよ！',
    },
  },
  taciturn: {
    label: '無口', register: 'casual', talkative: 0.4, you: 'あんた',
    I: { male: '俺', female: '私', other: '私' }, honorific: none,
    lines: {
      greetWarm: ['……ん。'], greetNeutral: ['……。'], greetCold: ['……（目をそらした）'],
      againWarm: ['……また、か。'], againNeutral: ['……。'], againCold: ['……帰れ。'],
      noInfo: ['……ない。'], noInfoCold: ['……言わない。'],
      accept: ['……いい。'], acceptAngry: ['……借りは、返す。'],
      refuse: ['……やらない。'], refuseJustLost: ['……今は、無理。'], refuseTooMany: ['……もう、いい。'], refuseWary: ['……あんたとは、やらない。'], refuseCooldown: ['……しばらく、来るな。'],
      challenge: ['……勝負。'], challengeRevenge: ['……もう一度。'],
      win: ['……。'], lose: ['……っ。'], draw: ['……同じ。'],
      stGood: ['……（小さくうなずいた）'], stNeutral: ['……そうか。'], stBad: ['……（首を横に振った）'],
      tellHappy: ['……助かる。'], tellLittle: ['……そうか。'], tellNone: ['……知ってる。'], tellDoubt: ['……本当か。'], tellWary: ['……なぜ。'],
      busy: ['……さっき、話した。'], noCards: ['……もう、ない。'],
      refuseNeedInfo: ['……あんたのこと、知らない。'], giftOffer: ['……カード{V}枚。やる。'], giftThanks: ['……すまん。'], giftDeclined: ['……そうか。'],
    },
    rumor: {
      used1: '……{S}。{W}、{C}。', used2: '……{S}、{C}を2枚。{W}。',
      usedAll: '……{S}、もう{C}はない。', keep: '……{S}、{C}を残してる。',
      stars: '……{S}、星{V}。', fought: '……{S}、{O}とやってた。',
      relGood: '……{S}と{O}、仲がいい。', relBad: '……{S}と{O}、仲が悪い。',
      total: '……{S}、全部で{V}枚。',
    },
  },
};

// 話し手（言葉遣い・性別）に合わせてセリフを1つ選び、{I} {you} などを置き換える
export function speak(
  style: SpeechStyle,
  gender: Gender,
  key: LineKey,
  vars: Record<string, string> = {},
): string {
  const def = SPEECH[style];
  const list = def.lines[key];
  const text = list[Math.floor(Math.random() * list.length)];
  return fill(text, { I: def.I[gender], you: def.you, ...vars });
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}
