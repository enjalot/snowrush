import * as THREE from 'three';

export class GameCamera {
  camera: THREE.PerspectiveCamera;

  private offset = new THREE.Vector3(0, 4, 6);
  private lookAtOffset = new THREE.Vector3(0, -3, -12);
  private lerpFactor = 0.08;
  private targetPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 5, 8);
  }

  update(_dt: number, playerPosition: THREE.Vector3) {
    // Desired camera position: behind and above player
    this.targetPos.copy(playerPosition).add(this.offset);

    // Smooth interpolation
    this.camera.position.lerp(this.targetPos, this.lerpFactor);

    // Look ahead of the player down the slope
    this.targetLookAt.copy(playerPosition).add(this.lookAtOffset);
    this.camera.lookAt(this.targetLookAt);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
