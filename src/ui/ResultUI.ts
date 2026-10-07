// 勝利 / 敗北画面
export class ResultUI {
  private readonly screen: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly messageEl: HTMLDivElement;
  private onRestart: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.screen = document.createElement('div');
    this.screen.className = 'result hidden';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'result-title';
    this.messageEl = document.createElement('div');
    this.messageEl.className = 'result-message';

    const button = document.createElement('button');
    button.className = 'result-button';
    button.innerHTML = 'もう一度遊ぶ<span class="pc-only">（Enter）</span>';
    button.addEventListener('click', () => this.restart());

    this.screen.append(this.titleEl, this.messageEl, button);
    root.appendChild(this.screen);
  }

  show(type: 'gameover' | 'clear', message: string, onRestart: () => void): void {
    this.titleEl.textContent = type === 'clear' ? 'YOU SURVIVED' : 'GAME OVER';
    this.messageEl.textContent = message;
    this.screen.classList.toggle('is-clear', type === 'clear');
    this.screen.classList.remove('hidden');
    this.onRestart = onRestart;
  }

  // Enter からも呼ばれる
  restart(): void {
    if (!this.onRestart) return;
    const callback = this.onRestart;
    this.onRestart = null;
    callback();
  }
}
