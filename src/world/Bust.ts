import * as THREE from 'three';
import { EXPRESSIONS, type ExpressionDef, type ExpressionId } from '../data/expressions';
import type { Gender } from '../data/speech';

// 対戦演出で使う「上半身のアップ用」の人型。顔（目・眉・口）があり、表情を変えられる。
// マップ上の人型（world/Figure.ts）と同じ服の色・髪の色・性別で作るので、同じ人物だと分かる。
// 対戦演出の間だけ使うので、マップの描画の重さには影響しない。

const SKIN = 0xf1d3b8;
const HEAD_R = 0.28; // 頭の半径

// 顔の表面の奥行き（頭は球なので、中心から離れるほど奥に下がる）。パーツを表面のすぐ上に置くために使う
function surfaceZ(dx: number, dy: number, lift = 0.006): number {
  return Math.sqrt(Math.max(0, HEAD_R * HEAD_R - dx * dx - dy * dy)) + lift;
}

// 形は全員で使い回す
const G = {
  body: new THREE.CapsuleGeometry(0.35, 0.8, 4, 16),
  neck: new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10),
  head: new THREE.SphereGeometry(HEAD_R, 20, 16),
  hairTop: new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hairBack: new THREE.BoxGeometry(0.52, 0.5, 0.14),
  eye: new THREE.SphereGeometry(0.034, 10, 8),
  brow: new THREE.BoxGeometry(0.09, 0.018, 0.02),
  mouthArc: new THREE.TorusGeometry(0.05, 0.01, 6, 14, Math.PI),
  mouthFlat: new THREE.BoxGeometry(0.08, 0.013, 0.012),
  mouthOpen: new THREE.SphereGeometry(0.04, 12, 8),
  cheek: new THREE.CircleGeometry(0.04, 12),
  tear: new THREE.BoxGeometry(0.018, 0.07, 0.01),
};
const M = {
  dark: new THREE.MeshBasicMaterial({ color: 0x1a1414 }),
  mouth: new THREE.MeshBasicMaterial({ color: 0x5a1a1a }),
  cheek: new THREE.MeshBasicMaterial({ color: 0xff7a8a, transparent: true, opacity: 0.55 }),
  tear: new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.85 }),
  skin: new THREE.MeshLambertMaterial({ color: SKIN }),
};

// 汗・怒りマーク・きらきら（絵文字のスプライト。1つの画像を全員で使い回す）
const emojiMaterials = new Map<string, THREE.SpriteMaterial>();
function emoji(char: string): THREE.SpriteMaterial {
  let m = emojiMaterials.get(char);
  if (!m) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '100px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, 64, 70);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    emojiMaterials.set(char, m);
  }
  return m;
}

export interface BustLook {
  color: number; // 服の色
  hairColor: number;
  gender: Gender;
}

export class Bust {
  readonly object = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly headPivot = new THREE.Group(); // 首から上（うつむく・見下すなどで傾ける）
  private readonly eyes: THREE.Mesh[] = [];
  private readonly brows: THREE.Mesh[] = [];
  private readonly mouths: Record<'smile' | 'frown' | 'flat' | 'open', THREE.Mesh>;
  private readonly cheeks: THREE.Mesh[] = [];
  private readonly tears: THREE.Mesh[] = [];
  private readonly sweat: THREE.Sprite;
  private readonly anger: THREE.Sprite;
  private readonly sparkle: THREE.Sprite;
  private readonly bodyMaterial: THREE.MeshLambertMaterial;
  private readonly hairMaterial: THREE.MeshLambertMaterial;

  private expr: ExpressionDef = EXPRESSIONS.neutral;
  private exprId: ExpressionId = 'neutral';
  private exprTime = 0; // 表情が変わってからの時間（動きの強さを時間とともに弱める）
  private talkUntil = 0; // この時刻まで口を動かす（しゃべっている）
  private time = 0;
  private readonly baseYaw: number;

  constructor(look: BustLook, yaw: number) {
    this.baseYaw = yaw;
    this.bodyMaterial = new THREE.MeshLambertMaterial({ color: look.color });
    this.body = new THREE.Mesh(G.body, this.bodyMaterial);
    this.body.position.y = 0.75;
    if (look.gender === 'female') this.body.scale.set(0.9, 0.97, 0.9);
    this.object.add(this.body);

    const neck = new THREE.Mesh(G.neck, M.skin);
    neck.position.y = 1.27;
    this.object.add(neck);

    // 首から上
    this.headPivot.position.y = 1.3;
    this.object.add(this.headPivot);
    const head = new THREE.Mesh(G.head, M.skin);
    head.position.y = 0.25;
    this.headPivot.add(head);

    const hair = (this.hairMaterial = new THREE.MeshLambertMaterial({ color: look.hairColor }));
    const top = new THREE.Mesh(G.hairTop, hair);
    top.position.y = 0.28;
    top.rotation.x = -0.25; // 少し前に傾けて前髪っぽく
    this.headPivot.add(top);
    if (look.gender === 'female') {
      const back = new THREE.Mesh(G.hairBack, hair);
      back.position.set(0, 0.12, -0.2);
      this.headPivot.add(back);
    }

    // 顔のパーツ（頭の中心 y=0.25、正面は +Z）
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(G.eye, M.dark);
      eye.position.set(side * 0.095, 0.27, surfaceZ(0.095, 0.02, -0.004));
      this.eyes.push(eye);
      this.headPivot.add(eye);

      const brow = new THREE.Mesh(G.brow, M.dark);
      brow.position.set(side * 0.095, 0.34, surfaceZ(0.095, 0.09, 0.004));
      this.brows.push(brow);
      this.headPivot.add(brow);

      const cheek = new THREE.Mesh(G.cheek, M.cheek);
      cheek.position.set(side * 0.15, 0.2, surfaceZ(0.15, -0.05, 0.004));
      cheek.rotation.y = side * 0.55;
      this.cheeks.push(cheek);
      this.headPivot.add(cheek);

      const tear = new THREE.Mesh(G.tear, M.tear);
      tear.position.set(side * 0.1, 0.2, surfaceZ(0.1, -0.05, 0.006));
      this.tears.push(tear);
      this.headPivot.add(tear);
    }

    const smile = new THREE.Mesh(G.mouthArc, M.mouth);
    smile.rotation.z = Math.PI; // 下向きの弧 ＝ 笑った口
    const frown = new THREE.Mesh(G.mouthArc, M.mouth);
    const flat = new THREE.Mesh(G.mouthFlat, M.mouth);
    const open = new THREE.Mesh(G.mouthOpen, M.mouth);
    open.scale.set(1, 0.7, 0.4);
    this.mouths = { smile, frown, flat, open };
    for (const m of Object.values(this.mouths)) {
      // 口の弧の一番出っ張る所（上下 0.05）も頭に埋まらない奥行きに置く
      m.position.set(0, 0.14, surfaceZ(0, -0.06, 0.004));
      this.headPivot.add(m);
    }

    this.sweat = this.addSprite('💦', 0.24, 0.42, 0.12, 0.16);
    this.anger = this.addSprite('💢', -0.24, 0.5, 0.1, 0.18);
    this.sparkle = this.addSprite('✨', 0.26, 0.5, 0.05, 0.2);

    this.object.rotation.y = yaw;
    this.setExpression('neutral');
  }

  private addSprite(char: string, x: number, y: number, z: number, size: number): THREE.Sprite {
    const s = new THREE.Sprite(emoji(char));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    s.renderOrder = 10;
    this.headPivot.add(s);
    return s;
  }

  get expression(): ExpressionId {
    return this.exprId;
  }

  setExpression(id: ExpressionId): void {
    const e: ExpressionDef = EXPRESSIONS[id];
    this.expr = e;
    this.exprId = id;
    this.exprTime = 0;
    // 眉：内側（顔の中心側）が下がる向きを ＋ にする
    this.brows[0].rotation.z = -e.brow;
    this.brows[1].rotation.z = e.brow;
    for (const b of this.brows) {
      b.position.y = 0.34 + e.browY;
      b.position.z = surfaceZ(0.095, 0.09 + e.browY, 0.004);
    }
    for (const eye of this.eyes) eye.scale.set(1, e.eye, 0.5);
    for (const m of Object.values(this.mouths)) m.visible = false;
    const mouth =
      e.mouth === 'grin' ? this.mouths.smile
      : e.mouth === 'wavy' ? this.mouths.flat
      : this.mouths[e.mouth];
    mouth.visible = true;
    const s = e.mouthSize * (e.mouth === 'grin' ? 1.25 : 1);
    mouth.scale.set(s, e.mouth === 'grin' ? 0.6 : 1, 1);
    if (e.mouth === 'open') mouth.scale.set(s, 0.7 * s, 0.4);
    mouth.rotation.z = e.mouth === 'smile' || e.mouth === 'grin' ? Math.PI : e.mouth === 'wavy' ? 0.25 : 0;
    for (const c of this.cheeks) c.visible = !!e.blush;
    for (const t of this.tears) t.visible = !!e.tears;
    this.sweat.visible = !!e.sweat;
    this.anger.visible = !!e.anger;
    this.sparkle.visible = !!e.sparkle;
  }

  // しゃべり始めた（口を少しの間動かす）
  talk(seconds: number): void {
    this.talkUntil = this.time + seconds;
  }

  // 毎フレームの小さな動き（呼吸・表情ごとの動き・しゃべる口）。三角関数だけなので軽い
  update(dt: number): void {
    this.time += dt;
    this.exprTime += dt;
    const t = this.time;
    const e = this.expr;
    const fade = Math.max(0, 1 - this.exprTime / 1.2); // 表情が変わった直後ほど大きく動く

    let x = 0;
    let y = Math.sin(t * 2) * 0.008; // 呼吸
    let yawAdd = 0;
    switch (e.motion) {
      case 'bounce':
        y += Math.abs(Math.sin(t * 9)) * 0.05 * fade;
        break;
      case 'shake':
        x += Math.sin(t * 45) * 0.025 * fade;
        break;
      case 'tremble':
        x += Math.sin(t * 60) * 0.006;
        break;
      case 'droop':
        y -= 0.03 * (1 - fade);
        break;
      case 'lean':
        yawAdd = 0.12 * (1 - fade);
        break;
    }
    this.object.position.x = x;
    this.object.position.y = y;
    this.object.rotation.y = this.baseYaw + yawAdd;
    this.headPivot.rotation.x = e.headTilt + Math.sin(t * 1.3) * 0.02;

    // しゃべっている間は口をぱくぱく
    const talking = t < this.talkUntil;
    const open = this.mouths.open;
    if (talking && e.mouth !== 'open') {
      const k = Math.abs(Math.sin(t * 16));
      open.visible = k > 0.5;
      open.scale.set(0.8 * e.mouthSize, 0.5 * k, 0.4);
    } else if (e.mouth !== 'open') {
      open.visible = false;
    }

    // 汗・怒りマーク・きらきらは少しゆらす
    this.sweat.position.y = 0.42 - ((t * 0.15) % 0.08);
    const pulse = 1 + Math.sin(t * 8) * 0.12;
    this.anger.scale.set(0.18 * pulse, 0.18 * pulse, 1);
    this.sparkle.material.rotation = t * 0.8;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.bodyMaterial.dispose();
    this.hairMaterial.dispose();
  }
}
