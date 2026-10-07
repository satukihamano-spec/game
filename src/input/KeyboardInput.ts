import type { GameAction, InputSource, MoveVector } from './InputManager';

// PCのキーボード入力。
//   移動      … WASD / 矢印キー
//   話しかける … E
//   決定      … Enter / Space
//   キャンセル … Esc
//   情報一覧  … Q
//   メニュー  … M
//   選択肢    … 1〜5
const ACTION_KEYS: Record<string, GameAction> = {
  KeyE: 'interact',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  KeyQ: 'memo',
  KeyM: 'menu',
  Digit1: 'choice1',
  Digit2: 'choice2',
  Digit3: 'choice3',
  Digit4: 'choice4',
  Digit5: 'choice5',
  Digit6: 'choice6',
  Numpad1: 'choice1',
  Numpad2: 'choice2',
  Numpad3: 'choice3',
  Numpad4: 'choice4',
  Numpad5: 'choice5',
  Numpad6: 'choice6',
};

export class KeyboardInput implements InputSource {
  private readonly pressed = new Set<string>();
  private handler: (action: GameAction) => void = () => {};

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // ウィンドウ外をクリックしたときにキーが押しっぱなしにならないように
    window.addEventListener('blur', () => this.pressed.clear());
  }

  setActionHandler(handler: (action: GameAction) => void): void {
    this.handler = handler;
  }

  getMove(): MoveVector {
    const k = this.pressed;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    return { x, y };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.pressed.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) {
      e.preventDefault(); // Spaceでページがスクロールしたり、ボタンが二重に押されたりしないように
      if (!e.repeat) this.handler(action); // 押しっぱなしで連打にならないように
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };
}
