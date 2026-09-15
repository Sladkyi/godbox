import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { buildTerrainData, tileHeight } from '../src/terrain3d.js';
import { Renderer } from '../src/renderer3d.js';

test('all visible voxel faces point outwards and contain finite coordinates', () => {
  const world = new World({ width: 48, height: 32, seed: 97 });
  const { positions, normals, colors } = buildTerrainData(world);
  assert.equal(positions.length, normals.length);
  assert.equal(positions.length, colors.length);
  assert.ok(positions.every(Number.isFinite));
  assert.ok(positions.length > 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < positions.length; i += 9) {
    a.fromArray(positions, i); b.fromArray(positions, i + 3); c.fromArray(positions, i + 6); n.fromArray(normals, i);
    b.sub(a).cross(c.sub(a)).normalize();
    assert.ok(b.dot(n) > .999, `Face ${i/9} has inverted winding`);
  }
});

test('the ocean has no solid terrain; painting and flooding change 3D geometry', () => {
  const world = new World({ preset: 'ocean', populate: false });
  assert.equal(buildTerrainData(world).positions.length, 0);
  world.paint('grass', 60, 60, 4);
  assert.ok(buildTerrainData(world).positions.length > 0);
  assert.ok(tileHeight(world, 60, 60) > .25);
  world.paint('mountain', 60, 60, 4);
  assert.ok(tileHeight(world, 60, 60) > 3);
  world.paint('water', 60, 60, 4);
  assert.equal(buildTerrainData(world).positions.length, 0);
});

test('raycasting selects the same terrain cell after orbit, pan, resize and zoom', () => {
  const world = new World({ width: 48, height: 32, preset: 'ocean', populate: false });
  world.paint('mountain', 24, 16, 1);
  const { positions } = buildTerrainData(world);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const land = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); land.updateMatrixWorld();
  // Exercise the actual camera and picking methods without constructing a GPU renderer.
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    world, w: 1280, h: 650, camera: new THREE.OrthographicCamera(-1,1,1,-1,.1,1000),
    target: new THREE.Vector3(0,1,0), yaw: -.28, pitch: .86, zoom: 1,
    raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), landMesh: land,
    plane: new THREE.Plane(new THREE.Vector3(0,1,0), -.25),
  });
  const check = () => {
    renderer.updateCamera();
    const p = new THREE.Vector3(.5, tileHeight(world,24,16), .5).project(renderer.camera);
    const selected = renderer.screenToWorld((p.x+1)*renderer.w/2,(1-p.y)*renderer.h/2);
    assert.ok(Math.abs(selected.x-24.5) < .0001);
    assert.ok(Math.abs(selected.y-16.5) < .0001);
  };
  check(); renderer.orbit(85, -15); check(); renderer.pan(40, -20); check(); renderer.changeZoom(2); check();
  renderer.w = 390; renderer.h = 782; check();
  geometry.dispose(); land.material.dispose();
});
