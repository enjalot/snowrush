import * as THREE from 'three';

export interface InputState {
  steer: number;       // -1 (left) to +1 (right)
  accelerate: number;  // -1 (brake) to +1 (speed up)
  jump: boolean;       // true on the frame jump is pressed
  jumpHeld: boolean;   // true while jump button held
  pause: boolean;      // true on the frame pause is pressed
}

export type GameStateType = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type TrickType = 'spin-left' | 'spin-right' | 'frontflip' | 'backflip' | null;

export interface GameUIState {
  gameState: GameStateType;
  speed: number;
  distance: number;
  score: number;
  trickName: string | null;
  health: number;
}

export interface ObstacleData {
  mesh: THREE.Object3D;
  type: 'tree' | 'rock' | 'ramp';
  boundingSize: THREE.Vector3;
}

/** Joint hierarchy for character animation — names follow Mixamo convention */
export interface CharacterRig {
  hips: THREE.Object3D;
  spine: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;       // shoulder
  leftForeArm: THREE.Object3D;   // elbow
  rightArm: THREE.Object3D;      // shoulder
  rightForeArm: THREE.Object3D;  // elbow
  leftUpLeg: THREE.Object3D;     // hip joint
  leftLeg: THREE.Object3D;       // knee
  rightUpLeg: THREE.Object3D;    // hip joint
  rightLeg: THREE.Object3D;      // knee
}
