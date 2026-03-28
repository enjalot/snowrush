import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { ObstacleData } from '../types';

export interface CollisionResult {
  hit: boolean;
  obstacle?: ObstacleData;
}

type CrashcatModule = {
  registerAll: () => void;
  box: {
    create: (settings: { halfExtents: [number, number, number] }) => unknown;
  };
  collideShapeVsShape: (
    collector: { addHit: (hit: { penetration: number }) => void; addMiss: () => void; shouldEarlyOut: () => boolean; hit?: { penetration: number } | null; reset?: () => void; bodyIdB?: number; earlyOutFraction?: number },
    settings: unknown,
    shapeA: unknown,
    subShapeIdA: number,
    subShapeIdBitsA: number,
    posAX: number,
    posAY: number,
    posAZ: number,
    quatAX: number,
    quatAY: number,
    quatAZ: number,
    quatAW: number,
    scaleAX: number,
    scaleAY: number,
    scaleAZ: number,
    shapeB: unknown,
    subShapeIdB: number,
    subShapeIdBitsB: number,
    posBX: number,
    posBY: number,
    posBZ: number,
    quatBX: number,
    quatBY: number,
    quatBZ: number,
    quatBW: number,
    scaleBX: number,
    scaleBY: number,
    scaleBZ: number,
  ) => void;
  createAnyCollideShapeCollector: () => {
    hit: { penetration: number } | null;
    bodyIdB: number;
    earlyOutFraction: number;
    addHit: (hit: { penetration: number }) => void;
    addMiss: () => void;
    shouldEarlyOut: () => boolean;
    reset: () => void;
  };
  createDefaultCollideShapeSettings: () => unknown;
};

interface CrashcatRuntime {
  crashcat: CrashcatModule;
  collector: ReturnType<CrashcatModule['createAnyCollideShapeCollector']>;
  settings: unknown;
  shapeCache: Map<string, unknown>;
}

const _obsBox = new THREE.Box3();
const _halfVec = new THREE.Vector3();
const _playerHalf = new THREE.Vector3();

export class CollisionDetector {
  private crashcatRuntime: CrashcatRuntime | null = null;
  private crashcatAvailable = true;

  constructor() {
    void this.initCrashcat();
  }

  private async initCrashcat() {
    try {
      const crashcatModule = await import(
        /* @vite-ignore */ 'https://esm.sh/crashcat@latest?target=es2022'
      ) as CrashcatModule;

      crashcatModule.registerAll();

      this.crashcatRuntime = {
        crashcat: crashcatModule,
        collector: crashcatModule.createAnyCollideShapeCollector(),
        settings: crashcatModule.createDefaultCollideShapeSettings(),
        shapeCache: new Map(),
      };
    } catch {
      this.crashcatAvailable = false;
      this.crashcatRuntime = null;
    }
  }

  private getShapeForHalfExtents(halfExtents: THREE.Vector3): unknown {
    const runtime = this.crashcatRuntime;
    if (!runtime) return null;

    const key = `${halfExtents.x.toFixed(3)}:${halfExtents.y.toFixed(3)}:${halfExtents.z.toFixed(3)}`;
    const cached = runtime.shapeCache.get(key);
    if (cached) {
      return cached;
    }

    const shape = runtime.crashcat.box.create({
      halfExtents: [halfExtents.x, halfExtents.y, halfExtents.z],
    });
    runtime.shapeCache.set(key, shape);
    return shape;
  }

  private checkOverlapWithCrashcat(
    aPosition: THREE.Vector3,
    aHalfExtents: THREE.Vector3,
    bPosition: THREE.Vector3,
    bHalfExtents: THREE.Vector3,
  ): boolean {
    const runtime = this.crashcatRuntime;
    if (!runtime) {
      return false;
    }

    const shapeA = this.getShapeForHalfExtents(aHalfExtents);
    const shapeB = this.getShapeForHalfExtents(bHalfExtents);
    if (!shapeA || !shapeB) {
      return false;
    }

    const collector = runtime.collector;
    collector.reset();
    collector.bodyIdB = -1;
    collector.earlyOutFraction = Number.MAX_VALUE;

    runtime.crashcat.collideShapeVsShape(
      collector,
      runtime.settings,
      shapeA,
      -1,
      0,
      aPosition.x,
      aPosition.y,
      aPosition.z,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      shapeB,
      -1,
      0,
      bPosition.x,
      bPosition.y,
      bPosition.z,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
    );

    return collector.hit !== null && collector.hit.penetration >= 0;
  }

  private intersects(
    aPosition: THREE.Vector3,
    aHalfExtents: THREE.Vector3,
    bPosition: THREE.Vector3,
    bHalfExtents: THREE.Vector3,
  ) {
    if (this.crashcatRuntime) {
      return this.checkOverlapWithCrashcat(aPosition, aHalfExtents, bPosition, bHalfExtents);
    }

    _obsBox.min.copy(bPosition).sub(bHalfExtents);
    _obsBox.max.copy(bPosition).add(bHalfExtents);

    const playerBox = new THREE.Box3(
      aPosition.clone().sub(aHalfExtents),
      aPosition.clone().add(aHalfExtents),
    );

    return playerBox.intersectsBox(_obsBox);
  }

  check(player: Player, obstacles: ObstacleData[]): CollisionResult {
    if (player.invulnerable) return { hit: false };

    if (!this.crashcatRuntime && this.crashcatAvailable) {
      // Still attempting async initialization; keep gameplay responsive with fallback checks.
    }

    const playerHalf = player.mesh.userData.boundingSize as THREE.Vector3;
    _playerHalf.copy(playerHalf);

    for (const obstacle of obstacles) {
      const obsPos = obstacle.mesh.position;
      _halfVec.set(
        obstacle.boundingSize.x * obstacle.mesh.scale.x,
        obstacle.boundingSize.y * obstacle.mesh.scale.y,
        obstacle.boundingSize.z * obstacle.mesh.scale.z,
      );

      // Quick distance pre-filter
      const dist = player.position.distanceTo(obsPos);
      if (dist > 8 + Math.max(_halfVec.x, _halfVec.z)) continue;

      const overlaps = this.intersects(player.position, _playerHalf, obsPos, _halfVec);

      if (obstacle.type === 'ramp') {
        // Ramps trigger launches via overlap, not damage
        if (overlaps && !player.airborne) {
          const launchForce = 6 + player.speed * 0.15;
          player.launch(launchForce);
        }
        continue;
      }

      if (obstacle.type === 'rail') {
        if (!obstacle.rail) continue;

        const railTopMin = Math.min(obstacle.rail.startTopY, obstacle.rail.endTopY);
        const railTopMax = Math.max(obstacle.rail.startTopY, obstacle.rail.endTopY);
        const nearRailTop =
          player.position.y >= railTopMin - 0.6 &&
          player.position.y <= railTopMax + 1.5;

        if (overlaps && nearRailTop && player.velocity.y <= 2.5) {
          player.attachToRail(obstacle);
        }
        continue;
      }

      // Trees and rocks deal damage
      if (overlaps) {
        return { hit: true, obstacle };
      }
    }

    return { hit: false };
  }

  checkRacerCollision(a: Player, b: Player): boolean {
    if (a.health <= 0 || b.health <= 0) return false;

    const aHalf = a.mesh.userData.boundingSize as THREE.Vector3;
    const bHalf = b.mesh.userData.boundingSize as THREE.Vector3;

    return this.intersects(a.position, aHalf, b.position, bHalf);
  }
}
