import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { ObstacleData } from '../types';

export interface CollisionResult {
  hit: boolean;
  obstacle?: ObstacleData;
}

const _obsBox = new THREE.Box3();
const _halfVec = new THREE.Vector3();

export class CollisionDetector {
  check(player: Player, obstacles: ObstacleData[]): CollisionResult {
    if (player.invulnerable) return { hit: false };

    const playerBox = player.getBoundingBox();

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

      _obsBox.min.copy(obsPos).sub(_halfVec);
      _obsBox.max.copy(obsPos).add(_halfVec);

      if (obstacle.type === 'ramp') {
        // Ramps trigger launches via AABB overlap, not damage
        if (playerBox.intersectsBox(_obsBox) && !player.airborne) {
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

        if (playerBox.intersectsBox(_obsBox) && nearRailTop && player.velocity.y <= 2.5) {
          player.attachToRail(obstacle);
        }
        continue;
      }

      // Trees and rocks deal damage
      if (playerBox.intersectsBox(_obsBox)) {
        return { hit: true, obstacle };
      }
    }

    return { hit: false };
  }

  checkRacerCollision(a: Player, b: Player): boolean {
    if (a.health <= 0 || b.health <= 0) return false;

    const aBox = a.getBoundingBox();
    const bBox = b.getBoundingBox();
    return aBox.intersectsBox(bBox);
  }
}
