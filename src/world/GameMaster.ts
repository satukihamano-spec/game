import * as THREE from 'three';
import { createFigure } from './Figure';

// デスゲームの進行役。じゃんけんの参加者ではない（カードも星も持たない）。
// 勝利条件を満たしたプレイヤーは、この進行役に話しかけて勝利を確認してもらう必要がある。
// 見分けやすいように、黒いスーツ・サングラス・赤いネクタイ・金色の名札と足元の輪を付ける。
export class GameMaster {
  readonly object: THREE.Group;
  readonly name = '進行役';
  readonly x: number;
  readonly z: number;
  private readonly ring: THREE.Mesh;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    // 顔は肌色にして、黒いサングラスが目立つようにする
    this.object = createFigure(0x15151a, {
      gender: 'male',
      hairColor: 0x0a0a0a,
      skinColor: 0xd9b38c,
      sunglasses: true,
      tie: true,
    });
    this.object.position.set(x, 0, z);
    this.object.scale.setScalar(1.08); // 少しだけ大きく

    // 足元の金色の輪（遠くからでも見つけやすく）
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 32),
      new THREE.MeshBasicMaterial({ color: 0xd4af37 }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.object.add(this.ring);

    this.object.add(createLabel('進行役'));
  }

  // プレイヤーの方を向く
  lookAt(px: number, pz: number): void {
    this.object.rotation.y = Math.atan2(px - this.x, pz - this.z);
  }

  // 勝利条件を満たしたら、輪を点滅させて目立たせる
  setHighlight(on: boolean, time: number): void {
    this.ring.visible = !on || Math.floor(time * 3) % 2 === 0;
  }
}

function createLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(20, 16, 0, 0.8)';
    ctx.fillRect(40, 6, 176, 52);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 6, 176, 52);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.4;
  return sprite;
}
