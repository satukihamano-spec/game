import * as THREE from 'three';
import { GameConfig } from '../core/GameConfig';
import type { Agent } from '../sim/Agent';
import type { Circle2D } from '../sim/collision';
import type { IntelFreshness } from '../sim/PlayerIntel';
import { NPCView, type StatusIcon } from './NPCView';

// NPC全員の「見た目」をまとめて管理するクラス
export class NPCManager {
  private readonly views = new Map<string, NPCView>();
  private readonly colliders: Circle2D[] = [];
  private highlighted: NPCView | null = null;
  private infoCheckAt = 0; // ℹ マークを次に確認する時刻（毎フレームは重いので0.5秒ごと）
  private readonly tmp = new THREE.Vector3(); // 画面の位置の計算用（使い回す）

  constructor(scene: THREE.Scene, agents: Agent[]) {
    agents.forEach((agent, i) => {
      const view = new NPCView(agent, i);
      this.views.set(agent.id, view);
      scene.add(view.object);
    });
  }

  // 毎フレーム：位置と頭上のマークを更新し、いなくなったNPCを片付ける
  //   now       … ゲーム開始からの経過秒数
  //   freshness … プレイヤーがその人物について持っている情報の新しさ（ℹ マークの色）
  //   flagged   … プレイヤーがその人物の情報にフラグを付けているか（★）
  //   nameColor … 名前の色（プレイヤーが嘘を見抜いた警戒度。0.5秒ごとに確認）
  sync(
    alertId: string | null,
    now: number,
    freshness: (id: string) => IntelFreshness,
    flagged: (id: string) => boolean,
    nameColor: (id: string) => string,
    viewer?: { x: number; z: number },
  ): void {
    const cull = GameConfig.npcCullDistance;
    const checkInfo = now >= this.infoCheckAt;
    if (checkInfo) this.infoCheckAt = now + 0.5;

    for (const [id, view] of this.views) {
      const a = view.agent;
      if (!a.alive) {
        // 退場演出を見せてから片付ける（ゲームの計算からは、いなくなった時点ですでに外れている）
        if (!view.exiting) {
          view.startExit(a.removedReason ?? 'eliminated', now);
          if (this.highlighted === view) this.highlighted = null;
        }
        if (view.updateExit(now)) {
          view.dispose();
          this.views.delete(id);
        }
        continue;
      }
      view.sync();
      // 霧で見えないほど遠いNPCは描かない（スマホの描画負荷を下げる）
      if (viewer) view.object.visible = Math.hypot(a.x - viewer.x, a.z - viewer.z) < cull;
      let icon: StatusIcon = 'none';
      if (a.id === alertId) icon = 'alert';
      else if (a.act.k === 'engaged') icon = a.act.what === 'battle' ? 'battle' : 'talk';
      else if (a.act.k === 'approach' && a.act.intent === 'challenge' && a.act.target.isPlayer) icon = 'alert';
      view.setIcon(icon);

      // ℹ：プレイヤーが会話でこの人物の情報を入手していれば、新しさに応じた色で表示
      // （NPCが内部で知っている情報は使わない）
      if (checkInfo) {
        view.setInfoMark(freshness(a.id));
        view.setNameColor(nameColor(a.id));
      }
      view.setFlag(flagged(a.id)); // フラグはタップしてすぐ反映したいので毎フレーム確認
    }
  }

  // 指定した距離以内で一番近いNPC（いなければ null）
  findNearest(x: number, z: number, maxDistance: number): Agent | null {
    let nearest: Agent | null = null;
    let best = maxDistance;
    for (const view of this.views.values()) {
      const a = view.agent;
      if (!a.alive) continue; // 退場中のNPCには話しかけられない
      const d = Math.hypot(a.x - x, a.z - z);
      if (d <= best) {
        best = d;
        nearest = a;
      }
    }
    return nearest;
  }

  // 画面の (x, y) をタップ・クリックしたとき、その近くに見えているNPCを返す（いなければ null）
  //   当たり判定は「画面上の距離」で調べる（指でも押しやすいよう、少し広めにする）
  pickAt(x: number, y: number, camera: THREE.PerspectiveCamera, rect: DOMRect, radiusPx: number): Agent | null {
    let best: Agent | null = null;
    let bestD = radiusPx;
    for (const view of this.views.values()) {
      const a = view.agent;
      if (!a.alive || !view.object.visible) continue;
      for (const h of [0.5, 1.2, 1.9]) {
        // 足元・胴体・頭のどこを押しても選べるように3点で調べる
        const p = this.tmp.set(a.x, h, a.z).project(camera);
        if (p.z > 1) continue; // カメラの後ろ
        const sx = rect.left + ((p.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - p.y) / 2) * rect.height;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
    }
    return best;
  }

  // NPCの見た目（服の色・髪の色・性別）。対戦演出のアップ画面で同じ見た目にするため
  lookOf(agent: Agent): { color: number; hairColor: number; gender: Agent['gender'] } {
    const v = this.views.get(agent.id);
    return { color: v?.bodyColor ?? 0x6f7f8f, hairColor: v?.hairColor ?? 0x2a1d14, gender: agent.gender };
  }

  highlight(agent: Agent | null): void {
    const view = agent ? (this.views.get(agent.id) ?? null) : null;
    if (view === this.highlighted) return;
    this.highlighted?.setHighlighted(false);
    view?.setHighlighted(true);
    this.highlighted = view;
  }

  // プレイヤーがぶつかる丸い当たり判定（配列は使い回す）
  getColliders(): Circle2D[] {
    let i = 0;
    for (const view of this.views.values()) {
      if (!view.agent.alive) continue; // 退場中のNPCにはぶつからない
      const c = this.colliders[i] ?? (this.colliders[i] = { x: 0, z: 0, radius: GameConfig.npcRadius });
      c.x = view.agent.x;
      c.z = view.agent.z;
      i++;
    }
    this.colliders.length = i;
    return this.colliders;
  }
}
