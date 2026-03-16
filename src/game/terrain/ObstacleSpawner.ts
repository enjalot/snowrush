import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import { AssetManager } from '../assets/AssetManager';
import { CHUNK_WIDTH, CHUNK_DEPTH, TRAIL_HALF_WIDTH } from './TerrainConfig';
import { randomRange } from '../utils/math';
import type { ObstacleData } from '../types';

interface SpawnOptions {
  length?: number;
}

const RAIL_TOP_HEIGHT = 0.82;

export class ObstacleSpawner {
  private assetManager: AssetManager;

  constructor(assetManager: AssetManager) {
    this.assetManager = assetManager;
  }

  populate(chunk: TerrainChunk, scene: THREE.Scene) {
    const zStart = chunk.zStart;
    const zEnd = chunk.zEnd;

    // Trees along edges (higher density outside trail)
    const treeCount = Math.floor(randomRange(9, 17));
    for (let i = 0; i < treeCount; i++) {
      for (let attempt = 0; attempt < 5; attempt++) {
        let x: number;
        if (Math.random() < 0.3) {
          // Some trees in the trail area (sparse)
          x = randomRange(-TRAIL_HALF_WIDTH, TRAIL_HALF_WIDTH);
        } else {
          // Most trees at edges
          const side = Math.random() < 0.5 ? -1 : 1;
          x = side * randomRange(TRAIL_HALF_WIDTH * 0.6, CHUNK_WIDTH / 2 - 1);
        }
        const z = randomRange(zEnd + 2, zStart - 2);
        if (this.spawnObstacle('tree', x, z, chunk, scene)) {
          break;
        }
      }
    }

    // Rocks (medium density, mostly in trail)
    const rockCount = Math.floor(randomRange(3, 7));
    for (let i = 0; i < rockCount; i++) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const x = randomRange(-TRAIL_HALF_WIDTH * 0.8, TRAIL_HALF_WIDTH * 0.8);
        const z = randomRange(zEnd + 5, zStart - 5);
        if (this.spawnObstacle('rock', x, z, chunk, scene)) {
          break;
        }
      }
    }

    // Ramp (occasional, near center)
    if (Math.random() < 0.4) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const x = randomRange(-TRAIL_HALF_WIDTH * 0.4, TRAIL_HALF_WIDTH * 0.4);
        const z = randomRange(zEnd + CHUNK_DEPTH * 0.3, zStart - CHUNK_DEPTH * 0.3);
        if (this.spawnObstacle('ramp', x, z, chunk, scene)) {
          break;
        }
      }
    }

    const railCount = Math.random() < 0.72 ? (Math.random() < 0.28 ? 2 : 1) : 0;
    for (let i = 0; i < railCount; i++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const length = randomRange(8, 18);
        const side = Math.random() < 0.5 ? -1 : 1;
        const prefersEdge = Math.random() < 0.85;
        const x = prefersEdge
          ? side * randomRange(TRAIL_HALF_WIDTH * 0.58, CHUNK_WIDTH / 2 - 4.5)
          : side * randomRange(TRAIL_HALF_WIDTH * 0.28, TRAIL_HALF_WIDTH * 0.58);
        const z = randomRange(zEnd + length / 2 + 4, zStart - length / 2 - 4);
        if (this.spawnObstacle('rail', x, z, chunk, scene, { length })) {
          break;
        }
      }
    }
  }

  private spawnObstacle(
    type: 'tree' | 'rock' | 'ramp' | 'rail',
    x: number,
    z: number,
    chunk: TerrainChunk,
    scene: THREE.Scene,
    options: SpawnOptions = {},
  ): boolean {
    let mesh: THREE.Group;
    let rail: ObstacleData['rail'];

    if (type === 'rail') {
      const length = options.length ?? 12;
      const halfLength = length / 2;
      const startZ = z + halfLength;
      const endZ = z - halfLength;
      const supportCount = Math.max(2, Math.round(length / 4));
      const supportGroundYs: number[] = [];

      for (let index = 0; index < supportCount; index++) {
        const t = supportCount === 1 ? 0.5 : index / (supportCount - 1);
        const supportZ = THREE.MathUtils.lerp(startZ - 0.6, endZ + 0.6, t);
        supportGroundYs.push(chunk.getHeightAt(x, supportZ));
      }

      const startTopY = chunk.getHeightAt(x, startZ) + RAIL_TOP_HEIGHT;
      const endTopY = chunk.getHeightAt(x, endZ) + RAIL_TOP_HEIGHT;
      const minGroundY = Math.min(...supportGroundYs);
      const maxTopY = Math.max(startTopY, endTopY);
      const centerY = (minGroundY + maxTopY) / 2;

      mesh = this.assetManager.createRail({
        length,
        startTopY: startTopY - centerY,
        endTopY: endTopY - centerY,
        supportGroundYs: supportGroundYs.map((groundY) => groundY - centerY),
      });

      rail = {
        centerX: x,
        startZ,
        endZ,
        height: RAIL_TOP_HEIGHT,
        length,
        startTopY,
        endTopY,
      };
      mesh.position.set(x, centerY, z);
    } else {
      mesh = this.assetManager.create(type);
      const y = chunk.getHeightAt(x, z);
      mesh.position.set(x, y, z);
    }

    const boundingSize = (mesh.userData.boundingSize as THREE.Vector3).clone();

    if (!this.canPlaceObstacle(chunk, x, z, boundingSize)) {
      return false;
    }

    // Slight random rotation for trees and rocks
    if (type !== 'ramp') {
      mesh.rotation.y = Math.random() * Math.PI * 2;
    }

    // Random scale variation for trees
    if (type === 'tree') {
      const scale = 0.7 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);
    }

    if (type === 'rail') {
      mesh.rotation.set(0, 0, 0);
    }

    scene.add(mesh);

    const obstacleData: ObstacleData = {
      mesh,
      type,
      boundingSize,
      rail,
    };
    chunk.obstacles.push(obstacleData);
    return true;
  }

  private canPlaceObstacle(
    chunk: TerrainChunk,
    x: number,
    z: number,
    boundingSize: THREE.Vector3,
  ): boolean {
    for (const obstacle of chunk.obstacles) {
      const otherHalfX = obstacle.boundingSize.x * obstacle.mesh.scale.x;
      const otherHalfZ = obstacle.boundingSize.z * obstacle.mesh.scale.z;
      const selfHalfX = boundingSize.x;
      const selfHalfZ = boundingSize.z;

      if (
        Math.abs(x - obstacle.mesh.position.x) < selfHalfX + otherHalfX + 1.2 &&
        Math.abs(z - obstacle.mesh.position.z) < selfHalfZ + otherHalfZ + 2.4
      ) {
        return false;
      }
    }

    return true;
  }
}
