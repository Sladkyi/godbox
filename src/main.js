import './style.css';
import { World, TILE_NAMES } from './world.js';
import { WorldView } from './world-view.js';
import { icon } from './icons.js';
import { Platform } from './platform.js';
import { PeopleUI } from './people-ui.js';
import { RACES, RESOURCES, DEPOSIT_KINDS, inventoryText, structureName, MATERIALS, epochOf, UNIT_LIMIT, SETTING_NAMES } from './civilizations.js';
import { pairStats, twoFingerDelta, isTap, orbitFromRotate, pinchZoom, TAP_SLOP, createFingerLock, stepFingerLock, filterTwoFinger } from './gestures.js';
import { Soundscape } from './sound.js';
import { miracleCost, canCast, payForCast, faithCapacity, faithPerYear, congregation, refillFaith } from './faith.js';

const tools = {
  grass: { name: 'Meadow', text: 'Soft green land. Life begins here.', color: '#a9d48a', category: 'terrain' },
  forest: { name: 'Forest', text: 'Plant a forest. Trees give people wood.', color: '#7fb18a', category: 'terrain' },
  sand: { name: 'Sand', text: 'Warm shores and open desert.', color: '#e5ce91', category: 'terrain' },
  water: { name: 'Ocean', text: 'Make a sea. Water floods land and buildings.', color: '#83c9de', category: 'terrain' },
  mountain: { name: 'Mountains', text: 'Raise impassable mountain ranges.', color: '#b9c2b6', category: 'terrain' },
  snow: { name: 'Snow', text: 'Cover the land in quiet white snow.', color: '#e0e9dd', category: 'terrain' },
  human: { name: 'Humans', text: 'Place three nearby on land — they will found a village.', color: '#f0d39b', category: 'life' },
  sheep: { name: 'Sheep', text: 'Peaceful meadow dwellers. People catch them and drive them into a fold.', color: '#e7e1c9', category: 'life' },
  cow: { name: 'Cows', text: 'Heavy grazing beasts. Towns raise folds and keep them with the sheep.', color: '#c4a07a', category: 'life' },
  wolf: { name: 'Wolves', text: 'Predators hunt sheep and cows. Nature looks for a balance.', color: '#b6c1d6', category: 'life' },
  rain: { name: 'Rain', text: 'A lasting shower: fire dies, farms drink, and people dance in the wet streets. A hungry town may name you patron.', color: '#91cddd', category: 'powers' },
  storm: { name: 'Storm', text: 'Wind-cut rain and lightning. People run for roofs; livestock huddle. Fire dies, but the sky is angry.', color: '#7aa3b8', category: 'powers' },
  blizzard: { name: 'Blizzard', text: 'A white silence. Fields freeze, doors shut, and the fold waits out the snow.', color: '#d5e6ee', category: 'powers' },
  aurora: { name: 'Aurora', text: 'Lights in the high air. People stand and stare — aliens most of all — and a watching town may grow a cult.', color: '#8ee0d0', category: 'powers' },
  bloom: { name: 'Bloom', text: 'Meadows open. Berries return, farms swell, and people dance in the pollen.', color: '#c5e08a', category: 'powers' },
  trade: { name: 'Market', text: 'Open a town market. Carts roll to a neighbor: food for stone, iron, wood. Tap a town — if they have no road yet, they learn one.', color: '#e2c07a', category: 'powers' },
  fire: { name: 'Fire', text: 'Fire spreads through grass and forests.', color: '#f4ab76', category: 'powers' },
  lightning: { name: 'Lightning', text: 'One strike from the sky, and everything changes.', color: '#edd58e', category: 'powers' },
  meteor: { name: 'Meteor', text: 'Leave a crater and start a new chapter.', color: '#eaa18a', category: 'powers' },
};
for(const [key,race]of Object.entries(RACES))if(key!=='human')tools[key]={name:race.name,text:race.description+' Place three nearby to found a town.',color:race.color,category:'life'};
for(const key of DEPOSIT_KINDS)tools[key]={name:RESOURCES[key].name,text:key==='fish'?'Place a fishing spot in water next to the shore. Fishers will catch from land.':`Place ${RESOURCES[key].name.toLowerCase()} on land. People will gather it and carry it to the store.`,color:RESOURCES[key].color,category:'resources'};
const singleTools=[...Object.keys(RACES),'sheep','cow','wolf','inspect','trade',...DEPOSIT_KINDS];
const $ = selector => document.querySelector(selector);
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button = (id, glyph, title, extra = '') => `<button id="${id}" class="icon-button ${extra}" title="${title}" aria-label="${title}">${icon(glyph)}</button>`;

$('#app').innerHTML = `
  <header class="topbar">
    <div class="brand"><div class="brand-mark">${icon('world')}</div><div><h1>GODBOX<span>ALPHA 0.4</span></h1><p>Your little world</p></div></div>
    <div class="world-heading"><span class="live-dot"></span><div><strong>Eliria</strong><span>World #<b id="seed-label">71283</b></span></div><span class="heading-divider"></span><div class="age">${icon('clock')}<span>Year <b id="year">1</b></span></div></div>
    <button id="power" class="power" aria-label="Divine power. Open the faith panel" title="Your faith — every miracle spends it">
      <span class="power-mark">${icon('faith')}</span>
      <span class="power-body">
        <span class="power-top"><b id="power-value">80</b><span id="power-cap">/ 80</span><i id="power-flow">+3 / year</i></span>
        <span class="power-bar"><span id="power-fill"></span><span id="power-cost"></span></span>
        <span id="power-note" class="power-note">FAITH · TAP TO SEE WHO BELIEVES</span>
      </span>
      <span id="power-spend" class="power-spend" aria-hidden="true"></span>
    </button>
    <nav class="top-actions" aria-label="World controls">${button('load', 'load', 'Load world')}<button id="save" class="text-button" aria-label="Save world">${icon('save')}<span>Save</span></button><button id="new-world" class="text-button primary" aria-label="New world">${icon('plus')}<span>New world</span></button>${button('help', 'help', 'How to play')}</nav>
  </header>
  <main class="game-area">
    <div id="world" role="application" aria-label="World map: one finger paints, two fingers move the map" tabindex="0"></div>
    <div class="world-caption"><span id="caption-kicker">ONE WORLD · TWO VIEWS</span><p id="caption-line">A large story in a small world.</p></div>
    <aside class="toolbox panel">
      <div class="panel-heading"><span>MAKE A WORLD</span><span class="small-dot"></span></div>
      <div class="categories" role="tablist" aria-label="Tool category"><button data-category="terrain" role="tab" aria-selected="true">${icon('mountain')}Land</button><button data-category="resources" role="tab" aria-selected="false">${icon('crystal')}Resources</button><button data-category="life" role="tab" aria-selected="false">${icon('human')}Life</button><button data-category="powers" role="tab" aria-selected="false">${icon('lightning')}Powers</button></div>
      <div id="tool-grid" class="tool-grid" role="tabpanel"></div>
      <div class="selected-tool"><div class="selected-heading"><span id="selected-name">Meadow</span><span class="tool-shortcut" id="selected-cost">FREE</span></div><p id="selected-description"></p></div>
      <div class="brush-control"><label for="brush">Brush size <output id="brush-value">3</output></label><div class="range-row"><span class="brush-dot small"></span><input id="brush" type="range" min="1" max="10" value="3" aria-label="Brush size"><span class="brush-dot large"></span></div></div>
      <div class="utility-tools"><button id="inspect" title="Inspect">${icon('inspect')}Inspect</button><button id="citizens" title="All people">${icon('human')}People</button><button id="erase" title="Erase">${icon('erase')}Erase</button></div>
      <div class="toolbox-footer">${icon('heart')}Every world is a new story</div>
    </aside>
    <aside class="world-info">
      <section class="panel overview"><div class="panel-heading"><span>LIVING WORLD</span><span class="live-indicator">Simulating</span></div><div class="population-stat"><span id="population">24</span><div>people<span>writing their story</span></div>${icon('human')}</div><div class="minor-stats"><div>${icon('house')}<b id="villages">2</b><span>towns</span></div><div>${icon('sheep')}<b id="animals">12</b><span>animals</span></div><div>${icon('forest')}<b id="land">0%</b><span>land</span></div></div><div class="eco-bar"><span id="land-bar"></span></div><div class="eco-legend"><span><i></i>Land</span><span><i></i>Ocean</span></div></section>
      <section class="panel chronicle"><div class="panel-heading"><span>WORLD CHRONICLE</span>${icon('clock')}</div><div id="events"></div><div class="chronicle-note">The world remembers debts, patrons, and omens.</div></section>
      <section id="inspector" class="panel inspector" hidden></section>
    </aside>
    <div class="map-chrome">
      <div class="view-switch panel" role="group" aria-label="View"><button data-view="2d" aria-pressed="true" title="Top-down 2D view">2D</button><button data-view="3d" aria-pressed="false" title="3D world">3D</button></div>
      <div class="map-options panel">${button('toggle-labels', 'flag', 'Town names', 'active')}${button('toggle-grid', 'grid', 'Grid')}${button('pan', 'hand', 'Pan the map')}${button('orbit', 'orbit', 'Orbit camera')}${button('watch', 'watch', 'Watch the latest moment')}</div>
    </div>
    <div class="zoom-controls panel">${button('zoom-in', 'plus', 'Zoom in')}<button id="zoom-reset" title="Show the whole world">100%</button>${button('zoom-out', 'minus', 'Zoom out')}</div>
    <div class="bottom-hint"><span class="mouse-icon"></span><span id="hint">Click and paint — the world is in your hands</span><span class="hint-secondary" id="hint-secondary">Right-drag to pan · Wheel to zoom</span></div>
    <div class="time-controls panel"><button id="pause" class="pause-button" title="Pause (Space)" aria-label="Pause">${icon('pause')}</button><div class="time-description"><strong id="time-title">Time is moving</strong><span>Let the world live</span></div><div class="speeds" aria-label="Simulation speed"><button data-speed="1" class="active">1×</button><button data-speed="2" class="speed-boost">2×</button><button data-speed="5" class="speed-boost">5×</button></div>${button('mute', 'sound', 'Mute world sound')}</div>
    <div class="session-label"><span id="platform-state">Local play</span><span>Four peoples · v0.4</span></div>
    <div id="toast" role="status" aria-live="polite"></div>
  </main>
  <dialog id="modal"><div id="modal-content"></div></dialog>
  <input id="import-file" type="file" accept="application/json,.json" hidden>
`;

let world = new World(); world.updatePopulations();
const canvas = $('#world'), platform = new Platform();
let renderer;
try { renderer = new WorldView(canvas, world); }
catch (error) { $('#app').innerHTML = '<div class="graphics-error"><h2>Could not show the world</h2><p>Try another browser, or open the game in the RUN app.</p><button onclick="location.reload()">Try again</button></div>'; throw error; }
$('#orbit').hidden = true;
const sound = new Soundscape();
let selectedTool = 'grass', category = 'terrain', brush = 3, speed = 1, paused = false, hostPaused = false, adBusy = false, dragging = false, panMode = false, orbitMode = false;
let lastPoint = null, lastPaint = null, spawnTime = 0, toastTimer, saveBusy = false, saveReady = !platform.hosted, modalPaused = false, identityChanged = false;
let chargePoint = null, refusedAt = 0;
const unlockedSpeeds = new Set([1]);
let lastEvents = '', lastCaption = '', lastFrame = performance.now(), accumulator = 0, uiTime = 0, cloudTime = 0;
const peopleUI = new PeopleUI($('#inspector'), () => world, renderer);

function renderTools() {
  $('#tool-grid').innerHTML = Object.entries(tools).filter(([, t]) => t.category === category).map(([id, t]) => `<button class="tool ${id === selectedTool ? 'active' : ''}" data-tool="${id}" aria-pressed="${id === selectedTool}" style="--tool-color:${t.color}" title="${t.text}">${icon(id)}<span>${t.name}</span><i class="tool-cost" aria-hidden="true">0</i></button>`).join('');
  document.querySelectorAll('[data-category]').forEach(el => el.setAttribute('aria-selected', String(el.dataset.category === category)));
  syncPower();
}
function selectTool(tool) {
  selectedTool = tool; renderer.tool = tool; panMode = false; orbitMode = false; $('#pan').classList.remove('active'); $('#orbit').classList.remove('active');
  $('#hint').textContent = paintHint();
  const data = tools[tool] ?? (tool === 'inspect' ? { name: 'Inspect the world', text: 'Click a cell, a person, or a town.' } : { name: 'Erase', text: 'Removes creatures, buildings, and trees in the brush.' });
  $('#selected-name').textContent = data.name; $('#selected-description').textContent = data.text;
  $('#inspect').classList.toggle('active', tool === 'inspect'); $('#erase').classList.toggle('active', tool === 'erase');
  $('#brush').disabled = singleTools.includes(tool);
  renderTools();
}
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
function restartAnimation(el, className) { el.classList.remove(className); void el.offsetWidth; el.classList.add(className); }
function faithNote(devoted, fearful) {
  if (!world.god.limited) return 'FREE CREATION';
  if (devoted) return `${devoted} ${devoted === 1 ? 'TOWN PRAYS' : 'TOWNS PRAY'} FOR YOU`;
  if (fearful) return `${fearful} ${fearful === 1 ? 'TOWN FEARS' : 'TOWNS FEAR'} YOU`;
  return 'RAIN ON A HUNGRY TOWN';
}
function syncPower() {
  const god = world.god, limited = god.limited !== false;
  const cap = Math.max(1, Math.round(god.capacity ?? faithCapacity(world)));
  const faith = Math.floor(limited ? Math.max(0, god.faith ?? cap) : cap);
  const cost = miracleCost(selectedTool, brush);
  const fillPct = Math.max(0, Math.min(100, faith / cap * 100));
  const costPct = limited ? Math.min(fillPct, cost / cap * 100) : 0;
  $('#power-value').textContent = limited ? faith : '∞';
  $('#power-cap').textContent = limited ? `/ ${cap}` : '';
  $('#power-flow').textContent = limited ? `${faithPerYear(world) >= 0 ? '+' : ''}${faithPerYear(world).toFixed(1)} / year` : 'unlimited';
  $('#power-fill').style.width = `${fillPct}%`;
  $('#power-cost').style.left = `${fillPct - costPct}%`;
  $('#power-cost').style.width = `${costPct}%`;
  const flock = congregation(world);
  $('#power-note').textContent = faithNote(flock.filter(f => f.stance === 'devoted').length, flock.filter(f => f.stance === 'fearful').length);
  $('#power').classList.toggle('low', limited && faith < cost);
  document.body.classList.toggle('free-creation', !limited);
  $('#selected-cost').textContent = limited && cost ? `${cost} FAITH` : 'FREE';
  for (const el of document.querySelectorAll('.tool[data-tool]')) {
    const price = miracleCost(el.dataset.tool, brush);
    el.querySelector('.tool-cost').textContent = price;
    el.setAttribute('aria-label', `${tools[el.dataset.tool].name}, costs ${price} faith`);
    el.classList.toggle('locked', limited && price > faith);
  }
  $('#erase').classList.toggle('locked', limited && miracleCost('erase', brush) > faith);
}
function showSpend(cost) {
  if (!cost || world.god.limited === false) return;
  const el = $('#power-spend'); el.textContent = `−${cost}`;
  restartAnimation(el, 'flying');
}
function refuseCast(cost) {
  restartAnimation($('#power'), 'denied');
  if (performance.now() - refusedAt < 2600) return;
  refusedAt = performance.now();
  toast(`Not enough faith for this — it costs ${cost}. Believers pray it back over the years, and rain over a hungry town makes them yours.`);
}
function applySpeed(rate) {
  speed = rate; paused = false;
  document.querySelectorAll('[data-speed]').forEach(el => el.classList.toggle('active', Number(el.dataset.speed) === rate));
  syncSpeedChrome();
}
function syncSpeedChrome() {
  const gated = platform.adsRequired();
  document.querySelectorAll('[data-speed]').forEach(el => {
    const rate = Number(el.dataset.speed);
    const locked = gated && rate > 1 && !unlockedSpeeds.has(rate);
    el.classList.toggle('needs-ad', locked);
    el.disabled = adBusy;
    el.title = locked ? `Watch an ad for ${rate}×` : `${rate}× speed`;
    el.setAttribute('aria-label', locked ? `${rate}×, watch an ad` : `${rate}× speed`);
  });
}
async function requestSpeed(rate) {
  if (!Number.isFinite(rate) || rate === speed || adBusy) return;
  if (rate === 1) { applySpeed(1); return; }
  if (unlockedSpeeds.has(rate) || !platform.adsRequired()) { unlockedSpeeds.add(rate); applySpeed(rate); return; }
  adBusy = true; updateUI();
  try {
    const earned = await platform.watchRewarded(rate);
    if (earned) { unlockedSpeeds.add(rate); applySpeed(rate); toast(rate === 5 ? 'Time races at 5×.' : 'Time runs at 2×.'); }
    else toast('Watch the ad to the end to speed up time.');
  } finally { adBusy = false; updateUI(); }
}
function updateUI() {
  const stats = world.stats();
  for (const key of ['population', 'villages', 'animals']) $(`#${key}`).textContent = stats[key];
  $('#land').textContent = `${stats.land}%`; $('#land-bar').style.width = `${stats.land}%`; $('#year').textContent = world.year;
  const eventKey = JSON.stringify(world.events.slice(0, 5));
  if (eventKey !== lastEvents) {
    lastEvents = eventKey;
    $('#events').innerHTML = world.events.slice(0, 5).map(e => `<div class="event"><i class="event-dot ${escapeHtml(e.type)}"></i><div><span>YEAR ${e.year}</span><p>${escapeHtml(e.message)}</p></div></div>`).join('');
  }
  const latest = world.events[0];
  const capKey = `${world.year}:${latest?.message??''}`;
  if (capKey !== lastCaption) {
    lastCaption = capKey;
    $('#caption-kicker').textContent = `YEAR ${world.year}`;
    $('#caption-line').textContent = latest?.message ?? 'A large story in a small world.';
  }
  $('#zoom-reset').textContent = `${Math.round(renderer.zoom * 100)}%`;
  $('#watch').classList.toggle('active', !!renderer.watch);
  const stopping = paused || hostPaused || modalPaused || adBusy;
  $('#pause').innerHTML = icon(stopping ? 'play' : 'pause'); $('#pause').setAttribute('aria-label', stopping ? 'Resume' : 'Pause');
  $('#time-title').textContent = stopping ? 'Time is still' : 'Time is moving'; $('.live-indicator').classList.toggle('stopped', stopping);
  $('.live-indicator').textContent = stopping ? 'Paused' : 'Simulating';
  syncSpeedChrome();
  syncPower();
  peopleUI.update();
}
function inspect(x, y) {
  const unit = world.units.filter(u => Math.hypot(x - u.x, y - u.y) < 2).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];
  if (unit?.kind === 'human') { peopleUI.select(unit.id); return; }
  peopleUI.close();
  const village = world.villages.find(v => Math.hypot(x - v.x, y - v.y) < 12);
  const panel = $('#inspector'); panel.hidden = false;
  let title = TILE_NAMES[world.tile(x, y)], content = `Coordinates: ${Math.floor(x)}, ${Math.floor(y)}`;
  const deposit=world.deposits.find(d=>Math.hypot(d.x+.5-x,d.y+.5-y)<1.8),building=world.buildings.find(b=>Math.hypot(b.x+.5-x,b.y+.5-y)<1.8);
  if (unit) {
    const home=world.villages.find(v=>v.id===unit.villageId);
    title = unit.kind === 'human' ? (RACES[unit.race]?.singular ?? 'Person') : { sheep: 'Sheep', cow: 'Cow', wolf: 'Wolf' }[unit.kind];
    content = `Age: ${Math.floor(unit.age)} · Health: ${Math.round(unit.hp)}%${unit.kind!=='human'&&unit.penId?`<br>Kept in the fold of ${home?.name??'a town'}`:unit.kind!=='human'&&unit.villageId?`<br>Being led home to ${home?.name??'a town'}`:''}`;
  }
  else if(deposit){title=RESOURCES[deposit.kind].name;content=`Left: ${Math.floor(deposit.amount)} / ${deposit.max}<br>${deposit.amount<1?'The deposit is exhausted':'People gather it on the spot'}`;}
  else if(building){const home=world.villages.find(v=>v.id===building.villageId);title=structureName(building,home);content=`${SETTING_NAMES[building.setting]??'Meadow'} · ${RACES[building.race].name} · ${building.complete?'Complete':`Building ${Math.round(building.progress*100)}%`}<br>Spent: ${inventoryText(building.cost)}${Number.isFinite(building.hp)?`<br>Strength: ${Math.round(building.hp)}`:''}`;}
  else if (village) {
    const neighbors=(village.known??[]).map(id=>world.villages.find(v=>v.id===id)?.name).filter(Boolean);
    const foes=(village.wars??[]).map(id=>world.villages.find(v=>v.id===id)?.name).filter(Boolean);
    const friends=(village.allies??[]).map(id=>world.villages.find(v=>v.id===id)?.name).filter(Boolean);
    const memory=(village.ties??[]).map(t=>{const name=world.villages.find(v=>v.id===t.id)?.name;if(!name)return '';const bits=[t.legend,t.debt>=8?`debt ${Math.round(t.debt)}`:'',t.grudge>=8?`grudge ${Math.round(t.grudge)}`:'',t.trust>=8?`trust ${Math.round(t.trust)}`:''].filter(Boolean);return `${name}: ${bits.join(' · ')||'known'}`;}).filter(Boolean);
    const faith=village.faith==='patron'?'they name you patron':village.faith==='fear'?'they fear the sky':'quiet';
    const last=village.lastTrade, partner=last&&world.villages.find(o=>o.id===last.partnerId);
    const tradeLine=partner?`<br>Last trade: ${last.role==='buy'?'bought':'sold'} ${(RESOURCES[last.good]?.name??last.good).toLowerCase()} with ${escapeHtml(partner.name)}${last.year===world.year?' this year':` in year ${last.year}`}`:'';
    const marketLine=(village.market??0)>=12?`<br>Market: open — carts leave more easily`:'' ;
    title = village.name;
    content = `${epochOf(village.population).name} · ${RACES[village.race].name} · People: ${village.population}<br>${inventoryText(village)}<br>Planning to build with: ${MATERIALS[village.planMaterial]}<br>Ground: ${SETTING_NAMES[world.settingAt(village.x, village.y)]??'Meadow'} · Land: ${Math.round(world.claimRadius(village))} tiles around the center<br>Scouted: ${neighbors.length?neighbors.map(escapeHtml).join(', '):'nobody yet'}<br>At war with: ${foes.length?foes.map(escapeHtml).join(', '):'nobody'}${friends.length?`<br>Allied with: ${friends.map(escapeHtml).join(', ')}`:''}${tradeLine}${marketLine}<br>Faith: ${Math.round(village.cult??0)} · ${faith}${village.omen?`<br>Omen: ${escapeHtml(String(village.omen))}`:''}${memory.length?`<br>Memory: ${memory.map(escapeHtml).join('; ')}`:''}`;
  }
  panel.innerHTML = `<div class="panel-heading"><span>UNDER THE LENS</span><button class="inspector-close icon-button" aria-label="Close details">${icon('close')}</button></div><strong>${escapeHtml(title)}</strong><p>${content}</p>`;
  $('.inspector-close').onclick = () => { panel.hidden = true; };
}
function applyAt(p, first = false) {
  const x = Math.floor(p.x), y = Math.floor(p.y);
  if (!world.inBounds(x, y)) return;
  if (selectedTool === 'inspect') { inspect(p.x, p.y); return; }
  const stamp = [...singleTools,'meteor','lightning','rain','storm','blizzard','aurora','bloom','trade'].includes(selectedTool);
  if (stamp && !first && performance.now() - spawnTime < 140) return;
  if (['meteor','lightning'].includes(selectedTool) && !first) return;
  if (!stamp && lastPaint && x === lastPaint.x && y === lastPaint.y) return;
  // A long stroke costs more than a short one: faith is charged once per brush width dragged.
  const charging = stamp || first || !chargePoint || Math.hypot(x - chargePoint.x, y - chargePoint.y) >= Math.max(2, brush);
  if (charging && !canCast(world, selectedTool, brush)) { refuseCast(miracleCost(selectedTool, brush)); return; }
  const result = world.paint(selectedTool, x, y, brush);
  if (result && charging) { showSpend(payForCast(world, selectedTool, brush)); chargePoint = { x, y }; syncPower(); }
  if (!result && first && selectedTool === 'trade') toast('Tap a town to open its market.');
  else if (!result && first && singleTools.includes(selectedTool)) toast(DEPOSIT_KINDS.includes(selectedTool)?selectedTool==='fish'?'Place a fishing spot in water next to the shore.':'Resources need open land.':world.units.length >= UNIT_LIMIT ? 'The island is full of lives.' : 'Life needs land. Paint ground first.');
  spawnTime = performance.now(); lastPaint = { x, y }; world.updatePopulations();
}
function pointerPos(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function isTouchPointer(event) { return event.pointerType === 'touch'; }
function cameraHint() {
  if (document.body.classList.contains('touch-ui')) return renderer.mode === '3d' ? 'Drag to move · pinch zoom · twist to turn' : 'Drag to move · pinch zoom';
  return renderer.mode === '3d' ? 'Right-drag to orbit · Shift + right-drag to pan' : 'Right-drag to pan · Wheel to zoom';
}
function paintHint() { return document.body.classList.contains('touch-ui') ? 'Tap to place · hold to paint · drag to move the map' : 'Click and paint — the world is in your hands'; }
function syncTouchChrome() {
  const compact = window.matchMedia('(max-width: 700px)').matches;
  const touch = compact || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
  document.body.classList.toggle('touch-ui', touch);
  $('#hint').textContent = panMode ? (touch ? 'Drag a finger to move the map' : 'Drag to pan the map') : orbitMode ? (touch ? 'Drag a finger to orbit the camera' : 'Drag to orbit the camera') : paintHint();
  $('#hint-secondary').textContent = cameraHint();
  canvas.setAttribute('aria-label', renderer.mode === '2d'
    ? (touch ? 'World map: drag to move, tap to paint' : 'World map: paint with the left button, pan with the right')
    : (touch ? '3D map: drag to move, tap to paint, pinch to zoom' : '3D world map: paint with the left button, orbit with the right'));
  $('#orbit').hidden = renderer.mode === '2d' || touch;
  $('#pan').hidden = touch;
  if (touch && orbitMode) { orbitMode = false; $('#orbit').classList.remove('active'); }
  if (touch && panMode) { panMode = false; $('#pan').classList.remove('active'); }
}
function capturePointer(event) { try { canvas.setPointerCapture(event.pointerId); } catch { /* already captured or synthetic */ } }
function paintStroke(fromScreen, toScreen, first = false) {
  const from = renderer.screenToWorld(fromScreen.x, fromScreen.y), to = renderer.screenToWorld(toScreen.x, toScreen.y);
  if (first) applyAt(from, true);
  const steps = Math.min(80, Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, brush / 2))));
  for (let i = 1; i <= steps; i++) applyAt({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps });
}
const pointers = new Map();
let gesture = null, pairPrev = null, pairLock = null, pendingOrigin = null, cameraLocked = false, holdTimer = null;
const touchSlop = () => document.body.classList.contains('touch-ui') ? 22 : TAP_SLOP;
const canStroke = () => selectedTool === 'erase' || !singleTools.includes(selectedTool);
function clearHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }
function clearPointers() {
  clearHold();
  for (const id of pointers.keys()) try { canvas.releasePointerCapture(id); } catch { /* released */ }
  pointers.clear(); gesture = null; pairPrev = null; pairLock = null; pendingOrigin = null; cameraLocked = false; dragging = false; lastPaint = null; lastPoint = null; chargePoint = null;
}
function beginMouseGesture(event, p) {
  const pan = panMode || event.button === 1 || event.altKey || (event.button === 2 && (event.shiftKey || renderer.mode === '2d'));
  const orbit = renderer.mode === '3d' && !pan && (orbitMode || event.button === 2);
  gesture = pan ? 'pan' : orbit ? 'orbit' : 'paint';
  dragging = true; lastPoint = p; lastPaint = null;
  if (gesture === 'paint') applyAt(renderer.screenToWorld(p.x, p.y), true);
}
function beginTouchGesture(p) {
  lastPoint = p; lastPaint = null; pendingOrigin = p;
  if (panMode) { gesture = 'pan'; dragging = true; return; }
  if (orbitMode) { gesture = 'orbit'; dragging = true; return; }
  gesture = 'pending'; dragging = false; renderer.hover = renderer.screenToWorld(p.x, p.y);
  clearHold();
  if (document.body.classList.contains('touch-ui') && canStroke()) {
    const origin = p;
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (gesture !== 'pending') return;
      gesture = 'paint'; dragging = true;
      applyAt(renderer.screenToWorld(origin.x, origin.y), true);
    }, 220);
  }
}
function startTwoFingerCamera() {
  const pts = [...pointers.values()];
  if (pts.length < 2) return;
  clearHold();
  gesture = 'camera'; dragging = true; cameraLocked = true; lastPaint = null; renderer.hover = null;
  renderer.watch = false;
  pairPrev = pairStats(pts[0], pts[1]);
  pairLock = createFingerLock(renderer.mode === '3d');
}
canvas.addEventListener('pointerdown', event => {
  if (identityChanged || hostPaused) return;
  void sound.unlock();
  if (pointers.has(event.pointerId)) return;
  if (event.button !== 0 && event.pointerType !== 'mouse') return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  capturePointer(event);
  const p = pointerPos(event);
  pointers.set(event.pointerId, { ...p, type: event.pointerType });
  if (pointers.size === 1) {
    if (isTouchPointer(event)) beginTouchGesture(p);
    else beginMouseGesture(event, p);
  } else if (pointers.size === 2 && [...pointers.values()].every(pt => pt.type === 'touch')) startTwoFingerCamera();
});
canvas.addEventListener('pointermove', event => {
  const p = pointerPos(event);
  if (pointers.has(event.pointerId)) {
    pointers.set(event.pointerId, { ...p, type: pointers.get(event.pointerId).type });
    if (event.cancelable) event.preventDefault();
  }
  const navigating = panMode || orbitMode || gesture === 'pan' || gesture === 'orbit' || gesture === 'camera';
  renderer.hover = navigating ? null : renderer.screenToWorld(p.x, p.y);
  if (!pointers.has(event.pointerId)) return;
  if (gesture === 'pending' && pendingOrigin && !isTap(pendingOrigin, p, touchSlop())) {
    clearHold();
    if (document.body.classList.contains('touch-ui')) {
      gesture = 'pan'; dragging = true; renderer.watch = false; lastPoint = p;
    } else {
      gesture = 'paint'; dragging = true; paintStroke(pendingOrigin, p, true); lastPoint = p;
    }
    return;
  }
  if (gesture === 'camera') {
    const pts = [...pointers.values()];
    if (pts.length < 2 || !pairPrev) return;
    const next = pairStats(pts[0], pts[1]), raw = twoFingerDelta(pairPrev, next);
    const delta = filterTwoFinger(raw, stepFingerLock(pairLock, raw));
    if (delta.panX || delta.panY) renderer.pan(delta.panX, delta.panY);
    if (delta.scale !== 1) renderer.changeZoom(pinchZoom(delta.scale), next.mid.x, next.mid.y);
    if (delta.rotate) renderer.orbit(orbitFromRotate(delta.rotate));
    pairPrev = next;
    return;
  }
  if (!dragging || (gesture !== 'pan' && gesture !== 'orbit' && gesture !== 'paint')) return;
  if (gesture === 'pan') renderer.pan(p.x - lastPoint.x, p.y - lastPoint.y);
  else if (gesture === 'orbit') renderer.orbit(p.x - lastPoint.x, p.y - lastPoint.y);
  else paintStroke(lastPoint, p);
  lastPoint = p;
});
function finishPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const p = pointerPos(event);
  const leaving = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* released */ }
  if (gesture === 'pending' && leaving?.type === 'touch' && pendingOrigin && pointers.size === 0 && isTap(pendingOrigin, p, touchSlop())) {
    clearHold();
    applyAt(renderer.screenToWorld(pendingOrigin.x, pendingOrigin.y), true);
  }
  if (pointers.size === 0) { clearHold(); gesture = null; pairPrev = null; pairLock = null; pendingOrigin = null; cameraLocked = false; dragging = false; lastPaint = null; chargePoint = null; return; }
  if (cameraLocked) { clearHold(); gesture = 'idle'; dragging = false; lastPaint = null; pairPrev = null; pairLock = null; }
}
canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('lostpointercapture', finishPointer);
canvas.addEventListener('pointerleave', () => { if (!pointers.size) renderer.hover = null; });
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => { event.preventDefault(); const p = pointerPos(event); renderer.changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
syncTouchChrome();
window.matchMedia('(max-width: 700px)').addEventListener('change', syncTouchChrome);

document.addEventListener('click', event => {
  const view = event.target.closest('[data-view]');
  if (view) void switchView(view.dataset.view);
  const citizen = event.target.closest('[data-citizen]'), personAction = event.target.closest('[data-person-action]');
  if (citizen) { selectTool('inspect'); peopleUI.select(Number(citizen.dataset.citizen)); }
  if (personAction) peopleUI.action(personAction.dataset.personAction);
  const cat = event.target.closest('[data-category]'), tool = event.target.closest('[data-tool]'), rate = event.target.closest('[data-speed]');
  if (cat) { category = cat.dataset.category; const first = Object.keys(tools).find(key => tools[key].category === category); selectTool(first); }
  if (tool) selectTool(tool.dataset.tool);
  if (rate) void requestSpeed(Number(rate.dataset.speed));
});
async function switchView(mode) {
  if (renderer.loading || mode === renderer.mode) return;
  const buttons = document.querySelectorAll('[data-view]'); buttons.forEach(b => { b.disabled = true; });
  try {
    if (!await renderer.switchMode(mode)) return;
    panMode = false; orbitMode = false; renderer.hover = null;
    $('#pan').classList.remove('active'); $('#orbit').classList.remove('active');
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
    syncTouchChrome(); updateUI();
    toast(mode === '2d' ? 'Top-down view. The world’s story continues.' : (document.body.classList.contains('touch-ui') ? '3D world. Drag to move, tap to paint, pinch to zoom.' : '3D world. Right-drag orbits the camera.'));
  } catch { toast('3D is not available in this browser. Your world keeps living in 2D.'); }
  finally { buttons.forEach(b => { b.disabled = false; }); }
}
$('#brush').oninput = event => { brush = Number(event.target.value); renderer.radius = brush; $('#brush-value').textContent = brush; syncPower(); };
$('#inspect').onclick = () => selectTool('inspect'); $('#erase').onclick = () => selectTool('erase');
$('#citizens').onclick = () => { selectTool('inspect'); peopleUI.openList(); };
$('#pause').onclick = () => { paused = !paused; updateUI(); };
$('#pan').onclick = () => { panMode = !panMode; orbitMode = false; $('#orbit').classList.remove('active'); $('#pan').classList.toggle('active', panMode); renderer.hover = null; syncTouchChrome(); };
$('#orbit').onclick = () => { orbitMode = !orbitMode; panMode = false; $('#pan').classList.remove('active'); $('#orbit').classList.toggle('active', orbitMode); renderer.hover = null; syncTouchChrome(); };
$('#toggle-labels').onclick = () => { renderer.labels = !renderer.labels; $('#toggle-labels').classList.toggle('active', renderer.labels); };
$('#toggle-grid').onclick = () => { renderer.grid = !renderer.grid; $('#toggle-grid').classList.toggle('active', renderer.grid); };
$('#watch').onclick = () => {
  renderer.watch = !renderer.watch;
  if (renderer.watch) { renderer.followId = null; panMode = false; orbitMode = false; $('#pan').classList.remove('active'); $('#orbit').classList.remove('active'); }
  $('#watch').classList.toggle('active', renderer.watch);
};
function syncMute() {
  $('#mute').innerHTML = icon(sound.muted ? 'mute' : 'sound');
  const label = sound.muted ? 'Unmute world sound' : 'Mute world sound';
  $('#mute').title = label; $('#mute').setAttribute('aria-label', label);
}
$('#mute').onclick = () => { sound.toggle(); syncMute(); };
syncMute();
$('#zoom-in').onclick = () => renderer.changeZoom(document.body.classList.contains('touch-ui') ? 1.55 : 1.25);
$('#zoom-out').onclick = () => renderer.changeZoom(document.body.classList.contains('touch-ui') ? 1 / 1.55 : .8);
$('#zoom-reset').onclick = () => renderer.resetCamera();
document.addEventListener('keydown', event => {
  if ($('#modal').open || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); paused = !paused; updateUI(); }
  if (event.key === 'Escape') { selectTool('inspect'); peopleUI.close(); }
  if (event.key === '+' || event.key === '=') renderer.changeZoom(1.2);
  if (event.key === '-') renderer.changeZoom(1 / 1.2);
  if (event.key === '0') renderer.resetCamera();
  if (event.code === 'KeyQ') renderer.orbit(12);
  if (event.code === 'KeyE') renderer.orbit(-12);
});

function openModal(html) {
  modalPaused = true; $('#modal-content').innerHTML = html; $('#modal').showModal(); updateUI();
  $('#modal-content').querySelectorAll('[data-close]').forEach(b => b.onclick = () => $('#modal').close());
}
$('#modal').addEventListener('close', () => { modalPaused = false; updateUI(); });
$('#new-world').onclick = () => {
  openModal(`<div class="dialog-heading"><div class="eyebrow">A BLANK PAGE</div><button data-close class="icon-button" aria-label="Close">${icon('close')}</button></div><h2>What will your world be?</h2><p class="dialog-description">New land. New life. Endless possibilities.</p><form id="create-form"><label class="field-label">World shape</label><div class="world-presets"><label><input type="radio" name="preset" value="archipelago" checked><span>${icon('world')}Archipelago<small>Islands and straits</small></span></label><label><input type="radio" name="preset" value="continent"><span>${icon('mountain')}Continent<small>More room for life</small></span></label><label><input type="radio" name="preset" value="ocean"><span>${icon('water')}Open ocean<small>Make everything from scratch</small></span></label></div><label class="field-label" for="new-seed">Generation seed</label><div class="seed-input"><input id="new-seed" name="seed" type="number" min="0" max="4294967295" value="${Math.floor(Math.random() * 999999)}" required><button id="random-seed" type="button" class="icon-button" aria-label="Random seed">${icon('reset')}</button></div><label class="check-row"><input type="checkbox" name="populate" checked>Add the first people and animals</label><label class="check-row stacked"><input type="checkbox" name="faith" checked><span>Miracles cost faith<small>Believing towns pay for your powers. Leave this off to sculpt an empty ocean with nothing holding you back.</small></span></label><p class="save-note">The current world will be replaced. Save it if you want to return.</p><div class="dialog-actions"><button type="button" data-close class="text-button">Cancel</button><button type="submit" class="text-button primary">${icon('plus')}Create world</button></div></form>`);
  $('#random-seed').onclick = () => { $('#new-seed').value = Math.floor(Math.random() * 999999); };
  $('#create-form').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const next = new World({ seed: Number(data.get('seed')), preset: data.get('preset'), populate: data.has('populate') });
    next.god.limited = data.has('faith');
    if (!next.god.limited) refillFaith(next);
    replaceWorld(next);
    $('#modal').close(); toast(next.god.limited ? 'A new world is waiting for your ideas.' : 'A new world, and no price on any miracle.');
  };
};
function openPowerPanel() {
  const god = world.god, limited = god.limited !== false;
  const cap = Math.round(god.capacity ?? faithCapacity(world));
  const flock = congregation(world);
  const stanceWord = { devoted: 'names you patron', fearful: 'fears the sky', quiet: 'has not made up its mind' };
  const rows = flock.length
    ? flock.map(f => `<div class="flock-row ${f.stance}"><i style="--village-color:${f.color}"></i><div><strong>${escapeHtml(f.name)}</strong><span>${f.population} people · ${stanceWord[f.stance]}</span></div><b>${f.perYear >= 0 ? '+' : ''}${f.perYear.toFixed(1)}</b></div>`).join('')
    : '<p class="save-note">No town believes in you yet. Settle three people of one race and they will start a town — every living town sends a little faith.</p>';
  openModal(`<div class="dialog-heading"><div class="eyebrow">YOUR POWER</div><button data-close class="icon-button" aria-label="Close">${icon('close')}</button></div>
    <h2>${limited ? `${Math.floor(god.faith)} of ${cap} faith` : 'Unlimited power'}</h2>
    <p class="dialog-description">Every miracle spends faith, and only believers pay it back. Rain or bloom over a hungry town makes you its patron and the faith flows faster. Fire, storms, lightning, and meteors make towns fear you, and a frightened town gives almost nothing.</p>
    <div class="flock-list">${rows}</div>
    <div class="flock-total"><span>Faith per year</span><b>${faithPerYear(world) >= 0 ? '+' : ''}${faithPerYear(world).toFixed(1)}</b></div>
    <label class="check-row stacked"><input id="faith-limit" type="checkbox" ${limited ? 'checked' : ''}><span>Miracles cost faith<small>Turn this off to paint freely, with no price on anything.</small></span></label>
    <button data-close class="text-button primary full-width">Back to the world ${icon('chevron')}</button>`);
  $('#faith-limit').onchange = event => {
    world.god.limited = event.target.checked;
    if (!world.god.limited) refillFaith(world);
    syncPower();
    toast(world.god.limited ? 'Miracles cost faith again.' : 'Free creation: nothing costs anything.');
  };
}
$('#power').onclick = openPowerPanel;
$('#help').onclick = () => openModal(`<div class="dialog-heading"><div class="eyebrow">WELCOME TO GODBOX</div><button data-close class="icon-button" aria-label="Close">${icon('close')}</button></div><h2>A few godly powers.</h2><p class="dialog-description">Create, watch, change. There is no right way to play.</p><div class="help-steps"><div>${icon('grass')}<section><strong>Paint your world</strong><p>Choose land, forest, or ocean. Hold the mouse or, on a phone, hold a finger then drag.</p></section></div><div>${icon('human')}<section><strong>Start life</strong><p>Place three of the same race nearby. Humans, dwarves, ghouls, aliens, and mycelites found their own towns, gather resources, and raise children. Dwarves delve stone holds, mine iron, and wait out rain under a thick roof. Towns begin as camps of huts, then grow into hamlets, villages, towns, and cities as the people fill the land. When they find sheep or cows they catch them, raise a fold, and drive the animals in.</p></section></div><div>${icon('lightning')}<section><strong>Watch the people</strong><p>Add stone, ore, crystals, clay, mycelium, and fishing spots in the Resources tab. Jobs follow nearby deposits; new houses follow the material they gather. Guards patrol the land, scout neighbors, and after enough border heat the towns go to war: raids, sieges, and refugees. Towns that know each other send carts: food for stone, iron, wood. The Market power opens a stall over a town and sends a caravan down the road — even if they had not traded yet. They also send grain in a famine, feast, marry houses together, take tribute — and sometimes break an oath. Rain, storms, snow, aurora, and bloom linger in the sky; people run indoors, dance, or stare. Rain on a hungry town may make you their patron. The chronicle remembers debts, and the land hints before it strikes. People → Follow shows work up close. Watch frames the latest moment.</p></section></div><div>${icon('faith')}<section><strong>Spend your faith</strong><p>The star at the top is your power. Every tool shows its price, and a tool you cannot afford goes dark. Believing towns pray faith back year after year: rain over a hungry town makes you its patron and doubles what it sends, while fire and meteors leave towns afraid and nearly silent. Tap the star to see who believes, or to switch the price off entirely.</p></section></div></div><div class="shortcut-list"><span><kbd>Tap</kbd>Place</span><span><kbd>Hold</kbd>Paint a stroke</span><span><kbd>Drag</kbd>Move the map</span><span><kbd>Pinch</kbd>Zoom</span><span><kbd>Space</kbd>Pause</span><span><kbd>Right-drag</kbd>2D: pan · 3D: orbit</span></div><p class="save-note">The 2D / 3D switch changes the view of the same world. On a phone, drag one finger to move, tap to place, hold and drag to paint land. Pinch zooms; a twist turns the island. On a computer, Shift + right-drag pans in 3D, and Q / E rotate it.</p><button data-close class="text-button primary full-width">Start creating ${icon('chevron')}</button>`);

function replaceWorld(next) { peopleUI.close(); world = next; world.updatePopulations(); renderer.setWorld(world); sound.lastKey = ''; $('#seed-label').textContent = world.seed; $('#inspector').hidden = true; accumulator = 0; updateUI(); }
function downloadWorld() {
  const blob = new Blob([world.serialize()], { type: 'application/json' }), url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `godbox-${world.seed}-year-${world.year}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function saveWorld(silent = false) {
  if (saveBusy || identityChanged) return;
  if (!platform.hosted) { if (!silent) { downloadWorld(); toast('World saved to a file. Load it with the folder button.'); } return; }
  if (!saveReady) { if (!silent) toast('The cloud is still connecting. Try saving in a moment.'); return; }
  saveBusy = true; $('#save').disabled = true;
  try { await platform.save(world.serialize()); if (!silent) toast('World saved to RUN cloud.'); }
  catch { toast('Could not save the world to RUN. Try again.'); }
  finally { saveBusy = false; $('#save').disabled = false; }
}
$('#save').onclick = () => { void saveWorld(); };
$('#load').onclick = async () => {
  if (!platform.hosted) { $('#import-file').click(); return; }
  if (platform.status !== 'ready' || saveBusy) { toast('The cloud is not ready yet. Try again in a moment.'); return; }
  modalPaused = true;
  try { const data = await platform.load(); if (data) { replaceWorld(World.deserialize(data)); toast('World restored. The story continues.'); } else toast('There is no saved world yet.'); saveReady = true; }
  catch { toast('Could not load the world. The current world is still on screen.'); }
  finally { modalPaused = false; }
};
$('#import-file').onchange = async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { if (file.size > 1000000) throw new Error('The file is too large.'); const next = World.deserialize(await file.text()); replaceWorld(next); toast('World restored from a file.'); }
  catch (error) { toast(error.message || 'Could not read the save.'); }
  event.target.value = '';
};
function frame(now) {
  const delta = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  const running = !paused && !hostPaused && !modalPaused && !adBusy && !document.hidden;
  if (running) {
    accumulator += delta * speed;
    while (accumulator >= .1) { world.tick(.1); accumulator -= .1; }
  }
  renderer.render(delta * speed, running);
  sound.tick(world);
  uiTime += delta; cloudTime += delta;
  if (uiTime > .25) { updateUI(); uiTime = 0; }
  if (cloudTime > 30) { cloudTime = 0; if (saveReady && platform.hosted) void saveWorld(true); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { accumulator = 0; lastFrame = performance.now(); if (document.hidden && saveReady) void saveWorld(true); });
selectTool('grass'); updateUI(); requestAnimationFrame(frame);
if (new URLSearchParams(location.search).get('view') !== '2d') void switchView('3d');
void (async () => {
  await platform.connect({ pause: () => { hostPaused = true; clearPointers(); accumulator = 0; }, resume: () => { hostPaused = false; lastFrame = performance.now(); }, save: () => { void saveWorld(true); }, identityChanged: () => { identityChanged = true; saveReady = false; location.reload(); } });
  $('#platform-state').textContent = platform.status === 'ready' ? 'RUN.world · Cloud world' : platform.status === 'local' ? 'Local play' : 'RUN · No connection';
  if (platform.status === 'ready') {
    hostPaused = true;
    try { const data = await platform.load(); if (data) { replaceWorld(World.deserialize(data)); toast('Your world is back.'); } saveReady = true; }
    catch { toast('Cloud is unavailable. Loading and autosave are paused.'); }
    finally { hostPaused = false; }
  }
  syncSpeedChrome();
})();
if (import.meta.hot) import.meta.hot.dispose(() => { platform.dispose(); renderer.dispose(); sound.dispose(); });
