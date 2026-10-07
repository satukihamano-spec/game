import type { GameAction, InputSource, MoveVector } from './InputManager';

// 3D画面のタップ（スマホ）・クリック（PC）。
// 指やマウスをほとんど動かさずに短く押して離したときだけ「その位置を選んだ」とみなす
// （画面をなぞっただけでは反応しない）。どのNPCが選ばれたかは Game が調べる。
const TAP_MOVE_PX = 12; // これ以上動いたらタップではない
const TAP_MS = 400; // これ以上長く押したらタップではない

export class PointerInput implements InputSource {
  private onSelect: (x: number, y: number) => void = () => {};
  private down: { id: number; x: number; y: number; t: number } | null = null;

  constructor(target: HTMLElement) {
    target.addEventListener('pointerdown', (e) => {
      this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    });
    target.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_MOVE_PX || performance.now() - d.t > TAP_MS) return;
      this.onSelect(e.clientX, e.clientY);
    });
    target.addEventListener('pointercancel', () => (this.down = null));
  }

  getMove(): MoveVector {
    return { x: 0, y: 0 };
  }

  setActionHandler(_handler: (action: GameAction) => void): void {
    // アクションは送らない（選択だけ）
  }

  setSelectHandler(handler: (x: number, y: number) => void): void {
    this.onSelect = handler;
  }
}
