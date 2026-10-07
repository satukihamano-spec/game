import { CARDS, PLAYER_HAND, type CardId } from '../card/Card';
import { formatTime } from '../core/GameState';

// 探索中に常に出ている表示（スマホの縦画面を基準に、必要最小限だけ）
//   上部のステータス欄：残り時間・残り人数・自分の星・メニューボタン
//                       自分の手札・フロア全体のカード残数
//   その下：お知らせ・近くで起きた出来事・目標
//   右下：話しかけるボタン（左下は移動用ジョイスティック）
// 画面が広いPCでは、同じ部品が大きく・横に並んで表示される（CSSで切り替え）。
export class HUD {
  private readonly starsEl: HTMLSpanElement;
  private readonly handEl: HTMLSpanElement;
  private readonly floorEl: HTMLSpanElement;
  private readonly timerEl: HTMLSpanElement;
  private readonly feedEl: HTMLDivElement;
  private readonly interactButton: HTMLButtonElement;
  private readonly toastEl: HTMLDivElement;
  private readonly objectiveEl: HTMLDivElement;
  private readonly remainingEl: HTMLSpanElement;
  private toastTimer = 0;
  private lastTime = '';
  private lastFloor = '';
  private readonly starsToWin: number;

  constructor(root: HTMLElement, starsToWin: number, onInteract: () => void, onMenu: () => void) {
    this.starsToWin = starsToWin;

    // ステータス欄（1段目：時間・人数・星・メニュー／2段目：手札・全体のカード）
    const bar = div('hud-bar');
    const row1 = div('hud-row');
    this.timerEl = span('hud-chip hud-timer');
    this.remainingEl = span('hud-chip hud-remaining');
    this.starsEl = span('hud-chip hud-stars');
    const menuButton = document.createElement('button');
    menuButton.className = 'hud-menu';
    menuButton.setAttribute('aria-label', 'メニュー');
    menuButton.innerHTML = '☰<span class="hud-menu-label">メニュー</span><span class="pc-only key">M</span>';
    menuButton.addEventListener('click', onMenu);
    row1.append(this.timerEl, this.remainingEl, this.starsEl, menuButton);

    const row2 = div('hud-row hud-row-cards');
    const hand = span('hud-chip hud-hand');
    hand.append(span('hud-label', '手札'));
    this.handEl = span('hud-cards');
    hand.append(this.handEl);
    const floor = span('hud-chip hud-floor');
    floor.append(span('hud-label', '全体'));
    this.floorEl = span('hud-cards');
    floor.append(this.floorEl);
    row2.append(hand, floor);
    bar.append(row1, row2);
    root.appendChild(bar);

    // 操作のヒント（PCは画面下に1行。スマホは操作方法をメニューから見る）
    const hint = div('hud-hint pc-only');
    hint.textContent = 'WASD：移動　E：話す　クリック：NPCを選ぶ　Q：情報一覧　M：メニュー';
    root.appendChild(hint);

    this.feedEl = div('hud-feed');
    root.appendChild(this.feedEl);

    this.interactButton = document.createElement('button');
    this.interactButton.className = 'hud-interact hidden';
    this.interactButton.addEventListener('click', onInteract);
    root.appendChild(this.interactButton);

    this.toastEl = div('hud-toast hidden');
    root.appendChild(this.toastEl);

    this.objectiveEl = div('hud-objective hidden');
    root.appendChild(this.objectiveEl);
  }

  // 残り人数：今フロアにいる参加者 / ゲーム開始時の総参加人数
  setRemaining(alive: number, total: number): void {
    this.remainingEl.textContent = `👥 ${alive}/${total}`;
    this.remainingEl.setAttribute('aria-label', `残り人数 ${alive} / ${total}`);
  }

  // 画面に出し続ける目標（例：進行役に報告せよ）。null で消す
  setObjective(text: string | null): void {
    this.objectiveEl.textContent = text ?? '';
    this.objectiveEl.classList.toggle('hidden', text === null);
  }

  setStatus(stars: number, hand: Record<CardId, number>): void {
    this.starsEl.replaceChildren(`⭐${stars}`, span('hud-goal', `/${this.starsToWin}`));
    this.starsEl.classList.toggle('danger', stars < this.starsToWin);
    this.handEl.textContent = PLAYER_HAND.map((c) => `${CARDS[c].icon}${hand[c]}`).join(' ');
  }

  // フロア全体のカード残数（カード残数ボードと同じデータ）。変わったときだけ書き換える
  setFloorCards(totals: Record<CardId, number>): void {
    const text = PLAYER_HAND.map((c) => `${CARDS[c].icon}${totals[c]}`).join(' ');
    if (text === this.lastFloor) return;
    this.lastFloor = text;
    this.floorEl.textContent = text;
  }

  setTime(sec: number): void {
    const text = `⏱ ${formatTime(sec)}`;
    if (text === this.lastTime) return; // 変わったときだけ書き換える（軽くするため）
    this.lastTime = text;
    this.timerEl.textContent = text;
    this.timerEl.classList.toggle('danger', sec <= 60);
  }

  // label が null ならボタンを隠す
  setInteractLabel(label: string | null): void {
    if (label === null) {
      this.interactButton.classList.add('hidden');
      return;
    }
    this.interactButton.textContent = label;
    const key = document.createElement('span');
    key.className = 'pc-only';
    key.textContent = '（E）';
    this.interactButton.appendChild(key);
    this.interactButton.classList.remove('hidden');
  }

  // 近くで起きた出来事を数秒表示する（最大3行）
  feed(text: string): void {
    const line = div('feed-line');
    line.textContent = text;
    this.feedEl.prepend(line);
    while (this.feedEl.childElementCount > 3) this.feedEl.lastElementChild?.remove();
    window.setTimeout(() => line.remove(), 7000);
  }

  // 数秒だけ出るお知らせ
  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), 3000);
  }
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function span(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
