import * as THREE from './node_modules/three/build/three.module.js';

// Batch locally so the renderer can still cull groups outside the camera.
export function createBatches(parent, cellSize = 48) {
  const batches = new Map();
  const rolling = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  const identity = new THREE.Matrix4();
  const rollingFrustum = new THREE.Frustum();
  const rollingProjection = new THREE.Matrix4();

  function add(geometry, material, base, local = identity, rate = 0) {
    const x = base.elements[12];
    const z = base.elements[14];
    const key = [geometry.id, material.id, Math.floor(x / cellSize), Math.floor(z / cellSize), rate !== 0].join(':');
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, instances: [], animated: rate !== 0 };
      batches.set(key, batch);
    }
    batch.instances.push({base:base.clone(), local:local.clone(), rate});
  }

  function build() {
    for (const {geometry,material,instances,animated} of batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry,material,instances.length);
      if (animated) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instances.forEach(({base,local},i)=>mesh.setMatrixAt(i,matrix.multiplyMatrices(base,local)));
      mesh.computeBoundingSphere();
      if (animated) {
        // The painted rotation marker moves around the hub.
        mesh.boundingSphere.radius += .18;
        rolling.push({mesh,instances});
      }
      parent.add(mesh);
    }
    batches.clear();
  }

  function update(time, camera) {
    if (!rolling.length) return;
    parent.updateWorldMatrix(true, false);
    rollingProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    rollingFrustum.setFromProjectionMatrix(rollingProjection, camera.coordinateSystem);
    for (const batch of rolling) {
      const {mesh, instances} = batch;
      if (batch.time === time) continue;
      mesh.updateWorldMatrix(false, false);
      if (!rollingFrustum.intersectsObject(mesh)) continue;
      batch.time = time;
      instances.forEach(({base,local,rate},i)=>{
        rotation.makeRotationX(time*rate);
        mesh.setMatrixAt(i,matrix.multiplyMatrices(base,rotation).multiply(local));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {add,build,update};
}

export function addTerrainTiles(scene, source, material, columns, rows, tileSize = 42) {
  const stride = columns+1;
  const tiles = [];
  for(let top=0;top<rows;top+=tileSize){
    const height=Math.min(tileSize,rows-top);
    for(let left=0;left<columns;left+=tileSize){
      const width=Math.min(tileSize,columns-left);
      const geometry=new THREE.BufferGeometry();
      for(const [name,attribute] of Object.entries(source.attributes)){
        const size=attribute.itemSize;
        const rowLength=(width+1)*size;
        const array=new attribute.array.constructor(rowLength*(height+1));
        for(let row=0;row<=height;row++){
          const first=((top+row)*stride+left)*size;
          array.set(attribute.array.subarray(first,first+rowLength),row*rowLength);
        }
        geometry.setAttribute(name,new THREE.BufferAttribute(array,size,attribute.normalized));
      }
      const index=new Uint16Array(width*height*6);
      let offset=0;
      for(let row=0;row<height;row++){
        for(let col=0;col<width;col++){
          const a=row*(width+1)+col;
          const b=a+width+1;
          index.set([a,b,a+1,b,b+1,a+1],offset);
          offset+=6;
        }
      }
      geometry.setIndex(new THREE.BufferAttribute(index,1));
      geometry.computeBoundingSphere();
      const tile=new THREE.Mesh(geometry,material);
      tile.name='terrain-tile';
      scene.add(tile);
      const coarse = [];
      const vertex = (x, z) => z * (width + 1) + x;
      // Keep every border vertex so adjoining tiles share the same edge at either detail level.
      for (let z = 0; z < height;) {
        const bottom = height - z <= 4 ? height : z + 3;
        for (let x = 0; x < width;) {
          const right = width - x <= 4 ? width : x + 3;
          const rim = [];
          for (let row = z; row < bottom; row += x === 0 ? 1 : bottom - z) rim.push(vertex(x,row));
          for (let col = x; col < right; col += bottom === height ? 1 : right - x) rim.push(vertex(col,bottom));
          for (let row = bottom; row > z; row -= right === width ? 1 : bottom - z) rim.push(vertex(right,row));
          for (let col = right; col > x; col -= z === 0 ? 1 : right - x) rim.push(vertex(col,z));
          const center = vertex(x + 1, z + 1);
          rim.forEach((point,i) => coarse.push(center,point,rim[(i+1)%rim.length]));
          x = right;
        }
        z = bottom;
      }
      tiles.push({tile, fine: geometry.index, coarse: new THREE.Uint16BufferAttribute(coarse, 1)});
    }
  }
  source.dispose();
  return cameraPosition => {
    for (const {tile, fine, coarse} of tiles) {
      const {geometry} = tile;
      const {center, radius} = geometry.boundingSphere;
      const threshold = (geometry.index === fine ? 140 : 115) + radius;
      const next = center.distanceToSquared(cameraPosition) > threshold ** 2 ? coarse : fine;
      if (geometry.index !== next) geometry.setIndex(next);
    }
  };
}

export function mergeFixedMeshes(parent, meshes, cellSize = Infinity) {
  const cells = new Map();
  for (const mesh of meshes) {
    const { geometry, material, position } = mesh;
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.name || !mesh.visible
      || Array.isArray(material) || material.transparent || material.map
      || !geometry.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv) continue;
    const key = [material.id, Math.floor(position.x / cellSize), Math.floor(position.z / cellSize)].join(':');
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(mesh);
  }
  for (const group of cells.values()) {
    if (group.length < 2) continue;
    const attributes = { position: [], normal: [], uv: [] };
    const indices = [];
    const point = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();
    let offset = 0;
    for (const mesh of group) {
      mesh.updateMatrix();
      normalMatrix.getNormalMatrix(mesh.matrix);
      const {position, normal, uv} = mesh.geometry.attributes;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
        attributes.position.push(point.x, point.y, point.z);
        point.fromBufferAttribute(normal, i).applyNormalMatrix(normalMatrix);
        attributes.normal.push(point.x, point.y, point.z);
        attributes.uv.push(uv.getX(i), uv.getY(i));
      }
      const index = mesh.geometry.index;
      for (let i = 0; i < (index?.count ?? position.count); i++) {
        indices.push(offset + (index ? index.getX(i) : i));
      }
      offset += position.count;
    }
    const geometry = new THREE.BufferGeometry();
    for (const [name, values] of Object.entries(attributes)) {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, name === 'uv' ? 2 : 3));
    }
    geometry.setIndex(indices);
    parent.remove(...group);
    parent.add(new THREE.Mesh(geometry, group[0].material));
    for (const mesh of group) mesh.geometry.dispose();
  }
}

export function createMovingInstances(scene, roots) {
  const batches = new Map();
  const candidates = [];
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
  const bounds = new THREE.Sphere();
  for (const root of roots) {
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingSphere();
      const geometryKey = JSON.stringify([mesh.geometry.type, mesh.geometry.parameters]);
      candidates.push({root, mesh, geometryKey});
      mesh.layers.disableAll();
    });
  }
  return camera => {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const batch of batches.values()) batch.count = 0;
    for (const root of roots) if (root.visible) root.updateMatrixWorld(true);
    for (const {root, mesh, geometryKey} of candidates) {
      if (!root.visible || !mesh.parent.visible) continue;
      bounds.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
      if (!frustum.intersectsSphere(bounds)) continue;
      const key = geometryKey + ':' + mesh.material.id;
      let batch = batches.get(key);
      if (!batch) {
        batch = new THREE.InstancedMesh(mesh.geometry, mesh.material, candidates.length);
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        batch.frustumCulled = false;
        batch.count = 0;
        batches.set(key, batch);
        scene.add(batch);
      }
      batch.setMatrixAt(batch.count++, mesh.matrixWorld);
    }
    for (const batch of batches.values()) {
      batch.visible = batch.count > 0;
      if (batch.visible) batch.instanceMatrix.needsUpdate = true;
    }
  };
}
