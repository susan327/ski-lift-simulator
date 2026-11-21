import * as THREE from './node_modules/three/build/three.module.js';

const fabric = color => new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
const pants = fabric(0x28313d);
const goggles = fabric(0x192e45);
const helmet = fabric(0xe5e9e9);
const glove = fabric(0x252b35);
const skin = fabric(0xca9075);
const snowEquipment = fabric(0x75a6ba);
const jacketColors = [0xd85831, 0x1a709b, 0x8c3b60, 0x517847, 0xd6ad3e];
const jackets = jacketColors.map(fabric);

const torsoGeometry = new THREE.CapsuleGeometry(0.18, 0.17, 5, 10);
const headGeometry = new THREE.SphereGeometry(0.104, 12, 8);
const limbGeometry = new THREE.CapsuleGeometry(0.065, 0.23, 4, 9);
const bootGeometry = new THREE.BoxGeometry(.13,.11,.24);
const skiGeometry = new THREE.BoxGeometry(0.075, 0.031, 1.18);
const poleGeometry = new THREE.CylinderGeometry(0.009, 0.009, 0.83, 7);
const boardOutline = new THREE.Shape();
boardOutline.moveTo(-0.12, -0.45);
boardOutline.quadraticCurveTo(-0.16, -0.62, 0, -0.69);
boardOutline.quadraticCurveTo(0.16, -0.62, 0.12, -0.45);
boardOutline.quadraticCurveTo(0.105, 0, 0.12, 0.45);
boardOutline.quadraticCurveTo(0.16, 0.62, 0, 0.69);
boardOutline.quadraticCurveTo(-0.16, 0.62, -0.12, 0.45);
boardOutline.quadraticCurveTo(-0.105, 0, -0.12, -0.45);
const boardGeometry = new THREE.ExtrudeGeometry(boardOutline, { depth: 0.03, bevelEnabled: false, curveSegments: 8 });
boardGeometry.rotateX(-Math.PI / 2);
const boardFinish = fabric(0x4b416e);

function mesh(parent, geometry, material, x, y, z) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x,y,z);
  parent.add(item);
  return item;
}

const bodies = new WeakMap();

function skier(colorIndex, snowboard) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  bodies.set(root, body);
  root.userData.snowboard = snowboard;
  if (snowboard) body.rotation.y = -Math.PI / 2;
  root.add(body);
  const jacket = jackets[colorIndex % jackets.length];
  const torso = mesh(body,torsoGeometry,jacket,0,0.99,0);
  torso.scale.z = 0.76;
  mesh(body,headGeometry,skin,0,1.29,-0.036);
  mesh(body,headGeometry,helmet,0,1.34,0.004).scale.set(1.07,0.98,1.04);
  mesh(body,new THREE.BoxGeometry(0.177,0.056,0.041),goggles,0,1.31,-0.104);
  for (const side of [-1,1]) {
    const x = side * 0.115;
    mesh(body,limbGeometry,pants,x,0.63,0.015).rotation.x = -0.37;
    mesh(body,limbGeometry,pants,x,0.32,-0.016).rotation.x = 0.27;
    mesh(body,limbGeometry,jacket,side * 0.208,0.94,-0.033).rotation.z = -side * 0.29;
    mesh(body,new THREE.SphereGeometry(0.056,9,6),glove,side * 0.246,0.78,-0.12);
    mesh(body,new THREE.BoxGeometry(0.13,0.11,0.24),glove,x,0.12,-0.033);
    if (!snowboard) {
      mesh(root,skiGeometry,snowEquipment,x,0.041,0);
      mesh(root,poleGeometry,fastPole,side * 0.29,0.41,0.023).rotation.x = -0.25;
    }
  }
  if (snowboard) mesh(root,boardGeometry,boardFinish,0,0.033,0);
  return root;
}

const fastPole = fabric(0x747b86);

const seatedLegs = new WeakMap();
const legLength = .39;

export function poseSitting(rider, progress, snowY = -Infinity, release = 1, quad = false) {
  const { legs, board } = seatedLegs.get(rider);
  const snow = snowY - rider.position.y;
  const groundedAnkle = snow + .085;
  const extendedAnkle = quad ? THREE.MathUtils.lerp(-.69, -.59, progress) : -.69;
  const ankleY = Math.max(groundedAnkle, THREE.MathUtils.lerp(extendedAnkle, -.43, release));
  const ankleZ = THREE.MathUtils.lerp(-.08, -.30, progress);
  const hipY = .035;
  const hipZ = -.025;
  const dy = ankleY - hipY;
  const dz = ankleZ - hipZ;
  const reach = Math.hypot(dy, dz);
  const bend = Math.sqrt(Math.max(0, legLength ** 2 - (reach / 2) ** 2));
  const kneeY = hipY + dy / 2 + dz / reach * bend;
  const kneeZ = hipZ + dz / 2 + dy / reach * bend;

  for (const { thigh, shin, ski, boot } of legs) {
    poseLegSegment(thigh, hipY, hipZ, kneeY, kneeZ);
    poseLegSegment(shin, kneeY, kneeZ, ankleY, ankleZ);
    boot.position.y = ankleY - .025;
    boot.position.z = ankleZ - .035;
    ski.position.y = ankleY - .0695;
    ski.position.z = ankleZ - .09;
  }
  board.position.y = ankleY - .085;
  board.position.z = ankleZ - .09;
}

function poseLegSegment(segment, y1, z1, y2, z2) {
  segment.position.y = (y1 + y2) / 2;
  segment.position.z = (z1 + z2) / 2;
  segment.rotation.x = Math.atan2(z1 - z2, y1 - y2);
  segment.scale.y = Math.hypot(y2 - y1, z2 - z1) / .36;
}

function seatedSkier(colorIndex) {
  const rider = new THREE.Group();
  const legs = [];
  const jacket = jackets[colorIndex % jackets.length];
  mesh(rider,torsoGeometry,jacket,0,0.38,0.031).scale.set(.78,.9,.78);
  mesh(rider,new THREE.CylinderGeometry(.061,.069,.113,10),jacket,0,.642,-.008);
  mesh(rider,headGeometry,helmet,0,0.754,-0.022).scale.setScalar(0.92);
  mesh(rider,new THREE.BoxGeometry(0.142,0.043,0.037),goggles,0,0.738,-0.109);
  for(const side of [-1,1]){
    const x=side*0.082;
    const thigh = mesh(rider,limbGeometry,pants,x,0.07,-0.173);
    const shin = mesh(rider,limbGeometry,pants,x,-0.102,-0.307);
    mesh(rider,limbGeometry,jacket,side*0.17,0.32,-0.11).scale.set(.8,.74,.82);
    const boot = mesh(rider,bootGeometry,glove,x,0,0);
    const ski = mesh(rider,skiGeometry,snowEquipment,x,-0.31,-0.45);
    ski.name = 'passenger-ski';
    legs.push({ thigh, shin, boot, ski });
  }
  const board = mesh(rider,boardGeometry,boardFinish,-0.065,-0.306,-0.42);
  board.name = 'passenger-board';
  board.rotation.y = Math.PI * 0.16;
  board.visible = false;
  seatedLegs.set(rider, { legs, board });
  poseSitting(rider, 1);
  return rider;
}

function createRoute(course) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < course.samples.length; i++) {
    const [x0,a0] = course.samples[i-1];
    const [x1,a1] = course.samples[i];
    path.add(new THREE.LineCurve(new THREE.Vector2(x0,a0),new THREE.Vector2(x1,a1)));
  }
  return path;
}

export const queueSpacing = 1.22;

export function createPopulation(scene, courses, terrainHeight, chairs, station) {
  const routeSpecs = [[6,5.0,2.05],[6,7.4,4.30],[4,7.0,2.03],[4,5.0,1.30]];
  const traffic = courses.flatMap((course,index) => {
    const route = createRoute(course);
    const [count,speed,width] = routeSpecs[index];
    return Array.from({length:count},(_,i)=>{
      const model = skier(i+index, i % 2 === 1);
      model.name = 'ski-runner';
      scene.add(model);
      return {model,route,speed,width,offset:(i+0.41) / count + index*0.071,phase:i*2.17};
    });
  });

  const { seatXs, quad, chairDrop } = station;
  const queue = seatXs.map((_, lane) => Array.from({ length: 3 }, (_, row) => {
    const model = skier(lane + row * 2, lane % 2 === 1);
    model.name = 'lift-queue-skier';
    model.userData.lane = lane;
    const materials = new Map();
    model.userData.jacket = bodies.get(model).children[0].material;
    model.traverse(part => {
      if (!part.isMesh) return;
      if (!materials.has(part.material)) materials.set(part.material, part.material.clone());
      part.material = materials.get(part.material);
    });
    model.userData.fadeMaterials = [...materials.values()];
    scene.add(model);
    return model;
  }));
  const seated = chairs.map((chair, index) => seatXs.map((x, lane) => {
    const passenger = seatedSkier(index + lane);
    passenger.name = 'lift-passenger';
    passenger.userData.seat = lane;
    passenger.position.set(x, -chairDrop + .12, 0);
    chair.getObjectByName('chair-carrier').add(passenger);
    return passenger;
  }));

  const entry = new THREE.Vector2();
  const ahead = new THREE.Vector2();
  const tangent = new THREE.Vector2();

  function updateSkiers(time) {
    for(const {model,route,speed,width,offset,phase} of traffic) {
      const fraction = THREE.MathUtils.euclideanModulo(time*speed/route.getLength()+offset,1);
      model.visible=fraction>0.045&&fraction<0.962;
      if(!model.visible)continue;
      route.getPoint(fraction,entry);
      route.getPoint(Math.min(1,fraction+.012),ahead);
      tangent.subVectors(ahead,entry).normalize();
      const turn=time*1.45+phase;
      const weave=Math.sin(turn)*width;
      const x=entry.x-tangent.y*weave;
      const along=entry.y+tangent.x*weave;
      const lean=Math.cos(turn);
      model.position.set(x,terrainHeight(x,along)+.19,-along);
      model.rotation.set(
        Math.atan2(terrainHeight(x+tangent.x*.4,along+tangent.y*.4)-terrainHeight(x,along),.4),
        Math.atan2(-tangent.x,tangent.y)+lean*.26,0,'YXZ');
      const body=bodies.get(model);
      const snowboard = model.userData.snowboard;
      body.rotation.z = snowboard ? 0 : -lean*.25;
      body.rotation.x = snowboard ? lean*.18 - .10 : 0;
      model.rotation.z = snowboard ? -lean*.23 : 0;
      body.position.y=-.045+.032*Math.abs(lean);
    }
  }

  let boardingChair = -1;
  const lastLap = new Array(chairs.length);
  const laneSteps = seatXs.map(() => -Infinity);
  const seatStyles = chairs.map(() => seatXs.map(() => null));
  const reservedSeat = quad ? 1 : 0;

  function advanceBoarding(distances, riderChair, travel) {
    const { start, boardingContact, loopLength } = station;
    distances.forEach((distance, index) => {
      const lap = Math.floor((distance + start - boardingContact) / loopLength);
      if (lastLap[index] !== undefined && lap > lastLap[index]) {
        boardingChair = index;
        queue.forEach((lane, seat) => {
          if (index === riderChair && seat === reservedSeat) return;
          seatStyles[index][seat] = lane[0];
          lane.push(lane.shift());
          laneSteps[seat] = travel;
        });
      }
      lastLap[index] = lap;
    });
  }

  function updateBoarding(distances, riderChair, playerRow, queueState, travel) {
    const { start, boardingContact, unloading, loopLength, loadingStop, climbStart, x, waitingDepth, waitingOffset } = station;
    const platformYAlong = along => along <= loadingStop + 1.1 ? station.platformY : -Infinity;
    seated.forEach((seats, index) => {
      const along = start + THREE.MathUtils.euclideanModulo(distances[index], loopLength);
      seats.forEach((passenger, seat) => {
        passenger.visible = along >= boardingContact && along <= unloading + 3 && !(index === riderChair && seat === reservedSeat);
        const model = seatStyles[index][seat];
        if (passenger.visible) {
          const sit = index === boardingChair ? THREE.MathUtils.smoothstep(queueState.sinceContact, 0, .55) : 1;
          const contactDistance = along - boardingContact;
          passenger.position.y = -chairDrop + .12 + .10 * (1 - sit);
          passenger.position.z = (contactDistance - (loadingStop - boardingContact)) * (1 - sit);
          const snowY = contactDistance < 65
            ? Math.max(platformYAlong(along), terrainHeight(chairs[index].position.x + seatXs[seat], along + .40))
            : -Infinity;
          const releaseStart = quad ? loadingStop + 1.1 : climbStart;
          const release = THREE.MathUtils.smoothstep(along, releaseStart, releaseStart + 3);
          poseSitting(passenger, sit, snowY - chairs[index].position.y, release, quad);
        }
        if (!model || passenger.userData.styleId === model.id) return;
        passenger.userData.styleId = model.id;
        for (const part of passenger.children) {
          if (jackets.includes(part.material)) part.material = model.userData.jacket;
          if (part.name === 'passenger-ski') part.visible = !model.userData.snowboard;
          if (part.name === 'passenger-board') part.visible = model.userData.snowboard;
        }
      });
    });
    queue.forEach((lane, laneIndex) => {
      const shuffle = THREE.MathUtils.smoothstep(travel - laneSteps[laneIndex], 0, .8);
      lane.forEach((person, row) => {
        const position = row + Number(laneIndex === reservedSeat && playerRow >= 0 && row >= playerRow);
        const boardingPerson = position === (queueState.early ? 1 : 0);
        const advance = queueState.early && position === 0 ? 1
          : boardingPerson ? queueState.progress : 0;
        const fade = row === lane.length - 1 ? shuffle : 1;
        person.visible = fade > 0;
        for (const surface of person.userData.fadeMaterials) {
          surface.opacity = fade;
          const transparent = fade < 1;
          if (surface.transparent !== transparent) {
            surface.transparent = transparent;
            surface.depthWrite = !transparent;
            surface.needsUpdate = true;
          }
        }
        const along = Math.min(loadingStop, loadingStop - waitingDepth * (1 - advance) - (position + 1 - shuffle) * queueSpacing);
        const px = x + seatXs[laneIndex] + waitingOffset * (1 - advance);
        const floor = Math.max(station.platformY, terrainHeight(px, along));
        person.position.set(px, floor + .035, -along);
        person.rotation.y = boardingPerson && advance > 0
          ? Math.atan2(waitingOffset, waitingDepth) * (1 - advance) : 0;
        bodies.get(person).rotation.x = .12 * Math.sin(Math.PI * advance);
      });
    });
  }

  return { updateSkiers, advanceBoarding, updateBoarding };
}

export function createPlayerModel(scene) {
  const standing = skier(1, false);
  const seated = seatedSkier(1);
  standing.name = 'player-standing';
  seated.name = 'player-seated';
  scene.add(standing, seated);
  standing.visible = false;
  seated.visible = false;
  return { standing, seated };
}