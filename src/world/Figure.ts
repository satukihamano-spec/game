import * as THREE from 'three';
import type { Gender } from '../data/speech';

// プレイヤー・NPC・進行役で共通の「簡単な人型」を作る。
// 体（カプセル）＋頭（球）＋顔の向きが分かる小さな板。
// 性別で髪型と体格を少し変える。進行役はサングラスとネクタイを付ける。
// 高品質なモデルに差し替えるときは、この関数を置き換えればよい。

export interface FigureOptions {
  gender?: Gender;
  hairColor?: number;
  skinColor?: number; // 顔の色（指定しなければ体と同じ色）
  sunglasses?: boolean; // 進行役用
  tie?: boolean; // 進行役用
}

// 形と材質は全員で使い回す（メモリ節約）
const bodyGeometry = new THREE.CapsuleGeometry(0.35, 0.8, 4, 12);
const headGeometry = new THREE.SphereGeometry(0.28, 12, 10);
const visorGeometry = new THREE.BoxGeometry(0.34, 0.08, 0.06);
const shadowGeometry = new THREE.CircleGeometry(0.5, 16);
const shortHairGeometry = new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45); // 頭のてっぺん
const longHairGeometry = new THREE.BoxGeometry(0.5, 0.55, 0.16); // 後ろに下がる髪
const glassesGeometry = new THREE.BoxGeometry(0.5, 0.13, 0.1);
const tieGeometry = new THREE.BoxGeometry(0.08, 0.42, 0.04);
const visorMaterial = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
const glassesMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });
const tieMaterial = new THREE.MeshBasicMaterial({ color: 0xb01818 });
const hairMaterials = new Map<number, THREE.MeshLambertMaterial>();

function hairMaterial(color: number): THREE.MeshLambertMaterial {
  let m = hairMaterials.get(color);
  if (!m) hairMaterials.set(color, (m = new THREE.MeshLambertMaterial({ color })));
  return m;
}

export function createFigure(color: number, opts: FigureOptions = {}): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color });

  const body = new THREE.Mesh(bodyGeometry, material);
  body.position.y = 0.75;
  group.add(body);

  const head = new THREE.Mesh(
    headGeometry,
    opts.skinColor !== undefined ? new THREE.MeshLambertMaterial({ color: opts.skinColor }) : material,
  );
  head.position.y = 1.55;
  group.add(head);

  // 顔の向き（+Z方向が正面）。サングラスのときはサングラスが目の代わり
  if (opts.sunglasses) {
    const glasses = new THREE.Mesh(glassesGeometry, glassesMaterial);
    glasses.position.set(0, 1.55, 0.25);
    group.add(glasses);
  } else {
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 1.58, 0.26);
    group.add(visor);
  }

  if (opts.tie) {
    const tie = new THREE.Mesh(tieGeometry, tieMaterial);
    tie.position.set(0, 1.0, 0.34);
    group.add(tie);
  }

  // 髪型：性別で変える（女性は後ろ髪あり、体格を少し細く小さく）
  if (opts.gender) {
    const hair = hairMaterial(opts.hairColor ?? 0x2a1d14);
    const top = new THREE.Mesh(shortHairGeometry, hair);
    top.position.y = 1.58;
    group.add(top);
    if (opts.gender === 'female') {
      const back = new THREE.Mesh(longHairGeometry, hair);
      back.position.set(0, 1.4, -0.2);
      group.add(back);
      body.scale.set(0.9, 0.97, 0.9);
    } else if (opts.gender === 'other') {
      body.scale.set(0.95, 1, 0.95);
    }
  }

  // 足元の影（リアルタイムの影は重いので、暗い円で代用）
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return group;
}
