// Time and distance along a full loop. Equally timed chairs keep their spacing
// on the main line and close up naturally on the slower station rail.
export function createLiftMotion(length, speedAt) {
  const steps = Math.ceil(length / 0.2);
  const step = length / steps;
  const times = new Float64Array(steps + 1);
  for (let i = 0; i < steps; i++) {
    times[i + 1] = times[i] + step / speedAt((i + 0.5) * step);
  }
  const duration = times[steps];

  function secondsAt(distance) {
    const laps = Math.floor(distance / length);
    const index = Math.max(0, (distance - laps * length) / step);
    const low = Math.min(steps - 1, Math.floor(index));
    return laps * duration + times[low] + (times[low + 1] - times[low]) * (index - low);
  }

  function distanceAt(seconds) {
    const laps = Math.floor(seconds / duration);
    const local = seconds - laps * duration;
    let low = 0;
    let high = steps;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (times[mid] <= local) low = mid;
      else high = mid;
    }
    return laps * length + step * (low + (local - times[low]) / (times[high] - times[low]));
  }

  return { duration, secondsAt, distanceAt };
}
