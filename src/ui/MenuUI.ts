import { CARDS, PLAYER_HAND, type CardId } from '../card/Card';
import { formatTime } from '../core/GameState';
import type { Box2D } from '../sim/collision';

// メニュー（☰ボタン / Mキー で開く）。プレイ中の画面をできるだけ広く使うため、
// 普段はボタン1つだけにして、必要なときにここから開く。
//   ・知っている情報（情報一覧）
//   ・ゲーム状況（時間・人数・星・カード・勝利条件・簡易マップ）
//   ・操作方法
//   ・設定（画質）
//   ・ゲーム終了（2回タップで確定）
// ※ メニューを開いている間も、制限時間とNPCの行動は進み続ける（情報一覧と同じ）。

export type Quality = 'low' | 'normal' | 'high';
export const QUALITY_LABEL: Record<Quality, string> = { low: '軽量', normal: '標準', high: '高画質' };

// ゲーム状況の画面に出す内容（Game が作って渡す）
export interface MenuStatus {
  modeLabel: string;
  timeLeft: number;
  alive: number;
  total: number;
  stars: number;
  starsToWin: number;
  hand: Record<CardId, number>;
  floor: Record<CardId, number>;
  winReady: boolean;
  map: MapSnapshot;
}

// 簡易マップに描くもの（プレイヤーが見えている範囲の人物と、フラグを付けた人物だけ）
export interface MapSnapshot {
  roomSize: number;
  obstacles: readonly Box2D[];
  player: { x: number; z: number };
  people: { x: number; z: number; kind: 'npc' | 'flag' | 'gm' }[];
}

export interface MenuHandlers {
  onIntel: () => void;
  onClose: () => void;
  onQuit: () => void;
  getStatus: () => MenuStatus;
  getQuality: () => Quality;
  setQuality: (q: Quality) => void;
}

type Page = 'top' | 'status' | 'help' | 'settings';

export class MenuUI {
  private readonly panel: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly backButton: HTMLButtonElement;
  private page: Page = 'top';
  private quitArmed = false;
  private refreshTimer = 0;
  private readonly h: MenuHandlers;

  constructor(root: HTMLElement, handlers: MenuHandlers) {
    this.h = handlers;
    this.panel = el('div', 'menu hidden');
    const head = el('div', 'menu-head');
    this.backButton = el('button', 'menu-back', '‹ 戻る');
    this.backButton.addEventListener('click', () => this.open('top'));
    this.titleEl = el('div', 'menu-title');
    const close = el('button', 'menu-close', '✕');
    close.setAttribute('aria-label', 'メニューを閉じる');
    close.addEventListener('click', () => this.h.onClose());
    head.append(this.backButton, this.titleEl, close);
    this.body = el('div', 'menu-body');
    this.panel.append(head, this.body);
    root.appendChild(this.panel);
  }

  get isOpen(): boolean {
    return !this.panel.classList.contains('hidden');
  }

  show(): void {
    this.panel.classList.remove('hidden');
    this.open('top');
  }

  hide(): void {
    this.panel.classList.add('hidden');
    window.clearInterval(this.refreshTimer);
  }

  private open(page: Page): void {
    this.page = page;
    this.quitArmed = false;
    window.clearInterval(this.refreshTimer);
    this.backButton.classList.toggle('invisible', page === 'top');
    if (page === 'top') this.renderTop();
    else if (page === 'status') {
      this.renderStatus();
      this.refreshTimer = window.setInterval(() => this.page === 'status' && this.renderStatus(), 1000); // 1秒ごとに更新
    } else if (page === 'help') this.renderHelp();
    else this.renderSettings();
    this.body.scrollTop = 0;
  }

  private renderTop(): void {
    this.titleEl.textContent = 'メニュー';
    const list = el('div', 'menu-list');
    const item = (icon: string, label: string, sub: string, onClick: () => void, cls = ''): HTMLButtonElement => {
      const b = el('button', `menu-item ${cls}`);
      b.append(el('span', 'menu-icon', icon), el('span', 'menu-label', label), el('span', 'menu-sub', sub));
      b.addEventListener('click', onClick);
      return b;
    };
    const quit = item('🚪', 'ゲーム終了', 'モード選択に戻る', () => {
      if (this.quitArmed) {
        this.h.onQuit();
        return;
      }
      this.quitArmed = true; // うっかり押しても終わらないように、2回タップで確定
      quit.classList.add('armed');
      (quit.querySelector('.menu-label') as HTMLElement).textContent = 'もう一度タップで終了';
      window.setTimeout(() => {
        if (!this.quitArmed) return;
        this.quitArmed = false;
        quit.classList.remove('armed');
        (quit.querySelector('.menu-label') as HTMLElement).textContent = 'ゲーム終了';
      }, 3000);
    }, 'danger');
    list.append(
      item('📋', '知っている情報', '集めた情報・★フラグ・削除', () => this.h.onIntel()),
      item('🗺', 'ゲーム状況', '時間・人数・星・カード・マップ', () => this.open('status')),
      item('❔', '操作方法', 'スマホ・PCの操作', () => this.open('help')),
      item('⚙', '設定', `画質：${QUALITY_LABEL[this.h.getQuality()]}`, () => this.open('settings')),
      quit,
    );
    this.body.replaceChildren(list);
  }

  private renderStatus(): void {
    this.titleEl.textContent = 'ゲーム状況';
    const s = this.h.getStatus();
    const cards = (r: Record<CardId, number>): string => PLAYER_HAND.map((c) => `${CARDS[c].icon}${r[c]}`).join('  ');
    const rows: [string, string][] = [
      ['モード', s.modeLabel],
      ['残り時間', formatTime(s.timeLeft)],
      ['残り人数', `${s.alive} / ${s.total}人`],
      ['自分の星', `${s.stars}個（目標 ${s.starsToWin}個）`],
      ['自分の手札', cards(s.hand)],
      ['フロア全体のカード', cards(s.floor)],
    ];
    const table = el('div', 'menu-stats');
    for (const [k, v] of rows) table.append(el('div', 'menu-stat-key', k), el('div', 'menu-stat-val', v));
    const goal = el(
      'div',
      `menu-goal${s.winReady ? ' ready' : ''}`,
      s.winReady
        ? '勝利条件達成！ サングラスの「進行役」を探して報告しよう。'
        : `勝利条件：手札をすべて使い切ったとき、星${s.starsToWin}個以上。そのあと進行役に報告してクリア。`,
    );
    const map = this.drawMap(s.map);
    const legend = el('div', 'menu-map-legend', '▲ あなた　● 近くの人　★ フラグを付けた人　◆ 進行役（見えていれば）');
    this.body.replaceChildren(table, goal, map, legend);
  }

  // 簡易マップ（上から見た図）。小さなキャンバス1枚に、開いたときと1秒ごとに描くだけなので軽い
  private drawMap(m: MapSnapshot): HTMLCanvasElement {
    const canvas = el('canvas', 'menu-map');
    const px = 240;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.scale(dpr, dpr);
    const k = (px - 12) / m.roomSize;
    const X = (x: number): number => 6 + (x + m.roomSize / 2) * k;
    const Y = (z: number): number => 6 + (z + m.roomSize / 2) * k;
    ctx.fillStyle = '#16161d';
    ctx.fillRect(0, 0, px, px);
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(-m.roomSize / 2), Y(-m.roomSize / 2), m.roomSize * k, m.roomSize * k);
    ctx.fillStyle = '#3a3a46';
    for (const b of m.obstacles) ctx.fillRect(X(b.minX), Y(b.minZ), (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of m.people) {
      if (p.kind === 'flag') {
        ctx.fillStyle = '#ffd34d';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('★', X(p.x), Y(p.z));
      } else if (p.kind === 'gm') {
        ctx.fillStyle = '#ff6a6a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('◆', X(p.x), Y(p.z));
      } else {
        ctx.fillStyle = '#bbb';
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#4dff88';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('▲', X(m.player.x), Y(m.player.z));
    return canvas;
  }

  private renderHelp(): void {
    this.titleEl.textContent = '操作方法';
    const sec = (title: string, lines: string[]): HTMLDivElement => {
      const d = el('div', 'menu-help');
      d.append(el('div', 'menu-help-title', title));
      for (const l of lines) d.append(el('div', 'menu-help-line', l));
      return d;
    };
    this.body.replaceChildren(
      sec('📱 スマートフォン', [
        '左下のジョイスティック（画面の左半分のどこでも）を指でずらす：移動',
        'NPCをタップ：近くまで歩いて話しかける',
        '右下の黄色いボタン：近くの人に話しかける',
        '会話・カードはボタンをタップして選ぶ',
        '☰ メニュー：情報一覧・ゲーム状況・設定など',
      ]),
      sec('💻 PC', [
        'WASD / 矢印キー：移動　E：話しかける',
        'NPCをクリック：近くまで歩いて話しかける',
        '1〜6：選択肢・カードを選ぶ　Enter：次へ　Esc：戻る',
        'Q：情報一覧　M：メニュー',
      ]),
      sec('🎯 ルール', [
        'カードを使い切ったとき、目標の数以上の星を持っていれば勝利条件達成。',
        'そのあと、サングラスの「進行役」に話しかけて報告するとクリア。',
        '星が0になるか、時間切れになると負け。',
      ]),
    );
  }

  private renderSettings(): void {
    this.titleEl.textContent = '設定';
    const wrap = el('div', 'menu-help');
    wrap.append(el('div', 'menu-help-title', '画質'));
    wrap.append(el('div', 'menu-help-line', '動きが重いときは「軽量」にすると、描画の負荷が下がります。'));
    const row = el('div', 'menu-seg');
    for (const q of ['low', 'normal', 'high'] as Quality[]) {
      const b = el('button', `menu-seg-btn${this.h.getQuality() === q ? ' on' : ''}`, QUALITY_LABEL[q]);
      b.addEventListener('click', () => {
        this.h.setQuality(q);
        this.renderSettings();
      });
      row.append(b);
    }
    wrap.append(row);
    this.body.replaceChildren(wrap);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
