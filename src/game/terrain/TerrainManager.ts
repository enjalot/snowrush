import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import { ObstacleSpawner } from './ObstacleSpawner';
import { CHUNK_DEPTH, NUM_ACTIVE_CHUNKS, getSlopeGradeAt } from './TerrainConfig';
import type { ObstacleData } from '../types';

export class TerrainManager {
  private chunks: TerrainChunk[] = [];
  private nextZOffset = 0;
  private spawner: ObstacleSpawner;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, spawner: ObstacleSpawner) {
    this.scene = scene;
    this.spawner = spawner;

    // Create initial chunks
    for (let i = 0; i < NUM_ACTIVE_CHUNKS; i++) {
      const chunk = new TerrainChunk();
      chunk.generate(this.nextZOffset);
      this.scene.add(chunk.mesh);
      // Don't spawn obstacles on the very first chunk (player start area)
      if (i > 0) {
        this.spawner.populate(chunk, this.scene);
      }
      this.chunks.push(chunk);
      this.nextZOffset -= CHUNK_DEPTH;
    }
  }

  update(playerZ: number) {
    // Recycle all chunks that have fallen behind the player.
    // Use a while loop so multiple chunks can recycle in a single frame at high speed.
    while (this.chunks.length > 0) {
      const recycleThreshold = this.chunks[0].zStart;
      if (playerZ < recycleThreshold - CHUNK_DEPTH * 4) {
        this.recycleOldest();
      } else {
        break;
      }
    }
  }

  private recycleOldest() {
    // Take the chunk closest to z=0 (farthest behind player)
    const chunk = this.chunks.shift()!;

    // Clear its old obstacles
    chunk.clearObstacles(this.scene);
    this.scene.remove(chunk.mesh);

    // Regenerate at the new front position
    chunk.generate(this.nextZOffset);
    this.scene.add(chunk.mesh);
    this.spawner.populate(chunk, this.scene);

    this.chunks.push(chunk);
    this.nextZOffset -= CHUNK_DEPTH;
  }

  /** Get terrain height at world position */
  getHeightAt(x: number, z: number): number {
    for (const chunk of this.chunks) {
      if (chunk.containsZ(z)) {
        return chunk.getHeightAt(x, z);
      }
    }
    // Fallback: estimate from progressive slope grade
    return z * getSlopeGradeAt(z);
  }

  /** Get all obstacle data from currently active chunks near the player */
  getActiveObstacles(playerZ: number): ObstacleData[] {
    const obstacles: ObstacleData[] = [];
    for (const chunk of this.chunks) {
      // Only check obstacles on chunks near the player
      if (Math.abs(chunk.zStart - playerZ) < CHUNK_DEPTH * 2) {
        obstacles.push(...chunk.obstacles);
      }
    }
    return obstacles;
  }

  getActiveObstaclesInRange(zA: number, zB: number): ObstacleData[] {
    const rangeMin = Math.min(zA, zB) - CHUNK_DEPTH;
    const rangeMax = Math.max(zA, zB) + CHUNK_DEPTH;
    const obstacles: ObstacleData[] = [];

    for (const chunk of this.chunks) {
      if (chunk.zEnd <= rangeMax && chunk.zStart >= rangeMin) {
        obstacles.push(...chunk.obstacles);
      }
    }

    return obstacles;
  }

  reset() {
    // Clear all obstacles and regenerate
    for (const chunk of this.chunks) {
      chunk.clearObstacles(this.scene);
      this.scene.remove(chunk.mesh);
    }
    this.chunks = [];
    this.nextZOffset = 0;

    for (let i = 0; i < NUM_ACTIVE_CHUNKS; i++) {
      const chunk = new TerrainChunk();
      chunk.generate(this.nextZOffset);
      this.scene.add(chunk.mesh);
      if (i > 0) {
        this.spawner.populate(chunk, this.scene);
      }
      this.chunks.push(chunk);
      this.nextZOffset -= CHUNK_DEPTH;
    }
  }
}
