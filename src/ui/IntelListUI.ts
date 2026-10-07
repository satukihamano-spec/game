import type { IntelFreshness, IntelItem, PlayerIntel } from '../sim/PlayerIntel';

// 情報一覧：プレイヤーが入手した「他のNPCについての情報」を、NPCごとにまとめて表示する。
//   ☆ をタップ → フラグ（★）を付けたり外したりする
//   🗑 をタップ → 「削除？」に変わり、もう一度タップすると削除（うっかり消さないように2回押す）
// 削除はプレイヤーのメモから消すだけで、NPCやゲーム世界の情報は消えない。
// 表示するだけで、情報そのものは sim/PlayerIntel.ts が持っている。

const FRESH_LABEL: Record<IntelFreshness, string> = {
  fresh: '新しい',
  aging: 'やや古い',
  old: 'かなり古い',
  none: '古い情報',
};

export class IntelListUI {
  private readonly panel: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly summary: HTMLDivElement;
  private intel: PlayerIntel | null = null;
  private now = 0;
  private nameOf: (id: string) => string = (id) => id;
  private armedDelete: number | null = null; // 「削除？」状態になっている情報のID
  private disarmTimer = 0;

  // 将来用：NPCの名前をタップしたときの動き（例：マップ上でそのNPCを探しやすくする）
  onSubjectSelect: ((subjectId: string) => void) | null = null;

  constructor(root: HTMLElement, onClose: () => void) {
    this.panel = document.createElement('div');
    this.panel.className = 'intel hidden';

    const header = document.createElement('div');
    header.className = 'intel-header';
    const title = document.createElement('div');
    title.className = 'intel-title';
    title.textContent = '📋 知り得た情報';
    this.summary = document.createElement('div');
    this.summary.className = 'intel-summary';
    header.append(title, this.summary);

    const legend = document.createElement('div');
    legend.className = 'intel-legend';
    legend.textContent = '☆：フラグ　🗑：削除（2回タップ）／ 🟢新しい 🟡やや古い 🔴かなり古い';

    this.list = document.createElement('div');
    this.list.className = 'intel-list';

    const close = document.createElement('button');
    close.className = 'intel-close';
    close.innerHTML = '閉じる<span class="pc-only">（Q / Esc）</span>';
    close.addEventListener('click', onClose);

    this.panel.append(header, legend, this.list, close);
    root.appendChild(this.panel);
  }

  show(intel: PlayerIntel, now: number, nameOf: (id: string) => string): void {
    this.intel = intel;
    this.now = now;
    this.nameOf = nameOf;
    this.armedDelete = null;
    this.render();
    this.list.scrollTop = 0;
    this.panel.classList.remove('hidden');
  }

  hide(): void {
    this.panel.classList.add('hidden');
  }

  private render(): void {
    const intel = this.intel;
    if (!intel) return;
    const scroll = this.list.scrollTop; // フラグを押しても表示位置がずれないように
    this.list.replaceChildren();

    const groups = intel.groups();
    const flaggedCount = groups.reduce((n, g) => n + g.items.filter((x) => x.flagged).length, 0);
    this.summary.textContent = `${intel.count}件 ／ ★${flaggedCount}`;

    if (groups.length === 0) {
      this.list.appendChild(el('div', 'intel-empty', '他のNPCについての情報はまだない。NPCに話しかけて「情報を聞く」を選ぼう。'));
    }

    for (const g of groups) {
      const section = el('div', 'intel-group');
      const gone = intel.isGone(g.subjectId);
      if (gone) section.classList.add('is-gone');

      // 見出し：対象のNPC名
      const head = el('div', 'intel-group-head');
      const name = el('span', 'intel-name', this.nameOf(g.subjectId));
      name.dataset.subjectId = g.subjectId; // 将来：タップでマップ上のNPCを探す
      const id = g.subjectId;
      name.addEventListener('click', () => this.onSubjectSelect?.(id));
      head.appendChild(name);
      if (g.items.some((x) => x.flagged)) head.appendChild(el('span', 'intel-chip flag', '★'));
      if (gone) head.appendChild(el('span', 'intel-chip gone', '対象NPC消滅'));
      section.appendChild(head);

      for (const item of g.items) section.appendChild(this.renderItem(item));
      this.list.appendChild(section);
    }
    this.list.scrollTop = scroll;
  }

  private renderItem(item: IntelItem): HTMLDivElement {
    const intel = this.intel as PlayerIntel;
    const fresh = intel.itemFreshness(item, this.now);
    const row = el('div', `intel-item fresh-${fresh}`);
    if (item.flagged) row.classList.add('is-flagged');

    const body = el('div', 'intel-body');
    body.appendChild(el('div', 'intel-text', `「${item.text}」`));
    const meta = el('div', 'intel-meta');
    if (item.detectedLie) {
      row.classList.add('is-lie');
      meta.appendChild(el('span', 'intel-badge lie', '[嘘と見抜いた] '));
    }
    meta.appendChild(el('span', `intel-badge fresh-${fresh}`, fresh === 'none' ? '[古い情報]' : FRESH_LABEL[fresh]));
    meta.appendChild(el('span', '', ` ${item.timeLabel}　${item.source}より`));
    body.appendChild(meta);

    const flag = document.createElement('button');
    flag.className = item.flagged ? 'intel-flag on' : 'intel-flag';
    flag.textContent = item.flagged ? '★' : '☆';
    flag.setAttribute('aria-label', item.flagged ? 'フラグを外す' : 'フラグを付ける');
    flag.addEventListener('click', () => {
      intel.toggleFlag(item.id);
      this.render();
    });

    const armed = this.armedDelete === item.id;
    const del = document.createElement('button');
    del.className = armed ? 'intel-delete armed' : 'intel-delete';
    del.textContent = armed ? '削除？' : '🗑';
    del.setAttribute('aria-label', armed ? 'もう一度押すと削除' : '削除');
    del.addEventListener('click', () => {
      window.clearTimeout(this.disarmTimer);
      if (this.armedDelete === item.id) {
        intel.remove(item.id); // 情報と、その情報に付いていたフラグが一緒に消える
        this.armedDelete = null;
      } else {
        this.armedDelete = item.id;
        // 3秒たったら「削除？」を元に戻す
        this.disarmTimer = window.setTimeout(() => {
          this.armedDelete = null;
          this.render();
        }, 3000);
      }
      this.render();
    });

    const actions = el('div', 'intel-actions');
    actions.append(flag, del);
    row.append(body, actions);
    return row;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
