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
const appearances = new WeakMap();
const eyewearGeometry = new THREE.BoxGeometry(.177, .056, .041);
const hairTailGeometry = new THREE.CapsuleGeometry(.036, .10, 3, 6);
const helmetColors = [helmet, fabric(0xda765d), fabric(0x6b93ab), fabric(0xe4b85c), fabric(0x4a455c)];
const lensColors = [goggles, fabric(0x359ab3), fabric(0xc67f3f), fabric(0x9274ad)];
const hairColors = [fabric(0x2f2526), fabric(0x594139), fabric(0x94643d), fabric(0xc4a26b)];
const skinColors = [skin, fabric(0xe1ae8b), fabric(0x9e634b), fabric(0x744732)];

const profiles = [
  {height:1, width:1, headwear:'helmet', helmet:0, lens:0, skin:0},
  {height:.95, width:.91, headwear:'ponytail', helmet:1, hair:0, lens:1, skin:1},
  {height:1.05, width:1.06, headwear:'short', hair:1, lens:2, skin:2},
  {height:.73, width:.78, headwear:'helmet', helmet:3, lens:3, skin:1},
  {height:.90, width:.92, headwear:'bob', hair:2, lens:null, skin:3},
  {height:1.02, width:1.02, headwear:'helmet', helmet:2, lens:1, skin:2},
  {height:.79, width:.82, headwear:'helmet', helmet:1, lens:2, skin:0},
  {height:.94, width:.95, headwear:'braids', helmet:4, hair:3, lens:0, skin:1},
  {height:1.01, width:1.03, headwear:'short', hair:0, lens:null, skin:3},
];

const headParts = new WeakMap();
function buildHead(parent, y, z, size = 1) {
  const head = new THREE.Group();
  head.position.set(0, y, z);
  head.scale.setScalar(size);
  parent.add(head);
  const face = mesh(head, headGeometry, skin, 0, 0, 0);
  const cap = mesh(head, headGeometry, helmet, 0, .049, .023);
  cap.scale.set(1.07,.96,1.04);
  const hair = mesh(head, headGeometry, hairColors[0], 0, .045, .023);
  const lens = mesh(head, eyewearGeometry, goggles, 0, .021, -.098);
  const tails = [-1,1].map(side => mesh(head, hairTailGeometry, hairColors[0], side * .07, -.058, .071));
  const eyes = [-1,1].map(side => {
    const eye = mesh(head, headGeometry, goggles, side*.034, .018, -.097);
    eye.scale.set(.08,.09,.05);
    return eye;
  });
  headParts.set(parent, {face, cap, hair, lens, tails, eyes});
}

function applyHead(parent, profile) {
  const {face, cap, hair, lens, tails, eyes} = headParts.get(parent);
  const {headwear} = profile;
  const hasHelmet = ['helmet', 'ponytail', 'braids'].includes(headwear);
  face.material = skinColors[profile.skin];
  cap.visible = hasHelmet;
  cap.material = helmetColors[profile.helmet ?? 0];
  hair.visible = !hasHelmet;
  hair.material = hairColors[profile.hair ?? 0];
  hair.scale.set(1.03, headwear === 'bob' ? 1.03 : .70, .98);
  hair.position.y = headwear === 'bob' ? .020 : .060;
  lens.visible = profile.lens !== null;
  lens.material = lensColors[profile.lens ?? 0];
  eyes.forEach(eye => { eye.visible = !lens.visible; });
  tails.forEach((tail, i) => {
    tail.visible = headwear === 'braids' || (i === 0 && headwear === 'ponytail');
    tail.material = hair.material;
    tail.position.x = headwear === 'ponytail' ? 0 : (i ? .071 : -.071);
    tail.rotation.x = headwear === 'ponytail' ? -.37 : .16;
  });
}

function appearance(index, snowboard) {
  return { profile: profiles[index % profiles.length], jacket: jackets[index % jackets.length], snowboard };
}

function skier(colorIndex, snowboard, style = appearance(colorIndex, snowboard)) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  bodies.set(root, body);
  root.userData.snowboard = snowboard;
  if (snowboard) body.rotation.y = -Math.PI / 2;
  const {jacket, profile} = style;
  root.add(body);
  root.scale.set(profile.height * profile.width, profile.height, profile.height);
  appearances.set(root, style);
  const torso = mesh(body,torsoGeometry,jacket,0,0.99,0);
  torso.scale.z = 0.76;
  buildHead(body, 1.29, -.036);
  applyHead(body, profile);
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
  const snow = (snowY - rider.position.y) / rider.scale.y;
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

function seatedSkier(colorIndex, style = appearance(colorIndex, false)) {
  const rider = new THREE.Group();
  const legs = [];
  const {jacket} = style;
  mesh(rider,torsoGeometry,jacket,0,0.38,0.031).scale.set(.78,.9,.78);
  mesh(rider,new THREE.CylinderGeometry(.061,.069,.113,10),jacket,0,.642,-.008);
  buildHead(rider, .733, -.021, .92);
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
  applySeatedAppearance(rider, style);
  poseSitting(rider, 1);
  return rider;
}

function applySeatedAppearance(rider, style) {
  const {profile, jacket, snowboard} = style;
  rider.scale.set(profile.height * profile.width, profile.height, profile.height);
  applyHead(rider, profile);
  for (const part of rider.children) {
    if (jackets.includes(part.material)) part.material = jacket;
    if (part.name === 'passenger-ski') part.visible = !snowboard;
    if (part.name === 'passenger-board') part.visible = snowboard;
  }
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
      const model = skier(i + index * 5, i % 2 === 1);
      model.name = 'ski-runner';
      scene.add(model);
      return {model,route,speed,width,offset:(i+0.41) / count + index*0.071,phase:i*2.17};
    });
  });

  const { seatXs, quad, chairDrop } = station;
  const queue = seatXs.map((_, lane) => Array.from({ length: 3 }, (_, row) => {
    const model = skier(lane * 2 + row * 3 + (quad ? 0 : 1), (lane + row) % 2 === 1);
    model.name = 'lift-queue-skier';
    model.userData.lane = lane;
    const materials = new Map();
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

  const distantTorso = new THREE.BoxGeometry(.31,.43,.24);
  const distantHead = new THREE.SphereGeometry(.105, 6, 4);
  const distantPassengers = station.simplifiedChairs.map(chair => seatXs.map(x => {
    const passenger = new THREE.Group();
    passenger.position.set(x, -chairDrop + .12, 0);
    mesh(passenger, distantTorso, jackets[0], 0, .34, 0);
    mesh(passenger, distantHead, goggles, 0, .65, 0);
    chair.add(passenger);
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
  const queueStyles = new Map(queue.flat().map(person => [person.id, appearances.get(person)]));

  function advanceBoarding(distances, riderChair, travel) {
    const { start, boardingContact, loopLength } = station;
    distances.forEach((distance, index) => {
      const lap = Math.floor((distance + start - boardingContact) / loopLength);
      if (lastLap[index] !== undefined && lap > lastLap[index]) {
        boardingChair = index;
        queue.forEach((lane, seat) => {
          if (index === riderChair && seat === reservedSeat) return;
          seatStyles[index][seat] = lane[0].id;
          lane.push(lane.shift());
          laneSteps[seat] = travel;
        });
      }
      lastLap[index] = lap;
    });
  }

  function updateBoarding(distances, riderChair, playerRow, queueState, travel, detailedChairs) {
    const { start, boardingContact, unloading, loopLength, loadingStop, climbStart, x, waitingDepth, waitingOffset } = station;
    const platformYAlong = along => along <= loadingStop + 1.1 ? station.platformY : -Infinity;
    seated.forEach((seats, index) => {
      const along = start + THREE.MathUtils.euclideanModulo(distances[index], loopLength);
      seats.forEach((passenger, seat) => {
        const occupied = along >= boardingContact && along <= unloading + 3 && !(index === riderChair && seat === reservedSeat);
        const styleId = seatStyles[index][seat];
        const style = queueStyles.get(styleId);
        const distant = distantPassengers[index][seat];
        distant.visible = occupied && !detailedChairs[index];
        if (style && distant.visible) {
          const {profile, jacket} = style;
          distant.scale.set(profile.height * profile.width, profile.height, profile.height);
          distant.children[0].material = jacket;
          distant.children[1].material = helmetColors[profile.helmet] ?? hairColors[profile.hair ?? 0];
        }
        if (style && passenger.userData.styleId !== styleId) {
          passenger.userData.styleId = styleId;
          applySeatedAppearance(passenger, style);
        }
        passenger.visible = occupied && detailedChairs[index];
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
  const style = appearance(5, false);
  const standing = skier(5, false, style);
  const seated = seatedSkier(5, style);
  standing.name = 'player-standing';
  seated.name = 'player-seated';
  scene.add(standing, seated);
  standing.visible = false;
  seated.visible = false;
  return { standing, seated };
}