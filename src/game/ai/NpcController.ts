import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { NpcSettings } from '../npcSettings';
import type { InputState, ObstacleData, TrickType } from '../types';
import { clamp, lerp } from '../utils/math';

export interface TacticalThreat {
  kind: 'obstacle' | 'racer' | 'projectile' | 'hazard';
  position: THREE.Vector3;
  radius: number;
  weight: number;
  sourceId?: string;
}

export interface RacerSnapshot {
  id: string;
  position: THREE.Vector3;
  speed: number;
  health: number;
  score: number;
}

export interface NpcControllerContext {
  racerId: string;
  obstacles: ObstacleData[];
  racers: RacerSnapshot[];
  incomingThreats: TacticalThreat[];
}

interface TrickPlan {
  kind: Exclude<TrickType, null>;
  holdTime: number;
  elapsed: number;
}

function createNeutralInput(): InputState {
  return {
    steer: 0,
    accelerate: 0,
    jump: false,
    jumpHeld: false,
    pause: false,
  };
}

export class NpcController {
  private settings: NpcSettings;
  private laneBias: number;
  private wasAirborne = false;
  private trickPlan: TrickPlan | null = null;
  private rampCooldown = 0;
  private driftPhase = Math.random() * Math.PI * 2;

  constructor(settings: NpcSettings, laneBias: number) {
    this.settings = settings;
    this.laneBias = laneBias;
  }

  setSettings(settings: NpcSettings) {
    this.settings = settings;
  }

  update(dt: number, racer: Player, context: NpcControllerContext): InputState {
    this.rampCooldown = Math.max(0, this.rampCooldown - dt);

    if (!racer.airborne && this.wasAirborne) {
      this.trickPlan = null;
    }

    const input = racer.airborne
      ? this.updateAirborne(dt)
      : this.updateGround(racer, context);

    this.wasAirborne = racer.airborne;
    return input;
  }

  private updateGround(racer: Player, context: NpcControllerContext): InputState {
    const input = createNeutralInput();
    const awarenessRatio = this.settings.awareness / 100;
    const aggressionRatio = this.settings.aggression / 100;
    const trickRatio = this.settings.trickiness / 100;
    const lookAhead = lerp(9, 19, awarenessRatio) + racer.speed * 0.14;
    let targetX = clamp(this.laneBias, -12, 12);
    let hazardPressure = 0;
    let bestRamp: ObstacleData | null = null;
    let bestRampScore = -Infinity;

    for (const obstacle of context.obstacles) {
      const aheadDistance = racer.position.z - obstacle.mesh.position.z;
      if (aheadDistance <= 0 || aheadDistance > lookAhead) {
        continue;
      }

      const obstacleX = obstacle.mesh.position.x;
      const lateralDelta = obstacleX - racer.position.x;
      const reach = obstacle.boundingSize.x + 1.6;
      const closeness = 1 - aheadDistance / lookAhead;

      if (obstacle.type === 'ramp') {
        const alignment = 1 - Math.min(1, Math.abs(lateralDelta) / 8);
        const rampScore = alignment * (0.45 + trickRatio * 0.85) - hazardPressure * 0.35;
        if (rampScore > bestRampScore) {
          bestRampScore = rampScore;
          bestRamp = obstacle;
        }
        continue;
      }

      const overlap = 1 - Math.min(1, Math.abs(lateralDelta) / reach);
      if (overlap <= 0) {
        continue;
      }

      const pushStrength = overlap * closeness * (0.5 + awarenessRatio * 0.55);
      targetX += Math.sign(racer.position.x - obstacleX || this.laneBias || 1) * pushStrength * 4.4;
      hazardPressure = Math.max(hazardPressure, pushStrength);
    }

    for (const other of context.racers) {
      if (other.id === context.racerId || other.health <= 0) {
        continue;
      }

      const dz = racer.position.z - other.position.z;
      if (Math.abs(dz) > 10) {
        continue;
      }

      const dx = other.position.x - racer.position.x;
      const lateralOverlap = 1 - Math.min(1, Math.abs(dx) / 3.8);
      if (lateralOverlap <= 0) {
        continue;
      }

      const closeness = 1 - Math.min(1, Math.abs(dz) / 10);
      const threat = lateralOverlap * closeness * (1 - aggressionRatio * 0.25);
      const direction = dx === 0 ? Math.sign(this.laneBias || 1) : -Math.sign(dx);
      targetX += direction * threat * 3.8;
      hazardPressure = Math.max(hazardPressure, threat * 0.9);
    }

    for (const threat of context.incomingThreats) {
      const dz = racer.position.z - threat.position.z;
      if (dz < -4 || dz > lookAhead) {
        continue;
      }

      const dx = threat.position.x - racer.position.x;
      const lateralPressure = 1 - Math.min(1, Math.abs(dx) / Math.max(2, threat.radius + 1.5));
      if (lateralPressure <= 0) {
        continue;
      }

      const direction = dx === 0 ? Math.sign(this.laneBias || 1) : -Math.sign(dx);
      targetX += direction * lateralPressure * threat.weight * 4.6;
      hazardPressure = Math.max(hazardPressure, lateralPressure * threat.weight);
    }

    if (bestRamp && bestRampScore > 0.05 && this.rampCooldown <= 0 && hazardPressure < 0.9) {
      targetX = lerp(targetX, bestRamp.mesh.position.x, 0.58 + trickRatio * 0.14);

      const rampDistance = racer.position.z - bestRamp.mesh.position.z;
      const rampAligned = Math.abs(bestRamp.mesh.position.x - racer.position.x) < 1.8;
      if (rampDistance < 6 && rampAligned && trickRatio > 0.12) {
        this.trickPlan = this.createTrickPlan();
        this.rampCooldown = lerp(1.05, 0.45, trickRatio);
      }
    } else {
      targetX = lerp(targetX, this.laneBias, 0.12 + awarenessRatio * 0.08);
    }

    if (Math.abs(racer.position.x) > 13) {
      targetX = 0;
      hazardPressure = 1;
    }

    this.driftPhase += 0.7 + trickRatio * 0.55;
    const styleDrift = Math.sin(this.driftPhase) * lerp(0.15, 0.7, trickRatio * 0.75) * Math.max(0, 1 - hazardPressure * 1.15);
    targetX += styleDrift;

    input.steer = clamp((targetX - racer.position.x) / 3.6, -0.82, 0.82);
    const cruiseThrottle = lerp(0.42, 0.72, aggressionRatio * 0.6 + awarenessRatio * 0.2);
    input.accelerate = hazardPressure > 0.62 ? -0.45 : cruiseThrottle;
    return input;
  }

  private updateAirborne(dt: number): InputState {
    const input = createNeutralInput();
    if (!this.trickPlan) {
      return input;
    }

    this.trickPlan.elapsed += dt;
    const holding = this.trickPlan.elapsed < this.trickPlan.holdTime;

    switch (this.trickPlan.kind) {
      case 'spin-left':
        input.steer = holding ? -1 : 0;
        break;
      case 'spin-right':
        input.steer = holding ? 1 : 0;
        break;
      case 'frontflip':
        input.accelerate = holding ? 1 : 0;
        break;
      case 'backflip':
        input.accelerate = holding ? -1 : 0;
        break;
    }

    return input;
  }

  private createTrickPlan(): TrickPlan {
    const trickRatio = this.settings.trickiness / 100;
    const aggressionRatio = this.settings.aggression / 100;
    const roll = Math.random();
    let kind: Exclude<TrickType, null>;

    if (roll < 0.38 + trickRatio * 0.3) {
      kind = Math.random() < 0.5 ? 'frontflip' : 'backflip';
    } else {
      kind = Math.random() < 0.5 ? 'spin-left' : 'spin-right';
    }

    return {
      kind,
      holdTime: lerp(0.22, 0.62, Math.min(1, trickRatio * 0.8 + aggressionRatio * 0.2)),
      elapsed: 0,
    };
  }
}
