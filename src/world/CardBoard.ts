import * as THREE from 'three';
import { CARDS, PLAYER_HAND, type CardId } from '../card/Card';
import { GameConfig } from '../core/GameConfig';

// カード残数掲示板（全部で3か所：中央・北・南）。
// フロア全体のカード残数（FloorSim.cardTotals）を表示する。
//
// 3つの掲示板は「1枚の絵（テクスチャ）」を共有している。
// 数字が変わったときにその1枚を描き直すだけなので、掲示板どうしの数字が食い違うことはなく、軽い。

// 中央の掲示板（床に埋め込み・大きめ）の大きさ（m）
export const CENTER_BOARD = { width: 7, depth: 3.5 };
// 壁の掲示板の大きさ（m）。近づけば読める程度
const WALL_BOARD = { width: 3.4, height: 1.7 };

export class CardBoards {
  readonly group = new THREE.Group();
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly texture: THREE.CanvasTexture;
  private last = '';

  constructor(roomSize: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    this.ctx = canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: this.texture });

    // ① 中央：床に寝かせた大きな掲示板（文字の上が奥を向く）
    const center = new THREE.Mesh(new THREE.PlaneGeometry(CENTER_BOARD.width, CENTER_BOARD.depth), material);
    center.rotation.x = -Math.PI / 2;
    center.position.set(0, 0.015, 0);
    this.group.add(center);

    // ②③ 北と南の壁の中央。カメラは斜め上から見下ろしているので、
    // 壁の掲示板はどれもカメラの方へ傾けて、どの壁でも文字が読めるようにする
    const half = roomSize / 2;
    const o = GameConfig.cameraOffset;
    const tilt = -Math.atan2(o.y, o.z); // カメラの方を向く角度
    const wallGeometry = new THREE.PlaneGeometry(WALL_BOARD.width, WALL_BOARD.height);
    const frameGeometry = new THREE.BoxGeometry(WALL_BOARD.width + 0.2, WALL_BOARD.height + 0.2, 0.1);
    const postGeometry = new THREE.BoxGeometry(0.15, 1, 0.15);
    const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x222228 });

    const spots = [
      { name: '北', x: 0, z: -half + 0.9, y: 2.2 },
      { name: '南', x: 0, z: half - 1.2, y: 1.5 }, // 南の壁は低いので、少し低めの位置に立てる
    ];
    for (const s of spots) {
      const sign = new THREE.Group();
      sign.position.set(s.x, s.y, s.z);
      sign.rotation.x = tilt; // まっすぐ立てた板を、上を向くように後ろへ倒してカメラの方へ向ける

      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = -0.06;
      const panel = new THREE.Mesh(wallGeometry, material);
      sign.add(frame, panel);
      this.group.add(sign);

      // 支柱（掲示板を支える棒）
      const post = new THREE.Mesh(postGeometry, frameMaterial);
      post.scale.y = s.y - 0.4;
      post.position.set(s.x, (s.y - 0.4) / 2, s.z - 0.15);
      this.group.add(post);
    }
  }

  // フロア全体の残数が変わったときだけ描き直す（1回描けば3か所すべてに反映される）
  update(totals: Readonly<Record<CardId, number>>): void {
    const key = `${totals.rock},${totals.scissors},${totals.paper}`;
    if (key === this.last || !this.ctx) return;
    this.last = key;

    const c = this.ctx;
    c.fillStyle = '#07090c';
    c.fillRect(0, 0, 512, 256);
    c.strokeStyle = '#ff3b3b';
    c.lineWidth = 8;
    c.strokeRect(6, 6, 500, 244);

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ff6a6a';
    c.font = 'bold 34px sans-serif';
    c.fillText('CARD REMAINING', 256, 44);

    PLAYER_HAND.forEach((id, i) => {
      const cx = 96 + i * 160;
      c.fillStyle = '#f2f2f2';
      c.font = 'bold 32px sans-serif';
      c.fillText(CARDS[id].name, cx, 100);
      c.fillStyle = '#ffd34d';
      c.font = 'bold 92px monospace';
      c.fillText(String(totals[id]), cx, 182);
    });
    this.texture.needsUpdate = true;
  }
}
