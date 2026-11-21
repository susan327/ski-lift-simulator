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

function skier(colorIndex, snowboard) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
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

function seatedSkier(colorIndex) {
  const rider = new THREE.Group();
  const jacket = jackets[colorIndex % jackets.length];
  mesh(rider,torsoGeometry,jacket,0,0.38,0.031).scale.set(.78,.9,.78);
  mesh(rider,headGeometry,helmet,0,0.754,-0.022).scale.setScalar(0.92);
  mesh(rider,new THREE.BoxGeometry(0.142,0.043,0.037),goggles,0,0.738,-0.109);
  for(const side of [-1,1]){
    const x=side*0.082;
    mesh(rider,limbGeometry,pants,x,0.07,-0.173).rotation.x=Math.PI/2;
    mesh(rider,limbGeometry,pants,x,-0.102,-0.307).rotation.x=-0.17;
    mesh(rider,limbGeometry,jacket,side*0.17,0.32,-0.11).scale.set(.8,.74,.82);
    mesh(rider,skiGeometry,snowEquipment,x,-0.31,-0.45).name = 'passenger-ski';
  }
  const board = mesh(rider,boardGeometry,boardFinish,-0.065,-0.306,-0.42);
  board.name = 'passenger-board';
  board.rotation.y = Math.PI * 0.16;
  board.visible = false;
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
    model.userData.queueRow = row;
    scene.add(model);
    return model;
  }));
  const seated = chairs.map((chair, index) => seatXs.map((x, lane) => {
    const passenger = seatedSkier(index + lane);
    passenger.name = 'lift-passenger';
    passenger.userData.seat = lane;
    passenger.position.set(x, -chairDrop + .12, 0);
    chair.add(passenger);
    return passenger;
  }));
  let previousLead = -1;
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
      const body=model.getObjectByName('body');
      const snowboard = model.userData.snowboard;
      body.rotation.z = snowboard ? 0 : -lean*.25;
      body.rotation.x = snowboard ? lean*.18 - .10 : 0;
      model.rotation.z = snowboard ? -lean*.23 : 0;
      body.position.y=-.045+.032*Math.abs(lean);
    }
  }

  function updateBoarding(distances, riderChair) {
    let first = -Infinity;
    let leadChair = -1;
    const { start, boarding, unloading, boardingStart, loopLength, x, waitingOffset } = station;
    const reservedSeat = quad ? 1 : 0;
    for (const [index, distance] of distances.entries()) {
      const along = start + THREE.MathUtils.euclideanModulo(distance, loopLength);
      const onUphill = along <= unloading + 3;
      if (onUphill && along <= boarding && along > first) {
        first = along;
        leadChair = index;
      }
      seated[index].forEach((passenger, lane) => {
        passenger.visible = onUphill && along >= boarding && !(index === riderChair && lane === reservedSeat);
      });
    }

    if (previousLead !== -1 && previousLead !== leadChair && seated[previousLead].some(person => person.visible)) {
      queue.forEach((lane, index) => {
        if (previousLead !== riderChair || index !== reservedSeat) lane.push(lane.shift());
      });
    }
    previousLead = leadChair;
    const permission = leadChair !== -1 && first >= boardingStart;
    const join = permission ? THREE.MathUtils.smoothstep(first, boardingStart, boarding) : 0;
    queue.forEach((lane, laneIndex) => {
      if (permission) {
        const passenger = seated[leadChair][laneIndex];
        const jacket = lane[0].getObjectByName('body').children[0].material;
        const snowboard = lane[0].userData.snowboard;
        for (const part of passenger.children) {
          if (jackets.includes(part.material)) part.material = jacket;
          if (part.name === 'passenger-ski') part.visible = !snowboard;
          if (part.name === 'passenger-board') part.visible = snowboard;
        }
      }
      lane.forEach((person, row) => {
        const boardingPerson = row === 0 && (leadChair !== riderChair || laneIndex !== reservedSeat);
        const advance = boardingPerson ? join : 0;
        const along = boarding + .14 - row * 1.22;
        const px = x + seatXs[laneIndex] + waitingOffset * (1 - advance);
        const floor = Math.max(station.platformY, terrainHeight(px, along));
        person.visible = advance < .995 && !(permission && row === 0 && !boardingPerson);
        person.position.set(px, floor + .035 + .49 * advance, -along);
        person.rotation.y = -.24 * Math.sin(advance * Math.PI);
        person.getObjectByName('body').rotation.x = .28 * advance;
      });
    });
    return permission;
  }

  return { updateSkiers, updateBoarding };
}
