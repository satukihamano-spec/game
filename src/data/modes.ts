import type { NpcTypeId } from './rules';

// ゲームモードの設定。モードごとの違いは、すべてここにまとめる（他のファイルにモード別の数字を書かない）。
// バランスを変えたいときは、この表の数字だけを変えればよい。
//
//   timeLimitSec       … 制限時間（秒）
//   mapScale           … マップの広さの基準（1 = 旧10分モード相当、2 = 旧20分、3 = 旧30分、4 = 旧60分）。
//                         実際の広さは roomSizeFor() で「以前の計画サイズ × 2/3」に縮めて計算する
//   participants       … ゲーム開始時の総参加人数（プレイヤー＋一般NPC＋秀才＋戦略家＋玄人の合計）
//   special            … 特殊NPCの人数（秀才・戦略家・玄人）。一般NPCの人数は normalNpcCount() で自動計算
//   cardsPerType       … プレイヤーと一般NPC・秀才・戦略家が最初に持つ、グー・チョキ・パーそれぞれの枚数
//   kuroutoCardsPerType … 玄人が最初に持つ、グー・チョキ・パーそれぞれの枚数（いつも通常より1枚多い）
//   starsToWin         … カードを使い切ったとき、この数以上の星があれば勝利条件達成（そのあと進行役に報告してクリア）
//   npcPace            … NPCが勝負を挑む頻度の倍率（長いモードほど小さくする。バランス調整用）
export interface GameModeConfig {
  id: string;
  label: string;
  timeLimitSec: number;
  mapScale: number;
  participants: number;
  special: Record<Exclude<NpcTypeId, 'normal'>, number>;
  cardsPerType: number;
  kuroutoCardsPerType: number;
  starsToWin: number;
  npcPace: number;
}

export const GAME_MODES: GameModeConfig[] = [
  {
    id: '15min', label: '15分', timeLimitSec: 15 * 60, mapScale: 1, participants: 10,
    special: { saisho: 1, strategist: 1, kurouto: 1 }, cardsPerType: 3, kuroutoCardsPerType: 4, starsToWin: 3, npcPace: 0.3,
  },
  {
    id: '30min', label: '30分', timeLimitSec: 30 * 60, mapScale: 2, participants: 12,
    special: { saisho: 3, strategist: 1, kurouto: 1 }, cardsPerType: 4, kuroutoCardsPerType: 5, starsToWin: 4, npcPace: 0.14,
  },
  {
    id: '45min', label: '45分', timeLimitSec: 45 * 60, mapScale: 3, participants: 16,
    special: { saisho: 3, strategist: 2, kurouto: 1 }, cardsPerType: 5, kuroutoCardsPerType: 6, starsToWin: 5, npcPace: 0.087,
  },
  {
    id: '60min', label: '60分', timeLimitSec: 60 * 60, mapScale: 4, participants: 20,
    special: { saisho: 2, strategist: 4, kurouto: 1 }, cardsPerType: 6, kuroutoCardsPerType: 7, starsToWin: 6, npcPace: 0.082,
  },
];

// マップの大きさ
//   BASE_ROOM_SIZE … 基準の一辺（m）
//   MAP_SIZE_FACTOR … 全モード共通の縮小率（2/3 = 以前の予定サイズの2/3）。ここを変えれば全モードの広さが変わる
export const BASE_ROOM_SIZE = 30;
export const MAP_SIZE_FACTOR = 2 / 3;

// モードからマップの一辺の長さを決める（面積が mapScale 倍になる比率を保ったまま、全体を縮小率で縮める）
export function roomSizeFor(mode: GameModeConfig): number {
  return Math.round(BASE_ROOM_SIZE * Math.sqrt(mode.mapScale) * MAP_SIZE_FACTOR);
}

// 特殊NPC（秀才・戦略家・玄人）の合計人数
export function specialCount(mode: GameModeConfig): number {
  return mode.special.saisho + mode.special.strategist + mode.special.kurouto;
}

// 通常NPCの人数（自動計算）＝ 総参加人数 − プレイヤー1人 − 特殊NPC
// 特殊NPCが多すぎて総参加人数を超える設定にした場合はエラーで知らせる
export function normalNpcCount(mode: GameModeConfig): number {
  const n = mode.participants - 1 - specialCount(mode);
  if (n < 0) {
    throw new Error(`${mode.label}モード：特殊NPC（${specialCount(mode)}人）＋プレイヤーが総参加人数（${mode.participants}人）を超えています`);
  }
  return n;
}

// NPCの合計人数（通常＋特殊）＝ 総参加人数 − プレイヤー
export function totalNpcs(mode: GameModeConfig): number {
  return mode.participants - 1;
}
