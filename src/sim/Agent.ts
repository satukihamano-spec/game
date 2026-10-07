import { PERSONALITIES, type Personality } from '../data/personalities';
import type { NpcData } from '../data/npcs';
import { Rules, type Rank } from '../data/rules';
import type { Gender, SpeechStyle } from '../data/speech';
import { Hand } from './Hand';
import { Knowledge } from './Knowledge';

// NPCが今していること
export type Activity =
  | { k: 'idle'; until: number }
  | { k: 'wander'; tx: number; tz: number }
  | { k: 'approach'; target: Agent; intent: 'talk' | 'challenge' | 'gift' | 'probe'; giveUpAt: number } // probe = プレイヤーに話しかけて情報を集める
  | { k: 'engaged'; partner: Agent; what: 'talk' | 'battle'; until: number }
  | { k: 'withPlayer' }; // プレイヤーと会話・勝負中（止まって待つ）

// フロアにいる参加者1人分（プレイヤーもNPCもこの形）。
// 3Dの見た目は持たず、計算だけを担当する（見た目は npc/NPCView.ts）。
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly rank: Rank;
  readonly portraitId: string; // 顔アップ画像の顔ID（public/portraits/<顔ID>/）
  readonly personality: Personality;
  readonly gender: Gender;
  readonly speechStyle: SpeechStyle;
  readonly hand: Hand;
  readonly knowledge = new Knowledge();

  // NPCごとの傾向（npcs.ts で個別に決めていなければ、性格の標準値）。どれも別々のデータとして持つ
  readonly traits: {
    lie: number; // 嘘をつく傾向（0〜1）。本人の性質。実際に嘘をつく確率は友好度などと組み合わせて決まる
    info: number; // 情報収集傾向（1 が普通）
    battle: number; // 対戦傾向（1 が普通）
    smallTalk: number; // 世間話傾向（0〜1）
    greed: number | null; // 強欲さ（0〜1）。null = 強欲さを持たない（通常NPC）
    bully: number; // 弱い者いじめ傾向（0〜1）
    playerAffinity: number; // プレイヤーへの最初の友好度（以後の変化は Relations で管理）
  };
  readonly basePerType: number; // このモードの通常参加者の初期枚数（種類ごと）。他人の手札を推測するときの基準
  readonly initialTotal: number; // 自分の最初のカード総数

  stars: number;
  alive = true; // false = 消滅、またはカードを使い切ってフロアを去った
  removedReason: 'eliminated' | 'finished' | null = null; // フロアからいなくなった理由（退場演出に使う）
  x = 0;
  z = 0;
  facing = 0;

  // NPCの行動用
  act: Activity = { k: 'idle', until: 0 };
  nextThinkAt = 0;
  talkedWithPlayer = 0; // プレイヤーと話した回数
  infoCooldownUntil = 0; // プレイヤーに次に情報を教えられる時刻
  smallTalkCooldownUntil = 0; // プレイヤーと次に世間話ができる時刻
  tellCooldownUntil = 0; // プレイヤーから次に情報を教えてもらえる時刻
  // 特殊NPCの正体をプレイヤーに見破られたか（NPCごとに別々。true ならカード把握能力が 1/3 になる → Battle.ts の peekPercent）
  specialIdentityDetectedByPlayer = false;
  probeReadyAt = 60; // 次にプレイヤーへ話しかけに行ける時刻（情報収集。開始直後は来ない）

  // ボスは普通のNPCより強くなる
  readonly skill: number;
  readonly acceptRate: number;
  readonly targetPlayer: number;

  constructor(id: string, name: string, isPlayer: boolean, data?: NpcData, perType: number = 3) {
    this.id = id;
    this.name = name;
    this.isPlayer = isPlayer;
    this.rank = data?.rank ?? 'normal';
    this.portraitId = data?.portraitId ?? id;
    this.personality = PERSONALITIES[data?.personality ?? 'friendly'];
    this.gender = data?.gender ?? 'other';
    this.speechStyle = data?.speechStyle ?? 'casual';
    this.stars = data?.stars ?? Rules.startStars;
    // 最初のカード：個別設定（玄人は Roster.ts がモード設定の kuroutoCardsPerType を入れる）がなければモードの枚数
    this.hand = new Hand(data?.cards ?? perType);
    this.basePerType = perType;
    this.initialTotal = this.hand.total();

    const p = this.personality;
    this.traits = {
      lie: data?.lie ?? 1 - p.honesty,
      info: data?.info ?? p.ai.infoDrive,
      battle: data?.battle ?? 1,
      smallTalk: data?.smallTalk ?? Math.min(1, 0.3 + 0.6 * p.sociability),
      greed: data?.greed ?? null,
      bully: data?.bully ?? p.ai.bully,
      playerAffinity:
        data?.playerAffinity ??
        Math.round(Rules.relations.playerInitial.value + (Math.random() * 2 - 1) * Rules.relations.playerInitial.spread),
    };

    if (this.rank === 'strategist' || this.rank === 'kurouto') {
      this.skill = 0.97;
      this.acceptRate = Math.min(1, p.acceptRate + 0.3);
      this.targetPlayer = Math.min(1, p.targetPlayer * 1.8);
    } else if (this.rank === 'saisho') {
      this.skill = 0.9;
      this.acceptRate = Math.min(1, p.acceptRate + 0.2);
      this.targetPlayer = Math.min(1, p.targetPlayer * 1.5);
    } else {
      this.skill = p.skill;
      this.acceptRate = p.acceptRate;
      this.targetPlayer = p.targetPlayer;
    }
  }

  // 勝負できる状態か（星もカードも残っている）
  canBattle(): boolean {
    return this.alive && this.stars > 0 && this.hand.total() > 0;
  }

  // 他の人から話しかけられたり、勝負を挑まれたりできる状態か
  isInterruptible(): boolean {
    const k = this.act.k;
    return this.alive && (k === 'idle' || k === 'wander' || k === 'approach');
  }
}
