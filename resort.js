export const resortName = '雪明かり高原';

export const slopeWidthScale = 1.65;
const lowerLengthScale = 305 / 65;
const upperLengthScale = 87 / 30;

export function slopeAlong(original) {
  if (original < 0) return original * lowerLengthScale;
  if (original <= 72) return original * 4;
  return 288 + (original - 72) * upperLengthScale;
}

// Stretch the lift zones independently so the short transfer remains walkable.
export function stretchAlong(along) {
  if (along < -305) return along;
  if (along <= 150) return -305 + (along + 305) * 820 / 455;
  if (along <= 176) return 515 + along - 150;
  return 541 + (along - 176) * 440 / 194;
}

function stretchBeginner(along) {
  return -288 + (along + 288) * 300 / 153;
}

export const places = {
  base: { name: 'ベースロッジ', x: 124, along: -302 },
  pairBase: { name: '第1ペア麓駅', x: 117, along: -288 },
  pairTop: { name: '第1ペア上駅', x: 158, along: 12 },
  pairUpperBase: { name: '第2ペア中腹駅', x: 75, along: 541 },
  pairUpperTop: { name: '第2ペア山頂駅', x: -13, along: 981 },
  quadBase: { name: 'クワッド麓駅', x: 67, along: -305 },
  quadTop: { name: 'クワッド中腹駅', x: 84, along: 515 },
};

export const courses = [
  {
    name: 'ひだまりゲレンデ', level: '初級', color: '#428044', width: 9,
    description: '第1ペア上駅から索の下を横切り、麓へ戻る緩斜面。',
    points: [[161,-131],[208,-157],[182,-185],[139,-207],[87,-230],[84,-260],[99,-287]],
  },
  {
    name: '水鏡バーン', level: '中級', color: '#305fa5', width: 13,
    description: 'クワッド中腹駅から山腹を回り、風切り尾根と合流して麓へ。',
    points: [[111,145],[152,132],[125,84],[139,31],[79,-20],[38,-65],[-19,-130],[-37,-197],[37,-252],[48,-300]],
  },
  {
    name: '風切り尾根', level: '上級', color: '#712d4d', width: 8,
    description: '第2ペア山頂駅から東側の尾根を滑り、水鏡バーンに合流。そのまま共通ルートで麓へ。',
    points: [[-6,371],[72,354],[110,322],[151,287],[183,243],[162,189],[137,141],[125,84]],
    joins: { course: 1, point: 2 },
  },
  {
    name: 'こもれび林間', level: '林間', color: '#227451', width: 8,
    description: '山頂から左手の林を蛇行して麓へ。クワッド中腹駅からも途中合流できる。',
    points: [[-20,368],[-113,333],[-148,285],[-53,244],[-15,198],[-110,153],[-154,99],[-65,52],[-8,13],[-109,-55],[-157,-111],[-81,-158],[18,-191],[14,-220],[37,-252],[48,-300]],
    midway: [[78,151],[60,126],[36,93],[15,53],[-8,13]],
    joins: { course: 1, point: 8, from: 14 },
  },
];

function sampleCourse(points) {
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[i];
    const c = points[i + 1];
    const d = points[Math.min(points.length - 1, i + 2)];
    const count = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 2);
    for (let step = 0; step < count; step++) {
      const t = step / count;
      samples.push(b.map((value, axis) => {
        const tangentIn = (c[axis] - a[axis]) / 2;
        const tangentOut = (d[axis] - value) / 2;
        return (2*t**3 - 3*t*t + 1)*value + (t**3 - 2*t*t + t)*tangentIn
          + (-2*t**3 + 3*t*t)*c[axis] + (t**3 - t*t)*tangentOut;
      }));
    }
  }
  samples.push(points.at(-1));
  return samples;
}

for (const course of courses) {
  const transform = course === courses[0] ? stretchBeginner : stretchAlong;
  course.points = course.points.map(([x, along]) => [x, transform(along)]);
  if (course.midway) course.midway = course.midway.map(([x, along]) => [x, transform(along)]);
  course.samples = sampleCourse(course.points);
}
for (const course of courses) {
  if (!course.joins) {
    course.route = course.samples;
    continue;
  }
  const { course: targetIndex, point, from } = course.joins;
  const target = courses[targetIndex];
  const join = target.points[point];
  const sharedStart = target.samples.findIndex(([x, along]) => x === join[0] && along === join[1]);
  // Sample through the junction with the same outgoing tangent, then use the actual shared trail.
  const approach = course.points.slice(0, from ?? course.points.length - 1);
  const approachSamples = sampleCourse([...approach, join, target.points[point + 1]]);
  const split = approachSamples.findIndex(([x, along]) => x === join[0] && along === join[1]);
  course.samples = approachSamples.slice(0, split + 1);
  course.route = [...course.samples.slice(0, -1), ...target.samples.slice(sharedStart)];
  if (course.midway) {
    const [x, along] = course.midway.at(-1);
    const entry = course.route.findIndex(([px, pa]) => px === x && pa === along);
    const connector = sampleCourse([...course.midway, course.points[9]]);
    const end = connector.findIndex(([px, pa]) => px === x && pa === along);
    course.midwaySamples = connector.slice(0, end + 1);
    course.midwayRoute = [...connector.slice(0, end), ...course.route.slice(entry)];
  }
}

export function terminalNetFront(quad, summit, upperPair = false) {
  const station = summit ? (quad ? places.quadTop : upperPair ? places.pairUpperTop : places.pairTop)
    : (quad ? places.quadBase : upperPair ? places.pairUpperBase : places.pairBase);
  return station.along + (summit ? -24 : 45);
}

function smoothstep(value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export const pairLine = { climbStart: places.pairBase.along + 19, climbEnd: places.pairTop.along - 19 };
export const upperPairLine = { climbStart: places.pairUpperBase.along + 20, climbEnd: places.pairUpperTop.along - 21 };
const quadBaseFloor = .36;
const quadSummitFloor = 76;
const summitFloor = 148;

function easedLiftGround(along, line, lower, upper, ease) {
  const length = line.climbEnd - line.climbStart;
  const d = Math.max(0, Math.min(length, along - line.climbStart));
  const ramp = t => ease * (t ** 3 - .5 * t ** 4);
  const rise = d < ease ? ramp(d / ease)
    : d > length - ease ? length - ease - ramp((length - d) / ease) : d - ease / 2;
  return lower + (upper - lower) * rise / (length - ease);
}

export function liftGround(along) {
  return easedLiftGround(along, pairLine, 0, 23, 35);
}

export function upperPairGround(along) {
  return easedLiftGround(along, upperPairLine, quadSummitFloor, summitFloor, 50);
}

export const exitRunLength = 18;
const exitGrade = .085;
const exitDrop = progress => exitGrade
  * (Math.max(0, progress - 1.6) - Math.max(0, progress - 12));

export function liftExitPose(upper, floor, distance) {
  const progress = Math.max(0, Math.min(distance, exitRunLength));
  return {
    x: upper.x + 1.55 * smoothstep(progress, 6, 14),
    along: upper.along + .22 + progress,
    y: floor - exitDrop(progress),
  };
}

export const quadLine = {
  climbStart: places.quadBase.along + 32,
  climbEnd: places.quadTop.along - 32,
  easing: 120,
};

export function quadLiftGround(along) {
  return easedLiftGround(along, quadLine, quadBaseFloor, quadSummitFloor, quadLine.easing);
}

function shapeExitApron(x, along, snow, upper, floor) {
  const local = along - upper.along;
  if (local < -4 || local > 38 || Math.abs(x - upper.x - 2) > 19) return snow;
  const longitudinal = smoothstep(local, -4, 0) * (1 - smoothstep(local, 24, 38));
  const lateral = 1 - smoothstep(Math.abs(x - upper.x - 2), 7, 19);
  return snow + (floor - exitDrop(local - .22) - snow) * longitudinal * lateral;
}

const terrainLifts = [
  [places.pairBase, places.pairTop, pairLine, liftGround],
  [places.quadBase, places.quadTop, quadLine, quadLiftGround],
  [places.pairUpperBase, places.pairUpperTop, upperPairLine, upperPairGround],
];

export function terrainHeight(x, along) {
  const grade = quadLiftGround(along) + upperPairGround(along) - quadSummitFloor;
  const lowerShoulder = smoothstep(x, 94, 152) * (1 - smoothstep(along, 15, 242));
  const meadow = grade + (liftGround(along) - grade) * lowerShoulder;
  const rise = smoothstep(along, -285, -160);
  const terrainRelief = rise * (1.5 * Math.sin(x * .042 + along * .016)
    + .9 * Math.cos(x * .076 - along * .017));
  let snow = meadow + terrainRelief;
  for (const [lower, upper, line, track] of terrainLifts) {
    const center = lower.x + (upper.x - lower.x) * smoothstep(along, line.climbStart, line.climbEnd);
    const cross = 1 - smoothstep(Math.abs(x - center + 1), 7, 32);
    const length = smoothstep(along, lower.along - 39, lower.along - 16)
      * (1 - smoothstep(along, upper.along + 15, upper.along + 39));
    snow += (track(along) - snow) * cross * length;
  }
  for (const [, upper, , track] of terrainLifts) {
    snow = shapeExitApron(x, along, snow, upper, track(upper.along));
  }
  return snow;
}

export function nearCourse(x, along, margin) {
  return courses.some(course => [course.samples, course.midwaySamples].some(path => path?.some(([cx, cy]) =>
    Math.hypot(cx - x, cy - along) < course.width / 2 + margin)));
}

export function nearLift(x, along) {
  if (terrainLifts.some(([, upper]) => along >= upper.along && along <= upper.along + 28
    && Math.abs(x - upper.x - 2) < 8)) return true;
  return terrainLifts.some(([lower, upper, line]) => {
    if (along < lower.along - 19 || along > upper.along + 18) return false;
    const center = lower.x + (upper.x - lower.x) * smoothstep(along, line.climbStart, line.climbEnd);
    return Math.abs(x - center + 1.5) < 8;
  });
}
