import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { compose } from '../src/chronicle.js';
import { miracleCost } from '../src/faith.js';

function plain() {
  const w = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  w.tiles.fill(TILE.GRASS); w.wood.fill(0); w.berries.fill(0); w.navRevision++; w.resourceRevision++;
  return w;
}
function comfortable(u) { u.hunger = 0; u.social = 0; u.energy = 100; u.decision = 0; u.traits = ['hardy', 'curious']; }

test('rain lingers as weather, puts out fire, and still blesses a hungry town', () => {
  const w = plain(), v = w.createVillage(20, 20);
  const u = w.spawn('human', 20.5, 20.5, v.id);
  v.leaderId = u.id; v.food = 2; v.population = 1;
  w.paint('forest', 22, 20, 2); w.paint('fire', 22, 20, 1);
  w.paint('rain', 20, 20, 6);
  assert.equal(w.stats().burning, 0);
  assert.ok(w.weather.some(field => field.kind === 'rain' && field.life > 8));
  assert.equal(v.faith, 'patron');
  assert.ok(v.food > 2);
});

test('a storm sends people under a roof and a blizzard freezes farms', () => {
  const w = plain(), v = w.createVillage(20, 20, true);
  const house = w.buildings.find(b => b.villageId === v.id && b.type === 'house');
  const farm = w.buildings.find(b => b.villageId === v.id && b.type === 'farm');
  const crop = farm.crop;
  const u = w.spawn('human', 22.5, 20.5, v.id);
  comfortable(u); u.homeId = house.id; u.job = 'forager';
  w.applyWeather('storm', 20, 20, 8);
  w.humans.prepare(); w.humans.choose(u);
  assert.equal(u.action, 'shelter');
  w.applyWeather('blizzard', 20, 20, 8);
  assert.ok(farm.crop < crop);
});

test('bloom fattens farms and berries, aurora grows a cult', () => {
  const w = plain(), v = w.createVillage(20, 20, true);
  const farm = w.buildings.find(b => b.type === 'farm');
  const before = farm.crop;
  w.berries[w.index(21, 20)] = 0;
  w.paint('bloom', 20, 20, 5);
  assert.ok(farm.crop > before);
  assert.ok(w.berries[w.index(21, 20)] > 0);
  w.paint('aurora', 20, 20, 5);
  assert.ok(v.cult >= 8);
  assert.ok(w.weather.some(field => field.kind === 'aurora'));
});

test('a well-fed town sends grain to a hungry neighbor', () => {
  const w = plain(), home = w.createVillage(12, 12, true), foreign = w.createVillage(28, 12, true);
  home.known = [foreign.id]; foreign.known = [home.id];
  home.food = 2; home.population = 4; foreign.food = 80; foreign.population = 4;
  w.spawn('human', 12.5, 12.5, home.id); w.spawn('human', 13.5, 12.5, home.id);
  w.updatePopulations();
  w.humans.prepare(); w.humans.tryRelief();
  assert.ok(home.food > 2);
  assert.ok(foreign.food < 80);
  assert.ok(w.events.some(e => e.type === 'relief' && e.message.includes(home.name)));
});

test('allied towns feast, and high trust binds two houses', () => {
  const w = plain(), a = w.createVillage(12, 12, true), b = w.createVillage(28, 12, true);
  a.known = [b.id]; b.known = [a.id]; a.food = 40; b.food = 40;
  a.allies = [b.id]; b.allies = [a.id];
  w.humans.prepare();
  assert.equal(w.humans.tryFestival(), true);
  assert.ok(w.events.some(e => e.type === 'festival'));

  const w2 = plain(), c = w2.createVillage(12, 28, true), d = w2.createVillage(28, 28, true);
  c.known = [d.id]; d.known = [c.id];
  c.ties = [{ id: d.id, debt: 0, grudge: 0, trust: 40, legend: '' }];
  d.ties = [{ id: c.id, debt: 0, grudge: 0, trust: 40, legend: '' }];
  w2.humans.prepare();
  assert.equal(w2.humans.tryMarriage(), true);
  assert.ok((c.allies ?? []).includes(d.id));
  assert.ok(w2.events.some(e => e.type === 'marriage'));
});

test('weather and diplomacy stories name the towns', () => {
  assert.ok(compose('weather', { omen: 'storm', town: 'Cedar Cape' }).includes('Cedar Cape'));
  assert.ok(compose('festival', { town: 'Moon Grove', other: 'Sunny Shore' }).includes('Moon Grove'));
  assert.ok(compose('relief', { town: 'North Wind', other: 'Free Island' }).includes('grain'));
  assert.ok(compose('trade', { town: 'Irondeep', other: 'Sunny Shore', good: 'iron ore' }).toLowerCase().includes('cart'));
  assert.ok(compose('market', { town: 'Moon Grove' }).includes('market'));
  assert.ok(miracleCost('storm', 3) > miracleCost('rain', 3));
  assert.ok(miracleCost('bloom', 3) > 0);
  assert.equal(miracleCost('trade', 1), miracleCost('trade', 10));
});

test('dwarves wait out rain under a roof instead of dancing', () => {
  const w = plain(), v = w.createVillage(20, 20, true, 'dwarf');
  const house = w.buildings.find(b => b.villageId === v.id && b.type === 'house');
  const u = w.spawn('dwarf', 22.5, 20.5, v.id);
  comfortable(u); u.homeId = house.id; u.job = 'miner';
  w.applyWeather('rain', 20, 20, 8);
  w.humans.prepare(); w.humans.choose(u);
  assert.equal(u.action, 'shelter');
});
