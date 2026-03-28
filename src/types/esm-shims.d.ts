declare module 'https://esm.sh/crashcat@latest?target=es2022' {
  export function registerAll(): void;
  export const box: {
    create(settings: { halfExtents: [number, number, number] }): unknown;
  };
  export function collideShapeVsShape(
    collector: {
      addHit(hit: { penetration: number }): void;
      addMiss(): void;
      shouldEarlyOut(): boolean;
      hit?: { penetration: number } | null;
      reset?: () => void;
      bodyIdB?: number;
      earlyOutFraction?: number;
    },
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
  ): void;

  export function createAnyCollideShapeCollector(): {
    hit: { penetration: number } | null;
    bodyIdB: number;
    earlyOutFraction: number;
    addHit(hit: { penetration: number }): void;
    addMiss(): void;
    shouldEarlyOut(): boolean;
    reset(): void;
  };

  export function createDefaultCollideShapeSettings(): unknown;
}
