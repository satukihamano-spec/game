// カードの定義。
// 「どのカードに勝つか」をデータとして持たせることで、
// 将来ジョーカーや特殊カードを追加しても判定処理を書き換えずに済む。

export type CardId = 'rock' | 'scissors' | 'paper';

export interface CardDef {
  id: CardId;
  name: string; // 画面に出す名前
  icon: string; // 画面に出す絵文字
  beats: CardId[]; // このカードが勝てる相手
}

export const CARDS: Record<CardId, CardDef> = {
  rock: { id: 'rock', name: 'グー', icon: '✊', beats: ['scissors'] },
  scissors: { id: 'scissors', name: 'チョキ', icon: '✌️', beats: ['paper'] },
  paper: { id: 'paper', name: 'パー', icon: '✋', beats: ['rock'] },
};

// プレイヤーが選べるカード（表示順）
export const PLAYER_HAND: CardId[] = ['rock', 'scissors', 'paper'];
