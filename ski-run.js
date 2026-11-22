import { courses, terrainHeight } from './resort.js';

const limit = (value,min,max) => Math.max(min,Math.min(max,value));

export function createSkiRun() {
  let points, lengthAt, length, lateralLimit;

  function selectCourse(index, midway) {
    const course = courses[index];
    points = midway && course.midwayRoute ? course.midwayRoute : course.route;
    lengthAt = [0];
    for (let i = 1; i < points.length; i++) {
      const [x, along] = points[i];
      const [previousX, previousAlong] = points[i - 1];
      lengthAt.push(lengthAt[i - 1] + Math.hypot(x - previousX, along - previousAlong));
    }
    length = lengthAt.at(-1);
    lateralLimit = Math.min(2.6, course.width * .36);
  }

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

  let distance=0, lateral=0, speed=0, steering=0;
  const state={ running:false, arrived:false, speed:0, x:0, along:0, yaw:0, lean:0 };

  function begin(index = 0, midway = false) {
    selectCourse(index, midway);
    [state.x, state.along] = points[0];
    state.speed = 0;
    state.lean = 0;
    distance=0;
    lateral=0;
    speed=0;
    steering=0;
    state.arrived=false;
    state.running=true;
    advance(0);
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
    lateral=limit(lateral + steering*speed*.32*dt, -lateralLimit,lateralLimit);
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
