import * as THREE from 'three';
import { World, TILE } from './world.js';
import { Scenery3D } from './scenery3d.js';
import { RACES, MATERIALS, SETTINGS, SETTING_NAMES, EPOCHS, structureName } from './civilizations.js';
import { houseForm } from './houses3d.js';
import { tileHeight } from './terrain3d.js';

const GROUND = { meadow: '#7ea45c', coast: '#6d9aa0', forest: '#3f5c3a', sand: '#c9ae72', highland: '#8a9288', frost: '#d5e0d4', waste: '#6b6558' };
const SKY = { meadow: '#1f4652', coast: '#0f3a48', forest: '#173328', sand: '#3d3428', highland: '#2c353c', frost: '#31454d', waste: '#2a2622' };

const world = new World({ width: 16, height: 16, populate: false, preset: 'ocean' });
world.tiles.fill(TILE.GRASS);
world.variation.fill(90);
const village = { id: 1, x: 8.5, y: 8.5, population: 0, race: 'human', name: 'Catalog' };
world.villages.push(village);

const canvas = document.getElementById('studio');
const gpu = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
gpu.setPixelRatio(1);
gpu.setSize(280, 280, false);
gpu.outputColorSpace = THREE.SRGBColorSpace;
gpu.toneMapping = THREE.ACESFilmicToneMapping;
gpu.toneMappingExposure = 1.22;
gpu.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff2d8, 0x3a6a62, 1.35));
const sun = new THREE.DirectionalLight(0xffe4b0, 2.55);
sun.position.set(-6, 10, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x7ec8d8, .55);
fill.position.set(7, 4, -6);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xf0c878, .3);
rim.position.set(2, 3, 8);
scene.add(rim);

const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 40);
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);
const box = new THREE.BoxGeometry(1, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: GROUND.meadow, roughness: 1, flatShading: true });
const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, .2, 28), groundMat);
ground.receiveShadow = true;
scene.add(ground);

const renderer = {
  world, scene, buildingGroup, box,
  addBox(group, material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  },
  instances(geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.count = 0; scene.add(mesh); return mesh;
  },
};
const scenery = new Scenery3D(renderer);

function clearBuildings() {
  const geometry = new Set();
  buildingGroup.traverse(o => { if (o.geometry && o.geometry !== box && !o.geometry.userData.shared) geometry.add(o.geometry); });
  buildingGroup.clear();
  geometry.forEach(g => g.dispose());
}

function frame(type, epoch) {
  const span = (type === 'farm' || type === 'pen' ? 2.55 : 2.05) * epoch.scale * (type === 'hall' ? 1.18 : 1);
  camera.left = -span; camera.right = span; camera.top = span; camera.bottom = -span;
  const h = tileHeight(world, 8, 8);
  const target = new THREE.Vector3(.5, h + 1.15 * epoch.scale, .5);
  const dist = 9, yaw = -.62, pitch = .72;
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  ground.position.set(.5, h - .08, .5);
}

function snapshot({ race, setting, epoch, type, material, variant }) {
  village.population = epoch.min;
  village.race = race;
  groundMat.color.set(GROUND[setting]);
  scene.background = new THREE.Color(SKY[setting]);
  clearBuildings();
  scenery.structure({ id: 1, villageId: village.id, x: 8, y: 8, type, material, race, variant, complete: true, progress: 1, crop: 8, setting });
  frame(type, epoch);
  gpu.render(scene, camera);
  return canvas.toDataURL('image/png');
}

function typicalMaterial(race) { return RACES[race].preferred[0]; }

function fillSelect(id, entries) {
  const node = document.getElementById(id);
  for (const [value, label] of entries) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; node.append(option);
  }
}

fillSelect('race', Object.entries(RACES).map(([id, race]) => [id, race.name]));
fillSelect('setting', SETTINGS.map(id => [id, SETTING_NAMES[id]]));
fillSelect('material', Object.entries(MATERIALS).map(([id, name]) => [id, name]));
document.getElementById('material').value = 'wood';

const catalog = document.getElementById('catalog');
const status = document.getElementById('status');
const filters = {
  type: document.getElementById('type'),
  race: document.getElementById('race'),
  setting: document.getElementById('setting'),
  material: document.getElementById('material'),
  variant: document.getElementById('variant'),
};

let token = 0;

async function draw() {
  const run = ++token;
  const type = filters.type.value;
  const races = filters.race.value === 'all' ? Object.keys(RACES) : [filters.race.value];
  const settings = filters.setting.value === 'all' ? [...SETTINGS] : [filters.setting.value];
  const variant = Number(filters.variant.value);
  catalog.innerHTML = '';
  const jobs = [];
  for (const race of races) {
    const section = document.createElement('section');
    section.className = 'race-block';
    section.innerHTML = `<h2><i class="swatch" style="--race:${RACES[race].color}"></i>${RACES[race].name}</h2>`;
    catalog.append(section);
    for (const setting of settings) {
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.innerHTML = `<h3>${SETTING_NAMES[setting]}</h3><div class="cards"></div>`;
      section.append(row);
      const cards = row.querySelector('.cards');
      for (const epoch of EPOCHS) {
        const material = type === 'farm' || type === 'pen' ? 'wood' : filters.material.value === 'typical' ? typicalMaterial(race) : filters.material.value;
        const building = { type, race, material, setting };
        const form = type === 'house' || type === 'hall' ? houseForm(race, setting, epoch, material) : type;
        const card = document.createElement('figure');
        card.className = 'card';
        card.innerHTML = `<img alt="" width="280" height="280"><figcaption><strong></strong><small>${epoch.name} · ${MATERIALS[material]} · ${form}</small></figcaption>`;
        card.querySelector('strong').textContent = structureName(building, { population: epoch.min }).replace(` · ${MATERIALS[material]}`, '');
        cards.append(card);
        jobs.push({ race, setting, epoch, type, material, variant, img: card.querySelector('img') });
      }
    }
  }
  status.textContent = `Raising ${jobs.length} roofs…`;
  for (let i = 0; i < jobs.length; i++) {
    if (run !== token) return;
    jobs[i].img.src = snapshot(jobs[i]);
    jobs[i].img.alt = jobs[i].img.closest('figure').querySelector('strong').textContent;
    if (i % 2 === 1) await new Promise(resolve => requestAnimationFrame(resolve));
    status.textContent = `Raising ${i + 1} / ${jobs.length} roofs…`;
  }
  if (run === token) status.textContent = `${jobs.length} roofs · ${races.map(id => RACES[id].name).join(', ')}`;
}

for (const node of Object.values(filters)) node.addEventListener('change', draw);
draw();
