import { CARDS, PLAYER_HAND, type CardId } from '../card/Card';
import type { BattleOutcome } from '../card/RockPaperScissors';

export interface BattleResultView {
  playerCard: CardId;
  npcCard: CardId;
  outcome: BattleOutcome;
  starChange: number; // プレイヤーの星の増減
  npcLine: string;
  playerStars: number;
  npcStars: number;
}

const OUTCOME_TEXT: Record<BattleOutcome, string> = {
  win: 'YOU WIN!',
  lose: 'YOU LOSE...',
  draw: 'DRAW',
};

// カードじゃんけんの画面（画面全体を切り替える）
export class CardBattleUI {
  private readonly screen: HTMLDivElement;
  private readonly npcNameEl: HTMLDivElement;
  private readonly lineEl: HTMLDivElement;
  private readonly starsEl: HTMLDivElement;
  private readonly cardsEl: HTMLDivElement;
  private readonly resultEl: HTMLDivElement;
  private readonly nextButton: HTMLButtonElement;

  private npcName = '';
  private phase: 'hidden' | 'select' | 'result' = 'hidden';
  private onPick: ((card: CardId) => void) | null = null;
  private onNext: (() => void) | null = null;
  private handCounts: Record<CardId, number> = { rock: 0, scissors: 0, paper: 0 };
  private readonly cardButtons: HTMLButtonElement[] = [];

  constructor(root: HTMLElement) {
    this.screen = document.createElement('div');
    this.screen.className = 'battle hidden';

    this.npcNameEl = document.createElement('div');
    this.npcNameEl.className = 'battle-npc';
    this.lineEl = document.createElement('div');
    this.lineEl.className = 'battle-line';
    const vs = document.createElement('div');
    vs.className = 'battle-vs';
    vs.textContent = 'VS';
    this.starsEl = document.createElement('div');
    this.starsEl.className = 'battle-stars';

    this.cardsEl = document.createElement('div');
    this.cardsEl.className = 'battle-cards';
    PLAYER_HAND.forEach((id, i) => {
      const card = CARDS[id];
      const button = document.createElement('button');
      button.className = 'card';
      button.innerHTML = `<span class="card-icon"></span><span class="card-name"></span><span class="card-left"></span><span class="card-key pc-only"></span>`;
      (button.querySelector('.card-icon') as HTMLElement).textContent = card.icon;
      (button.querySelector('.card-name') as HTMLElement).textContent = card.name;
      (button.querySelector('.card-key') as HTMLElement).textContent = `${i + 1}`;
      button.addEventListener('click', () => this.pick(i));
      this.cardsEl.appendChild(button);
      this.cardButtons.push(button);
    });

    this.resultEl = document.createElement('div');
    this.resultEl.className = 'battle-result hidden';

    this.nextButton = document.createElement('button');
    this.nextButton.className = 'battle-next hidden';
    this.nextButton.innerHTML = '次へ<span class="pc-only">（Enter）</span>';
    this.nextButton.addEventListener('click', () => this.next());

    this.screen.append(
      this.npcNameEl,
      this.lineEl,
      vs,
      this.starsEl,
      this.cardsEl,
      this.resultEl,
      this.nextButton,
    );
    root.appendChild(this.screen);
  }

  // 勝負開始：カード選択の画面を出す（hand = プレイヤーの残りカード）
  open(
    npcName: string,
    line: string,
    playerStars: number,
    npcStars: number,
    hand: Record<CardId, number>,
    onPick: (card: CardId) => void,
  ): void {
    this.npcName = npcName;
    this.handCounts = { ...hand };
    PLAYER_HAND.forEach((id, i) => {
      const button = this.cardButtons[i];
      (button.querySelector('.card-left') as HTMLElement).textContent = `残り ${hand[id]}`;
      button.disabled = hand[id] <= 0;
    });
    this.npcNameEl.textContent = npcName;
    this.lineEl.textContent = `「${line}」`;
    this.setStars(playerStars, npcStars);
    this.cardsEl.classList.remove('hidden');
    this.resultEl.classList.add('hidden');
    this.nextButton.classList.add('hidden');
    this.screen.classList.remove('hidden');
    this.onPick = onPick;
    this.phase = 'select';
  }

  // キーボードの 1〜3 からも呼ばれる
  pick(index: number): void {
    if (this.phase !== 'select' || !this.onPick) return;
    const card = PLAYER_HAND[index];
    if (!card || this.handCounts[card] <= 0) return; // 持っていないカードは出せない
    const callback = this.onPick;
    this.onPick = null;
    callback(card);
  }

  // 結果を表示する
  showResult(view: BattleResultView, onNext: () => void): void {
    const p = CARDS[view.playerCard];
    const n = CARDS[view.npcCard];
    const sign = view.starChange > 0 ? '+' : '';
    const change = view.starChange === 0 ? '⭐ ±0' : `⭐ ${sign}${view.starChange}`;

    this.resultEl.replaceChildren(
      line('battle-hands', `あなた：${p.icon} ${p.name}　　${this.npcName}：${n.icon} ${n.name}`),
      line(`battle-outcome outcome-${view.outcome}`, OUTCOME_TEXT[view.outcome]),
      line('battle-change', change),
    );
    this.lineEl.textContent = `「${view.npcLine}」`;
    this.setStars(view.playerStars, view.npcStars);

    this.cardsEl.classList.add('hidden');
    this.resultEl.classList.remove('hidden');
    this.nextButton.classList.remove('hidden');
    this.onNext = onNext;
    this.phase = 'result';
  }

  // Enter からも呼ばれる
  next(): void {
    if (this.phase !== 'result' || !this.onNext) return;
    const callback = this.onNext;
    this.onNext = null;
    callback();
  }

  hide(): void {
    this.screen.classList.add('hidden');
    this.phase = 'hidden';
  }

  private setStars(playerStars: number, npcStars: number): void {
    this.starsEl.textContent = `あなた ⭐${playerStars}　　${this.npcName} ⭐${npcStars}`;
  }
}

function line(className: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}
