import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { TerrainManager } from '../terrain/TerrainManager';
import { randomRange } from '../utils/math';

const MAX_PARTICLES = 1600;
const PARTICLE_GRAVITY = 11;
const AIR_DRAG = 0.92;
const POSITION_STRIDE = 3;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _velocity = new THREE.Vector3();

const vertexShader = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / max(1.0, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = aAlpha;
  vColor = aColor;
}
`;

const fragmentShader = `
varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  vec2 stretched = vec2(centered.x * 0.72, centered.y * 1.9);
  float sprite = smoothstep(0.22, 0.0, dot(stretched, stretched));
  float powder = smoothstep(0.14, 0.0, dot(vec2(centered.x * 0.5, centered.y * 2.4), vec2(centered.x * 0.5, centered.y * 2.4))) * 0.25;
  float alpha = (sprite + powder) * vAlpha;

  if (alpha <= 0.01) {
    discard;
  }

  gl_FragColor = vec4(vColor, alpha);
}
`;

export class SnowParticles {
  private geometry: THREE.BufferGeometry;
  private points: THREE.Points;
  private terrainManager: TerrainManager;
  private emitAccum = 0;
  private spawnCursor = 0;

  private positions = new Float32Array(MAX_PARTICLES * POSITION_STRIDE);
  private velocities = new Float32Array(MAX_PARTICLES * POSITION_STRIDE);
  private colors = new Float32Array(MAX_PARTICLES * POSITION_STRIDE);
  private sizes = new Float32Array(MAX_PARTICLES);
  private alphas = new Float32Array(MAX_PARTICLES);
  private life = new Float32Array(MAX_PARTICLES);
  private maxLife = new Float32Array(MAX_PARTICLES);

  constructor(scene: THREE.Scene, terrainManager: TerrainManager) {
    this.terrainManager = terrainManager;
    this.geometry = new THREE.BufferGeometry();

    const positionAttr = new THREE.BufferAttribute(this.positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    const colorAttr = new THREE.BufferAttribute(this.colors, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    const sizeAttr = new THREE.BufferAttribute(this.sizes, 1);
    sizeAttr.setUsage(THREE.DynamicDrawUsage);
    const alphaAttr = new THREE.BufferAttribute(this.alphas, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', positionAttr);
    this.geometry.setAttribute('aColor', colorAttr);
    this.geometry.setAttribute('aSize', sizeAttr);
    this.geometry.setAttribute('aAlpha', alphaAttr);
    this.geometry.setDrawRange(0, MAX_PARTICLES);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);

    this.clearBuffers();
  }

  update(dt: number, player: Player) {
    this.updateParticles(dt);
    this.emit(dt, player);
    this.flushAttributes();
  }

  reset() {
    this.emitAccum = 0;
    this.spawnCursor = 0;
    this.clearBuffers();
    this.flushAttributes();
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.geometry.dispose();
    const material = this.points.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    }
  }

  private emit(dt: number, player: Player) {
    const intensity = player.carveSprayIntensity;
    if (player.snowContactAmount < 0.1 || intensity <= 0.02) {
      return;
    }

    const speedInfluence = 0.25 + player.speedRatio * 0.75;
    const rate = intensity * (38 + speedInfluence * 180);
    this.emitAccum += rate * dt;

    player.getRideDirection(_forward).normalize();
    _right.set(-_forward.z, 0, _forward.x);

    while (this.emitAccum >= 1) {
      this.emitAccum -= 1;
      this.spawnParticle(player, intensity, speedInfluence);
    }
  }

  private spawnParticle(player: Player, intensity: number, speedInfluence: number) {
    const index = this.spawnCursor;
    this.spawnCursor = (this.spawnCursor + 1) % MAX_PARTICLES;

    const spraySide = player.carveDirection === 0 ? randomRange(-1, 1) : -player.carveDirection;
    const sideOffset = spraySide * randomRange(0.16, 0.65);
    const tailOffset = randomRange(-0.95, -0.25);
    const drift = 0.9 + speedInfluence * 1.15;

    player.getRideDirection(_forward).normalize();
    _right.set(-_forward.z, 0, _forward.x);

    _origin.copy(player.position)
      .addScaledVector(_right, sideOffset)
      .addScaledVector(_forward, tailOffset);
    _origin.y = this.terrainManager.getHeightAt(_origin.x, _origin.z) + randomRange(0.02, 0.08);

    _velocity.copy(player.velocity).multiplyScalar(0.02);
    _velocity.addScaledVector(_right, spraySide * randomRange(1.8, 4.2) * intensity * drift);
    _velocity.addScaledVector(_forward, randomRange(-1.1, 0.05) * (0.3 + intensity + speedInfluence * 0.25));
    _velocity.y += randomRange(0.15, 0.85) * (0.35 + intensity * 0.45 + speedInfluence * 0.2);

    const i3 = index * POSITION_STRIDE;
    this.positions[i3 + 0] = _origin.x;
    this.positions[i3 + 1] = _origin.y;
    this.positions[i3 + 2] = _origin.z;
    this.velocities[i3 + 0] = _velocity.x;
    this.velocities[i3 + 1] = _velocity.y;
    this.velocities[i3 + 2] = _velocity.z;

    const brightness = randomRange(0.82, 1.0);
    this.colors[i3 + 0] = brightness * 0.93;
    this.colors[i3 + 1] = brightness * 0.97;
    this.colors[i3 + 2] = brightness;

    this.sizes[index] = randomRange(4, 9) * (0.85 + intensity * 0.35);
    this.alphas[index] = 0.6;
    this.life[index] = randomRange(0.22, 0.5);
    this.maxLife[index] = this.life[index];
  }

  private updateParticles(dt: number) {
    const drag = Math.max(0, 1 - dt * AIR_DRAG);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        continue;
      }

      this.life[i] -= dt;

      const i3 = i * POSITION_STRIDE;
      this.velocities[i3 + 1] -= PARTICLE_GRAVITY * dt;
      this.velocities[i3 + 0] *= drag;
      this.velocities[i3 + 1] *= 1 - dt * 0.15;
      this.velocities[i3 + 2] *= drag;

      this.positions[i3 + 0] += this.velocities[i3 + 0] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      const groundY = this.terrainManager.getHeightAt(this.positions[i3 + 0], this.positions[i3 + 2]);
      if (
        this.life[i] <= 0 ||
        this.positions[i3 + 1] <= groundY + 0.01 ||
        this.positions[i3 + 1] >= groundY + 0.95
      ) {
        this.life[i] = 0;
        this.alphas[i] = 0;
        continue;
      }

      const lifeRatio = this.life[i] / Math.max(this.maxLife[i], 1e-4);
      this.alphas[i] = Math.min(0.65, lifeRatio * 0.8);
      this.sizes[i] *= 0.992;
    }
  }

  private clearBuffers() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const i3 = i * POSITION_STRIDE;
      this.positions[i3 + 0] = 0;
      this.positions[i3 + 1] = -9999;
      this.positions[i3 + 2] = 0;
      this.velocities[i3 + 0] = 0;
      this.velocities[i3 + 1] = 0;
      this.velocities[i3 + 2] = 0;
      this.colors[i3 + 0] = 1;
      this.colors[i3 + 1] = 1;
      this.colors[i3 + 2] = 1;
      this.sizes[i] = 0;
      this.alphas[i] = 0;
      this.life[i] = 0;
      this.maxLife[i] = 0;
    }
  }

  private flushAttributes() {
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
