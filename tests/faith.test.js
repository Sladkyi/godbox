import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { miracleCost, canCast, payForCast, faithCapacity, faithIncome, faithPerYear, congregation, refillFaith, FAITH_FLOOR } from '../src/faith.js';

function grassWorld() {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS);
  world.navRevision++;
  return world;
}

test('a new world opens with a full bar and a slow trickle of faith', () => {
  const world = new World({ seed: 404 });
  assert.equal(world.god.limited, true);
  assert.equal(world.god.faith, world.god.capacity);
  assert.ok(world.god.faith >= FAITH_FLOOR);
  assert.ok(faithIncome(world) > 0);
});

test('a wide brush and a heavy miracle cost more than a small one', () => {
  assert.ok(miracleCost('grass', 10) > miracleCost('grass', 1));
  assert.ok(miracleCost('meteor') > miracleCost('rain'));
  assert.ok(miracleCost('meteor') > miracleCost('grass', 10));
  assert.equal(miracleCost('meteor', 1), miracleCost('meteor', 10), 'stamps ignore brush size');
  assert.equal(miracleCost('inspect'), 0);
  assert.equal(miracleCost('dwarf'), miracleCost('human'));
  assert.equal(miracleCost('trade', 1), miracleCost('trade', 8), 'market is a stamp');
  assert.ok(miracleCost('trade') > 0);
});

test('casting spends faith and an empty god cannot cast at all', () => {
  const world = grassWorld();
  const before = world.god.faith;
  const spent = payForCast(world, 'meteor');
  assert.equal(spent, miracleCost('meteor'));
  assert.equal(world.god.faith, before - spent);
  world.god.faith = 1;
  assert.equal(canCast(world, 'meteor'), false);
  assert.equal(canCast(world, 'grass', 1), true, 'the smallest brush still works on the last drop');
  world.god.faith = 0;
  assert.equal(canCast(world, 'grass', 1), false);
  payForCast(world, 'meteor');
  assert.equal(world.god.faith, 0, 'faith never goes negative');
});

test('free creation never charges and keeps the bar full', () => {
  const world = grassWorld();
  world.god.limited = false;
  refillFaith(world);
  const before = world.god.faith;
  assert.equal(canCast(world, 'meteor'), true);
  payForCast(world, 'meteor');
  assert.equal(world.god.faith, before);
});

test('a town that names you patron feeds far more faith than one that fears you', () => {
  const world = grassWorld();
  const town = world.createVillage(20, 20);
  for (let i = 0; i < 6; i++) world.spawn('human', 20.5 + i, 20.5, town.id);
  world.updatePopulations();
  const quiet = faithIncome(world);
  town.faith = 'patron'; town.cult = 40;
  const devoted = faithIncome(world);
  const devotedRoom = faithCapacity(world);
  town.faith = 'fear'; town.cult = 0;
  const afraid = faithIncome(world);
  assert.ok(devoted > quiet && quiet > afraid);
  assert.ok(afraid < 0 + faithIncome({ villages: [] }), 'fear drags income below an empty world');
  assert.ok(devotedRoom > faithCapacity(world), 'devotion also raises the ceiling');
  assert.equal(congregation(world)[0].stance, 'fearful');
});

test('faith refills as the world lives and stops at the ceiling', () => {
  const world = grassWorld();
  const town = world.createVillage(20, 20);
  for (let i = 0; i < 4; i++) world.spawn('human', 20.5 + i, 20.5, town.id);
  world.updatePopulations();
  world.god.faith = 5;
  for (let i = 0; i < 60; i++) world.tick(.1);
  assert.ok(world.god.faith > 5);
  assert.ok(world.god.faith <= world.god.capacity);
  world.god.faith = world.god.capacity;
  for (let i = 0; i < 60; i++) world.tick(.1);
  assert.ok(world.god.faith <= world.god.capacity);
  assert.ok(faithPerYear(world) > faithIncome(world));
});

test('spent faith survives a save, and a world from before faith opens with a full bar', () => {
  const world = new World({ seed: 77 });
  world.god.faith = 12; world.god.limited = true;
  const restored = World.deserialize(world.serialize());
  assert.equal(Math.round(restored.god.faith), 12);
  assert.equal(restored.god.limited, true);

  const old = JSON.parse(world.serialize());
  old.version = 3; delete old.god.faith; delete old.god.limited;
  const migrated = World.deserialize(JSON.stringify(old));
  assert.equal(migrated.god.faith, migrated.god.capacity);
  assert.equal(migrated.god.limited, true);
  assert.equal(migrated.deposits.length, world.deposits.length, 'version 3 saves still carry deposits');
});
