import * as THREE from 'three';

export class GameScene {
  scene: THREE.Scene;
  private sunTarget = new THREE.Object3D();
  private fillTarget = new THREE.Object3D();

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd7ecf7);

    // Fog hides terrain chunk boundaries
    this.scene.fog = new THREE.Fog(0xd7ecf7, 80, 180);

    this.setupLights();
  }

  private setupLights() {
    // Hemisphere light for natural outdoor feel
    const hemiLight = new THREE.HemisphereLight(0xd6efff, 0xc9d7e6, 0.95);
    this.scene.add(hemiLight);

    // Cross-slope sunlight helps the bumps and hills read against the snow.
    const sunLight = new THREE.DirectionalLight(0xfff6df, 1.4);
    sunLight.position.set(-30, 26, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 180;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 55;
    sunLight.shadow.camera.bottom = -35;
    sunLight.shadow.bias = -0.00015;
    sunLight.shadow.normalBias = 0.02;
    this.sunTarget.position.set(0, -2, -80);
    sunLight.target = this.sunTarget;
    this.scene.add(this.sunTarget);
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xbcdcff, 0.45);
    fillLight.position.set(24, 18, 12);
    this.fillTarget.position.set(0, 0, -60);
    fillLight.target = this.fillTarget;
    this.scene.add(this.fillTarget);
    this.scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0xf7fbff, 0.18);
    this.scene.add(ambientLight);
  }

  add(object: THREE.Object3D) {
    this.scene.add(object);
  }

  remove(object: THREE.Object3D) {
    this.scene.remove(object);
  }
}
