import * as THREE from 'three';
import type { Agent } from '../sim/Agent';
import type { IntelFreshness } from '../sim/PlayerIntel';
import { createFigure } from '../world/Figure';

// NPC 1人分の「見た目」。中身（星・カード・行動）は sim/Agent.ts が持つ。

const HAIR_COLORS = [0x2a1d14, 0x111111, 0x5a3a22, 0x7a6a50, 0x3a2a3a, 0x8a8a8a];
const COLORS = [0x6f7f8f, 0xc98b8b, 0x2a2a30, 0x8f6f4f, 0x5f8f6f, 0x7f6f9f, 0x9f8f5f, 0x4f6f8f, 0x8f4f5f, 0x6f8f8f];

// 頭の上に出すマーク（全員で使い回す）
export type StatusIcon = 'none' | 'talk' | 'battle' | 'alert';
const ICON_TEXT: Record<Exclude<StatusIcon, 'none'>, string> = { talk: '💬', battle: '⚔️', alert: '❗' };
let iconMaterials: Record<Exclude<StatusIcon, 'none'>, THREE.SpriteMaterial> | null = null;
// ℹ マーク（プレイヤーがこの人物についての情報を持っている印）。
// 情報の新しさで色が変わる：緑 = 新しい / 黄 = 古くなってきた / 赤 = かなり古い
type InfoColor = Exclude<IntelFreshness, 'none'>;
const INFO_COLORS: Record<InfoColor, string> = { fresh: '#22c55e', aging: '#facc15', old: '#ef4444' };
let infoMaterials: Record<InfoColor, THREE.SpriteMaterial> | null = null;

function getInfoMaterials(): Record<InfoColor, THREE.SpriteMaterial> {
  if (!infoMaterials) {
    const make = (color: string): THREE.SpriteMaterial => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = color === INFO_COLORS.aging ? '#222222' : '#ffffff'; // 黄色の上は黒い文字で読みやすく
        ctx.font = 'bold 40px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('i', 32, 35);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.SpriteMaterial({ map: tex, depthTest: false });
    };
    infoMaterials = { fresh: make(INFO_COLORS.fresh), aging: make(INFO_COLORS.aging), old: make(INFO_COLORS.old) };
  }
  return infoMaterials;
}

// ★ フラグ（プレイヤーが「この人物の情報は重要」と判断した印）
let flagMaterial: THREE.SpriteMaterial | null = null;
function getFlagMaterial(): THREE.SpriteMaterial {
  if (!flagMaterial) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 32, 34);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    flagMaterial = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  }
  return flagMaterial;
}

function getIconMaterials(): Record<Exclude<StatusIcon, 'none'>, THREE.SpriteMaterial> {
  if (!iconMaterials) {
    const make = (text: string): THREE.SpriteMaterial => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 36);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.SpriteMaterial({ map: tex, depthTest: false });
    };
    iconMaterials = { talk: make(ICON_TEXT.talk), battle: make(ICON_TEXT.battle), alert: make(ICON_TEXT.alert) };
  }
  return iconMaterials;
}

export class NPCView {
  readonly agent: Agent;
  // 見た目の色（対戦演出のアップ画面でも同じ色で描くため）
  readonly bodyColor: number;
  readonly hairColor: number;
  readonly object: THREE.Group;
  private readonly bodyMaterial: THREE.Material; // このNPC専用の材質（片付けるときに解放する）
  private readonly ring: THREE.Mesh;
  private readonly label: THREE.Sprite;
  private readonly labelCanvas: HTMLCanvasElement;
  private nameColor = '#f2f2f2'; // 名前の色（嘘を見抜いた警戒度で赤くなる）
  private readonly icon: THREE.Sprite;
  private currentIcon: StatusIcon = 'none';
  // ℹ マーク：プレイヤーがこの人物について会話で情報を入手したときに出る
  readonly infoMark: THREE.Sprite;
  private currentInfo: IntelFreshness = 'none';
  // ★ フラグ。ℹ とは別の意味（鮮度ではなく「重要」）なので、並べて同時に表示できる
  readonly flagMark: THREE.Sprite;
  private flagged = false;

  constructor(agent: Agent, index: number) {
    this.agent = agent;
    // 性別で髪型・体格が変わる
    this.bodyColor = COLORS[index % COLORS.length];
    this.hairColor = HAIR_COLORS[index % HAIR_COLORS.length];
    this.object = createFigure(this.bodyColor, {
      gender: agent.gender,
      hairColor: this.hairColor,
    });
    this.bodyMaterial = (this.object.children[0] as THREE.Mesh).material as THREE.Material;

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd34d }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.object.add(this.ring);

    this.labelCanvas = document.createElement('canvas');
    this.label = createNameLabel(this.labelCanvas, agent.name, this.nameColor);
    this.object.add(this.label);

    this.icon = new THREE.Sprite(getIconMaterials().talk);
    this.icon.scale.set(0.8, 0.8, 1);
    this.icon.position.y = 3.6;
    this.icon.visible = false;
    this.object.add(this.icon);

    this.infoMark = new THREE.Sprite(getInfoMaterials().fresh);
    this.infoMark.scale.set(0.6, 0.6, 1);
    this.infoMark.position.y = 2.9;
    this.infoMark.visible = false;
    this.object.add(this.infoMark);

    this.flagMark = new THREE.Sprite(getFlagMaterial());
    this.flagMark.scale.set(0.6, 0.6, 1);
    this.flagMark.position.y = 2.9;
    this.flagMark.visible = false;
    this.object.add(this.flagMark);

    this.sync();
  }

  // 計算上の位置・向きを見た目に反映する
  sync(): void {
    this.object.position.set(this.agent.x, 0, this.agent.z);
    this.object.rotation.y = this.agent.facing;
  }

  setHighlighted(on: boolean): void {
    this.ring.visible = on;
  }

  // ───── 退場演出（星0で失格／カードを使い切って退場）─────
  // 軽くするため、大きさと位置と足元の輪だけを動かす（約1.2秒）
  private exitStart = -1;
  private exitKind: 'eliminated' | 'finished' = 'eliminated';
  static readonly EXIT_SEC = 1.2;

  get exiting(): boolean {
    return this.exitStart >= 0;
  }

  startExit(kind: 'eliminated' | 'finished', now: number): void {
    this.exitStart = now;
    this.exitKind = kind;
    this.label.visible = false;
    this.icon.visible = false;
    this.infoMark.visible = false;
    this.flagMark.visible = false;
    const ringMat = this.ring.material as THREE.MeshBasicMaterial;
    ringMat.color.setHex(kind === 'eliminated' ? 0xff2a2a : 0xd4af37); // 失格は赤、退場は金
    this.ring.visible = true;
  }

  // 演出を進める。終わったら true
  updateExit(now: number): boolean {
    const t = Math.min(1, (now - this.exitStart) / NPCView.EXIT_SEC);
    const body = 1 - t;
    if (this.exitKind === 'eliminated') {
      // その場で崩れるように沈んで消える。足元の赤い輪が広がる
      this.object.scale.set(1 + t * 0.3, Math.max(0.01, body), 1 + t * 0.3);
      this.object.position.y = -t * 0.3;
    } else {
      // 静かに浮き上がって消える。足元の金の輪が広がる
      this.object.scale.setScalar(Math.max(0.01, body));
      this.object.position.y = t * 1.2;
    }
    this.ring.scale.setScalar(1 + t * 2.5);
    return t >= 1;
  }

  setInfoMark(freshness: IntelFreshness): void {
    if (freshness === this.currentInfo) return;
    this.currentInfo = freshness;
    this.infoMark.visible = freshness !== 'none';
    if (freshness !== 'none') this.infoMark.material = getInfoMaterials()[freshness];
    this.layoutMarks();
  }

  // 名前の色を変える（色が変わったときだけ描き直す。描き直しは軽いが、毎フレームはしない）
  setNameColor(color: string): void {
    if (color === this.nameColor) return;
    this.nameColor = color;
    const tex = this.label.material.map;
    if (!tex) return;
    drawNameLabel(this.labelCanvas, this.agent.name, color);
    tex.needsUpdate = true;
  }

  setFlag(on: boolean): void {
    if (on === this.flagged) return;
    this.flagged = on;
    this.flagMark.visible = on;
    this.layoutMarks();
  }

  // ℹ と ★ が両方あるときは「ℹ ★」と横に並べ、片方だけなら真ん中に置く
  // （center は画面上の基準点なので、NPCがどちらを向いていても左右が入れ替わらない）
  private layoutMarks(): void {
    const both = this.infoMark.visible && this.flagMark.visible;
    this.infoMark.center.set(both ? 1.05 : 0.5, 0.5);
    this.flagMark.center.set(both ? -0.05 : 0.5, 0.5);
  }

  setIcon(icon: StatusIcon): void {
    if (icon === this.currentIcon) return;
    this.currentIcon = icon;
    this.icon.visible = icon !== 'none';
    if (icon !== 'none') this.icon.material = getIconMaterials()[icon];
  }

  // フロアから消えるときに、使っていたメモリを解放する
  dispose(): void {
    this.object.removeFromParent();
    this.label.material.map?.dispose();
    this.label.material.dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.bodyMaterial.dispose(); // 髪などの共有の材質は他のNPCも使っているので解放しない
  }
}

// 頭の上に名前を表示する板（文字を画像にして貼る）
function drawNameLabel(canvas: HTMLCanvasElement, name: string, color: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(48, 8, 160, 48);
  ctx.fillStyle = color;
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 33);
}

function createNameLabel(canvas: HTMLCanvasElement, name: string, color: string): THREE.Sprite {
  canvas.width = 256;
  canvas.height = 64;
  drawNameLabel(canvas, name, color);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.3;
  return sprite;
}
