import test from 'node:test';
import assert from 'node:assert/strict';
import { courses, places, terrainHeight, liftExitPose, liftExitProgress, liftExitClearsCarrier, exitRunLength } from './resort.js';
import { createSkiRun } from './ski-run.js';
import { createLiftOperations } from './lift-operation.js';

test('the two pair lifts serve the lower slope and the upper slope independently', () => {
  const first = createLiftOperations(false);
  const second = createLiftOperations(false, true);
  assert.equal(first.config.lower, places.pairBase);
  assert.equal(first.config.upper, places.pairTop);
  assert.equal(second.config.lower, places.pairUpperBase);
  assert.equal(second.config.upper, places.pairUpperTop);
  for (const lift of [first, second]) {
    lift.begin();
    for (let i = 0; i < 6000 && lift.state.phase !== 'arrived'; i++) lift.advance(.05);
    assert.equal(lift.state.phase, 'arrived');
  }
});

for (const [index, course] of courses.entries()) {
  for (const midway of course.midwayRoute ? [false, true] : [false]) {
    test(course.name + (midway ? ' from mid-mountain' : '') + ' is traversable across the steering range', () => {
      for (const input of [{push:true}, {push:true,left:true}, {push:true,right:true}]) {
        const ski = createSkiRun();
        ski.begin(index, midway);
        let {x, along} = ski.state;
        let height = terrainHeight(x, along);
        for (let i = 0; i < 12000 && ski.state.running; i++) {
          ski.advance(1/60, input);
          const next = ski.state;
          const nextHeight = terrainHeight(next.x, next.along);
          const step = Math.hypot(next.x - x, next.along - along);
          const rise = Math.abs(nextHeight - height);
          assert.ok(rise <= .12 && (step < .001 || Math.atan2(rise, step) <= Math.PI / 6));
          ({x, along} = next);
          height = nextHeight;
        }
        assert.equal(ski.state.arrived, true);
      }
    });
  }
}

test('advanced skiers reach the base on the shared intermediate trail', () => {
  const [ , intermediate, advanced] = courses;
  const join = intermediate.points[advanced.joins.point];
  const start = intermediate.samples.findIndex(([x, along]) => x === join[0] && along === join[1]);
  assert.deepEqual(advanced.route.slice(advanced.samples.length - 1), intermediate.route.slice(start));
});

test('all lifts gain mainline clearance while retaining station boarding and unloading heights', () => {
  for (const [quad, upperPair] of [[false, false], [true, false], [false, true]]) {
    const lift = createLiftOperations(quad, upperPair);
    const { boarding, unloading, cableHeight, start, baseTurn, chairDrop } = lift.config;
    for (const station of [boarding, unloading]) {
      assert.equal(lift.ropeYAt(station), lift.trackGround(station) + cableHeight);
    }
    const midpoint = (boarding + unloading) / 2;
    const supports = [start, ...lift.config.towerPositions, lift.config.end];
    for (let i = 1; i < supports.length; i++) {
      const a = supports[i - 1], b = supports[i], mid = (a + b) / 2;
      const chord = (lift.ropeYAt(a) + lift.ropeYAt(b)) / 2;
      assert.ok(lift.ropeYAt(mid) <= chord + 1e-9);
      assert.ok(chord - lift.ropeYAt(mid) <= .45 + 1e-9);
      assert.ok(Math.abs(lift.lineX(mid) - (lift.lineX(a) + lift.lineX(b)) / 2) < 1e-9);
    }
    const point = { set(x, y, z) { Object.assign(this, { x, y, z }); } };
    for (const distance of [midpoint - start, baseTurn - (midpoint - start)]) {
      lift.liftPose(distance, point);
      assert.ok(Math.abs(point.y - lift.ropeYAt(midpoint)) < 1e-9);
      assert.ok(point.y - chairDrop - .65 - terrainHeight(point.x, midpoint) > 7);
    }
  }
});

test('every station exit runs forward to a level clearing', () => {
  for (const [quad, upperPair] of [[false, false], [true, false], [false, true]]) {
    const { upper, summit } = createLiftOperations(quad, upperPair).config;
    const start = liftExitPose(upper, summit, 0);
    const end = liftExitPose(upper, summit, exitRunLength);
    assert.ok(end.y < start.y && start.y - end.y < 1);
    assert.ok(end.along - start.along >= 18 && end.x - start.x < 2);
    for (let distance = 0; distance <= exitRunLength; distance += .25) {
      const point = liftExitPose(upper, summit, distance);
      assert.ok(Math.abs(terrainHeight(point.x, point.along) - point.y) < 1e-8);
    }
    for (const side of [-5, 0, 5]) {
      assert.ok(Math.abs(terrainHeight(end.x + side, end.along + 4) - end.y) < 1e-8);
    }
  }
});

test('skiers in every seat clear the arriving chair before standing and stay ahead', () => {
  for (const [quad, upperPair] of [[false, false], [true, false], [false, true]]) {
    const lift = createLiftOperations(quad, upperPair);
    const { upper, summit, unloading, start, glideSeconds, stationSpeed } = lift.config;
    const chair = { set(x, y, z) { Object.assign(this, {x, y, z}); } };
    const seats = quad ? [-.96, -.32, .32, .96] : [-.375, .375];
    for (const seatX of seats) {
      let stoodAt;
      for (let i = 0; i <= 720; i++) {
        const elapsed = i * .01;
        const yaw = lift.liftPose(unloading - start + elapsed * stationSpeed, chair);
        const glide = liftExitProgress(elapsed, glideSeconds, quad);
        const point = liftExitPose(upper, summit, glide * exitRunLength);
        const x = point.x + seatX * (1 + 1.3 * Math.sin(glide * Math.PI));
        const clear = liftExitClearsCarrier(x, point.along, chair, yaw, quad);
        if (i === 0) assert.equal(clear, false);
        if (clear) stoodAt ??= elapsed;
        if (stoodAt !== undefined) assert.ok(clear);
      }
      assert.ok(stoodAt > 0 && stoodAt < .6);
    }
  }
});
