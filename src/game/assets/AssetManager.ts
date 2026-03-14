import * as THREE from 'three';
import { PrimitiveFactory } from './PrimitiveFactory';

type AssetFactory = () => THREE.Group;

export class AssetManager {
  private factories = new Map<string, AssetFactory>();

  constructor() {
    // Register default primitive assets
    this.register('player', () => PrimitiveFactory.createSnowboarder());
    this.register('tree', () => PrimitiveFactory.createTree());
    this.register('rock', () => PrimitiveFactory.createRock());
    this.register('ramp', () => PrimitiveFactory.createRamp());
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
}
