import * as THREE from 'three';
import { GameConfig } from '../core/GameConfig';
import type { MoveVector } from '../input/InputManager';
import { pushOutOfBox, pushOutOfCircle, type Box2D, type Circle2D } from '../sim/collision';
import { createFigure } from '../world/Figure';

// プレイヤーの見た目と移動
export class Player {
  readonly object: THREE.Group;

  constructor(start: { x: number; z: number }) {
    this.object = createFigure(0xd8c27a);
    this.object.position.set(start.x, 0, start.z);
    this.object.rotation.y = Math.PI; // 最初は奥を向く
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  // 入力に合わせて移動し、壁やNPCにめり込まないように押し戻す
  update(dt: number, move: MoveVector, boxes: Box2D[], circles: Circle2D[]): void {
    if (move.x === 0 && move.y === 0) return;

    const pos = this.object.position;
    // 画面の上方向（奥）は3D空間の -Z 方向
    const dx = move.x * GameConfig.moveSpeed * dt;
    const dz = -move.y * GameConfig.moveSpeed * dt;
    pos.x += dx;
    pos.z += dz;

    // 進む方向を向く
    this.object.rotation.y = Math.atan2(dx, dz);

    const r = GameConfig.playerRadius;
    for (const b of boxes) pushOutOfBox(pos, r, b);
    for (const c of circles) pushOutOfCircle(pos, r, c);
  }
}
