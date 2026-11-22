import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiftOperations } from './lift-operation.js';
import { createRideSoundEvents } from './ride-sound-events.js';

test('quad summit announcements stay separate at 4x and after switching from 1x during the preview', () => {
  const wav = readFileSync(new URL('./announcements/02-approaching.wav', import.meta.url));
  const fmt = wav.indexOf('fmt ');
  const data = wav.indexOf('data');
  assert.ok(fmt >= 0 && data >= 0);
  const duration = wav.readUInt32LE(data + 4) / wav.readUInt32LE(fmt + 16);
  for (const initialRate of [1, 4]) {
    const lift = createLiftOperations(true);
    const { announcementPoints, towerPositions } = lift.config;
    assert.equal(announcementPoints.approaching, towerPositions.at(-3));
    lift.begin();
    let previewAt, unloadAt;
    for (let tick = 1; tick <= 6000 && unloadAt === undefined; tick++) {
      const before = lift.state.along;
      const realTime = tick * .05;
      lift.advance(.05 * (realTime >= previewAt + .5 ? 4 : initialRate));
      if (lift.state.phase !== 'riding') continue;
      if (before < announcementPoints.approaching && lift.state.along >= announcementPoints.approaching) previewAt = realTime;
      if (before < announcementPoints.unloading && lift.state.along >= announcementPoints.unloading) unloadAt = realTime;
    }
    assert.ok(unloadAt - previewAt >= duration);
  }
});

test('quad selects only one repeating station voice and silences it when the map opens', () => {
  const lift = createLiftOperations(true);
  const calls = [];
  const sound = createRideSoundEvents(lift, {
    setStationAnnouncement: name => calls.push(name),
    towerPass() {},
    boardingChime() {},
  });
  const { approaching, unloading } = lift.config.announcementPoints;
  const update = (along, state = {}) => sound.update({
    phase: 'riding', along, queue: { green: false }, staffArea: '', quiet: false, skiing: false, ...state,
  });
  update(approaching - 70);
  update(approaching - 30);
  update(approaching);
  update(unloading - 35);
  update(unloading, { phase: 'unloading' });
  update(unloading, { phase: 'arrived' });
  update(unloading, { phase: 'arrived', quiet: true });
  update(0, { phase: 'waiting', staffArea: 'unloading' });
  assert.deepEqual(calls, [null, 'approaching', 'approaching', 'unloading', 'unloading', 'unloading', null, 'unloading']);
});
