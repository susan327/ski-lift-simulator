import * as THREE from './node_modules/three/build/three.module.js';

// Batch locally so the renderer can still cull groups outside the camera.
export function createBatches(parent, cellSize = 48) {
  const batches = new Map();
  const rolling = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Matrix4();
  const identity = new THREE.Matrix4();

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

  function update(time) {
    for (const {mesh,instances} of rolling) {
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
    }
  }
  source.dispose();
}
