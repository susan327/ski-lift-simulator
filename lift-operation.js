import { places, liftGround, quadLiftGround, quadLine, pairLine, upperPairLine, upperPairGround } from './resort.js';
import { createLiftMotion } from './lift-motion.js';

const lerp = (a,b,t) => (1 - t) * a + t * b;
const modulo = (value, length) => ((value % length) + length) % length;
function smoothstep(value,min,max) {
  const t = Math.max(0,Math.min(1,(value-min)/(max-min)));
  return t*t*(3-2*t);
}

export function createLiftOperations(quad, upperPair = false) {
  const lower = quad ? places.quadBase : upperPair ? places.pairUpperBase : places.pairBase;
  const upper = quad ? places.quadTop : upperPair ? places.pairUpperTop : places.pairTop;
  const boarding = lower.along;
  const loadingStop = boarding + .14;
  // The leading armrest projects 0.38 m ahead of the chair anchor.
  // Transfer the rider when that envelope reaches their standing position.
  const boardingContact = loadingStop - .38;
  const unloading = upper.along;
  const start = boarding - 10;
  // The straight quad queue starts behind the entire return-wheel sweep.
  const waitingAlong = start - (quad ? 5.5 : 1.5);
  const boardingApproachSeconds = 8;
  const signalAlong = waitingAlong + 2;
  const end = unloading + 10;
  const { climbStart, climbEnd } = quad ? quadLine : upperPair ? upperPairLine : pairLine;
  const mainSpeed = quad ? 5 : 2.4;
  const stationSpeed = quad ? 1.0 : mainSpeed;
  const cableHeight = quad ? 5.1 : 4.4;
  const chairDrop = quad ? 4.15 : 3.8;
  const wheelRadius = quad ? 2.65 : 2;
  const lineLength = end - start;
  const turnLength = Math.PI * wheelRadius;
  const loopLength = 2 * (lineLength + turnLength);
  const baseTurn = 2 * lineLength + turnLength;
  const railDrop = quad ? 0.36 : 0;
  const glideSeconds = 7.2;

  const trackGround = quad ? quadLiftGround : upperPair ? upperPairGround : liftGround;
  const terminalReach = quad ? 32 : upperPair ? 20 : 19;
  const firstTower = boarding + terminalReach;
  const lastTower = unloading - terminalReach;
  const spans = Math.ceil((lastTower - firstTower) / (quad ? 52 : 38));
  const towerPositions = Array.from({length: spans + 1}, (_, i) => lerp(firstTower, lastTower, i / spans));
  const supports = [start, ...towerPositions, end].map((along, index, points) => {
    if (index <= 1 || index >= points.length - 2) {
      const atBase = index <= 1;
      return { along, x: atBase ? lower.x : upper.x,
        y: trackGround(atBase ? boarding : unloading) + cableHeight };
    }
    const cross = smoothstep(along, climbStart, climbEnd);
    const terminal = quad ? 31 : 11;
    const transition = quad ? 62 : 35;
    const rise = quad ? 13 : upperPair ? 11 : 8;
    const distanceFromStation = Math.min(along - boarding, unloading - along);
    const clearance = rise * smoothstep(distanceFromStation, terminal, terminal + transition);
    return { along, x: lerp(lower.x, upper.x, cross), y: trackGround(along) + cableHeight + clearance };
  });

  function spanAt(along) {
    const index = supports.findIndex((support, i) => i > 0 && along <= support.along);
    return index < 0 ? supports.length - 1 : index;
  }

  function lineX(along) {
    const index = spanAt(along);
    const from = supports[index - 1], to = supports[index];
    const t = Math.max(0, Math.min(1, (along - from.along) / (to.along - from.along)));
    return lerp(from.x, to.x, t);
  }

  function ropeYAt(along) {
    const index = spanAt(along);
    const from = supports[index - 1], to = supports[index];
    const length = to.along - from.along;
    const t = Math.max(0, Math.min(1, (along - from.along) / length));
    // End spans share the terminal's level conveyor. Free spans sag below their support chord.
    if (index === 1 || index === supports.length - 1) return from.y;
    const sag = Math.min(.45, length ** 2 * .00016);
    return lerp(from.y, to.y, t) - 4 * sag * t * (1 - t);
  }
  const summit = trackGround(unloading);

  function terminalWeight(distance) {
    const d = modulo(distance, loopLength);
    const along = d <= lineLength ? start + d : end - (d - lineLength - turnLength);
    if (d > lineLength && d < lineLength + turnLength || d >= baseTurn) return 1;
    const leaving = smoothstep(along, boarding + 4, boarding + 15);
    const arriving = smoothstep(along, unloading - 16, unloading - 4);
    return Math.max(1 - leaving, arriving);
  }

  function speedAt(distance) {
    return lerp(mainSpeed, stationSpeed, terminalWeight(distance));
  }

  // Distance from the speed match point, positive toward the open line.
  const handoff = { aligned: 5.4, clamped: 9.8, railEnd: 13.8 };

  function handoffDistance(distance) {
    const d = modulo(distance, loopLength);
    if ((d > lineLength && d < lineLength + turnLength) || d >= baseTurn) return -Infinity;
    const along = d <= lineLength ? start + d : end - (d - lineLength - turnLength);
    return Math.min(along - (boarding + 15), unloading - 16 - along);
  }

  function railSupport(distance) {
    return 1 - smoothstep(handoffDistance(distance), 0, handoff.aligned);
  }

  function gripOpen(distance) {
    return 1 - smoothstep(handoffDistance(distance), handoff.aligned, handoff.clamped);
  }

  function railFall(distance) {
    return 0.14 * smoothstep(handoffDistance(distance), handoff.clamped, handoff.railEnd);
  }

  const announcementPoints = quad ? { approaching: towerPositions.at(-3), unloading: unloading - 6 } : null;
  const motion = createLiftMotion(loopLength, speedAt);
  const chairCount = Math.max(1, Math.round(motion.duration / (quad ? 16 : 13)));
  const unloadTime = motion.secondsAt(unloading - start);

  function liftPose(distance, position) {
    const d = modulo(distance, loopLength);
    if (d <= lineLength) {
      const along = start + d;
      position.set(lineX(along), ropeYAt(along), -along);
      return -Math.atan2(lineX(along + 0.1) - lineX(along - 0.1), 0.2);
    }
    if (d < lineLength + turnLength) {
      const angle = (d - lineLength) / wheelRadius;
      position.set(upper.x + wheelRadius * (Math.cos(angle) - 1), summit + cableHeight, -end - wheelRadius * Math.sin(angle));
      return angle;
    }
    if (d <= 2 * lineLength + turnLength) {
      const along = end - (d - lineLength - turnLength);
      position.set(lineX(along) - 2 * wheelRadius, ropeYAt(along), -along);
      return Math.PI - Math.atan2(lineX(along + 0.1) - lineX(along - 0.1), 0.2);
    }
    const angle = (d - 2 * lineLength - turnLength) / wheelRadius;
    position.set(lower.x - wheelRadius * (1 + Math.cos(angle)), trackGround(boarding) + cableHeight, -start + wheelRadius * Math.sin(angle));
    return Math.PI + angle;
  }

  function stageAt(along, elapsed) {
    if (elapsed < boardingTime) return 'waiting';
    if (elapsed < loadTime) return 'boarding';
    if (along < unloading) return 'riding';
    if (elapsed < unloadTime + glideSeconds) return 'unloading';
    return 'arrived';
  }

  function mechanicsAt(distance) {
    const d = modulo(distance, loopLength);
    const leaving = smoothstep(d, boarding - start + 1, boarding - start + 4);
    const arriving = smoothstep(d, unloading - start - 7, unloading - start - 2);
    const outbound = d < lineLength ? leaving * (1 - arriving) : 0;
    const transfer = handoffDistance(distance);
    return {
      speed: speedAt(distance),
      ropeSpeed: mainSpeed,
      gripOpening: quad ? gripOpen(distance) : 0,
      carrierDrop: railDrop * railSupport(distance),
      railFall: quad ? railFall(distance) : 0,
      railPresent: quad && transfer < handoff.railEnd,
      barAngle: 1.26 * (1 - outbound),
    };
  }

  function carrierMotionAt(distance, result) {
    const d = modulo(distance, loopLength);
    const uphill = d <= lineLength;
    const downhill = d >= lineLength + turnLength && d < baseTurn;
    result.pitch = 0;
    result.bounce = 0;
    if (!uphill && !downhill) return;
    const along = uphill ? start + d : end - (d - lineLength - turnLength);
    const direction = uphill ? 1 : -1;
    const speed = speedAt(d);
    if (quad && (Math.abs(along - (boarding + 10)) < 14 || Math.abs(along - (unloading - 10)) < 14)) {
      const time = motion.secondsAt(d);
      const speedNow = speedAt(motion.distanceAt(time - .12));
      const speedBefore = speedAt(motion.distanceAt(time - .48));
      const speedEarlier = speedAt(motion.distanceAt(time - .92));
      result.pitch = Math.max(-.055, Math.min(.055,
        -.065 * (speedNow - speedBefore) + .025 * (speedBefore - speedEarlier)));
    }
    for (const tower of towerPositions) {
      const offset = (along - tower) * direction;
      if (offset < -1.25 || offset > 2.9) continue;
      const envelope = smoothstep(offset, -1.25, -.7) * (1 - smoothstep(offset, .65, 2.9));
      const bump = Math.sin((offset + .67) * Math.PI * 2 / .46) * envelope;
      result.bounce = .037 * bump;
      result.pitch += .012 * bump * (speed / mainSpeed);
      break;
    }
  }

  function towerBetween(before, after) {
    return towerPositions.find(tower => before < tower - .85 && after >= tower - .85);
  }

  function terminalModeAt(distance) {
    const along = start + distance;
    const weight = terminalWeight(distance);
    if (weight >= .999) return 'station';
    const departure = along < (boarding + unloading) / 2;
    if (weight > .001) return departure ? 'accelerate' : 'decelerate';
    const transfer = handoffDistance(distance);
    if (transfer < handoff.aligned) return departure ? 'align' : 'detach';
    if (transfer < handoff.clamped) return departure ? 'close' : 'open';
    if (transfer < handoff.railEnd) return departure ? 'releaseRail' : 'takeRail';
    return 'line';
  }

  const seatSpacing = motion.duration / chairCount;
  const loadTime = motion.secondsAt(boardingContact - start);
  // The quad's next group starts from the rear while the preceding group seats.
  const clearanceTime = quad ? -5 : motion.secondsAt(loadingStop + 1.36 - start) - loadTime;
  const boardingTime = loadTime - seatSpacing + clearanceTime;

  function boardingQueueAt(travel) {
    const sinceContact = modulo(travel - loadTime, seatSpacing);
    const elapsed = modulo(travel - loadTime - clearanceTime, seatSpacing);
    const early = clearanceTime < 0 && sinceContact >= seatSpacing + clearanceTime;
    return {
      sinceContact,
      early,
      green: elapsed >= 0 && elapsed < 2,
      progress: smoothstep(elapsed, 0, boardingApproachSeconds),
    };
  }
  const state = {
    queueRow: 0,
    approachRowOffset: 0,
    approach: 0,
    sitProgress: 0,
    travel: 0, ropeTravel: 0, reservedChair: 0, along: start,
    riderDistance: 0, glideElapsed: 0, phase: 'waiting',
  };
  const chairDistances = new Float64Array(chairCount);
  let boardingTravel = 0;

  function updateRider() {
    const rideTime = state.travel - boardingTravel;
    state.sitProgress = smoothstep(rideTime, loadTime, loadTime + .55);
    state.approach = smoothstep(rideTime, boardingTime, boardingTime + boardingApproachSeconds);
    state.queueRow = Math.max(0, Math.floor((loadTime - rideTime) / seatSpacing));
    const timePastPreviousChair = rideTime - (loadTime - seatSpacing);
    state.approachRowOffset = quad && state.queueRow === 0
      ? 1 - smoothstep(timePastPreviousChair, 0, .8) : 0;
    state.riderDistance = motion.distanceAt(rideTime);
    state.along = start + state.riderDistance;
    state.glideElapsed = rideTime - unloadTime;
    if (state.phase !== 'finished') state.phase = stageAt(state.along, rideTime);
  }

  function begin() {
    const nextSlot = Math.ceil((state.travel - boardingTime) / seatSpacing);
    boardingTravel = nextSlot * seatSpacing;
    state.reservedChair = modulo(-nextSlot, chairCount);
    state.phase = 'waiting';
    updateRider();
    state.phase = 'waiting';
  }

  function advance(seconds) {
    state.travel += seconds;
    state.ropeTravel += seconds * mainSpeed;
    updateRider();
    for (let index = 0; index < chairCount; index++) {
      chairDistances[index] = motion.distanceAt(state.travel + index * seatSpacing);
    }
  }

  function finishRide() {
    if (state.phase === 'arrived') state.phase = 'finished';
  }

  const config = { quad, upperPair, lower, upper, boarding, loadingStop, boardingContact, waitingAlong, signalAlong, unloading, start, end, climbStart, climbEnd,
    mainSpeed, stationSpeed, cableHeight, chairDrop, chairCount, wheelRadius, lineLength, turnLength,
    loopLength, baseTurn, railDrop, glideSeconds, summit, handoff, towerPositions, announcementPoints };
  return { config, state, chairDistances, lineX, trackGround, ropeYAt, liftPose, speedAt, mechanicsAt,
    handoffDistance, railSupport, railFall, gripOpen, terminalModeAt, carrierMotionAt, towerBetween, boardingQueueAt, begin, advance, finishRide };
}
