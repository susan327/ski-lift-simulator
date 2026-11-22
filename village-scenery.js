import * as THREE from './node_modules/three/build/three.module.js';
import { courses, places, terrainHeight, stretchAlong } from './resort.js';
import { createBatches } from './render-optimization.js';

export function addVillageScenery(scene, material) {
  const timber = material(0x77503b), trim = material(0x45372f), roof = material(0x993e37);
  const snow = material(0xf0f5f5), glass = material(0x497681), amber = material(0xe8b66d);
  const green = material(0x355951), stone = material(0x75818a);
  const cube = new THREE.BoxGeometry();
  const batches = createBatches(scene);
  const pose = new THREE.Object3D();
  const signs = new Map();

  function part(base, surface, x, y, z, w, h, d, tilt = 0) {
    pose.position.set(x,y,z);
    pose.scale.set(w,h,d);
    pose.rotation.z = tilt;
    pose.updateMatrix();
    batches.add(cube,surface,base,pose.matrix);
  }

  function sign(base, label, x, y, z, width) {
    if (!signs.has(label)) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#204840';
      ctx.fillRect(0,0,512,96);
      ctx.strokeStyle = '#d6c09a';
      ctx.strokeRect(5,5,502,86);
      ctx.fillStyle = '#fff7df';
      ctx.font = 'bold 55px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label,256,49,480);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      signs.set(label,new THREE.MeshBasicMaterial({map:texture}));
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width,width*96/512),signs.get(label));
    panel.position.set(x,y,z);
    panel.applyMatrix4(base);
    scene.add(panel);
  }

  function cabin(x, along, width, depth, height, angle, kind) {
    const base = new THREE.Matrix4().makeRotationY(angle);
    base.setPosition(x,terrainHeight(x,along),-along);
    const front = depth/2;
    part(base,stone,0,-.28,0,width+.3,1,depth+.3);
    part(base,timber,0,height/2,0,width,height,depth);
    const pitch = .37;
    for (const side of [-1,1]) {
      const offset = side*(width/4+.09);
      const y = height + width*.25*Math.tan(pitch);
      const span = (width/2+.52)/Math.cos(pitch);
      part(base,kind==='ticket'?green:roof,offset,y,0,span,.32,depth+1,-side*pitch);
      part(base,snow,offset,y+.15,-.12,span*.85,.15,depth+.5,-side*pitch);
      part(base,glass,side*width*.28,height*.51,front+.04,width*.27,height*.4,.12);
    }
    // Timber gables close the triangular opening beneath the roof.
    for (let tier=0;tier<6;tier++) {
      const rise=width*.5*Math.tan(pitch)/6;
      part(base,timber,0,height+(tier+.5)*rise,0,width*(1-tier/6),rise,depth);
    }
    if (kind==='house') return;
    part(base,trim,0,1.05,front+.09,1.05,2.1,.16);
    part(base,amber,0,1.35,front+.19,.65,.8,.05);
    part(base,timber,0,.17,front+1,width+.7,.32,2.2);
    if (kind==='ticket') {
      part(base,amber,0,1.0,front+.29,width*.87,.14,.65);
      sign(base,'リフト券売場',0,height-.25,front+.18,width*.93);
    } else {
      part(base,roof,-width*.28,2.35,front+.7,width*.42,.18,1.8);
      part(base,timber,-width*.28,1,front+.7,width*.36,.16,.95);
      sign(base,'売店',-width*.28,2.14,front+1.61,2.1);
      sign(base,'雪あかりロッジ',0,height-.08,front+.14,width*.62);
      part(base,stone,width*.29,height+1.15,-depth*.24,.65,2.2,.65);
    }
  }

  for (const lower of [places.pairBase,places.quadBase]) {
    const lodge = lower===places.pairBase ? places.base : {x:lower.x+13,along:lower.along-8};
    cabin(lodge.x,lodge.along,8.2,5.4,3.1,-Math.PI/2,'lodge');
    cabin(lower.x+9,lower.along+3,4.2,2.9,2.5,-Math.PI*.62,'ticket');
  }
  // A staggered hamlet on the eastern flank is visible from both summit stations.
  for (let i=0;i<18;i++) {
    const row=Math.floor(i/6), col=i%6;
    cabin(141+col*10+3*Math.sin(i),stretchAlong(140+row*16+col*2),4.4+(i%3),4.6,2.8,
      .33*Math.sin(i),'house');
  }
  batches.build();

  const trackSurface = new THREE.MeshBasicMaterial({color:0xb9d2de,side:THREE.DoubleSide});
  for (const course of courses) {
    const vertices=[], indices=[];
    for (const lane of [-1,1]) {
      const first=vertices.length/3;
      course.samples.forEach(([x,a],i)=>{
        const next=course.samples[Math.min(i+1,course.samples.length-1)];
        const prev=course.samples[Math.max(0,i-1)];
        const dx=next[0]-prev[0], da=next[1]-prev[1], run=Math.hypot(dx,da)||1;
        for(const edge of [-.055,.055]) {
          const offset=Math.sin(a*.09)*course.width*.22+lane*.19+edge;
          const px=x+da/run*offset, pa=a-dx/run*offset;
          vertices.push(px,terrainHeight(px,pa)+.19,-pa);
        }
        const k=first+i*2;
        if(i) indices.push(k-2,k-1,k,k,k-1,k+1);
      });
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);
    scene.add(new THREE.Mesh(geometry,trackSurface));
  }
}
