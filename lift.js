import * as THREE from './node_modules/three/build/three.module.js';
import { courses, terrainHeight } from './resort.js';
import { addResortTerrain, addResortScenery } from './resort-view.js';
import { createLiftOperations } from './lift-operation.js';
import { createStationView } from './station-view.js';
import { createRideCamera } from './ride-camera.js';
import { createSkiRun } from './ski-run.js';
import { createRideAudio } from './ride-audio.js';
import * as pairChime from './ping1.mjs';
import * as quadChime from './ping2.mjs';
import * as jointClip from './joint.mjs';
import { createPopulation, createPlayerModel, poseSitting, queueSpacing } from './people.js';
import { createChairModel, chairParts, poseDetachableGrip } from './lift-model.js';

const liftSelect = document.querySelector('#lift-choice');
const quad = new URLSearchParams(location.search).get('lift') === 'quad';
liftSelect.value = quad ? 'quad' : 'pair';
liftSelect.addEventListener('change', () => {
  const url = new URL(location.href);
  if (liftSelect.value === 'quad') url.searchParams.set('lift', 'quad');
  else url.searchParams.delete('lift');
  location.assign(url);
});

const operations = createLiftOperations(quad);
const { lower, boarding, loadingStop, boardingContact, unloading, start, climbStart, chairDrop, chairCount, loopLength } = operations.config;
const { state, chairDistances, liftPose, mechanicsAt } = operations;

const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const speedControl = document.querySelector('#speed');
const gripView = document.querySelector('#grip-view');
const finish = document.querySelector('#finish');
const restart = document.querySelector('#restart');
const skiButton = document.querySelector('#start-ski');
const skiReturn = document.querySelector('#ski-return');
const skiControls = document.querySelector('#ski-controls');
const lookHelp = document.querySelector('#look-help');
const ski = createSkiRun();
const skiKeys = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'push', ArrowDown:'brake' };
const heldKeys = new Set();
const heldButtons = new Map();

function clearSkiInput() {
  heldKeys.clear();
  heldButtons.clear();
}

window.addEventListener('blur', clearSkiInput);
window.addEventListener('keydown', event => {
  if (!ski.state.running || trailMap.open || !skiKeys[event.key]) return;
  event.preventDefault();
  heldKeys.add(skiKeys[event.key]);
});
window.addEventListener('keyup', event => heldKeys.delete(skiKeys[event.key]));
for (const button of skiControls.querySelectorAll('button')) {
  button.addEventListener('pointerdown', event => {
    button.setPointerCapture(event.pointerId);
    heldButtons.set(event.pointerId, button.dataset.ski);
  });
  button.addEventListener('lostpointercapture', event => heldButtons.delete(event.pointerId));
}

function skiingInput() {
  const active = new Set([...heldKeys, ...heldButtons.values()]);
  return Object.fromEntries(Array.from(active, key => [key,true]));
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa6d7ed);
scene.fog = new THREE.FogExp2(0xb9d8ea, 0.0018);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7896ab, 2));
const sun = new THREE.DirectionalLight(0xfff1d9, 2);
sun.position.set(-30, 45, 20);
scene.add(sun);

function material(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true });
}

const steel = material(0x34525b);
const orange = material(0xce542f);
const dark = material(0x252f35);

function mesh(geometry, surface, x, y, z, parent = scene) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function box(width, height, depth, surface, x, y, z, parent) {
  return mesh(new THREE.BoxGeometry(width, height, depth), surface, x, y, z, parent);
}

addResortTerrain(scene);

const station = createStationView(scene, operations, { mesh, box, material, steel, orange, dark });
const audio = createRideAudio(document.querySelector('#ambient'), quad ? quadChime : pairChime, jointClip, quad ? {
  boarding: './announcements/01-boarding.wav',
  approaching: './announcements/02-approaching.wav',
  unloading: './announcements/03-unloading.wav',
} : null, station.speakers);
const { seatXs, waitingDepth, waitingOffset, platformY } = station;
const rideCamera = createRideCamera(canvas, gripView, operations.config, station);
const { camera } = rideCamera;
const player = createPlayerModel(scene);
const viewMode = document.querySelector('#view-mode');
const staffView = document.querySelector('#staff-view');
staffView.addEventListener('change', () => {
  const active = Boolean(staffView.value);
  rideCamera.reset();
  lookHelp.hidden = false;
  viewMode.disabled = active;
  gripView.disabled = active;
  if (active) rideCamera.setInspection(false);
});
let thirdPerson = false;
const playerTarget = new THREE.Vector3();

function updateThirdPerson(state, chair, skier, pose) {
  const active = !staffView.value && thirdPerson && !rideCamera.isInspecting();
  const sitting = active && state.phase === 'riding' && !skier.running && !skier.arrived;
  player.seated.visible = sitting;
  player.standing.visible = active && !sitting;
  if (!active) return;

  let yaw = pose.heading;
  if (sitting) {
    const seatX = seatXs[quad ? 1 : 0];
    yaw = chair.parent.rotation.y;
    player.seated.position.set(seatX, -chairDrop + .12, 0);
    chair.localToWorld(player.seated.position);
    const settle = 1 - state.sitProgress;
    player.seated.position.y += .10 * settle;
    player.seated.position.z += (state.along - loadingStop) * settle;
    const snowY = state.along < boarding + 65
      ? Math.max(state.along <= loadingStop + 1.1 ? platformY : -Infinity,
        terrainHeight(player.seated.position.x, -player.seated.position.z + .40))
      : -Infinity;
    const releaseStart = quad ? loadingStop + 1.1 : climbStart;
    const release = THREE.MathUtils.smoothstep(state.along, releaseStart, releaseStart + 3);
    poseSitting(player.seated, state.sitProgress, snowY, release, quad);
    player.seated.rotation.set(chair.rotation.x, yaw, 0, 'YXZ');
    playerTarget.copy(player.seated.position);
    playerTarget.y += .58;
  } else {
    player.standing.position.copy(pose.position);
    player.standing.position.y -= 1.58;
    let pitch = 0;
    if (skier.running || skier.arrived) {
      player.standing.position.y += .17;
      const ahead = terrainHeight(skier.x - Math.sin(yaw) * .5, skier.along + Math.cos(yaw) * .5);
      pitch = Math.atan2(ahead - terrainHeight(skier.x, skier.along), .5);
    }
    player.standing.rotation.set(pitch, yaw, skier.running ? skier.lean : 0, 'YXZ');
    playerTarget.copy(player.standing.position);
    playerTarget.y += .98;
  }
  const distance = sitting ? 2.65 : state.phase === 'waiting' ? 2.25 : 2.9;
  camera.position.copy(playerTarget);
  camera.position.x += Math.sin(yaw)*distance;
  camera.position.z += Math.cos(yaw)*distance;
  camera.position.y += sitting ? .53 : state.phase === 'waiting' ? 1.25 : .93;
  rideCamera.orbitAround(playerTarget);
}

viewMode.addEventListener('click', () => {
  thirdPerson = !thirdPerson;
  rideCamera.reset();
  lookHelp.hidden = false;
  if (thirdPerson) rideCamera.setInspection(false);
  viewMode.setAttribute('aria-pressed', String(thirdPerson));
  viewMode.textContent = thirdPerson ? '一人称視点' : '三人称視点';
});
gripView.addEventListener('click', () => {
  if (!rideCamera.isInspecting()) return;
  thirdPerson = false;
  viewMode.setAttribute('aria-pressed','false');
  viewMode.textContent = '三人称視点';
});

addResortScenery(scene, { mesh, box, material, steel });

const chairModel = createChairModel(quad, chairDrop);
const chairs = Array.from({ length: chairCount }, (_, index) => {
  const chair = chairModel.clone();
  chair.name = 'lift-chair-' + index;
  scene.add(chair);
  return chair;
});
const parts = quad ? chairs.map(chairParts) : [];
const carriers = chairs.map(chair => chair.getObjectByName('chair-carrier'));
const skiEye = new THREE.Vector3();
const population = createPopulation(scene, courses, terrainHeight, chairs, {
  quad, chairDrop, start, loadingStop, boardingContact, unloading, loopLength, climbStart, x: lower.x, platformY, seatXs, waitingDepth, waitingOffset,
});
const speedReadout = document.querySelector('#line-speed');
let shownPhase;
let previousTime;

const labels = {
  waiting: '麓駅で待機中',
  boarding: '自動乗車中',
  riding: '乗車中 · 山頂へ上昇',
  unloading: quad ? '自動降車中 · 緩斜面へ' : '自動降車中',
  arrived: quad ? '山頂駅の滑り出し区間を通過' : '山頂駅で降車',
  skiing: 'こもれび林間を滑走中',
  skiArrived: '麓の広場に到着',
  finished: '体験終了',
};

function setPhase(next) {
  shownPhase = next;
  status.textContent = labels[next];
  status.dataset.phase = next;
  finish.hidden = next !== 'arrived';
  restart.hidden = next !== 'finished';
  skiButton.hidden = quad || next !== 'arrived';
  skiReturn.hidden = next !== 'skiArrived';
  skiControls.hidden = next !== 'skiing';
  lookHelp.hidden = !staffView.value && !thirdPerson && (next === 'skiing' || next === 'skiArrived');
  speedControl.disabled = next === 'finished' || next === 'skiing' || next === 'skiArrived';
}

function begin() {
  operations.begin();
  previousTime = undefined;
  rideCamera.reset();
  setPhase(state.phase);
}

finish.addEventListener('click', () => {
  operations.finishRide();
  setPhase(state.phase);
});
restart.addEventListener('click', begin);
skiButton.addEventListener('click', () => {
  if (quad || state.phase !== 'arrived') return;
  clearSkiInput();
  ski.begin();
  setPhase('skiing');
  skiControls.querySelector('button').focus();
});
skiReturn.addEventListener('click', () => {
  ski.state.arrived = false;
  clearSkiInput();
  begin();
});

const trailMap = document.querySelector('#trail-map');
trailMap.addEventListener('close', clearSkiInput);
let resizeNeeded = false;

function onResize() {
  resizeNeeded = true;
}

function resize() {
  resizeNeeded = false;
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  rideCamera.resize(canvas.clientWidth, canvas.clientHeight);
}

const terminalLabels = {
  station: '駅内搬送', accelerate: 'タイヤで加速', decelerate: 'タイヤで減速',
  align: '索と同速・あごに導入', detach: '索から分離',
  close: '握索機を閉じる', open: '握索機を開く',
  releaseRail: '固定完了・レールを離れる', takeRail: 'レールに乗る', line: '本線',
};

let previousAlong;
let previousGreen;
const carrierMotion = { pitch: 0, bounce: 0 };
const listenerForward = new THREE.Vector3();
const listenerUp = new THREE.Vector3();

function frame(time) {
  const dt = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;

  operations.advance(dt * Number(speedControl.value));
  const { travel, ropeTravel, riderDistance, reservedChair, phase, glideElapsed, along } = state;
  if (phase === 'riding' && !staffView.value && !trailMap.open && !document.hidden
    && !ski.state.running && !ski.state.arrived
    && operations.towerBetween(previousAlong, along) !== undefined) audio.towerPass(operations.speedAt(riderDistance));
  if (quad && phase === 'riding' && !staffView.value && !trailMap.open && !document.hidden) {
    for (const [name, point] of Object.entries(operations.config.announcementPoints)) {
      if (previousAlong < point && along >= point) audio.announce(name);
    }
  }
  previousAlong = along;
  if (ski.state.running && !trailMap.open) ski.advance(dt, skiingInput());
  const playerPhase = ski.state.running ? 'skiing' : ski.state.arrived ? 'skiArrived' : phase;
  if (shownPhase !== playerPhase) setPhase(playerPhase);

  const riderChair = ['waiting', 'boarding', 'riding'].includes(phase) ? reservedChair : -1;
  const playerRow = phase === 'waiting' || phase === 'boarding' ? state.queueRow : -1;
  population.advanceBoarding(chairDistances, riderChair, travel);

  const terminal = quad ? operations.terminalModeAt(riderDistance) : null;
  const speedText = ski.state.running ? (ski.state.speed * 3.6).toFixed(0) + ' km/h'
    : phase === 'arrived' || phase === 'finished' ? ''
    : quad && phase === 'unloading' && glideElapsed > 1.65 ? '緩斜面を滑走中'
      : operations.speedAt(riderDistance).toFixed(2) + ' m/s（1倍時）' + (quad ? ' · ' + terminalLabels[terminal] : '');
  if (speedReadout.textContent !== speedText) speedReadout.textContent = speedText;
  const stationZone = phase === 'waiting' || phase === 'boarding' || phase === 'unloading'
    || (phase === 'riding' && (state.along < boarding + 24 || state.along > unloading - 24));
  const staffArea = staffView.value;
  const quiet = trailMap.open || document.hidden;
  const queue = operations.boardingQueueAt(travel);
  const nearBoarding = staffArea === 'boarding' || (!staffArea && !ski.state.running && !ski.state.arrived
    && (phase === 'waiting' || phase === 'boarding' || (phase === 'riding' && Math.abs(along - boarding) < 20)));
  if (previousGreen === false && queue.green && nearBoarding && !quiet) audio.boardingChime();
  previousGreen = queue.green;
  const { start: baseWheel, end: summitWheel } = operations.config;
  const wheelDistance = Math.min(Math.abs(along - baseWheel), Math.abs(along - summitWheel));
  const motorLevel = staffArea ? .74 : !ski.state.running && !ski.state.arrived && phase !== 'finished'
    ? 1 - THREE.MathUtils.smoothstep(wheelDistance, 4, 24) : 0;
  audio.update({
    zone: staffArea ? 'station' : ski.state.running ? 'ski' : ski.state.arrived ? 'silent' : stationZone ? 'station' : phase === 'riding' ? 'line' : 'silent',
    speed: ski.state.running ? ski.state.speed : operations.speedAt(riderDistance),
    motorLevel,
    jointPhase: !staffArea && phase === 'riding' && (terminal === 'accelerate' || terminal === 'decelerate') ? terminal : null,
    quad, quiet,
  });
  if (!trailMap.open) {
    for (const [i, chair] of chairs.entries()) {
      const distance = chairDistances[i];
      chair.rotation.y = liftPose(distance, chair.position);
      if (quad) {
        const mechanics = mechanicsAt(distance);
        chair.position.y -= mechanics.carrierDrop;
        poseDetachableGrip(parts[i], mechanics.gripOpening);
        parts[i].bar.rotation.x = mechanics.barAngle;
      }
      operations.carrierMotionAt(distance, carrierMotion);
      carriers[i].rotation.x = carrierMotion.pitch;
      carriers[i].position.y = carrierMotion.bounce;
    }
    population.updateSkiers(travel);
    population.updateBoarding(chairDistances, riderChair, playerRow, queue, travel);
    station.updateBoardingSignal(queue.green);
    const skier = ski.state;
    const pose = skier.running || skier.arrived
      ? { position: skiEye.set(skier.x, terrainHeight(skier.x, skier.along) + 1.58, -skier.along), heading: skier.yaw, incline: -.135, lean: skier.lean }
      : rideCamera.riderPose(state, carriers[reservedChair], queueSpacing);
    rideCamera.update(pose, chairs[reservedChair]);
    updateThirdPerson(state, carriers[reservedChair], skier, pose);
    if (staffView.value) rideCamera.updateStaff(staffView.value);
    camera.getWorldDirection(listenerForward);
    listenerUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    audio.setListener(camera.position, listenerForward, listenerUp);
    if (resizeNeeded) resize();
    station.renderAt(travel, ropeTravel);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', onResize);
resize();
begin();
requestAnimationFrame(frame);
