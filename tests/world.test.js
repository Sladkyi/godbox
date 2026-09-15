import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';

test('a seed reproduces terrain, settlers and buildings', () => {
  const a = new World({ seed: 808 }), b = new World({ seed: 808 });
  assert.equal(a.serialize(), b.serialize());
  assert.notDeepEqual(a.tiles, new World({ seed: 809 }).tiles);
  assert.ok(a.stats().population > 0);
  assert.ok(a.stats().land > 10 && a.stats().land < 80);
});

test('three settlers found a village, build houses and reproduce', () => {
  const world = new World({ preset: 'ocean', populate: false });
  world.paint('forest', 90, 60, 20);
  for (let i = 0; i < 3; i++) assert.ok(world.spawn('human', 90 + i, 60));
  for (let i = 0; i < 600; i++) world.tick(.1);
  assert.equal(world.villages.length, 1);
  assert.ok(world.stats().population > 3);
  assert.ok(world.buildings.some(b => b.type === 'house'));
  assert.ok(world.villages[0].food >= 0);
  assert.ok(world.villages[0].wood >= 0);
});

test('water destroys buildings and units on painted land, even while paused', () => {
  const world = new World();
  const b = world.buildings[0]; world.paint('water', b.x, b.y, 20);
  assert.ok(world.units.every(u => world.walkable(u.x, u.y)));
  assert.ok(world.buildings.every(b => world.walkable(b.x, b.y)));
  assert.equal(world.tiles[world.index(b.x, b.y)], TILE.WATER);
  assert.equal(world.paint('human', b.x, b.y), false);
});

test('fire spreads and rain extinguishes and regenerates ash', () => {
  const world = new World({ preset: 'ocean', populate: false });
  world.paint('forest', 80, 60, 10); world.paint('fire', 80, 60, 2);
  const initial = world.stats().burning;
  for (let i = 0; i < 20; i++) world.tick(.1);
  assert.ok(world.stats().burning >= initial);
  world.paint('rain', 80, 60, 15);
  assert.equal(world.stats().burning, 0);
  world.paint('meteor', 80, 60, 4);
  assert.equal(world.tile(80, 60), TILE.SHALLOW);
  assert.ok(world.tiles.includes(TILE.ASH));
  assert.ok(world.effects.some(e => e.kind === 'meteor' && e.total > 2));
  world.paint('rain', 80, 60, 15);
  assert.equal(world.tiles.includes(TILE.ASH), false);
  world.paint('lightning', 80, 60, 2);
  assert.ok(world.effects.some(e => e.kind === 'lightning' && e.total > 1.4));
});

test('a meteor names the stricken village in the chronicle', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS);
  const v = world.createVillage(20, 20);
  world.spawn('human', 20.5, 20.5, v.id);
  world.paint('meteor', 20, 20, 4);
  assert.ok(world.events.some(e => (e.type === 'disaster' || e.type === 'wrath') && e.message.includes(v.name)));
});

test('sheep flee wolves and wolves close in on sheep', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const sheep = world.spawn('sheep', 10.5, 10.5), wolf = world.spawn('wolf', 12.5, 10.5);
  world.humans.prepare();
  for (let i = 0; i < 6; i++) world.tick(.1);
  assert.equal(sheep.action, 'flee');
  assert.ok(sheep.x < 10.5);
  assert.ok(wolf.x < 12.5);
});

test('save restores a progressed world and deterministically continues the simulation', () => {
  const a = new World({ seed: 333 });
  for (let i = 0; i < 500; i++) a.tick(.1);
  const b = World.deserialize(a.serialize());
  assert.equal(b.serialize(), a.serialize());
  for (let i = 0; i < 100; i++) { a.tick(.1); b.tick(.1); }
  assert.equal(b.serialize(), a.serialize());
  assert.ok(Buffer.byteLength(a.serialize()) < 950000);
});

test('malformed saves are rejected before replacing the active world', () => {
  const valid = new World().serialize();
  for (const mutate of [d => { d.width = 99999; }, d => { d.tiles[0] = 42; }, d => { d.units[0].x = null; }, d => { d.villages[0].color = 'url(foo)'; }, d => { d.nextId = 1; }, d => { d.buildings[0].villageId = 9999; }]) {
    const d = JSON.parse(valid); mutate(d); assert.throws(() => World.deserialize(JSON.stringify(d)));
  }
  assert.throws(() => World.deserialize('invalid'));
});

test('long simulation respects entity cap and terrain boundaries', () => {
  const world = new World({ seed: 445 });
  for (let i = 0; i < 6000; i++) world.tick(.1);
  assert.ok(world.units.length <= 500);
  assert.ok(world.units.every(u => world.walkable(u.x, u.y) && Number.isFinite(u.hp)));
  assert.ok(world.villages.every(v => v.food >= 0 && v.wood >= 0));
  assert.ok(Buffer.byteLength(world.serialize()) < 950000);
});

test('houses sit on a spiral and never share a cell', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const v = world.createVillage(24, 24, true, 'human');
  assert.ok(v);
  for (let i = 0; i < 8; i++) assert.ok(world.addBuilding(v, 'house'));
  const cells = world.buildings.map(b => `${b.x},${b.y}`);
  assert.equal(new Set(cells).size, cells.length);
  for (let i = 0; i < world.buildings.length; i++) for (let j = i + 1; j < world.buildings.length; j++) {
    assert.ok(Math.hypot(world.buildings[i].x - world.buildings[j].x, world.buildings[i].y - world.buildings[j].y) >= 2.5);
  }
});

test('a crowd on one tile founds separate towns instead of stacking halls', () => {
  const world = new World({ width: 64, height: 64, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  for (let i = 0; i < 6; i++) { const u = world.spawn('human', 32.5, 32.5); assert.ok(u); u.hunger = 0; u.energy = 100; }
  for (let i = 0; i < 6; i++) { const u = world.spawn('ghoul', 32.5, 32.5); assert.ok(u); u.hunger = 0; u.energy = 100; }
  for (let i = 0; i < 40; i++) world.tick(.1);
  assert.equal(world.villages.length, 2);
  assert.ok(Math.hypot(world.villages[0].x - world.villages[1].x, world.villages[0].y - world.villages[1].y) >= 16);
  const halls = world.buildings.filter(b => b.type === 'hall');
  assert.equal(halls.length, 2);
  assert.ok(Math.hypot(halls[0].x - halls[1].x, halls[0].y - halls[1].y) >= 2);
  assert.equal(world.units.filter(u => u.kind === 'human' && u.villageId == null).length, 0);
  assert.equal(world.units.filter(u => u.kind === 'human' && u.villageId === world.villages[0].id).length, 6);
  assert.equal(world.units.filter(u => u.kind === 'human' && u.villageId === world.villages[1].id).length, 6);
  const inside = world.ownerAt(world.villages[0].x, world.villages[0].y);
  assert.equal(inside?.id, world.villages[0].id);
  assert.equal(world.ownerAt(2, 2), null);
});
