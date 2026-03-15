import * as THREE from 'three';
import type { CharacterRig } from '../types';

// Stick-figure limb dimensions
const LIMB_RADIUS = 0.04;
const JOINT_RADIUS = 0.06;
const UPPER_ARM_LEN = 0.28;
const FOREARM_LEN = 0.25;
const UPPER_LEG_LEN = 0.28;
const LOWER_LEG_LEN = 0.28;
const FOOT_LENGTH = 0.18;
const FOOT_HEIGHT = 0.04;
const FOOT_WIDTH = 0.1;

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);

  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
  return shape;
}

function createBoardGeometry(
  width: number,
  thickness: number,
  length: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width, length, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

/** Create a named joint with a limb cylinder hanging downward and a sphere at the pivot */
function createLimb(
  name: string,
  x: number, y: number, z: number,
  length: number,
  mat: THREE.MeshStandardMaterial,
  parent: THREE.Object3D,
): THREE.Object3D {
  const joint = new THREE.Object3D();
  joint.name = name;
  joint.position.set(x, y, z);
  parent.add(joint);

  // Small sphere at joint pivot
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(JOINT_RADIUS, 6, 6),
    mat,
  );
  sphere.castShadow = true;
  joint.add(sphere);

  // Cylinder hanging downward from joint
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(LIMB_RADIUS, LIMB_RADIUS, length, 6),
    mat,
  );
  cyl.position.y = -length / 2;
  cyl.castShadow = true;
  joint.add(cyl);

  return joint;
}

function createFoot(
  name: string,
  mat: THREE.MeshStandardMaterial,
  parent: THREE.Object3D,
): THREE.Mesh {
  const foot = new THREE.Mesh(
    new THREE.BoxGeometry(FOOT_LENGTH, FOOT_HEIGHT, FOOT_WIDTH),
    mat,
  );
  foot.name = name;
  foot.position.set(FOOT_LENGTH * 0.15, -LOWER_LEG_LEN - FOOT_HEIGHT / 2, 0);
  foot.castShadow = true;
  parent.add(foot);
  return foot;
}

export class PrimitiveFactory {
  static createSnowboarder(): THREE.Group {
    const group = new THREE.Group();

    // Shared materials
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x3355cc });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x2d2d38 });

    // ── Skeleton root: hips ──
    // Rotated ~90° so the body faces sideways on the board (snowboard stance)
    const hips = new THREE.Object3D();
    hips.name = 'hips';
    hips.position.set(0, 0.65, 0);
    hips.rotation.y = Math.PI / 2;
    group.add(hips);

    // ── Spine (child of hips) ──
    const spine = new THREE.Object3D();
    spine.name = 'spine';
    hips.add(spine);

    // Torso mesh (attached to spine, spans from hips up to shoulders)
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.12, 0.5, 8),
      clothMat,
    );
    torso.position.y = 0.25;
    torso.castShadow = true;
    spine.add(torso);

    // ── Head (child of spine) ──
    const headJoint = new THREE.Object3D();
    headJoint.name = 'head';
    headJoint.position.set(0, 0.55, 0);
    spine.add(headJoint);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      skinMat,
    );
    headMesh.castShadow = true;
    headJoint.add(headMesh);

    // ── Arms (children of spine, at shoulder height) ──
    const leftArm = createLimb('leftArm', -0.22, 0.45, 0, UPPER_ARM_LEN, clothMat, spine);
    const leftForeArm = createLimb('leftForeArm', 0, -UPPER_ARM_LEN, 0, FOREARM_LEN, skinMat, leftArm);

    const rightArm = createLimb('rightArm', 0.22, 0.45, 0, UPPER_ARM_LEN, clothMat, spine);
    const rightForeArm = createLimb('rightForeArm', 0, -UPPER_ARM_LEN, 0, FOREARM_LEN, skinMat, rightArm);

    // ── Legs (children of hips) ──
    const leftUpLeg = createLimb('leftUpLeg', -0.1, 0, 0, UPPER_LEG_LEN, jointMat, hips);
    const leftLeg = createLimb('leftLeg', 0, -UPPER_LEG_LEN, 0, LOWER_LEG_LEN, jointMat, leftUpLeg);
    createFoot('leftFoot', bootMat, leftLeg);

    const rightUpLeg = createLimb('rightUpLeg', 0.1, 0, 0, UPPER_LEG_LEN, jointMat, hips);
    const rightLeg = createLimb('rightLeg', 0, -UPPER_LEG_LEN, 0, LOWER_LEG_LEN, jointMat, rightUpLeg);
    createFoot('rightFoot', bootMat, rightLeg);

    // ── Snowboard (direct child of root, NOT skeleton) ──
    const boardGeo = createBoardGeometry(0.4, 0.04, 1.4, 0.1);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.name = 'board';
    board.position.y = 0.03;
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);

    // Store rig reference for Player animation
    group.userData.rig = {
      hips, spine, head: headJoint,
      leftArm, leftForeArm, rightArm, rightForeArm,
      leftUpLeg, leftLeg, rightUpLeg, rightLeg,
    } as CharacterRig;

    group.userData.boundingSize = new THREE.Vector3(0.3, 0.9, 0.5);
    return group;
  }

  static createTree(): THREE.Group {
    const group = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage (3 stacked cones for pine tree look)
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });

    const cone1Geo = new THREE.ConeGeometry(1.2, 2.0, 8);
    const cone1 = new THREE.Mesh(cone1Geo, foliageMat);
    cone1.position.y = 2.2;
    cone1.castShadow = true;
    group.add(cone1);

    const cone2Geo = new THREE.ConeGeometry(0.9, 1.6, 8);
    const cone2 = new THREE.Mesh(cone2Geo, foliageMat);
    cone2.position.y = 3.2;
    cone2.castShadow = true;
    group.add(cone2);

    const cone3Geo = new THREE.ConeGeometry(0.6, 1.2, 8);
    const cone3 = new THREE.Mesh(cone3Geo, foliageMat);
    cone3.position.y = 4.0;
    cone3.castShadow = true;
    group.add(cone3);

    group.userData.boundingSize = new THREE.Vector3(1.0, 2.5, 1.0);
    return group;
  }

  static createRock(): THREE.Group {
    const group = new THREE.Group();

    const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
    // Slightly perturb vertices for a natural look
    const pos = rockGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (0.85 + Math.random() * 0.3),
        pos.getY(i) * (0.7 + Math.random() * 0.3),
        pos.getZ(i) * (0.85 + Math.random() * 0.3)
      );
    }
    rockGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.9 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.y = 0.3;
    rock.castShadow = true;
    group.add(rock);

    group.userData.boundingSize = new THREE.Vector3(0.6, 0.5, 0.6);
    return group;
  }

  static createRamp(): THREE.Group {
    const group = new THREE.Group();

    // Wedge/ramp built with custom BufferGeometry, centered at group origin.
    // Player approaches from +Z, ramp slopes up toward -Z (the launch lip).
    const halfW = 1.5;   // lateral half-width (X)
    const halfD = 1.5;   // half-depth along Z
    const height = 1.0;  // peak height at the -Z lip

    // prettier-ignore
    const vertices = new Float32Array([
      // Bottom face
      -halfW, 0,  halfD,    halfW, 0,  halfD,    halfW, 0, -halfD,
      -halfW, 0,  halfD,    halfW, 0, -halfD,   -halfW, 0, -halfD,
      // Slope face (ramp surface: low at +Z, high at -Z)
      -halfW, 0,  halfD,    halfW, 0,  halfD,    halfW, height, -halfD,
      -halfW, 0,  halfD,    halfW, height, -halfD, -halfW, height, -halfD,
      // Back face (the vertical lip at -Z)
      -halfW, 0, -halfD,    halfW, 0, -halfD,    halfW, height, -halfD,
      -halfW, 0, -halfD,    halfW, height, -halfD, -halfW, height, -halfD,
      // Left side triangle
      -halfW, 0,  halfD,   -halfW, height, -halfD, -halfW, 0, -halfD,
      // Right side triangle
       halfW, 0,  halfD,    halfW, 0, -halfD,     halfW, height, -halfD,
    ]);

    const rampGeo = new THREE.BufferGeometry();
    rampGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    rampGeo.computeVertexNormals();

    const rampMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.3 });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    group.add(ramp);

    group.userData.boundingSize = new THREE.Vector3(halfW, height / 2, halfD);
    group.userData.isRamp = true;
    return group;
  }
}
