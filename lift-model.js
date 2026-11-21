import * as THREE from './node_modules/three/build/three.module.js';

const zinc = new THREE.MeshStandardMaterial({ color: 0x8399a2, roughness: 0.32, metalness: 0.48 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x232b31, roughness: 0.86 });
const fastener = new THREE.MeshStandardMaterial({ color: 0x57666d, roughness: 0.42, metalness: 0.3 });
const padding = new THREE.MeshStandardMaterial({ color: 0x35414c, roughness: 0.74 });
const accent = new THREE.MeshStandardMaterial({ color: 0xba3f36, roughness: 0.55 });

function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, radius, material = zinc) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return part(parent, new THREE.TubeGeometry(curve, points.length * 5, radius, 10, false), material);
}

function beam(parent, w, h, d, material, x, y, z) {
  return part(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

function roundedPad(parent, w, h, depth, x, y, z) {
  const r = Math.min(w, h) * 0.24;
  const a = -w / 2, b = w / 2, c = -h / 2, d = h / 2;
  const outline = new THREE.Shape();
  outline.moveTo(a + r, c);
  outline.lineTo(b - r, c);
  outline.quadraticCurveTo(b, c, b, c + r);
  outline.lineTo(b, d - r);
  outline.quadraticCurveTo(b, d, b - r, d);
  outline.lineTo(a + r, d);
  outline.quadraticCurveTo(a, d, a, d - r);
  outline.lineTo(a, c + r);
  outline.quadraticCurveTo(a, c, a + r, c);
  return part(parent, new THREE.ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 5,
  }), padding, x, y, z);
}

const gripPivot = new THREE.Vector3(0.10, 0.13, 0);
const rollerArm = new THREE.Vector3(0.51, 0.26, 0);
const rollerRadius = 0.072;
const jawAngle = -0.58;
const springAxis = new THREE.Vector3(0, 1, 0);
const springEnd = new THREE.Vector3();
const springDirection = new THREE.Vector3();

export function gripCamContact(open) {
  const angle = jawAngle * open;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    side: gripPivot.x + rollerArm.x * c - rollerArm.y * s,
    height: gripPivot.y + rollerArm.x * s + rollerArm.y * c + rollerRadius,
  };
}

function addDetachableGrip(chair) {
  beam(chair, 0.36, 0.12, 0.33, fastener, 0.15, 0.07, 0.025);
  beam(chair, 0.41, 0.055, 0.50, zinc, 0.18, 0.185, 0.045);
  for (const z of [-0.125, 0.125]) {
    tube(chair, [[0.18,0.08,z], [0.077,0.081,z], [0.063,0.035,z],
      [0.063,-0.03,z], [0.027,-0.065,z]], 0.031);
  }
  part(chair, new THREE.CylinderGeometry(0.053,0.053,0.35,18),
    zinc, gripPivot.x, gripPivot.y, 0).rotation.x = Math.PI / 2;
  for (const [x, z] of [[-0.21,-0.153],[0.22,-0.18],[0.22,0.19]]) {
    part(chair, new THREE.CylinderGeometry(0.073,0.073,0.072,16),
      fastener, x, 0.112, z).rotation.z = Math.PI / 2;
  }

  const lever = new THREE.Group();
  lever.name = 'quad-grip-jaw';
  lever.position.copy(gripPivot);
  chair.add(lever);
  for (const z of [-0.105, 0.105]) {
    tube(lever, [[0,0,z],[-0.10,-0.06,z],[-0.174,-0.119,z],[-0.128,-0.177,z]],0.033);
    tube(lever, [[0,0,z],[0.18,0.091,z],[0.34,0.192,z],[rollerArm.x,rollerArm.y,z]],0.040);
  }
  const roller = part(lever, new THREE.CylinderGeometry(rollerRadius,rollerRadius,0.086,22),
    rubber, rollerArm.x, rollerArm.y, 0);
  roller.rotation.z = Math.PI / 2;
  part(lever, new THREE.CylinderGeometry(0.036,0.036,0.105,16),
    zinc, rollerArm.x, rollerArm.y, 0).rotation.z = Math.PI / 2;

  const helix = [];
  for (let i = 0; i <= 96; i++) {
    const turn = i / 96;
    helix.push([0.045 * Math.cos(turn * 14 * Math.PI),turn,0.045 * Math.sin(turn * 14 * Math.PI)]);
  }
  for (const side of [-1, 1]) {
    const spring = new THREE.Group();
    spring.name = side < 0 ? 'quad-grip-spring-front' : 'quad-grip-spring-back';
    spring.position.set(0.27, 0.105, side * 0.17);
    spring.userData.springTipZ = side * 0.114;
    chair.add(spring);
    tube(spring,helix,0.009);
    part(spring,new THREE.CylinderGeometry(0.023,0.023,1,12),fastener,0,0.5,0);
  }
  poseDetachableGrip(chair, 0);
}

export function poseDetachableGrip(chair, opening) {
  const lever = chair.getObjectByName('quad-grip-jaw');
  const angle = jawAngle * opening;
  lever.rotation.z = angle;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (const name of ['quad-grip-spring-front','quad-grip-spring-back']) {
    const spring = chair.getObjectByName(name);
    springEnd.set(gripPivot.x + 0.43*c - 0.216*s, gripPivot.y + 0.43*s + 0.216*c, spring.userData.springTipZ);
    springDirection.subVectors(springEnd,spring.position);
    spring.scale.y = springDirection.length();
    spring.quaternion.setFromUnitVectors(springAxis,springDirection.normalize());
  }
}


export function createChairModel(quad, drop) {
  const chair = new THREE.Group();
  const half = quad ? 1.28 : 0.75;
  const seat = -drop;
  tube(chair, [[0,-0.04,0.13],[0,-0.62,0.13],[0,-1.09,0.21],
    [0,-1.45,0.34],[0,seat+1.70,0.38],[0,seat+1.48,0.28]], quad ? 0.083 : 0.054);
  tube(chair, [[-half,seat+0.05,0.24],[-half,seat+0.55,0.25],[-half,seat+1.20,0.23],
    [-half+0.09,seat+1.43,0.23],[-half+0.29,seat+1.50,0.24],[0,seat+1.50,0.25],
    [half-0.29,seat+1.50,0.24],[half-0.09,seat+1.43,0.23],[half,seat+1.20,0.23],
    [half,seat+0.55,0.25],[half,seat+0.05,0.24]], 0.046);
  for (const side of [-1, 1]) {
    const x = side * half;
    tube(chair, [[x,seat+0.46,0.22],[x,seat+0.37,0.08],[x,seat+0.29,-0.23],
      [x,seat+0.18,-0.34],[x,seat+0.02,-0.32],[x,seat-0.08,-0.18],[x,seat-0.06,0.22]], 0.038);
  }
  for (const z of [-0.24, 0.19]) {
    tube(chair,[[-half,seat-0.075,z],[half,seat-0.075,z]],0.039);
  }
  beam(chair,half*2,0.045,0.07,accent,0,seat-0.035,-0.277);
  beam(chair,0.22,0.13,0.16,fastener,0,seat+1.50,0.29);
  const count = quad ? 4 : 2;
  const pitch = half * 2 / count;
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5 - count / 2) * pitch;
    const bottom = roundedPad(chair,pitch-0.06,0.49,0.055,x,seat+0.01,-0.02);
    bottom.rotation.x = -Math.PI / 2;
    const back = roundedPad(chair,pitch-0.08,quad ? 0.46 : 0.31,0.054,x,seat+0.32,0.18);
    back.rotation.x = -0.11;
    beam(chair,0.085,0.044,0.48,fastener,x,seat-0.089,0);
  }
  tube(chair, [[-half,seat+0.42,0.25],[half,seat+0.42,0.25]], 0.033);
  if (quad) {
    addDetachableGrip(chair);
    const bar = new THREE.Group();
    bar.name = 'quad-safety-bar';
    bar.position.set(0,seat+0.62,0.16);
    chair.add(bar);
    tube(bar,[[-half,0,0],[-half,0,-0.46],[-half+0.09,0,-0.70],
      [-half+0.30,0,-0.74],[half-0.30,0,-0.74],[half-0.09,0,-0.70],[half,0,-0.46],[half,0,0]],0.037,fastener);
    tube(bar,[[-half+0.14,0,-0.742],[half-0.14,0,-0.742]],0.052,rubber);
    for (const x of [-half/2, half/2]) {
      tube(bar,[[x,0,-0.73],[x,-0.30,-0.76],[x,-0.62,-0.73]],0.026);
      tube(bar,[[x-0.23,-0.62,-0.73],[x+0.23,-0.62,-0.73]],0.043,rubber);
    }
  }
  if (!quad) {
    beam(chair, 0.17, 0.12, 0.32, fastener, 0, 0.075, 0.07);
    part(chair,new THREE.CylinderGeometry(0.08,0.08,0.22,14),zinc,0,0.08,0.08).rotation.z = Math.PI / 2;
  }
  return chair;
}

export function addSheaveTrain(parent, x, y, z) {
  beam(parent,0.14,0.21,1.78,fastener,x+0.115,y+0.25,z);
  for (const offset of [-0.67,-0.22,0.22,0.67]) {
    const roller = part(parent,new THREE.CylinderGeometry(0.153,0.153,0.115,20),
      rubber,x,y+0.185,z+offset);
    roller.rotation.z = Math.PI / 2;
    part(parent,new THREE.CylinderGeometry(0.097,0.097,0.14,18),
      zinc,x,y+0.185,z+offset).rotation.z = Math.PI / 2;
  }
}

export function addBullwheelDetails(wheel, radius) {
  for (const height of [-0.08,0.08]) {
    part(wheel,new THREE.TorusGeometry(radius-0.14,0.068,12,64),zinc,0,height,0).rotation.x=Math.PI/2;
  }
  part(wheel,new THREE.CylinderGeometry(0.30,0.30,0.26,24),zinc);
  for (let i=0; i<8; i++) {
    const angle=i*Math.PI/4;
    const spoke=beam(wheel,0.10,0.10,radius-0.34,fastener,
      Math.sin(angle)*(radius+0.12)/2,0,Math.cos(angle)*(radius+0.12)/2);
    spoke.rotation.y=angle;
  }
}
