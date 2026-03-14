import { createNoise2D } from 'simplex-noise';

// Create a single noise instance for terrain generation
const noise2D = createNoise2D();

export function simplex2(x: number, z: number): number {
  return noise2D(x, z);
}
