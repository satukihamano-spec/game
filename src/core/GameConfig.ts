// ゲーム全体で使う数値をまとめる場所。
// 調整したいときは、ここの値を変えるだけで済むようにする。
// （星や勝負のルールの数値は src/data/rules.ts にある）
export const GameConfig = {
  // 描画
  fieldOfView: 50, // カメラの視野角（度）
  nearClip: 0.1, // これより近いものは描かない
  farClip: 100, // これより遠いものは描かない
  maxPixelRatio: 2, // 高解像度画面での描画倍率の上限（スマホの負荷対策）
  // 画質の設定（メニュー → 設定）ごとの描画倍率の上限。スマホは最初「標準」、PCは「高画質」
  pixelRatioByQuality: { low: 1, normal: 1.5, high: 2 },
  npcCullDistance: 38, // プレイヤーからこれより遠いNPCは描かない（霧で見えない距離）
  // スマホの縦画面では横の見える範囲が狭くなるので、視野角を広げてカメラを少し引く
  portraitFieldOfView: 62,
  portraitCameraScale: 1.15,
  tapRadiusPx: 44, // NPCをタップで選ぶときの当たり判定の半径（px）
  backgroundColor: 0x0b0b10,

  // カメラ（プレイヤーの斜め後ろ上から見下ろす）
  cameraOffset: { x: 0, y: 12, z: 9 }, // プレイヤーから見たカメラの位置
  cameraFollow: 6, // 追いかける速さ（大きいほどすぐ追いつく）

  // プレイヤー
  moveSpeed: 4.5, // 歩く速さ（m/秒）
  playerRadius: 0.4, // 当たり判定の半径（m）
  npcRadius: 0.5, // NPCの当たり判定の半径（m）

  // フロア（広さはゲームモードで決まる → src/data/modes.ts）
  wallHeight: 3, // 壁の高さ（m）
} as const;
