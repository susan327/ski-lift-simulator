import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCarrierSwing, createLiftDrive, createLiftOperations, queueSpacing, queueRows } from '../js/lift-operation.js';

test('quad matches rope speed, aligns, clamps and only then clears the rail', () => {
  const operation = createLiftOperations(true);
  const { boarding, start, handoff } = operation.config;
  const sync = boarding + 15 - start;
  const read = offset => operation.mechanicsAt(sync + offset);
  assert.ok(read(-1).speed < 5);
  assert.ok(read(0).carrierDrop > 0);
  assert.equal(read(0).gripOpening, 1);
  for (let offset = 0; offset <= handoff.railEnd + 1; offset += .05) {
    const state = read(offset);
    assert.equal(state.speed, 5);
    assert.equal(state.ropeSpeed, 5);
    if (offset < handoff.aligned) assert.equal(state.gripOpening, 1);
    if (offset >= handoff.aligned) assert.equal(state.carrierDrop, 0);
    if (offset >= handoff.clamped) assert.equal(state.gripOpening, 0);
    if (offset < handoff.clamped) assert.equal(state.railFall, 0);
    if (Math.abs(offset - handoff.railEnd) > 1e-8) assert.equal(state.railPresent, offset < handoff.railEnd);
  }
  assert.deepEqual([-.6,.8,6.1,11,14].map(offset => operation.terminalModeAt(sync + offset)),
    ['accelerate', 'align', 'close', 'releaseRail', 'line']);
  const release = read((handoff.clamped + handoff.railEnd) / 2);
  assert.ok(release.railFall > 0 && release.railPresent);
  assert.equal(read(handoff.railEnd + .1).railPresent, false);
});

test('both lift types reserve a chair and complete a ride independently of rendering', () => {
  for (const quad of [false, true]) {
    const lift = createLiftOperations(quad);
    lift.begin();
    const stages = [lift.state.phase];
    for (let i = 0; i < 6000 && lift.state.phase !== 'arrived'; i++) {
      lift.advance(.05);
      if (stages.at(-1) !== lift.state.phase) stages.push(lift.state.phase);
    }
    assert.deepEqual(stages, ['waiting', 'boarding', 'riding', 'unloading', 'arrived']);
    lift.finishRide();
    assert.equal(lift.state.phase, 'finished');
    lift.begin();
    assert.equal(lift.state.phase, 'waiting');
    assert.ok(lift.state.reservedChair >= 0 && lift.state.reservedChair < lift.config.chairCount);
  }
});

test('the quad waits outside the return sweep and clears it before boarding', () => {
  const lift = createLiftOperations(true);
  const { lower, start, waitingAlong, loadingStop, boarding, wheelRadius } = lift.config;
  assert.ok(start - waitingAlong > wheelRadius + 2);
  const chair = { set(x, y, z) { Object.assign(this, {x, y, z}); } };
  let boarded = false;
  let greenAt;
  let previousGreen = false;
  lift.begin();
  for (let step = 0; step < 20000; step++) {
    lift.advance(.005);
    const state = lift.state;
    const queue = lift.boardingQueueAt(state.travel);
    if (queue.green && !previousGreen && state.phase === 'boarding') greenAt = state.travel;
    previousGreen = queue.green;
    if (state.phase === 'riding') {
      boarded = true;
      break;
    }
    if (state.phase !== 'boarding') continue;
    const along = Math.min(loadingStop, waitingAlong + (loadingStop - waitingAlong) * state.approach
      - (state.queueRow + state.approachRowOffset) * queueSpacing);
    lift.chairDistances.forEach((distance, index) => {
      // The last part of the reserved chair's approach is the intentional seat contact.
      if (index === state.reservedChair && state.along > boarding - 1.25) return;
      const yaw = lift.liftPose(distance, chair);
      for (const seat of [-.96, -.32, .32, .96]) {
        const dx = lower.x + seat - chair.x, dz = -along - chair.z;
        const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
        const longitudinal = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        const gap = Math.hypot(Math.max(0, Math.abs(lateral) - 1.45),
          Math.max(0, Math.abs(longitudinal) - .50));
        assert.ok(gap >= .75);
      }
    });
  }
  assert.ok(boarded && greenAt !== undefined);
});

test('new riders join behind all three rows and move forward in order on every lift', () => {
  for (const [quad, upperPair] of [[false, false], [true, false], [false, true]]) {
    const lift = createLiftOperations(quad, upperPair);
    for (let ride = 0; ride < 2; ride++) {
      lift.begin();
      assert.equal(lift.state.queueRow, queueRows);
      assert.equal(lift.state.approachRowOffset, 0);
      const rows = [lift.state.queueRow];
      const reservedChair = lift.state.reservedChair;
      for (let i = 0; i < 20000 && lift.state.phase !== 'arrived'; i++) {
        lift.advance(.025);
        assert.equal(lift.state.reservedChair, reservedChair);
        if (lift.state.queueRow !== rows.at(-1)) rows.push(lift.state.queueRow);
        if (lift.state.phase === 'riding') assert.equal(lift.state.queueRow, 0);
      }
      assert.deepEqual(rows, [3, 2, 1, 0]);
      assert.equal(lift.state.phase, 'arrived');
      lift.finishRide();
      lift.advance(2.75);
    }
  }
});

test('lift drive ramps down and up without jumping when reversing mid-ramp', () => {
  const drive = createLiftDrive();
  assert.equal(drive.advance(1, true), 5 / 6);
  assert.ok(Math.abs(drive.speedRatio - 2 / 3) < 1e-12);
  const before = drive.speedRatio;
  assert.ok(drive.advance(.5, false) > before * .5);
  assert.ok(Math.abs(drive.speedRatio - before - .125) < 1e-12);
  drive.advance(3, true);
  assert.equal(drive.speedRatio, 0);
  assert.equal(drive.advance(1, true), 0);
  assert.equal(drive.advance(5, false), 3);
  assert.equal(drive.speedRatio, 1);
});
test('chairs sway toward travel when braking, swing back, and settle', () => {
  for (const [quad, upperPair] of [[false, false], [false, true], [true, false]]) {
    const { config } = createLiftOperations(quad, upperPair);
    const drive = createLiftDrive();
    const swing = { pitch: 0, angularSpeed: 0 };
    const dt = 1 / 120;
    advanceCarrierSwing(swing, config.mainSpeed, 0, config.chairDrop);
    for (let frame = 0; frame < 360; frame++) {
      drive.advance(dt, true);
      advanceCarrierSwing(swing, config.mainSpeed * drive.speedRatio, dt, config.chairDrop);
    }
    assert.ok(swing.pitch > .02);
    let swungBack = false;
    for (let frame = 0; frame < 1200; frame++) {
      advanceCarrierSwing(swing, 0, dt, config.chairDrop);
      swungBack ||= swing.pitch < -.005;
    }
    assert.ok(swungBack);
    assert.ok(Math.abs(swing.pitch) < .002);
    for (let frame = 0; frame < 120; frame++) {
      drive.advance(dt, false);
      advanceCarrierSwing(swing, config.mainSpeed * drive.speedRatio, dt, config.chairDrop);
    }
    assert.ok(swing.pitch < -.02);
  }
});

test('quad chairs sway at both automatic terminal speed transitions', () => {
  const operations = createLiftOperations(true);
  const { config, chairDistances } = operations;
  const swing = { pitch: 0, angularSpeed: 0 };
  const dt = 1 / 60;
  let departurePitch = 0;
  let arrivalPitch = 0;
  operations.advance(0);
  for (;;) {
    const distance = chairDistances[0];
    const along = config.start + distance;
    if (along > config.unloading) break;
    advanceCarrierSwing(swing, operations.speedAt(distance), dt, config.chairDrop);
    if (along < config.boarding + 25) departurePitch = Math.min(departurePitch, swing.pitch);
    if (along > config.unloading - 20) arrivalPitch = Math.max(arrivalPitch, swing.pitch);
    operations.advance(dt);
  }
  assert.ok(departurePitch < -.04);
  assert.ok(arrivalPitch > .04);
});