import * as THREE from './node_modules/three/build/three.module.js';
import { courses, places, liftGround, terrainHeight, nearCourse, quadLiftGround, quadLine, pairLine, slopeAlong, slopeWidthScale,
  quadExitLength, quadExitPose, quadGlideLength } from './resort.js';
import { createLiftMotion } from './lift-motion.js';
import { createPopulation } from './people.js';
import { createChairModel, addSheaveTrain, addBullwheelDetails, gripCamContact, poseDetachableGrip } from './lift-model.js';

const liftSelect = document.querySelector('#lift-choice');
const quad = new URLSearchParams(location.search).get('lift') === 'quad';
liftSelect.value = quad ? 'quad' : 'pair';
liftSelect.addEventListener('change', () => {
  const url = new URL(location.href);
  if (liftSelect.value === 'quad') url.searchParams.set('lift', 'quad');
  else url.searchParams.delete('lift');
  location.assign(url);
});

const lower = quad ? places.quadBase : places.pairBase;
const upper = quad ? places.quadTop : places.pairTop;
const boarding = lower.along;
const unloading = upper.along;
const start = boarding - 10;
const end = unloading + 10;
const climbStart = quad ? quadLine.climbStart : pairLine.climbStart;
const climbEnd = quad ? quadLine.climbEnd : pairLine.climbEnd;
const boardingStart = boarding - 2.4;
const exitEnd = unloading + 3;
const mainSpeed = quad ? 5 : 2.4;
const stationSpeed = quad ? 0.85 : mainSpeed;
const cableHeight = quad ? 5.1 : 4.4;
const chairDrop = quad ? 4.15 : 3.8;
const chairCount = quad ? 7 : 8;
const wheelRadius = quad ? 2.65 : 2;
const lineLength = end - start;
const turnLength = Math.PI * wheelRadius;
const loopLength = 2 * (lineLength + turnLength);
const baseTurn = 2 * lineLength + turnLength;
const railDrop = quad ? 0.36 : 0;
const glideSeconds = 5.6;

function lineX(along) {
  const t = THREE.MathUtils.smoothstep(along, climbStart, climbEnd);
  return THREE.MathUtils.lerp(lower.x, upper.x, t);
}

const trackGround = quad ? quadLiftGround : liftGround;
const summit = trackGround(unloading);

function terminalWeight(distance) {
  const d = THREE.MathUtils.euclideanModulo(distance, loopLength);
  const along = d <= lineLength ? start + d : end - (d - lineLength - turnLength);
  if (d > lineLength && d < lineLength + turnLength || d >= baseTurn) return 1;
  const leaving = THREE.MathUtils.smoothstep(along, boarding + 4, boarding + 15);
  const arriving = THREE.MathUtils.smoothstep(along, unloading - 16, unloading - 4);
  return Math.max(1 - leaving, arriving);
}

function speedAt(distance) {
  return THREE.MathUtils.lerp(mainSpeed, stationSpeed, terminalWeight(distance));
}

// Distance from the speed match point, positive toward the open line.
const handoff = { aligned: 5.4, clamped: 9.8, railEnd: 13.8 };

function handoffDistance(distance) {
  const d = THREE.MathUtils.euclideanModulo(distance, loopLength);
  if ((d > lineLength && d < lineLength + turnLength) || d >= baseTurn) return -Infinity;
  const along = d <= lineLength ? start + d : end - (d - lineLength - turnLength);
  return Math.min(along - (boarding + 15), unloading - 16 - along);
}

function railSupport(distance) {
  return 1 - THREE.MathUtils.smoothstep(handoffDistance(distance), 0, handoff.aligned);
}

function gripOpen(distance) {
  return 1 - THREE.MathUtils.smoothstep(handoffDistance(distance), handoff.aligned, handoff.clamped);
}

function railFall(distance) {
  return 0.14 * THREE.MathUtils.smoothstep(handoffDistance(distance), handoff.clamped, handoff.railEnd);
}

const motion = createLiftMotion(loopLength, speedAt);
const quadUnloadTime = motion.secondsAt(unloading - start);

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const speedControl = document.querySelector('#speed');
const gripView = document.querySelector('#grip-view');
gripView.hidden = !quad;
let inspectingGrip = false;
gripView.addEventListener('click', () => {
  inspectingGrip = !inspectingGrip;
  gripView.setAttribute('aria-pressed', String(inspectingGrip));
  gripView.textContent = inspectingGrip ? '乗車視点に戻る' : '握索機を見る';
});
const finish = document.querySelector('#finish');
const restart = document.querySelector('#restart');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa6d7ed);
scene.fog = new THREE.FogExp2(0xb9d8ea, 0.0018);
const camera = new THREE.PerspectiveCamera(67, 1, 0.07, 980);
camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight(0xffffff, 0x7896ab, 2));
const sun = new THREE.DirectionalLight(0xfff1d9, 2);
sun.position.set(-30, 45, 20);
scene.add(sun);

function material(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true });
}

const snow = material(0xecf6fc);
const steel = material(0x34525b);
const orange = material(0xce542f);
const dark = material(0x252f35);
const pine = material(0x254943);
const bark = material(0x51463d);
const trailMarkers = new Map(courses.map(course => [course.level, material(course.color)]));

function mesh(geometry, surface, x, y, z, parent = scene) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function box(width, height, depth, surface, x, y, z, parent) {
  return mesh(new THREE.BoxGeometry(width, height, depth), surface, x, y, z, parent);
}

function liftPose(distance, position) {
  const d = THREE.MathUtils.euclideanModulo(distance, loopLength);
  if (d <= lineLength) {
    const along = start + d;
    position.set(lineX(along), trackGround(along) + cableHeight, -along);
    return -Math.atan2(lineX(along + 0.1) - lineX(along - 0.1), 0.2);
  }
  if (d < lineLength + turnLength) {
    const angle = (d - lineLength) / wheelRadius;
    position.set(upper.x + wheelRadius * (Math.cos(angle) - 1), summit + cableHeight, -end - wheelRadius * Math.sin(angle));
    return angle;
  }
  if (d <= 2 * lineLength + turnLength) {
    const along = end - (d - lineLength - turnLength);
    position.set(lineX(along) - 2 * wheelRadius, trackGround(along) + cableHeight, -along);
    return Math.PI - Math.atan2(lineX(along + 0.1) - lineX(along - 0.1), 0.2);
  }
  const angle = (d - 2 * lineLength - turnLength) / wheelRadius;
  position.set(lower.x - wheelRadius * (1 + Math.cos(angle)), trackGround(boarding) + cableHeight, -start + wheelRadius * Math.sin(angle));
  return Math.PI + angle;
}

const terrain = new THREE.PlaneGeometry(360, 820, 240, 490);
terrain.rotateX(-Math.PI / 2);
terrain.translate(35, 0, -30);
const vertices = terrain.attributes.position;
const colors = [];
const tint = new THREE.Color();
for (let i = 0; i < vertices.count; i++) {
  const x = vertices.getX(i);
  const along = -vertices.getZ(i);
  const y = terrainHeight(x, along);
  vertices.setY(i, y);
  const shade = terrainHeight(x - 0.8, along - 0.6) - y;
  const snowVariation = Math.sin(x*0.58+along*0.29)*Math.sin(along*0.33+x*0.14)*0.018;
  tint.set(0xdcecf5).lerp(snow.color, THREE.MathUtils.clamp(0.53 + shade*1.9, 0, 1));
  tint.multiplyScalar(0.98 + snowVariation);
  colors.push(tint.r, tint.g, tint.b);
}
terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrain.computeVertexNormals();
mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true }), 0, 0, 0);

const seatXs = quad ? [-.96, -.32, .32, .96] : [-.375, .375];
const waitingOffset = quad ? 3.25 : 2.55;
const platformY = trackGround(boarding) + .045;
const stationWidth = waitingOffset + (quad ? 3.25 : 2.5);
box(stationWidth, .16, 6.2, steel, lower.x + waitingOffset / 2,
  platformY - .08, -boarding + .73);
if (!quad) {
  box(4, .16, 3, steel, upper.x + 1.65, summit - .035, -unloading);
  box(.18, 1.4, .18, steel, upper.x - 1.25, summit + .7, -unloading - 1);
  box(.72, .42, .16, orange, upper.x - 1.25, summit + 1.4, -unloading - 1);
}

const laneColors = [material(0x24b978), material(0xf49b33)];
const whitePaint = material(0xf1f7f9);
const signalBody = material(0x192c31);
const lampRed = new THREE.MeshStandardMaterial({ color: 0xd52129, emissive: 0xff1521 });
const lampGreen = new THREE.MeshStandardMaterial({ color: 0x0beb7a, emissive: 0x00ff66 });
const signalX = lower.x + .16;
const signalZ = -boarding - 1.23;
for (const [index, seatX] of seatXs.entries()) {
  const paint = laneColors[index % laneColors.length];
  const width = quad ? .60 : .71;
  box(width, .018, .25, paint, lower.x + seatX, platformY + .011, -boarding - .57).name = 'boarding-stop-color';
  box(width, .018, .22, paint, lower.x + seatX + waitingOffset, platformY + .011, -boarding - .57).name = 'boarding-wait-color';
  for (let mark = 1; mark <= 3; mark++) {
    box(.055, .015, .42, paint, lower.x + seatX + waitingOffset,
      platformY + .01, -boarding + mark * .84);
  }
}
const stripeHalf = (quad ? 1.29 : .76);
box(stripeHalf * 2, .016, .067, whitePaint, lower.x, platformY + .01, -boarding - .78);
box(stripeHalf * 2, .016, .067, whitePaint, lower.x + waitingOffset, platformY + .01, -boarding - .78);
for (let mark = 0; mark < 5; mark++) {
  const x = lower.x + .53 + mark * (waitingOffset - .8) / 4;
  box(.24, .015, .045, whitePaint, x, platformY + .01, -boarding - .13);
  if (mark === 0) {
    for (const sign of [-1, 1]) {
      box(.16, .015, .045, whitePaint, x - .08, platformY + .01, -boarding - .13 + sign * .055).rotation.y = sign * .52;
    }
  }
}
const poleX = lower.x - (quad ? 1.76 : 1.12);
box(.13, 2.95, .13, steel, poleX, platformY + 1.475, signalZ);
box(signalX - poleX + .32, .09, .09, steel, (signalX + poleX) / 2, platformY + 2.86, signalZ);
box(.72, .30, .19, signalBody, signalX, platformY + 2.63, signalZ);
for (const [index, lamp] of [lampRed, lampGreen].entries()) {
  const x = signalX + (index - .5) * .29;
  const lens = mesh(new THREE.CylinderGeometry(.112,.112,.055,22), lamp, x, platformY + 2.63, signalZ + .113);
  lens.name = index === 0 ? 'boarding-light-red' : 'boarding-light-green';
  lens.rotation.x = Math.PI / 2;
}
let signalPermitted;
function updateBoardingSignal(permitted) {
  if (signalPermitted === permitted) return;
  signalPermitted = permitted;
  lampRed.color.setHex(permitted ? 0x310e12 : 0xd52129);
  lampRed.emissiveIntensity = permitted ? .006 : 1.7;
  lampGreen.color.setHex(permitted ? 0x0beb7a : 0x0d3325);
  lampGreen.emissiveIntensity = permitted ? 1.7 : .006;
}

for (const course of courses) {
  const trailVertices = [];
  const trailIndices = [];
  const surface = material(0xd9e9f1);
  for (const [i, [x, along]] of course.samples.entries()) {
    const before = course.samples[Math.max(0, i - 1)];
    const after = course.samples[Math.min(course.samples.length - 1, i + 1)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const width = course.width / (2 * Math.hypot(dx, dy));
    for (const side of [-1, 1]) {
      const edgeX = x - side * dy * width;
      const edgeAlong = along + side * dx * width;
      trailVertices.push(edgeX, terrainHeight(edgeX, edgeAlong) + 0.15, -edgeAlong);
    }
    const v = i * 2;
    if (i > 0) trailIndices.push(v - 2, v, v - 1, v - 1, v, v + 1);

    if (i > 8 && i % 30 === 0) {
      const markerX = x + dy * width * 1.14;
      const markerAlong = along - dx * width * 1.14;
      const y = terrainHeight(markerX, markerAlong);
      box(0.065, 0.94, 0.065, steel, markerX, y + 0.45, -markerAlong);
      box(0.26, 0.22, 0.11, trailMarkers.get(course.level), markerX, y + 0.86, -markerAlong);
    }
  }
  const trail = new THREE.BufferGeometry();
  trail.setAttribute('position', new THREE.Float32BufferAttribute(trailVertices, 3));
  trail.setIndex(trailIndices);
  trail.computeVertexNormals();
  const path = mesh(trail, surface, 0, 0, 0);
  path.name = course.name;
}

const signCanvas = document.createElement('canvas');
signCanvas.width = 512;
signCanvas.height = 256;
const signInk = signCanvas.getContext('2d');
signInk.fillStyle = '#19464d';
signInk.fillRect(0, 0, 512, 256);
signInk.strokeStyle = '#d1e8ed';
signInk.lineWidth = 8;
signInk.strokeRect(13, 13, 486, 230);
signInk.fillStyle = '#ffffff';
signInk.textAlign = 'center';
signInk.font = 'bold 52px sans-serif';
signInk.fillText(courses[0].name, 256, 107);
signInk.font = 'bold 34px sans-serif';
signInk.fillText('初級コース  ↘', 256, 178);
const signTexture = new THREE.CanvasTexture(signCanvas);
signTexture.colorSpace = THREE.SRGBColorSpace;
const trailSign = new THREE.Group();
const signAlong = places.pairTop.along + 3;
trailSign.position.set(7.6, terrainHeight(7.6, signAlong), -signAlong);
trailSign.rotation.y = -Math.PI / 2;
scene.add(trailSign);
for (const x of [-0.53, 0.53]) {
  box(0.09, 1.60, 0.09, steel, x, 0.8, 0, trailSign);
}
mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: signTexture }),
  0, 1.53, 0.052, trailSign);

if (quad) {
  const edge = material(0x239497);
  const flag = material(0xe67d37);
  for (let d = 3; d < quadExitLength - 2; d += 1.7) {
    const point = quadExitPose(d);
    const offsetX = Math.cos(point.yaw) * 2.05;
    const offsetAlong = Math.sin(point.yaw) * 2.05;
    for (const side of [-1, 1]) {
      const x = point.x + offsetX * side;
      const along = point.along + offsetAlong * side;
      const floor = terrainHeight(x, along);
      box(0.08, 0.85, 0.08, edge, x, floor + 0.42, -along);
      box(0.26, 0.26, 0.06, flag, x, floor + 0.77, -along).rotation.y = point.yaw;
    }
  }
}

const cable = new THREE.Group();
cable.name = 'lift-cable';
scene.add(cable);
const up = new THREE.Vector3(0, 1, 0);

function addCableSpan(from, to, surface = dark, radius = 0.045) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const midpoint = from.clone().lerp(to, 0.5);
  const span = mesh(new THREE.CylinderGeometry(radius, radius, direction.length() + 0.02, 8),
    surface, midpoint.x, midpoint.y, midpoint.z, cable);
  span.quaternion.setFromUnitVectors(up, direction.normalize());
}

function cablePosition(distance) {
  const point = new THREE.Vector3();
  liftPose(distance, point);
  return point;
}

const summitTurn = lineLength;
const stops = quad
  ? Array.from({ length: Math.ceil(lineLength / 2) + 1 }, (_, i) => Math.min(i * 2, lineLength))
  : [0, climbStart - start, climbEnd - start, summitTurn];
for (const distances of [stops, stops.toReversed().map(d => baseTurn - d)]) {
  for (let i = 1; i < distances.length; i++) {
    addCableSpan(cablePosition(distances[i - 1]), cablePosition(distances[i]));
  }
}

const driveTires = [];

function conveyorPoint(distance, side, height) {
  const point = new THREE.Vector3();
  const yaw = liftPose(distance, point);
  point.x += side * Math.cos(yaw);
  point.z -= side * Math.sin(yaw);
  point.y += height - railDrop * railSupport(distance);
  return point;
}

if (quad) {
  const rail = material(0x36717c);
  const railHead = material(0x8e9ba0);
  const tread = new THREE.MeshStandardMaterial({ color: 0x23292e, roughness: 0.82 });
  const hub = new THREE.MeshStandardMaterial({ color: 0xbfc5c5, roughness: 0.45, metalness: 0.3 });
  const stripe = material(0xd89956);
  const tireRadius = 0.145;
  const camSteel = material(0xc4a477);
  const tireGeometry = new THREE.CylinderGeometry(tireRadius, tireRadius, 0.19, 20);
  const hubGeometry = new THREE.CylinderGeometry(0.081, 0.081, 0.041, 16);
  const segments = Math.ceil(loopLength / 0.40);
  for (let i = 0; i < segments; i++) {
    const from = i * loopLength / segments;
    const to = (i + 1) * loopLength / segments;
    const d = (from + to) / 2;
    if (handoffDistance(d) >= handoff.railEnd) continue;
    for (const side of [-0.21, 0.21]) {
      addCableSpan(conveyorPoint(from, side, -0.05 - railFall(from)),
        conveyorPoint(to, side, -0.05 - railFall(to)), rail, 0.089);
      addCableSpan(conveyorPoint(from, side, 0.014 - railFall(from)),
        conveyorPoint(to, side, 0.014 - railFall(to)), railHead, 0.032);
    }
    if (handoffDistance(d) >= handoff.clamped) continue;
    const camA = gripCamContact(gripOpen(from));
    const camB = gripCamContact(gripOpen(to));
    addCableSpan(conveyorPoint(from, camA.side, camA.height + 0.038),
      conveyorPoint(to, camB.side, camB.height + 0.038), camSteel, 0.038);
    if (i % 2 !== 0) continue;
    const housing = new THREE.Group();
    housing.name = 'quad-drive-tire';
    housing.position.copy(conveyorPoint(d, 0.15, 0.355));
    housing.rotation.y = liftPose(d, new THREE.Vector3());
    cable.add(housing);
    const rotor = new THREE.Group();
    rotor.name = 'quad-tire-rotor';
    housing.add(rotor);
    mesh(tireGeometry, tread, 0, 0, 0, rotor).rotation.z = Math.PI / 2;
    mesh(hubGeometry, hub, 0.102, 0, 0, rotor).rotation.z = Math.PI / 2;
    box(0.016, 0.048, 0.031, stripe, 0.129, 0.071, 0, rotor);
    driveTires.push({ rotor, rate: speedAt(d) / tireRadius });
    if (i % 6 === 0) {
      box(0.69, 0.11, 0.21, steel, 0, 0.22, 0, housing);
      box(0.10, 0.26, 0.15, steel, 0.29, 0.12, 0, housing);
    }
  }
}

const wheels = [];
for (const [index, turnStart] of [summitTurn, baseTurn].entries()) {
  const along = index === 0 ? end : start;
  const y = trackGround(along);
  const z = -along;
  const x = lineX(along) - wheelRadius;
  const ground = terrainHeight(x, along);
  const height = y - ground + cableHeight + 0.48;
  box(0.62, height, 0.62, steel, x, ground + height / 2, z);
  box(1.4, 0.42, 1.28, steel, x, y + cableHeight + 0.40, z);
  if (quad) {
    const stationRoof = material(0x225460);
    const roofZ = z + (index === 0 ? 5.5 : -5.5);
    box(9.2, 0.24, 17, stationRoof, x, y + cableHeight + 1.15, roofZ);
    for (const offset of [-4.25, 4.25]) {
      for (const shift of [-6, 6]) {
        const floor = terrainHeight(x + offset, -roofZ - shift);
        const pole = y + cableHeight + 1.15 - floor;
        box(0.28, pole, 0.30, steel, x + offset, floor + pole / 2, roofZ + shift);
      }
    }
    for (const offset of [-3.35, 3.35]) {
      box(0.16, 0.32, 16.8, steel, x + offset, y + cableHeight + 0.78, roofZ);
    }
  }
  const wheel = new THREE.Group();
  wheel.name = index === 0 ? 'summit-wheel' : 'base-wheel';
  wheel.position.set(x, y + cableHeight + 0.08, z);
  scene.add(wheel);
  wheels.push(wheel);
  addBullwheelDetails(wheel, wheelRadius);
  for (let i = 0; i < 32; i++) {
    addCableSpan(cablePosition(turnStart + i * turnLength / 32), cablePosition(turnStart + (i + 1) * turnLength / 32));
  }
}

for (const along of quad ? [-264, -210, -153, -95, -35, 26, 90, 151, 213, 269, 321] : [35, 75, 116, 159, 203, 246]) {
  const y = trackGround(along);
  const x = lineX(along) - wheelRadius;
  const ground = terrainHeight(x, along);
  const height = y - ground + cableHeight + 0.42;
  box(0.34, height, 0.34, steel, x, ground + height / 2, -along);
  box(wheelRadius * 2 + 0.44, 0.19, 0.34, steel, x, y + cableHeight + 0.59, -along);
  for (const side of [-1, 1]) addSheaveTrain(scene, x + side * wheelRadius, y + cableHeight, -along);
}

const canopy = new THREE.ConeGeometry(1.28, 2.4, 7);
const trunk = new THREE.CylinderGeometry(0.10, 0.15, 1.1, 6);

function plantTree(x, along, scale) {
  const ground = terrainHeight(x, along);
  const tree = new THREE.Group();
  tree.position.set(x, ground, -along);
  tree.scale.setScalar(scale);
  tree.rotation.y = along * 0.5 + x;
  scene.add(tree);
  mesh(trunk, bark, 0, 0.48, 0, tree);
  for (let layer = 0; layer < 3; layer++) {
    const size = 1 - layer * 0.19;
    const y = 1.55 + layer * 0.8;
    mesh(canopy, pine, 0, y, 0, tree).scale.setScalar(size);
    mesh(canopy, snow, 0, y + 0.22, 0, tree).scale.set(size * 0.86, size * 0.92, size * 0.86);
  }
}

for (let row = 0; row < 11; row++) {
  for (const side of [-1, 1]) {
    for (let col = 0; col < 3; col++) {
      const along = slopeAlong(8 + row * 3.8 + Math.sin(row + col) * 1.4);
      const x = side * (3.4 + col * 3.15 + Math.cos(row * 2 + col) * 0.55 + (side < 0 ? 4 : 0));
      const scale = 0.92 + ((row + col * 2) % 5) * 0.14;
      if (!nearCourse(x, along, 1.8)) plantTree(x, along, scale);
    }
  }
}
plantTree(-8, slopeAlong(53), 0.85);
plantTree(5.6, slopeAlong(54), 0.75);

for (let row = 0; row < 12; row++) {
  for (let col = 0; col < 10; col++) {
    const along = slopeAlong(7 + row * 7.5 + Math.sin(col * 1.7 + row) * 2);
    const x = (14 + col * 5.8 + Math.cos(row * 1.7 + col) * 2) * slopeWidthScale;
    const scale = 0.82 + ((col * 7 + row * 3) % 6) * 0.12;
    const quadX = THREE.MathUtils.lerp(places.quadBase.x, places.quadTop.x,
      THREE.MathUtils.smoothstep(along, quadLine.climbStart, quadLine.climbEnd));
    const clearOfLift = x < quadX - 8.7 || x > quadX + 3.1;
    if (along < slopeAlong(86) && clearOfLift && !nearCourse(x, along, 2.05)) plantTree(x, along, scale);
  }
}

const lodge = new THREE.Group();
const timber = material(0x795242);
const roof = material(0x274d58);
const glass = material(0x78aebf);
lodge.position.set(places.base.x, terrainHeight(places.base.x, places.base.along), -places.base.along);
scene.add(lodge);
box(7.5, 2.8, 5.2, timber, 0, 1.4, 0, lodge);
for (const side of [-1, 1]) {
  const panel = box(4.5, 0.20, 5.8, roof, side * 1.95, 3.48, 0, lodge);
  panel.rotation.z = -side * 0.32;
  box(1.65, 1.08, 0.06, glass, side * 2.3, 1.53, -2.62, lodge);
}
box(1.0, 2.05, 0.09, steel, 0, 1.04, -2.63, lodge);
box(0.34, 1.15, 0.36, steel, 2.35, 3.96, 0.74, lodge);

const distantSnow = new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
const ridgeShape = new THREE.PlaneGeometry(116, 64, 56, 30);
ridgeShape.rotateX(-Math.PI / 2);
const peakTint = new THREE.Color();
for (const [x, along, height, rotation, seed] of [
  [-43, 132, 57, 0.22, 2], [35, 171, 86, -0.31, 6], [93, 143, 64, 0.30, 5],
  [155, 112, 79, 0.66, 8], [179, 35, 57, 0.95, 4], [238, 73, 92, 0.57, 10],
]) {
  const geometry = ridgeShape.clone();
  const points = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < points.count; i++) {
    const px = points.getX(i), pz=points.getZ(i);
    const crest = 7 * Math.sin(px * 0.13 + seed) + 4 * Math.sin(px * 0.27 - seed);
    const face = Math.max(0, 1 - Math.abs(pz-crest) / 25);
    const spine = Math.max(0, 1 - Math.abs(px) / 58);
    const teeth = 0.77 + 0.13 * Math.cos(px * 0.15 + seed) + 0.10 * Math.cos(px * 0.33 + seed);
    const y = height * spine ** 0.72 * face ** 1.15 * teeth;
    points.setY(i, y);
    peakTint.set(0x7999b1).lerp(snow.color, THREE.MathUtils.smoothstep(y + 5*Math.sin(px * 0.35), height*.28,height*.54));
    colors.push(peakTint.r,peakTint.g,peakTint.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const range = mesh(geometry,distantSnow,x * 2.55,-1,-slopeAlong(along));
  range.scale.set(2.6,2.0,2.5);
  range.rotation.y=rotation;
}

const chairModel = createChairModel(quad, chairDrop);
const chairs = Array.from({ length: chairCount }, (_, index) => {
  const chair = chairModel.clone();
  chair.name = 'lift-chair-' + index;
  scene.add(chair);
  return chair;
});
const population = createPopulation(scene, courses, terrainHeight, chairs, {
  quad, chairDrop, start, boarding, boardingStart, unloading, loopLength, x: lower.x, platformY, seatXs, waitingOffset,
});
const chairDistances = new Float64Array(chairs.length);
const seatSpacing = motion.duration / chairs.length;
const boardingTime = motion.secondsAt(boardingStart - start);
const speedReadout = document.querySelector('#line-speed');
let travel = 0;
let ropeTravel = 0;
let boardingTravel = 0;
let boardingChair = 0;
let along = start;
let phase;
let previousTime;
const waitingEye = new THREE.Vector3(lower.x + waitingOffset * .47, trackGround(boarding) + 1.92, -boarding + 4.65);
const seatedEye = new THREE.Vector3();
const pose = new THREE.Vector3();
const waitingYaw = -0.14;
const overlookYaw = quad ? 2.25 : -1.83;
let lookYaw = 0;
let lookPitch = 0;
let dragPointer;
const inspectionOffset = new THREE.Vector3();
const inspectionTarget = new THREE.Vector3();

const labels = {
  waiting: '麓駅で待機中',
  boarding: '自動乗車中',
  riding: '乗車中 · 山頂へ上昇',
  unloading: quad ? '自動降車中 · 緩斜面へ' : '自動降車中',
  arrived: quad ? '山頂駅の滑り出し区間を通過' : '山頂駅で降車',
  finished: '体験終了',
};

function setPhase(next) {
  phase = next;
  status.textContent = labels[next];
  status.dataset.phase = next;
  finish.hidden = next !== 'arrived';
  restart.hidden = next !== 'finished';
  speedControl.disabled = next === 'finished';
}

function begin() {
  // Reserve the next chair with enough approach remaining for the boarding animation.
  const nextSlot = Math.ceil((travel - boardingTime) / seatSpacing);
  boardingTravel = nextSlot * seatSpacing;
  boardingChair = THREE.MathUtils.euclideanModulo(-nextSlot, chairs.length);
  along = start + motion.distanceAt(travel - boardingTravel);
  previousTime = undefined;
  lookYaw = 0;
  lookPitch = 0;
  setPhase('waiting');
}

finish.addEventListener('click', () => setPhase('finished'));
restart.addEventListener('click', begin);

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || dragPointer !== undefined) return;
  dragPointer = event.pointerId;
  canvas.setPointerCapture(dragPointer);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== dragPointer) return;
  lookYaw -= event.movementX * 0.004;
  lookPitch = THREE.MathUtils.clamp(lookPitch - event.movementY * 0.004, -1.26, 1.26);
});
canvas.addEventListener('lostpointercapture', event => {
  if (event.pointerId === dragPointer) dragPointer = undefined;
});

function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
  camera.updateProjectionMatrix();
}

function stageAt(distance) {
  if (distance < boardingStart) return 'waiting';
  if (distance < boarding) return 'boarding';
  if (distance < unloading) return 'riding';
  if (quad ? travel - boardingTravel < quadUnloadTime + glideSeconds : distance < exitEnd) return 'unloading';
  return 'arrived';
}

function updateCamera() {
  seatedEye.copy(chairs[boardingChair].position);
  seatedEye.y += 1.02 - chairDrop;
  seatedEye.z -= 0.22;
  seatedEye.x += seatXs[quad ? 1 : 0];
  let heading = 0;
  let incline = 0;

  if (phase === 'waiting' || phase === 'boarding') {
    const progress = THREE.MathUtils.smoothstep(along, boardingStart, boarding);
    pose.copy(waitingEye).lerp(seatedEye, progress);
    heading = THREE.MathUtils.lerp(waitingYaw, 0, progress);
    incline = -0.14 * (1 - progress) - 0.12 * Math.sin(progress * Math.PI);
  } else if (phase === 'riding') {
    pose.copy(seatedEye);
  } else if (quad) {
    const elapsed = travel - boardingTravel - quadUnloadTime;
    const glide = THREE.MathUtils.smoothstep(elapsed, 0, glideSeconds);
    const landing = THREE.MathUtils.smoothstep(elapsed, 0, 1.65);
    const point = quadExitPose(glide * quadGlideLength);
    pose.set(point.x + seatXs[1] * (1 - landing),
      point.y + THREE.MathUtils.lerp(cableHeight - railDrop + 1.02 - chairDrop, 1.68, landing),
      -point.along);
    heading = point.yaw * landing;
    incline = -0.11 * landing;
  } else {
    const progress = THREE.MathUtils.smoothstep(along, unloading, exitEnd);
    const exitOffset = Math.min(along - unloading, exitEnd - unloading);
    pose.set(
      upper.x + seatXs[0] * (1 - progress) + 2.25 * progress,
      summit + THREE.MathUtils.lerp(cableHeight - railDrop + 1.02 - chairDrop, 1.68, progress)
        + 0.045 * Math.sin(progress * 4 * Math.PI) * Math.sin(progress * Math.PI),
      -unloading - 0.22 - exitOffset,
    );
    heading = overlookYaw * progress;
    incline = -0.10 * progress;
  }

  camera.position.copy(pose);
  camera.rotation.set(lookPitch + incline, lookYaw + heading, 0);
}

function terminalStatus(distance) {
  const along = start + distance;
  const weight = terminalWeight(distance);
  if (weight >= 0.999) return ' · 駅内搬送';
  if (weight > 0.001) return along < (boarding + unloading) / 2 ? ' · タイヤで加速' : ' · タイヤで減速';
  const transfer = handoffDistance(distance);
  const departure = along < (boarding + unloading) / 2;
  if (transfer < handoff.aligned) return departure ? ' · 索と同速・あごに導入' : ' · 索から分離';
  if (transfer < handoff.clamped) return departure ? ' · 握索機を閉じる' : ' · 握索機を開く';
  if (transfer < handoff.railEnd) return departure ? ' · 固定完了・レールを離れる' : ' · レールに乗る';
  return ' · 本線';
}

function frame(time) {
  const dt = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;

  const elapsed = dt * Number(speedControl.value);
  travel += elapsed;
  ropeTravel += elapsed * mainSpeed;
  const riderDistance = motion.distanceAt(travel - boardingTravel);
  along = start + riderDistance;
  if (phase !== 'finished') {
    const next = stageAt(along);
    if (phase !== next) setPhase(next);
  }

  for (const [i, chair] of chairs.entries()) {
    const distance = motion.distanceAt(travel + i * seatSpacing);
    chairDistances[i] = distance;
    chair.rotation.y = liftPose(distance, chair.position);
    if (quad) {
      chair.position.y -= railDrop * railSupport(distance);
      poseDetachableGrip(chair, gripOpen(distance));
      const d = THREE.MathUtils.euclideanModulo(distance, loopLength);
      const leaving = THREE.MathUtils.smoothstep(d, boarding - start + 1, boarding - start + 4);
      const arriving = THREE.MathUtils.smoothstep(d, unloading - start - 7, unloading - start - 2);
      const outbound = d < lineLength ? leaving * (1 - arriving) : 0;
      chair.getObjectByName('quad-safety-bar').rotation.x = 1.26 * (1 - outbound);
    }
  }
  population.updateSkiers(travel);
  updateBoardingSignal(population.updateBoarding(chairDistances, phase === 'waiting' || phase === 'boarding' || phase === 'riding' ? boardingChair : -1));
  for (const wheel of wheels) wheel.rotation.y = ropeTravel / wheelRadius;
  for (const { rotor, rate } of driveTires) rotor.rotation.x = travel * rate;
  const speedText = phase === 'arrived' || phase === 'finished' ? ''
    : quad && phase === 'unloading' && travel - boardingTravel - quadUnloadTime > 1.65 ? '緩斜面を滑走中'
      : speedAt(riderDistance).toFixed(2) + ' m/s（1倍時）' + (quad ? terminalStatus(riderDistance) : '');
  if (speedReadout.textContent !== speedText) speedReadout.textContent = speedText;
  updateCamera();
  if (inspectingGrip) {
    const chair = chairs[boardingChair];
    const yaw = chair.rotation.y;
    const offset = inspectionOffset.set(-0.96, 1.01, -0.80).applyAxisAngle(up, yaw + lookYaw * 0.55);
    camera.position.copy(chair.position).add(offset);
    camera.position.y += lookPitch * 0.6;
    camera.lookAt(inspectionTarget.copy(chair.position).addScaledVector(up, 0.025));
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
begin();
requestAnimationFrame(frame);
