// 会話画面（画面下の会話ウィンドウ＋選択肢ボタン）
export class DialogueUI {
  private readonly panel: HTMLDivElement;
  private readonly nameEl: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly choicesEl: HTMLDivElement;
  private onChoose: ((index: number) => void) | null = null;
  private choiceCount = 0;
  private onAdvance: (() => void) | null = null; // ボタンのないセリフ：タップで次へ
  private advanceTimer = 0;

  constructor(root: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.className = 'dialogue hidden';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'dialogue-name';
    this.textEl = document.createElement('div');
    this.textEl.className = 'dialogue-text';
    this.choicesEl = document.createElement('div');
    this.choicesEl.className = 'dialogue-choices';

    this.panel.append(this.nameEl, this.textEl, this.choicesEl);
    root.appendChild(this.panel);
    // ボタンのないセリフは、会話ウィンドウのどこをタップしても次へ進む
    this.panel.addEventListener('click', () => this.advance());
  }

  // 対戦演出のときは会話ウィンドウの見た目を変える（2人のアップ画面に重ねる）
  setDuel(on: boolean): void {
    this.panel.classList.toggle('is-duel', on);
  }

  // ボタンのないセリフを出す。タップするか、autoSec 秒たつと then() へ進む
  say(speaker: string, text: string, autoSec: number, then: () => void): void {
    this.show(speaker, text, [], () => {});
    this.choicesEl.replaceChildren();
    const hint = document.createElement('div');
    hint.className = 'dialogue-next';
    hint.textContent = '▼';
    this.choicesEl.appendChild(hint);
    this.choiceCount = 0;
    this.onChoose = null;
    this.onAdvance = then;
    this.advanceTimer = window.setTimeout(() => this.advance(), autoSec * 1000);
  }

  // Enter キー・タップ・時間切れで、ボタンのないセリフから次へ進む
  advance(): void {
    const next = this.onAdvance;
    if (!next) return;
    this.onAdvance = null;
    window.clearTimeout(this.advanceTimer);
    next();
  }

  // 会話を1場面表示する。選択肢が選ばれると onChoose(番号) が呼ばれる
  show(speaker: string, text: string, choices: string[], onChoose: (index: number) => void): void {
    this.onAdvance = null;
    window.clearTimeout(this.advanceTimer);
    this.nameEl.textContent = speaker;
    // （ ）で始まる文はナレーションなので「」を付けない。改行はそのまま表示する
    this.textEl.textContent = text.startsWith('（') ? text : `「${text.replace('\n', '」\n')}${text.includes('\n') ? '' : '」'}`;
    this.choicesEl.replaceChildren();
    this.onChoose = onChoose;

    const labels = choices.length > 0 ? choices : ['閉じる'];
    this.choiceCount = labels.length;
    labels.forEach((label, i) => {
      const button = document.createElement('button');
      button.className = 'choice';
      // 番号はキーボード用なのでPCだけ表示（スマホではボタンをタップする）
      const num = document.createElement('span');
      num.className = 'pc-only choice-num';
      num.textContent = `${i + 1}. `;
      button.append(num, label);
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // 会話ウィンドウのタップ（次へ）と区別する
        this.choose(i);
      });
      this.choicesEl.appendChild(button);
    });

    this.panel.classList.remove('hidden');
    this.panel.scrollTop = 0; // 選択肢が多くて画面に収まらないときは、会話ウィンドウの中だけスクロールする
  }

  // キーボードの 1〜3 から呼ばれる
  choose(index: number): void {
    if (!this.onChoose || index < 0 || index >= this.choiceCount) return;
    const callback = this.onChoose;
    this.onChoose = null; // 二重に押されないように
    callback(index);
  }

  // 選択肢が1つだけのとき、Enter で選べるようにする
  confirm(): void {
    if (this.onAdvance) this.advance();
    else if (this.choiceCount === 1) this.choose(0);
  }

  // 嘘を見抜いたときの演出（会話ウィンドウが赤く光って揺れる）
  flashLie(): void {
    this.panel.classList.remove('lie-detected');
    void this.panel.offsetWidth; // アニメーションを最初からやり直すため
    this.panel.classList.add('lie-detected');
    window.setTimeout(() => this.panel.classList.remove('lie-detected'), 1500);
  }

  hide(): void {
    this.panel.classList.add('hidden');
    this.onChoose = null;
    this.onAdvance = null;
    window.clearTimeout(this.advanceTimer);
  }
}
