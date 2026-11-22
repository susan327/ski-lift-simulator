import { addVillageScenery } from './village-scenery.js';
import * as THREE from '../node_modules/three/build/three.module.js';
import { courses, places, terrainHeight, nearCourse, nearLift, quadLine, slopeAlong, slopeWidthScale, stretchAlong } from './resort.js';
import { createBatches, addTerrainTiles } from './render-optimization.js';

const snowColor = new THREE.Color(0xecf6fc);

export function addResortTerrain(scene) {
  const terrainColumns = 320;
  const terrainRows = 784;
  const terrain = new THREE.PlaneGeometry(480, 1470, terrainColumns, terrainRows);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(35, 0, -340);
  const vertices = terrain.attributes.position;
  const colors = [];
  const tint = new THREE.Color();
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i);
    const along = -vertices.getZ(i);
    const y = terrainHeight(x, along);
    vertices.setY(i, y);
    const shade = (terrainHeight(x - 1.6, along + 1.1) - y) / 1.6;
    const snowVariation = Math.sin(x*0.58+along*0.29)*Math.sin(along*0.33+x*0.14)*0.018;
    tint.set(0xc9e0ee).lerp(snowColor, THREE.MathUtils.clamp(0.58 + shade * 2.5, 0, 1));
    tint.multiplyScalar(0.98 + snowVariation);
    colors.push(tint.r, tint.g, tint.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  return addTerrainTiles(scene, terrain, new THREE.MeshStandardMaterial({ vertexColors: true }), terrainColumns, terrainRows);
}

export function addResortScenery(scene, { mesh, box, material, steel }) {
  const snow = material(0xecf6fc);
  const pine = material(0x254943);
  const bark = material(0x51463d);
  const trailMarkers = new Map(courses.map(course => [course.level, material(course.color)]));

  const trails = courses.flatMap(course => course.midwaySamples
    ? [course, { ...course, samples: course.midwaySamples }] : [course]);
  for (const course of trails) {
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
  const signAlong = places.pairTop.along + 21;
  const signX = places.pairTop.x + 9.5;
  trailSign.position.set(signX, terrainHeight(signX, signAlong), -signAlong);
  trailSign.rotation.y = -Math.PI / 2;
  scene.add(trailSign);
  for (const x of [-0.53, 0.53]) {
    box(0.09, 1.60, 0.09, steel, x, 0.8, 0, trailSign);
  }
  mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: signTexture }),
    0, 1.53, 0.052, trailSign);

  const canopy = new THREE.ConeGeometry(1.28, 2.4, 7);
  const trunk = new THREE.CylinderGeometry(0.10, 0.15, 1.1, 6);

  const treeBatches = createBatches(scene);
  const treePose = new THREE.Object3D();
  const treePart = new THREE.Object3D();
  function plantTree(x, along, scale) {
    if (nearLift(x, along)) return;
    treePose.position.set(x, terrainHeight(x, along), -along);
    treePose.scale.setScalar(scale);
    treePose.rotation.y = along * .5 + x;
    treePose.updateMatrix();
    treePart.position.y = .48;
    treePart.scale.setScalar(1);
    treePart.updateMatrix();
    treeBatches.add(trunk, bark, treePose.matrix, treePart.matrix);
    for (let layer = 0; layer < 3; layer++) {
      const size = 1 - layer * .19;
      const y = 1.55 + layer * .8;
      treePart.position.y = y;
      treePart.scale.setScalar(size);
      treePart.updateMatrix();
      treeBatches.add(canopy, pine, treePose.matrix, treePart.matrix);
      treePart.position.y = y + .22;
      treePart.scale.set(size * .86, size * .92, size * .86);
      treePart.updateMatrix();
      treeBatches.add(canopy, snow, treePose.matrix, treePart.matrix);
    }
  }

  for (let row = 0; row < 11; row++) {
    for (const side of [-1, 1]) {
      for (let col = 0; col < 3; col++) {
        const along = stretchAlong(slopeAlong(8 + row * 3.8 + Math.sin(row + col) * 1.4));
        const x = side * (3.4 + col * 3.15 + Math.cos(row * 2 + col) * 0.55 + (side < 0 ? 4 : 0));
        const scale = 0.92 + ((row + col * 2) % 5) * 0.14;
        if (!nearCourse(x, along, 1.8)) plantTree(x, along, scale);
      }
    }
  }
  plantTree(-8, stretchAlong(slopeAlong(53)), 0.85);
  plantTree(5.6, stretchAlong(slopeAlong(54)), 0.75);

  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 10; col++) {
      const along = stretchAlong(slopeAlong(7 + row * 7.5 + Math.sin(col * 1.7 + row) * 2));
      const x = (14 + col * 5.8 + Math.cos(row * 1.7 + col) * 2) * slopeWidthScale;
      const scale = 0.82 + ((col * 7 + row * 3) % 6) * 0.12;
      const quadX = THREE.MathUtils.lerp(places.quadBase.x, places.quadTop.x,
        THREE.MathUtils.smoothstep(along, quadLine.climbStart, quadLine.climbEnd));
      const clearOfLift = x < quadX - 8.7 || x > quadX + 3.1;
      if (along < stretchAlong(slopeAlong(86)) && clearOfLift && !nearCourse(x, along, 2.05)) plantTree(x, along, scale);
    }
  }

  // Small stands frame the lower quad ascent with open views back to the plaza.
  for (const center of [-260, -208, -135, -58]) {
    for (let i = 0; i < 12; i++) {
      const along = stretchAlong(center + i * 1.65);
      const x = places.quadBase.x + (i % 2 ? 10 : -15) + Math.sin(i * 1.4) * 2;
      if (!nearCourse(x, along, 2)) plantTree(x, along, 1.1 + (i % 4) * .17);
    }
  }
  // The broken treeline beyond the village forms the nearer eastern ridge.
  for (let i = 0; i < 140; i++) {
    const along = stretchAlong(68 + i * 1.7);
    const x = 202 + 7 * Math.sin(i * .075) + 2 * Math.cos(i);
    plantTree(x, along, 1.3 + (i % 5) * .16);
  }
  // Preserve openings along the winding western trail and its mid-mountain connector.
  for (let row = 0; row < 28; row++) {
    for (let col = 0; col < 12; col++) {
      const along = stretchAlong(-245 + row * 22 + 6 * Math.sin(col + row));
      const x = -175 + col * 15 + 4 * Math.cos(row * 1.5 + col);
      if (!nearCourse(x, along, 2.8)) plantTree(x, along, .92 + (row + col) % 5 * .14);
    }
  }
  treeBatches.build();

  addVillageScenery(scene, material);

  const distantSnow = new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  const ridgeShape = new THREE.PlaneGeometry(116, 64, 56, 30);
  ridgeShape.rotateX(-Math.PI / 2);
  const peakTint = new THREE.Color();
  for (const [x, along, height, rotation, seed] of [
    [-85, -64, 60, -.54, 12], [12, -113, 78, .16, 7], [80, -103, 61, -.22, 3],
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
    const range = mesh(geometry,distantSnow,x * 2.55,-1,-stretchAlong(slopeAlong(along)));
    range.scale.set(2.6,2.0,2.5);
    range.rotation.y=rotation;
  }
}
