import { Rules } from '../data/rules';
import { SMALL_TALK, type SmallTalkQuestion, type TalkTag } from '../data/smalltalk';
import type { Agent } from './Agent';

// 世間話の処理（プレイヤーとNPC、NPC同士の両方で使う）

export function pickQuestion(): SmallTalkQuestion {
  return SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)];
}

// NPCが世間話の質問に答える：自分の好きな答えを選びやすい（たまに気まぐれ）
export function npcAnswer(answerer: Agent, q: SmallTalkQuestion): TalkTag {
  const likes = answerer.personality.social.likes;
  const liked = q.options.filter((o) => likes.includes(o.tag));
  const pool = liked.length > 0 && Math.random() < 0.75 ? liked : q.options;
  return pool[Math.floor(Math.random() * pool.length)].tag;
}

// 答えを聞いた側の反応：好きな答えなら友好度が上がり、嫌いな答えなら下がる
// 世間話好きなNPCほど、反応（友好度の変化）が大きい
export function reactionTo(listener: Agent, tag: TalkTag): { delta: number; kind: 'good' | 'neutral' | 'bad' } {
  const R = Rules.relations;
  const s = listener.personality.social;
  const scale = 0.6 + 0.8 * listener.traits.smallTalk;
  const noise = Math.round((Math.random() * 2 - 1) * 2);
  if (s.likes.includes(tag)) return { delta: Math.round(R.smallTalkLike * scale) + noise, kind: 'good' };
  if (s.dislikes.includes(tag)) return { delta: Math.round(R.smallTalkDislike * scale) + noise, kind: 'bad' };
  return { delta: R.smallTalkOther + noise, kind: 'neutral' };
}
