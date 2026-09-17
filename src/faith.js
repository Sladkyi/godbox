// Faith is the player's own resource. Towns that call you patron feed it, towns that
// fear you starve it, and every miracle spends it. The simulation never pays: only the
// player does, so the director can still strike for free when the world resists.
export const YEAR_SECONDS = 6;
export const FAITH_FLOOR = 80;
export const FAITH_CEILING = 600;

const BASE_COST = {
  grass: 2, sand: 2, snow: 3, forest: 3, water: 4, mountain: 4,
  clay: 5, mycelium: 5, fish: 5, stone: 6, iron: 7, crystal: 9,
  sheep: 5, cow: 6, wolf: 7, human: 10, dwarf: 10, ghoul: 10, alien: 10, mycelite: 10,
  rain: 12, storm: 18, blizzard: 16, aurora: 14, bloom: 10, trade: 14, fire: 16, lightning: 22, meteor: 38, erase: 4,
};
// Tools the brush spreads over an area cost more with a wider brush. Stamps are flat.
const AREA_TOOLS = new Set(['grass', 'sand', 'snow', 'forest', 'water', 'mountain', 'rain', 'storm', 'blizzard', 'aurora', 'bloom', 'fire', 'erase']);

export const MERCY_TOOLS = new Set(['rain', 'aurora', 'bloom', 'trade']);
export const WRATH_TOOLS = new Set(['fire', 'lightning', 'meteor', 'storm', 'blizzard']);

export function miracleCost(tool, radius = 3) {
  const base = BASE_COST[tool];
  if (!base) return 0;
  if (!AREA_TOOLS.has(tool)) return base;
  return Math.max(1, Math.round(base * (.55 + Math.max(1, radius) * .15)));
}

export function stanceOf(village) {
  return village?.faith === 'patron' ? 'devoted' : village?.faith === 'fear' ? 'fearful' : 'quiet';
}

// Faith a single town sends per simulated second.
export function villageFlow(village) {
  if (!village || village.population <= 0) return 0;
  const mood = village.faith === 'patron' ? .055 : village.faith === 'fear' ? -.012 : .022;
  return village.population * mood + (village.cult ?? 0) * .0016;
}

export function faithCapacity(world) {
  let worship = 0;
  for (const v of world.villages ?? []) {
    if (v.population <= 0) continue;
    const weight = v.faith === 'patron' ? 1.6 : v.faith === 'fear' ? .5 : 1;
    worship += v.population * weight + (v.cult ?? 0) * .25;
  }
  return Math.round(Math.min(FAITH_CEILING, FAITH_FLOOR + worship * 1.1));
}

export function faithIncome(world) {
  let flow = .55;
  for (const v of world.villages ?? []) flow += villageFlow(v);
  return flow;
}

export function faithPerYear(world) { return faithIncome(world) * YEAR_SECONDS; }

// Every believing town, richest first, with what it is worth per year.
export function congregation(world) {
  return (world.villages ?? [])
    .filter(v => v.population > 0)
    .map(v => ({ id: v.id, name: v.name, color: v.color, population: v.population, cult: Math.round(v.cult ?? 0), stance: stanceOf(v), perYear: villageFlow(v) * YEAR_SECONDS }))
    .sort((a, b) => b.perYear - a.perYear);
}

export function createGod() {
  return { mercy: 0, wrath: 0, presence: 0, idle: 0, faith: FAITH_FLOOR, limited: true, capacity: FAITH_FLOOR, income: .55 };
}

// Old saves have no faith at all: they open with a full bar instead of an empty one.
export function restoreGod(world, saved) {
  const god = createGod();
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  if (saved && finite(saved.mercy) && finite(saved.wrath) && finite(saved.presence)) {
    god.mercy = clamp(saved.mercy, 0, 100);
    god.wrath = clamp(saved.wrath, 0, 100);
    god.presence = clamp(saved.presence, 0, 100);
    god.idle = finite(saved.idle) ? clamp(saved.idle, 0, 200) : 0;
  }
  god.limited = saved?.limited !== false;
  god.capacity = faithCapacity(world);
  god.income = faithIncome(world);
  god.faith = finite(saved?.faith) ? clamp(saved.faith, 0, god.capacity) : god.capacity;
  return god;
}

export function refillFaith(world) {
  world.god.capacity = faithCapacity(world);
  world.god.income = faithIncome(world);
  world.god.faith = world.god.capacity;
}

export function tickFaith(world, dt) {
  const god = world.god;
  god.capacity = faithCapacity(world);
  god.income = faithIncome(world);
  if (!god.limited) { god.faith = god.capacity; return; }
  god.faith = Math.max(0, Math.min(god.capacity, (god.faith ?? god.capacity) + god.income * dt));
}

export function canCast(world, tool, radius = 3) {
  if (!world.god?.limited) return true;
  return (world.god.faith ?? 0) >= miracleCost(tool, radius);
}

export function payForCast(world, tool, radius = 3) {
  const cost = miracleCost(tool, radius);
  if (!world.god?.limited) return cost;
  world.god.faith = Math.max(0, (world.god.faith ?? 0) - cost);
  return cost;
}
