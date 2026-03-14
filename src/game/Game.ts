import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { GameScene } from './core/Scene';
import { GameCamera } from './core/Camera';
import { InputManager } from './input/InputManager';
import { TerrainManager } from './terrain/TerrainManager';
import { ObstacleSpawner } from './terrain/ObstacleSpawner';
import { AssetManager } from './assets/AssetManager';
import { Player } from './entities/Player';
import { CollisionDetector } from './physics/CollisionDetector';
import type { GameStateType, GameUIState } from './types';

export type UIStateCallback = (state: GameUIState) => void;

export class Game {
  private renderer: Renderer;
  private gameScene: GameScene;
  private camera: GameCamera;
  private inputManager: InputManager;
  private terrainManager!: TerrainManager;
  private assetManager: AssetManager;
  private player!: Player;
  private collisionDetector: CollisionDetector;

  private clock = new THREE.Clock(false);
  private animFrameId: number | null = null;
  private gameState: GameStateType = 'MENU';
  private distance = 0;
  private score = 0;

  private onUIStateChange: UIStateCallback | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.gameScene = new GameScene();
    this.camera = new GameCamera();
    this.inputManager = new InputManager(canvas);
    this.assetManager = new AssetManager();
    this.collisionDetector = new CollisionDetector();

    this.init();

    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.camera.resize();
    });
  }

  private init() {
    const playerMesh = this.assetManager.create('player');
    this.gameScene.add(playerMesh);
    this.player = new Player(playerMesh);

    const spawner = new ObstacleSpawner(this.assetManager);
    this.terrainManager = new TerrainManager(this.gameScene.scene, spawner);

    const groundY = this.terrainManager.getHeightAt(0, 0);
    this.player.position.y = groundY;
    this.player.mesh.position.y = groundY;

    this.camera.update(0, this.player.position);
    this.camera.camera.position.set(
      this.player.position.x,
      this.player.position.y + 5,
      this.player.position.z + 8
    );
  }

  setUIStateCallback(callback: UIStateCallback) {
    this.onUIStateChange = callback;
    this.emitUIState();
  }

  private emitUIState() {
    if (this.onUIStateChange) {
      this.onUIStateChange({
        gameState: this.gameState,
        speed: this.player.speed,
        distance: this.distance,
        score: this.score,
        trickName: this.player.pendingTrickName,
        health: this.player.health,
      });
    }
  }

  start() {
    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  pause() {
    if (this.gameState !== 'PLAYING') return;
    this.gameState = 'PAUSED';
    this.clock.stop();
    this.emitUIState();
  }

  resume() {
    if (this.gameState !== 'PAUSED') return;
    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.pause();
    } else if (this.gameState === 'PAUSED') {
      this.resume();
    }
  }

  restart() {
    this.distance = 0;
    this.score = 0;
    this.player.reset();
    this.terrainManager.reset();

    const groundY = this.terrainManager.getHeightAt(0, 0);
    this.player.position.y = groundY;
    this.player.mesh.position.y = groundY;

    this.camera.camera.position.set(0, groundY + 5, 8);

    this.gameState = 'PLAYING';
    this.clock.start();
    this.emitUIState();
    this.loop();
  }

  private loop = () => {
    if (this.gameState !== 'PLAYING') return;

    this.animFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.inputManager.update();

    // Check pause (Escape)
    if (this.inputManager.state.pause) {
      this.togglePause();
      return;
    }

    // Player movement
    this.player.update(dt, this.inputManager.state, this.terrainManager);

    // Terrain chunk recycling
    this.terrainManager.update(this.player.position.z);

    // Collisions
    const obstacles = this.terrainManager.getActiveObstacles(this.player.position.z);
    const collision = this.collisionDetector.check(this.player, obstacles);

    if (collision.hit) {
      this.player.hit();
      if (this.player.health <= 0) {
        this.gameOver();
        return;
      }
    }

    // Update score (distance + tricks)
    this.distance = Math.abs(this.player.position.z);
    this.score = Math.floor(this.distance) + this.player.trickScore;

    // Camera
    this.camera.update(dt, this.player.position);

    this.emitUIState();
  }

  private render() {
    this.renderer.render(this.gameScene.scene, this.camera.camera);
  }

  private gameOver() {
    this.gameState = 'GAME_OVER';
    this.clock.stop();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.emitUIState();
  }

  dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.renderer.dispose();
  }
}
