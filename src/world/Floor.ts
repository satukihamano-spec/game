import * as THREE from 'three';
import { GameConfig } from '../core/GameConfig';
import type { Box2D } from '../sim/collision';

const PILLAR_SIZE = 1.6;

// 柱の位置：部屋の大きさに合わせて、だいたい14mおきに並べる（中央の表示板の周りは空ける）
function pillarPositions(size: number): { x: number; z: number }[] {
  const count = Math.max(2, Math.round(size / 14)); // 1列あたりの本数
  const step = size / count;
  const list: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      const x = -size / 2 + step * (i + 0.5);
      const z = -size / 2 + step * (j + 0.5);
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      list.push({ x, z });
    }
  }
  return list;
}

// フロア（床・壁・柱）を作るクラス。広さはゲームモードで決まる。
export class Floor {
  readonly group = new THREE.Group();
  readonly obstacles: Box2D[] = [];
  readonly playerStart = { x: 0, z: 6 };

  readonly size: number;

  constructor(size: number) {
    this.size = size;
    const half = size / 2;
    const h = GameConfig.wallHeight;
    const t = 0.5; // 壁の厚さ

    // 床
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ color: 0x3a3c40 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // 床の目地（無機質なタイルに見せる線）
    const grid = new THREE.GridHelper(size, size / 2, 0x55585e, 0x2c2e32);
    grid.position.y = 0.01;
    this.group.add(grid);

    // 壁（1つの材質を使い回して軽くする）
    // 手前の壁はカメラの視界をふさがないように低くする
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x6b6e75 });
    this.addBlock(0, -half - t / 2, size + t * 2, t, h, wallMaterial); // 奥
    this.addBlock(0, half + t / 2, size + t * 2, t, 0.4, wallMaterial); // 手前（低い）
    this.addBlock(-half - t / 2, 0, t, size, h, wallMaterial); // 左
    this.addBlock(half + t / 2, 0, t, size, h, wallMaterial); // 右

    // 柱
    const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x55585f });
    for (const p of pillarPositions(size)) {
      this.addBlock(p.x, p.z, PILLAR_SIZE, PILLAR_SIZE, h, pillarMaterial);
    }
  }

  // 箱を置き、同じ大きさの当たり判定を登録する
  private addBlock(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    material: THREE.Material,
  ): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, height / 2, z);
    this.group.add(mesh);
    this.obstacles.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    });
  }
}
