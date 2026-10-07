import './style.css';
import { Game } from './core/Game';
import { ModeSelectUI } from './ui/ModeSelectUI';

const container = document.getElementById('app');
if (!container) {
  throw new Error('#app が index.html に見つかりません');
}

// スマホ・タブレットなら印を付ける（キー表示を隠し、仮想ジョイスティックを出す）
// 指で画面に触れた時点でも印を付ける（タッチ画面付きPCなど）
if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('is-touch');
window.addEventListener('touchstart', () => document.body.classList.add('is-touch'), { once: true, passive: true });

// iPhoneの「2本指で拡大」「ダブルタップで拡大」でゲーム画面がずれないようにする
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// まずモードを選び、選んだモードでゲームを始める
const modeSelect = new ModeSelectUI(container);
modeSelect.onChoose((mode) => {
  const game = new Game(container, mode);
  game.start();
});
