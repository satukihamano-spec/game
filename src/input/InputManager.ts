// 入力をゲーム用の「意味」に変換してまとめるクラス。
// ゲーム本体は「Wキー」や「タップ」を知らず、ここから
// 「移動したい方向」と「アクション」だけを受け取る。
//
//   キーボード（KeyboardInput）       ─┐
//   タッチのジョイスティック（TouchInput）─┼→ InputManager → move / interact / confirm / cancel / memo / menu / choice1〜6
//   画面のタップ・クリック（PointerInput）─┘                  ＋ select（画面のこの位置をタップした → NPCを選ぶ）
// PCとスマホでゲームの処理を分けず、入力の部分だけを入れ替えられるようにしている。

export type GameAction =
  | 'interact' // 話しかける・調べる
  | 'confirm' // 決定・次へ
  | 'cancel' // キャンセル・閉じる
  | 'memo' // 情報メモを開く・閉じる
  | 'menu' // メニューを開く・閉じる
  | 'choice1' // 1番目の選択肢・カード
  | 'choice2'
  | 'choice3'
  | 'choice4'
  | 'choice5'
  | 'choice6';

export interface MoveVector {
  x: number; // 右が +1、左が -1
  y: number; // 奥（画面の上方向）が +1、手前が -1
}

// 入力装置（キーボード、タッチなど）が満たすべき形
export interface InputSource {
  getMove(): MoveVector;
  setActionHandler(handler: (action: GameAction) => void): void;
  // 画面の位置（px）をタップ・クリックしたことを知らせる（使わない入力装置は省略してよい）
  setSelectHandler?(handler: (x: number, y: number) => void): void;
}

export class InputManager {
  private readonly sources: InputSource[] = [];
  private handler: (action: GameAction) => void = () => {};

  private selectHandler: (x: number, y: number) => void = () => {};

  addSource(source: InputSource): void {
    source.setActionHandler((action) => this.handler(action));
    source.setSelectHandler?.((x, y) => this.selectHandler(x, y));
    this.sources.push(source);
  }

  // 画面のタップ・クリック（NPCを選ぶ）を受け取る
  onSelect(handler: (x: number, y: number) => void): void {
    this.selectHandler = handler;
  }

  onAction(handler: (action: GameAction) => void): void {
    this.handler = handler;
  }

  // 画面上のボタンなどから直接アクションを送るとき用
  trigger(action: GameAction): void {
    this.handler(action);
  }

  // すべての入力装置の移動量を合計する（長さは最大1）
  getMove(): MoveVector {
    let x = 0;
    let y = 0;
    for (const source of this.sources) {
      const m = source.getMove();
      x += m.x;
      y += m.y;
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }
}
