import { Rules } from '../data/rules';
import type { Rumor } from './Knowledge';

// 「プレイヤーが知っている情報」だけを管理する。
// NPCが内部で知っている情報（sim/Knowledge.ts）とは完全に別物。
// ここに入るのは、プレイヤーが実際に会話や自分の勝負で入手した「他のNPCについての情報」だけ。
// （プレイヤー自身についての情報は入れない）
//
// 次の状態を、それぞれ別々に管理している：
//   ① 情報を得た        … IntelItem（1件ずつ）
//   ② 情報が古くなった  … 入手時刻からの経過時間で毎回計算する（itemFreshness / freshness）
//   ③ フラグを付けた    … 情報1件ごとの flagged
//   ④ 対象NPCが消滅した … 人物ごとの gone（goneSubjects）
//   ⑤ プレイヤーが削除した … 一覧から取り除く（remove）。NPCやゲーム世界の情報は消えない
//   ⑥ 対象NPCが失格（星0で消滅）… そのNPCに関する情報とフラグを一覧から完全に消す（purgeSubject）

// 情報の種類（将来ここに種類を足していける）
//   rumor    … NPCとの会話で聞いた噂
//   battle   … 自分の勝負で見たこと
//   sighting … 近くで見かけたこと（勝負していた・消えた）
//   identity … 「あなた、○○ですよね？」が当たって、本人が認めたこと
export type IntelKind = 'rumor' | 'battle' | 'sighting' | 'identity';

export interface IntelItem {
  readonly id: number;
  readonly kind: IntelKind;
  readonly subjectIds: readonly string[]; // この情報の対象人物（1人以上のNPC）
  readonly source: string; // 誰から入手したか（NPC名 / "対戦" / "目撃"）
  readonly text: string;
  readonly obtainedAt: number; // 入手した時刻（ゲーム開始からの秒数）
  readonly timeLabel: string; // 入手したときの残り時間の表示（例 "08:12"）
  readonly rumor?: Rumor; // 元になった噂（NPCに「情報を教える」ときに使う）
  readonly detectedLie?: boolean; // プレイヤーが「嘘だ」と見抜いた情報
  flagged: boolean; // プレイヤーが重要だと判断してフラグを付けたか
}

// 情報の新しさ（ℹ マークの色・情報一覧の表示）
export type IntelFreshness = 'none' | 'fresh' | 'aging' | 'old';

// 情報一覧で人物ごとにまとめたもの
export interface IntelGroup {
  subjectId: string;
  items: IntelItem[]; // 新しい順
}

const MAX_ITEMS = 120;

export class PlayerIntel {
  private readonly items: IntelItem[] = []; // 新しい順
  private nextId = 1;
  // ④ もうフロアにいない人物
  private readonly goneSubjects = new Set<string>();

  // ───── ① 情報を得た ─────

  add(item: Omit<IntelItem, 'id' | 'flagged'>): IntelItem | null {
    if (item.subjectIds.length === 0) return null; // 対象のNPCがいない情報は登録しない
    const full: IntelItem = { ...item, id: this.nextId++, flagged: false };
    this.items.unshift(full);
    // 上限を超えたら、フラグの付いていない一番古い情報から捨てる
    if (this.items.length > MAX_ITEMS) {
      const i = this.items.map((x) => x.flagged).lastIndexOf(false);
      if (i >= 0) this.items.splice(i, 1);
    }
    return full;
  }

  // ⑤ プレイヤーが情報を削除する（その情報に付いていたフラグも一緒に消える）
  // 同じ人物について別の情報にフラグがあれば、その人物の ★ は残る
  remove(itemId: number): void {
    const i = this.items.findIndex((x) => x.id === itemId);
    if (i >= 0) this.items.splice(i, 1);
  }

  // ───── ② 情報が古くなった ─────

  // 人物ごとの ℹ マークの色：〜3分 緑 / 〜5分 黄 / 〜10分 赤 / それ以降は消える
  // その人物について「会話で入手した情報」のうち、一覧に残っている一番新しいものの時刻で決まる
  // （新しい情報を入手するとリセットされ、情報を削除すると反映される）
  freshness(subjectId: string, now: number): IntelFreshness {
    // 嘘と見抜いた情報は、手がかりとして数えない
    const latest = this.items.find((x) => x.kind === 'rumor' && !x.detectedLie && x.subjectIds.includes(subjectId)); // 新しい順
    return latest ? freshnessOfAge(now - latest.obtainedAt) : 'none';
  }

  // 情報1件ごとの新しさ（'none' = 10分以上たった古い情報）
  itemFreshness(item: IntelItem, now: number): IntelFreshness {
    return freshnessOfAge(now - item.obtainedAt);
  }

  // ───── ③ フラグ ─────

  toggleFlag(itemId: number): void {
    const item = this.items.find((x) => x.id === itemId);
    if (item) item.flagged = !item.flagged;
  }

  // マップ上のその人物にフラグを出すか（フラグ付きの情報があり、まだフロアにいる）
  // ※ 情報が古くなってもフラグは消さない。プレイヤーが外すまで残る
  isSubjectFlagged(subjectId: string): boolean {
    if (this.goneSubjects.has(subjectId)) return false;
    return this.items.some((x) => x.flagged && x.subjectIds.includes(subjectId));
  }

  // ───── ④ 対象NPCが消滅した ─────

  // ⑥ 失格（星0で消滅）したNPC：そのNPCに関する情報とフラグを一覧から完全に消す
  purgeSubject(subjectId: string): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].subjectIds.includes(subjectId)) this.items.splice(i, 1);
    }
    this.goneSubjects.add(subjectId);
  }

  // ある種類の、一番新しい情報（withinSec 秒以内。なければ null）。NPCから質問されたときの「本当の答え」に使う
  latestOfKind(kind: IntelKind, now: number, withinSec: number, excludeSubject?: string): IntelItem | null {
    return (
      this.items.find(
        (x) => x.kind === kind && now - x.obtainedAt < withinSec && !(excludeSubject && x.subjectIds.includes(excludeSubject)) && !x.subjectIds.some((id) => this.goneSubjects.has(id)),
      ) ?? null
    );
  }

  // その人物についての情報が何件あるか（正体を推測する手がかりに使う）
  countAbout(subjectId: string): number {
    return this.items.filter((x) => x.subjectIds.includes(subjectId)).length;
  }

  // 他のNPCに教えられる情報（会話で聞いた噂のうち、相手本人についてではないもの。新しい順）
  tellable(listenerId: string, limit: number): IntelItem[] {
    return this.items.filter((x) => x.rumor && !x.detectedLie && !x.subjectIds.includes(listenerId)).slice(0, limit);
  }

  markGone(subjectId: string): void {
    this.goneSubjects.add(subjectId);
  }

  isGone(subjectId: string): boolean {
    return this.goneSubjects.has(subjectId);
  }

  // ───── 情報一覧用 ─────

  get count(): number {
    return this.items.length;
  }

  // 人物ごとにまとめる。並び順：フラグ付きの人物 → 最近の情報がある人物 → 消えた人物
  groups(): IntelGroup[] {
    const map = new Map<string, IntelItem[]>();
    for (const item of this.items) {
      const key = item.subjectIds[0];
      let list = map.get(key);
      if (!list) map.set(key, (list = []));
      list.push(item);
    }
    const groups: IntelGroup[] = [...map].map(([subjectId, items]) => ({ subjectId, items }));
    const score = (g: IntelGroup): number => {
      const gone = this.goneSubjects.has(g.subjectId);
      const flagged = g.items.some((x) => x.flagged);
      return (gone ? 0 : 2e6) + (flagged ? 1e6 : 0) + g.items[0].obtainedAt;
    };
    return groups.sort((a, b) => score(b) - score(a));
  }
}

function freshnessOfAge(age: number): IntelFreshness {
  const m = Rules.infoMark;
  if (age < m.freshSec) return 'fresh';
  if (age < m.agingSec) return 'aging';
  if (age < m.expireSec) return 'old';
  return 'none';
}
