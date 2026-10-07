import type { GameAction, InputSource, MoveVector } from './InputManager';

// スマートフォンのタッチ操作（移動用の仮想ジョイスティック）。
//   ・画面の左下にジョイスティックがいつも表示されている（スマホのときだけ）
//   ・画面の左半分（上のステータス欄を除く）のどこかに指を置くと、ジョイスティックがその位置に移動する
//   ・指をずらした方向に移動し、指を離すと止まって左下の定位置に戻る
//   ・指をほとんど動かさずに短くタップした場合は「その位置を選んだ」とみなす（NPCを選ぶ）
//
// 指を受け付ける領域は左半分だけなので、右側のボタン（話しかける・メニューなど）とは干渉しない。
// 会話・カード・情報一覧の画面は、この領域より上に重なるので、そちらが開いている間は移動しない。

const STICK_RADIUS = 56; // 指をどこまでずらすと最大速度になるか（px）
const DEAD_ZONE = 0.15; // これより小さいずれは無視（手ぶれ対策）
const TAP_MOVE_PX = 12;
const TAP_MS = 350;

export class TouchInput implements InputSource {
  private readonly zone: HTMLDivElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private maxMoved = 0;
  private move: MoveVector = { x: 0, y: 0 };
  private onSelect: (x: number, y: number) => void = () => {};

  constructor(root: HTMLElement) {
    // 指を受け付ける透明な領域（画面の左半分）
    this.zone = document.createElement('div');
    this.zone.className = 'touch-zone';

    // ジョイスティックの見た目（土台の円＋動くつまみ）。普段は左下に薄く表示
    this.base = document.createElement('div');
    this.base.className = 'stick-base is-idle';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    this.zone.appendChild(this.base);

    // 他のUI（会話・カード画面など）より下に置くため、先頭に入れる
    root.prepend(this.zone);

    this.zone.addEventListener('pointerdown', this.onDown);
    this.zone.addEventListener('pointermove', this.onMove);
    this.zone.addEventListener('pointerup', this.onUp);
    this.zone.addEventListener('pointercancel', this.onUp);
  }

  setActionHandler(_handler: (action: GameAction) => void): void {
    // アクション（話しかける等）は画面のボタンから送る
  }

  setSelectHandler(handler: (x: number, y: number) => void): void {
    this.onSelect = handler;
  }

  getMove(): MoveVector {
    return this.move;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // 2本目の指は無視
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId); // 指が領域の外に出ても追いかける
    } catch {
      // 一部のブラウザでは使えないことがある。使えなくても移動はできる
    }
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = performance.now();
    this.maxMoved = 0;

    const rect = this.zone.getBoundingClientRect();
    this.base.style.left = `${e.clientX - rect.left}px`;
    this.base.style.top = `${e.clientY - rect.top}px`;
    this.base.style.bottom = 'auto';
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.remove('is-idle');
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    let dx = e.clientX - this.startX;
    let dy = e.clientY - this.startY;
    const dist = Math.hypot(dx, dy);
    this.maxMoved = Math.max(this.maxMoved, dist);
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS;
      dy = (dy / dist) * STICK_RADIUS;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const x = dx / STICK_RADIUS;
    const y = -dy / STICK_RADIUS; // 画面の上方向が「奥へ進む」
    this.move = Math.hypot(x, y) < DEAD_ZONE ? { x: 0, y: 0 } : { x, y };
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.move = { x: 0, y: 0 };
    // 左下の定位置に戻す
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.add('is-idle');
    // ほとんど動かさない短いタップ → その位置を選ぶ（NPCを選ぶ）
    if (e.type === 'pointerup' && this.maxMoved < TAP_MOVE_PX && performance.now() - this.startT < TAP_MS) {
      this.onSelect(e.clientX, e.clientY);
    }
  };
}
