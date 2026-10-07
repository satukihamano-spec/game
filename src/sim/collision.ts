// 上から見た当たり判定（3Dライブラリを使わない計算だけのファイル）

export interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Circle2D {
  x: number;
  z: number;
  radius: number;
}

export interface Point2D {
  x: number;
  z: number;
}

// 半径 r の円が長方形にめり込んでいたら、外へ押し出す
export function pushOutOfBox(pos: Point2D, r: number, b: Box2D): void {
  const nearestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
  const nearestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
  const dx = pos.x - nearestX;
  const dz = pos.z - nearestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= r * r) return;

  if (distSq > 0) {
    const dist = Math.sqrt(distSq);
    pos.x = nearestX + (dx / dist) * r;
    pos.z = nearestZ + (dz / dist) * r;
  } else {
    // 中心が長方形の中に入ってしまった場合：一番近い辺の外へ出す
    const toLeft = pos.x - b.minX;
    const toRight = b.maxX - pos.x;
    const toTop = pos.z - b.minZ;
    const toBottom = b.maxZ - pos.z;
    const min = Math.min(toLeft, toRight, toTop, toBottom);
    if (min === toLeft) pos.x = b.minX - r;
    else if (min === toRight) pos.x = b.maxX + r;
    else if (min === toTop) pos.z = b.minZ - r;
    else pos.z = b.maxZ + r;
  }
}

// 半径 r の円が別の円にめり込んでいたら、外へ押し出す
export function pushOutOfCircle(pos: Point2D, r: number, c: Circle2D): void {
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const minDist = r + c.radius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist || distSq === 0) return;
  const dist = Math.sqrt(distSq);
  pos.x = c.x + (dx / dist) * minDist;
  pos.z = c.z + (dz / dist) * minDist;
}
