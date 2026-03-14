import * as THREE from 'three';
import type { InputState, TrickType, CharacterRig } from '../types';
import type { TerrainManager } from '../terrain/TerrainManager';
import { clamp, lerp } from '../utils/math';
import { CHUNK_WIDTH } from '../terrain/TerrainConfig';

// Physics constants
const GRAVITY = 20;
const STEER_SPEED = 2.5;
const MAX_STEER = Math.PI / 4;
const STEER_FRICTION = 3.0;
const ACCEL_FORCE = 8;
const MAX_SPEED = 60;
const MIN_SPEED = 5;
const DRAG = 0.3;
const BASE_SLOPE_ACCEL = 6;

// Pump constants
const PUMP_POP_FORCE = 2.5;
const PUMP_SPEED_BOOST = 3;
const PUMP_ABSORB_SPEED_BOOST = 2;
const PUMP_SLOPE_BONUS = 6;

// Trick constants
const SPIN_SPEED = Math.PI * 2.5;  // radians/sec — full spin in ~0.4s
const FLIP_SPEED = Math.PI * 2.0;  // radians/sec — full flip in ~0.5s
const TRICK_SCORE_SPIN = 100;
const TRICK_SCORE_FLIP = 200;
const LANDING_TOLERANCE = Math.PI / 4; // ±45° from upright to land cleanly

// Progressive difficulty: slope gets steeper with distance
const SLOPE_RAMP_RATE = 0.0003; // slope accel increase per meter of distance
const MIN_SPEED_RAMP = 0.002;   // min speed increase per meter of distance
const MAX_SPEED_RAMP = 0.002;   // max speed increase per meter
const MAX_SPEED_CAP = 80;       // absolute ceiling

// Flip landing zones (measured as deviation from upright: 0 = flat, PI = upside-down)
const FLIP_CLEAN_ZONE = Math.PI / 4;      // ±45° from flat = clean landing
const FLIP_DAMAGE_ZONE = Math.PI * 3 / 4; // ±45° from upside-down = crash

// Board visual feedback colours
const FB_GREEN = new THREE.Color(0, 1, 0.3);
const FB_YELLOW = new THREE.Color(1, 0.8, 0);
const FB_RED = new THREE.Color(1, 0.2, 0);
const FB_CYAN = new THREE.Color(0, 0.8, 1);
const FB_ORANGE = new THREE.Color(1, 0.5, 0);
const FB_FLASH_DECAY = 3; // per second

// --- Pose targets (joint rotation/position targets per state) ---
interface PoseTargets {
  hipsY: number;
  spineX: number;
  armLZ: number;  armRZ: number;
  elbowLX: number; elbowRX: number;
  hipLX: number;  hipRX: number;
  kneeLX: number; kneeRX: number;
}

const POSE_STANDING: PoseTargets = {
  hipsY: 0.6,
  spineX: 0.1,
  armLZ: 0.3,   armRZ: -0.3,
  elbowLX: -0.5, elbowRX: -0.5,
  hipLX: 0.15,  hipRX: 0.15,
  kneeLX: -0.3, kneeRX: -0.3,
};

const POSE_CROUCHING: PoseTargets = {
  hipsY: 0.42,
  spineX: 0.3,
  armLZ: 0.6,   armRZ: -0.6,
  elbowLX: -1.0, elbowRX: -1.0,
  hipLX: 0.8,   hipRX: 0.8,
  kneeLX: -1.4,  kneeRX: -1.4,
};

const POSE_AIRBORNE: PoseTargets = {
  hipsY: 0.6,
  spineX: 0.0,
  armLZ: 0.8,   armRZ: -0.8,
  elbowLX: -0.2, elbowRX: -0.2,
  hipLX: 0.05,  hipRX: 0.05,
  kneeLX: -0.15, kneeRX: -0.15,
};

const POSE_LERP_SPEED = 8;

export class Player {
  mesh: THREE.Group;
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3(0, 0, 0);
  speed = 10;
  steerAngle = 0;
  airborne = false;
  health = 3;
  invulnerable = false;

  // Trick state (public so Game can read for HUD)
  currentTrick: TrickType = null;
  trickScore = 0;
  pendingTrickName: string | null = null;
  private spinAngle = 0;
  private flipAngle = 0;
  private trickFlashTimer = 0;
  private trickStartSteerAngle = 0;

  // Pump state
  private isPumping = false;
  private absorbedLanding = false;
  private lastSlope = 0;
  private pumpSlopeAccum = 0;

  private invulnerableTimer = 0;
  private invulnerableDuration = 1.5;
  private blinkTimer = 0;

  // Board visual feedback
  private boardMat: THREE.MeshStandardMaterial | null = null;
  private flashColor = new THREE.Color(0, 0, 0);
  private flashIntensity = 0;

  // Character rig & pose animation
  private rig: CharacterRig | null = null;
  private currentPose: PoseTargets = { ...POSE_STANDING };

  constructor(mesh: THREE.Group) {
    this.mesh = mesh;

    // Find the board mesh for visual feedback
    const boardMesh = mesh.getObjectByName('board') as THREE.Mesh | undefined;
    if (boardMesh && boardMesh.material instanceof THREE.MeshStandardMaterial) {
      this.boardMat = boardMesh.material;
    }

    // Discover character rig for limb animation
    if (mesh.userData.rig) {
      this.rig = mesh.userData.rig as CharacterRig;
    }
  }

  /** Current effective slope acceleration — increases with distance */
  private get slopeAccel(): number {
    const dist = Math.abs(this.position.z);
    return BASE_SLOPE_ACCEL + dist * SLOPE_RAMP_RATE;
  }

  /** Minimum speed floor — rises with distance so the game gets faster */
  private get minSpeed(): number {
    const dist = Math.abs(this.position.z);
    return MIN_SPEED + dist * MIN_SPEED_RAMP;
  }

  /** Maximum speed ceiling — rises slightly with distance */
  private get maxSpeed(): number {
    const dist = Math.abs(this.position.z);
    return Math.min(MAX_SPEED + dist * MAX_SPEED_RAMP, MAX_SPEED_CAP);
  }

  update(dt: number, input: InputState, terrainManager: TerrainManager) {
    // --- Steering (ONLY on ground — no air steering) ---
    if (!this.airborne) {
      this.steerAngle += input.steer * STEER_SPEED * dt;
      this.steerAngle = clamp(this.steerAngle, -MAX_STEER, MAX_STEER);
      this.steerAngle *= (1 - STEER_FRICTION * dt);
    }

    // --- Speed: progressive slope accel + input + drag ---
    this.speed += this.slopeAccel * dt;
    if (!this.airborne) {
      this.speed += input.accelerate * ACCEL_FORCE * dt;
    }
    this.speed -= this.speed * DRAG * dt;
    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);

    // --- Velocity direction ---
    this.velocity.z = -this.speed * Math.cos(this.steerAngle);
    this.velocity.x = this.speed * Math.sin(this.steerAngle);

    // --- Compute terrain slope ---
    const hHere = terrainManager.getHeightAt(this.position.x, this.position.z);
    const hAhead = terrainManager.getHeightAt(this.position.x, this.position.z - 1.5);
    const currentSlope = (hAhead - hHere) / 1.5;

    // --- Tricks (while airborne) ---
    if (this.airborne) {
      this.updateTricks(dt, input);
    }

    // --- Pump mechanic (spacebar on ground) ---
    if (input.jumpHeld && !this.airborne) {
      if (!this.isPumping) {
        this.isPumping = true;
        this.absorbedLanding = false;
        this.pumpSlopeAccum = 0;
      }
      const slopeChange = Math.abs(currentSlope - this.lastSlope);
      this.pumpSlopeAccum += slopeChange;
    }

    if (!input.jumpHeld && this.isPumping && !this.airborne) {
      this.isPumping = false;
      if (!this.absorbedLanding) {
        this.velocity.y = PUMP_POP_FORCE;
        this.airborne = true;
        const slopeBonus = Math.min(this.pumpSlopeAccum * PUMP_SLOPE_BONUS, 6);
        this.speed += PUMP_SPEED_BOOST + slopeBonus;
        this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);
        this.flashBoard(FB_CYAN);
      }
      this.absorbedLanding = false;
      this.pumpSlopeAccum = 0;
    }

    if (!input.jumpHeld && this.isPumping && this.airborne) {
      this.isPumping = false;
      this.pumpSlopeAccum = 0;
    }

    this.lastSlope = currentSlope;

    // --- Gravity ---
    this.velocity.y -= GRAVITY * dt;

    // --- Integrate position ---
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // --- Terrain following ---
    const groundY = terrainManager.getHeightAt(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;

      if (this.airborne) {
        this.handleLanding(input);
        this.airborne = false;
      }
      this.velocity.y = 0;
    }

    // --- Lateral bounds ---
    const halfWidth = CHUNK_WIDTH / 2 - 1;
    this.position.x = clamp(this.position.x, -halfWidth, halfWidth);

    // --- Invulnerability ---
    if (this.invulnerable) {
      this.invulnerableTimer -= dt;
      this.blinkTimer += dt;
      this.mesh.visible = Math.sin(this.blinkTimer * 15) > 0;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.mesh.visible = true;
      }
    }

    // --- Trick flash timer ---
    if (this.trickFlashTimer > 0) {
      this.trickFlashTimer -= dt;
      if (this.trickFlashTimer <= 0) {
        this.pendingTrickName = null;
      }
    }

    // --- Sync mesh ---
    this.mesh.position.copy(this.position);

    if (this.airborne && this.currentTrick) {
      // Show trick rotation on the mesh
      this.mesh.rotation.set(this.flipAngle, this.spinAngle, 0);
    } else {
      this.mesh.rotation.y = this.steerAngle;
      this.mesh.rotation.x = 0;
      this.mesh.rotation.z = this.steerAngle * 0.3;  // reversed for snowboard carve lean
    }

    // Animate limb poses (crouch, airborne, standing)
    this.updatePose(dt);

    // Board visual feedback
    this.updateBoardFeedback(dt);
  }

  // --- Trick system ---

  private updateTricks(dt: number, input: InputState) {
    // Spins: A/D while airborne (steer keys)
    if (input.steer !== 0 && !this.currentTrick) {
      this.currentTrick = input.steer < 0 ? 'spin-left' : 'spin-right';
      this.trickStartSteerAngle = this.steerAngle;
      this.spinAngle = this.steerAngle;
      this.flipAngle = 0;
    }

    // Flips: W/S while airborne (no spacebar needed)
    if (input.accelerate !== 0 && !this.currentTrick) {
      this.currentTrick = input.accelerate > 0 ? 'backflip' : 'frontflip';
      this.flipAngle = 0;
      this.spinAngle = this.steerAngle;
      this.trickStartSteerAngle = this.steerAngle;
    }

    // Animate the trick rotation — only while key is held (for controlled landings)
    if (this.currentTrick === 'spin-left') {
      if (input.steer < 0) this.spinAngle -= SPIN_SPEED * dt;
    } else if (this.currentTrick === 'spin-right') {
      if (input.steer > 0) this.spinAngle += SPIN_SPEED * dt;
    } else if (this.currentTrick === 'frontflip') {
      if (input.accelerate < 0) this.flipAngle -= FLIP_SPEED * dt;
    } else if (this.currentTrick === 'backflip') {
      if (input.accelerate > 0) this.flipAngle += FLIP_SPEED * dt;
    }
  }

  private handleLanding(_input: InputState) {
    if (this.currentTrick) {
      const isSpin = this.currentTrick === 'spin-left' || this.currentTrick === 'spin-right';
      const angle = isSpin
        ? this.spinAngle - this.trickStartSteerAngle
        : this.flipAngle;
      const absAngle = Math.abs(angle);

      if (isSpin) {
        // Spins: 180° increments are valid landings (180, 360, 540, etc.)
        const halfRemainder = absAngle % Math.PI;
        const cleanHalf = halfRemainder < LANDING_TOLERANCE ||
                          halfRemainder > (Math.PI - LANDING_TOLERANCE);
        const halfRotations = Math.round(absAngle / Math.PI);

        if (cleanHalf && halfRotations > 0) {
          const points = Math.floor(TRICK_SCORE_SPIN * halfRotations * 0.5);
          this.trickScore += points;
          const degrees = halfRotations * 180;
          const label = this.currentTrick === 'spin-left' ? 'Left Spin' : 'Right Spin';
          this.pendingTrickName = `${degrees}° ${label} +${points}`;
          this.trickFlashTimer = 2.0;
          this.flashBoard(FB_GREEN);
        } else if (halfRotations > 0) {
          const wrongness = Math.sin(halfRemainder);
          this.speed *= (1 - wrongness * 0.5);
          this.pendingTrickName = 'SLOPPY!';
          this.trickFlashTimer = 1.5;
          this.flashBoard(FB_YELLOW);
        }
      } else {
        // Flips: forgiving landing based on how close to upright
        // deviation: 0 = flat/upright, PI = upside-down
        const remainder = absAngle % (Math.PI * 2);
        const deviation = remainder > Math.PI ? Math.PI * 2 - remainder : remainder;
        const fullRotations = Math.floor(absAngle / (Math.PI * 2));

        if (deviation < FLIP_CLEAN_ZONE) {
          // Clean zone (within ±45° of flat) — award points
          if (fullRotations > 0) {
            const points = TRICK_SCORE_FLIP * fullRotations;
            this.trickScore += points;
            const rotName = fullRotations === 1 ? '360' :
                            fullRotations === 2 ? '720' :
                            fullRotations === 3 ? '1080' : `${fullRotations * 360}`;
            const label = this.currentTrick === 'frontflip' ? 'Frontflip' : 'Backflip';
            this.pendingTrickName = `${rotName} ${label} +${points}`;
            this.trickFlashTimer = 2.0;
            this.flashBoard(FB_GREEN);
          }
          // If no full rotations but close to flat — no penalty, just landed
        } else if (deviation < FLIP_DAMAGE_ZONE) {
          // Sloppy zone (45°–135° from flat) — proportional slowdown, no damage
          const wrongness = (deviation - FLIP_CLEAN_ZONE) / (FLIP_DAMAGE_ZONE - FLIP_CLEAN_ZONE);
          this.speed *= (1 - wrongness * 0.5);
          this.pendingTrickName = 'SLOPPY!';
          this.trickFlashTimer = 1.5;
          this.flashBoard(FB_YELLOW);
        } else {
          // Danger zone (135°–180° from flat = nearly upside-down) — crash
          this.hit();
          this.pendingTrickName = 'BAD LANDING!';
          this.trickFlashTimer = 1.5;
          this.flashBoard(FB_RED);
        }
      }

      // Reset trick state
      this.currentTrick = null;
      this.spinAngle = 0;
      this.flipAngle = 0;
    }

    // Pump absorb on landing — green flash for good absorption
    if (this.isPumping) {
      this.absorbedLanding = true;
      this.speed += PUMP_ABSORB_SPEED_BOOST;
      this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);
      this.flashBoard(FB_GREEN);
    }
  }

  hit() {
    if (this.invulnerable) return;
    this.health--;
    this.speed *= 0.3;
    this.invulnerable = true;
    this.invulnerableTimer = this.invulnerableDuration;
    this.blinkTimer = 0;
    this.flashBoard(FB_RED);
  }

  launch(force: number) {
    if (!this.airborne) {
      this.velocity.y = force;
      this.airborne = true;
      this.flashBoard(FB_CYAN);
    }
  }

  // --- Character pose animation ---

  private updatePose(dt: number) {
    if (!this.rig) return;

    // Select target pose based on state
    let target: PoseTargets;
    if (this.airborne) {
      target = POSE_AIRBORNE;
    } else if (this.isPumping) {
      target = POSE_CROUCHING;
    } else {
      target = POSE_STANDING;
    }

    // Frame-rate independent lerp factor
    const t = 1 - Math.exp(-POSE_LERP_SPEED * dt);

    // Lerp all values toward target
    this.currentPose.hipsY = lerp(this.currentPose.hipsY, target.hipsY, t);
    this.currentPose.spineX = lerp(this.currentPose.spineX, target.spineX, t);
    this.currentPose.armLZ = lerp(this.currentPose.armLZ, target.armLZ, t);
    this.currentPose.armRZ = lerp(this.currentPose.armRZ, target.armRZ, t);
    this.currentPose.elbowLX = lerp(this.currentPose.elbowLX, target.elbowLX, t);
    this.currentPose.elbowRX = lerp(this.currentPose.elbowRX, target.elbowRX, t);
    this.currentPose.hipLX = lerp(this.currentPose.hipLX, target.hipLX, t);
    this.currentPose.hipRX = lerp(this.currentPose.hipRX, target.hipRX, t);
    this.currentPose.kneeLX = lerp(this.currentPose.kneeLX, target.kneeLX, t);
    this.currentPose.kneeRX = lerp(this.currentPose.kneeRX, target.kneeRX, t);

    // Apply to rig joints
    this.rig.hips.position.y = this.currentPose.hipsY;
    // Spine lean mapped to Z axis (negated) because hips are rotated 90° around Y
    this.rig.spine.rotation.x = 0;
    this.rig.spine.rotation.z = -this.currentPose.spineX;

    this.rig.leftArm.rotation.z = this.currentPose.armLZ;
    this.rig.rightArm.rotation.z = this.currentPose.armRZ;
    this.rig.leftForeArm.rotation.x = this.currentPose.elbowLX;
    this.rig.rightForeArm.rotation.x = this.currentPose.elbowRX;

    this.rig.leftUpLeg.rotation.x = this.currentPose.hipLX;
    this.rig.rightUpLeg.rotation.x = this.currentPose.hipRX;
    this.rig.leftLeg.rotation.x = this.currentPose.kneeLX;
    this.rig.rightLeg.rotation.x = this.currentPose.kneeRX;
  }

  // --- Board visual feedback ---

  private flashBoard(color: THREE.Color) {
    this.flashColor.copy(color);
    this.flashIntensity = 1.0;
  }

  private updateBoardFeedback(dt: number) {
    if (!this.boardMat) return;

    // Decay flash
    this.flashIntensity = Math.max(0, this.flashIntensity - dt * FB_FLASH_DECAY);

    // Base glow: pump accumulation (orange) or speed (blue tint)
    let baseR = 0, baseG = 0, baseB = 0;

    if (this.isPumping && !this.airborne) {
      const pumpGlow = Math.min(this.pumpSlopeAccum * 2, 1);
      baseR = FB_ORANGE.r * pumpGlow;
      baseG = FB_ORANGE.g * pumpGlow;
      baseB = FB_ORANGE.b * pumpGlow;
    }

    // Speed glow — subtle blue at high speed
    const speedFrac = this.speed / this.maxSpeed;
    if (speedFrac > 0.5) {
      const si = (speedFrac - 0.5) * 0.6;
      baseR = Math.max(baseR, 0.2 * si);
      baseG = Math.max(baseG, 0.5 * si);
      baseB = Math.max(baseB, 1.0 * si);
    }

    // Blend flash over base
    const fi = this.flashIntensity;
    this.boardMat.emissive.setRGB(
      baseR * (1 - fi) + this.flashColor.r * fi,
      baseG * (1 - fi) + this.flashColor.g * fi,
      baseB * (1 - fi) + this.flashColor.b * fi,
    );
    this.boardMat.emissiveIntensity = 1.0;
  }

  getBoundingBox(): THREE.Box3 {
    const half = this.mesh.userData.boundingSize as THREE.Vector3;
    return new THREE.Box3(
      this.position.clone().sub(half),
      this.position.clone().add(half)
    );
  }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.speed = 10;
    this.steerAngle = 0;
    this.airborne = false;
    this.health = 3;
    this.invulnerable = false;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.lastSlope = 0;
    this.pumpSlopeAccum = 0;
    this.currentTrick = null;
    this.spinAngle = 0;
    this.flipAngle = 0;
    this.trickScore = 0;
    this.pendingTrickName = null;
    this.trickFlashTimer = 0;
    this.mesh.visible = true;
    this.mesh.scale.set(1, 1, 1);
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);

    // Reset board feedback
    this.flashIntensity = 0;
    this.flashColor.setRGB(0, 0, 0);
    if (this.boardMat) {
      this.boardMat.emissive.setRGB(0, 0, 0);
      this.boardMat.emissiveIntensity = 0;
    }

    // Reset character pose
    this.currentPose = { ...POSE_STANDING };
    if (this.rig) {
      this.rig.hips.position.y = POSE_STANDING.hipsY;
      this.rig.spine.rotation.x = POSE_STANDING.spineX;
      this.rig.leftArm.rotation.z = POSE_STANDING.armLZ;
      this.rig.rightArm.rotation.z = POSE_STANDING.armRZ;
      this.rig.leftForeArm.rotation.x = POSE_STANDING.elbowLX;
      this.rig.rightForeArm.rotation.x = POSE_STANDING.elbowRX;
      this.rig.leftUpLeg.rotation.x = POSE_STANDING.hipLX;
      this.rig.rightUpLeg.rotation.x = POSE_STANDING.hipRX;
      this.rig.leftLeg.rotation.x = POSE_STANDING.kneeLX;
      this.rig.rightLeg.rotation.x = POSE_STANDING.kneeRX;
    }
  }
}
