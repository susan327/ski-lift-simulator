import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiftOperations } from './lift-operation.js';

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
