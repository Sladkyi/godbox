import { HumanSystem, initializeHuman, validateHuman } from './humans.js';
import { RACES, STOCKS, MATERIALS, DEPOSIT_KINDS, emptyStock, raceOf, epochOf, UNIT_LIMIT, BUILDING_LIMIT, ANIMAL_KINDS, BUILDING_TYPES, isLivestock, settingOf, SETTINGS } from './civilizations.js';
import { addDeposit, seedDeposits, reconcileDeposits } from './deposits.js';
import { compose } from './chronicle.js';
import { tickDirector } from './director.js';
import { createGod, restoreGod, refillFaith, tickFaith } from './faith.js';
export const TILE = Object.freeze({ WATER: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, MOUNTAIN: 5, SNOW: 6, ASH: 7 });
export { UNIT_LIMIT, BUILDING_LIMIT };
export const TILE_NAMES = ['Ocean', 'Shallows', 'Sand', 'Meadow', 'Forest', 'Mountains', 'Snow', 'Ash'];
export const VILLAGE_COLORS = ['#ffc77f', '#bca4ff', '#78d7c2', '#f693a3', '#99c5ff', '#e7dc85'];
export const MIN_VILLAGE_GAP = 16;
const NAMES = ['Sunny Shore', 'Moon Grove', 'Quiet Valley', 'Cedar Cape', 'New Dawn', 'Star Hill', 'Free Island', 'North Wind'];
const RACE_TOWNS = { dwarf: ['Irondeep', 'Stonehall', 'Anvil Gate', 'Rivenhold', 'Emberdelve', 'Goldvein', 'Grimforge', 'Karst'] };
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function ringCells(cx, cy, r) {
  if (r === 0) return [[cx, cy]];
  const cells = [];
  for (let dx = -r; dx <= r; dx++) { cells.push([cx + dx, cy - r]); cells.push([cx + dx, cy + r]); }
  for (let dy = -r + 1; dy <= r - 1; dy++) { cells.push([cx - r, cy + dy]); cells.push([cx + r, cy + dy]); }
  return cells;
}

export class Random {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
}

function noise(x, y, seed) {
  const hash = (a, b) => {
    let v = Math.imul(a + seed, 374761393) + Math.imul(b, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  let tx = x - ix, ty = y - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export class World {
  constructor({ width = 192, height = 128, seed = 71283, preset = 'archipelago', populate = true } = {}) {
    this.width = width; this.height = height; this.seed = seed >>> 0; this.preset = preset;
    this.rng = new Random(this.seed); this.time = 0; this.nextId = 1;
    this.tiles = new Uint8Array(width * height);
    this.variation = new Uint8Array(width * height);
    this.fire = new Float32Array(width * height);
    this.wood = new Uint8Array(width * height); this.berries = new Uint8Array(width * height);
    this.units = []; this.villages = []; this.buildings = []; this.effects = []; this.events = [];this.deposits=[];this.depositRevision=0;this.weather=[];this.caravans=[];
    this.revision = 0; this.ecoTime = 0; this.settlementTime = 0; this.effectSeq = 1;
    this.navRevision = 0; this.resourceRevision = 0; this.humans = new HumanSystem(this);
    this.god = createGod();
    this.story = { cool: 60, pending: null, lastYear: 0, beat: 0 };
    this.generate();
    for (let i=0;i<this.tiles.length;i++) this.resetResource(i);
    this.tell('world');
    if (populate && preset !== 'ocean') this.seedLife();
    seedDeposits(this);
    refillFaith(this);
  }
  get year() { return 1 + Math.floor(this.time / 6); }
  index(x, y) { return Math.floor(y) * this.width + Math.floor(x); }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  tile(x, y) { return this.inBounds(x, y) ? this.tiles[this.index(x, y)] : TILE.WATER; }
  walkable(x, y) { const t = this.tile(x, y); return this.inBounds(x, y) && t >= TILE.SAND && t !== TILE.MOUNTAIN; }
  settingAt(x, y) {
    const nearby = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) nearby.push(this.tile(x + dx, y + dy));
    return settingOf(nearby);
  }
  log(message, type = 'life') { this.events.unshift({ message, type, year: this.year }); this.events.length = Math.min(30, this.events.length); }
  tell(type, facts = {}) { this.log(compose(type, { year: this.year, ...facts }).slice(0, 400), type); }
  emit(kind,x,y,extra={},life=.8) {this.effects.push({id:this.effectSeq++,kind,x,y,radius:1,life,total:life,...extra});if(this.effects.length>120)this.effects.shift();}
  spawnCaravan(from, to, extra = {}) {
    if (!from || !to) return null;
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const life = Math.max(4, Math.min(14, span / 3.2));
    const cart = { id: this.effectSeq++, fromId: from.id, toId: to.id, ax: from.x, ay: from.y, bx: to.x, by: to.y, x: from.x, y: from.y, progress: 0, life, total: life, good: extra.good ?? 'wood', race: extra.race ?? from.race, blessed: !!extra.blessed };
    this.caravans.push(cart);
    if (this.caravans.length > 16) this.caravans.shift();
    this.emit('trade', (from.x + to.x) / 2, (from.y + to.y) / 2, { good: cart.good, race: cart.race, blessed: cart.blessed }, 1.35);
    return cart;
  }
  tickCaravans(dt) {
    for (const cart of this.caravans) {
      cart.life -= dt;
      cart.progress = Math.min(1, 1 - cart.life / Math.max(.01, cart.total));
      const t = cart.progress;
      cart.x = cart.ax + (cart.bx - cart.ax) * t;
      cart.y = cart.ay + (cart.by - cart.ay) * t;
    }
    this.caravans = this.caravans.filter(cart => cart.life > 0);
  }
  claimRadius(v) {
    const n = this.buildings.filter(b => b.villageId === v.id).length;
    const reach = Math.max(this.width, this.height) * .48;
    return Math.min(reach, 6 + n * .9 + (v.population || 0) * .08);
  }
  ownerAt(x, y) {
    let best = null, bestD = Infinity;
    for (const v of this.villages) {
      const d = distance(v, { x, y });
      if (d > this.claimRadius(v) || d >= bestD) continue;
      best = v; bestD = d;
    }
    return best;
  }
  isFreeVillageCenter(x, y) {
    if (!this.walkable(x, y) || this.tile(x, y) === TILE.SNOW || this.tile(x, y) === TILE.ASH) return false;
    return this.villages.every(v => distance(v, { x, y }) >= MIN_VILLAGE_GAP);
  }
  findVillageSite(x, y) {
    const origin = { x, y };
    const consider = land => land && this.isFreeVillageCenter(land.x, land.y) && this.humans.navigation.sameRegion(origin, land);
    const here = this.findLand(x, y, 3);
    if (consider(here)) return here;
    for (let r = 4; r <= 36; r += 2) for (let n = 0; n < 12; n++) {
      const a = (n / 12) * Math.PI * 2;
      const land = this.findLand(x + Math.cos(a) * r, y + Math.sin(a) * r, 3);
      if (consider(land)) return land;
    }
    return null;
  }
  generate() {
    const w = this.width, h = this.height;
    const islands = this.preset === 'continent'
      ? [[.5, .49, .36, .36], [.62, .65, .20, .20]]
      : [[.37, .40, .25, .25], [.66, .63, .21, .25], [.76, .27, .11, .12], [.20, .76, .10, .11], [.48, .80, .075, .07]];
    const shift = this.rng.next() * .08 - .04;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const detail = noise(x / 7, y / 7, this.seed + 31);
      this.variation[i] = Math.floor(noise(x / 2, y / 2, this.seed + 9) * 255);
      if (this.preset === 'ocean') { this.tiles[i] = 0; continue; }
      let shape = -2;
      for (const [cx, cy, rx, ry] of islands) {
        const d = Math.hypot((x / w - cx - shift) / rx, (y / h - cy) / ry);
        shape = Math.max(shape, 1 - d);
      }
      const altitude = shape + (noise(x / 18, y / 18, this.seed) - .5) * .56 + (detail - .5) * .16;
      let tile = TILE.WATER;
      if (altitude > -.12) tile = TILE.SHALLOW;
      if (altitude > -.035) tile = TILE.SAND;
      if (altitude > .065) tile = TILE.GRASS;
      if (altitude > .14 && noise(x / 11, y / 11, this.seed + 410) > .48) tile = TILE.FOREST;
      if (altitude > .57 && noise(x / 13, y / 13, this.seed + 600) > .47) tile = TILE.MOUNTAIN;
      if (altitude > .75 && tile === TILE.MOUNTAIN) tile = TILE.SNOW;
      this.tiles[i] = tile;
    }
    this.revision++;
  }
  findLand(x, y, radius = 15) {
    if (this.walkable(x, y) && this.tile(x, y) !== TILE.ASH) return { x: Math.floor(x) + .5, y: Math.floor(y) + .5 };
    for (let r = 1; r <= radius; r++) for (let n = 0; n < 20; n++) {
      const a = n / 20 * Math.PI * 2;
      const px = Math.floor(x + Math.cos(a) * r), py = Math.floor(y + Math.sin(a) * r);
      if (this.walkable(px, py) && this.tile(px, py) !== TILE.ASH) return { x: px + .5, y: py + .5 };
    }
    return null;
  }
  seedLife() {
    for (const [nx, ny, race] of [[.34, .47,'human'], [.52, .18,'dwarf'], [.67, .63,'ghoul'], [.76,.27,'alien'], [.20,.76,'mycelite']]) {
      const land = this.findLand(this.width * nx, this.height * ny, 25);
      if (!land) continue;
      const village = this.createVillage(land.x, land.y,true,race);
      if (!village) continue;
      for (let j = 0; j < 10; j++) {
        const p = this.findLand(land.x + this.rng.next() * 10 - 5, land.y + this.rng.next() * 10 - 5);
        if (!p) continue;
        const u = this.spawn('human', p.x, p.y, village.id);
        if (!u) continue;
        if (j < 3) { u.age = 5 + this.rng.next() * 10; u.job = 'child'; }
        else u.age = 20 + this.rng.next() * 16;
        u.bornYear = Math.max(1, this.year - Math.floor(u.age));
      }
      for (let j = 0; j < 6; j++) {
        const p = this.findLand(land.x + this.rng.next() * 22 - 11, land.y + this.rng.next() * 22 - 11);
        if (p) this.spawn('sheep', p.x, p.y);
      }
      for (let j = 0; j < 2; j++) {
        const p = this.findLand(land.x + this.rng.next() * 24 - 12, land.y + this.rng.next() * 24 - 12);
        if (p) this.spawn('cow', p.x, p.y);
      }
      const den = this.findLand(land.x + (this.rng.next()>.5?1:-1)*18, land.y + (this.rng.next()>.5?1:-1)*16, 20);
      if (den) this.spawn('wolf', den.x, den.y);
    }
    for (const v of this.villages) {
      v.population = this.units.filter(u => u.kind === 'human' && u.villageId === v.id).length;
      v.epoch = epochOf(v.population).id;
    }
  }
  createVillage(x, y, established = true, race='human') {
    const pool = RACE_TOWNS[race] ?? NAMES;
    const v = { id: this.nextId++, x: Math.floor(x) + .5, y: Math.floor(y) + .5, name: pool[this.villages.filter(o => (o.race ?? 'human') === race).length % pool.length],
      ...emptyStock(),race,planMaterial:'wood',color: RACES[race].color, food: established ? 35 : 12, wood: established ? 30 : 20, birth: 0, build: 0, population: 0, leaderId: null, known: [], borderYear: 0, heat: [], wars: [],
      ties: [], allies: [], cult: 0, faith: '', omen: null, tradeYear: 0, market: 0, lastTrade: null, epoch: 'camp' };
    this.villages.push(v);
    if (!this.addBuilding(v, 'hall')) { this.villages.pop(); return null; }
    if (established) { this.addBuilding(v, 'house'); this.addBuilding(v, 'farm'); }
    this.tell('village', { town: v.name });
    return v;
  }
  addBuilding(village, type = 'house', complete = true, material='wood',cost={}) {
    if (this.buildings.length >= BUILDING_LIMIT) return false;
    const cx = Math.floor(village.x), cy = Math.floor(village.y);
    const own = this.buildings.filter(b => b.villageId === village.id).length;
    const epoch = epochOf(village.population || 0);
    const minR = type === 'hall' ? 0 : 3;
    const maxR = Math.min(Math.max(this.width, this.height), Math.max(10, 6 + own * 1.55));
    const minDist = type === 'hall' ? 1.15 : epoch.gap;
    for (let r = minR; r <= maxR; r++) for (const [x, y] of ringCells(cx, cy, r)) {
      if (!this.walkable(x, y) || this.tile(x, y) === TILE.SNOW || this.fire[this.index(x, y)] > 0) continue;
      if (!this.humans.navigation.sameRegion(village, { x: x + .5, y: y + .5 })) continue;
      if (this.buildings.some(b => Math.hypot(b.x - x, b.y - y) < minDist)) continue;
      if (this.deposits.some(d => d.amount > 0 && Math.hypot(d.x - x, d.y - y) < 2)) continue;
      if (this.villages.some(other => other.id !== village.id && Math.hypot(other.x - x, other.y - y) < 6)) continue;
      const setting = this.settingAt(x, y);
      this.tiles[this.index(x, y)] = TILE.GRASS;
      this.resetResource(this.index(x, y));
      let hp = type === 'hall' ? 72 + epoch.levels * 6 : type === 'farm' || type === 'pen' ? 24 : 22 + epoch.levels * 5;
      if ((village.race ?? 'human') === 'dwarf' && type !== 'farm') hp = Math.round(hp * 1.4);
      const building = { id: this.nextId++, villageId: village.id, x, y, type, material, race: village.race ?? 'human', cost: { ...cost }, complete, progress: complete ? 1 : 0, crop: type === 'farm' && complete ? 6 : 0, hp, setting };
      this.buildings.push(building); this.revision++; this.navRevision++; this.resourceRevision++;
      return building;
    }
    return false;
  }
  spawn(kind, x, y, villageId = null, {parents=[],race=null} = {}) {
    if (!this.walkable(x, y) || this.units.length >= UNIT_LIMIT) return null;
    if(kind in RACES){race??=kind==='human'?null:kind;kind='human';}
    race??=parents[0]?.race??this.villages.find(v=>v.id===villageId)?.race??'human';
    const unit = { id: this.nextId++, kind, x, y, tx: x, ty: y, age: 18 + this.rng.next() * 20, hp: 100, villageId, decision: this.rng.next() * 2, work: 0 };
    if (kind === 'human') {unit.race=race;initializeHuman(this, unit, parents);}
    if (isLivestock(unit)) {unit.penId=null;unit.herderId=null;}
    this.emit('birth',x,y,{race},1);
    this.units.push(unit); return unit;
  }
  resetResource(i) { this.wood[i] = this.tiles[i] === TILE.FOREST ? 8 : 0; this.berries[i] = [TILE.GRASS,TILE.FOREST].includes(this.tiles[i]) && this.variation[i] % 3 === 0 ? 6 : 0; }
  circle(cx, cy, radius, apply) {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (this.inBounds(x, y) && Math.hypot(x - cx, y - cy) <= radius) apply(this.index(x, y), x, y);
    }
  }
  markAct(kind = null) {
    this.god.idle = 0;
    if (kind === 'mercy') { this.god.mercy = clamp(this.god.mercy + 4); this.god.presence = clamp(this.god.presence + 3); }
    if (kind === 'wrath') { this.god.wrath = clamp(this.god.wrath + 5); this.god.presence = clamp(this.god.presence + 4); }
  }
  sowWeather(kind, x, y, radius, life = 12) {
    const near = this.weather.find(w => w.kind === kind && Math.hypot(w.x - x, w.y - y) < Math.max(4, radius * .7));
    if (near) {
      near.life = Math.max(near.life, life);
      near.total = Math.max(near.total, life);
      near.radius = Math.max(near.radius, radius);
      near.x = (near.x + x) / 2; near.y = (near.y + y) / 2;
      return near;
    }
    const field = { kind, x, y, radius, life, total: life };
    this.weather.push(field);
    if (this.weather.length > 10) this.weather.shift();
    return field;
  }
  weatherAt(x, y) {
    let best = null, bestD = Infinity;
    for (const field of this.weather) {
      const d = Math.hypot(field.x - x, field.y - y);
      if (d <= field.radius && d < bestD) { best = field; bestD = d; }
    }
    return best;
  }
  stirWeather(x, y, radius) {
    for (const u of this.units) {
      if (u.kind !== 'human' || u.hp <= 0) continue;
      if (Math.hypot(u.x - x, u.y - y) > radius + 2) continue;
      if (['flee', 'defend'].includes(u.action)) continue;
      u.decision = 0;
    }
  }
  applyWeather(kind, x, y, radius = 3, source = 'player') {
    const life = { rain: 14, storm: 12, blizzard: 14, aurora: 16, bloom: 12, drought: 18 }[kind] ?? 12;
    const r = radius + (kind === 'aurora' ? 4 : 2);
    this.sowWeather(kind, x, y, r, life);
    const burst = { rain: 3.6, storm: 3.8, blizzard: 3.4, aurora: 4.4, bloom: 3.6, drought: 2.8 }[kind] ?? 2.6;
    this.effects.push({ id: this.effectSeq++, kind, x, y, radius: r, life: burst, total: burst });
    if (kind === 'rain' || kind === 'storm') {
      this.circle(x, y, r, i => { this.fire[i] = 0; if (this.tiles[i] === TILE.ASH) { this.tiles[i] = TILE.GRASS; this.resetResource(i); } });
      this.resourceRevision++;
    }
    if (kind === 'rain') this.blessRain(x, y, radius);
    if (kind === 'storm') {
      for (const b of this.buildings) if (b.type === 'farm' && Math.hypot(b.x - x, b.y - y) <= r + 4) b.crop = Math.min(12, (b.crop ?? 0) + 2);
      if (source === 'player') this.markAct('wrath');
    }
    if (kind === 'blizzard') {
      for (const b of this.buildings) if (b.type === 'farm' && Math.hypot(b.x - x, b.y - y) <= r + 4) b.crop = Math.max(0, (b.crop ?? 0) - 3);
      if (source === 'player') this.markAct('wrath');
    }
    if (kind === 'aurora') {
      for (const v of this.villages) {
        if (Math.hypot(v.x - x, v.y - y) > r + 10) continue;
        v.cult = clamp((v.cult ?? 0) + (v.race === 'alien' ? 16 : 8));
        if ((v.cult ?? 0) >= 24 && v.faith !== 'fear') v.faith = 'patron';
      }
      if (source === 'player') this.markAct('mercy');
    }
    if (kind === 'bloom') {
      this.circle(x, y, r, i => { if ([TILE.GRASS, TILE.FOREST].includes(this.tiles[i])) this.berries[i] = Math.min(6, this.berries[i] + 2); });
      this.resourceRevision++;
      for (const b of this.buildings) if (b.type === 'farm' && Math.hypot(b.x - x, b.y - y) <= r + 6) b.crop = Math.min(12, (b.crop ?? 0) + 5);
      for (const d of this.deposits) if (d.kind === 'mycelium' && Math.hypot(d.x - x, d.y - y) <= r + 4) d.amount = Math.min(d.max, d.amount + 4);
      this.depositRevision++;
      if (source === 'player') this.markAct('mercy');
    }
    if (kind !== 'rain' && kind !== 'drought') {
      const town = this.villages.filter(v => v.population > 0).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (town && Math.hypot(town.x - x, town.y - y) <= r + 14) this.tell('weather', { omen: kind, town: town.name, home: town.name });
    }
    this.stirWeather(x, y, r);
    this.revision++;
    return true;
  }
  blessRain(x, y, radius) {
    let blessed = false;
    for (const v of this.villages) {
      if (Math.hypot(v.x - x, v.y - y) > radius + 12) continue;
      for (const b of this.buildings) if (b.villageId === v.id && b.type === 'farm') b.crop = Math.min(12, (b.crop ?? 0) + 4);
      const hungry = v.population > 0 && v.food < Math.max(8, v.population * 3);
      if (!hungry) continue;
      v.food += 8; v.cult = clamp((v.cult ?? 0) + 14); v.faith = 'patron'; v.omen = v.omen === 'pray' || v.omen === 'drought' ? null : v.omen;
      const leader = this.units.find(u => u.id === v.leaderId);
      this.tell('cult', { town: v.name, leader: leader?.name ?? 'the elder', who: leader?.name });
      blessed = true;
    }
    if (blessed) this.markAct('mercy');
  }
  applyDisaster(tool, x, y, r, source = 'player') {
    this.recordStrike(tool, x, y, r, source);
    this.circle(x, y, r + 2, (i, px, py) => {
      const d = Math.hypot(x - px, y - py);
      if (d <= r) { this.tiles[i] = d < r * .5 && tool === 'meteor' ? TILE.SHALLOW : TILE.ASH; this.fire[i] = 0; this.resetResource(i); }
      else if ([TILE.GRASS, TILE.FOREST].includes(this.tiles[i])) this.fire[i] = 5;
    });
    for (const u of this.units) if (Math.hypot(u.x - x, u.y - y) <= r + 1) u.hp = 0;
    this.buildings = this.buildings.filter(b => Math.hypot(b.x - x, b.y - y) > r + 1);
    const life = tool === 'meteor' ? 2.45 : 1.7;
    this.effects.push({ id: this.effectSeq++, kind: tool, x, y, radius: r, life, total: life });
    this.revision++; this.navRevision++; this.resourceRevision++; this.reconcileTerrain();
    return true;
  }
  paint(tool, x, y, radius = 3) {
    if (!this.inBounds(x, y)) return false;
    this.god.idle = 0;
    const terrain = { water: TILE.WATER, sand: TILE.SAND, grass: TILE.GRASS, forest: TILE.FOREST, mountain: TILE.MOUNTAIN, snow: TILE.SNOW };
    if (tool in terrain) {
      this.circle(x, y, radius, i => { this.tiles[i] = terrain[tool]; this.fire[i] = 0; this.resetResource(i); });
      this.revision++; this.navRevision++; this.resourceRevision++;
      this.reconcileTerrain(); return true;
    }
    if(DEPOSIT_KINDS.includes(tool)) {
      const before=this.deposits.length,d=addDeposit(this,tool,x,y,30);
      if(d&&this.deposits.length>before)this.humans.noticeGift(d);
      return !!d;
    }
    if ([...Object.keys(RACES), 'sheep', 'cow', 'wolf'].includes(tool)) {
      if (!this.walkable(x, y)) return false;
      const nearest = tool in RACES ? this.villages.find(v => raceOf(v)===tool&&Math.hypot(x - v.x, y - v.y) < Math.max(20, this.claimRadius(v) + 4) && this.humans.accessibleVillage({x,y},v)) : null;
      return !!this.spawn(tool, x + .5, y + .5, nearest?.id ?? null);
    }
    if (tool === 'fire') {
      this.circle(x, y, radius, i => { if ([TILE.GRASS, TILE.FOREST].includes(this.tiles[i])) this.fire[i] = 4 + this.rng.next() * 3; });
      this.effects.push({ id: this.effectSeq++, kind: 'ignite', x, y, radius, life: 1.15, total: 1.15 });
      this.markAct('wrath'); return true;
    }
    if (tool === 'rain' || tool === 'storm' || tool === 'blizzard' || tool === 'aurora' || tool === 'bloom') {
      return this.applyWeather(tool, x, y, radius, 'player');
    }
    if (tool === 'trade') return this.humans.blessMarket(x + .5, y + .5);
    if (tool === 'meteor' || tool === 'lightning') {
      this.markAct('wrath');
      return this.applyDisaster(tool, x, y, tool === 'meteor' ? Math.max(4, radius + 1) : 2, 'player');
    }
    if (tool === 'erase') {
      this.deposits=this.deposits.filter(d=>Math.hypot(d.x-x,d.y-y)>radius);this.depositRevision++;
      this.units = this.units.filter(u => Math.hypot(u.x - x, u.y - y) > radius);
      this.buildings = this.buildings.filter(b => Math.hypot(b.x - x, b.y - y) > radius);
      this.circle(x, y, radius, i => { this.fire[i] = 0; if (this.tiles[i] === TILE.FOREST) this.tiles[i] = TILE.GRASS; this.resetResource(i); });
      this.revision++; this.navRevision++; this.resourceRevision++; this.updatePopulations(); return true;
    }
    return false;
  }
  reconcileTerrain() {
    reconcileDeposits(this);
    this.units = this.units.filter(u => u.hp > 0 && this.walkable(u.x, u.y));
    const count=this.buildings.length; this.buildings = this.buildings.filter(b => this.walkable(b.x, b.y));
    if (count!==this.buildings.length) this.navRevision++;
    this.updatePopulations();
  }
  updatePopulations() {
    for (const v of this.villages) v.population = 0;
    const byId = new Map(this.villages.map(v => [v.id, v]));
    for (const u of this.units) if (u.kind === 'human' && byId.has(u.villageId)) byId.get(u.villageId).population++;
    for (const v of this.villages) {
      const next = epochOf(v.population);
      if (v.epoch && v.epoch !== next.id && v.population > 0) this.tell('epoch', { town: v.name, from: v.epoch, to: next.name, stage: next.id });
      v.epoch = next.id;
    }
  }
  recordStrike(tool, x, y, r, source = 'player') {
    const hit=this.units.filter(u=>Math.hypot(u.x-x,u.y-y)<=r+1);
    const wrecked=this.buildings.filter(b=>Math.hypot(b.x-x,b.y-y)<=r+1);
    const byVillage=new Map();
    for(const u of hit)if(u.kind==='human'&&u.villageId!=null){const rec=byVillage.get(u.villageId)??{dead:0,ruins:0};rec.dead++;byVillage.set(u.villageId,rec);}
    for(const b of wrecked){const rec=byVillage.get(b.villageId)??{dead:0,ruins:0};rec.ruins++;byVillage.set(b.villageId,rec);}
    if(!byVillage.size) this.tell('disaster', { tool });
    for(const [id,rec] of byVillage) {
      const v=this.villages.find(v=>v.id===id);if(!v)continue;
      const parts=[];
      if(rec.dead)parts.push(rec.dead===1?'1 person died':`${rec.dead} people died`);
      if(rec.ruins)parts.push(rec.ruins===1?'1 building destroyed':`${rec.ruins} buildings destroyed`);
      const detail=parts.join(', ');
      if(source==='player') {
        v.cult=clamp((v.cult??0)-12); v.faith='fear';
        this.tell('wrath', { town: v.name, detail, who: v.name });
      } else this.tell('disaster', { town: v.name, tool, detail });
    }
    for(const u of this.units) {
      if(u.kind!=='human'||Math.hypot(u.x-x,u.y-y)>r+8||Math.hypot(u.x-x,u.y-y)<=r+1)continue;
      this.humans.remember(u,'disaster');u.social=clamp(u.social+22);u.decision=0;
    }
  }
  spreadSpores(x, y) {
    this.emit('spore',x,y,{race:'mycelite'},1.1);
    const cx=Math.floor(x),cy=Math.floor(y);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[2,0],[0,2]]) {
      const px=cx+dx,py=cy+dy;if(!this.inBounds(px,py)||this.fire[this.index(px,py)]>0)continue;
      const t=this.tiles[this.index(px,py)];
      if(t===TILE.GRASS&&this.rng.next()<.45){this.tiles[this.index(px,py)]=TILE.FOREST;this.resetResource(this.index(px,py));this.revision++;this.navRevision++;this.resourceRevision++;}
      else if([TILE.GRASS,TILE.FOREST].includes(t)&&this.rng.next()<.35)addDeposit(this,'mycelium',px,py,10);
    }
  }
  tickCreature(u, dt) {
    u.age+=dt/6;u.decision-=dt;u.animAttack=Math.max(0,(u.animAttack??0)-dt);
    if(this.fire[this.index(u.x,u.y)]>0)u.hp-=dt*55;
    if(u.age>(u.kind==='cow'?70:60))u.hp-=dt*3;
    const near=this.humans.nearby(u,u.kind==='wolf'?14:8);
    if(isLivestock(u)) this.tickLivestock(u,dt,near);
    else this.tickWolf(u,dt,near);
    const dx=u.tx-u.x,dy=u.ty-u.y,d=Math.hypot(dx,dy);
    if(d>.1&&u.action!=='attack')u.action=u.kind==='wolf'?'hunt':u.action==='flee'?'flee':u.action==='herd'?'herd':'wander';
    if(u.animAttack>0)u.action='attack';
    if(d>.1){
      const pace=u.kind==='wolf'?2.7:u.kind==='cow'?1.05:u.action==='flee'?2.2:u.action==='herd'?1.7:1.15;
      const move=Math.min(d,dt*pace),nx=u.x+dx/d*move,ny=u.y+dy/d*move;
      if(this.walkable(nx,ny)){u.x=nx;u.y=ny;}else{u.tx=u.x;u.ty=u.y;u.decision=0;}
    }
  }
  tickLivestock(u,dt,near) {
    const pen=u.penId!=null?this.buildings.find(b=>b.id===u.penId&&b.type==='pen'&&b.complete!==false):null;
    if(u.penId!=null&&!pen)u.penId=null;
    const herder=u.herderId!=null?this.units.find(a=>a.id===u.herderId&&a.kind==='human'&&a.hp>0):null;
    if(u.herderId!=null&&!herder)u.herderId=null;
    let burning=false;const x=Math.floor(u.x),y=Math.floor(u.y);
    for(let dy=-2;dy<=2&&!burning;dy++)for(let dx=-2;dx<=2;dx++)if(this.inBounds(x+dx,y+dy)&&this.fire[this.index(x+dx,y+dy)]>0)burning=true;
    const threat=near.find(a=>a.kind==='wolf'||(a.kind==='human'&&a.race==='ghoul'&&a.action==='hunt'));
    const wx=this.weatherAt(u.x,u.y);
    if(wx&&(wx.kind==='storm'||wx.kind==='blizzard')) {
      const haven=pen??near.find(a=>a.kind===u.kind);
      const tx=haven?haven.x+.5+(this.rng.next()-.5):u.x+(this.rng.next()-.5)*2;
      const ty=haven?haven.y+.5+(this.rng.next()-.5):u.y+(this.rng.next()-.5)*2;
      if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}
      u.action='graze';u.decision=.8;return;
    }
    if(threat||burning) {
      const from=threat??{x:u.x,y:u.y};u.action='flee';
      const tx=pen&&!burning?pen.x+.5+(this.rng.next()-.5):u.x+(u.x-from.x)*1.8+(this.rng.next()-.5);
      const ty=pen&&!burning?pen.y+.5+(this.rng.next()-.5):u.y+(u.y-from.y)*1.8+(this.rng.next()-.5);
      if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}u.decision=.35;return;
    }
    if(herder) {
      u.action='herd';
      const tx=herder.x+(u.x-herder.x)*0.15,ty=herder.y+(u.y-herder.y)*0.15;
      if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}
      u.decision=.25;return;
    }
    if(pen) {
      if(u.decision<=0) {
        const tx=pen.x+.5+this.rng.next()*2.4-1.2,ty=pen.y+.5+this.rng.next()*2.4-1.2;
        if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}
        u.action='graze';u.decision=1.2+this.rng.next();
      } else u.action=Math.hypot(u.tx-u.x,u.ty-u.y)>.2?'wander':'graze';
      return;
    }
    if(u.decision<=0) {
      const flock=near.filter(a=>a.kind===u.kind);
      const cx=flock.reduce((s,a)=>s+a.x,u.x)/(flock.length+1),cy=flock.reduce((s,a)=>s+a.y,u.y)/(flock.length+1);
      const tx=cx+this.rng.next()*4-2,ty=cy+this.rng.next()*4-2;
      if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}
      u.action='graze';u.decision=1.1+this.rng.next();
    } else u.action=Math.hypot(u.tx-u.x,u.ty-u.y)>.2?'wander':'graze';
  }
  tickWolf(u,dt,near) {
    if(u.decision<=0) {
      const herd=near.filter(a=>isLivestock(a)).sort((a,b)=>distance(u,a)-distance(u,b));
      const people=near.filter(a=>a.kind==='human').sort((a,b)=>distance(u,a)-distance(u,b));
      const pack=near.find(a=>a.kind==='wolf');
      const prey=herd[0]??people[0];
      if(prey){u.tx=prey.x;u.ty=prey.y;u.action='hunt';u.decision=.45;}
      else if(pack&&this.walkable(pack.tx,pack.ty)){u.tx=pack.tx;u.ty=pack.ty;u.action='hunt';u.decision=.7;}
      else {const tx=u.x+this.rng.next()*8-4,ty=u.y+this.rng.next()*8-4;if(this.walkable(tx,ty)){u.tx=tx;u.ty=ty;}u.action='idle';u.decision=1+this.rng.next();}
    }
    const prey=near.filter(a=>isLivestock(a)||a.kind==='human').sort((a,b)=>distance(u,a)-distance(u,b))[0];
    if(prey&&distance(u,prey)<1.5){prey.hp-=prey.kind==='human'?12:28;u.animAttack=.45;u.action='attack';this.emit('hit',prey.x,prey.y);}
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .25); this.time += dt;
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
    for (const field of this.weather) field.life -= dt;
    this.weather = this.weather.filter(field => field.life > 0);
    this.tickCaravans(dt);
    this.humans.prepare();
    for (const u of this.units) {
      if (!this.walkable(u.x,u.y)) { u.hp=0;continue; }
      if (u.kind==='human') { this.humans.tick(u,dt);continue; }
      this.tickCreature(u,dt);
    }
    const dead=this.units.filter(u=>u.hp<=0&&u.kind==='human');
    for(const u of this.units)if(u.hp<=0)this.emit('death',u.x,u.y,{race:u.race},1.3);
    if(dead.length===1) this.tell('death', { who: dead[0].name, town: this.villages.find(v=>v.id===dead[0].villageId)?.name });
    else if(dead.length) this.tell('death', { count: dead.length, who: dead[0].name });
    this.units=this.units.filter(u=>u.hp>0);
    this.updatePopulations();this.humans.families(dt);
    this.ecoTime+=dt;this.settlementTime+=dt;
    if(this.ecoTime>=.5){this.updateNature(this.ecoTime);this.ecoTime=0;}
    if(this.settlementTime>=3){this.settle();this.humans.society(this.settlementTime);this.settlementTime=0;}
    const beat=Math.floor(this.time);
    if(beat>(this.story.beat??0)){tickDirector(this,beat-(this.story.beat??0));this.story.beat=beat;}
    this.updatePopulations();
    tickFaith(this,dt);
  }
  updateNature(dt) {
    reconcileDeposits(this);
    for(const d of this.deposits)if(d.kind==='fish'&&d.amount<d.max){d.amount=Math.min(d.max,d.amount+dt*.035);this.depositRevision++;}
    const ignite = [];
    for (let i = 0; i < this.fire.length; i++) {
      if (this.fire[i] <= 0) continue;
      this.fire[i] = Math.max(0, this.fire[i] - dt);
      this.wood[i]=0;this.berries[i]=0;this.resourceRevision++;
      if (!this.fire[i]) { this.tiles[i] = TILE.ASH; this.revision++; }
      else if (this.rng.next() < .23) {
        const x = i % this.width, y = Math.floor(i / this.width);
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][this.rng.int(4)];
        if (this.inBounds(x + dx, y + dy)) {
          const j = this.index(x + dx, y + dy);
          if ([TILE.FOREST, TILE.GRASS].includes(this.tiles[j]) && !this.fire[j]) ignite.push(j);
        }
      }
    }
    for (const i of ignite) this.fire[i] = 4 + this.rng.next() * 3;
    const burned=new Set();
    this.buildings = this.buildings.filter(b => {
      if (this.fire[this.index(b.x, b.y)] > 0) { burned.add(b.villageId); this.revision++; this.navRevision++; return false; }
      return true;
    });
    for(const id of burned){const v=this.villages.find(v=>v.id===id);if(v)this.tell('disaster',{town:v.name,detail:'Flame ran through the streets. The store still smells of smoke.',who:v.name});}
    // Slow regrowth, sampled independently of render frame rate.
    for (let n = 0; n < 14; n++) {
      const i = this.rng.int(this.tiles.length);
      if (this.tiles[i] === TILE.ASH && !this.fire[i]) { this.tiles[i] = TILE.GRASS; this.resetResource(i); this.revision++; this.resourceRevision++; }
      else if ([TILE.GRASS,TILE.FOREST].includes(this.tiles[i])&&!this.fire[i]&&this.berries[i]<6) { this.berries[i]++;this.resourceRevision++; }
    }
  }
  settle() {
    this.humans.navigation.refresh();
    const settlers=this.units.filter(u=>u.kind==='human'&&u.villageId==null&&u.age>=18);
    for(const u of settlers) {
      if(u.villageId!=null)continue;
      const near=this.villages.find(v=>raceOf(v)===raceOf(u)&&distance(u,v)<Math.max(18,this.claimRadius(v)+4)&&this.humans.accessibleVillage(u,v));
      if(near){u.villageId=near.id;continue;}
      const group=settlers.filter(other=>raceOf(other)===raceOf(u)&&other.villageId==null&&distance(u,other)<12&&this.humans.navigation.sameRegion(u,other));
      if(group.length>=3&&this.villages.length<16){
        const site=this.findVillageSite(group.reduce((s,p)=>s+p.x,0)/group.length, group.reduce((s,p)=>s+p.y,0)/group.length);
        const v=site&&this.createVillage(site.x,site.y,false,raceOf(u));
        if(v)for(const other of group)other.villageId=v.id;
      }
    }
  }
  stats() {
    let land = 0, forests = 0, burning = 0;
    for (let i = 0; i < this.tiles.length; i++) { if (this.tiles[i] >= 2) land++; if (this.tiles[i] === 4) forests++; if (this.fire[i] > 0) burning++; }
    return { population: this.units.filter(u => u.kind === 'human').length, animals: this.units.filter(u => u.kind !== 'human').length,
      villages: this.villages.filter(v => v.population > 0).length, land: Math.round(land / this.tiles.length * 100), forests, burning, buildings: this.buildings.length };
  }
  serialize() {
    return JSON.stringify({ version: 4, width: this.width, height: this.height, seed: this.seed, preset: this.preset,deposits:this.deposits,
      time: this.time, nextId: this.nextId, rng: this.rng.state, ecoTime: this.ecoTime, settlementTime: this.settlementTime,
      navRevision: this.navRevision, wood: Array.from(this.wood), berries: Array.from(this.berries), tiles: Array.from(this.tiles), fire: Array.from(this.fire, n => Math.round(n * 100) / 100),
      units: this.units, villages: this.villages, buildings: this.buildings, events: this.events, god: this.god, story: this.story });
  }
  static deserialize(json) {
    const d = JSON.parse(json);
    const fail = () => { throw new Error('This save is damaged or from another version of the game.'); };
    const finite = n => typeof n === 'number' && Number.isFinite(n);
    if (!d || ![1,2,3,4].includes(d.version) || !Number.isInteger(d.width) || !Number.isInteger(d.height) || d.width < 32 || d.height < 32 || d.width > 256 || d.height > 192) fail();
    if (!Number.isInteger(d.seed) || !Number.isInteger(d.rng) || !Number.isInteger(d.nextId) || d.nextId < 1 || !finite(d.time) || d.time < 0 || !finite(d.ecoTime) || !finite(d.settlementTime)) fail();
    const n = d.width * d.height;
    if(d.version>=2) {
      if(!Number.isInteger(d.navRevision)||d.navRevision<0)fail();
      for(const [key,max]of [['wood',8],['berries',6]])if(!Array.isArray(d[key])||d[key].length!==n||d[key].some(v=>!Number.isInteger(v)||v<0||v>max))fail();
    }
    if (!Array.isArray(d.tiles) || d.tiles.length !== n || d.tiles.some(t => !Number.isInteger(t) || t < 0 || t > 7)) fail();
    if (!Array.isArray(d.fire) || d.fire.length !== n || d.fire.some(t => !finite(t) || t < 0 || t > 10)) fail();
    if (!Array.isArray(d.units) || d.units.length > UNIT_LIMIT || !Array.isArray(d.villages) || d.villages.length > 16 || !Array.isArray(d.buildings) || d.buildings.length > BUILDING_LIMIT || !Array.isArray(d.events) || d.events.length > 30) fail();
    const point = p => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x < d.width && p.y >= 0 && p.y < d.height && Number.isInteger(p.id) && p.id > 0;
    if (d.units.some(u => !point(u) || !['human',...ANIMAL_KINDS].includes(u.kind) || !['tx','ty','age','hp','decision','work'].every(k => finite(u[k])) || (u.villageId != null && !Number.isInteger(u.villageId)))) fail();
    if (d.villages.some(v => !point(v) || typeof v.name !== 'string' || v.name.length > 60 || !/^#[a-f\d]{6}$/i.test(v.color) || !['food','wood','birth','build','population'].every(k => finite(v[k]) && v[k] >= 0))) fail();
    if(d.version===2)for(const u of d.units)if(u.kind==='human'){u.race='human';u.inventory={...emptyStock(),...u.inventory};u.skills={mine:0,dig:0,cultivate:0,fish:0,...u.skills};}
    if(d.version>=2&&d.units.some(u=>u.kind==='human'&&!validateHuman(u,n,d.nextId)))fail();
    if(d.version>=2&&d.buildings.some(b=>typeof b.complete!=='boolean'||!finite(b.progress)||b.progress<0||b.progress>1||!finite(b.crop)||b.crop<0||b.crop>12))fail();
    if(d.version>=3){
      if(!Array.isArray(d.deposits)||d.deposits.length>700||d.deposits.some(p=>!point(p)||!DEPOSIT_KINDS.includes(p.kind)||!finite(p.amount)||p.amount<0||!finite(p.max)||p.max<1||p.max>60||p.amount>p.max))fail();
      if(d.villages.some(v=>!Object.hasOwn(RACES,v.race)||!Object.hasOwn(MATERIALS,v.planMaterial)||STOCKS.some(k=>!finite(v[k])||v[k]<0||v[k]>999)))fail();
      if(d.buildings.some(b=>!Object.hasOwn(RACES,b.race)||!Object.hasOwn(MATERIALS,b.material)||!b.cost||Object.entries(b.cost).some(([k,n])=>!STOCKS.includes(k)||!Number.isInteger(n)||n<0||n>30)))fail();
    }
    const ids = new Set(d.villages.map(v => v.id));
    if (d.units.some(u => u.villageId != null && !ids.has(u.villageId))) fail();
    if (d.buildings.some(b => !point(b) || !ids.has(b.villageId) || !BUILDING_TYPES.includes(b.type))) fail();
    if (d.events.some(e => !e || typeof e.message !== 'string' || e.message.length > 400 || !finite(e.year) || typeof e.type !== 'string')) fail();
    const allIds = [...d.units, ...d.villages, ...d.buildings,...(d.version>=3?d.deposits:[])].map(o => o.id);
    if (new Set(allIds).size !== allIds.length || allIds.some(id => id >= d.nextId)) fail();
    const world = new World({ width: d.width, height: d.height, seed: d.seed, preset: d.preset, populate: false });
    world.tiles = Uint8Array.from(d.tiles); world.fire = Float32Array.from(d.fire);
    for (const key of ['time','nextId','ecoTime','settlementTime','units','villages','buildings','events']) world[key] = d[key];
    world.god = restoreGod(world, d.god);
    const pending = d.story?.pending;
    world.story = {
      cool: finite(d.story?.cool) ? Math.max(0, d.story.cool) : 60,
      pending: pending && typeof pending.kind === 'string' && Number.isInteger(pending.year)
        ? { kind: pending.kind, villageId: Number.isInteger(pending.villageId) ? pending.villageId : null, otherId: Number.isInteger(pending.otherId) ? pending.otherId : null, year: pending.year }
        : null,
      lastYear: Number.isInteger(d.story?.lastYear) ? d.story.lastYear : 0,
      beat: Number.isInteger(d.story?.beat) && d.story.beat >= 0 ? d.story.beat : Math.floor(world.time),
    };
    world.rng.state = d.rng >>> 0;
    if(d.version>=2){world.wood=Uint8Array.from(d.wood);world.berries=Uint8Array.from(d.berries);world.navRevision=d.navRevision;}
    else {
      for(let i=0;i<n;i++)world.resetResource(i);
      for(const u of world.units)if(u.kind==='human')initializeHuman(world,u);
      for(const b of world.buildings)Object.assign(b,{complete:true,progress:1,crop:b.type==='farm'?6:0});
      for(const v of world.villages)v.leaderId=null;
      world.navRevision++;
    }
    if(d.version>=3)world.deposits=d.deposits;
    else {
      for(const v of world.villages){for(const k of STOCKS)v[k]??=0;v.race='human';v.planMaterial='wood';}
      for(const b of world.buildings)Object.assign(b,{race:'human',material:'wood',cost:{}});
      seedDeposits(world);
    }
    const villageIds=new Set(world.villages.map(v=>v.id));
    for(const v of world.villages) {
      v.known=Array.isArray(v.known)?[...new Set(v.known.filter(id=>Number.isInteger(id)&&villageIds.has(id)&&id!==v.id))]:[];
      v.borderYear=finite(v.borderYear)&&v.borderYear>=0?v.borderYear:0;
      v.heat=Array.isArray(v.heat)?v.heat.filter(h=>h&&Number.isInteger(h.id)&&villageIds.has(h.id)&&h.id!==v.id&&finite(h.value)&&h.value>0).map(h=>({id:h.id,value:Math.max(0,Math.min(100,h.value))})).slice(0,8):[];
      v.wars=Array.isArray(v.wars)?[...new Set(v.wars.filter(id=>Number.isInteger(id)&&villageIds.has(id)&&id!==v.id))]:[];
      v.ties=Array.isArray(v.ties)?v.ties.filter(t=>t&&Number.isInteger(t.id)&&villageIds.has(t.id)&&t.id!==v.id).map(t=>({id:t.id,debt:clamp(finite(t.debt)?t.debt:0),grudge:clamp(finite(t.grudge)?t.grudge:0),trust:clamp(finite(t.trust)?t.trust:0),legend:typeof t.legend==='string'?t.legend.slice(0,72):''})).slice(0,8):[];
      v.allies=Array.isArray(v.allies)?[...new Set(v.allies.filter(id=>Number.isInteger(id)&&villageIds.has(id)&&id!==v.id))]:[];
      v.cult=finite(v.cult)?clamp(v.cult):0;
      v.faith=['patron','fear'].includes(v.faith)?v.faith:'';
      v.omen=typeof v.omen==='string'?v.omen:null;
      v.tradeYear=Number.isInteger(v.tradeYear)&&v.tradeYear>=0?v.tradeYear:0;
      v.market=finite(v.market)?clamp(v.market):0;
      v.lastTrade=v.lastTrade&&Number.isInteger(v.lastTrade.year)&&v.lastTrade.year>=0&&Number.isInteger(v.lastTrade.partnerId)&&villageIds.has(v.lastTrade.partnerId)&&v.lastTrade.partnerId!==v.id&&STOCKS.includes(v.lastTrade.good)&&['buy','sell'].includes(v.lastTrade.role)?{year:v.lastTrade.year,partnerId:v.lastTrade.partnerId,good:v.lastTrade.good,role:v.lastTrade.role}:null;
      v.epoch=epochOf(finite(v.population)?v.population:0).id;
    }
    for(const b of world.buildings) {
      const cap=b.type==='hall'?160:b.type==='farm'||b.type==='pen'?40:90;
      b.hp=finite(b.hp)&&b.hp>0?Math.min(cap,b.hp):cap;
      b.setting=SETTINGS.includes(b.setting)?b.setting:world.settingAt(b.x, b.y);
    }
    for(const u of world.units) {
      if(!isLivestock(u))continue;
      u.penId=Number.isInteger(u.penId)?u.penId:null;
      u.herderId=Number.isInteger(u.herderId)?u.herderId:null;
    }
    world.depositRevision++;
    world.resourceRevision++;world.reconcileTerrain();world.revision++;
    return world;
  }
}
