import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { compose, bumpTie } from '../src/chronicle.js';
import { tickDirector } from '../src/director.js';
import { moodOf } from '../src/sound.js';

function plain() {
  const w = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  w.tiles.fill(TILE.GRASS); w.wood.fill(0); w.berries.fill(0); w.navRevision++; w.resourceRevision++;
  return w;
}

test('chronicle stories name people and towns, not just facts', () => {
  const text = compose('scout', { year: 12, who: 'Finn', home: 'Cedar Cape', there: 'Moon Grove' });
  assert.ok(text.includes('Finn') && text.includes('Cedar Cape') && text.includes('Moon Grove'));
  assert.ok(text.length > 80);
  assert.ok(!text.startsWith('Finn discovered'));
});

test('rain on a hungry town raises a cult and writes a patron story', () => {
  const w = plain(), v = w.createVillage(20, 20);
  const u = w.spawn('human', 20.5, 20.5, v.id);
  v.leaderId = u.id; v.food = 2; v.population = 1;
  w.paint('rain', 20, 20, 3);
  assert.ok(v.cult >= 14);
  assert.equal(v.faith, 'patron');
  assert.ok(v.food > 2);
  assert.ok(w.events.some(e => e.type === 'cult' && e.message.includes(v.name) && e.message.includes('patron')));
  assert.ok(w.god.mercy > 0);
});

test('a raid becomes a remembered debt, not a one-line theft', () => {
  const w = plain(), home = w.createVillage(12, 12, true, 'ghoul'), foreign = w.createVillage(22, 12, true, 'human');
  home.food = 0; foreign.food = 40;
  const g = w.spawn('ghoul', 12.5, 12.5, home.id);
  g.hunger = 70; g.energy = 100; g.social = 0; g.decision = 0; g.inventory.food = 0; g.traits = ['hardy', 'curious'];
  w.humans.prepare(); w.humans.choose(g);
  assert.equal(g.action, 'steal');
  for (let i = 0; i < 120 && g.task; i++) { w.humans.prepare(); w.humans.tick(g, .1); }
  const debt = home.ties.find(t => t.id === foreign.id);
  assert.ok(debt?.debt > 0);
  assert.ok(debt.legend.includes('Ash') || debt.legend.includes(home.name) || debt.legend.includes('debt'));
  assert.ok(w.events.some(e => (e.type === 'raid' || e.type === 'spy') && e.message.includes(foreign.name)));
  const copy = World.deserialize(w.serialize());
  assert.ok(copy.villages.find(x => x.id === home.id).ties.some(t => t.id === foreign.id && t.debt > 0));
});

test('the director foreshadows hunger before it strikes', () => {
  const w = plain(), v = w.createVillage(20, 20);
  for (let i = 0; i < 3; i++) w.spawn('human', 20.5, 20.5, v.id);
  w.updatePopulations(); v.food = 0; w.god.idle = 60; w.story.cool = 0; w.time = 48;
  tickDirector(w, 1);
  assert.equal(w.story.pending?.kind, 'pray');
  assert.equal(v.omen, 'pray');
  assert.ok(w.events.some(e => e.type === 'omen' && e.message.includes(v.name)));
});

test('long chronicle lines survive a save round-trip', () => {
  const w = plain();
  const message = compose('scout', { year: 12, who: 'Finn', home: 'Cedar Cape', there: 'Moon Grove' });
  w.log(message, 'scout');
  assert.ok(message.length > 120 && message.length <= 400);
  assert.doesNotThrow(() => World.deserialize(w.serialize()));
});

test('ambient mood follows fire and war', () => {
  const w = plain();
  w.createVillage(10, 10); w.createVillage(30, 10);
  assert.equal(moodOf(w), 'calm');
  w.paint('fire', 12, 12, 4);
  assert.equal(moodOf(w), 'fire');
});

test('ties bump and clamp', () => {
  const a = { id: 1, ties: [] }, b = { id: 2 };
  bumpTie(a, b, { debt: 8, legend: 'the debt of Ash Ridge' });
  bumpTie(a, b, { debt: 200 });
  assert.equal(a.ties[0].debt, 100);
  assert.equal(a.ties[0].legend, 'the debt of Ash Ridge');
});
