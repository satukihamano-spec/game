import { GAME_MODES, normalNpcCount, type GameModeConfig } from '../data/modes';
import { Rules } from '../data/rules';

// ゲーム開始前のモード選択画面。
// ボタンの中身は data/modes.ts から自動で作るので、モードを増やしてもここは変えなくてよい。
// PC：クリック または 1〜4キー　スマホ：タップ
export class ModeSelectUI {
  private readonly screen: HTMLDivElement;
  private onSelect: ((mode: GameModeConfig) => void) | null = null;

  constructor(root: HTMLElement) {
    this.screen = document.createElement('div');
    this.screen.className = 'mode-select';

    const title = document.createElement('div');
    title.className = 'mode-title';
    title.textContent = 'STAR GAME';

    const lead = document.createElement('div');
    lead.className = 'mode-lead';
    lead.textContent = '全員がグー・チョキ・パーを同じ枚数ずつ持っている（玄人だけは1枚ずつ多い）。カードを使い切ったとき目標の星を持っていれば、進行役に報告して生き残れる。';

    const grid = document.createElement('div');
    grid.className = 'mode-grid';
    GAME_MODES.forEach((mode, i) => {
      const button = document.createElement('button');
      button.className = 'mode-button';
      button.append(
        line('mode-time', mode.label),
        line('mode-goal', `勝利：星${mode.starsToWin}個以上`),
        line('mode-detail', `参加者 ${mode.participants}人（あなたを含む）`),
        line('mode-detail', `一般NPC ${normalNpcCount(mode)}人`),
        line(
          'mode-detail',
          `${Rules.npcTypes.saisho.label} ${mode.special.saisho} / ${Rules.npcTypes.strategist.label} ${mode.special.strategist} / ${Rules.npcTypes.kurouto.label} ${mode.special.kurouto}`,
        ),
        line('mode-detail', `カード 各${mode.cardsPerType}枚（${Rules.npcTypes.kurouto.label}は各${mode.kuroutoCardsPerType}枚）`),
        line('mode-key pc-only', `${i + 1}キー`),
      );
      button.addEventListener('click', () => this.select(mode));
      grid.appendChild(button);
    });

    this.screen.append(title, lead, grid);
    root.appendChild(this.screen);
    window.addEventListener('keydown', this.onKey);
  }

  // モードが選ばれたら呼ばれる関数を登録する
  onChoose(callback: (mode: GameModeConfig) => void): void {
    this.onSelect = callback;
  }

  private onKey = (e: KeyboardEvent): void => {
    const index = Number(e.key) - 1;
    const mode = GAME_MODES[index];
    if (mode) this.select(mode);
  };

  private select(mode: GameModeConfig): void {
    if (!this.onSelect) return;
    const callback = this.onSelect;
    this.onSelect = null;
    window.removeEventListener('keydown', this.onKey);
    this.screen.remove();
    callback(mode);
  }
}

function line(className: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}
