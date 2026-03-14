import * as THREE from 'three';

export class GameScene {
  scene: THREE.Scene;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc8e6f5);

    // Fog hides terrain chunk boundaries
    this.scene.fog = new THREE.Fog(0xc8e6f5, 60, 140);

    this.setupLights();
  }

  private setupLights() {
    // Hemisphere light for natural outdoor feel
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xffffff, 0.6);
    this.scene.add(hemiLight);

    // Directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(20, 40, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    this.scene.add(dirLight);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
  }

  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D) {
    this.scene.remove(object);
  }
}
