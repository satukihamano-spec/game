// ゲームが今どの場面にいるか
//   explore  … フロアを歩いている
//   dialogue … NPCと会話中（NPCからの挑戦も含む）
//   battle   … カードじゃんけん中
//   memo     … 情報メモを見ている
//   menu     … メニューを開いている
//   gameover … 敗北
//   clear    … 勝利
// ※ 会話・勝負・メモ・メニューの間も、制限時間とNPCの行動は進み続ける
export type GameMode = 'explore' | 'dialogue' | 'battle' | 'memo' | 'menu' | 'gameover' | 'clear';

// プレイヤーの星やカードは sim/Agent.ts（プレイヤー用の Agent）が持つ
export class GameState {
  mode: GameMode = 'explore';
  timeLeft: number; // 残り時間（秒）。最初の値はゲームモードで決まる

  constructor(timeLimitSec: number) {
    this.timeLeft = timeLimitSec;
  }

  isOver(): boolean {
    return this.mode === 'gameover' || this.mode === 'clear';
  }
}

// 秒数を「09:58」の形にする
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
