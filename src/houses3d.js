import * as THREE from 'three';

// Every roof is built from a handful of unit shapes that are scaled into place, so a
// town of two hundred houses still holds only a dozen geometries on the GPU.
const cache = new Map();
function shared(key, make) {
  let geometry = cache.get(key);
  if (!geometry) { geometry = make(); geometry.userData.shared = true; cache.set(key, geometry); }
  return geometry;
}
export function disposeHouseGeometry() { for (const geometry of cache.values()) geometry.dispose(); cache.clear(); }

const q = n => Math.max(.05, Math.round(n * 20) / 20);
const coneGeo = seg => shared(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg));
const cylGeo = (taper, seg) => shared(`cyl${q(taper)}|${seg}`, () => new THREE.CylinderGeometry(q(taper), 1, 1, seg));
const domeGeo = seg => shared(`dome${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2));
const ballGeo = seg => shared(`ball${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(4, seg >> 1)));
const ringGeo = (tube, seg) => shared(`ring${q(tube)}|${seg}`, () => new THREE.TorusGeometry(1, q(tube), 5, seg));

// The kit hides three.js from the shapes below: each form only says where things go.
export function houseKit(add, colors, facts) {
  const place = (geometry, material, x, y, z, sx, sy, sz, spin = 0, tilt = 0) => {
    const mesh = add(geometry, material, x, y, z, sx, sy, sz);
    if (spin) mesh.rotation.y = spin;
    if (tilt) mesh.rotation.z = tilt;
    return mesh;
  };
  return {
    ...colors, ...facts,
    box: (material, x, y, z, sx, sy, sz, spin = 0, tilt = 0) => place(null, material, x, y, z, sx, sy, sz, spin, tilt),
    cone: (material, x, y, z, r, h, seg = 4, spin = Math.PI / 4) => place(coneGeo(seg), material, x, y, z, r, h, r, spin),
    cyl: (material, x, y, z, rTop, rBottom, h, seg = 8, spin = 0) => place(cylGeo(rTop / Math.max(.01, rBottom), seg), material, x, y, z, rBottom, h, rBottom, spin),
    dome: (material, x, y, z, r, hScale = 1, seg = 10) => place(domeGeo(seg), material, x, y, z, r, r * hScale, r),
    ball: (material, x, y, z, r, hScale = 1, seg = 8) => place(ballGeo(seg), material, x, y, z, r, r * hScale, r),
    ring: (material, x, y, z, r, tube, seg = 12) => { const mesh = place(ringGeo(tube / Math.max(.01, r), seg), material, x, y, z, r, r, r); mesh.rotation.x = Math.PI / 2; return mesh; },
  };
}

export const HOUSE_FORMS = Object.freeze({
  human: ['gable', 'masonry', 'adobe', 'stilt', 'longhouse', 'row', 'tower', 'cabin', 'cottage', 'ruin'],
  dwarf: ['hold', 'delve', 'forge', 'keep', 'barrow', 'quarry', 'wharf'],
  ghoul: ['den', 'wreck', 'thorn', 'scrap', 'spire', 'pit', 'ice'],
  alien: ['disc', 'obelisk', 'canopy', 'tide', 'beacon', 'crystal', 'shard'],
  mycelite: ['cap', 'cluster', 'ring', 'puff', 'shelf', 'pagoda', 'rime', 'cinder'],
});

export function houseForm(race, setting, epoch, material = 'wood') {
  if (race === 'dwarf') {
    if (setting === 'coast') return 'wharf';
    if (setting === 'frost') return 'barrow';
    if (setting === 'sand' || setting === 'waste') return 'quarry';
    if (setting === 'highland' && epoch.min >= 72) return 'keep';
    if (material === 'iron' || (setting === 'highland' && epoch.min >= 18)) return 'forge';
    if (epoch.min >= 72) return 'keep';
    if (setting === 'forest' || epoch.min < 8) return 'delve';
    return 'hold';
  }
  if (race === 'ghoul') {
    if (setting === 'coast') return 'wreck';
    if (setting === 'waste') return 'scrap';
    if (setting === 'forest') return 'thorn';
    if (setting === 'sand') return 'pit';
    if (setting === 'frost' && epoch.min < 72) return 'ice';
    if (setting === 'highland' || epoch.min >= 72) return 'spire';
    return 'den';
  }
  if (race === 'alien') {
    if (setting === 'sand') return 'obelisk';
    if (setting === 'forest') return 'canopy';
    if (setting === 'coast') return 'tide';
    if (setting === 'frost') return 'crystal';
    if (setting === 'waste') return 'shard';
    if (setting === 'highland' || epoch.min >= 72) return 'beacon';
    return 'disc';
  }
  if (race === 'mycelite') {
    if (setting === 'coast') return 'cluster';
    if (setting === 'forest') return 'ring';
    if (setting === 'sand') return 'puff';
    if (setting === 'highland') return 'shelf';
    if (setting === 'frost') return 'rime';
    if (setting === 'waste') return 'cinder';
    if (epoch.min >= 72) return 'pagoda';
    return 'cap';
  }
  if (setting === 'coast') return 'stilt';
  if (setting === 'frost') return 'longhouse';
  if (setting === 'forest') return 'cabin';
  if (setting === 'waste') return 'ruin';
  if (material === 'clay' || setting === 'sand') return 'adobe';
  if (epoch.min >= 130 || (setting === 'highland' && epoch.min >= 72)) return 'tower';
  if (epoch.min >= 72) return 'row';
  if (setting === 'highland' || material === 'stone' || material === 'iron' || epoch.min >= 36) return 'masonry';
  if (setting === 'meadow' && epoch.min < 8) return 'cottage';
  return 'gable';
}

function windowRow(k, y, count, width = .3, height = .34) {
  const span = k.bodyW * .72;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - .5;
    const x = t * span;
    k.box(k.trim, x, y, k.bodyD / 2 + .02, width + .1, height + .1, .05);
    k.box(k.glass, x, y, k.bodyD / 2 + .05, width, height, .06);
    if (k.variant !== 2) {
      k.box(k.dark, x - width * .55, y, k.bodyD / 2 + .07, .06, height, .04);
      k.box(k.dark, x + width * .55, y, k.bodyD / 2 + .07, .06, height, .04);
    }
  }
}
function door(k, depth = k.bodyD / 2 + .02, width = .42, height = .95) {
  k.box(k.trim, 0, height / 2 + .08, depth, width + .16, height + .16, .06);
  k.box(k.dark, 0, height / 2 + .05, depth + .03, width, height, .08);
  k.box(k.trim, 0, height + .12, depth + .04, width + .18, .08, .1);
  k.box(k.accent, width * .28, height * .48, depth + .07, .06, .08, .04);
}
function chimney(k, x, y) {
  k.box(k.trim, x, y, k.bodyD * .06, .16, .95, .16);
  k.box(k.dark, x, y + .52, k.bodyD * .06, .22, .1, .22);
  k.box(k.mat('#c9c4bc'), x, y + .62, k.bodyD * .06, .08, .18, .08);
}
function steps(k, depth = k.bodyD / 2 + .18) {
  k.box(k.trim, 0, .08, depth, .7, .12, .28);
  k.box(k.trim, 0, .18, depth - .08, .55, .1, .18);
}
function gableRoof(k, y, radius, height, sides = 4) {
  k.cone(k.roof, 0, y, 0, radius, height, sides);
  k.cone(k.trim, 0, y - height * .48, 0, radius * 1.08, height * .14, sides);
}

const FORMS = {
  gable(k) {
    k.box(k.wall, 0, .28 + k.storeys * k.storeyH / 2, 0, k.bodyW, k.storeys * k.storeyH, k.bodyD);
    k.box(k.trim, 0, .28, 0, k.bodyW + .12, .1, k.bodyD + .12);
    gableRoof(k, k.bodyTop + .58, Math.max(k.bodyW, k.bodyD) * .82, 1.12 + (k.variant === 1 ? .35 : 0));
    windowRow(k, 1.05, k.storeys > 2 ? 2 : 1);
    if (k.storeys > 2) windowRow(k, 1.05 + k.storeyH * 1.4, 2);
    if (k.setting === 'forest') for (let y = 0; y < k.storeys; y++) k.box(k.trim, 0, .42 + y * k.storeyH, k.bodyD / 2 + .02, k.bodyW * .92, .08, .06);
    if (k.variant === 2) {
      k.box(k.wall, 0, k.bodyTop + .15, k.bodyD * .22, .7, .55, .55);
      k.cone(k.roof, 0, k.bodyTop + .62, k.bodyD * .22, .55, .55, 4);
    } else chimney(k, k.bodyW * .42, k.bodyTop + .2);
    if (k.setting === 'meadow') for (const dx of [-.7, .7]) k.box(k.mat('#6a8a48'), dx, .22, k.bodyD / 2 + .12, .35, .12, .18);
    steps(k);
    door(k);
  },
  masonry(k) {
    for (let y = 0; y < k.storeys; y++) {
      k.box(k.wall, 0, .28 + (y + .5) * k.storeyH, 0, k.bodyW, k.storeyH - .06, k.bodyD);
      k.box(k.trim, 0, .28 + (y + 1) * k.storeyH, 0, k.bodyW + .22, .1, k.bodyD + .22);
      if (y) windowRow(k, .28 + (y + .5) * k.storeyH, 2, .26, .26);
    }
    k.box(k.roof, 0, k.bodyTop + .14, 0, k.bodyW + .35, .22, k.bodyD + .35);
    if (k.variant === 1) for (const dx of [-1, 1]) k.box(k.trim, dx * k.bodyW * .42, k.bodyTop + .42, 0, .26, .42, k.bodyD + .3);
    if (k.epoch.min >= 72) for (const dx of [-k.bodyW * .42, k.bodyW * .42]) for (const dz of [-k.bodyD * .4, k.bodyD * .4]) k.box(k.trim, dx, k.bodyTop + .42, dz, .28, .42, .28);
    chimney(k, -k.bodyW * .38, k.bodyTop + .5);
    door(k);
  },
  adobe(k) {
    k.cyl(k.wall, 0, k.bodyTop / 2, 0, .95, 1.1, k.bodyTop, 8);
    k.dome(k.roof, 0, k.bodyTop - .05, 0, 1.15, .48);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; k.box(k.trim, Math.cos(a) * 1.05, k.bodyTop * .62, Math.sin(a) * 1.05, .5, .1, .1, -a); }
    windowRow(k, k.bodyTop * .55, k.variant === 1 ? 2 : 1, .24, .24);
    if (k.storeys > 3) { k.cyl(k.wall, 0, k.bodyTop + .45, 0, .6, .72, .8, 8); k.dome(k.roof, 0, k.bodyTop + .82, 0, .78, .5); }
    door(k, 1.02, .4, .9);
  },
  // A platform on piles: the house steps out over the water and keeps its feet dry.
  stilt(k) {
    const deck = .95;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box(k.mat('#5c4a38'), dx * k.bodyW * .42, deck / 2, dz * k.bodyD * .42, .14, deck, .14);
    k.box(k.trim, 0, deck, 0, k.bodyW + .45, .14, k.bodyD + .45);
    k.box(k.wall, 0, deck + .1 + k.storeys * k.storeyH / 2, 0, k.bodyW, k.storeys * k.storeyH, k.bodyD);
    gableRoof(k, deck + k.bodyTop + .35, Math.max(k.bodyW, k.bodyD) * .82, .95);
    for (let i = 0; i < 4; i++) k.box(k.mat('#8d7352'), -.25, .22 + i * .24, k.bodyD * .6 + .1, .5, .07, .07);
    k.box(k.glass, 0, deck + .62, k.bodyD / 2 + .03, .34, .32, .06);
    k.box(k.dark, k.bodyW * .26, deck + .55, k.bodyD / 2 + .02, .38, .85, .08);
    if (k.variant !== 2) { k.box(k.mat('#7d8f7a'), -k.bodyW * .55, deck + .35, 0, .12, .7, .12); k.box(k.accent, -k.bodyW * .55, deck + .78, .1, .1, .34, .3); }
  },
  // Frost: a long low hall whose roof leans all the way down to the snow.
  longhouse(k) {
    const long = k.bodyW * 1.35, deep = k.bodyD * .8;
    const wallTop = .24 + k.storeys * k.storeyH * .76;
    k.box(k.wall, 0, .24 + k.storeys * k.storeyH * .38, 0, long, k.storeys * k.storeyH * .76, deep);
    // Each rafter runs from the ridge down to the ground, so it is tilted about the long axis.
    const peak = wallTop + .55, eave = deep * .78, slope = Math.hypot(eave, peak), pitch = Math.atan2(peak, eave);
    for (const side of [-1, 1]) k.box(k.roof, 0, peak / 2, side * eave / 2, long + .3, .16, slope).rotation.x = side * pitch;
    k.box(k.roof, 0, peak + .06, 0, long + .3, .2, .3);
    k.box(k.mat('#eef6f8', true), 0, peak + .2, 0, long + .1, .12, .26);
    for (const dx of [-1, 1]) k.box(k.glass, dx * long * .3, .62, eave * .74, .26, .24, .06).rotation.x = pitch;
    chimney(k, long * .34, peak + .2);
    k.box(k.dark, 0, .5, eave * .88, .44, .86, .12);
    if (k.variant === 1) for (const dx of [-1, 1]) k.cone(k.mat('#e8f2f6', true), dx * long * .48, peak + .4, 0, .12, .5, 5);
  },
  // City terrace: two narrow gables sharing a wall, the way a street grows.
  row(k) {
    const half = k.bodyW * .52;
    for (const side of [-1, 1]) {
      const h = k.storeys * k.storeyH * (side < 0 || k.variant === 1 ? 1 : .86);
      k.box(k.wall, side * half * .55, .28 + h / 2, 0, half, h, k.bodyD);
      k.cone(k.roof, side * half * .55, .28 + h + .32, 0, half * .78, .8, 4, Math.PI / 4);
      for (let y = 1; y < k.storeys; y++) k.box(k.glass, side * half * .55, .24 + y * k.storeyH, k.bodyD / 2 + .03, .26, .3, .06);
    }
    k.box(k.trim, 0, .28 + k.storeys * k.storeyH * .5, 0, .14, k.storeys * k.storeyH, k.bodyD + .1);
    k.box(k.trim, 0, .24, 0, k.bodyW + .3, .16, k.bodyD + .3);
    chimney(k, 0, .28 + k.storeys * k.storeyH + .45);
    door(k, k.bodyD / 2 + .02, .4, .85);
  },
  // Capital keep: a square tower with battlements and a watch spire.
  tower(k) {
    const side = k.bodyW * .82, top = .3 + k.storeys * k.storeyH * 1.25;
    k.box(k.trim, 0, .2, 0, side + .5, .4, side + .5);
    k.box(k.wall, 0, .3 + (top - .3) / 2, 0, side, top - .3, side);
    for (let y = 1; y < k.storeys; y++) windowRow(k, .3 + y * k.storeyH * 1.1, 2, .2, .3);
    k.box(k.trim, 0, top + .1, 0, side + .42, .2, side + .42);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.box(k.trim, Math.cos(a) * side * .48, top + .34, Math.sin(a) * side * .48, .2, .3, .2); }
    k.cone(k.roof, 0, top + 1.05, 0, side * .5, 1.35, k.variant === 1 ? 6 : 4);
    k.box(k.dark, 0, top + 1.95, 0, .07, .7, .07);
    k.box(k.accent, .3, top + 2.15, 0, .6, .3, .05);
    door(k, side / 2 + .02, .44, 1);
  },
  den(k) {
    const squat = k.setting === 'sand';
    k.box(k.wall, 0, .28 + k.storeys * k.storeyH / 2, 0, k.bodyW * (squat ? 1.05 : .9), k.storeys * k.storeyH + .2, k.bodyD * (squat ? 1 : .88));
    gableRoof(k, k.bodyTop + .85, k.bodyW * (squat ? .82 : .72), 1.35);
    for (const dx of [-.55, .55]) { k.box(k.dark, dx, 1.1, k.bodyD * .42, .16, k.storeys * k.storeyH, .06); k.box(k.accent, dx, 1.7, k.bodyD * .45, .1, .4, .06); }
    k.box(k.dark, 0, .65, k.bodyD * .45, .4, 1.2, .08);
    k.box(k.accent, 0, k.bodyTop + .2, k.bodyD * .46, 1.2, .08, .08);
    for (const dx of k.variant === 1 ? [-1.15, -.4, .4, 1.15] : [-1.05, 1.05]) k.cone(k.accent, dx, 1.55, .25, .16, 1.05, 5);
  },
  // Coast ghouls nail a hull to the shore and live inside the leaning wreck.
  wreck(k) {
    const h = k.storeys * k.storeyH + .3;
    k.box(k.wall, 0, .3 + h / 2, 0, k.bodyW * .95, h, k.bodyD * .85, 0, .09);
    k.box(k.roof, .1, .3 + h + .18, 0, k.bodyW * 1.05, .22, k.bodyD * .95, 0, .09);
    for (let i = 0; i < 4; i++) k.box(k.trim, -.1 + i * .06, .5 + i * .42, k.bodyD * .46, k.bodyW * .9, .1, .07, 0, .09);
    k.box(k.dark, -k.bodyW * .2, .3 + h + 1.1, 0, .12, 2.1, .12, 0, .16);
    k.box(k.mat('#c3b9a0'), -k.bodyW * .2 + .35, .3 + h + 1.2, 0, .7, 1.2, .05, 0, .16);
    k.box(k.accent, 0, .9, k.bodyD * .45, .24, .3, .07);
    k.box(k.dark, .2, .58, k.bodyD * .45, .4, 1.05, .08);
    for (const dx of [-1, 1]) k.cone(k.accent, dx * k.bodyW * .5, .95, -k.bodyD * .3, .14, .8, 5);
    if (k.variant !== 2) k.box(k.mat('#6a5a48'), k.bodyW * .6, .3, k.bodyD * .5, .5, .5, .5, .5);
  },
  // Forest ghouls cage the house in thorns until the walls are barely visible.
  thorn(k) {
    k.box(k.wall, 0, .28 + k.storeys * k.storeyH / 2, 0, k.bodyW * .88, k.storeys * k.storeyH + .2, k.bodyD * .88);
    gableRoof(k, k.bodyTop + .95, k.bodyW * .78, 1.5);
    const spikes = 10;
    for (let i = 0; i < spikes; i++) {
      const a = i / spikes * Math.PI * 2, r = k.bodyW * .62;
      k.cone(k.accent, Math.cos(a) * r, .85 + (i % 3) * .3, Math.sin(a) * r, .12, 1.3 + (i % 3) * .35, 5, a);
    }
    for (const dx of [-.5, .5]) k.box(k.accent, dx, 1.5, k.bodyD * .45, .09, .42, .06);
    k.box(k.dark, 0, .62, k.bodyD * .46, .4, 1.15, .08);
    if (k.variant === 1) k.cone(k.accent, 0, k.bodyTop + 2.1, 0, .18, .9, 5);
  },
  // Ashlands: whatever the last town left behind, stacked and bolted together.
  scrap(k) {
    let y = .24;
    const slabs = Math.min(5, 2 + Math.ceil(k.storeys / 2) + (k.variant === 1 ? 1 : 0));
    for (let i = 0; i < slabs; i++) {
      const w = k.bodyW * (1 - i * .16), d = k.bodyD * (1 - i * .14), h = k.storeyH * (i === 0 ? 1.5 : 1.1);
      k.box(i % 2 ? k.trim : k.wall, (i % 2 ? .12 : -.12), y + h / 2, (i % 2 ? -.1 : .1), w, h, d, i * .22);
      k.box(k.dark, 0, y + h, 0, w + .14, .08, d + .14, i * .22);
      y += h;
    }
    k.box(k.roof, 0, y + .12, 0, k.bodyW * .8, .16, k.bodyD * .8, .3);
    for (const dx of [-1, 1]) k.box(k.mat('#6a5a48'), dx * k.bodyW * .52, .6, k.bodyD * .3, .12, 1.2, .12, .2);
    k.box(k.accent, 0, y + .55, 0, .1, .8, .1);
    k.box(k.glass, .3, .9, k.bodyD * .48, .26, .26, .06);
    k.box(k.dark, -.25, .58, k.bodyD * .5, .4, 1.05, .08);
  },
  // Cliffs and frost: a narrow blade of a house with a jagged crown.
  spire(k) {
    const h = k.storeys * k.storeyH + .9;
    k.box(k.trim, 0, .16, 0, k.bodyW * .9, .32, k.bodyD * .9);
    k.cyl(k.wall, 0, .3 + h / 2, 0, .58, .92, h, 6);
    for (let y = 1; y < k.storeys; y++) for (const dx of [-1, 1]) k.box(k.accent, dx * .55, .3 + y * k.storeyH * 1.1, .25, .08, .34, .06);
    k.cone(k.roof, 0, .3 + h + .95, 0, .95, 1.9, 6, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.cone(k.accent, Math.cos(a) * .75, .3 + h + .35, Math.sin(a) * .75, .1, .85 + (i % 2) * .4, 5, a); }
    if (k.variant === 1) k.cone(k.accent, 0, .3 + h + 2.3, 0, .12, .8, 5);
    k.box(k.dark, 0, .62, .88, .38, 1.15, .1);
  },
  disc(k) {
    k.cyl(k.dark, 0, .24, 0, 1.05, 1.2, .42, 12);
    k.dome(k.wall, 0, .42, 0, 1.15, .7 + k.storeys * .08);
    k.ring(k.accent, 0, .62, 0, 1.12, .07);
    k.cone(k.trim, 0, 1.7 + k.storeys * .12, 0, .28, 1.05 + k.storeys * .1, 5);
    const legs = k.variant === 1 ? 4 : 3;
    for (let i = 0; i < legs; i++) { const a = i / legs * Math.PI * 2; k.box(k.dark, Math.cos(a) * 1.2, .85, Math.sin(a) * 1.2, .22, 1.15, .22); k.ball(k.accent, Math.cos(a) * 1.2, 1.55, Math.sin(a) * 1.2, .14); }
    k.box(k.glass, 0, .95, 1.02, .6, .2, .07);
    k.box(k.dark, 0, .55, 1.1, .5, .8, .12);
  },
  obelisk(k) {
    k.cyl(k.wall, 0, k.bodyTop * .35, 0, .2, 1.35, k.bodyTop * .7, 4, Math.PI / 4);
    k.dome(k.accent, 0, k.bodyTop * .55, 0, 1.05, .45);
    k.cone(k.trim, 0, k.bodyTop + 1.1, 0, .28, 1.4 + k.storeys * .12, 4);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.box(k.glass, Math.cos(a) * 1.05, k.bodyTop * .32, Math.sin(a) * 1.05, .5, .12, .12, -a); }
    if (k.variant === 1) k.ring(k.accent, 0, k.bodyTop + .5, 0, .8, .05);
    k.box(k.dark, 0, .5, 1.15, .5, .8, .12);
  },
  // Forest: a pod lifted clear of the canopy on a single stalk.
  canopy(k) {
    const lift = 1.15 + k.storeys * .12;
    k.cyl(k.dark, 0, lift / 2, 0, .3, .5, lift, 8);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box(k.dark, Math.cos(a) * .5, .3, Math.sin(a) * .5, .16, .6, .16, -a); }
    k.dome(k.wall, 0, lift, 0, 1.1, .82);
    k.dome(k.accent, 0, lift + .82, 0, .62, .55);
    k.ring(k.accent, 0, lift + .18, 0, 1.18, .06);
    for (let i = 0; i < (k.variant === 1 ? 4 : 3); i++) {
      const a = i / (k.variant === 1 ? 4 : 3) * Math.PI * 2 + .4;
      k.box(k.trim, Math.cos(a) * 1.15, lift + .45, Math.sin(a) * 1.15, .5, .4, .07, -a);
    }
    k.box(k.glass, 0, lift + .42, 1.02, .55, .22, .07);
    k.cone(k.trim, 0, lift + 1.55, 0, .2, .95, 5);
  },
  // Coast: flat lenses hovering just over the tide, one more for every generation.
  tide(k) {
    const decks = Math.min(3, 1 + Math.floor(k.storeys / 2));
    for (let d = 0; d < decks; d++) {
      const y = .5 + d * .62, r = 1.35 - d * .3;
      k.dome(k.wall, 0, y + .05, 0, r, .42);
      k.cyl(k.dark, 0, y, 0, r * .89, r * .98, .3, 10);
      k.ring(k.accent, 0, y - .08, 0, r * 1.08, .06, 14);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + d; k.box(k.glass, Math.cos(a) * r * .95, y + .1, Math.sin(a) * r * .95, .3, .14, .06, -a); }
    }
    const top = .5 + (decks - 1) * .62;
    k.dome(k.accent, 0, top + .28, 0, .72, .62);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .78; k.cyl(k.dark, Math.cos(a) * 1, .18, Math.sin(a) * 1, .1, .18, .36, 6); }
    if (k.variant === 1) k.ring(k.accent, 0, top + .75, 0, .55, .05, 14);
    k.box(k.dark, 0, .42, 1.3, .44, .5, .1);
  },
  // Highland and capital: a segmented mast with rings that float around it.
  beacon(k) {
    const h = 1.3 + k.storeys * .34;
    k.cyl(k.dark, 0, .2, 0, .85, 1.05, .4, 10);
    for (let i = 0; i < 3; i++) k.cyl(k.wall, 0, .4 + h * (i + .5) / 3, 0, .5 - i * .1, .72 - i * .1, h / 3 - .08, 8);
    for (let i = 0; i < 3; i++) k.ring(k.accent, 0, .55 + h * (i + .3) / 3, 0, .9 - i * .16, .05, 18);
    k.dome(k.accent, 0, .4 + h, 0, .55, .9);
    k.cone(k.trim, 0, .4 + h + 1.1, 0, .2, 1.3, 5);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box(k.dark, Math.cos(a) * .95, .55, Math.sin(a) * .95, .16, .9, .16, -a); }
    if (k.variant === 1) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; k.ball(k.accent, Math.cos(a) * 1.15, .4 + h * .7, Math.sin(a) * 1.15, .11); }
    k.box(k.glass, 0, .85, .78, .4, .5, .07);
  },
  cap(k) {
    const wide = 1, tall = k.storeys > 4;
    k.cyl(k.wall, 0, .7 + k.storeys * .06 + (tall ? .15 : 0), 0, .7 * wide, 1 * wide, 1.15 + k.storeys * .12 + (tall ? .35 : 0), 8);
    k.dome(k.roof, 0, 1.4 + k.storeys * .08 + (tall ? .2 : 0), 0, 1.4 * wide, .55);
    for (let i = 0; i < 7; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * .9, 2.15 + k.storeys * .06, Math.sin(a) * .75, .15, .2); }
    k.box(k.dark, 0, .5, .88, .42, 1, .1);
    k.ball(k.accent, .48, 1.2, .7, .16, 1);
    for (const sign of [-1, 1]) { k.cyl(k.wall, sign * 1.15, .28, .55, .12, .2, .6, 5); k.dome(k.accent, sign * 1.15, .6, .55, .4, .55); }
    if (k.variant === 1) k.box(k.glass, 0, 1.15, .92, .3, .22, .06);
  },
  cluster(k) {
    for (const sign of [-1, 0, 1]) {
      const h = .9 + k.storeys * .08 + (sign === 0 ? .45 : 0);
      k.cyl(k.wall, sign * .85, h / 2 + .1, sign * .15, .22, .38, h, 8);
      k.dome(k.roof, sign * .85, h + .08, sign * .15, .72 + (sign === 0 ? .12 : 0), .45);
      if (sign === 0) k.box(k.dark, 0, .5, .55, .38, .9, .1);
      else k.box(k.glass, sign * .85, .62, .32, .22, .2, .06);
    }
    for (let i = 0; i < 5; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * .55, 1.55 + k.storeys * .06, Math.sin(a) * .45, .12, .22); }
    if (k.variant === 1) for (const sign of [-1, 1]) k.dome(k.accent, sign * 1.5, .26, -.5, .32, .5);
  },
  // Forest: a fairy ring, small caps circling the one the family lives in.
  ring(k) {
    const h = 1.05 + k.storeys * .1;
    k.cyl(k.wall, 0, h / 2 + .1, 0, .55, .82, h, 8);
    k.dome(k.roof, 0, h + .05, 0, 1.18, .58);
    const outer = k.variant === 1 ? 6 : 5;
    for (let i = 0; i < outer; i++) {
      const a = i / outer * Math.PI * 2 + .3, r = 1.5, small = .34 + (i % 2) * .12;
      k.cyl(k.wall, Math.cos(a) * r, .28, Math.sin(a) * r, .12, .2, .5, 6);
      k.dome(k.roof, Math.cos(a) * r, .5, Math.sin(a) * r, small + .18, .6);
    }
    for (let i = 0; i < 6; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * .75, h + .38, Math.sin(a) * .62, .13, .22); }
    k.box(k.dark, 0, .5, .78, .4, .95, .1);
    k.ball(k.accent, 0, h + .62, 0, .18, 1);
  },
  // Dunes: a puffball sitting straight on the sand, no stalk at all.
  puff(k) {
    const r = 1.25 + k.storeys * .05;
    k.ball(k.wall, 0, r * .78, 0, r, .88, 10);
    k.dome(k.roof, 0, r * 1.15, 0, r * .68, .5);
    for (let i = 0; i < 9; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * r * .72, r * .95, Math.sin(a) * r * .6, .13, .3); }
    k.box(k.dark, 0, .48, r * .88, .42, .92, .1);
    k.box(k.glass, -.5, .85, r * .8, .24, .22, .06);
    if (k.variant === 1) for (const sign of [-1, 1]) k.ball(k.accent, sign * (r + .35), .3, -.35, .32, .7);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .5; k.cone(k.accent, Math.cos(a) * (r + .15), .2, Math.sin(a) * (r + .15), .12, .45, 5); }
  },
  // Cliffs: bracket fungi shelved on a stump, each floor a wider lip than the last.
  shelf(k) {
    const trunk = 1.2 + k.storeys * .16;
    k.cyl(k.wall, 0, trunk / 2 + .1, 0, .62, .85, trunk, 7);
    const shelves = Math.min(4, 2 + Math.floor(k.storeys / 2));
    for (let i = 0; i < shelves; i++) {
      const y = .55 + i * (trunk / shelves), side = i % 2 ? 1 : -1, r = .95 - i * .1;
      k.dome(k.roof, side * .35, y, 0, r, .32);
      k.box(k.trim, side * .35, y - .06, 0, r * 1.5, .07, r * 1.2);
      if (i % 2 === 0) k.box(k.glass, side * .5, y + .2, r * .6, .22, .18, .06);
    }
    k.dome(k.roof, 0, trunk + .12, 0, 1.05, .52);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * .6, trunk + .42, Math.sin(a) * .5, .12, .24); }
    k.box(k.dark, 0, .5, .8, .4, .95, .1);
    if (k.variant === 1) k.ball(k.accent, 0, trunk + .55, 0, .16, 1);
  },
  // Capital: caps stacked like the tiers of a pagoda.
  pagoda(k) {
    const tiers = 4;
    let y = .2;
    k.cyl(k.wall, 0, .5, 0, .68, .95, 1, 8);
    y = 1;
    for (let i = 0; i < tiers; i++) {
      const r = 1.35 - i * .2;
      k.dome(k.roof, 0, y, 0, r, .36);
      k.box(k.trim, 0, y - .04, 0, r * 1.7, .06, r * 1.7, i * .3);
      k.cyl(k.wall, 0, y + .32, 0, .38 - i * .05, .5 - i * .05, .66, 8);
      if (i < 2) for (const dx of [-1, 1]) k.box(k.glass, dx * .3, y + .35, .42 - i * .04, .18, .2, .05);
      y += .66;
    }
    k.dome(k.roof, 0, y, 0, .72, .55);
    k.cone(k.accent, 0, y + .6, 0, .14, .8, 5);
    for (let i = 0; i < 6; i++) { const a = i * 2.4; k.ball(k.trim, Math.cos(a) * .95, 1.1, Math.sin(a) * .8, .12, .3); }
    k.box(k.dark, 0, .5, .92, .42, .95, .1);
    if (k.variant === 1) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; k.cyl(k.wall, Math.cos(a) * 1.5, .3, Math.sin(a) * 1.5, .1, .18, .5, 6); k.dome(k.roof, Math.cos(a) * 1.5, .52, Math.sin(a) * 1.5, .42, .5); }
  },
  // Forest: a log cabin with stacked timber, a stone chimney and a small porch.
  cabin(k) {
    const h = k.storeys * k.storeyH * .9;
    k.box(k.wall, 0, .22 + h / 2, 0, k.bodyW, h, k.bodyD);
    for (let i = 0; i < 5; i++) k.box(k.trim, 0, .32 + i * .28, k.bodyD / 2 + .03, k.bodyW * .98, .08, .08);
    for (const dx of [-1, 1]) k.box(k.mat('#5c4a38'), dx * k.bodyW * .48, .2 + h / 2, k.bodyD / 2 + .12, .12, h + .2, .12);
    gableRoof(k, .22 + h + .52, Math.max(k.bodyW, k.bodyD) * .86, 1.05);
    k.box(k.trim, 0, .16, k.bodyD / 2 + .28, k.bodyW * .7, .12, .55);
    k.box(k.wall, 0, .42, k.bodyD / 2 + .22, .55, .55, .12);
    windowRow(k, .22 + h * .55, 1, .28, .28);
    chimney(k, k.bodyW * .38, .22 + h + .15);
    k.box(k.mat('#4a6a3a'), -k.bodyW * .55, .18, k.bodyD * .2, .22, .28, .22);
    door(k, k.bodyD / 2 + .14, .36, .78);
  },
  // Meadow hamlet: a thatched cottage with a porch, flower boxes and a round door.
  cottage(k) {
    const h = k.storeys * k.storeyH * .82;
    k.box(k.wall, 0, .22 + h / 2, 0, k.bodyW * .92, h, k.bodyD * .9);
    k.cone(k.roof, 0, .22 + h + .72, 0, Math.max(k.bodyW, k.bodyD) * .92, 1.35, 8);
    k.cone(k.trim, 0, .22 + h + .08, 0, Math.max(k.bodyW, k.bodyD) * .96, .16, 8);
    k.box(k.trim, 0, .14, k.bodyD * .55, k.bodyW * .7, .12, .7);
    k.box(k.wall, 0, .42, k.bodyD * .52, .7, .5, .35);
    k.cyl(k.dark, 0, .42, k.bodyD * .72, .18, .22, .72, 8);
    windowRow(k, .22 + h * .52, 2, .24, .28);
    for (const dx of [-.65, .65]) { k.box(k.trim, dx, .55, k.bodyD * .48, .32, .08, .12); k.box(k.mat('#d08090'), dx, .64, k.bodyD * .5, .22, .12, .1); }
    chimney(k, k.bodyW * .32, .22 + h + .35);
    if (k.variant === 1) k.box(k.mat('#6f8a48'), k.bodyW * .55, .16, -.2, .5, .18, .7);
    steps(k, k.bodyD * .72);
  },
  // Ashlands: a house that burned and was lived in anyway — broken roof, standing chimney.
  ruin(k) {
    const h = k.storeys * k.storeyH * .7;
    k.box(k.wall, -.15, .22 + h / 2, 0, k.bodyW * .85, h, k.bodyD * .8);
    k.box(k.trim, .35, .22 + h * .35, .1, k.bodyW * .4, h * .55, k.bodyD * .5, .18);
    k.box(k.roof, -.1, .22 + h + .12, -.05, k.bodyW * .7, .16, k.bodyD * .55, -.25);
    k.box(k.dark, 0, .12, 0, k.bodyW * .9, .14, k.bodyD * .9);
    chimney(k, k.bodyW * .32, .22 + h + .4);
    k.box(k.glass, -.2, .7, k.bodyD * .42, .22, .28, .05);
    k.box(k.dark, .15, .45, k.bodyD * .42, .32, .7, .06);
    for (const dx of [-.9, .85]) k.box(k.mat('#6a5a48'), dx, .22, .6, .28, .28, .22);
    if (k.variant !== 2) k.cone(k.mat('#4a433c'), .7, .55, -.4, .18, .7, 5);
  },
  // Dunes: ghouls dug a pit house and ringed it with bone spikes.
  pit(k) {
    k.cyl(k.wall, 0, .35, 0, 1.05, 1.25, .7, 8);
    k.dome(k.roof, 0, .62, 0, 1.22, .42);
    k.box(k.trim, 0, .08, 0, 2.2, .12, 2.2);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + .2;
      k.cone(k.accent, Math.cos(a) * 1.15, .55, Math.sin(a) * 1.15, .08, .7 + (i % 3) * .2, 5, a);
    }
    k.box(k.dark, 0, .42, 1.15, .5, .55, .12);
    k.box(k.accent, 0, .72, 1.18, .2, .12, .06);
    if (k.variant === 1) k.cone(k.accent, 0, 1.35, 0, .16, .7, 5);
    windowRow(k, .55, 1, .2, .18);
  },
  // Frost: stacked ice bricks, hanging icicles, a snow cap.
  ice(k) {
    const h = k.storeys * k.storeyH + .2;
    k.box(k.wall, 0, .22 + h / 2, 0, k.bodyW * .88, h, k.bodyD * .88);
    for (let y = 0; y < 3; y++) k.box(k.trim, 0, .4 + y * .42, k.bodyD * .45, k.bodyW * .92, .08, .06);
    k.cone(k.roof, 0, .22 + h + .55, 0, k.bodyW * .72, 1.05, 6);
    k.cone(k.mat('#eef6f8', true), 0, .22 + h + .95, 0, .22, .55, 5);
    for (const dx of [-.7, -.25, .25, .7]) k.cone(k.mat('#dbeaf0', true), dx, .18, k.bodyD * .48, .05, .28 + Math.abs(dx) * .15, 5);
    k.box(k.accent, 0, .22 + h + .15, k.bodyD * .46, k.bodyW * .6, .08, .08);
    k.box(k.dark, 0, .55, k.bodyD * .46, .36, 1, .08);
    if (k.variant === 1) for (const dx of [-1, 1]) k.cone(k.accent, dx * k.bodyW * .5, 1.1, .2, .1, .85, 5);
  },
  // Frost aliens: a disc locked in a lattice of floating crystals.
  crystal(k) {
    k.cyl(k.dark, 0, .22, 0, 1, 1.15, .38, 10);
    k.dome(k.wall, 0, .4, 0, 1.08, .72);
    k.ring(k.accent, 0, .58, 0, 1.15, .06, 16);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, r = 1.25;
      k.cone(k.trim, Math.cos(a) * r, .85, Math.sin(a) * r, .12, .85 + (i % 2) * .35, 5, a);
      k.ball(k.accent, Math.cos(a) * r, 1.35 + (i % 2) * .2, Math.sin(a) * r, .1);
    }
    k.cone(k.trim, 0, 1.65, 0, .22, 1.05, 5);
    k.box(k.glass, 0, .9, 1, .55, .18, .06);
    k.box(k.dark, 0, .5, 1.08, .44, .7, .1);
    if (k.variant === 1) k.ring(k.accent, 0, 1.15, 0, .7, .04, 14);
  },
  // Ashlands aliens: broken plates stacked like a crashed beacon.
  shard(k) {
    k.cyl(k.dark, 0, .18, 0, .7, .95, .36, 8);
    k.box(k.wall, 0, .7, 0, 1.4, .22, .9, .35);
    k.box(k.trim, .15, 1.05, -.1, 1.1, .18, .7, -.4);
    k.box(k.wall, -.1, 1.4, .12, .8, .16, .55, .55);
    k.cone(k.accent, .2, 1.95, 0, .18, .85, 4, .4);
    for (const a of [0, 2.1, 4.2]) k.box(k.dark, Math.cos(a) * .85, .55, Math.sin(a) * .85, .14, .9, .14, -a);
    k.ball(k.accent, 0, 1.55, 0, .16);
    k.box(k.glass, .3, .85, .55, .3, .14, .06);
    k.box(k.dark, 0, .42, .9, .4, .55, .1);
    if (k.variant !== 2) k.box(k.mat('#6a5a48'), .85, .28, .45, .4, .35, .35, .6);
  },
  // Frost mycelites: a frozen cap with hanging ice and a pale garden.
  rime(k) {
    k.cyl(k.wall, 0, .65, 0, .62, .92, 1.1, 8);
    k.dome(k.roof, 0, 1.28, 0, 1.28, .52);
    k.dome(k.mat('#e8f2f6', true), 0, 1.48, 0, .85, .32);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      k.cone(k.mat('#dbeaf0', true), Math.cos(a) * .95, .85, Math.sin(a) * .85, .07, .45, 5);
      k.ball(k.trim, Math.cos(a) * .7, 1.55, Math.sin(a) * .55, .12, .22);
    }
    k.box(k.dark, 0, .48, .88, .4, .9, .1);
    for (const sign of [-1, 1]) { k.cyl(k.wall, sign * 1.15, .26, .4, .1, .16, .5, 5); k.dome(k.roof, sign * 1.15, .5, .4, .32, .45); }
    if (k.variant === 1) k.cone(k.accent, 0, 1.95, 0, .12, .55, 5);
  },
  // Meadow hold: a squat stone hall with a thick roof and an iron door.
  hold(k) {
    const h = k.storeys * k.storeyH * .88;
    k.box(k.wall, 0, .22 + h / 2, 0, k.bodyW * .95, h, k.bodyD * .92);
    k.box(k.trim, 0, .22, 0, k.bodyW + .16, .12, k.bodyD + .16);
    k.box(k.roof, 0, .22 + h + .16, 0, k.bodyW + .28, .28, k.bodyD + .28);
    k.box(k.trim, 0, .22 + h + .32, 0, k.bodyW * .4, .12, k.bodyD + .1);
    windowRow(k, .22 + h * .48, k.storeys > 2 ? 2 : 1, .26, .26);
    chimney(k, k.bodyW * .38, .22 + h + .2);
    door(k, k.bodyD / 2 + .02, .38, .82);
    if (k.variant === 1) for (const dx of [-1, 1]) k.box(k.trim, dx * k.bodyW * .48, .22 + h + .42, 0, .18, .42, k.bodyD * .4);
    steps(k);
  },
  // Camp and forest: a house dug into a mound, round door, timber posts.
  delve(k) {
    k.box(k.trim, 0, .12, 0, k.bodyW + .4, .2, k.bodyD + .45);
    k.dome(k.wall, 0, .28, 0, 1.15, .72);
    k.dome(k.roof, 0, .55, 0, .95, .42);
    for (const dx of [-1, 1]) k.box(k.mat('#5c4a38'), dx * .85, .45, .55, .12, .85, .12);
    k.cyl(k.dark, 0, .42, 1.02, .18, .22, .72, 8);
    k.box(k.glass, .4, .62, .95, .2, .18, .05);
    if (k.variant === 1) k.box(k.accent, 0, 1.15, 0, .12, .35, .12);
  },
  // Iron and highland: a hold with a chimney stack, anvil, and a glowing window.
  forge(k) {
    const h = k.storeys * k.storeyH * .9;
    k.box(k.wall, 0, .22 + h / 2, 0, k.bodyW * .9, h, k.bodyD * .88);
    k.box(k.roof, 0, .22 + h + .14, 0, k.bodyW + .2, .24, k.bodyD + .2);
    k.box(k.trim, 0, .22 + h + .32, 0, .3, .18, k.bodyD + .05);
    k.box(k.dark, k.bodyW * .38, .22 + h + .7, 0, .22, 1.1, .22);
    k.box(k.dark, k.bodyW * .38, .22 + h + 1.28, 0, .3, .12, .3);
    k.box(k.glass, -.3, .7, k.bodyD * .46, .34, .28, .06);
    k.box(k.accent, -.3, .7, k.bodyD * .5, .22, .16, .04);
    k.box(k.trim, .7, .28, k.bodyD * .55, .45, .16, .35);
    k.box(k.dark, .7, .42, k.bodyD * .55, .28, .14, .22);
    door(k, k.bodyD / 2 + .02, .36, .78);
    if (k.variant === 1) k.cone(k.dark, k.bodyW * .38, .22 + h + 1.55, 0, .08, .35, 5);
  },
  // City keep: a square tower with battlements, shorter than a human spire.
  keep(k) {
    const side = k.bodyW * .78, top = .28 + k.storeys * k.storeyH * 1.05;
    k.box(k.trim, 0, .16, 0, side + .4, .32, side + .4);
    k.box(k.wall, 0, .28 + (top - .28) / 2, 0, side, top - .28, side);
    for (let y = 1; y < k.storeys; y++) windowRow(k, .28 + y * k.storeyH, 2, .2, .26);
    k.box(k.trim, 0, top + .08, 0, side + .32, .16, side + .32);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box(k.trim, dx * side * .42, top + .28, dz * side * .42, .22, .28, .22);
    k.cone(k.roof, 0, top + .75, 0, side * .42, .95, 4);
    door(k, side / 2 + .02, .4, .9);
  },
  // Frost: a turf barrow under snow, stone door-ring, hanging ice.
  barrow(k) {
    k.box(k.trim, 0, .1, 0, 2.2, .16, 2.1);
    k.dome(k.wall, 0, .22, 0, 1.18, .7);
    k.dome(k.mat('#eef6f8', true), 0, .48, 0, 1.05, .42);
    k.cyl(k.dark, 0, .4, 1.05, .2, .26, .7, 8);
    k.box(k.trim, 0, .55, 1.12, .55, .08, .1);
    for (const dx of [-.55, -.18, .18, .55]) k.cone(k.mat('#dbeaf0', true), dx, .18, 1, .05, .22 + Math.abs(dx) * .12, 5);
    if (k.variant === 1) k.cone(k.mat('#e8f2f6', true), 0, 1.15, 0, .14, .4, 5);
    k.box(k.glass, .35, .55, .95, .16, .14, .05);
  },
  // Dunes and ash: a stepped quarry house cut from the rock.
  quarry(k) {
    k.box(k.trim, 0, .1, 0, 2.15, .16, 2.05);
    k.box(k.wall, 0, .35, 0, 1.7, .5, 1.55);
    k.box(k.wall, 0, .72, 0, 1.25, .42, 1.15);
    k.box(k.roof, 0, 1.02, 0, 1.45, .16, 1.35);
    k.box(k.dark, 0, .42, .82, .42, .7, .1);
    k.box(k.glass, -.4, .7, .62, .2, .18, .05);
    if (k.variant === 1) for (const dx of [-1, 1]) k.box(k.trim, dx * .85, .55, -.3, .18, .7, .18);
    for (const n of [-1, 1]) k.box(k.mat('#c9a66a'), n * 1.05, .18, .4, .4, .18, .5);
  },
  // Coast: a stone warehouse on a short quay.
  wharf(k) {
    const deck = .42;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) k.box(k.mat('#5c4a38'), dx * k.bodyW * .4, deck / 2, dz * k.bodyD * .4, .12, deck, .12);
    k.box(k.trim, 0, deck, 0, k.bodyW + .35, .12, k.bodyD + .4);
    const h = k.storeys * k.storeyH * .82;
    k.box(k.wall, 0, deck + .08 + h / 2, 0, k.bodyW * .92, h, k.bodyD * .82);
    k.box(k.roof, 0, deck + .08 + h + .14, 0, k.bodyW + .05, .22, k.bodyD);
    k.box(k.glass, 0, deck + .55, k.bodyD * .42, .3, .24, .06);
    k.box(k.dark, .25, deck + .45, k.bodyD * .42, .32, .7, .08);
    for (let i = 0; i < 3; i++) k.box(k.mat('#8d7352'), -.2, .12 + i * .16, k.bodyD * .55, .45, .06, .08);
    if (k.variant !== 2) k.box(k.accent, -k.bodyW * .42, deck + h, 0, .08, .45, .08);
  },
  // Waste mycelites: a charred puff, cracked and smoking.
  cinder(k) {
    const r = 1.15 + k.storeys * .04;
    k.ball(k.wall, 0, r * .72, 0, r, .82, 9);
    k.dome(k.roof, 0, r * 1.05, 0, r * .62, .42);
    k.cone(k.dark, .25, r * 1.35, -.1, .16, .55, 5);
    for (let i = 0; i < 6; i++) { const a = i * 2.2; k.ball(k.trim, Math.cos(a) * r * .65, r * .85, Math.sin(a) * r * .5, .1, .22); }
    k.box(k.dark, 0, .45, r * .82, .4, .85, .1);
    k.box(k.mat('#6a5a48'), r * .7, .22, .35, .35, .28, .28);
    if (k.variant === 1) for (const sign of [-1, 1]) k.cone(k.dark, sign * (r * .55), r * .4, -.5, .12, .45, 5);
  },
};

export function buildHouse(kit, form) { (FORMS[form] ?? FORMS.gable)(kit); }
