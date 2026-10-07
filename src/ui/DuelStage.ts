import { MOOD_TINT, tintOf, type ExpressionId } from '../data/expressions';
import { PLAYER_PORTRAIT_ID, PORTRAIT_OF, portraitUrls, type PortraitExpression } from '../data/portraits';
import type { Gender } from '../data/speech';
import { paintPortrait, type PortraitLook } from './PortraitArt';

// 顔アップ演出（対戦のとき・「情報を聞く」とき）。
//   マップ上の3Dモデルを拡大するのではなく、2Dの顔画像を画面に大きく表示する。
//     画像 … public/portraits/<顔ID>/<表情>.png（なければ自動で描いた顔：ui/PortraitArt.ts）
//   口は動かさない（口パクなし）。表情は目・眉・顔全体で表す。
//
//   縦画面（スマホ）：【相手の顔アップ（大）】→【会話】→【選択肢】
//     対戦のときは、自分の顔を左下に小さく出し、VS を表示する
//     「情報を聞く」ときは、相手の顔だけを出す
//   横画面・PC：相手の顔を中央に大きく（左右は暗い背景）
//
//   演出の間はマップ（3D）を描かないので、スマホの負荷は増えない。

export interface FaceLook {
  color: number; // 服の色（マップ上の3Dモデルと同じ）
  hairColor: number;
  gender: Gender;
}

export interface DuelInfo {
  npcName: string;
  npcLook: FaceLook;
  npcPortraitId: string; // 顔ID（public/portraits/<顔ID>/）
  npcStars: number;
  npcBadge: string | null; // 正体を見破った特殊NPCなら「玄人」など。見破っていなければ null
  npcNameColor: string; // 嘘を見抜いた警戒度の色（マップと同じ）
  playerLook: FaceLook;
  playerStars: number;
}

export type StageMode = 'battle' | 'info';
type Who = 'npc' | 'player';

// 画像があるかどうかの記録（同じ画像を何度も探さない）
const imageCache = new Map<string, Promise<boolean>>();
const imageKnown = new Map<string, boolean>();
function probe(url: string): Promise<boolean> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = url;
    }).then((ok) => {
      imageKnown.set(url, ok);
      return ok;
    });
    imageCache.set(url, p);
  }
  return p;
}

// 1人分の顔（画像があれば画像、なければ自動で描いた顔）
class PortraitView {
  readonly el: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly art: HTMLDivElement;
  private look: PortraitLook | null = null;
  private expr: PortraitExpression = 'neutral';
  private token = 0;

  constructor(className: string) {
    this.el = div(`pv ${className}`);
    this.img = document.createElement('img');
    this.img.className = 'pv-img hidden';
    this.img.alt = '';
    this.img.decoding = 'async';
    this.art = div('pv-art');
    this.el.append(this.art, this.img);
  }

  set(look: PortraitLook, expr: PortraitExpression): void {
    this.look = look;
    this.expr = expr;
    this.render(true);
  }

  setExpression(expr: PortraitExpression): void {
    if (expr === this.expr) return;
    this.expr = expr;
    this.render(false);
    // 表情が変わった瞬間に、顔が少しだけ反応する（CSS アニメーション）
    this.el.classList.remove('pv-react');
    void this.el.offsetWidth;
    this.el.classList.add('pv-react');
  }

  private render(first: boolean): void {
    const look = this.look;
    if (!look) return;
    const token = ++this.token;
    const urls = portraitUrls(look.id, this.expr);
    // すでに画像があると分かっていれば、すぐにそれを使う
    const known = urls.find((u) => imageKnown.get(u) === true);
    if (known && urls.slice(0, urls.indexOf(known)).every((u) => imageKnown.get(u) === false)) {
      this.showImage(known);
      return;
    }
    // まず自動で描いた顔を出し（待たせない）、画像が見つかったら差し替える
    if (first || this.img.classList.contains('hidden')) this.showArt();
    void (async () => {
      for (const u of urls) {
        if (await probe(u)) {
          if (token === this.token) this.showImage(u);
          return;
        }
      }
      if (token === this.token) this.showArt();
    })();
  }

  private showImage(url: string): void {
    if (this.img.getAttribute('src') !== url) this.img.src = url;
    this.img.classList.remove('hidden');
    this.art.classList.add('hidden');
  }

  private showArt(): void {
    if (!this.look) return;
    this.art.innerHTML = paintPortrait(this.look, this.expr);
    // まばたきのタイミングを人ごとにずらす
    this.art.style.setProperty('--blink-delay', `${(Math.random() * 3).toFixed(2)}s`);
    this.art.classList.remove('hidden');
    this.img.classList.add('hidden');
  }
}

export class DuelStage {
  private readonly overlay: HTMLDivElement;
  private readonly npcStage: HTMLDivElement;
  private readonly playerStage: HTMLDivElement;
  private readonly npcView = new PortraitView('pv-npc');
  private readonly playerView = new PortraitView('pv-player');
  private readonly npcPlate: HTMLDivElement;
  private readonly playerPlate: HTMLDivElement;
  private readonly vs: HTMLDivElement;
  private readonly flash: HTMLDivElement;
  active = false;
  mode: StageMode = 'battle';

  constructor(uiRoot: HTMLElement) {
    this.overlay = div('duel-overlay hidden');
    this.npcStage = div('duel-stage-npc');
    this.npcStage.append(this.npcView.el);
    this.playerStage = div('duel-stage-player');
    this.playerStage.append(this.playerView.el);
    this.npcPlate = div('duel-plate duel-plate-npc');
    this.playerPlate = div('duel-plate duel-plate-player');
    this.vs = div('duel-vs');
    this.vs.textContent = 'VS';
    this.flash = div('duel-flash');
    this.overlay.append(this.npcStage, this.playerStage, this.npcPlate, this.playerPlate, this.vs, this.flash);
    uiRoot.prepend(this.overlay); // 会話ウィンドウやカード画面より下に重ねる
  }

  // 顔アップを始める（マップから切り替え）。mode = 'battle'（対戦）／ 'info'（情報を聞く：相手の顔だけ）
  enter(info: DuelInfo, mode: StageMode = 'battle'): void {
    this.mode = mode;
    this.npcView.set(
      { id: info.npcPortraitId, gender: info.npcLook.gender, clothes: info.npcLook.color, hair: info.npcLook.hairColor },
      'neutral',
    );
    this.playerView.set(
      { id: PLAYER_PORTRAIT_ID, gender: info.playerLook.gender, clothes: info.playerLook.color, hair: info.playerLook.hairColor },
      'neutral',
    );
    this.setPlates(info);
    this.overlay.classList.toggle('is-info', mode === 'info');
    this.overlay.classList.toggle('is-battle', mode === 'battle');
    this.setTint('neutral');
    this.active = true;
    this.show();
    // 切り替えの光と、顔・名前の登場（CSS アニメーションを最初から再生）
    this.overlay.classList.remove('is-entering');
    void this.overlay.offsetWidth;
    this.overlay.classList.add('is-entering');
  }

  // 情報を聞く画面から対戦へ移るときなど、表示のしかただけを切り替える
  setMode(mode: StageMode): void {
    this.mode = mode;
    this.overlay.classList.toggle('is-info', mode === 'info');
    this.overlay.classList.toggle('is-battle', mode === 'battle');
  }

  // 名前・星・正体の表示を更新する（対戦後は星が変わるので呼び直す）
  setPlates(info: Pick<DuelInfo, 'npcName' | 'npcStars' | 'npcBadge' | 'npcNameColor' | 'playerStars'>): void {
    const name = span('duel-name', info.npcName);
    name.style.color = info.npcNameColor;
    this.npcPlate.replaceChildren(name, span('duel-stars', `⭐${info.npcStars}`));
    if (info.npcBadge) this.npcPlate.append(span('duel-badge', info.npcBadge));
    this.playerPlate.replaceChildren(span('duel-name', 'あなた'), span('duel-stars', `⭐${info.playerStars}`));
  }

  // 表情を変える（会話の表情14種類 → 顔画像の表情8種類に置き換えて表示）
  setExpression(who: Who, id: ExpressionId): void {
    const expr = PORTRAIT_OF[id] ?? 'neutral';
    if (who === 'npc') {
      this.npcView.setExpression(expr);
      this.setTint(tintOf(id));
    } else {
      this.playerView.setExpression(expr);
    }
  }

  // どちらがしゃべっているか（しゃべっている方を明るく強調する。口は動かさない）
  speak(who: Who, _seconds = 0): void {
    this.overlay.classList.toggle('npc-speaking', who === 'npc');
    this.overlay.classList.toggle('player-speaking', who === 'player');
  }

  // カード勝負の間は隠す
  hide(): void {
    this.overlay.classList.add('hidden');
  }

  show(): void {
    this.overlay.classList.remove('hidden');
  }

  exit(): void {
    this.active = false;
    this.overlay.classList.add('hidden');
    this.overlay.classList.remove('is-entering', 'npc-speaking', 'player-speaking');
  }

  // 3Dを使わないので、毎フレームの処理はない（まばたきなどは CSS で動く）
  update(_dt: number): void {}

  // 背景の色（敵意 → 赤、友好 → 青緑、それ以外 → 紫）
  private setTint(kind: keyof typeof MOOD_TINT): void {
    this.overlay.style.setProperty('--duel-tint', `#${MOOD_TINT[kind].toString(16).padStart(6, '0')}`);
  }
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}
