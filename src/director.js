import { compose, leaderName } from './chronicle.js';

function hungryVillage(world) {
  return world.villages.find(v => v.population >= 3 && v.food < v.population * 2) ?? null;
}

function strongest(world) {
  return [...world.villages].sort((a, b) => b.population - a.population)[0] ?? null;
}

function weakest(world) {
  return [...world.villages].filter(v => v.population > 0).sort((a, b) => a.population - b.population)[0] ?? null;
}

function focusPair(world) {
  for (const v of world.villages) {
    const id = (v.known ?? [])[0];
    const other = world.villages.find(x => x.id === id);
    if (other) return [v, other];
  }
  return [world.villages[0] ?? null, world.villages[1] ?? null];
}

function calm(world) {
  const s = world.stats();
  const wars = world.villages.some(v => (v.wars ?? []).length);
  return s.burning < 8 && !wars && !hungryVillage(world) && world.units.filter(u => u.kind === 'wolf').length < 3;
}

function dominated(world) {
  const top = strongest(world), low = weakest(world);
  if (!top || !low || top.id === low.id || top.population < 8) return null;
  if (top.population >= low.population * 2 + 4) return { top, low };
  return null;
}

function omen(world, kind, village, other = null) {
  world.story.pending = { kind, villageId: village?.id ?? null, otherId: other?.id ?? null, year: world.year + (kind === 'pray' ? 1 : 2) };
  world.story.cool = 36;
  world.story.lastYear = world.year;
  if (village) village.omen = kind;
  world.tell('omen', { omen: kind, town: village?.name, other: other?.name, leader: leaderName(world, village), who: leaderName(world, village) });
}

function spawnWolves(world, village) {
  const origin = village ?? { x: world.width / 2, y: world.height / 2 };
  let n = 0;
  for (let i = 0; i < 14 && n < 3; i++) {
    const a = world.rng.next() * Math.PI * 2, r = 9 + world.rng.next() * 10;
    const land = world.findLand(origin.x + Math.cos(a) * r, origin.y + Math.sin(a) * r, 6);
    if (land && world.spawn('wolf', land.x, land.y)) n++;
  }
  if (n) world.tell('wolves', { town: village?.name ?? 'the open land' });
}

function drought(world, village, amount = 5) {
  if (!village) return;
  for (const b of world.buildings) if (b.villageId === village.id && b.type === 'farm') b.crop = Math.max(0, (b.crop ?? 0) - amount);
  village.food = Math.max(0, village.food - 6);
  world.tell('drought', { town: village.name });
}

function firePending(world, pending) {
  world.story.pending = null;
  const village = world.villages.find(v => v.id === pending.villageId) ?? null;
  const other = world.villages.find(v => v.id === pending.otherId) ?? null;
  if (village) village.omen = null;
  if (pending.kind === 'wolves') spawnWolves(world, village);
  else if (pending.kind === 'drought' || pending.kind === 'pray') drought(world, village, pending.kind === 'pray' ? 3 : 6);
  else if (pending.kind === 'meteor') {
    const x = Math.floor((village?.x ?? world.width / 2) + (village ? 10 : 0));
    const y = Math.floor(village?.y ?? world.height / 2);
    world.applyDisaster('meteor', x, y, 4, 'director');
  } else if (pending.kind === 'gift' && village) {
    village.food += 14;
    village.iron = (village.iron ?? 0) + 3;
    world.tell('gift', { town: village.name });
  } else if (pending.kind === 'escalate' && village && other) {
    world.humans.heatUp(village, other, 14);
    world.humans.heatUp(other, village, 10);
  }
}

export function tickDirector(world, dt) {
  const story = world.story;
  story.cool = Math.max(0, (story.cool ?? 0) - dt);
  world.god.idle = Math.min(200, (world.god.idle ?? 0) + dt);
  if (story.pending && world.year >= story.pending.year) firePending(world, story.pending);
  if (story.cool > 0 || story.pending || world.year < 8 || world.villages.length < 1) return;
  const need = hungryVillage(world);
  const hold = dominated(world);
  const [a, b] = focusPair(world);
  if (need && world.god.idle > 48) omen(world, 'pray', need);
  else if (hold) omen(world, 'gift', hold.low);
  else if (calm(world) && world.year >= (story.lastYear ?? 0) + 6) {
    const focus = a ?? need ?? strongest(world);
    const pick = world.units.some(u => u.kind === 'sheep') ? 'wolves' : world.rng.next() < .55 ? 'drought' : 'meteor';
    omen(world, pick, focus);
  } else if ((world.god.presence ?? 0) > 14 && a && b) omen(world, 'escalate', a, b);
}

export function directorCaption(world) {
  const pending = world.story?.pending;
  if (!pending) return '';
  const village = world.villages.find(v => v.id === pending.villageId);
  return compose('omen', { omen: pending.kind, town: village?.name, year: world.year, leader: leaderName(world, village) });
}
