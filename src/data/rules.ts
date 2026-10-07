// ゲームのルールに関する数値をまとめる場所。
// バランスを調整したいときは、ここの数字だけを変えればよい。
export const Rules = {
  // カード：最初に持つ枚数はモードごとに違う → src/data/modes.ts の cardsPerType

  // 星
  startStars: 3, // 全員の最初の星
  // 勝利に必要な星の数・制限時間・人数・マップの広さはモードごとに違う → src/data/modes.ts
  winReward: 1, // 勝負に勝ったとき相手から受け取る星
  // 星が0になった人は消滅（NPCはフロアから消え、残りカードは破棄）

  // 距離（m）
  talkDistance: 2.2, // NPCにこの距離まで近づくと話しかけられる
  npcSeeDistance: 7, // NPCがこの距離の勝負を目撃できる
  playerSeeDistance: 9, // プレイヤーがこの距離の勝負を目撃できる

  // NPCからの挑戦
  challengeCooldownSec: 25, // プレイヤーが挑戦された後、次に挑戦されるまでの最短時間
  // 逃げたときのリスク（ここを変えればリスクの重さを調整できる）
  flee: {
    timePenaltySec: 15, // 残り時間が減る
    starLossChance: 0.15, // この確率で逃げ遅れ、星を1つ奪われる
  },

  // NPC同士が会話したとき、相手の手札を直接聞き出せる確率（NPCの内部情報。プレイヤーには見えない）
  talkLeakChance: 0.2,

  // ℹ マーク：プレイヤーがNPCとの会話で「ある人物についての情報」を入手すると、その人物の頭上に出る。
  // 入手してからの経過時間で色が変わり、最後は消える（秒）
  infoMark: {
    freshSec: 180, // 3分未満：緑
    agingSec: 300, // 5分未満：黄
    expireSec: 600, // 10分未満：赤 → 10分で消える
  },

  // NPC AI の行動の重み（src/sim/NpcBrain.ts で使う）
  // 折れ線は [位置, 倍率] の並び。位置と位置の間はなめらかにつながる（急なON/OFFにならない）
  npcAi: {
    // 経過時間（0 = 開始、1 = 終了）ごとの対戦意欲：序盤は活発 → 中盤は少し落ち着く → 終盤は非常に活発
    battleByTime: [[0, 1.9], [0.25, 1.3], [0.5, 0.6], [0.7, 1.0], [0.85, 1.9], [1, 3.2]],
    // 経過時間ごとの情報収集（会話）意欲：中盤が一番活発
    infoByTime: [[0, 0.6], [0.3, 1.2], [0.5, 1.8], [0.7, 1.2], [1, 0.7]],
    // フロア全体のカード残数（最初を1とした割合）ごとの対戦意欲
    //   100〜50%：普通 / 50〜30%：少しずつ上昇 / 30〜20%：さらに上昇 / 20〜10%：非常に活発 / 10%未満：極めて緊迫
    battleByCards: [[1, 1], [0.5, 1], [0.3, 1.5], [0.2, 2.2], [0.1, 3.2], [0, 4.0]],
    // 考える間隔（秒）。毎フレームは考えない
    thinkMin: 2.5,
    thinkMax: 6,
    // プレイヤーから遠いNPCは「簡略AI」として考える間隔を長くする（スマホの負荷対策）
    nearDistance: 18, // この距離より近いNPCは詳細AI
    farThinkScale: 1.4, // 遠いNPCの考える間隔の倍率
    maxThinksPerFrame: 6, // 1フレームで考えてよいNPCの最大人数（残りは次のフレームへ回す）
    // 勝利条件（目標の星）を満たした後の行動
    //   強欲さを持たないNPC：星を守るため対戦意欲 × safeDrive、勝負を受ける確率 × safeAccept。
    //     ただし勝利には「カードを使い切る」ことも必要なので、経過時間が relaxFrom を過ぎると少しずつ普段どおりに戻る
    //   強欲なNPC（greed 0.5以上）：勝負を受ける確率 × greedyAccept（星を稼ぎ続ける）
    secured: { safeDrive: 0.35, safeAccept: 0.6, greedyAccept: 1.3, relaxFrom: 0.55 },
    // 「弱い者いじめ」傾向（NPCごとの bully 0〜1）の効き方。勝負相手を選ぶとき・挑まれたときに使う
    bully: {
      preferWeaker: 0.8, // 自分より星が少ない相手を狙う強さ（星の差1つあたり）
      avoidStronger: 1.0, // 自分より星が多い相手を避ける強さ（星の差1つあたり）
      maxDiff: 3, // 星の差はこれ以上を同じとみなす
      lateSoften: 0.5, // 終盤ほど選り好みしなくなる（終了時に bully がこの割合だけ弱まる）
    },
  },

  // NPCが嘘をつく確率の計算（src/sim/FloorSim.ts の lieChance）
  //   最終的な確率 ＝ NPC本人の嘘傾向（lie）× 友好度 × 性格 × 話の内容 × 状況
  lying: {
    friendlyReduce: 0.65, // 友好度+100のとき、嘘の確率がこの割合だけ下がる（0.65 → 本来の35%。0にはならない）
    hostileAdd: 0.4, // 友好度-100のとき、嘘の確率にこれだけ足される
    minRatio: 0.25, // どんなに仲が良くても、本人の嘘傾向のこの割合までは嘘をつく
    personalityBase: 0.8, // 性格の影響：0.8 ＋ 0.4 ×（1 − 正直さ）倍
    personalityDishonesty: 0.4,
    // 話の内容ごとの倍率（大事な情報ほど嘘をつきやすい）
    byKind: { used: 1, total: 1.2, stars: 0.9, relation: 0.8, fought: 0 },
    pressure: 0.6, // 状況：星が足りないまま終盤になるほど、嘘をつきやすくなる
    max: 0.95,
  },

  // プレイヤーがNPCの嘘を見抜いたときの「警戒度」（プレイヤー側の記録。NPCの嘘傾向・友好度とは別のデータ）
  //   見抜くたびに+1（最大5）。最後に変化してから decaySec 秒ごとに1段階下がる
  //   NPCの名前の色が、段階0（通常）→5（最も強い赤）に変わる
  suspicion: {
    max: 5,
    decaySec: 180,
    colors: ['#f2f2f2', '#ffc4c4', '#ff9696', '#ff6a6a', '#ff3b3b', '#e60000'],
  },

  // 人間関係・友好度（src/sim/Relations.ts で使う）。友好度は -100〜+100
  relations: {
    initialSpread: 35, // NPC同士の最初の友好度のばらつき（-35〜+35）。第一印象の良し悪し
    // NPC → プレイヤーの最初の友好度。通常NPCは「中程度」から始まる（NPCごとに npcs.ts の playerAffinity で変更可）
    //   中程度 = 0（-100〜+100の真ん中）。spread を大きくすると最初から少しばらつく
    playerInitial: { value: 0, spread: 0 },
    caughtLying: -5, // 嘘をプレイヤーに見抜かれたNPCの、プレイヤーへの友好度の変化（気まずくなる）
    // プレイヤーに負けたNPCの友好度の変化は「lossPenalty × 性格の負けず嫌い度（personalities の social.sore）」
    respectChance: 0.35, // 「強者を認める」性格（social.respect）がこの確率×respect で、逆に友好度が上がる（初めて負けたときだけ）
    respectGain: 5,
    // 友好度が低すぎるとプレイヤーとの対戦を断る（しきい値は性格ごと：social.hateRefuseAt）
    //   断る確率 ＝ base ＋（しきい値 − 友好度）÷ slope（最大 max）。ただし次の事情で下がる：
    //   強欲さ（× 1 − greedOverride × 強欲さ）/ 星が足りない終盤（× 1 − needStars × 不足割合 × 経過）
    //   弱い者いじめでプレイヤーの方が星が少ない（× 1 − bullyOverride × …）/ 焦り（÷ urgency）
    dislike: { base: 0.55, slope: 40, max: 0.95, greedOverride: 0.8, needStars: 0.6, bullyOverride: 0.8 },
    // 会話による友好度の変化
    identityCorrect: 18, // 「あなた、○○ですよね？」が当たった（通常の会話より大きい）
    identityWrong: -30, // 外れた（通常の会話の失敗より大きく下がる）
    probeHonest: 4, // NPCからの質問に正直に答えた
    probeLieOk: 1, // 嘘で答えたがバレなかった
    probeLieCaught: -8, // 嘘で答えてバレた
    probeRefuse: -3, // 答えなかった（社交的なNPCほど気を悪くする）
    warmAt: 30, // これ以上だと親しげな態度になりやすい
    coldAt: -30, // これ以下だと冷たい態度になりやすい
    moodShowChance: 0.65, // 態度（親しげ／冷たい）が会話に表れる確率（毎回は分からないようにする）
    // 勝負に負けた側が、勝った相手への友好度を下げる量（連続で負けた回数ごとに大きくなる）
    lossPenalty: [-6, -14, -28, -40],
    smallTalkLike: 14, // 世間話で好きな答えをもらったとき
    smallTalkDislike: -12, // 世間話で嫌いな答えをもらったとき
    smallTalkOther: 2, // どちらでもない答え
    tellHappy: 8, // 役立つ情報を教えてもらって喜んだとき
    tellLittle: 3, // 少し喜んだとき
    tellWary: -4, // 警戒したとき
    refusalsForCooldown: 2, // 同じ相手からの勝負をこの回数続けて断ると、対戦クールダウンになる
    rematchWindowSec: 120, // 「続けて勝負した」とみなす時間（秒）
    justLostSec: 60, // 「負けた直後」とみなす時間（秒）
    playerTalkCooldownSec: 30, // プレイヤーが同じNPCに、情報を聞く・教える・世間話をするまでの間隔（秒）
  },

  // 会話システム（src/sim/Conversation.ts・core/Game.ts）
  conversation: {
    // NPCからプレイヤーに話しかけて情報を集める（積極的・社交的・情報好きなNPCほど多い。臆病・慎重なNPCは少ない）
    probe: {
      chance: 0.12, // 1回考えたときに話しかけに行く確率の基準
      npcCooldownSec: 150, // 同じNPCが次に話しかけてくるまで
      floorCooldownSec: 50, // 誰かが話しかけてきたあと、次に（別のNPCも含めて）話しかけてくるまでの最短時間
      radius: 16, // この距離以内にプレイヤーがいれば話しかけに行く
      recentSec: 300, // 「最近」とみなす時間（誰と話した・誰と対戦した など）
      favorChance: 0.35, // 正直に答えたとき、お礼に噂を1つ教えてくれる確率（× 情報を教える性格）
      npcDetectBase: 0.2, // プレイヤーの嘘をNPCが見抜く確率：基準 ＋（1 − 信じやすさ）× 0.3 ＋ 技量 × 0.1
    },
    // 「あなた、○○ですよね？」を聞ける状況：手がかりがこれ以上たまったNPCだけ（NPCごとに1回だけ）
    identityCluesNeeded: 2,
    knownBySec: 300, // 「プレイヤーに自分のことを知られている」とNPCが警戒する時間
  },

  // プレイヤーがNPCの嘘を見抜く基本確率（NPCが嘘をついた場合だけ、情報を聞いたその場で判定）
  //   ※「NPCが嘘をつく確率」（lying・NPCの嘘傾向・友好度・性格）とは別のパラメーター
  playerLieDetectChance: 0.5,

  // 特殊NPCの正体をプレイヤーに見破られたときの弱体化
  //   見破られた本人だけ、カード把握能力の確率（peek.percent）がこの数で割られる（整数パーセントに四捨五入）
  //   秀才 15% → 5% / 戦略家 33% → 11% / 玄人 45% → 15%。それ以外の能力（カード・星・性格・友好度・強欲など）は変わらない
  identityExposedPeekDivisor: 3,

  // NPCの種類（画面に出す名前・特殊能力）
  //   peek … 勝負の直前に相手の手札を見抜く能力
  //          percent: カードの種類（グー・チョキ・パー）ごとに独立して判定する確率（整数％）。当たった種類は所持数が正確に分かる
  //   ※ 最初のカード枚数はモードごとに違うので src/data/modes.ts（cardsPerType・kuroutoCardsPerType）で管理する
  //   greed … 強欲さを持つかどうか。chance の確率で、min〜max の強欲さを持つ（null = 持たない）
  //           通常NPCは強欲さを持たない。npcs.ts で greed を書いた人物が特殊NPCになった場合は、その値を使う
  npcTypes: {
    normal: { label: '通常', peek: null, greed: null },
    saisho: { label: '秀才', peek: { percent: 15 }, greed: { chance: 0.35, min: 0.3, max: 0.6 } },
    strategist: { label: '戦略家', peek: { percent: 33 }, greed: { chance: 0.5, min: 0.4, max: 0.8 } },
    kurouto: { label: '玄人', peek: { percent: 45 }, greed: { chance: 1, min: 1, max: 1 } },
  },
} as const;

// NPCの種類のID。コードの中では NpcType.SAISHO のように書くと分かりやすい
export type NpcTypeId = keyof typeof Rules.npcTypes;
export const NpcType = {
  NORMAL: 'normal',
  SAISHO: 'saisho', // 秀才（旧：中ボス）
  STRATEGIST: 'strategist', // 戦略家（旧：大ボス）
  KUROUTO: 'kurouto', // 玄人
} as const satisfies Record<string, NpcTypeId>;

// 以前の名前との互換用
export type Rank = NpcTypeId;
