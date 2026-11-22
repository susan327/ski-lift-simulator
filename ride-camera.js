import * as THREE from './node_modules/three/build/three.module.js';
import { liftExitPose, exitRunLength } from './resort.js';

export function createRideCamera(canvas, gripView, config, { waitingDepth, waitingOffset, platformY, seatXs }) {
  const { quad, lower, upper, boarding, loadingStop, waitingAlong, unloading, summit, chairDrop,
    cableHeight, railDrop, glideSeconds } = config;
  const camera = new THREE.PerspectiveCamera(67, 1, 0.07, 1650);
  camera.rotation.order = 'YXZ';
  const up = new THREE.Vector3(0, 1, 0);

  const waitingEye = new THREE.Vector3(lower.x + seatXs[quad ? 1 : 0] + waitingOffset, platformY + 1.58, -loadingStop + waitingDepth);
  const seatedEye = new THREE.Vector3();
  const pose = new THREE.Vector3();
  let lookYaw = 0;
  let lookPitch = 0;
  let dragPointer;
  let pointerX, pointerY;
  const orbitOffset = new THREE.Vector3();
  const orbitAngles = new THREE.Spherical();
  const inspectionOffset = new THREE.Vector3();
  const inspectionTarget = new THREE.Vector3();

  gripView.hidden = !quad;
  let inspectingGrip = false;
  function setInspection(active) {
    inspectingGrip = active;
    gripView.setAttribute('aria-pressed', String(inspectingGrip));
    gripView.textContent = inspectingGrip ? '乗車視点に戻る' : '握索機を見る';
  }
  gripView.addEventListener('click', () => setInspection(!inspectingGrip));
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || dragPointer !== undefined) return;
    dragPointer = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(dragPointer);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer) return;
    lookYaw -= (event.clientX - pointerX) * 0.004;
    lookPitch = THREE.MathUtils.clamp(lookPitch - (event.clientY - pointerY) * 0.004, -1.26, 1.26);
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (event.pointerId === dragPointer) dragPointer = undefined;
  });

  function riderPose({phase, along, glideElapsed, queueRow, approachRowOffset, approach, sitProgress}, chair, queueSpacing) {
    seatedEye.set(seatXs[quad ? 1 : 0], 1.02 - chairDrop, -.22);
    chair.localToWorld(seatedEye);
    let heading = 0;
    let incline = 0;

    if (phase === 'waiting' || phase === 'boarding') {
      const progress = phase === 'boarding' ? approach : 0;
      pose.copy(waitingEye);
      pose.x -= waitingOffset * progress;
      pose.z = Math.max(-loadingStop, pose.z + (queueRow + approachRowOffset) * queueSpacing - waitingDepth * progress);
      heading = Math.atan2(waitingOffset, waitingDepth) * Math.sin(progress * Math.PI);
      incline = -.14;
    } else if (phase === 'riding') {
      pose.set(waitingEye.x - waitingOffset, waitingEye.y, -loadingStop).lerp(seatedEye, sitProgress);
      const openLine = THREE.MathUtils.smoothstep(Math.min(along - boarding, unloading - along), 15, 47);
      incline = -.16 * openLine * sitProgress;
    } else {
      const glide = THREE.MathUtils.smoothstep(glideElapsed, 0, glideSeconds);
      const landing = THREE.MathUtils.smoothstep(glideElapsed, 0, 1.25);
      const point = liftExitPose(upper, summit, glide * exitRunLength);
      pose.set(point.x + seatXs[quad ? 1 : 0] * (1 - landing),
        point.y + THREE.MathUtils.lerp(cableHeight - railDrop + 1.02 - chairDrop, 1.68, landing),
        -point.along);
      incline = -.11 * landing;
    }

    return { position: pose, heading, incline };
  }

  function update({ position, heading, incline, lean = 0 }, chair) {
    camera.position.copy(position);
    camera.rotation.set(lookPitch + incline, lookYaw + heading, lean);
    if (inspectingGrip) {
      const yaw = chair.rotation.y;
      const offset = inspectionOffset.set(-0.96, 1.01, -0.80).applyAxisAngle(up, yaw + lookYaw * 0.55);
      camera.position.copy(chair.position).add(offset);
      camera.position.y += lookPitch * 0.6;
      camera.lookAt(inspectionTarget.copy(chair.position).addScaledVector(up, 0.025));
    }
  }

  function orbitAround(target) {
    orbitAngles.setFromVector3(orbitOffset.subVectors(camera.position, target));
    orbitAngles.theta += lookYaw;
    orbitAngles.phi = THREE.MathUtils.clamp(orbitAngles.phi + lookPitch, .16, 1.52);
    camera.position.copy(target).add(orbitOffset.setFromSpherical(orbitAngles));
    camera.lookAt(target);
  }

  function updateStaff(area) {
    const loading = area === 'boarding';
    const { x } = loading ? lower : upper;
    const along = loading ? (boarding + waitingAlong) / 2 : unloading;
    const floor = loading ? platformY : summit;
    camera.position.set(x + (loading ? waitingOffset + 5.4 : 5.6), floor + (loading ? 5.4 : 3.1), -along + 1.8);
    camera.lookAt(x + (loading ? waitingOffset * .45 : .8), floor + .75, -along + (loading ? 1.1 : -.65));
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x + lookPitch, -1.5, 1.5);
    camera.rotation.y += lookYaw;
  }

  function reset() {
    lookYaw = 0;
    lookPitch = 0;
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  return { camera, reset, riderPose, update, orbitAround, updateStaff, resize, setInspection, isInspecting: () => inspectingGrip };
}
