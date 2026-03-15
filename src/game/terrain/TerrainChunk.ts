import * as THREE from 'three';
import {
  CHUNK_WIDTH,
  CHUNK_DEPTH,
  SEGMENTS_X,
  SEGMENTS_Z,
  NOISE_SCALE,
  NOISE_AMPLITUDE,
  TALL_HILL_NOISE_SCALE,
  TALL_HILL_AMPLITUDE,
  TALL_HILL_RARITY,
  getSlopeGradeAt,
} from './TerrainConfig';
import { simplex2 } from '../utils/noise';
import type { ObstacleData } from '../types';

export class TerrainChunk {
  mesh: THREE.Mesh;
  zStart: number;
  zEnd: number;
  obstacles: ObstacleData[] = [];

  private geometry: THREE.PlaneGeometry;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(
      CHUNK_WIDTH, CHUNK_DEPTH, SEGMENTS_X, SEGMENTS_Z
    );
    // Rotate plane to lie in XZ plane (default is XY)
    this.geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0xf4f8ff,
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.receiveShadow = true;
    this.zStart = 0;
    this.zEnd = -CHUNK_DEPTH;
  }

  /** Reposition this chunk and regenerate its heightmap */
  generate(zOffset: number) {
    this.zStart = zOffset;
    this.zEnd = zOffset - CHUNK_DEPTH;

    // Position the mesh so its center is at the right Z
    const centerZ = zOffset - CHUNK_DEPTH / 2;
    this.mesh.position.set(0, 0, centerZ);

    // Displace vertices for slope + noise
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);

      // World-space coordinates
      const worldZ = localZ + centerZ;
      const worldX = localX;

      // Slope: Y decreases as Z goes negative (downhill)
      // Slope grade increases with distance for progressive difficulty
      const slopeY = worldZ * getSlopeGradeAt(worldZ);
      // Base rolling terrain with occasional taller hill clusters.
      const baseNoise = simplex2(worldX * NOISE_SCALE, worldZ * NOISE_SCALE) * NOISE_AMPLITUDE;
      const tallHillMask = Math.pow(
        Math.max(0, simplex2(worldX * TALL_HILL_NOISE_SCALE + 19.4, worldZ * TALL_HILL_NOISE_SCALE - 7.2) * 0.5 + 0.5),
        TALL_HILL_RARITY,
      );
      const tallHillShape = Math.max(
        0,
        simplex2(worldX * (NOISE_SCALE * 0.75) - 43.1, worldZ * (NOISE_SCALE * 0.75) + 11.8) * 0.5 + 0.5,
      );
      const noiseY = baseNoise + tallHillMask * tallHillShape * TALL_HILL_AMPLITUDE;

      pos.setY(i, slopeY + noiseY);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    // CRITICAL: recompute bounds after displacing vertices, otherwise
    // Three.js frustum culling uses the stale bounding sphere from the
    // original flat geometry and culls chunks that are far downhill.
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }

  /** Get interpolated height at a world-space (x, z) position */
  getHeightAt(x: number, z: number): number {
    const centerZ = (this.zStart + this.zEnd) / 2;

    // Convert world coords to local coords relative to mesh center
    const localX = x;
    const localZ = z - centerZ;

    // Convert to grid coordinates
    const gridX = ((localX + CHUNK_WIDTH / 2) / CHUNK_WIDTH) * SEGMENTS_X;
    const gridZ = ((localZ + CHUNK_DEPTH / 2) / CHUNK_DEPTH) * SEGMENTS_Z;

    // Clamp to grid bounds
    const gx = Math.max(0, Math.min(SEGMENTS_X - 1, Math.floor(gridX)));
    const gz = Math.max(0, Math.min(SEGMENTS_Z - 1, Math.floor(gridZ)));

    const pos = this.geometry.attributes.position;
    const cols = SEGMENTS_X + 1;

    // Get heights at four corners of the grid cell
    const i00 = gz * cols + gx;
    const i10 = gz * cols + Math.min(gx + 1, SEGMENTS_X);
    const i01 = Math.min(gz + 1, SEGMENTS_Z) * cols + gx;
    const i11 = Math.min(gz + 1, SEGMENTS_Z) * cols + Math.min(gx + 1, SEGMENTS_X);

    const h00 = pos.getY(i00);
    const h10 = pos.getY(i10);
    const h01 = pos.getY(i01);
    const h11 = pos.getY(i11);

    // Bilinear interpolation
    const fx = gridX - gx;
    const fz = gridZ - gz;

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;

    return h0 + (h1 - h0) * fz;
  }

  /** Check if a world-space Z is within this chunk */
  containsZ(z: number): boolean {
    return z <= this.zStart && z >= this.zEnd;
  }

  clearObstacles(scene: THREE.Scene) {
    for (const obs of this.obstacles) {
      scene.remove(obs.mesh);
    }
    this.obstacles = [];
  }
}
