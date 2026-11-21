export const resortName = '雪明かり高原';

export const slopeWidthScale = 1.65;
const elevationScale = 1.6;
const lowerLengthScale = 305 / 65;
const upperLengthScale = 87 / 30;

export function slopeAlong(original) {
  if (original < 0) return original * lowerLengthScale;
  if (original <= 72) return original * 4;
  return 288 + (original - 72) * upperLengthScale;
}

function originalAlong(along) {
  if (along < 0) return along / lowerLengthScale;
  if (along <= 288) return along / 4;
  return 72 + (along - 288) / upperLengthScale;
}

export const places = {
  base: { name: 'ベースロッジ', x: 9, along: -8 },
  pairBase: { name: 'ペア麓駅', x: 0, along: 0 },
  pairTop: { name: 'ペア山頂', x: 0, along: slopeAlong(72) },
  quadBase: { name: 'クワッド麓駅', x: 46 * slopeWidthScale, along: slopeAlong(-65) },
  quadTop: { name: 'クワッド山頂', x: 53 * slopeWidthScale, along: slopeAlong(102) },
};

export const courses = [
  {
    name: 'こもれび林間', level: '初級', color: '#227451', width: 5,
    description: 'ペア山頂から針葉樹の林を回り、麓のロッジ前へ。',
    points: [[8, 74], [15, 68], [23, 58], [22, 48], [13, 40], [12, 31], [21, 22], [19, 12], [12, 5], [9, 0]],
  },
  {
    name: '水鏡バーン', level: '中級', color: '#305fa5', width: 12,
    description: '東の稜線から正面の広い斜面を下り、林間コースと麓で合流。',
    points: [[48, 96], [43, 88], [36, 75], [37, 61], [35, 48], [31, 35], [28, 22], [25, 12], [12, 5]],
  },
  {
    name: '風切り尾根', level: '上級', color: '#712d4d', width: 5,
    description: '東の稜線から急な斜面を抜け、中腹で水鏡バーンに合流。',
    points: [[59.06, 98.90], [61, 93], [64, 81], [58, 70], [48, 62], [37, 61]],
  },
  {
    name: '白樺トラバース', level: '連絡', color: '#87530d', width: 4,
    description: '水鏡バーンの中腹からリフトの西側を通り、クワッド麓駅の手前へ。',
    points: [[35, 48], [36, 42], [34, 33], [35, 22], [33, 11], [35, 1], [37, -17], [35, -37], [37, -55], [38, -64]],
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
  course.points = course.points.map(([x, along]) => [x * slopeWidthScale, slopeAlong(along)]);
  course.width *= 1.5;
  course.samples = sampleCourse(course.points);
}

export function terminalNetFront(quad, summit) {
  const station = summit ? (quad ? places.quadTop : places.pairTop)
    : (quad ? places.quadBase : places.pairBase);
  return station.along + (summit ? -24 : 45);
}

function smoothstep(value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function originalLiftGround(along) {
  return 21 * Math.max(0, Math.min(1, (along - 5) / 60));
}

export const pairLine = { climbStart: slopeAlong(5), climbEnd: slopeAlong(65) };

export function liftGround(along) {
  return elevationScale * originalLiftGround(originalAlong(along));
}

const quadBaseFloor = 0.36;
const quadSummitFloor = 55.8 * elevationScale;
const apronPoints = [[53, 102.22], [54.5, 104.2], [56.8, 105.7], [59.6, 105.9], [62.3, 105.0], [64.7, 103.4], [66.1, 100.8], [66.0, 97.4], [64.2, 94.6], [63, 93]];
export const quadExitPath = sampleCourse(apronPoints.map(([x, along]) => [
  places.quadTop.x + x - 53, places.quadTop.along + along - 102,
]));
const exitLengths = [0];
for (let i = 1; i < quadExitPath.length; i++) {
  const [x, along] = quadExitPath[i];
  const [px, pa] = quadExitPath[i - 1];
  exitLengths.push(exitLengths[i - 1] + Math.hypot(x - px, along - pa));
}
export const quadExitLength = exitLengths.at(-1);
export const quadGlideLength = exitLengths[quadExitPath.findIndex(([x]) => x >= places.quadTop.x + 11.7)];

function exitHeight(distance) {
  return quadSummitFloor - Math.max(0, distance - 2.4) * 0.105;
}

export function quadExitPose(distance) {
  const progress = Math.max(0, Math.min(distance, quadExitLength));
  const i = exitLengths.findIndex((length, index) => index > 0 && length >= progress);
  const t = (progress - exitLengths[i - 1]) / (exitLengths[i] - exitLengths[i - 1]);
  const [x, along] = quadExitPath[i - 1];
  const [nx, na] = quadExitPath[i];
  return { x: x + (nx - x) * t, along: along + (na - along) * t, y: exitHeight(progress),
    yaw: Math.atan2(x - nx, na - along) };
}

export const quadLine = {
  climbStart: places.quadBase.along + 32,
  climbEnd: places.quadTop.along - 32,
  easing: 72,
};

export function quadLiftGround(along) {
  const start = quadLine.climbStart;
  const end = quadLine.climbEnd;
  const ease = quadLine.easing;
  const length = end - start;
  const d = Math.max(0, Math.min(length, along - start));
  // Integral of smoothstep gives a continuous slope into and out of the stations.
  const rampIntegral = t => ease * (t ** 3 - 0.5 * t ** 4);
  const rise = d < ease ? rampIntegral(d / ease)
    : d > length - ease ? length - ease - rampIntegral((length - d) / ease)
      : d - ease / 2;
  return quadBaseFloor + (quadSummitFloor - quadBaseFloor) * rise / (length - ease);
}

function shapeQuadApron(x, along, original) {
  const localX = x - places.quadTop.x;
  const localAlong = along - places.quadTop.along;
  const platform = (1 - smoothstep(Math.abs(localX), 3.3, 13.0))
    * (1 - smoothstep(Math.abs(localAlong - 3), 3.7, 16.0));
  let y = original + (quadSummitFloor - original) * platform;
  if (localX < -4 || localX > 19 || localAlong < -13 || localAlong > 9) return y;

  let nearest = Infinity;
  let progress = 0;
  for (let i = 1; i < quadExitPath.length; i++) {
    const [px, pa] = quadExitPath[i - 1];
    const [nx, na] = quadExitPath[i];
    const dx = nx - px;
    const da = na - pa;
    const t = Math.max(0, Math.min(1, ((x - px) * dx + (along - pa) * da) / (dx * dx + da * da)));
    const distance = Math.hypot(x - px - dx * t, along - pa - da * t);
    if (distance < nearest) {
      nearest = distance;
      progress = exitLengths[i - 1] + (exitLengths[i] - exitLengths[i - 1]) * t;
    }
  }
  const merge = smoothstep(progress, quadGlideLength + 1, quadExitLength);
  const weight = (1 - smoothstep(nearest, 1.75, 5.6)) * (1 - merge);
  return y + (exitHeight(progress) - y) * weight;
}


function originalTerrain(x, along) {
  const west = smoothstep(-x, 10, 35) * (3 * Math.sin(along * 0.077) - 2);
  const east = smoothstep(x, 9, 43);
  const ridge = 35 * smoothstep(along, 19, 111);
  const rolls = (Math.sin(x * 0.23 + along * 0.105) + Math.cos(x * 0.13 - along * 0.18)) * 1.15;
  const baseFade = smoothstep(along, -6, 26);
  const hollowCenter = 24 + 4 * Math.sin((along - 18) * 0.059);
  const hollow = 4.2 * Math.exp(-(((x - hollowCenter) / 9) ** 2));
  const westShoulder = 7.6 * Math.exp(-(((x + 28 + 5 * Math.sin(along * 0.076)) / 14) ** 2));
  const eastShoulder = 8.5 * Math.exp(-(((x - (72 + 5 * Math.cos(along * 0.061))) / 12) ** 2));
  const drainage = smoothstep(along, 5, 27) * (1 - smoothstep(along, 77, 101));
  const original = originalLiftGround(along) + west * baseFade + east * (ridge + rolls * baseFade)
    + drainage * (westShoulder + eastShoulder - hollow);
  return original;
}

export function terrainHeight(x, along) {
  const base = elevationScale * originalTerrain(x / slopeWidthScale, originalAlong(along));
  const linkBank = 10 * smoothstep(x, 32, 70) * smoothstep(along, -285, -9)
    * (1 - smoothstep(along, -9, 112));
  const pairCorridor = 1 - smoothstep(Math.abs(x + 2), 4.2, 11);
  const pairSnow = liftGround(along);
  const groomed = base + (pairSnow - base) * pairCorridor;
  const lowerAlong = along - places.quadBase.along;
  const lineProgress = smoothstep(along, quadLine.climbStart, quadLine.climbEnd);
  const quadX = places.quadBase.x + (places.quadTop.x - places.quadBase.x) * lineProgress;
  const quadCorridor = (1 - smoothstep(Math.abs(x - (quadX - 2.65)), 4.6, 8.3))
    * smoothstep(lowerAlong, 5, 29) * (1 - smoothstep(lowerAlong, 165, 205));
  const quadCeiling = quadLiftGround(along) - 1.2;
  const lowered = groomed + linkBank;
  const cleared = lowered - Math.max(0, lowered - quadCeiling) * quadCorridor;

  // The rolls fade out around both stations and the groomed lift corridor.
  const reliefZone = smoothstep(along, 35, 86) * (1 - smoothstep(along, 244, 280));
  const spur = 2.8 * Math.exp(-(((x + 16 + 4 * Math.sin(along / 52)) / 9) ** 2));
  const gully = 3.1 * Math.exp(-(((x - 43 - 5 * Math.sin(along / 41)) / 10) ** 2));
  const shoulder = 2.5 * Math.exp(-(((x - 67 + 3 * Math.cos(along / 43)) / 13) ** 2));
  const relief = reliefZone * (spur + shoulder - gully) * (1 - pairCorridor);
  let snow = shapeQuadApron(x, along, cleared + relief);
  for (const quad of [false, true]) {
    const line = quad ? quadLine : pairLine;
    const lower = quad ? places.quadBase : places.pairBase;
    const upper = quad ? places.quadTop : places.pairTop;
    const track = quad ? quadLiftGround : liftGround;
    const radius = quad ? 2.65 : 2;
    const center = lower.x + (upper.x - lower.x) * smoothstep(along, line.climbStart, line.climbEnd);
    const width = 1 - smoothstep(Math.abs(x - (center - radius)), radius + 1.55, radius + 4);
    for (const summit of [false, true]) {
      const front = terminalNetFront(quad, summit);
      const weight = width * (1 - smoothstep(Math.abs(along - front), 2, 14));
      snow -= Math.max(0, snow - (track(along) - 1.9)) * weight;
    }
  }
  return snow;
}

export function nearCourse(x, along, margin) {
  return courses.some(course => course.samples.some(([cx, cy]) =>
    Math.hypot(cx - x, cy - along) < course.width / 2 + margin));
}
