export const CHUNK_WIDTH = 60;
export const CHUNK_DEPTH = 60;
export const SEGMENTS_X = 30;
export const SEGMENTS_Z = 30;
export const SLOPE_GRADE = 0.3;           // base slope grade
export const NUM_ACTIVE_CHUNKS = 7;
export const NOISE_SCALE = 0.04;
export const NOISE_AMPLITUDE = 1.7;
export const TALL_HILL_NOISE_SCALE = 0.018;
export const TALL_HILL_AMPLITUDE = 3.4;
export const TALL_HILL_RARITY = 4;
export const TRAIL_HALF_WIDTH = 15;

// Progressive difficulty: slope gets steeper the farther you go
const SLOPE_STEEPEN_RATE = 0.00005;    // grade increase per meter
const MAX_SLOPE_GRADE = 0.8;            // cap so it doesn't become a cliff

/** Get the slope grade at a given world Z position (negative = downhill) */
export function getSlopeGradeAt(worldZ: number): number {
  const dist = Math.abs(worldZ);
  return Math.min(SLOPE_GRADE + dist * SLOPE_STEEPEN_RATE, MAX_SLOPE_GRADE);
}
