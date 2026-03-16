import * as THREE from 'three';
import { NpcController, type NpcControllerContext, type RacerSnapshot } from '../ai/NpcController';
import type { TerrainManager } from '../terrain/TerrainManager';
import type { NpcSettings } from '../npcSettings';
import type { SnowboarderAppearance } from '../types';
import { Player } from './Player';
import { RacerBillboard } from '../ui/RacerBillboard';

export interface NpcRacerOptions {
  id: string;
  name: string;
  settings: NpcSettings;
  player: Player;
  appearance: SnowboarderAppearance;
  laneBias: number;
}

export class NpcRacer {
  readonly id: string;
  readonly name: string;
  readonly player: Player;
  readonly appearance: SnowboarderAppearance;

  private controller: NpcController;
  private billboard: RacerBillboard;
  private labelTarget = new THREE.Vector3();
  private laneBias: number;
  private recoveryCount = 0;
  private stagnantDistance = 0;
  private stagnantTimer = 0;

  constructor(options: NpcRacerOptions, scene: THREE.Scene) {
    this.id = options.id;
    this.name = options.name;
    this.player = options.player;
    this.appearance = options.appearance;
    this.laneBias = options.laneBias;
    this.controller = new NpcController(options.settings, options.laneBias);
    this.billboard = new RacerBillboard(options.name, options.appearance.labelColor);
    scene.add(this.billboard.sprite);
  }

  setSettings(settings: NpcSettings) {
    this.controller.setSettings(settings);
  }

  update(dt: number, terrainManager: TerrainManager, context: NpcControllerContext) {
    if (this.player.health > 0) {
      const previousZ = this.player.position.z;
      const input = this.controller.update(dt, this.player, context);
      this.player.update(dt, input, terrainManager);
      this.updateRecovery(dt, previousZ, terrainManager);
    }

    this.syncBillboard();
  }

  syncBillboard() {
    this.billboard.update(
      this.player.score,
      this.player.getLabelAnchorPosition(this.labelTarget),
      this.player.health > 0,
    );
  }

  snapshot(): RacerSnapshot {
    return {
      id: this.id,
      position: this.player.position.clone(),
      speed: this.player.speed,
      health: this.player.health,
      score: this.player.score,
    };
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.player.mesh);
    scene.remove(this.billboard.sprite);
    this.billboard.dispose();
  }

  private updateRecovery(dt: number, previousZ: number, terrainManager: TerrainManager) {
    if (this.player.airborne || this.player.health <= 0 || this.player.outOfBounds) {
      this.stagnantDistance = Math.floor(this.player.distanceTraveled);
      this.stagnantTimer = 0;
      return;
    }

    const roundedDistance = Math.floor(this.player.distanceTraveled);
    const changedDistance = roundedDistance !== this.stagnantDistance;

    if (changedDistance) {
      this.stagnantDistance = roundedDistance;
      this.stagnantTimer = 0;
      return;
    }

    this.stagnantTimer += dt;
    if (this.stagnantTimer < 2) {
      return;
    }

    this.recoveryCount += 1;
    this.stagnantTimer = 0;
    const recoveryX = THREE.MathUtils.clamp(
      this.laneBias + Math.sin(this.recoveryCount * 1.73 + this.laneBias) * 2.25,
      -11.5,
      11.5,
    );
    const recoveryZ = Math.min(previousZ, this.player.position.z) - (14 + (this.recoveryCount % 3) * 2);
    const recoveryY = terrainManager.getHeightAt(recoveryX, recoveryZ);
    this.player.relocateTo(recoveryX, recoveryY, recoveryZ, 10, 0);
    this.stagnantDistance = Math.floor(this.player.distanceTraveled);
  }
}
