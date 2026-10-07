import { Rules } from '../data/rules';
import { SPEECH } from '../data/speech';
import type { GiftReason, Lines, Mood, TalkFeature } from '../data/conversation';
import type { Agent } from './Agent';
import { curve, hasEnoughStars, type FloorContext } from './NpcBrain';

// 場面ごとの会話の台詞を選ぶ（データは src/data/conversation.ts）。
// NPCの性格・友好度・状況から「特徴」を作り、ムードの重みと掛け合わせて1つ選ぶ。
// 計算は数十回の掛け算だけなので、スマホでも軽い。

// 臆病さ（0〜1）：自分から挑まず、勝負も受けたがらない性格ほど大きい
export function timidness(a: Agent): number {
  const p = a.personality;
  return Math.max(0, Math.min(1, (1 - p.aggression) * (1 - p.acceptRate) * 1.4));
}

// 会話の状況（対戦後の友好度の変化など。なければ省略）
export interface TalkSituation {
  affinity: number; // NPC → プレイヤーの友好度
  grudge?: boolean; // プレイヤーに負けて根に持っている
  affinityDelta?: number; // 直前の対戦で友好度がどれだけ変わったか
  playerWeaker?: boolean; // NPCが「プレイヤーの方が星が少ない」と知っている（弱い者いじめ用）
}

// NPCの特徴（すべて 0〜1）
export function features(a: Agent, ctx: FloorContext, s: TalkSituation): Record<TalkFeature, number> {
  const p = a.personality;
  const R = Rules.relations;
  const starsShort = Math.max(0, ctx.starsToWin - a.stars) / ctx.starsToWin;
  const delta = s.affinityDelta ?? 0;
  return {
    base: 1,
    bold: Math.max(p.aggression, p.ai.gamble),
    timid: timidness(a),
    caution: p.ai.caution,
    social: p.sociability,
    calm: Math.max(0, (a.skill - 0.5) * 2),
    bully: s.playerWeaker ? a.traits.bully : 0,
    greed: a.traits.greed ?? 0,
    warm: Math.max(0, Math.min(1, (s.affinity - R.warmAt / 2) / 60)),
    cold: Math.max(0, Math.min(1, (-s.affinity + R.coldAt / 2) / 60)),
    grudge: s.grudge ? Math.max(0.3, p.social.revenge) : 0,
    honest: 1 - a.traits.lie,
    sly: a.traits.lie,
    sore: Math.min(1, p.social.sore / 1.5),
    desperate: hasEnoughStars(a, ctx) ? 0 : starsShort * curve([[0, 0], [0.5, 0.3], [1, 1]], ctx.progress),
    respect: delta > 0 ? 1 : 0,
    hurt: delta < 0 ? Math.min(1, -delta / 30) : 0,
  };
}

// 特徴とムードの重みから、ムードを1つ選ぶ
export function pickMood(moods: Record<string, Mood>, f: Record<TalkFeature, number>): { key: string; mood: Mood } {
  let total = 0;
  const list: { key: string; mood: Mood; w: number }[] = [];
  for (const key in moods) {
    const mood = moods[key];
    let w = 0;
    for (const k in mood.w) w += (mood.w[k as TalkFeature] ?? 0) * f[k as TalkFeature];
    if (w > 0) {
      list.push({ key, mood, w });
      total += w;
    }
  }
  if (list.length === 0) {
    const key = Object.keys(moods)[0];
    return { key, mood: moods[key] };
  }
  let x = Math.random() * total;
  for (const item of list) {
    x -= item.w;
    if (x <= 0) return item;
  }
  return list[list.length - 1];
}

// 台詞を1つ選び、言葉遣い（丁寧／くだけた・一人称・二人称）に合わせて仕上げる
export function line(a: Agent, lines: Lines, vars: Record<string, string> = {}): string {
  const def = SPEECH[a.speechStyle];
  const list = def.register === 'polite' ? lines.polite : lines.casual;
  let text = list[Math.floor(Math.random() * list.length)];
  text = text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? (k === 'I' ? def.I[a.gender] : k === 'you' ? def.you : ''));
  // 無口なNPCは最初の一文だけ、ぽつりと話す
  if (a.speechStyle === 'taciturn') {
    const first = text.split(/(?<=[。？！])/)[0];
    text = first.startsWith('……') ? first : `……${first}`;
  }
  return text;
}

// ムードを選んで台詞にする（しぐさがあれば、ときどき改行して付ける）
export function moodLine(a: Agent, moods: Record<string, Mood>, f: Record<TalkFeature, number>): { key: string; text: string } {
  const { key, mood } = pickMood(moods, f);
  let text = line(a, mood.lines);
  if (mood.act && Math.random() < 0.6) text += `\n${mood.act[Math.floor(Math.random() * mood.act.length)]}`;
  return { key, text };
}

// カードを譲る理由（状況・性格・友好度から決める。理由で台詞が変わるので、プレイヤーは事情を推測できる）
export function giftReason(a: Agent, ctx: FloorContext, affinity: number, givesAll: boolean, advice: boolean): GiftReason {
  if (givesAll) return 'leaving';
  if (advice && Math.random() < 0.7) return 'advice';
  if (affinity >= 60 && Math.random() < 0.3 + 0.4 * a.personality.social.generosity) return 'friend'; // 気前のいい性格ほど「お礼」と言う
  if (ctx.progress > 0.7) return 'timeShort';
  return 'surplus';
}

// NPCからプレイヤーに話しかけて情報を集めたい気持ち（1回考えたときに話しかけに行く確率）
//   積極的・社交的・噂好き・情報収集好きほど高く、臆病・慎重なほど低い。中盤に一番多い
export function probeChance(a: Agent, ctx: FloorContext, affinity: number): number {
  const p = a.personality;
  const curious = 0.5 + 0.5 * p.gossip;
  const wary = (1 - 0.8 * p.ai.caution) * (1 - timidness(a));
  const like = affinity < -40 ? 0.3 : 1; // 嫌いな相手にはあまり話しかけない
  return (
    Rules.conversation.probe.chance *
    p.sociability * curious * wary * (0.6 + 0.5 * p.aggression) * a.traits.info * curve(Rules.npcAi.infoByTime, ctx.progress) * like
  );
}
