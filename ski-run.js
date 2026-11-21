import { courses, places, terrainHeight } from './resort.js';

const points = [
  [2.25, places.pairTop.along + 3.22],
  [6.0, places.pairTop.along + 3.5],
  ...courses[0].samples,
];
const lengthAt = [0];
for (let i = 1; i < points.length; i++) {
  const [x,a] = points[i];
  const [px,pa] = points[i-1];
  lengthAt.push(lengthAt[i-1] + Math.hypot(x-px,a-pa));
}
const length = lengthAt.at(-1);
const limit = (value,min,max) => Math.max(min,Math.min(max,value));

function sample(distance) {
  const at = limit(distance, 0, length);
  let low = 0, high = lengthAt.length-1;
  while(high-low>1) {
    const mid=(high+low)>>1;
    if(lengthAt[mid]<=at) low=mid;
    else high=mid;
  }
  const [x,a]=points[low];
  const [nx,na]=points[high];
  const t=(at-lengthAt[low])/(lengthAt[high]-lengthAt[low]);
  return [x+(nx-x)*t,a+(na-a)*t];
}

export function createSkiRun() {
  let distance=0, lateral=0, speed=0, steering=0;
  const state={ running:false, arrived:false, speed:0, x:points[0][0], along:points[0][1], yaw:0, lean:0 };

  function begin() {
    distance=0;
    lateral=0;
    speed=0;
    steering=0;
    state.arrived=false;
    state.running=true;
  }

  function advance(dt, {left=false,right=false,push=false,brake=false}={}) {
    if(!state.running)return;
    const [x,a]=sample(distance);
    const [nx,na]=sample(distance+3);
    const slope=(terrainHeight(x,a)-terrainHeight(nx,na))/3;
    const drive = (push ? 3.4 : 0) + limit(slope*7.2, -.72, 2.1) - .035*speed;
    speed = limit(speed + (brake ? -7.1 : drive)*dt, 0, 12.5);
    distance = Math.min(length, distance+speed*dt);
    steering+=(Number(right)-Number(left)-steering)*Math.min(1,dt*7);
    lateral=limit(lateral + steering*speed*.32*dt, -2.6,2.6);
    const p=sample(distance);
    const q=sample(Math.min(length,distance+4));
    const r=distance>=length-4?sample(Math.max(0,distance-3)):p;
    const headingX=q[0]-r[0], headingA=q[1]-r[1];
    const run=Math.hypot(headingX,headingA)||1;
    state.x=p[0]+headingA/run*lateral;
    state.along=p[1]-headingX/run*lateral;
    state.yaw=Math.atan2(-headingX,headingA)-steering*.20;
    state.lean=-steering*Math.min(speed/8,1)*.15;
    if(distance===length){
      speed=0;
      state.running=false;
      state.arrived=true;
    }
    state.speed=speed;
  }

  return { state, begin, advance };
}
