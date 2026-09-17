import test from 'node:test';
import assert from 'node:assert/strict';
import { settingOf, structureName, SETTINGS, EPOCHS, RACES } from '../src/civilizations.js';
import { TILE } from '../src/world.js';

test('settingOf ranks coast, frost, highland, waste, sand, forest, then meadow', () => {
  const mix = (extra, fill = TILE.GRASS, n = 25) => {
    const tiles = Array(n).fill(fill);
    extra.forEach((t, i) => { tiles[i] = t; });
    return settingOf(tiles);
  };
  assert.equal(mix([TILE.WATER, TILE.SHALLOW]), 'coast');
  assert.equal(mix([TILE.SNOW]), 'frost');
  assert.equal(mix([TILE.MOUNTAIN]), 'highland');
  assert.equal(mix([TILE.ASH, TILE.ASH]), 'waste');
  assert.equal(mix([TILE.SAND, TILE.SAND, TILE.SAND]), 'sand');
  assert.equal(mix([TILE.FOREST, TILE.FOREST]), 'forest');
  assert.equal(settingOf(Array(25).fill(TILE.GRASS)), 'meadow');
  assert.equal(mix([TILE.WATER, TILE.SHALLOW, TILE.FOREST, TILE.FOREST]), 'coast');
});

test('structure names change with race, epoch and ground', () => {
  const camp = { population: 0 };
  assert.equal(structureName({ type: 'house', race: 'human', material: 'wood', setting: 'meadow' }, camp), 'Hut · Wood');
  assert.equal(structureName({ type: 'house', race: 'dwarf', material: 'stone', setting: 'highland' }, camp), 'Cliff delve · Stone');
  assert.equal(structureName({ type: 'hall', race: 'dwarf', material: 'iron', setting: 'meadow' }, { population: 80 }), 'City keep · Iron');
  assert.equal(structureName({ type: 'house', race: 'ghoul', material: 'iron', setting: 'highland' }, { population: 80 }), 'Cliff keep · Iron');
  assert.equal(structureName({ type: 'farm', race: 'mycelite', setting: 'forest' }, camp), 'Spore grove');
  assert.equal(structureName({ type: 'pen', race: 'alien', material: 'wood', setting: 'coast' }, camp), 'Tide bay · Wood');
  assert.equal(structureName({ type: 'hall', race: 'mycelite', material: 'mycelium', setting: 'meadow' }, camp), 'Spore hall · Mycelium');
});

test('every race, epoch and setting has house, hall, farm and pen names', () => {
  for (const epoch of EPOCHS) for (const race of Object.keys(RACES)) for (const setting of SETTINGS) {
    const village = { population: epoch.min };
    for (const type of ['house', 'hall', 'farm', 'pen']) {
      const name = structureName({ type, race, material: 'wood', setting }, village);
      assert.equal(typeof name, 'string');
      assert.ok(name.length > 2);
      assert.equal(name.includes('undefined'), false);
    }
  }
});
