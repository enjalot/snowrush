import * as THREE from 'three';
import type { InputState, TrickType, CharacterRig, ObstacleData } from '../types';
import type { TerrainManager } from '../terrain/TerrainManager';
import type { ResolvedPhysicsSettings } from '../physicsSettings';
import { clamp, lerp, remap } from '../utils/math';
import { CHUNK_WIDTH } from '../terrain/TerrainConfig';

// Physics constants
const BOARD_LEAN_RESPONSE = 8;
const MAX_BOARD_LEAN = Math.PI / 6;
const FAST_TRAVEL_ANGLE = Math.PI / 4;
const MAX_TRAVEL_ANGLE = Math.PI / 2 - 0.05;
const HORIZONTAL_SPEED_FACTOR = 0.35;
const MIN_SPEED = 5;

// Pump constants
const PUMP_SPEED_BOOST = 3;
const PUMP_ABSORB_SPEED_BOOST = 2;
const PUMP_SLOPE_BONUS = 6;
const RAIL_DRAG_FACTOR = 0.3;
const RAIL_SLOPE_FACTOR = 0.6;
const RAIL_ATTACH_COOLDOWN = 0.22;
const RAIL_SPIN_INPUT_THRESHOLD = 0.85;
const RAIL_MANUAL_INPUT_THRESHOLD = 0.85;
const RAIL_MANUAL_TILT = Math.PI / 7;
const RAIL_SCORE_GRIND_PER_METER = 10;
const RAIL_SCORE_MANUAL_PER_METER = 22;
const RAIL_SCORE_SPIN_PER_METER = 16;
const RAIL_SPIN_HALF_ROTATION_BONUS = 55;
const RAIL_ENTRY_SPIN_MULTIPLIER_STEP = 0.2;
const RAIL_ENTRY_FLIP_MULTIPLIER_STEP = 0.35;
const RAIL_ENTRY_MULTIPLIER_CAP = 3;

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
const MAX_SPEED_CAP_DELTA = 20; // absolute headroom above configured max speed

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
  armLX: number;  armRX: number;
  elbowLX: number; elbowRX: number;
  hipLX: number;  hipRX: number;
  kneeLX: number; kneeRX: number;
}

interface RailRideState {
  obstacle: ObstacleData;
  startZ: number;
  endZ: number;
  centerX: number;
  startTopY: number;
  endTopY: number;
  distance: number;
  manualDistance: number;
  spinDistance: number;
  spinAngleStart: number;
  entryMultiplier: number;
  entryLabel: string | null;
}

const POSE_STANDING: PoseTargets = {
  hipsY: 0.65,
  spineX: 0.08,
  armLX: 0.2,   armRX: 0.2,
  elbowLX: -0.45, elbowRX: -0.45,
  hipLX: 0.15,  hipRX: 0.15,
  kneeLX: -0.3, kneeRX: -0.3,
};

const POSE_CROUCHING: PoseTargets = {
  hipsY: 0.5,
  spineX: 0.45,
  armLX: 0.55,  armRX: 0.55,
  elbowLX: -0.95, elbowRX: -0.95,
  hipLX: 0.8,   hipRX: 0.8,
  kneeLX: -1.35, kneeRX: -1.35,
};

const POSE_AIRBORNE: PoseTargets = {
  hipsY: 0.65,
  spineX: 0.02,
  armLX: -0.15, armRX: -0.15,
  elbowLX: -0.2, elbowRX: -0.2,
  hipLX: 0.05,  hipRX: 0.05,
  kneeLX: -0.15, kneeRX: -0.15,
};

const POSE_LERP_SPEED = 8;
const OUT_OF_BOUNDS_FALL_TIME = 5;
const SNOW_CONTACT_FULL = 0.06;
const SNOW_CONTACT_CUTOFF = 0.32;
const INPUT_NEUTRAL_THRESHOLD = 0.15;

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function normalizeTravelAngle(boardAngle: number): number {
  let travelAngle = wrapAngle(boardAngle);
  if (travelAngle > Math.PI / 2) travelAngle -= Math.PI;
  if (travelAngle < -Math.PI / 2) travelAngle += Math.PI;
  return clamp(travelAngle, -MAX_TRAVEL_ANGLE, MAX_TRAVEL_ANGLE);
}

export class Player {
  mesh: THREE.Group;
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3(0, 0, 0);
  speed = 10;
  boardAngle = 0;
  airborne = false;
  health = 3;
  invulnerable = false;

  // Trick state (public so Game can read for HUD)
  currentTrick: TrickType = null;
  trickScore = 0;
  pendingTrickName: string | null = null;
  private currentSpinTrick: Extract<TrickType, 'spin-left' | 'spin-right'> | null = null;
  private currentFlipTrick: Extract<TrickType, 'frontflip' | 'backflip'> | null = null;
  private spinAngle = 0;
  private flipAngle = 0;
  private trickFlashTimer = 0;
  private trickStartSteerAngle = 0;
  private trickInputLockSteer = false;
  private trickInputLockAccelerate = false;

  // Pump state
  private isPumping = false;
  private absorbedLanding = false;
  private lastSlope = 0;
  private pumpSlopeAccum = 0;
  private railRide: RailRideState | null = null;
  private railAttachCooldown = 0;
  private manualTilt = 0;

  private invulnerableTimer = 0;
  private invulnerableDuration = 1.5;
  private blinkTimer = 0;
  private outOfBoundsTimer = 0;
  private boardLean = 0;
  private carveIntensity = 0;
  private carveSign = 0;
  private snowContact = 0;

  // Board visual feedback
  private boardMat: THREE.MeshStandardMaterial | null = null;
  private flashColor = new THREE.Color(0, 0, 0);
  private flashIntensity = 0;
  private runStartZ = 0;

  // Character rig & pose animation
  private rig: CharacterRig | null = null;
  private currentPose: PoseTargets = { ...POSE_STANDING };
  private physics: ResolvedPhysicsSettings;

  constructor(mesh: THREE.Group, physics: ResolvedPhysicsSettings) {
    this.mesh = mesh;
    this.physics = physics;

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
    return this.physics.slopeAccel + dist * SLOPE_RAMP_RATE;
  }

  /** Minimum speed floor — rises with distance so the game gets faster */
  private get minSpeed(): number {
    const dist = Math.abs(this.position.z);
    return MIN_SPEED + dist * MIN_SPEED_RAMP;
  }

  /** Maximum speed ceiling — rises slightly with distance */
  private get maxSpeed(): number {
    const dist = Math.abs(this.position.z);
    return Math.min(
      this.physics.maxSpeed + dist * MAX_SPEED_RAMP,
      this.physics.maxSpeed + MAX_SPEED_CAP_DELTA,
    );
  }

  setPhysicsSettings(physics: ResolvedPhysicsSettings) {
    this.physics = physics;
    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);
  }

  private get travelAngle(): number {
    return normalizeTravelAngle(this.boardAngle);
  }

  get grounded(): boolean {
    return !this.airborne;
  }

  get grinding(): boolean {
    return this.railRide !== null;
  }

  get distanceTraveled(): number {
    return Math.abs(this.position.z - this.runStartZ);
  }

  get score(): number {
    return Math.floor(this.distanceTraveled) + this.trickScore;
  }

  get outOfBounds(): boolean {
    return this.outOfBoundsTimer > 0;
  }

  get speedRatio(): number {
    const range = Math.max(1, this.maxSpeed - this.minSpeed);
    return clamp((this.speed - this.minSpeed) / range, 0, 1);
  }

  get carveSprayIntensity(): number {
    return this.carveIntensity * this.snowContact;
  }

  get carveDirection(): number {
    return this.carveSign;
  }

  get snowContactAmount(): number {
    return this.snowContact;
  }

  getRideDirection(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(
      Math.sin(this.travelAngle),
      0,
      -Math.cos(this.travelAngle),
    );
  }

  private get travelSpeedFactor(): number {
    const absTravelAngle = Math.abs(this.travelAngle);
    if (absTravelAngle <= FAST_TRAVEL_ANGLE) return 1;
    return remap(
      absTravelAngle,
      FAST_TRAVEL_ANGLE,
      MAX_TRAVEL_ANGLE,
      1,
      HORIZONTAL_SPEED_FACTOR,
    );
  }

  update(dt: number, input: InputState, terrainManager: TerrainManager) {
    this.railAttachCooldown = Math.max(0, this.railAttachCooldown - dt);

    if (this.outOfBounds) {
      this.snowContact = 0;
      this.updateOutOfBoundsFall(dt);
      return;
    }

    if (this.railRide) {
      this.updateRailRide(dt, input, terrainManager);
      return;
    }

    const previousBoardAngle = this.boardAngle;

    // --- Steering (ONLY on ground — no air steering) ---
    if (!this.airborne) {
      this.boardAngle = wrapAngle(this.boardAngle + input.steer * this.physics.turnSpeed * dt);
    }

    const leanTarget = this.airborne ? 0 : input.steer * MAX_BOARD_LEAN;
    const leanT = 1 - Math.exp(-BOARD_LEAN_RESPONSE * dt);
    this.boardLean = lerp(this.boardLean, leanTarget, leanT);

    // --- Speed: progressive slope accel + input + drag ---
    this.speed += this.slopeAccel * dt;
    if (!this.airborne) {
      this.speed += input.accelerate * this.physics.acceleration * dt;
    }
    this.speed -= this.speed * this.physics.drag * dt;
    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);

    const boardTurnDelta = wrapAngle(this.boardAngle - previousBoardAngle);
    const turnRate = Math.abs(boardTurnDelta) / Math.max(dt, 1e-4);
    const carveTarget = this.airborne
      ? 0
      : remap(turnRate * (0.25 + this.speedRatio * 0.75), 0.12, 1.4, 0, 1);
    const carveT = 1 - Math.exp(-10 * dt);
    this.carveIntensity = lerp(this.carveIntensity, carveTarget, carveT);
    this.carveSign = Math.abs(boardTurnDelta) > 1e-4 ? Math.sign(boardTurnDelta) : 0;

    // --- Velocity direction ---
    const travelSpeed = this.speed * this.travelSpeedFactor;
    this.velocity.z = -travelSpeed * Math.cos(this.travelAngle);
    this.velocity.x = travelSpeed * Math.sin(this.travelAngle);

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
        this.velocity.y = this.physics.popForce;
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
    this.velocity.y -= this.physics.gravity * dt;

    // --- Integrate position ---
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const halfWidth = CHUNK_WIDTH / 2;
    if (Math.abs(this.position.x) > halfWidth) {
      this.startOutOfBoundsFall();
      return;
    }

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

    const clearance = Math.max(0, this.position.y - groundY);
    const snowContactTarget = remap(clearance, SNOW_CONTACT_FULL, SNOW_CONTACT_CUTOFF, 1, 0);
    const snowContactT = 1 - Math.exp(-18 * dt);
    this.snowContact = lerp(this.snowContact, snowContactTarget, snowContactT);

    this.updateTransientEffects(dt);
    this.syncMeshTransform();
    this.updatePose(dt);
    this.updateBoardFeedback(dt);
  }

  private updateOutOfBoundsFall(dt: number) {
    this.snowContact = 0;
    this.outOfBoundsTimer = Math.max(0, this.outOfBoundsTimer - dt);
    this.velocity.y -= this.physics.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    if (this.trickFlashTimer > 0) {
      this.trickFlashTimer -= dt;
      if (this.trickFlashTimer <= 0) {
        this.pendingTrickName = null;
      }
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(this.flipAngle, this.spinAngle, 0);
    this.updatePose(dt);
    this.updateBoardFeedback(dt);

    if (this.outOfBoundsTimer <= 0) {
      this.health = 0;
      this.speed = 0;
      this.pendingTrickName = 'OUT OF BOUNDS!';
      this.trickFlashTimer = 1.5;
    }
  }

  private updateRailRide(dt: number, input: InputState, terrainManager: TerrainManager) {
    const railRide = this.railRide;
    if (!railRide) {
      return;
    }

    this.airborne = false;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.pumpSlopeAccum = 0;
    this.carveIntensity = 0;
    this.carveSign = 0;
    this.velocity.set(0, 0, -this.speed);

    this.speed += this.slopeAccel * RAIL_SLOPE_FACTOR * dt;
    this.speed -= this.speed * this.physics.drag * RAIL_DRAG_FACTOR * dt;
    this.speed = clamp(this.speed, this.minSpeed, this.maxSpeed);

    const previousZ = this.position.z;
    this.position.x = railRide.centerX;
    this.position.z = Math.max(railRide.endZ, this.position.z - this.speed * dt);
    const traveled = Math.max(0, previousZ - this.position.z);
    railRide.distance += traveled;
    this.position.y = this.sampleRailTopY(this.position.z, railRide);

    const spinInput = Math.abs(input.steer) >= RAIL_SPIN_INPUT_THRESHOLD ? Math.sign(input.steer) : 0;
    const manualInput = Math.abs(input.accelerate) >= RAIL_MANUAL_INPUT_THRESHOLD ? Math.sign(input.accelerate) : 0;
    const manualTarget = manualInput * RAIL_MANUAL_TILT;
    const tiltT = 1 - Math.exp(-10 * dt);

    if (spinInput < 0) {
      this.spinAngle += SPIN_SPEED * dt;
      railRide.spinDistance += traveled;
    } else if (spinInput > 0) {
      this.spinAngle -= SPIN_SPEED * dt;
      railRide.spinDistance += traveled;
    }

    if (manualInput !== 0) {
      railRide.manualDistance += traveled;
    }

    this.manualTilt = lerp(this.manualTilt, manualTarget, tiltT);
    this.boardLean = 0;
    this.snowContact = 0;

    const reachedRailEnd = this.position.z <= railRide.endZ + 1e-3;
    if (reachedRailEnd) {
      this.releaseRail(terrainManager);
      this.updateTransientEffects(dt);
      this.syncMeshTransform();
      this.updatePose(dt);
      this.updateBoardFeedback(dt);
      return;
    }

    this.updateTransientEffects(dt);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(this.manualTilt, this.spinAngle, 0);
    this.updatePose(dt);
    this.updateBoardFeedback(dt);
  }

  private updateTransientEffects(dt: number) {
    if (this.invulnerable) {
      this.invulnerableTimer -= dt;
      this.blinkTimer += dt;
      this.mesh.visible = Math.sin(this.blinkTimer * 15) > 0;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.mesh.visible = true;
      }
    }

    if (this.trickFlashTimer > 0) {
      this.trickFlashTimer -= dt;
      if (this.trickFlashTimer <= 0) {
        this.pendingTrickName = null;
      }
    }
  }

  private syncMeshTransform() {
    this.mesh.position.copy(this.position);

    if (this.airborne && this.hasAirTrick) {
      this.mesh.rotation.set(this.flipAngle, this.spinAngle, 0);
      return;
    }

    if (this.railRide) {
      this.mesh.rotation.set(this.manualTilt, this.spinAngle, 0);
      return;
    }

    this.mesh.rotation.y = -this.boardAngle;
    this.mesh.rotation.x = 0;
    this.mesh.rotation.z = this.boardLean;
  }

  private sampleRailTopY(z: number, railRide: RailRideState): number {
    const span = Math.max(0.001, railRide.startZ - railRide.endZ);
    const t = clamp((railRide.startZ - z) / span, 0, 1);
    return lerp(railRide.startTopY, railRide.endTopY, t);
  }

  private releaseRail(terrainManager: TerrainManager) {
    const railRide = this.railRide;
    if (!railRide) {
      return;
    }

    const halfTurns = Math.floor(Math.abs(this.spinAngle - railRide.spinAngleStart) / Math.PI);
    const rawPoints =
      railRide.distance * RAIL_SCORE_GRIND_PER_METER +
      railRide.manualDistance * RAIL_SCORE_MANUAL_PER_METER +
      railRide.spinDistance * RAIL_SCORE_SPIN_PER_METER +
      halfTurns * RAIL_SPIN_HALF_ROTATION_BONUS;
    const points = Math.floor(rawPoints * railRide.entryMultiplier);

    if (points > 0) {
      this.trickScore += points;
      this.pendingTrickName = this.buildRailComboName(railRide, halfTurns, points);
      this.trickFlashTimer = 2;
      this.flashBoard(FB_GREEN);
    }

    this.boardAngle = wrapAngle(-this.spinAngle);
    this.railRide = null;
    this.manualTilt = 0;
    this.railAttachCooldown = RAIL_ATTACH_COOLDOWN;
    this.lockAirTrickInputs();
    this.velocity.x = 0;
    this.velocity.z = -this.speed * Math.cos(this.travelAngle);
    this.settleOnGround(terrainManager);
  }

  private buildRailComboName(railRide: RailRideState, halfTurns: number, points: number): string {
    const parts: string[] = [];
    if (railRide.entryLabel) {
      parts.push(railRide.entryLabel);
    }
    if (railRide.distance > 0.8) {
      parts.push('Rail');
    }
    if (railRide.manualDistance > 0.8) {
      parts.push('Manual');
    }
    if (halfTurns > 0) {
      parts.push(`${halfTurns * 180} Spin`);
    } else if (railRide.spinDistance > 0.8) {
      parts.push('Spin');
    }

    return `${parts.length > 0 ? parts.join(' + ') : 'Rail Ride'} +${points}`;
  }

  private getRailEntryBonus() {
    let multiplier = 1;
    const labels: string[] = [];

    if (this.currentSpinTrick) {
      const angle = this.spinAngle - this.trickStartSteerAngle;
      const absAngle = Math.abs(angle);
      const halfRemainder = absAngle % Math.PI;
      const cleanHalf = halfRemainder < LANDING_TOLERANCE ||
        halfRemainder > (Math.PI - LANDING_TOLERANCE);
      const halfRotations = Math.round(absAngle / Math.PI);

      if (cleanHalf && halfRotations > 0) {
        multiplier += halfRotations * RAIL_ENTRY_SPIN_MULTIPLIER_STEP;
        labels.push(`${halfRotations * 180} In`);
      }
    }

    if (this.currentFlipTrick) {
      const absAngle = Math.abs(this.flipAngle);
      const remainder = absAngle % (Math.PI * 2);
      const deviation = remainder > Math.PI ? Math.PI * 2 - remainder : remainder;
      const fullRotations = deviation < FLIP_CLEAN_ZONE
        ? Math.round(absAngle / (Math.PI * 2))
        : Math.floor(absAngle / (Math.PI * 2));

      if (deviation < FLIP_CLEAN_ZONE && fullRotations > 0) {
        multiplier += fullRotations * RAIL_ENTRY_FLIP_MULTIPLIER_STEP;
        labels.push(`${fullRotations * 360} Flip In`);
      }
    }

    const clampedMultiplier = clamp(multiplier, 1, RAIL_ENTRY_MULTIPLIER_CAP);
    return {
      multiplier: clampedMultiplier,
      label: labels.length > 0 ? `${labels.join(' + ')} x${clampedMultiplier.toFixed(1)}` : null,
    };
  }

  private settleOnGround(terrainManager: TerrainManager) {
    const groundY = terrainManager.getHeightAt(this.position.x, this.position.z);
    if (this.position.y > groundY + 0.18) {
      this.airborne = true;
      this.velocity.y = Math.min(this.velocity.y, 0);
      return;
    }

    this.position.y = groundY;
    this.velocity.y = 0;
    this.airborne = false;
    this.snowContact = 1;
  }

  private get hasAirTrick(): boolean {
    return this.currentSpinTrick !== null || this.currentFlipTrick !== null;
  }

  private syncCurrentTrickState() {
    this.currentTrick = this.currentSpinTrick ?? this.currentFlipTrick;
  }

  private resetAirTrickState() {
    this.currentSpinTrick = null;
    this.currentFlipTrick = null;
    this.currentTrick = null;
    this.spinAngle = 0;
    this.flipAngle = 0;
    this.manualTilt = 0;
  }

  private lockAirTrickInputs() {
    this.trickInputLockSteer = true;
    this.trickInputLockAccelerate = true;
  }

  // --- Trick system ---

  private updateTricks(dt: number, input: InputState) {
    if (Math.abs(input.steer) <= INPUT_NEUTRAL_THRESHOLD) {
      this.trickInputLockSteer = false;
    }
    if (Math.abs(input.accelerate) <= INPUT_NEUTRAL_THRESHOLD) {
      this.trickInputLockAccelerate = false;
    }

    if (input.steer < -INPUT_NEUTRAL_THRESHOLD && !this.currentSpinTrick && !this.trickInputLockSteer) {
      this.currentSpinTrick = 'spin-left';
      this.trickStartSteerAngle = -this.boardAngle;
      this.spinAngle = -this.boardAngle;
    } else if (input.steer > INPUT_NEUTRAL_THRESHOLD && !this.currentSpinTrick && !this.trickInputLockSteer) {
      this.currentSpinTrick = 'spin-right';
      this.trickStartSteerAngle = -this.boardAngle;
      this.spinAngle = -this.boardAngle;
    }

    if (input.accelerate > INPUT_NEUTRAL_THRESHOLD && !this.currentFlipTrick && !this.trickInputLockAccelerate) {
      this.currentFlipTrick = 'frontflip';
      this.flipAngle = 0;
      if (!this.currentSpinTrick) {
        this.spinAngle = -this.boardAngle;
      }
    } else if (input.accelerate < -INPUT_NEUTRAL_THRESHOLD && !this.currentFlipTrick && !this.trickInputLockAccelerate) {
      this.currentFlipTrick = 'backflip';
      this.flipAngle = 0;
      if (!this.currentSpinTrick) {
        this.spinAngle = -this.boardAngle;
      }
    }

    if (this.currentSpinTrick === 'spin-left' && input.steer < -INPUT_NEUTRAL_THRESHOLD) {
      this.spinAngle += SPIN_SPEED * dt;
    } else if (this.currentSpinTrick === 'spin-right' && input.steer > INPUT_NEUTRAL_THRESHOLD) {
      this.spinAngle -= SPIN_SPEED * dt;
    }

    if (this.currentFlipTrick === 'frontflip' && input.accelerate > INPUT_NEUTRAL_THRESHOLD) {
      this.flipAngle -= FLIP_SPEED * dt;
    } else if (this.currentFlipTrick === 'backflip' && input.accelerate < -INPUT_NEUTRAL_THRESHOLD) {
      this.flipAngle += FLIP_SPEED * dt;
    }

    this.syncCurrentTrickState();
  }

  private handleLanding(_input: InputState) {
    if (this.hasAirTrick) {
      let totalPoints = 0;
      let speedMultiplier = 1;
      let sloppy = false;
      let badLanding = false;
      const labels: string[] = [];

      if (this.currentSpinTrick) {
        const angle = this.spinAngle - this.trickStartSteerAngle;
        const absAngle = Math.abs(angle);
        this.boardAngle = wrapAngle(-this.spinAngle);

        const halfRemainder = absAngle % Math.PI;
        const cleanHalf = halfRemainder < LANDING_TOLERANCE ||
          halfRemainder > (Math.PI - LANDING_TOLERANCE);
        const halfRotations = Math.round(absAngle / Math.PI);

        if (cleanHalf && halfRotations > 0) {
          const points = Math.floor(TRICK_SCORE_SPIN * halfRotations * 0.5);
          totalPoints += points;
          const degrees = halfRotations * 180;
          const label = this.currentSpinTrick === 'spin-left' ? 'Left Spin' : 'Right Spin';
          labels.push(`${degrees}° ${label}`);
        } else if (halfRotations > 0) {
          const wrongness = Math.sin(halfRemainder);
          speedMultiplier *= 1 - wrongness * 0.5;
          sloppy = true;
        }
      }

      if (this.currentFlipTrick) {
        const absAngle = Math.abs(this.flipAngle);
        const remainder = absAngle % (Math.PI * 2);
        const deviation = remainder > Math.PI ? Math.PI * 2 - remainder : remainder;
        const fullRotations = deviation < FLIP_CLEAN_ZONE
          ? Math.round(absAngle / (Math.PI * 2))
          : Math.floor(absAngle / (Math.PI * 2));

        if (deviation < FLIP_CLEAN_ZONE) {
          if (fullRotations > 0) {
            const points = TRICK_SCORE_FLIP * fullRotations;
            totalPoints += points;
            const rotName = fullRotations === 1 ? '360' :
              fullRotations === 2 ? '720' :
              fullRotations === 3 ? '1080' : `${fullRotations * 360}`;
            const label = this.currentFlipTrick === 'frontflip' ? 'Frontflip' : 'Backflip';
            labels.push(`${rotName} ${label}`);
          }
        } else if (deviation < FLIP_DAMAGE_ZONE) {
          const wrongness = (deviation - FLIP_CLEAN_ZONE) / (FLIP_DAMAGE_ZONE - FLIP_CLEAN_ZONE);
          speedMultiplier *= 1 - wrongness * 0.5;
          sloppy = true;
        } else {
          badLanding = true;
        }
      }

      if (speedMultiplier < 1) {
        this.speed *= speedMultiplier;
      }

      if (badLanding) {
        this.hit();
        this.pendingTrickName = 'BAD LANDING!';
        this.trickFlashTimer = 1.5;
        this.flashBoard(FB_RED);
      } else if (totalPoints > 0) {
        this.trickScore += totalPoints;
        this.pendingTrickName = `${labels.join(' + ')} +${totalPoints}`;
        this.trickFlashTimer = 2.0;
        this.flashBoard(FB_GREEN);
      } else if (sloppy) {
        this.pendingTrickName = 'SLOPPY!';
        this.trickFlashTimer = 1.5;
        this.flashBoard(FB_YELLOW);
      }

      this.resetAirTrickState();
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
    this.damage(1);
  }

  attachToRail(obstacle: ObstacleData) {
    if (!obstacle.rail || this.railAttachCooldown > 0) {
      return;
    }

    if (this.railRide?.obstacle === obstacle) {
      return;
    }

    const entryBonus = this.airborne ? this.getRailEntryBonus() : { multiplier: 1, label: null };
    this.railRide = {
      obstacle,
      startZ: obstacle.rail.startZ,
      endZ: obstacle.rail.endZ,
      centerX: obstacle.rail.centerX,
      startTopY: obstacle.rail.startTopY,
      endTopY: obstacle.rail.endTopY,
      distance: 0,
      manualDistance: 0,
      spinDistance: 0,
      spinAngleStart: -this.boardAngle,
      entryMultiplier: entryBonus.multiplier,
      entryLabel: entryBonus.label,
    };
    this.airborne = false;
    this.currentSpinTrick = null;
    this.currentFlipTrick = null;
    this.currentTrick = null;
    this.flipAngle = 0;
    this.spinAngle = -this.boardAngle;
    this.manualTilt = 0;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.pumpSlopeAccum = 0;
    this.velocity.set(0, 0, -this.speed);
    this.position.x = obstacle.rail.centerX;
    this.position.z = clamp(this.position.z, obstacle.rail.endZ, obstacle.rail.startZ);
    this.position.y = this.sampleRailTopY(this.position.z, this.railRide);
    this.snowContact = 0;
  }

  private startOutOfBoundsFall() {
    this.railRide = null;
    this.manualTilt = 0;
    this.outOfBoundsTimer = OUT_OF_BOUNDS_FALL_TIME;
    this.airborne = true;
    this.snowContact = 0;
    this.invulnerable = false;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.pumpSlopeAccum = 0;
    this.resetAirTrickState();
    this.pendingTrickName = 'OUT OF BOUNDS!';
    this.trickFlashTimer = 1.5;
    this.flashBoard(FB_RED);
  }

  launch(force: number) {
    if (!this.airborne && !this.railRide) {
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
    } else if (this.railRide || Math.abs(this.manualTilt) > 0.08) {
      target = POSE_CROUCHING;
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
    this.currentPose.armLX = lerp(this.currentPose.armLX, target.armLX, t);
    this.currentPose.armRX = lerp(this.currentPose.armRX, target.armRX, t);
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

    this.rig.leftArm.rotation.x = this.currentPose.armLX;
    this.rig.rightArm.rotation.x = this.currentPose.armRX;
    this.rig.leftArm.rotation.z = 0;
    this.rig.rightArm.rotation.z = 0;
    this.rig.leftForeArm.rotation.x = this.currentPose.elbowLX;
    this.rig.rightForeArm.rotation.x = this.currentPose.elbowRX;

    this.rig.leftUpLeg.rotation.x = -this.currentPose.hipLX;
    this.rig.rightUpLeg.rotation.x = -this.currentPose.hipRX;
    this.rig.leftLeg.rotation.x = -this.currentPose.kneeLX;
    this.rig.rightLeg.rotation.x = -this.currentPose.kneeRX;
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

  getLabelAnchorPosition(target = new THREE.Vector3()): THREE.Vector3 {
    const head = this.rig?.head;
    this.mesh.updateWorldMatrix(true, false);

    if (head) {
      head.getWorldPosition(target);
      target.y += 0.45;
      return target;
    }

    return target.copy(this.position).add(new THREE.Vector3(0, 1.9, 0));
  }

  placeAt(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.railRide = null;
    this.manualTilt = 0;
    this.trickInputLockSteer = false;
    this.trickInputLockAccelerate = false;
    this.mesh.position.copy(this.position);
    this.runStartZ = z;
  }

  relocateTo(x: number, y: number, z: number, speed = this.speed, boardAngle = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.speed = clamp(speed, this.minSpeed, this.maxSpeed);
    this.boardAngle = boardAngle;
    this.airborne = false;
    this.railRide = null;
    this.railAttachCooldown = 0;
    this.trickInputLockSteer = false;
    this.trickInputLockAccelerate = false;
    this.outOfBoundsTimer = 0;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.pumpSlopeAccum = 0;
    this.resetAirTrickState();
    this.manualTilt = 0;
    this.boardLean = 0;
    this.carveIntensity = 0;
    this.carveSign = 0;
    this.snowContact = 1;
    this.invulnerable = true;
    this.invulnerableTimer = 0.8;
    this.blinkTimer = 0;
    this.mesh.visible = true;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, -this.boardAngle, 0);
    this.pendingTrickName = null;
    this.trickFlashTimer = 0;
  }

  damage(amount = 1) {
    if (this.invulnerable || amount <= 0) return;
    this.railRide = null;
    this.resetAirTrickState();
    this.railAttachCooldown = RAIL_ATTACH_COOLDOWN;
    this.lockAirTrickInputs();
    this.health = Math.max(0, this.health - amount);
    this.speed *= 0.3;
    this.invulnerable = true;
    this.invulnerableTimer = this.invulnerableDuration;
    this.blinkTimer = 0;
    this.flashBoard(FB_RED);
  }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.speed = 10;
    this.boardAngle = 0;
    this.airborne = false;
    this.railRide = null;
    this.railAttachCooldown = 0;
    this.trickInputLockSteer = false;
    this.trickInputLockAccelerate = false;
    this.health = 3;
    this.invulnerable = false;
    this.outOfBoundsTimer = 0;
    this.isPumping = false;
    this.absorbedLanding = false;
    this.lastSlope = 0;
    this.pumpSlopeAccum = 0;
    this.resetAirTrickState();
    this.trickScore = 0;
    this.pendingTrickName = null;
    this.trickFlashTimer = 0;
    this.boardLean = 0;
    this.carveIntensity = 0;
    this.carveSign = 0;
    this.snowContact = 0;
    this.mesh.visible = true;
    this.mesh.scale.set(1, 1, 1);
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.runStartZ = 0;

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
      this.rig.spine.rotation.x = 0;
      this.rig.spine.rotation.z = -POSE_STANDING.spineX;
      this.rig.leftArm.rotation.x = POSE_STANDING.armLX;
      this.rig.rightArm.rotation.x = POSE_STANDING.armRX;
      this.rig.leftForeArm.rotation.x = POSE_STANDING.elbowLX;
      this.rig.rightForeArm.rotation.x = POSE_STANDING.elbowRX;
      this.rig.leftUpLeg.rotation.x = -POSE_STANDING.hipLX;
      this.rig.rightUpLeg.rotation.x = -POSE_STANDING.hipRX;
      this.rig.leftLeg.rotation.x = -POSE_STANDING.kneeLX;
      this.rig.rightLeg.rotation.x = -POSE_STANDING.kneeRX;
      this.rig.leftArm.rotation.z = 0;
      this.rig.rightArm.rotation.z = 0;
    }
  }
}
