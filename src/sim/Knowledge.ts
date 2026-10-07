import { PLAYER_HAND, type CardId } from '../card/Card';

// 「誰が・何を知っているか」を管理する。
// NPC 1人につき1つ持つ。中身は他の人についての「思い込み」で、
// 正しいとは限らない（嘘の噂や古い情報が混ざる）。

// t はゲーム開始からの経過秒数（その情報が正しかった時刻）
// firsthand … true = 自分の目や耳で直接入手した / false = 他人から聞いただけ（噂）
export interface UsedFact {
  n: number; // そのカードを何枚使ったと思っているか
  t: number;
  firsthand: boolean;
}

export interface Belief {
  used: Partial<Record<CardId, UsedFact>>;
  stars?: { v: number; t: number };
  fought?: { opponentId: string; t: number }; // 最後に誰と勝負していたか
  total?: { v: number; t: number }; // カードを全部で何枚持っているか（重要な情報）
}

// 噂（人から人へ伝わる情報1つ分）
export type Rumor =
  | { subjectId: string; kind: 'used'; card: CardId; n: number; t: number }
  | { subjectId: string; kind: 'stars'; v: number; t: number }
  | { subjectId: string; kind: 'fought'; opponentId: string; t: number }
  | { subjectId: string; kind: 'relation'; otherId: string; good: boolean; t: number } // ○○と△△は仲がいい／悪い
  | { subjectId: string; kind: 'total'; v: number; t: number }; // ○○はカードを全部で v 枚持っている

export class Knowledge {
  private readonly beliefs = new Map<string, Belief>();
  // 「誰と誰の仲がいい／悪い」についての情報（キーは "A>B"）
  private readonly relationBeliefs = new Map<string, { subjectId: string; otherId: string; good: boolean; t: number }>();
  version = 0; // 中身が変わるたびに増える（表示の更新が必要か判断するため）
  lastFirsthandAt = -Infinity; // 最後に自分で直接情報を手に入れた時刻（他のNPCが「話を聞きたい」と思う目安）

  // プレイヤーについての推測（NPCの内部情報。プレイヤーとの会話から集める。画面には出さない）
  //   talkedWith … プレイヤーが最近話した相手（id → 時刻）
  //   foughtWith … プレイヤーが最近対戦した相手
  //   knowsAbout … プレイヤーが情報を持っていそうな人物（自分が教えた・プレイヤーが話した内容から）
  //   lies       … プレイヤーの嘘に気づいた回数（多いほどプレイヤーの話を疑う）
  readonly playerNotes = {
    talkedWith: new Map<string, number>(),
    foughtWith: new Map<string, number>(),
    knowsAbout: new Map<string, number>(),
    lies: 0,
  };

  // プレイヤーが id の人物の情報を最近持っていそうか
  playerKnowsAbout(id: string, now: number, withinSec: number): boolean {
    const t = this.playerNotes.knowsAbout.get(id);
    return t !== undefined && now - t < withinSec;
  }

  private belief(id: string): Belief {
    let b = this.beliefs.get(id);
    if (!b) {
      b = { used: {} };
      this.beliefs.set(id, b);
    }
    return b;
  }

  // 自分の目で見た：○○がカードを1枚使った
  observeUse(id: string, card: CardId, t: number): void {
    const b = this.belief(id);
    const prev = b.used[card]?.n ?? 0;
    b.used[card] = { n: prev + 1, t, firsthand: true };
    this.lastFirsthandAt = t;
    this.version++;
  }

  // 本人から直接聞き出した：○○はそのカードをあと remaining 枚持っている
  observeRemaining(id: string, card: CardId, remaining: number, perType: number, t: number): void {
    this.belief(id).used[card] = { n: perType - remaining, t, firsthand: true };
    this.lastFirsthandAt = t;
    this.version++;
  }

  observeStars(id: string, v: number, t: number): void {
    this.belief(id).stars = { v, t };
  }

  // ○○のカード総数を知った（勝負の相手として見た・本人から聞いた）
  observeTotal(id: string, v: number, t: number): void {
    this.belief(id).total = { v, t };
    this.version++;
  }

  // ○○と△△の仲を知った（自分の気持ちや、見聞きしたこと）
  observeRelation(subjectId: string, otherId: string, good: boolean, t: number): void {
    this.relationBeliefs.set(`${subjectId}>${otherId}`, { subjectId, otherId, good, t });
  }

  // 自分の目で見た：○○が△△と勝負していた
  observeBattle(id: string, opponentId: string, t: number): void {
    this.belief(id).fought = { opponentId, t };
  }

  // 噂を聞いた：自分の情報より新しければ信じる
  hear(r: Rumor): void {
    const b = this.belief(r.subjectId);
    if (r.kind === 'used') {
      const cur = b.used[r.card];
      if (!cur || r.t > cur.t) {
        b.used[r.card] = { n: r.n, t: r.t, firsthand: false };
        this.version++;
      }
    } else if (r.kind === 'relation') {
      const key = `${r.subjectId}>${r.otherId}`;
      const cur = this.relationBeliefs.get(key);
      if (!cur || r.t > cur.t) this.relationBeliefs.set(key, { subjectId: r.subjectId, otherId: r.otherId, good: r.good, t: r.t });
    } else if (r.kind === 'total') {
      if (!b.total || r.t > b.total.t) b.total = { v: r.v, t: r.t };
    } else if (r.kind === 'stars') {
      if (!b.stars || r.t > b.stars.t) b.stars = { v: r.v, t: r.t };
    } else if (!b.fought || r.t > b.fought.t) {
      b.fought = { opponentId: r.opponentId, t: r.t };
    }
  }

  // その噂が自分にとって新しい情報か（知らない・自分の情報より新しい）
  isNewTo(r: Rumor): boolean {
    if (r.kind === 'relation') {
      const cur = this.relationBeliefs.get(`${r.subjectId}>${r.otherId}`);
      return !cur || r.t > cur.t;
    }
    const b = this.beliefs.get(r.subjectId);
    if (!b) return true;
    if (r.kind === 'used') return !b.used[r.card] || r.t > (b.used[r.card]?.t ?? -Infinity);
    if (r.kind === 'stars') return !b.stars || r.t > b.stars.t;
    if (r.kind === 'total') return !b.total || r.t > b.total.t;
    return !b.fought || r.t > b.fought.t;
  }

  // ○○の星の数を何個だと思っているか（知らなければ null）
  starsOf(id: string): number | null {
    return this.beliefs.get(id)?.stars?.v ?? null;
  }

  // ○○が各カードを何枚残していると思っているか
  // カード総数を知っていれば、その総数に合うように見積もりを縮める
  estimateRemaining(id: string, perType: number): Record<CardId, number> {
    const b = this.beliefs.get(id);
    const used = b?.used ?? {};
    const est = {
      rock: Math.max(0, perType - (used.rock?.n ?? 0)),
      scissors: Math.max(0, perType - (used.scissors?.n ?? 0)),
      paper: Math.max(0, perType - (used.paper?.n ?? 0)),
    };
    const sum = est.rock + est.scissors + est.paper;
    if (b?.total && b.total.v < sum && sum > 0) {
      const k = b.total.v / sum;
      est.rock *= k;
      est.scissors *= k;
      est.paper *= k;
    }
    return est;
  }

  // ○○についてどれくらい情報を持っているか（0〜1）。玄人などの「情報が少ないと勝負しない」判断に使う
  infoLevel(id: string): number {
    const b = this.beliefs.get(id);
    if (!b) return 0;
    let known = 0;
    for (const card of PLAYER_HAND) if (b.used[card]) known += 1;
    if (b.total) known += 1.5;
    if (b.stars) known += 0.5;
    return Math.min(1, known / 4);
  }

  // ○○のカード総数を何枚だと思っているか（知らなければ null）
  totalOf(id: string): number | null {
    return this.beliefs.get(id)?.total?.v ?? null;
  }

  // 人に話す噂を選ぶ（新しい情報ほど、プレイヤーの噂は gossip が高いほど選ばれやすい）
  pickRumors(
    now: number,
    count: number,
    opts: {
      gossip: number;
      playerId: string;
      excludeId: string;
      isAlive: (id: string) => boolean;
      skip?: (r: Rumor) => boolean; // true を返した噂は話さない（例：プレイヤー本人にプレイヤーの星の話はしない）
    },
  ): Rumor[] {
    const pool: { r: Rumor; w: number }[] = [];
    for (const [id, b] of this.beliefs) {
      if (id === opts.excludeId || !opts.isAlive(id)) continue;
      const playerBoost = id === opts.playerId ? 0.5 + opts.gossip * 2 : 1;
      for (const card of PLAYER_HAND) {
        const f = b.used[card];
        if (f) pool.push({ r: { subjectId: id, kind: 'used', card, n: f.n, t: f.t }, w: playerBoost / (1 + (now - f.t) / 60) });
      }
      if (b.stars) {
        pool.push({ r: { subjectId: id, kind: 'stars', v: b.stars.v, t: b.stars.t }, w: (0.6 * playerBoost) / (1 + (now - b.stars.t) / 60) });
      }
      if (b.total) {
        pool.push({ r: { subjectId: id, kind: 'total', v: b.total.v, t: b.total.t }, w: (0.7 * playerBoost) / (1 + (now - b.total.t) / 60) });
      }
      if (b.fought) {
        const f = b.fought;
        pool.push({ r: { subjectId: id, kind: 'fought', opponentId: f.opponentId, t: f.t }, w: (0.5 * playerBoost) / (1 + (now - f.t) / 60) });
      }
    }

    for (const rb of this.relationBeliefs.values()) {
      if (rb.subjectId === opts.excludeId || !opts.isAlive(rb.subjectId) || !opts.isAlive(rb.otherId)) continue;
      pool.push({ r: { kind: 'relation', ...rb }, w: 0.4 / (1 + (now - rb.t) / 90) });
    }

    if (opts.skip) {
      for (let i = pool.length - 1; i >= 0; i--) if (opts.skip(pool[i].r)) pool.splice(i, 1);
    }

    const picked: Rumor[] = [];
    while (picked.length < count && pool.length > 0) {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let x = Math.random() * total;
      let i = 0;
      while (i < pool.length - 1 && (x -= pool[i].w) > 0) i++;
      picked.push(pool[i].r);
      pool.splice(i, 1);
    }
    return picked;
  }
}

// 嘘をつく傾向（lie）が高いほど、噂の中身を変えてしまう（嘘・脚色）
export function distort(r: Rumor, lie: number, perType: number): Rumor {
  if (Math.random() >= lie) return r;
  if (r.kind === 'fought') return r; // 「誰と勝負していたか」はごまかさない
  if (r.kind === 'relation') return { ...r, good: !r.good }; // 仲の良し悪しを逆に言う
  if (r.kind === 'total') return { ...r, v: Math.max(0, r.v + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3))) };
  if (r.kind === 'stars') {
    const v = Math.max(0, r.v + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2)));
    return { ...r, v };
  }
  if (Math.random() < 0.5) {
    // 別のカードの話にすり替える
    const others = PLAYER_HAND.filter((c) => c !== r.card);
    return { ...r, card: others[Math.floor(Math.random() * others.length)] };
  }
  // 枚数をずらす（一部だけ正しい情報）
  const n = Math.min(perType, Math.max(0, r.n + (Math.random() < 0.5 ? -1 : 1)));
  return { ...r, n };
}
