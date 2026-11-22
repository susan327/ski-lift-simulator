// リフト音源ジェネレーター

export const preset = {
  "kind": "joint",
  "tone": 300,
  "body": 150,
  "duration": 35,
  "start": 5,
  "end": 14,
  "count": 23,
  "level": 75
};

export const sampleRate = 44100;

const tau = Math.PI * 2;

const noteFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

function toneWave(phase, shape, frequency) {
  if (shape === 'sine') return Math.sin(phase);
  let sum = 0;
  const harmonics = Math.min(13, Math.floor(sampleRate / (2 * frequency)));
  for (let k = 1; k <= harmonics; k++) {
    if (shape !== 'saw' && k % 2 === 0) continue;
    const amplitude = shape === 'triangle' ? (-1) ** ((k - 1) / 2) / k ** 2
      : shape === 'saw' ? (-1) ** (k - 1) / k : 1 / k;
    sum += amplitude * Math.sin(k * phase);
  }
  return sum * (shape === 'square' ? .80 : shape === 'saw' ? .64 : .81);
}

function synthesize(kind, p) {
  const joint = kind === 'joint';
  const length = p.duration / 1000;
  const times = [0];
  if (joint) {
    for (let hit = 1; hit < p.count; hit++) {
      const rate = p.start + (p.end - p.start) * (hit - 1) / Math.max(1,p.count - 2);
      times.push(times.at(-1) + 1 / rate);
    }
  } else {
    const gap = p.gap / 1000;
    times.push(p.transition === 'blend' ? Math.min(gap, Math.max(.005, length - .005))
      : p.transition === 'separate' ? Math.max(gap, p.bridge / 1000 + .008)
      : gap);
  }
  const samples = new Float32Array(Math.ceil((times.at(-1) + length + .04) * sampleRate));
  times.forEach((at, index) => {
    const start = Math.round(at * sampleRate);
    const frequency = joint ? 0 : noteFrequency(index === 0 ? p.high : p.low);
    const timbre = p.wave;
    const attack = joint ? .004 : .019 - .00017 * p.strike;
    const bridge = joint ? 0 : p.bridge / 1000;
    const crossfade = !joint && p.transition === 'blend';
    const blend = crossfade ? Math.max(.004, Math.min(bridge || .004, length - times[1])) : 0;
    const stop = joint || index > 0 || p.transition === 'overlap' ? length
      : crossfade ? times[1] + blend
      : Math.min(length, times[1] - bridge);
    let low = 0, band = 0;
    let random = (index + 1) * 997;
    for (let frame = 0; frame < stop * sampleRate; frame++) {
      const t = frame / sampleRate;
      const short = !joint && p.tail === 'short';
      const decay = joint ? 5.5 / length : short ? 1.5 / length : 13.7;
      const fade = short ? .007 : .016;
      const gate = crossfade && index === 0
        ? Math.min(1,(stop - t) / blend)
        : Math.min(1,(stop - t) / fade);
      const onset = crossfade && index === 1 ? blend : short ? Math.min(attack,.004) : attack;
      const envelope = Math.min(1,t / onset) * Math.exp(-decay * t) * gate;
      let value;
      if (joint) {
        random = (Math.imul(1664525,random) + 1013904223) >>> 0;
        const noise = random / 2147483648 - 1;
        const cutoff = 2 * Math.sin(Math.PI * p.tone / sampleRate);
        low += cutoff * band;
        band += cutoff * (noise - low - .75 * band);
        const phase = tau * p.body * (t - .19 * t * t / length);
        value = 1.5 * band + .58 * Math.sin(phase);
      } else {
        const phase = tau * frequency * t;
        value = .74 * Math.sin(phase);
        if (timbre === 'bell') value += .23 * Math.sin(phase * 2.01) * Math.exp(-8 * t) + .13 * Math.sin(phase * 3.94) * Math.exp(-14 * t);
        if (timbre === 'clear') value += .20 * Math.sin(phase * 2) + .09 * Math.sin(phase * 3);
        if (timbre === 'doorbell') {
          value = .78 * Math.sin(phase)
            + .37 * Math.sin(phase * 2.76) * Math.exp(-20 * t)
            + .23 * Math.sin(phase * 5.39) * Math.exp(-42 * t);
        }
        if (timbre === 'metal') {
          value += .30 * Math.sin(phase * 2.4) * Math.exp(-10 * t)
            + .18 * Math.sin(phase * 4.31) * Math.exp(-19 * t);
        }
        if (timbre === 'digital') {
          value = .70 * Math.sin(phase + .85 * Math.sin(phase * 2) * Math.exp(-17 * t));
        }
        if (timbre === 'buzzer') {
          value = .65 * (Math.sin(phase) + .32 * Math.sin(phase * 3) + .13 * Math.sin(phase * 5));
        }
        if (p.waveform !== 'preset') value = .34 * value + .56 * toneWave(phase, p.waveform, frequency);
        value += p.brightness / 100 * (.13 * Math.sin(phase * 2) + .08 * Math.sin(phase * 3));
        value += p.metallic / 100 * .20 * Math.sin(phase * 3.71) * Math.exp(-18 * t);
      }
      samples[start + frame] += value * envelope * p.level / 100;
    }
  });
  return samples;
}

export function createSamples() { return synthesize(preset.kind, preset); }
