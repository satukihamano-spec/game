import * as THREE from 'three';
import { CARDS, type CardId } from '../card/Card';
import { roomSizeFor, type GameModeConfig } from '../data/modes';
import { Rules } from '../data/rules';
import { SPEECH, speak, type LineKey } from '../data/speech';
import { InputManager, type GameAction, type MoveVector } from '../input/InputManager';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchInput } from '../input/TouchInput';
import { PointerInput } from '../input/PointerInput';
import { MenuUI, type MenuStatus, type Quality } from '../ui/MenuUI';
import { DuelStage, type DuelInfo, type StageMode } from '../ui/DuelStage';
import { MOOD_EXPRESSION, PLAYER_EXPRESSION, PLAYER_REPLIES, type ExpressionId, type PlayerReply } from '../data/expressions';
import { NPCManager } from '../npc/NPCManager';
import { Player } from '../player/Player';
import { Agent } from '../sim/Agent';
import { FloorSim, type SimEvent } from '../sim/FloorSim';
import type { Rumor } from '../sim/Knowledge';
import { PlayerIntel, type IntelKind } from '../sim/PlayerIntel';
import { PlayerSuspicion } from '../sim/PlayerSuspicion';
import { mood } from '../sim/Relations';
import { buildRoster } from '../sim/Roster';
import { pickQuestion } from '../sim/SmallTalk';
import { rumorToText } from '../sim/RumorText';
import { CardBattleUI } from '../ui/CardBattleUI';
import { DialogueUI } from '../ui/DialogueUI';
import { HUD } from '../ui/HUD';
import { IntelListUI } from '../ui/IntelListUI';
import { ResultUI } from '../ui/ResultUI';
import { CardBoards, CENTER_BOARD } from '../world/CardBoard';
import { Floor } from '../world/Floor';
import { GameMaster } from '../world/GameMaster';
import { GameConfig } from './GameConfig';
import { formatTime, GameState } from './GameState';
import { answerProbe, buildProbe, type PlayerLog, type ProbeHost } from './ProbeTalk';
import {
  GIFT_REASON,
  IDENTITY_ADMIT,
  IDENTITY_CLOSE,
  IDENTITY_HINT,
  IDENTITY_QUESTION,
  IDENTITY_WEAKENED,
  IDENTITY_WRONG,
  POST_DRAW,
  POST_NPC_LOSE,
  POST_NPC_WIN,
  PRE_BATTLE,
  PROBE_REACT,
  REFUSE_DISLIKE,
  type GiftReason,
} from '../data/conversation';
import { features, line, moodLine, type TalkSituation } from '../sim/Conversation';

// ゲーム全体を組み立てて、毎フレームの処理と場面の切り替えを行う「司令塔」。
//   計算（星・カード・NPCの行動・情報）… sim/ フォルダ
//   見た目（3D）                       … world/ player/ npc/ フォルダ
//   画面のボタンや文字                 … ui/ フォルダ
export class Game {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly timer = new THREE.Timer();

  private readonly mode: GameModeConfig; // 選んだゲームモード（時間・人数・広さ・勝利条件）
  private readonly state: GameState;
  private readonly input = new InputManager();
  private readonly floor: Floor;
  private readonly boards: CardBoards; // カード残数掲示板（5か所）
  private readonly player: Player; // プレイヤーの見た目
  private readonly me: Agent; // プレイヤーの中身（星・カード）
  private readonly sim: FloorSim;
  private readonly npcs: NPCManager;
  // プレイヤーが知っている情報（NPCの内部情報とは別に管理する）
  private readonly intel = new PlayerIntel();
  // 嘘を見抜いたNPCへの警戒度（名前の色で表示。NPCの嘘傾向・友好度とは別のデータ）
  private readonly suspicion = new PlayerSuspicion();

  private readonly hud: HUD;
  private readonly dialogueUI: DialogueUI;
  private readonly battleUI: CardBattleUI;
  private readonly intelUI: IntelListUI; // 情報一覧
  private readonly resultUI: ResultUI;
  private readonly menuUI: MenuUI; // ☰ メニュー
  private readonly duel: DuelStage; // 対戦演出（2人のアップ画面）
  private memoFromMenu = false; // 情報一覧をメニューから開いたか（閉じたらメニューに戻る）
  private quality: Quality;
  // NPC（または進行役）をタップ・クリックしたとき、そこまで自動で歩いて話しかける
  private walkTarget: { npc: Agent | null; gm: boolean; giveUpAt: number } | null = null;

  private nearNpc: Agent | null = null;
  private nearGm = false; // 進行役の近くにいるか
  private nearLabel: string | null = null;
  private readonly gm: GameMaster; // デスゲームの進行役（サングラス）
  private winReady = false; // 勝利条件を満たした（あとは進行役に報告するだけ）
  private alertNpcId: string | null = null; // 挑戦してきたNPC（頭に❗を出す）
  private dialogueCancel: (() => void) | null = null; // 会話中に Esc を押したときの動き
  // プレイヤーの最近の行動（NPCから質問されたときの「本当の答え」）
  private readonly playerLog: PlayerLog = { talked: new Map(), fought: new Map() };
  // 「あなた、○○ですよね？」：手がかりの数（NPCごと）と、もう質問したNPC（NPCごとに1回だけ）
  private readonly identityClues = new Map<string, number>();
  private readonly identityClueOnce = new Set<string>();
  private readonly identityAsked = new Set<string>();

  // 計算用（毎フレーム new しないように使い回す）
  private readonly cameraTarget = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly tmpVec = new THREE.Vector3();
  private cameraScale = 1; // 縦画面ではカメラを少し引く

  constructor(container: HTMLElement, mode: GameModeConfig) {
    this.container = container;
    this.mode = mode;
    this.state = new GameState(mode.timeLimitSec);
    const roomSize = roomSizeFor(mode); // マップの広さはモードから自動で決まる

    // 描画装置
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.quality = loadQuality();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, GameConfig.pixelRatioByQuality[this.quality]));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // 3D空間（遠くを暗くして閉鎖空間らしくする）
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(GameConfig.backgroundColor);
    this.scene.fog = new THREE.Fog(GameConfig.backgroundColor, 16, 40);

    this.camera = new THREE.PerspectiveCamera(
      GameConfig.fieldOfView,
      container.clientWidth / container.clientHeight,
      GameConfig.nearClip,
      GameConfig.farClip,
    );
    this.createLights();

    // フロアと中央の表示板
    this.floor = new Floor(roomSize);
    this.scene.add(this.floor.group);
    this.boards = new CardBoards(roomSize);
    this.scene.add(this.boards.group);

    // プレイヤー
    this.player = new Player(this.floor.playerStart);
    this.scene.add(this.player.object);
    this.me = new Agent('player', 'プレイヤー', true, undefined, mode.cardsPerType);
    this.me.x = this.floor.playerStart.x;
    this.me.z = this.floor.playerStart.z;

    // NPC（モードの人数どおりに通常NPC・中ボス・大ボスを決め、中身を作ってから見た目を作る）
    const npcAgents = buildRoster(mode).map((data, i) => new Agent(`npc${i}`, data.name, false, data, mode.cardsPerType));
    this.placeNpcs(npcAgents, roomSize);
    this.sim = new FloorSim(
      this.me,
      npcAgents,
      this.floor.obstacles,
      {
        roomSize,
        starsToWin: mode.starsToWin,
        npcPace: mode.npcPace,
        timeLimitSec: mode.timeLimitSec,
        perType: mode.cardsPerType,
      },
      this.onSimEvent,
    );
    this.npcs = new NPCManager(this.scene, npcAgents);

    // 進行役：フロアの四隅のどこかに立っている（プレイヤーが探す）
    const corner = roomSize / 2 - 3.5;
    const sx = Math.random() < 0.5 ? -1 : 1;
    const sz = Math.random() < 0.5 ? -1 : 1;
    this.gm = new GameMaster(sx * corner, sz * corner);
    this.scene.add(this.gm.object);

    // 画面のUI（3Dの上に重ねるHTML）
    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui';
    container.appendChild(uiRoot);
    this.hud = new HUD(
      uiRoot,
      mode.starsToWin,
      () => this.input.trigger('interact'),
      () => this.input.trigger('menu'),
    );
    this.duel = new DuelStage(uiRoot);
    this.dialogueUI = new DialogueUI(uiRoot);
    this.battleUI = new CardBattleUI(uiRoot);
    this.intelUI = new IntelListUI(uiRoot, () => this.input.trigger('memo'));
    this.resultUI = new ResultUI(uiRoot);
    this.menuUI = new MenuUI(uiRoot, {
      onIntel: () => {
        this.menuUI.hide();
        this.memoFromMenu = true;
        this.openMemo();
      },
      onClose: () => this.closeMenu(),
      onQuit: () => window.location.reload(), // モード選択に戻る
      getStatus: () => this.menuStatus(),
      getQuality: () => this.quality,
      setQuality: (q) => this.setQuality(q),
    });
    // ボタンをクリックした後、Enterキーで同じボタンが二重に押されないようにする
    uiRoot.addEventListener('click', () => (document.activeElement as HTMLElement | null)?.blur());

    // 入力（PCはキーボード、スマホはタッチ。両方同時に使える）
    this.input.addSource(new KeyboardInput());
    this.input.addSource(new TouchInput(uiRoot)); // 左下：移動用ジョイスティック
    this.input.addSource(new PointerInput(this.renderer.domElement)); // 3D画面のタップ・クリック：NPCを選ぶ
    this.input.onAction(this.handleAction);
    this.input.onSelect(this.onSelect);

    this.refreshStatus();
    this.refreshRemaining();
    this.onResize(); // 縦画面ならカメラを調整
    this.snapCamera();
    // スマホではアドレスバーの出し入れや画面の回転で表示領域が変わるので、それにも合わせる
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
  }

  start(): void {
    this.timer.connect(document);
    this.renderer.setAnimationLoop(this.update);
    this.hud.toast(
      `制限時間${this.mode.label}。カードを使い切ったとき、星${this.mode.starsToWin}個以上なら生き残れる。`,
    );
  }

  private createLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x9aa4b8, 0x1a1a1f, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(4, 10, 6);
    this.scene.add(dirLight);
  }

  // NPCを、柱・中央の表示板・プレイヤーの近くを避けてばらばらに置く
  private placeNpcs(agents: Agent[], roomSize: number): void {
    const half = roomSize / 2 - 1.5;
    const placed: { x: number; z: number }[] = [this.floor.playerStart];
    for (const a of agents) {
      for (let tries = 0; tries < 50; tries++) {
        const x = (Math.random() * 2 - 1) * half;
        const z = (Math.random() * 2 - 1) * half;
        const onBoard = Math.abs(x) < CENTER_BOARD.width / 2 + 0.5 && Math.abs(z) < CENTER_BOARD.depth / 2 + 0.5;
        const onPillar = this.floor.obstacles.some(
          (b) => x > b.minX - 1 && x < b.maxX + 1 && z > b.minZ - 1 && z < b.maxZ + 1,
        );
        const crowded = placed.some((p) => Math.hypot(p.x - x, p.z - z) < 2.2);
        if (!onBoard && !onPillar && !crowded) {
          a.x = x;
          a.z = z;
          break;
        }
      }
      a.facing = Math.random() * Math.PI * 2;
      placed.push({ x: a.x, z: a.z });
    }
  }

  // ───────────── 毎フレームの処理 ─────────────

  private update = (time: number): void => {
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1); // タブ切り替え後などに大きく飛ばないように

    if (!this.state.isOver()) {
      // 制限時間（会話中も勝負中も減り続ける）
      this.state.timeLeft -= dt;
      this.hud.setTime(this.state.timeLeft);
      if (this.state.timeLeft <= 0) {
        this.finish(
          'gameover',
          this.winReady ? '時間切れ。進行役に勝利を報告できなかった。' : '時間切れ。カードを使い切れなかった。',
        );
      } else {
        if (this.state.mode === 'explore') {
          const colliders = this.npcs.getColliders();
          colliders.push({ x: this.gm.x, z: this.gm.z, radius: GameConfig.npcRadius }); // 進行役にもぶつかる
          this.player.update(dt, this.moveInput(), this.floor.obstacles, colliders);
        }
        this.me.x = this.player.position.x;
        this.me.z = this.player.position.z;
        this.sim.playerAvailable = this.state.mode === 'explore';
        this.sim.update(dt); // NPCたちの行動
        if (this.state.mode === 'explore') this.updateNearby();
      }
    }

    this.npcs.sync(
      this.alertNpcId,
      this.sim.time,
      (id) => this.intel.freshness(id, this.sim.time),
      (id) => this.intel.isSubjectFlagged(id),
      (id) => this.suspicion.colorOf(id, this.sim.time),
      this.me, // 遠くのNPCは描かない
    );
    this.boards.update(this.sim.cardTotals); // フロア全体のカード残数（1つのデータを3か所で表示）
    this.hud.setFloorCards(this.sim.cardTotals); // 同じデータを画面上部にも小さく表示
    this.gm.setHighlight(this.winReady, this.sim.time);
    if (Math.hypot(this.gm.x - this.me.x, this.gm.z - this.me.z) < 8) this.gm.lookAt(this.me.x, this.me.z);
    if (this.duel.active) {
      // 顔アップ演出中：2Dの顔画像を表示しているので、マップ（3D）は描かない（軽い）
      this.duel.update(dt);
      return;
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updateNearby(): void {
    // 進行役が近くにいれば、そちらを優先
    const nearGm = Math.hypot(this.gm.x - this.me.x, this.gm.z - this.me.z) <= Rules.talkDistance + 0.3;
    const npc = nearGm ? null : this.npcs.findNearest(this.me.x, this.me.z, Rules.talkDistance);
    let label: string | null = null;
    if (nearGm) label = '進行役に話しかける';
    else if (npc) label = npc.isInterruptible() ? `${npc.name}に話しかける` : `${npc.name}（取り込み中）`;
    if (npc !== this.nearNpc || nearGm !== this.nearGm || label !== this.nearLabel) {
      this.nearNpc = npc;
      this.nearGm = nearGm;
      this.nearLabel = label;
      this.npcs.highlight(this.walkTarget?.npc ?? npc); // タップで選んだ相手に向かっている間は、その相手を光らせる
      this.hud.setInteractLabel(label);
    }
  }

  private updateCamera(dt: number): void {
    const p = this.player.position;
    const o = GameConfig.cameraOffset;
    const k = this.cameraScale;
    this.cameraTarget.set(p.x + o.x * k, p.y + o.y * k, p.z + o.z * k);
    const t = 1 - Math.exp(-GameConfig.cameraFollow * dt);
    this.camera.position.lerp(this.cameraTarget, t);
    this.lookTarget.set(p.x, p.y + 1, p.z);
    this.camera.lookAt(this.lookTarget);
  }

  private snapCamera(): void {
    const p = this.player.position;
    const o = GameConfig.cameraOffset;
    const k = this.cameraScale;
    this.camera.position.set(p.x + o.x * k, p.y + o.y * k, p.z + o.z * k);
    this.camera.lookAt(p.x, p.y + 1, p.z);
  }

  // ───────────── 入力の振り分け ─────────────

  private handleAction = (action: GameAction): void => {
    const choiceIndex = ['choice1', 'choice2', 'choice3', 'choice4', 'choice5', 'choice6'].indexOf(action);

    switch (this.state.mode) {
      case 'explore':
        if (action === 'interact' || action === 'confirm') this.interact();
        else if (action === 'memo') this.openMemo();
        else if (action === 'menu') this.openMenu();
        break;
      case 'menu':
        if (action === 'menu' || action === 'cancel') this.closeMenu();
        else if (action === 'memo') {
          this.menuUI.hide();
          this.memoFromMenu = true;
          this.openMemo();
        }
        break;
      case 'dialogue':
        if (choiceIndex >= 0) this.dialogueUI.choose(choiceIndex);
        else if (action === 'confirm' || action === 'interact') this.dialogueUI.confirm();
        else if (action === 'cancel') this.dialogueCancel?.();
        break;
      case 'battle':
        if (choiceIndex >= 0) this.battleUI.pick(choiceIndex);
        else if (action === 'confirm') this.battleUI.next();
        break;
      case 'memo':
        if (action === 'memo' || action === 'cancel' || action === 'confirm' || action === 'menu') this.closeMemo();
        break;
      case 'gameover':
      case 'clear':
        if (action === 'confirm') this.resultUI.restart();
        break;
    }
  };

  private interact(): void {
    if (this.nearGm) {
      this.talkToGameMaster();
      return;
    }
    const npc = this.nearNpc;
    if (!npc) return;
    if (!npc.isInterruptible()) {
      this.hud.toast(`${npc.name}は今、取り込み中のようだ。`);
      return;
    }
    this.startTalk(npc);
  }

  private openMemo(): void {
    this.state.mode = 'memo';
    this.clearNearby();
    this.intelUI.show(this.intel, this.sim.time, (id) => this.nameOf(id));
  }

  private closeMemo(): void {
    this.intelUI.hide();
    this.state.mode = 'explore';
    if (this.memoFromMenu) {
      this.memoFromMenu = false;
      this.openMenu(); // メニューから開いた情報一覧は、閉じるとメニューに戻る
    }
  }

  // ───────────── メニュー ─────────────

  private openMenu(): void {
    if (this.state.mode !== 'explore') return;
    this.state.mode = 'menu';
    this.clearNearby();
    this.menuUI.show();
  }

  private closeMenu(): void {
    this.menuUI.hide();
    if (this.state.mode === 'menu') this.state.mode = 'explore';
  }

  // メニューの「ゲーム状況」に出す内容。簡易マップには、見えている範囲の人物とフラグを付けた人物だけを描く
  private menuStatus(): MenuStatus {
    const see = Rules.playerSeeDistance * 1.5;
    const near = (x: number, z: number): boolean => Math.hypot(x - this.me.x, z - this.me.z) <= see;
    const people: MenuStatus['map']['people'] = [];
    for (const a of this.sim.aliveNpcs()) {
      if (this.intel.isSubjectFlagged(a.id)) people.push({ x: a.x, z: a.z, kind: 'flag' });
      else if (near(a.x, a.z)) people.push({ x: a.x, z: a.z, kind: 'npc' });
    }
    if (near(this.gm.x, this.gm.z)) people.push({ x: this.gm.x, z: this.gm.z, kind: 'gm' });
    return {
      modeLabel: this.mode.label,
      timeLeft: this.state.timeLeft,
      alive: this.sim.aliveCount(),
      total: this.sim.participants,
      stars: this.me.stars,
      starsToWin: this.mode.starsToWin,
      hand: { ...this.me.hand.counts },
      floor: { ...this.sim.cardTotals },
      winReady: this.winReady,
      map: { roomSize: roomSizeFor(this.mode), obstacles: this.floor.obstacles, player: { x: this.me.x, z: this.me.z }, people },
    };
  }

  // 画質を変える（描画倍率だけを変えるので、ゲームの進行には影響しない）。次回も同じ画質で始まる
  private setQuality(q: Quality): void {
    this.quality = q;
    try {
      localStorage.setItem(QUALITY_KEY, q);
    } catch {
      // 保存できない環境（プライベートモードなど）でも、今回のプレイには反映される
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, GameConfig.pixelRatioByQuality[q]));
    this.onResize();
  }

  // ───────────── タップ・クリックでNPCを選ぶ ─────────────

  // 画面の (x, y) がタップ・クリックされた：NPC（または進行役）がいれば、そこへ歩いて話しかける
  private onSelect = (x: number, y: number): void => {
    if (this.state.mode !== 'explore') return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const r = GameConfig.tapRadiusPx;
    // 進行役を優先して調べる
    const g = this.tmpVec.set(this.gm.x, 1.2, this.gm.z).project(this.camera);
    const gx = rect.left + ((g.x + 1) / 2) * rect.width;
    const gy = rect.top + ((1 - g.y) / 2) * rect.height;
    if (g.z <= 1 && Math.hypot(gx - x, gy - y) < r) {
      this.walkTo(null, true);
      return;
    }
    const npc = this.npcs.pickAt(x, y, this.camera, rect, r);
    if (npc) this.walkTo(npc, false);
  };

  private walkTo(npc: Agent | null, gm: boolean): void {
    const tx = gm ? this.gm.x : (npc as Agent).x;
    const tz = gm ? this.gm.z : (npc as Agent).z;
    const dist = Math.hypot(tx - this.me.x, tz - this.me.z);
    if (dist <= Rules.talkDistance) {
      // もう近くにいる → すぐ話しかける
      if (gm) this.talkToGameMaster();
      else if (npc?.isInterruptible()) this.startTalk(npc);
      else this.hud.toast(`${npc?.name}は今、取り込み中のようだ。`);
      return;
    }
    this.walkTarget = { npc, gm, giveUpAt: this.sim.time + 4 + dist / GameConfig.moveSpeed * 1.5 };
    if (npc) this.npcs.highlight(npc);
    this.hud.toast(gm ? '進行役のところへ向かう' : `${npc?.name}のところへ向かう`);
  }

  // この フレームの移動入力：ジョイスティック・キーボードを優先し、なければ自動で歩く
  private moveInput(): MoveVector {
    const m = this.input.getMove();
    if (m.x !== 0 || m.y !== 0) {
      this.walkTarget = null; // 自分で動かしたら自動移動はやめる
      return m;
    }
    const w = this.walkTarget;
    if (!w) return m;
    if (this.sim.time > w.giveUpAt || (w.npc && !w.npc.alive)) {
      this.walkTarget = null; // 柱に引っかかった・相手がいなくなった
      return m;
    }
    const tx = w.gm ? this.gm.x : (w.npc as Agent).x;
    const tz = w.gm ? this.gm.z : (w.npc as Agent).z;
    const dx = tx - this.me.x;
    const dz = tz - this.me.z;
    const d = Math.hypot(dx, dz);
    if (d <= Rules.talkDistance - 0.4) {
      this.walkTarget = null;
      if (w.gm) this.talkToGameMaster();
      else if (w.npc?.isInterruptible()) this.startTalk(w.npc);
      else this.hud.toast(`${w.npc?.name}は今、取り込み中のようだ。`);
      return { x: 0, y: 0 };
    }
    return { x: dx / d, y: -dz / d }; // 画面の上方向（奥）は -Z
  }

  private clearNearby(): void {
    this.walkTarget = null;
    this.hud.setInteractLabel(null);
    this.npcs.highlight(null);
    this.nearNpc = null;
    this.nearGm = false;
    this.nearLabel = null;
  }

  // ───────────── 会話（プレイヤーから話しかける） ─────────────

  // NPCの言葉遣い・性別に合わせてセリフを作る
  private say(npc: Agent, key: LineKey): string {
    return speak(npc.speechStyle, npc.gender, key);
  }

  // NPC → プレイヤーの友好度（数字は画面に出さない。態度から推測するだけ）
  private affinityOf(npc: Agent): number {
    return this.sim.relations.affinity(npc.id, this.me.id);
  }

  private startTalk(npc: Agent): void {
    this.state.mode = 'dialogue';
    this.clearNearby();
    this.sim.holdForPlayer(npc);
    // 話している間に、相手はプレイヤーの星の数を見て覚える（NPCの内部情報。プレイヤーとの会話で星の話はしない）
    npc.knowledge.observeStars(this.me.id, this.me.stars, this.sim.time);

    // 挨拶：友好度が高ければ親しげに、低ければ冷たく（ただし毎回態度に出るとは限らない）
    const m = mood(this.affinityOf(npc));
    const first = npc.talkedWithPlayer === 0;
    const key: LineKey = first
      ? m === 'warm' ? 'greetWarm' : m === 'cold' ? 'greetCold' : 'greetNeutral'
      : m === 'warm' ? 'againWarm' : m === 'cold' ? 'againCold' : 'againNeutral';
    npc.talkedWithPlayer++;
    this.playerLog.talked.set(npc.id, this.sim.time);
    // 正体の手がかり：何度も話した・この人物の情報をいくつも持っている
    const before = this.canAskIdentity(npc);
    if (npc.talkedWithPlayer >= 3) this.addClueOnce(npc, 'talks');
    if (this.intel.countAbout(npc.id) >= 2) this.addClueOnce(npc, 'intel');
    const hint = !before && this.canAskIdentity(npc) ? '\n（……この人、ただ者ではないかもしれない）' : '';
    this.showTalkMenu(npc, this.say(npc, key) + hint);
  }

  private showTalkMenu(npc: Agent, text: string): void {
    this.dialogueCancel = () => this.endTalk(npc);
    const menu: [string, () => void][] = [
      ['情報を聞く', () => this.askInfo(npc)],
      ['情報を教える', () => this.tellInfo(npc)],
      ['世間話', () => this.smallTalk(npc)],
      ['勝負を挑む', () => this.askBattle(npc)],
    ];
    if (this.canAskIdentity(npc)) menu.push(['正体を探る', () => this.askIdentity(npc)]);
    menu.push(['会話をやめる', () => this.endTalk(npc)]);
    this.dialogueUI.show(npc.name, text, menu.map((m) => m[0]), (i) => menu[i][1]());
  }

  // 会話用の特徴（性格・友好度・状況）
  private talkFeatures(npc: Agent, extra: Partial<TalkSituation> = {}): ReturnType<typeof features> {
    const theirStars = npc.knowledge.starsOf(this.me.id); // NPCが知っているプレイヤーの星（会話には出さない）
    return features(npc, this.sim.ctx, {
      affinity: this.affinityOf(npc),
      playerWeaker: theirStars !== null && theirStars < npc.stars,
      ...extra,
    });
  }

  // ───────────── 「あなた、○○ですよね？」（特殊NPCの正体の確認） ─────────────

  private addClue(npc: Agent, n: number): void {
    this.identityClues.set(npc.id, (this.identityClues.get(npc.id) ?? 0) + n);
  }

  private addClueOnce(npc: Agent, key: string): void {
    const k = `${npc.id}:${key}`;
    if (this.identityClueOnce.has(k)) return;
    this.identityClueOnce.add(k);
    this.addClue(npc, 1);
  }

  // 手がかりが十分にたまっていて、まだ質問していないNPCだけ聞ける（NPCごとに1回だけ）
  private canAskIdentity(npc: Agent): boolean {
    return !this.identityAsked.has(npc.id) && (this.identityClues.get(npc.id) ?? 0) >= Rules.conversation.identityCluesNeeded;
  }

  private askIdentity(npc: Agent): void {
    const ranks = ['saisho', 'strategist', 'kurouto'] as const;
    this.dialogueCancel = () => this.showTalkMenu(npc, this.say(npc, 'againNeutral'));
    this.dialogueUI.show('あなた', '（どう聞く？ 質問できるのは、この人に1回だけだ）', [...ranks.map((r) => IDENTITY_QUESTION[r]), 'やめておく'], (i) => {
      const rank = ranks[i];
      if (!rank) {
        this.showTalkMenu(npc, this.say(npc, 'againNeutral')); // やめた場合は消費しない
        return;
      }
      this.identityAsked.add(npc.id); // このNPCへの質問はこれで終わり（どの種類も、もう聞けない）
      if (npc.rank === rank) this.identityCorrect(npc, rank);
      else this.identityWrong(npc);
    });
  }

  // 当たり：友好度が大きく上がり、いつもより長く話してくれる（能力は匂わせる程度）
  private identityCorrect(npc: Agent, rank: 'saisho' | 'strategist' | 'kurouto'): void {
    this.sim.relations.adjust(npc.id, this.me.id, Rules.relations.identityCorrect);
    npc.specialIdentityDetectedByPlayer = true; // 見破られた本人だけ、カード把握能力が弱くなる（数値は画面に出さない）
    const label = Rules.npcTypes[rank].label;
    this.recordIntel('identity', [npc.id], npc.name, `${npc.name}は、自分が「${label}」だと認めた。`);
    this.dialogueCancel = null;
    this.dialogueUI.show(npc.name, `${line(npc, IDENTITY_ADMIT[rank])}\n（${npc.name}は少しだけ表情をゆるめた）`, ['続ける'], () => {
      // 能力の匂わせ → 見破られて「やりにくくなった」ことの匂わせ（数値は出さない）
      this.dialogueUI.show(npc.name, line(npc, IDENTITY_HINT[rank]), ['続ける'], () => this.identityWeakened(npc));
    });
  }

  private identityWeakened(npc: Agent): void {
    this.dialogueUI.show(npc.name, line(npc, IDENTITY_WEAKENED), ['続ける'], () => {
      // 情報を話す性格なら、ひとつ教えてくれることも
      if (Math.random() < npc.personality.infoChance * 0.8 && this.tellRumor(npc, line(npc, { polite: ['ついでに、ひとつお教えしましょう。'], casual: ['ついでにひとつ教えてあげる。'] }))) return;
      this.showTalkMenu(npc, line(npc, IDENTITY_CLOSE));
    });
  }

  // 外れ：友好度が大きく下がる。性格で反応が変わり、しばらく情報も教えてくれない
  private identityWrong(npc: Agent): void {
    const R = Rules.relations;
    this.sim.relations.adjust(npc.id, this.me.id, Math.round(R.identityWrong * (0.8 + 0.2 * npc.personality.social.sore)));
    npc.infoCooldownUntil = Math.max(npc.infoCooldownUntil, this.sim.time + 90);
    this.showTalkMenu(npc, moodLine(npc, IDENTITY_WRONG, this.talkFeatures(npc)).text);
  }

  private askInfo(npc: Agent): void {
    if (this.sim.time < npc.infoCooldownUntil) {
      this.showTalkMenu(npc, this.say(npc, 'busy'));
      return;
    }
    npc.infoCooldownUntil = this.sim.time + Rules.relations.playerTalkCooldownSec;
    // 情報を聞くときは、相手の顔をアップにする（表情から、隠し事や嘘を読み取れるかもしれない）
    if (!this.duel.active) this.enterDuel(npc, 'info');
    this.duel.setExpression('npc', 'neutral');
    this.duel.speak('npc');
    this.tellRumor(npc, '', (hidden) => {
      this.duel.setExpression('npc', hidden ? 'cold' : 'thinking'); // 隠している → 冷たい目 ／ 知らない → 困った顔
      this.showTalkMenu(npc, this.say(npc, hidden ? 'noInfoCold' : 'noInfo'));
    });
  }

  // 噂を話したときの相手の表情（顔アップ中だけ）
  //   嘘を見抜いた → 目が泳ぐ（緊張）／ 親しい → 笑顔 ／ 嫌っている → 警戒 ／ それ以外 → 普通
  //   見抜けなかった嘘は顔に出さない（口のうまい性格は、むしろ笑顔になる）
  private infoFace(npc: Agent, lied: boolean, detected: boolean): void {
    if (!this.duel.active) return;
    const aff = this.affinityOf(npc);
    let face: ExpressionId = aff >= Rules.relations.warmAt ? 'smile' : aff <= Rules.relations.coldAt ? 'cold' : 'neutral';
    if (detected) face = 'nervous';
    else if (lied && npc.personality.honesty < 0.5) face = 'smile';
    this.duel.setExpression('npc', face);
  }

  // NPCが噂を1つ話す（情報を聞く・質問のお礼・正体を当てたとき）。話せたら true
  //   prefix … 噂の前に付ける一言 / onNone … 話せる噂がなかったとき
  private tellRumor(npc: Agent, prefix: string, onNone?: (hidden: boolean) => void): boolean {
    const { rumor, hidden, lied } = this.sim.rumorForPlayer(npc); // 友好度が低いと隠したり嘘をついたりしやすい
    if (!rumor) {
      onNone?.(hidden);
      return false;
    }
    const text = prefix + rumorToText(
      rumor,
      { style: npc.speechStyle, gender: npc.gender },
      { nameOf: (id) => this.nameOf(id), genderOf: (id) => this.genderOf(id), playerId: this.me.id },
      this.sim.time,
    );
    // 嘘を見抜く：NPCが嘘をついていたとき、基本確率（50%：Rules.playerLieDetectChance）でプレイヤーが気づく
    // （NPCが嘘をつくかどうかは別の計算：FloorSim.lieChance）
    const detected = lied && Math.random() < Rules.playerLieDetectChance;
    // 情報に出てくる人物が対象。その人物の頭上に ℹ（緑）が出る。同じ人物なら10分タイマーがリセット
    // ただし、プレイヤー自身についての話（「お前は〜」「〜はお前と勝負した」）は情報一覧に載せない
    const subjects =
      rumor.kind === 'fought' ? [rumor.subjectId, rumor.opponentId]
      : rumor.kind === 'relation' ? [rumor.subjectId, rumor.otherId]
      : [rumor.subjectId];
    if (!subjects.includes(this.me.id)) this.recordIntel('rumor', subjects, npc.name, text, rumor, detected);
    this.infoFace(npc, lied, detected);
    if (detected) {
      // 警戒度 +1（名前が赤くなる。3分ごとに1段階戻る）。見抜かれたNPCは気まずくなり、友好度が少し下がる
      this.suspicion.raise(npc.id, this.sim.time);
      this.sim.playerCaughtLie(npc);
      this.showTalkMenu(npc, `${text}\n（……嘘だ。${npc.name}の目が一瞬泳いだのを、あなたは見逃さなかった）`);
      this.dialogueUI.flashLie();
      this.hud.toast(`🕵 ${npc.name}の嘘を見抜いた！`);
      return true;
    }
    this.showTalkMenu(npc, text);
    return true;
  }

  // 情報を教える：情報一覧から1つ選んで教える。役に立てば友好度が上がることがある
  private tellInfo(npc: Agent): void {
    if (this.sim.time < npc.tellCooldownUntil) {
      this.showTalkMenu(npc, this.say(npc, 'busy'));
      return;
    }
    const items = this.intel.tellable(npc.id, 3);
    if (items.length === 0) {
      this.showTalkMenu(npc, '（教えられる情報がない。他のNPCから噂を聞いてみよう）');
      return;
    }
    const labels = items.map((it) => {
      const short = it.text.replace(/[「」]/g, '');
      return `${this.nameOf(it.subjectIds[0])}の話：${short.length > 18 ? short.slice(0, 18) + '…' : short}`;
    });
    this.dialogueCancel = () => this.showTalkMenu(npc, this.say(npc, 'againNeutral'));
    this.dialogueUI.show('あなた', 'どの情報を教える？', [...labels, 'やめる'], (i) => {
      const item = items[i];
      if (!item?.rumor) {
        this.showTalkMenu(npc, this.say(npc, 'againNeutral'));
        return;
      }
      npc.tellCooldownUntil = this.sim.time + Rules.relations.playerTalkCooldownSec;
      const reaction = this.sim.playerTellsInfo(npc, item.rumor);
      const key: LineKey =
        reaction === 'happy' ? 'tellHappy'
        : reaction === 'little' ? 'tellLittle'
        : reaction === 'none' ? 'tellNone'
        : reaction === 'doubt' ? 'tellDoubt'
        : 'tellWary';
      this.showTalkMenu(npc, this.say(npc, key));
    });
  }

  // 世間話：2〜3択の質問に答える。NPCの好みに合えば友好度が上がり、合わなければ下がる
  private smallTalk(npc: Agent): void {
    if (this.sim.time < npc.smallTalkCooldownUntil) {
      this.showTalkMenu(npc, this.say(npc, 'busy'));
      return;
    }
    npc.smallTalkCooldownUntil = this.sim.time + Rules.relations.playerTalkCooldownSec;
    const q = pickQuestion();
    const prompt = SPEECH[npc.speechStyle].register === 'polite' ? q.polite : q.casual;
    this.dialogueCancel = null;
    this.dialogueUI.show(npc.name, prompt, q.options.map((o) => o.label), (i) => {
      const kind = this.sim.playerSmallTalk(npc, q.options[i].tag);
      // 反応はいつも態度に出るわけではない（友好度を推測できるのは「たまに」）
      const shown = Math.random() < Rules.relations.moodShowChance ? kind : 'neutral';
      const key: LineKey = shown === 'good' ? 'stGood' : shown === 'bad' ? 'stBad' : 'stNeutral';
      this.showTalkMenu(npc, this.say(npc, key));
    });
  }

  private askBattle(npc: Agent): void {
    if (!this.me.canBattle()) {
      this.showTalkMenu(npc, '（あなたはもう勝負できない）');
      return;
    }
    if (!npc.canBattle()) {
      this.showTalkMenu(npc, this.say(npc, 'noCards'));
      return;
    }
    // 性格・友好度・直前の勝負・連続で挑まれたか・クールダウンで、受けるか断るかが変わる
    const res = this.sim.respondToPlayer(npc);
    if (res.accept) {
      this.preBattle(npc, res.angry);
      return;
    }
    if (res.reason === 'dislike') {
      // 友好度が低すぎて断られた（台詞で「嫌われている」と分かる）
      this.showTalkMenu(npc, `${line(npc, REFUSE_DISLIKE)}\n（冷たい視線を向けられた）`);
      return;
    }
    if (res.reason === 'needInfo') this.addClue(npc, 2); // 「相手をよく知ってから」と断るのは、特殊な人物の手がかり
    const refuseKey: Record<typeof res.reason, LineKey> = {
      general: 'refuse',
      justLost: 'refuseJustLost',
      tooMany: 'refuseTooMany',
      wary: 'refuseWary',
      cooldown: 'refuseCooldown',
      needInfo: 'refuseNeedInfo',
    };
    this.showTalkMenu(npc, this.say(npc, refuseKey[res.reason]));
  }

  private endTalk(npc: Agent): void {
    this.exitDuel(); // 顔アップ（情報を聞いたとき）を閉じて、マップに戻る
    this.dialogueUI.hide();
    this.dialogueCancel = null;
    this.sim.release(npc);
    if (!this.state.isOver()) this.state.mode = 'explore';
  }

  // ───────────── 進行役 ─────────────

  // 勝利条件を満たしてから進行役に話しかけると、正式にゲームクリア
  private talkToGameMaster(): void {
    this.state.mode = 'dialogue';
    this.clearNearby();
    const close = (): void => {
      this.dialogueUI.hide();
      this.dialogueCancel = null;
      if (!this.state.isOver()) this.state.mode = 'explore';
    };
    this.dialogueCancel = close;
    if (this.winReady) {
      this.dialogueUI.show(
        this.gm.name,
        `……確認した。手札0枚、星${this.me.stars}個。条件達成だ。おめでとう。ここから出る権利をやろう。`,
        ['フロアを出る'],
        () => this.finish('clear', `進行役に勝利を認められた。星${this.me.stars}個を守り抜き、フロアを脱出した。`),
      );
      return;
    }
    const left = this.me.hand.total();
    this.dialogueUI.show(
      this.gm.name,
      `勝利条件は、手札をすべて使い切ったときに星を${this.mode.starsToWin}個以上持っていること。` +
        `お前の手札はまだ${left}枚ある。条件を満たしたら、また来い。`,
      ['わかった'],
      close,
    );
  }

  // ───────────── NPCからのカード譲渡 ─────────────

  // 仲のいいNPCが「カードを譲りたい」と言ってきた
  private onGiftOffer(npc: Agent, cards: Record<CardId, number>, reason: GiftReason): void {
    if (this.state.mode !== 'explore') {
      this.sim.release(npc);
      return;
    }
    const n = cards.rock + cards.scissors + cards.paper;
    const detail = (['rock', 'scissors', 'paper'] as CardId[])
      .filter((c) => cards[c] > 0)
      .map((c) => `${CARDS[c].icon}${cards[c]}`)
      .join(' ');
    this.state.mode = 'dialogue';
    this.clearNearby();
    this.dialogueCancel = null;
    // まず理由を話しかけてくる（理由の台詞から、なぜ渡すのか推測できる）
    const why = line(npc, GIFT_REASON[reason]);
    const offer = speak(npc.speechStyle, npc.gender, 'giftOffer', { V: String(n) });
    this.dialogueUI.show(npc.name, `${why}${offer}（${detail}）`, ['受け取る', '断る'], (i) => {
      if (i === 0) {
        this.sim.transferCards(npc, this.me, cards);
        this.refreshStatus();
        // カードが増えたので、勝利条件達成の状態は取り消し（また使い切る必要がある）
        if (this.winReady && this.me.hand.total() > 0) {
          this.winReady = false;
          this.hud.setObjective(null);
        }
        this.hud.toast(`${npc.name}からカードを${n}枚受け取った。`);
        this.dialogueUI.show(npc.name, this.say(npc, 'giftThanks'), ['閉じる'], () => {
          this.sim.checkRemoval(npc); // 全部譲ったNPCはフロアを去る
          this.endTalk(npc);
        });
      } else {
        this.sim.relations.adjust(npc.id, this.me.id, -3);
        this.dialogueUI.show(npc.name, this.say(npc, 'giftDeclined'), ['閉じる'], () => this.endTalk(npc));
      }
    });
  }

  // ───────────── NPCから話しかけてくる（情報収集） ─────────────

  private onProbe(npc: Agent): void {
    if (this.state.mode !== 'explore') {
      this.sim.release(npc);
      return;
    }
    this.state.mode = 'dialogue';
    this.clearNearby();
    const host: ProbeHost = { sim: this.sim, me: this.me, intel: this.intel, log: this.playerLog, nameOf: (id) => this.nameOf(id) };
    const scene = buildProbe(host, npc);
    this.dialogueCancel = null;
    this.dialogueUI.show(npc.name, scene.text, scene.options.map((o) => o.label), (i) => {
      const res = answerProbe(host, npc, scene.options[i]);
      // 正直に答えると、お礼に噂を教えてくれることがある（ただし自分の情報も相手に渡っている）
      if (res.favor) {
        this.dialogueUI.show(npc.name, res.text, ['続ける'], () => {
          if (!this.tellRumor(npc, line(npc, PROBE_REACT.favor))) this.showTalkMenu(npc, res.text);
        });
        return;
      }
      this.dialogueUI.show(npc.name, res.text, ['閉じる'], () => this.endTalk(npc));
    });
  }

  // ───────────── NPCからの挑戦 ─────────────

  private onChallenged(npc: Agent): void {
    if (this.state.mode !== 'explore') {
      this.sim.release(npc);
      return;
    }
    this.state.mode = 'dialogue';
    this.clearNearby();
    this.alertNpcId = npc.id;
    this.dialogueCancel = null; // Esc では逃げられない（選ぶ必要がある）
    // さっきプレイヤーに負けたNPCは「仕返し」として挑んでくる
    const revenge = this.sim.relations.get(npc.id, this.me.id).lossStreak > 0;
    this.dialogueUI.show(npc.name, this.say(npc, revenge ? 'challengeRevenge' : 'challenge'), ['勝負する', '逃げる'], (i) => {
      this.alertNpcId = null;
      if (i === 0) this.preBattle(npc, revenge);
      else this.flee(npc);
    });
  }

  private flee(npc: Agent): void {
    const { starLost } = this.sim.playerFled(npc);
    this.state.timeLeft -= Rules.flee.timePenaltySec;
    this.hud.toast(
      starLost
        ? `逃げ遅れた！ ${npc.name}に星を1つ奪われた。（時間 -${Rules.flee.timePenaltySec}秒）`
        : `なんとか逃げ切った。（時間 -${Rules.flee.timePenaltySec}秒）`,
    );
    this.refreshStatus();
    this.endTalk(npc);
    this.checkPlayerEnd();
  }

  // ───────────── カードじゃんけん（プレイヤー対NPC） ─────────────

  // 対戦前の会話：性格・友好度・状況で台詞が変わる（いきなりカード画面にはしない）
  private preBattle(npc: Agent, grudge: boolean): void {
    this.state.mode = 'dialogue';
    this.dialogueCancel = null;
    this.sim.holdForPlayer(npc);
    const { key, text } = moodLine(npc, PRE_BATTLE, this.talkFeatures(npc, { grudge }));
    if (key === 'calm') this.addClueOnce(npc, 'calmPre'); // 妙に落ち着いている

    // マップから「2人のアップ画面」に切り替える
    this.enterDuel(npc);
    this.duel.setExpression('npc', MOOD_EXPRESSION[key] ?? 'neutral');
    this.duel.setExpression('player', PLAYER_EXPRESSION.pre);
    this.duel.speak('npc', talkSeconds(text));
    // プレイヤーの返事（どれを選んでも勝負の結果は変わらない）→ カード勝負へ
    const replies = pickReplies(PLAYER_REPLIES.pre);
    this.dialogueUI.show(npc.name, text, replies.map((r) => `「${r.text}」`), (i) =>
      this.playerSays(replies[i], () => this.startBattle(npc, text.split('\n')[0])),
    );
  }

  // ───────────── 対戦演出（2人のアップ画面） ─────────────

  private duelInfo(npc: Agent): DuelInfo {
    return {
      npcName: npc.name,
      npcLook: this.npcs.lookOf(npc),
      npcPortraitId: npc.portraitId,
      npcStars: npc.stars,
      // 正体を見破った特殊NPCだけ、名前の横に種類を出す（見破っていなければ出さない）
      npcBadge: npc.specialIdentityDetectedByPlayer ? Rules.npcTypes[npc.rank].label : null,
      npcNameColor: this.suspicion.colorOf(npc.id, this.sim.time),
      playerLook: { color: 0xd8c27a, hairColor: 0x2a1d14, gender: 'other' },
      playerStars: this.me.stars,
    };
  }

  // 顔アップ演出を始める（mode：'battle' = 対戦 ／ 'info' = 情報を聞く）。すでに表示中なら表示のしかただけ変える
  private enterDuel(npc: Agent, mode: StageMode = 'battle'): void {
    this.clearNearby();
    if (this.duel.active) {
      this.duel.setMode(mode);
      this.duel.setPlates(this.duelInfo(npc));
      return;
    }
    this.duel.enter(this.duelInfo(npc), mode);
    this.dialogueUI.setDuel(true);
    document.body.classList.add('is-duel'); // マップ用の表示（ジョイスティックなど）を隠す
  }

  private exitDuel(): void {
    if (!this.duel.active) return;
    this.duel.exit();
    this.dialogueUI.setDuel(false);
    document.body.classList.remove('is-duel');
  }

  // プレイヤーが返事をする（表情を変えて少しの間セリフを出し、then へ進む。タップで早送り）
  private playerSays(reply: PlayerReply, then: () => void): void {
    this.duel.setExpression('player', reply.expression);
    this.duel.speak('player', talkSeconds(reply.text));
    this.dialogueUI.say('あなた', reply.text, 1.4, then);
  }

  private startBattle(npc: Agent, line: string): void {
    this.dialogueUI.hide();
    this.duel.hide(); // カード勝負の画面に切り替える（演出はカード勝負のあとに戻ってくる）
    this.dialogueCancel = null;
    this.state.mode = 'battle';
    this.sim.holdForPlayer(npc);
    this.battleUI.open(npc.name, line, this.me.stars, npc.stars, this.me.hand.counts, (card) =>
      this.resolveBattle(npc, card),
    );
  }

  private resolveBattle(npc: Agent, playerCard: CardId): void {
    // 勝負の結果は内部で処理される（プレイヤーに負けたNPCは友好度が下がり、連敗するほど大きく下がる）
    const affBefore = this.affinityOf(npc);
    const rec = this.sim.battleWithPlayer(npc, playerCard);
    const affDelta = this.affinityOf(npc) - affBefore; // 性格によって下がり方が違う（上がることもある）
    this.playerLog.fought.set(npc.id, this.sim.time);
    this.refreshStatus();

    const change = rec.outcome === 'win' ? rec.starMoved : rec.outcome === 'lose' ? -rec.starMoved : 0;
    const npcLine = '……'; // NPCの反応は、このあとの「対戦後の会話」で見せる
    this.recordIntel('battle', [npc.id], '対戦', `${npc.name}は${CARDS[rec.cardB].name}を出した。`);

    this.battleUI.showResult(
      {
        playerCard,
        npcCard: rec.cardB,
        outcome: rec.outcome,
        starChange: change,
        npcLine,
        playerStars: this.me.stars,
        npcStars: npc.stars,
      },
      () => this.postBattle(npc, rec.outcome, affDelta),
    );
  }

  // 対戦後の会話：勝敗・性格・友好度（とその変化）で台詞が変わる。台詞から性格や友好度を推測できる
  private postBattle(npc: Agent, outcome: 'win' | 'lose' | 'draw', affDelta: number): void {
    this.battleUI.hide();
    this.state.mode = 'dialogue';
    this.dialogueCancel = null;
    const grudge = this.sim.relations.get(npc.id, this.me.id).lossStreak > 0;
    const f = this.talkFeatures(npc, { grudge, affinityDelta: affDelta });
    // outcome はプレイヤーから見た結果
    const table = outcome === 'win' ? POST_NPC_LOSE : outcome === 'lose' ? POST_NPC_WIN : POST_DRAW;
    const { key, text } = moodLine(npc, table, f);
    if (outcome === 'lose') this.addClueOnce(npc, 'beatMe'); // 負かされた相手は、ただ者ではないかも
    if (key === 'calm' || key === 'analyze') this.addClueOnce(npc, 'calmPost');

    // 再び2人のアップ画面：勝敗と性格・友好度に合わせた表情で話す
    if (!this.duel.active) this.enterDuel(npc);
    this.duel.show();
    const info = this.duelInfo(npc);
    this.duel.setPlates(info); // 星が変わったので表示を更新
    this.duel.setExpression('npc', MOOD_EXPRESSION[key] ?? 'neutral');
    this.duel.setExpression('player', PLAYER_EXPRESSION[outcome] as ExpressionId);
    this.duel.speak('npc', talkSeconds(text));
    const replies = pickReplies(PLAYER_REPLIES[outcome]);
    this.dialogueUI.show(npc.name, text, replies.map((r) => `「${r.text}」`), (i) =>
      this.playerSays(replies[i], () => {
        this.dialogueUI.hide();
        this.exitDuel(); // マップへ戻る
        this.afterBattle(npc);
      }),
    );
  }

  private afterBattle(npc: Agent): void {
    this.battleUI.hide();
    this.sim.checkRemoval(npc); // 星0なら消滅、カード0ならフロアを去る
    this.sim.release(npc);
    if (!this.checkPlayerEnd()) this.state.mode = 'explore';
  }

  // ───────────── NPCたちの出来事 ─────────────

  private onSimEvent = (e: SimEvent): void => {
    if (e.type === 'challengePlayer') {
      this.onChallenged(e.npc);
      return;
    }
    if (e.type === 'giftOffer') {
      this.onGiftOffer(e.npc, e.cards, e.reason);
      return;
    }
    if (e.type === 'probePlayer') {
      this.onProbe(e.npc);
      return;
    }
    // NPC同士のカードの譲渡：近くにいれば「何かを渡している」ことだけ分かる
    if (e.type === 'gift') {
      if (this.canSee(e.from.x, e.from.z)) this.hud.feed(`${e.from.name}が${e.to.name}に何かを渡している…`);
      return;
    }
    // NPC同士の勝負：内部では正確に処理済み。プレイヤーには「勝負している」ことだけ見せる
    // （出したカード・勝敗・星の動きは表示しない。知りたければNPCに聞くしかない）
    if (e.type === 'battle') {
      const { a, b } = e.rec;
      if (a.isPlayer || b.isPlayer || !this.canSee(e.rec.x, e.rec.z)) return;
      this.hud.feed(`⚔ ${a.name}と${b.name}が勝負している…`);
      this.recordIntel('sighting', [a.id, b.id], '目撃', `${a.name}と${b.name}が勝負しているのを見た。結果は分からない。`);
      return;
    }
    // NPCがいなくなった
    //   失格（星0で消滅）… そのNPCの情報とフラグを、プレイヤーの情報一覧からも完全に消す
    //   カードを使い切って退場 … 情報一覧に [対象NPC不在] を付け、マップ上のフラグを消す
    if (e.type === 'eliminated' || e.type === 'finished') {
      this.refreshRemaining(); // 残り人数をすぐに減らす
      this.suspicion.forget(e.agent.id);
      if (e.type === 'eliminated') this.intel.purgeSubject(e.agent.id);
      else this.intel.markGone(e.agent.id);
      if (this.canSee(e.agent.x, e.agent.z) && e.type === 'finished') {
        this.hud.feed(`${e.agent.name}の姿がフロアから消えた`);
        this.recordIntel('sighting', [e.agent.id], '目撃', `${e.agent.name}がフロアから消えた。理由は分からない。`);
      }
    }
  };

  // プレイヤーが入手した「他のNPCについての情報」を登録する
  private recordIntel(
    kind: IntelKind,
    subjectIds: string[],
    source: string,
    text: string,
    rumor?: Rumor,
    detectedLie = false,
  ): void {
    const npcIds = subjectIds.filter((id) => id !== this.me.id);
    if (npcIds.length === 0) return; // プレイヤー自身についての情報は登録しない
    this.intel.add({
      kind,
      subjectIds: npcIds,
      source,
      text,
      obtainedAt: this.sim.time,
      timeLabel: formatTime(this.state.timeLeft),
      rumor,
      detectedLie,
    });
  }

  private genderOf(id: string): Agent['gender'] {
    return this.sim.agents.find((a) => a.id === id)?.gender ?? 'other';
  }

  private canSee(x: number, z: number): boolean {
    return Math.hypot(x - this.me.x, z - this.me.z) <= Rules.playerSeeDistance;
  }

  private nameOf(id: string): string {
    return this.sim.agents.find((a) => a.id === id)?.name ?? '誰か';
  }

  // ───────────── 星・勝敗 ─────────────

  private refreshStatus(): void {
    this.hud.setStatus(this.me.stars, this.me.hand.counts);
  }

  // 残り人数（今フロアにいる参加者 / ゲーム開始時の総参加人数）
  private refreshRemaining(): void {
    this.hud.setRemaining(this.sim.aliveCount(), this.sim.participants);
  }

  // プレイヤーの勝敗が決まったら終了画面を出す（決まったら true）
  private checkPlayerEnd(): boolean {
    if (this.state.isOver()) return true;
    if (this.me.stars <= 0) {
      this.finish('gameover', '星をすべて失い、あなたは消滅した。');
      return true;
    }
    if (this.me.hand.total() === 0) {
      if (this.me.stars >= this.mode.starsToWin) {
        // 勝利条件達成。ただしまだ終わりではない：時間内に進行役に話しかけて確認してもらう必要がある
        if (!this.winReady) {
          this.winReady = true;
          this.hud.setObjective('勝利条件達成！ 時間内にサングラスの「進行役」を探して報告せよ');
          this.hud.toast('勝利条件達成。進行役に話しかけて、勝利を確認してもらおう。');
        }
        return false;
      }
      this.finish('gameover', `カードを使い切ったが、星は${this.me.stars}個。${this.mode.starsToWin}個に届かなかった。`);
      return true;
    }
    return false;
  }

  private finish(type: 'gameover' | 'clear', message: string): void {
    this.exitDuel();
    this.state.mode = type;
    this.clearNearby();
    this.dialogueUI.hide();
    this.battleUI.hide();
    this.intelUI.hide();
    this.resultUI.show(type, message, () => window.location.reload());
  }

  private onResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    // スマホの縦画面：横の見える範囲が狭くなるので、視野角を広げてカメラを少し引く
    const portrait = width < height;
    this.camera.fov = portrait ? GameConfig.portraitFieldOfView : GameConfig.fieldOfView;
    this.cameraScale = portrait ? GameConfig.portraitCameraScale : 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
}

// 画質の設定を覚えておく場所（ブラウザに保存。保存できなければ毎回の初期値）
const QUALITY_KEY = 'star-game-quality';
function loadQuality(): Quality {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === 'low' || q === 'normal' || q === 'high') return q;
  } catch {
    // 読めない環境では初期値
  }
  // スマホは「標準」（軽さ優先）、PCは「高画質」
  return window.matchMedia('(pointer: coarse)').matches ? 'normal' : 'high';
}

// セリフの長さから、口を動かす時間を決める（短いセリフは短く）
function talkSeconds(text: string): number {
  return Math.min(2.5, Math.max(0.6, text.split('\n')[0].length * 0.08));
}

// 返事の候補から2つ選ぶ（毎回同じにならないように）
function pickReplies(list: PlayerReply[]): PlayerReply[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(2, copy.length));
}
