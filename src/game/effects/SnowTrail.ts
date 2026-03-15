import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { TerrainManager } from '../terrain/TerrainManager';
import { clamp, lerp } from '../utils/math';

interface TrailPoint {
  position: THREE.Vector3;
  width: number;
}

interface TrailSegment {
  start: TrailPoint;
  end: TrailPoint;
}

const MAX_SEGMENTS = 240;
const SAMPLE_DISTANCE = 0.45;
const TRACK_LIFT = 0.035;
const TRACK_LENGTH = 180;

const _forward = new THREE.Vector3();
const _side = new THREE.Vector3();
const _startLeft = new THREE.Vector3();
const _startRight = new THREE.Vector3();
const _endLeft = new THREE.Vector3();
const _endRight = new THREE.Vector3();
const _center = new THREE.Vector3();
const _lerpPoint = new THREE.Vector3();

export class SnowTrail {
  private terrainManager: TerrainManager;
  private geometry: THREE.BufferGeometry;
  private mesh: THREE.Mesh;
  private segments: TrailSegment[] = [];
  private lastPoint: TrailPoint | null = null;

  constructor(scene: THREE.Scene, terrainManager: TerrainManager) {
    this.terrainManager = terrainManager;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(MAX_SEGMENTS * 4 * 3), 3),
    );
    this.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(MAX_SEGMENTS * 4 * 3), 3),
    );
    this.geometry.setIndex(new THREE.BufferAttribute(this.createIndices(), 1));
    this.geometry.setDrawRange(0, 0);

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  update(player: Player) {
    this.prune(player.position.z);

    if (player.snowContactAmount < 0.3) {
      this.lastPoint = null;
      return;
    }

    const current = this.createPoint(player.position, player.speedRatio, player.carveSprayIntensity);
    if (!this.lastPoint) {
      this.lastPoint = current;
      return;
    }

    let remaining = this.lastPoint.position.distanceTo(current.position);
    while (remaining >= SAMPLE_DISTANCE) {
      const t = SAMPLE_DISTANCE / remaining;
      _lerpPoint.lerpVectors(this.lastPoint.position, current.position, t);
      const width = lerp(this.lastPoint.width, current.width, t);
      const nextPoint: TrailPoint = {
        position: _lerpPoint.clone(),
        width,
      };
      this.addSegment(this.lastPoint, nextPoint);
      this.lastPoint = nextPoint;
      remaining = this.lastPoint.position.distanceTo(current.position);
    }
  }

  reset() {
    this.segments = [];
    this.lastPoint = null;
    this.geometry.setDrawRange(0, 0);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.geometry.dispose();
    const material = this.mesh.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    }
  }

  private createPoint(position: THREE.Vector3, speedRatio: number, carveIntensity: number): TrailPoint {
    const width = 0.42 + speedRatio * 0.1 + carveIntensity * 0.2;
    return {
      position: new THREE.Vector3(
        position.x,
        this.terrainManager.getHeightAt(position.x, position.z) + TRACK_LIFT,
        position.z,
      ),
      width,
    };
  }

  private addSegment(start: TrailPoint, end: TrailPoint) {
    this.segments.push({
      start: {
        position: start.position.clone(),
        width: start.width,
      },
      end: {
        position: end.position.clone(),
        width: end.width,
      },
    });

    if (this.segments.length > MAX_SEGMENTS) {
      this.segments.shift();
    }

    this.rebuildGeometry();
  }

  private prune(playerZ: number) {
    const cutoffZ = playerZ + TRACK_LENGTH;
    let changed = false;
    while (this.segments.length > 0 && Math.max(this.segments[0].start.position.z, this.segments[0].end.position.z) > cutoffZ) {
      this.segments.shift();
      changed = true;
    }

    if (this.lastPoint && this.lastPoint.position.z > cutoffZ) {
      this.lastPoint = null;
    }

    if (changed) {
      this.rebuildGeometry();
    }
  }

  private rebuildGeometry() {
    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const segmentCount = this.segments.length;

    for (let i = 0; i < segmentCount; i++) {
      const segment = this.segments[i];

      _forward.subVectors(segment.end.position, segment.start.position);
      _forward.y = 0;
      if (_forward.lengthSq() < 1e-5) {
        _forward.set(0, 0, -1);
      } else {
        _forward.normalize();
      }

      _side.set(-_forward.z, 0, _forward.x);

      _center.copy(segment.start.position);
      _startLeft.copy(_center).addScaledVector(_side, -segment.start.width * 0.5);
      _startRight.copy(_center).addScaledVector(_side, segment.start.width * 0.5);

      _center.copy(segment.end.position);
      _endLeft.copy(_center).addScaledVector(_side, -segment.end.width * 0.5);
      _endRight.copy(_center).addScaledVector(_side, segment.end.width * 0.5);

      _startLeft.y = this.terrainManager.getHeightAt(_startLeft.x, _startLeft.z) + TRACK_LIFT;
      _startRight.y = this.terrainManager.getHeightAt(_startRight.x, _startRight.z) + TRACK_LIFT;
      _endLeft.y = this.terrainManager.getHeightAt(_endLeft.x, _endLeft.z) + TRACK_LIFT;
      _endRight.y = this.terrainManager.getHeightAt(_endRight.x, _endRight.z) + TRACK_LIFT;

      const vertexOffset = i * 4;
      positions.setXYZ(vertexOffset + 0, _startLeft.x, _startLeft.y, _startLeft.z);
      positions.setXYZ(vertexOffset + 1, _startRight.x, _startRight.y, _startRight.z);
      positions.setXYZ(vertexOffset + 2, _endLeft.x, _endLeft.y, _endLeft.z);
      positions.setXYZ(vertexOffset + 3, _endRight.x, _endRight.y, _endRight.z);

      const fade = segmentCount <= 1 ? 1 : i / (segmentCount - 1);
      const shade = lerp(0.78, 0.58, clamp(fade, 0, 1));
      const tintR = shade * 0.9;
      const tintG = shade * 0.96;
      const tintB = shade;
      for (let v = 0; v < 4; v++) {
        colors.setXYZ(vertexOffset + v, tintR, tintG, tintB);
      }
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    this.geometry.setDrawRange(0, segmentCount * 6);
    this.geometry.computeBoundingSphere();
  }

  private createIndices() {
    const indices = new Uint16Array(MAX_SEGMENTS * 6);
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const vertexOffset = i * 4;
      const indexOffset = i * 6;
      indices[indexOffset + 0] = vertexOffset + 0;
      indices[indexOffset + 1] = vertexOffset + 2;
      indices[indexOffset + 2] = vertexOffset + 1;
      indices[indexOffset + 3] = vertexOffset + 2;
      indices[indexOffset + 4] = vertexOffset + 3;
      indices[indexOffset + 5] = vertexOffset + 1;
    }
    return indices;
  }
}
