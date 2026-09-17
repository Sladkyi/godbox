import test from 'node:test';
import assert from 'node:assert/strict';
import { growT, growDelay, growOvershoot, growWait, GROW_LAND } from '../src/growth.js';
import { World, TILE } from '../src/world.js';
import { buildTerrainData, tileHeight, typeHeight } from '../src/terrain3d.js';

test('grow easing stays at 0 during delay, then reaches 1', () => {
  assert.equal(growT(0, .1, .5), 0);
  assert.equal(growT(.1, .1, .5), 0);
  assert.ok(growT(.35, .1, .5) > .2 && growT(.35, .1, .5) < .9);
  assert.equal(growT(.7, .1, .5), 1);
  assert.ok(growOvershoot(.4) > growT(.4, 0, 1));
  assert.equal(growOvershoot(1), 1);
  assert.ok(growWait(0, 3, .1) > GROW_LAND);
  assert.ok(growWait(5, 2, 0) >= GROW_LAND);
  assert.ok(growWait(5, 2, 0) < growWait(0, 3, 0));
  assert.ok(growDelay(3) >= 0 && growDelay(3) < .4);
});

test('terrain mesh can be built from a delayed tile mask so new land can rise in', () => {
  const world = new World({ width: 24, height: 16, preset: 'ocean', populate: false });
  world.paint('grass', 12, 8, 2);
  const mask = new Uint8Array(world.tiles.length);
  const full = buildTerrainData(world);
  const hidden = buildTerrainData(world, mask);
  assert.ok(full.positions.length > 0);
  assert.equal(hidden.positions.length, 0);
  assert.ok(tileHeight(world, 12, 8) > .25);
  assert.ok(tileHeight(world, 12, 8, mask) < 0);
  mask[world.index(12, 8)] = TILE.GRASS;
  assert.ok(buildTerrainData(world, mask).positions.length > 0);
  assert.ok(typeHeight(world, 12, 8, TILE.MOUNTAIN) > typeHeight(world, 12, 8, TILE.SAND));
});
