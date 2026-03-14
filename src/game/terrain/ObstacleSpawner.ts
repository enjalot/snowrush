import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import { AssetManager } from '../assets/AssetManager';
import { CHUNK_WIDTH, CHUNK_DEPTH, TRAIL_HALF_WIDTH } from './TerrainConfig';
import { randomRange } from '../utils/math';
import type { ObstacleData } from '../types';

export class ObstacleSpawner {
  private assetManager: AssetManager;

  constructor(assetManager: AssetManager) {
    this.assetManager = assetManager;
  }

  populate(chunk: TerrainChunk, scene: THREE.Scene) {
    const zStart = chunk.zStart;
    const zEnd = chunk.zEnd;

    // Trees along edges (higher density outside trail)
    const treeCount = Math.floor(randomRange(6, 12));
    for (let i = 0; i < treeCount; i++) {
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
      this.spawnObstacle('tree', x, z, chunk, scene);
    }

    // Rocks (medium density, mostly in trail)
    const rockCount = Math.floor(randomRange(2, 5));
    for (let i = 0; i < rockCount; i++) {
      const x = randomRange(-TRAIL_HALF_WIDTH * 0.8, TRAIL_HALF_WIDTH * 0.8);
      const z = randomRange(zEnd + 5, zStart - 5);
      this.spawnObstacle('rock', x, z, chunk, scene);
    }

    // Ramp (occasional, near center)
    if (Math.random() < 0.4) {
      const x = randomRange(-TRAIL_HALF_WIDTH * 0.4, TRAIL_HALF_WIDTH * 0.4);
      const z = randomRange(zEnd + CHUNK_DEPTH * 0.3, zStart - CHUNK_DEPTH * 0.3);
      this.spawnObstacle('ramp', x, z, chunk, scene);
    }
  }

  private spawnObstacle(
    type: 'tree' | 'rock' | 'ramp',
    x: number,
    z: number,
    chunk: TerrainChunk,
    scene: THREE.Scene
  ) {
    const mesh = this.assetManager.create(type);
    const y = chunk.getHeightAt(x, z);
    mesh.position.set(x, y, z);

    // Slight random rotation for trees and rocks
    if (type !== 'ramp') {
      mesh.rotation.y = Math.random() * Math.PI * 2;
    }

    // Random scale variation for trees
    if (type === 'tree') {
      const scale = 0.7 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);
    }

    scene.add(mesh);

    const obstacleData: ObstacleData = {
      mesh,
      type,
      boundingSize: mesh.userData.boundingSize as THREE.Vector3,
    };
    chunk.obstacles.push(obstacleData);
  }
}
