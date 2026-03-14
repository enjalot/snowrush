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
      // Quick distance pre-filter
      const dist = player.position.distanceTo(obstacle.mesh.position);
      if (dist > 8) continue;

      const obsPos = obstacle.mesh.position;
      const scale = obstacle.mesh.scale.x;
      _halfVec.copy(obstacle.boundingSize).multiplyScalar(scale);

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

      // Trees and rocks deal damage
      if (playerBox.intersectsBox(_obsBox)) {
        return { hit: true, obstacle };
      }
    }

    return { hit: false };
  }
}
