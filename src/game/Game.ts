import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { GameScene } from './core/Scene';
import { GameCamera } from './core/Camera';
import { InputManager } from './input/InputManager';
import { TerrainManager } from './terrain/TerrainManager';
import { ObstacleSpawner } from './terrain/ObstacleSpawner';
import { AssetManager } from './assets/AssetManager';
import { Player } from './entities/Player';
import { CollisionDetector } from './physics/CollisionDetector';
import { SnowTrail } from './effects/SnowTrail';
import { SnowParticles } from './effects/SnowParticles';
import type { PhysicsSettings } from './physicsSettings';
import { DEFAULT_PHYSICS_SETTINGS, resolvePhysicsSettings } from './physicsSettings';
import type { NpcSettings } from './npcSettings';
import { DEFAULT_NPC_SETTINGS } from './npcSettings';
import { NPC_APPEARANCES, PLAYER_APPEARANCE } from './npcPalette';
import { NpcRacer } from './entities/NpcRacer';
import type { NpcControllerContext, RacerSnapshot, TacticalThreat } from './ai/NpcController';
import type { GameStateType, GameUIState, RaceOutcome, RacePlacement } from './types';

export type UIStateCallback = (state: GameUIState) => void;

const NPC_LANE_SLOTS = [-6, 6, -10, 10, -3, 3, -13, 13, -1, 1];
const NPC_Z_OFFSETS = [-12, -16, -20, -24, -28, -32, -36, -40, -44, -48];
const FINISH_DISTANCE = 1000;
const FINISH_LINE_Z = -FINISH_DISTANCE;

export class Game {
  private renderer: Renderer;
  private gameScene: GameScene;
  private camera: GameCamera;
  private inputManager: InputManager;
  private terrainManager!: TerrainManager;
  private assetManager: AssetManager;
  private player!: Player;
  private npcRacers: NpcRacer[] = [];
  private finishLine!: THREE.Group;
  private collisionDetector: CollisionDetector;
  private snowTrail!: SnowTrail;
  private snowParticles!: SnowParticles;

  private clock = new THREE.Clock(false);
  private animFrameId: number | null = null;
  private gameState: GameStateType = 'MENU';
  private distance = 0;
  private score = 0;
  private physicsSettings: PhysicsSettings;
  private npcSettings: NpcSettings;
  private raceOutcome: RaceOutcome = null;
  private racePlacements: RacePlacement[] = [];
  private finishCounter = 0;
  private playerFinishOrder: number | null = null;
  private npcFinishOrders = new Map<string, number>();

  private onUIStateChange: UIStateCallback | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    physicsSettings: PhysicsSettings = DEFAULT_PHYSICS_SETTINGS,
    npcSettings: NpcSettings = DEFAULT_NPC_SETTINGS,
  ) {
    this.renderer = new Renderer(canvas);
    this.gameScene = new GameScene();
    this.camera = new GameCamera();
    this.inputManager = new InputManager(canvas);
    this.assetManager = new AssetManager();
    this.collisionDetector = new CollisionDetector();
    this.physicsSettings = { ...physicsSettings };
    this.npcSettings = { ...npcSettings };

    this.init();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.camera.resize();
    });
  }

  private init() {
    const playerMesh = this.assetManager.createSnowboarder(PLAYER_APPEARANCE);
    this.gameScene.add(playerMesh);
    this.player = new Player(playerMesh, resolvePhysicsSettings(this.physicsSettings));

    const spawner = new ObstacleSpawner(this.assetManager);
    this.terrainManager = new TerrainManager(this.gameScene.scene, spawner);
    this.snowTrail = new SnowTrail(this.gameScene.scene, this.terrainManager);
    this.snowParticles = new SnowParticles(this.gameScene.scene, this.terrainManager);
    this.finishLine = this.assetManager.create('finishLine');
    this.gameScene.add(this.finishLine);
    this.updateFinishLinePosition();

    const groundY = this.terrainManager.getHeightAt(0, 0);
    this.player.placeAt(0, groundY, 0);
    this.rebuildNpcRacers(0);
    this.resetRaceState();
    this.syncBillboards();

    this.camera.update(0, this.player.position);
    this.camera.camera.position.set(
      this.player.position.x,
      this.player.position.y + 5,
      this.player.position.z + 8
    );
  }

  setUIStateCallback(callback: UIStateCallback) {
    this.onUIStateChange = callback;
    this.emitUIState();
  }

  setPhysicsSettings(settings: PhysicsSettings) {
    this.physicsSettings = { ...settings };
    this.player.setPhysicsSettings(resolvePhysicsSettings(this.physicsSettings));
    for (const npc of this.npcRacers) {
      npc.player.setPhysicsSettings(resolvePhysicsSettings(this.physicsSettings));
    }
  }

  setNpcSettings(settings: NpcSettings) {
    this.npcSettings = { ...settings };
    this.rebuildNpcRacers(this.player.position.z);
    this.syncBillboards();
  }

  private emitUIState() {
    if (this.onUIStateChange) {
      this.onUIStateChange({
        gameState: this.gameState,
        speed: this.player.speed,
        distance: this.distance,
        score: this.score,
        trickName: this.player.pendingTrickName,
        health: this.player.health,
        finishDistance: FINISH_DISTANCE,
        raceOutcome: this.raceOutcome,
        racePlacements: this.racePlacements,
      });
    }
  }

  start() {
    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  pause() {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'PAUSED';
    this.clock.stop();
    this.emitUIState();
  }

  resume() {
    if (this.gameState !== 'PAUSED') return;
    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.pause();
    } else if (this.gameState === 'PAUSED') {
      this.resume();
    }
  }

  restart() {
    this.player.reset();
    this.terrainManager.reset();
    this.snowTrail.reset();
    this.snowParticles.reset();
    this.updateFinishLinePosition();

    const groundY = this.terrainManager.getHeightAt(0, 0);
    this.player.placeAt(0, groundY, 0);
    this.rebuildNpcRacers(0);
    this.resetRaceState();
    this.syncBillboards();

    this.camera.camera.position.set(0, groundY + 5, 8);

    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  private loop = () => {
    if (this.gameState !== 'PLAYING') return;

    this.animFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.inputManager.update();

    // Check pause (Escape)
    if (this.inputManager.state.pause) {
      this.togglePause();
      return;
    }

    if (!this.isPlayerFinished()) {
      this.player.update(dt, this.inputManager.state, this.terrainManager);
    }

    if (this.player.health <= 0) {
      this.endRace('wipeout');
      return;
    }

    for (const npc of this.npcRacers) {
      if (this.isNpcFinished(npc.id)) {
        npc.syncBillboard();
        continue;
      }

      npc.update(dt, this.terrainManager, this.buildNpcContext(npc.id));
    }

    this.captureFinishers();

    const racers = [this.player, ...this.npcRacers.map((npc) => npc.player)];
    const zValues = racers
      .filter((racer, index) => racer.health > 0 && !this.isRacerFinished(index === 0 ? 'player' : this.npcRacers[index - 1].id))
      .map((racer) => racer.position.z);
    const leadZ = zValues.length > 0 ? Math.min(...zValues) : this.player.position.z;
    const trailZ = zValues.length > 0 ? Math.max(...zValues) : this.player.position.z;

    // Terrain chunk recycling
    this.terrainManager.update(trailZ);
    this.updateFinishLinePosition();

    this.snowTrail.update(this.player);
    this.snowParticles.update(dt, this.player);

    // Collisions
    const obstacles = this.terrainManager.getActiveObstaclesInRange(leadZ, trailZ);
    for (let index = 0; index < racers.length; index++) {
      const racer = racers[index];
      const racerId = index === 0 ? 'player' : this.npcRacers[index - 1].id;
      if (racer.health <= 0 || this.isRacerFinished(racerId)) {
        continue;
      }

      const collision = this.collisionDetector.check(racer, obstacles);
      if (collision.hit) {
        racer.hit();
      }
    }

    for (let i = 0; i < racers.length; i++) {
      for (let j = i + 1; j < racers.length; j++) {
        const racerAId = i === 0 ? 'player' : this.npcRacers[i - 1].id;
        const racerBId = j === 0 ? 'player' : this.npcRacers[j - 1].id;
        if (this.isRacerFinished(racerAId) || this.isRacerFinished(racerBId)) {
          continue;
        }

        if (this.collisionDetector.checkRacerCollision(racers[i], racers[j])) {
          racers[i].damage(1);
          racers[j].damage(1);
        }
      }
    }

    if (this.player.health <= 0) {
      this.endRace('wipeout');
      return;
    }

    // Update score (distance + tricks)
    this.distance = Math.min(FINISH_DISTANCE, this.player.distanceTraveled);
    this.score = this.player.score;
    this.racePlacements = this.buildRacePlacements();

    if (this.isPlayerFinished()) {
      this.endRace('finished');
      return;
    }

    // Camera
    this.camera.update(dt, this.player.position);
    this.syncBillboards();

    this.emitUIState();
  }

  private render() {
    this.renderer.render(this.gameScene.scene, this.camera.camera);
  }

  private endRace(outcome: Exclude<RaceOutcome, null>) {
    this.distance = Math.min(FINISH_DISTANCE, this.player.distanceTraveled);
    this.score = this.player.score;
    this.raceOutcome = outcome;
    this.racePlacements = this.buildRacePlacements();
    this.gameState = 'GAME_OVER';
    this.clock.stop();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.emitUIState();
  }

  private buildNpcContext(racerId: string): NpcControllerContext {
    const snapshots = this.getRacerSnapshots();

    return {
      racerId,
      obstacles: this.getRaceObstacles(),
      racers: snapshots,
      incomingThreats: this.getProjectedThreats(racerId, snapshots),
    };
  }

  private getRaceObstacles() {
    const racers = [this.player, ...this.npcRacers.map((npc) => npc.player)];
    const livingRacers = racers.filter((racer) => racer.health > 0);
    const leadZ = livingRacers.length > 0
      ? Math.min(...livingRacers.map((racer) => racer.position.z))
      : this.player.position.z;
    const trailZ = livingRacers.length > 0
      ? Math.max(...livingRacers.map((racer) => racer.position.z))
      : this.player.position.z;
    return this.terrainManager.getActiveObstaclesInRange(leadZ, trailZ);
  }

  private getRacerSnapshots(): RacerSnapshot[] {
    const snapshots: RacerSnapshot[] = [
      {
        id: 'player',
        position: this.player.position.clone(),
        speed: this.player.speed,
        health: this.player.health,
        score: this.player.score,
      },
    ];

    for (const npc of this.npcRacers) {
      snapshots.push(npc.snapshot());
    }

    return snapshots;
  }

  private getProjectedThreats(racerId: string, snapshots: RacerSnapshot[]): TacticalThreat[] {
    return snapshots
      .filter((snapshot) => snapshot.id !== racerId && snapshot.health > 0)
      .map((snapshot) => ({
        kind: 'racer' as const,
        sourceId: snapshot.id,
        position: new THREE.Vector3(
          snapshot.position.x,
          snapshot.position.y,
          snapshot.position.z - snapshot.speed * 0.45,
        ),
        radius: 2.4,
        weight: 0.45,
      }));
  }

  private rebuildNpcRacers(anchorZ: number) {
    for (const npc of this.npcRacers) {
      npc.dispose(this.gameScene.scene);
    }
    this.npcRacers = [];

    for (let i = 0; i < this.npcSettings.count; i++) {
      const appearance = NPC_APPEARANCES[i % NPC_APPEARANCES.length];
      const mesh = this.assetManager.createSnowboarder(appearance);
      this.gameScene.add(mesh);

      const racer = new Player(mesh, resolvePhysicsSettings(this.physicsSettings));
      const npc = new NpcRacer({
        id: `npc-${i + 1}`,
        name: `RIVAL ${i + 1}`,
        settings: this.npcSettings,
        player: racer,
        appearance,
        laneBias: NPC_LANE_SLOTS[i % NPC_LANE_SLOTS.length],
      }, this.gameScene.scene);

      racer.reset();
      const x = NPC_LANE_SLOTS[i % NPC_LANE_SLOTS.length];
      const z = anchorZ + NPC_Z_OFFSETS[i % NPC_Z_OFFSETS.length];
      const y = this.terrainManager.getHeightAt(x, z);
      racer.placeAt(x, y, z);
      npc.syncBillboard();
      this.npcRacers.push(npc);
    }
  }

  private syncBillboards() {
    for (const npc of this.npcRacers) {
      npc.syncBillboard();
    }
  }

  private resetRaceState() {
    this.distance = 0;
    this.score = 0;
    this.raceOutcome = null;
    this.finishCounter = 0;
    this.playerFinishOrder = null;
    this.npcFinishOrders = new Map();
    this.racePlacements = this.buildRacePlacements();
  }

  private updateFinishLinePosition() {
    if (!this.finishLine) {
      return;
    }

    const y = this.terrainManager.getHeightAt(0, FINISH_LINE_Z);
    this.finishLine.position.set(0, y, FINISH_LINE_Z);
  }

  private captureFinishers() {
    if (!this.isPlayerFinished() && this.player.distanceTraveled >= FINISH_DISTANCE) {
      this.playerFinishOrder = ++this.finishCounter;
      this.player.speed = 0;
      this.player.velocity.set(0, 0, 0);
    }

    for (const npc of this.npcRacers) {
      if (this.isNpcFinished(npc.id) || npc.player.distanceTraveled < FINISH_DISTANCE) {
        continue;
      }

      this.npcFinishOrders.set(npc.id, ++this.finishCounter);
      npc.player.speed = 0;
      npc.player.velocity.set(0, 0, 0);
    }
  }

  private isPlayerFinished() {
    return this.playerFinishOrder !== null;
  }

  private isNpcFinished(npcId: string) {
    return this.npcFinishOrders.has(npcId);
  }

  private isRacerFinished(racerId: string) {
    return racerId === 'player' ? this.isPlayerFinished() : this.isNpcFinished(racerId);
  }

  private buildRacePlacements(): RacePlacement[] {
    const placements = [
      {
        id: 'player',
        name: 'YOU',
        score: this.player.score,
        distance: Math.min(FINISH_DISTANCE, this.player.distanceTraveled),
        isPlayer: true,
        finished: this.isPlayerFinished(),
        eliminated: this.player.health <= 0,
        finishOrder: this.playerFinishOrder,
      },
      ...this.npcRacers.map((npc) => ({
        id: npc.id,
        name: npc.name,
        score: npc.player.score,
        distance: Math.min(FINISH_DISTANCE, npc.player.distanceTraveled),
        isPlayer: false,
        finished: this.isNpcFinished(npc.id),
        eliminated: npc.player.health <= 0,
        finishOrder: this.npcFinishOrders.get(npc.id) ?? null,
      })),
    ];

    placements.sort((left, right) => {
      if (left.finished !== right.finished) {
        return left.finished ? -1 : 1;
      }

      if (left.finished && right.finished && left.finishOrder !== right.finishOrder) {
        return (left.finishOrder ?? Number.MAX_SAFE_INTEGER) - (right.finishOrder ?? Number.MAX_SAFE_INTEGER);
      }

      if (right.distance !== left.distance) {
        return right.distance - left.distance;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.eliminated !== right.eliminated) {
        return left.eliminated ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });

    return placements.map((placement, index) => ({
      id: placement.id,
      name: placement.name,
      place: index + 1,
      score: placement.score,
      distance: placement.distance,
      isPlayer: placement.isPlayer,
      finished: placement.finished,
      eliminated: placement.eliminated,
    }));
  }

  dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.gameScene.remove(this.finishLine);
    const checkerTexture = this.finishLine?.userData?.checkerTexture as THREE.Texture | undefined;
    checkerTexture?.dispose();
    for (const npc of this.npcRacers) {
      npc.dispose(this.gameScene.scene);
    }
    this.snowTrail.dispose(this.gameScene.scene);
    this.snowParticles.dispose(this.gameScene.scene);
    this.renderer.dispose();
  }
}
