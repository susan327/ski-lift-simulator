import * as THREE from './node_modules/three/build/three.module.js';
import { terrainHeight, terminalNetFront, quadExitLength, quadExitPose } from './resort.js';
import { createBatches } from './render-optimization.js';
import { addSheaveTrain, addBullwheelDetails, gripCamContact } from './lift-model.js';

export function createStationView(scene, operations, { mesh, box, material, steel, orange, dark }) {
  const { quad, lower, upper, boarding, loadingStop, waitingAlong, signalAlong, unloading, start, end, climbStart, climbEnd, cableHeight,
    wheelRadius, lineLength, turnLength, loopLength, baseTurn, railDrop, summit, handoff, towerPositions, announcementPoints } = operations.config;
  const { lineX, trackGround, liftPose, speedAt, handoffDistance, railSupport, railFall, gripOpen } = operations;

  const seatXs = quad ? [-.96, -.32, .32, .96] : [-.375, .375];
  const waitingDepth = loadingStop - waitingAlong;
  const waitingOffset = quad ? 2.85 : 1.95;
  const platformY = trackGround(boarding) + .045;
  const packedSnow = new THREE.MeshPhysicalMaterial({
    color: 0xd5e4eb, roughness: .43, metalness: .06,
    clearcoat: .22, clearcoatRoughness: .55,
  });
  const stationWidth = quad ? 3.28 : 2.16;
  const entrance = waitingAlong - 4.2;
  const platformEnd = boarding + 1.75;
  box(stationWidth + waitingOffset, .16, platformEnd - entrance, packedSnow, lower.x + waitingOffset / 2,
    platformY - .08, -(platformEnd + entrance) / 2);
  if (!quad) {
    box(4, .16, 3, packedSnow, upper.x + 1.65, summit - .035, -unloading);
    box(.18, 1.4, .18, steel, upper.x - 1.25, summit + .7, -unloading - 1);
    box(.72, .42, .16, orange, upper.x - 1.25, summit + 1.4, -unloading - 1);
  }

  const exitPaint = material(0xf4aa3c);
  const arrowPaint = material(0x247f91);
  const exitFloor = quad ? terrainHeight(upper.x, unloading) : summit + .045;
  box(quad ? 3.0 : 1.72, .018, .16, exitPaint, upper.x, exitFloor + .019, -unloading - .19).name = 'unload-line';

  if (quad) {
    const vertices = [];
    const indices = [];
    for (let step = 0; step <= 16; step++) {
      const point = quadExitPose(step * .25);
      for (const side of [-1, 1]) {
        const x = point.x + side * 1.6 * Math.cos(point.yaw);
        const along = point.along + side * 1.6 * Math.sin(point.yaw);
        vertices.push(x, terrainHeight(x, along) + .011, -along);
      }
      const i = step * 2;
      if (step > 0) indices.push(i - 2, i - 1, i, i - 1, i + 1, i);
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    mesh(surface, packedSnow, 0, 0, 0);
  }

  function markerArrow(x, along, dx, da) {
    const shape = new THREE.Shape();
    shape.moveTo(-.14, -.48);
    shape.lineTo(.14, -.48);
    shape.lineTo(.14, .08);
    shape.lineTo(.32, .08);
    shape.lineTo(0, .48);
    shape.lineTo(-.32, .08);
    shape.lineTo(-.14, .08);
    const arrow = new THREE.ShapeGeometry(shape);
    arrow.rotateX(-Math.PI/2);
    arrow.rotateY(Math.atan2(-dx, da));
    arrow.translate(x, 0, -along);
    const points = arrow.attributes.position;
    for (let i=0;i<points.count;i++) {
      const px=points.getX(i), pa=-points.getZ(i);
      points.setY(i, Math.max(terrainHeight(px,pa), !quad && Math.abs(pa-unloading)<1.5 ? exitFloor : -Infinity) + .034);
    }
    arrow.computeVertexNormals();
    mesh(arrow, arrowPaint, 0, 0, 0).name = 'unload-arrow';
  }

  if (quad) {
    for (const distance of [1.5, 4, 7, 10, 13]) {
      const point=quadExitPose(distance);
      markerArrow(point.x, point.along, -Math.sin(point.yaw), Math.cos(point.yaw));
    }
  } else {
    for (const [x,a,dx,da] of [[.65,1,1,.9],[2.25,2.5,1,.3],[4.4,3.2,1,0],[6.5,3.3,1,0],[9.0,4.0,1,.25]]) {
      markerArrow(upper.x+x, unloading+a, dx, da);
    }
  }

  const netCord = new THREE.LineBasicMaterial({ color: 0xf47730 });
  const queueCord = new THREE.LineBasicMaterial({ color: 0xe3e8ec });
  const netPost = material(0xbd5022);
  const netHeight = .94;

  function guideNet(path, floorAt, queueRope = false) {
    const cords = [];
    for (let i = 1; i < path.length; i++) {
      const [x0, along0] = path[i - 1];
      const [x1, along1] = path[i];
      const columns = Math.ceil(Math.hypot(x1 - x0, along1 - along0) / .20);
      const sample = (column, height) => {
        const t = column / columns;
        const x = THREE.MathUtils.lerp(x0, x1, t);
        const along = THREE.MathUtils.lerp(along0, along1, t);
        return [x, floorAt(x, along) + height, -along];
      };
      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < (queueRope ? 2 : 6); row++) {
          const height = queueRope ? .57 + row * .29 : .09 + row * .16;
          cords.push(...sample(column, height), ...sample(column + 1, height));
        }
        if (!queueRope) cords.push(...sample(column, .09), ...sample(column, .89));
      }
    }
    for (const [x, along] of path) {
      box(.078, netHeight + .12, .078, netPost, x, floorAt(x, along) + netHeight * .5, -along);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(cords, 3));
    scene.add(new THREE.LineSegments(geometry, queueRope ? queueCord : netCord));
  }

  const queueHalfWidth = quad ? 1.43 : .92;
  const queueX = lower.x + waitingOffset;
  const queueFloor = (x, along) => Math.max(platformY, terrainHeight(x, along));
  for (const side of [-1, 1]) {
    const x = queueX + side * queueHalfWidth;
    guideNet((side < 0 ? [-.4, -2.0, -3.6] : [2, .3, -1.7, -3.6])
      .map(offset => [x, waitingAlong + offset]), queueFloor, true);
  }

  function netSpan(x0, along0, x1, along1) {
    const sections = Math.ceil(Math.hypot(x1 - x0, along1 - along0) / 2.1);
    const path = Array.from({ length: sections + 1 }, (_, i) => [
      THREE.MathUtils.lerp(x0, x1, i / sections),
      THREE.MathUtils.lerp(along0, along1, i / sections),
    ]);
    guideNet(path, terrainHeight);
  }

  function terminalPerimeter(front, sideEnd, left, right) {
    netSpan(left, front, left, sideEnd);
    netSpan(right, front, right, sideEnd);
    netSpan(left, front, right, front);
  }

  terminalPerimeter(terminalNetFront(quad, false), boarding - waitingDepth - 3.9,
    lower.x - 2 * wheelRadius - 2.35, queueX + 2.25);
  terminalPerimeter(terminalNetFront(quad, true), unloading + 7,
    upper.x - 2 * wheelRadius - 2.35, upper.x + (quad ? 16 : 11.5));

  if (quad) {
    for (const side of [-1, 1]) {
      const path = [4.6, 6.7, 8.8, 10.9, 13].map(distance => {
        const point = quadExitPose(distance);
        return [point.x + side * 2.2 * Math.cos(point.yaw),
          point.along + side * 2.2 * Math.sin(point.yaw)];
      });
      guideNet(path, terrainHeight);
    }
  } else {
    for (const side of [-1, 1]) {
      guideNet([[3.1, 1.7], [5.2, 2.5], [7.5, 3.4], [10, 4.4]]
        .map(([x, along]) => [upper.x + x, unloading + along + side * 1.55]), terrainHeight);
    }
  }

  const hutWall = material(0xb99576);
  const hutGlass = material(0x55869b);
  const hutRoof = material(0xeaf4fa);
  function staffHut(x, along, windowSide) {
    const z = -along;
    const floor = terrainHeight(x, along);
    box(2.55, .20, 2.05, steel, x, floor + .07, z);
    box(2.38, 2.05, 1.86, hutWall, x, floor + 1.15, z);
    box(2.70, .18, 2.20, dark, x, floor + 2.24, z).rotation.z = -.09 * windowSide;
    box(2.73, .10, 2.23, hutRoof, x, floor + 2.36, z).rotation.z = -.09 * windowSide;
    box(.07, .79, 1.33, dark, x + 1.18 * windowSide, floor + 1.49, z);
    box(.075, .67, 1.21, hutGlass, x + 1.21 * windowSide, floor + 1.49, z);
    box(.72, 1.76, .06, steel, x + .57, floor + 1.01, z + .94);
    box(.45, .46, .067, hutGlass, x + .57, floor + 1.49, z + .97);
  }

  staffHut(queueX + 4.5, boarding - 1.2, -1);
  staffHut(upper.x - (quad ? 9.7 : 8.3), unloading + .4, 1);

  const exitSign = document.createElement('canvas');
  exitSign.width=480;
  exitSign.height=160;
  const ink=exitSign.getContext('2d');
  ink.fillStyle='#183a43';
  ink.fillRect(0,0,480,160);
  ink.fillStyle='#f8cc74';
  ink.fillRect(0,0,10,160);
  ink.textAlign='center';
  ink.fillStyle='#ffffff';
  ink.font='bold 46px sans-serif';
  ink.fillText('降り口  ↗',240,70);
  ink.font='bold 27px sans-serif';
  ink.fillText(quad ? '青い矢印に沿って緩斜面へ' : 'こもれび林間へ',240,123);
  const exitTexture=new THREE.CanvasTexture(exitSign);
  exitTexture.colorSpace=THREE.SRGBColorSpace;
  const signX=upper.x+(quad?2.8:2.0);
  const signA=unloading+(quad?2.4:1.4);
  const signFloor=terrainHeight(signX,signA);
  for (const side of [-.65,.65]) box(.065,1.9,.065,steel,signX+side,signFloor+.95,-signA-.04);
  const sign=mesh(new THREE.PlaneGeometry(1.92,.64),new THREE.MeshBasicMaterial({map:exitTexture,side:THREE.DoubleSide}),
    signX,signFloor+1.53,-signA);
  sign.name='unload-sign';

  const laneColors = [material(0x24b978), material(0xf49b33)];
  const whitePaint = material(0xf1f7f9);
  const signalBody = material(0x192c31);
  const lampRed = new THREE.MeshStandardMaterial({ color: 0xd52129, emissive: 0xff1521 });
  const lampGreen = new THREE.MeshStandardMaterial({ color: 0x0beb7a, emissive: 0x00ff66 });
  const signalX = queueX - waitingOffset * (signalAlong - waitingAlong) / waitingDepth;
  const signalZ = -signalAlong;
  for (const [index, seatX] of seatXs.entries()) {
    const paint = laneColors[index % laneColors.length];
    const width = quad ? .60 : .71;
    box(width, .018, .25, paint, lower.x + seatX, platformY + .011, -boarding - .57).name = 'boarding-stop-color';
    box(width, .018, .22, paint, lower.x + seatX + waitingOffset, platformY + .011, -waitingAlong - .34).name = 'boarding-wait-color';
    for (let mark = 1; mark <= 3; mark++) {
      box(.055, .015, .42, paint, lower.x + seatX + waitingOffset,
        platformY + .01, -waitingAlong + mark * .79);
    }
  }
  const stripeHalf = (quad ? 1.29 : .76);
  box(stripeHalf * 2, .016, .067, whitePaint, lower.x, platformY + .01, -boarding - .78);
  box(stripeHalf * 2, .016, .067, whitePaint, lower.x + waitingOffset, platformY + .01, -waitingAlong - .49);
  for (const seatX of seatXs) {
    const arrow = new THREE.Group();
    arrow.position.set(lower.x + seatX + waitingOffset / 2, platformY + .01, -(waitingAlong + loadingStop) / 2);
    arrow.rotation.y = Math.atan2(waitingOffset, waitingDepth);
    scene.add(arrow);
    box(.048, .015, .49, whitePaint, 0, 0, 0, arrow);
    for (const sign of [-1, 1]) {
      box(.048, .015, .19, whitePaint, sign * .06, 0, -.22, arrow).rotation.y = sign * .64;
    }
  }
  const poleX = queueX + (quad ? 1.62 : 1.12);
  box(.13, 2.95, .13, steel, poleX, platformY + 1.475, signalZ);
  box(Math.abs(signalX - poleX) + .32, .09, .09, steel, (signalX + poleX) / 2, platformY + 2.86, signalZ);
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

  const cableBatches = createBatches(cable);
  const spanGeometries = new Map();
  const spanDirection = new THREE.Vector3();
  const spanPose = new THREE.Object3D();
  const worldUp = new THREE.Vector3(0, 1, 0);

  function addCableSpan(from, to, surface = dark, radius = 0.045) {
    let geometry = spanGeometries.get(radius);
    if (!geometry) {
      geometry = new THREE.CylinderGeometry(radius, radius, 1, 8);
      spanGeometries.set(radius, geometry);
    }
    spanDirection.subVectors(to, from);
    spanPose.position.copy(from).lerp(to, .5);
    spanPose.scale.y = spanDirection.length() + .02;
    spanPose.quaternion.setFromUnitVectors(worldUp, spanDirection.normalize());
    spanPose.updateMatrix();
    cableBatches.add(geometry, surface, spanPose.matrix);
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
    const markerGeometry = new THREE.BoxGeometry(.016, .048, .031);
    const tirePart = new THREE.Object3D();
    tirePart.rotation.z = Math.PI / 2;
    tirePart.updateMatrix();
    const tireMatrix = tirePart.matrix.clone();
    tirePart.position.x = .102;
    tirePart.updateMatrix();
    const hubMatrix = tirePart.matrix.clone();
    const markerMatrix = new THREE.Matrix4().makeTranslation(.129, .071, 0);
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
      housing.updateMatrix();
      const rate = speedAt(d) / tireRadius;
      cableBatches.add(tireGeometry, tread, housing.matrix, tireMatrix, rate);
      cableBatches.add(hubGeometry, hub, housing.matrix, hubMatrix, rate);
      cableBatches.add(markerGeometry, stripe, housing.matrix, markerMatrix, rate);
      if (i % 6 === 0) {
        cable.add(housing);
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

  const speakers = {};
  function announcementSpeaker(name, x, y, along) {
    const trackHeading = Math.atan2(lineX(along + .1) - lineX(along - .1), .2);
    const yaw = Math.PI - trackHeading;
    const speaker = new THREE.Group();
    speaker.position.set(x, y, -along);
    speaker.rotation.y = yaw;
    scene.add(speaker);
    box(.13, .19, .20, steel, 0, 0, .06, speaker);
    const horn = new THREE.CylinderGeometry(.13, .055, .21, 12);
    horn.rotateX(-Math.PI / 2);
    mesh(horn, steel, 0, 0, -.09, speaker);
    const mouth = new THREE.CircleGeometry(.104, 12);
    mouth.rotateY(Math.PI);
    mesh(mouth, dark, 0, 0, -.196, speaker);
    const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    speakers[name] = { position: speaker.position.clone().addScaledVector(direction, .196), direction };
  }

  announcementSpeaker('boarding', signalX, platformY + 2.28, signalAlong);
  if (quad) {
    const approachX = lineX(announcementPoints.approaching) - wheelRadius;
    announcementSpeaker('approaching', approachX + .23, trackGround(announcementPoints.approaching) + 3.25,
      announcementPoints.approaching);
    const exitX = lineX(announcementPoints.unloading) + 2.05;
    const exitY = trackGround(announcementPoints.unloading);
    box(.10, 2.75, .10, steel, exitX, exitY + 1.375, -announcementPoints.unloading);
    announcementSpeaker('unloading', exitX - .12, exitY + 2.55, announcementPoints.unloading);
  }

  for (const along of towerPositions) {
    const y = trackGround(along);
    const x = lineX(along) - wheelRadius;
    const ground = terrainHeight(x, along);
    const height = y - ground + cableHeight + 0.42;
    box(0.34, height, 0.34, steel, x, ground + height / 2, -along);
    box(wheelRadius * 2 + 0.44, 0.19, 0.34, steel, x, y + cableHeight + 0.59, -along);
    for (const side of [-1, 1]) addSheaveTrain(scene, x + side * wheelRadius, y + cableHeight, -along);
  }

  cableBatches.build();

  function renderAt(travel, ropeTravel) {
    for (const wheel of wheels) wheel.rotation.y = ropeTravel / wheelRadius;
    cableBatches.update(travel);
  }

  return { speakers, seatXs, waitingDepth, waitingOffset, platformY, updateBoardingSignal, renderAt };
}
