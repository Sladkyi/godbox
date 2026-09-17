import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World, TILE } from '../src/world.js';
import { SETTINGS, RACES, EPOCHS, MATERIALS } from '../src/civilizations.js';
import { Scenery3D } from '../src/scenery3d.js';
import { HOUSE_FORMS, houseForm } from '../src/houses3d.js';

function mockRenderer(world) {
  const scene = new THREE.Scene();
  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);
  return {
    world, scene, buildingGroup,
    addBox(group, material, x, y, z, sx, sy, sz) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
    },
    instances() { return { count: 0 }; },
  };
}

// The group a building leaves behind holds one fused mesh; its bounds describe the whole roof.
function bounds(group) {
  const shell = group.children.at(-1);
  shell.geometry.computeBoundingBox();
  return shell.geometry.boundingBox;
}

test('3D structures stay finite for every race, setting and epoch', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const v = world.createVillage(24, 24, true, 'human');
  const r = mockRenderer(world);
  const scenery = new Scenery3D(r);
  let id = 0;
  for (const race of Object.keys(RACES)) for (const setting of SETTINGS) for (const epoch of EPOCHS) {
    v.population = epoch.min; v.race = race;
    for (const material of Object.keys(MATERIALS)) for (const type of ['house', 'hall', 'farm', 'pen']) {
      const b = { id: ++id, villageId: v.id, x: 24, y: 24, type, material, race, complete: true, progress: 1, crop: 6, setting };
      const before = r.buildingGroup.children.length;
      scenery.structure(b);
      assert.ok(r.buildingGroup.children.length > before);
      const who = `${race}/${setting}/${epoch.id}/${type}`;
      const group = r.buildingGroup.children.at(-1);
      assert.equal(group.children.length, 1, `${who} should fuse into a single mesh`);
      assert.ok(group.position.toArray().every(Number.isFinite), `${who} position`);
      assert.ok(group.scale.toArray().every(n => Number.isFinite(n) && n > 0), `${who} scale`);
      const box = bounds(group);
      assert.ok(box.min.toArray().concat(box.max.toArray()).every(Number.isFinite), `${who} bounds`);
    }
  }
  scenery.dispose();
});

test('buildings stand on the ground and stay on their plot', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const v = world.createVillage(24, 24, true, 'human');
  const r = mockRenderer(world);
  const scenery = new Scenery3D(r);
  for (const race of Object.keys(RACES)) for (const setting of SETTINGS) for (const epoch of EPOCHS) for (const variant of [0, 1, 2]) {
    v.population = epoch.min; v.race = race;
    scenery.structure({ id: 7, villageId: v.id, x: 24, y: 24, type: 'house', material: 'wood', race, variant, complete: true, progress: 1, crop: 6, setting });
    const group = r.buildingGroup.children.at(-1);
    const box = bounds(group), who = `${race}/${setting}/${epoch.id}/v${variant}`;
    assert.ok(box.min.y > -.25, `${who} sinks into the ground (${box.min.y.toFixed(2)})`);
    assert.ok(box.max.y > .5, `${who} is too flat to see (${box.max.y.toFixed(2)})`);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * group.scale.x;
    assert.ok(span < 3, `${who} spills over its neighbours (${span.toFixed(2)} tiles)`);
  }
  scenery.dispose();
});

test('every house form is reachable and every variant builds', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const v = world.createVillage(24, 24, true, 'human');
  const r = mockRenderer(world);
  const scenery = new Scenery3D(r);
  const seen = new Set();
  for (const race of Object.keys(RACES)) for (const setting of SETTINGS) for (const epoch of EPOCHS) for (const material of Object.keys(MATERIALS)) {
    seen.add(`${race}:${houseForm(race, setting, epoch, material)}`);
  }
  for (const [race, forms] of Object.entries(HOUSE_FORMS)) for (const form of forms) {
    assert.ok(seen.has(`${race}:${form}`), `${race} never builds a ${form}`);
  }

  for (const race of Object.keys(RACES)) for (const setting of SETTINGS) for (const variant of [0, 1, 2]) {
    v.population = EPOCHS.at(-1).min; v.race = race;
    const before = r.buildingGroup.children.length;
    scenery.structure({ id: 7, villageId: v.id, x: 24, y: 24, type: 'house', material: 'wood', race, variant, complete: true, progress: 1, crop: 6, setting });
    assert.ok(r.buildingGroup.children.length > before);
  }
  scenery.dispose();
});

test('two houses on the same tile differ, the same id repeats itself', () => {
  const world = new World({ width: 48, height: 48, preset: 'ocean', populate: false });
  world.tiles.fill(TILE.GRASS); world.navRevision++;
  const v = world.createVillage(24, 24, true, 'human');
  const r = mockRenderer(world);
  const scenery = new Scenery3D(r);
  const shape = id => {
    scenery.structure({ id, villageId: v.id, x: 24, y: 24, type: 'house', material: 'wood', race: 'human', complete: true, progress: 1, crop: 6, setting: 'meadow' });
    const group = r.buildingGroup.children.at(-1);
    return `${group.rotation.y.toFixed(4)}:${group.scale.x.toFixed(4)}:${bounds(group).max.y.toFixed(4)}`;
  };
  const shapes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(shape));
  assert.ok(shapes.size > 1, 'a street of houses should not be a row of clones');
  assert.equal(shape(3), shape(3), 'the same house must look the same every rebuild');
  scenery.dispose();
});
