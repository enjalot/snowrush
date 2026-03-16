import * as THREE from 'three';
import { PrimitiveFactory } from './PrimitiveFactory';
import type { SnowboarderAppearance } from '../types';

type AssetFactory = () => THREE.Group;
type RailConfig = Parameters<typeof PrimitiveFactory.createRail>[0];

export class AssetManager {
  private factories = new Map<string, AssetFactory>();

  constructor() {
    // Register default primitive assets
    this.register('player', () => PrimitiveFactory.createSnowboarder());
    this.register('tree', () => PrimitiveFactory.createTree());
    this.register('rock', () => PrimitiveFactory.createRock());
    this.register('ramp', () => PrimitiveFactory.createRamp());
    this.register('rail', () => PrimitiveFactory.createRail());
    this.register('finishLine', () => PrimitiveFactory.createFinishLine());
  }

  register(key: string, factory: AssetFactory) {
    this.factories.set(key, factory);
  }

  create(key: string): THREE.Group {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Asset not registered: ${key}`);
    }
    return factory();
  }

  createSnowboarder(appearance?: Partial<SnowboarderAppearance>): THREE.Group {
    return PrimitiveFactory.createSnowboarder(appearance);
  }

  createRail(config?: RailConfig): THREE.Group {
    return PrimitiveFactory.createRail(config);
  }
}
