export const RACES = {
  human: {name:'Humans',singular:'Human',color:'#f0cf8f',skin:'#efc59b',coat:'#a5bfa2',preferred:['stone','clay','wood'],description:'Masters of stone and wood. Their roofs follow the land: stilts on the shore, log walls in the forest, steep cabins in the frost.'},
  dwarf: {name:'Dwarves',singular:'Dwarf',color:'#d4a05c',skin:'#d4a07a',coat:'#4a3a32',preferred:['iron','stone','wood'],description:'A people of stone and iron. They delve halls into the hills, mine until the mountain answers, and wait out rain under a thick roof.'},
  ghoul: {name:'Ghouls',singular:'Ghoul',color:'#ed839d',skin:'#ddd0cc',coat:'#302e43',preferred:['iron','stone','wood'],description:'Ghouls in the spirit of Tokyo Ghoul: dark clothes, a red eye, and living kagune. They hunt sheep and strangers and steal stores. Their shelters grow sharper with the land they claim.'},
  alien: {name:'Aliens',singular:'Alien',color:'#7fe5e2',skin:'#80d3c5',coat:'#566b91',preferred:['crystal','iron','stone','wood'],description:'They mine with a beam tool and feed on crystal light. Pods, discs, and spires change with coast, dune, and highland.'},
  mycelite: {name:'Mycelites',singular:'Mycelite',color:'#c8acec',skin:'#e4d5b6',coat:'#8678a1',preferred:['mycelium','clay','wood'],description:'A fungal people: they grow living houses, gather mycelium, and leave spores that turn meadows into forest. Caps and gardens follow the soil they stand on.'},
};
export const RESOURCES = {
  wood:{name:'Wood',color:'#b98b58'},food:{name:'Food',color:'#d9c976'},
  stone:{name:'Stone',color:'#b8c7cb',job:'mason',action:'mine',work:3,stock:'stone'},
  iron:{name:'Iron ore',color:'#dc9e75',job:'miner',action:'mine',work:3.4,stock:'iron'},
  crystal:{name:'Crystals',color:'#87e0ea',job:'crystalist',action:'mine',work:3.8,stock:'crystal'},
  clay:{name:'Clay',color:'#d7a28a',job:'potter',action:'dig',work:2.5,stock:'clay'},
  mycelium:{name:'Mycelium',color:'#d0a5e8',job:'mycologist',action:'cultivate',work:2.5,stock:'mycelium'},
  fish:{name:'Fish',color:'#8cdad7',job:'fisher',action:'fish',work:3.2,stock:'food'},
};
export const MATERIALS={wood:'Wood',stone:'Stone',iron:'Iron',crystal:'Crystal',clay:'Clay',mycelium:'Mycelium'};
export const STOCKS=['food','wood','stone','iron','crystal','clay','mycelium'];
export const TRADE_GOODS=STOCKS.filter(k=>k!=='food');
export const UNIT_LIMIT=1600;
export const BUILDING_LIMIT=5000;
export const DEPOSIT_KINDS=['stone','iron','crystal','clay','mycelium','fish'];
export const GATHER_ACTIONS=['mine','dig','cultivate','fish'];
export const LIVESTOCK=['sheep','cow'];
export const ANIMAL_KINDS=['sheep','cow','wolf'];
export const BUILDING_TYPES=['house','hall','farm','pen'];
export const PEN_SLOTS=6;
export const SETTINGS=Object.freeze(['meadow','coast','forest','sand','highland','frost','waste']);
export const SETTING_NAMES=Object.freeze({meadow:'Meadow',coast:'Coast',forest:'Forest',sand:'Dunes',highland:'Highlands',frost:'Frost',waste:'Ashlands'});
export const isLivestock=u=>u.kind==='sheep'||u.kind==='cow';
export const livestockSlots=u=>u.kind==='cow'?2:1;
export const isDwelling=b=>b.type==='house'||b.type==='hall';
export const isYard=b=>b.type==='farm'||b.type==='pen';
export const cargoCount=u=>STOCKS.reduce((sum,k)=>sum+(u.inventory[k]??0),0);
export const inventoryText=stock=>STOCKS.filter(k=>stock[k]>0).map(k=>`${RESOURCES[k].name}: ${Math.floor(stock[k])}`).join(' · ')||'Empty';
export const emptyStock=()=>Object.fromEntries(STOCKS.map(k=>[k,0]));
export const raceOf=u=>u.race??'human';
const HOUSE_NAMES = {
  camp:{
    human:{meadow:'Hut',coast:'Beach hut',forest:'Wood hut',sand:'Dune hut',highland:'Hill hut',frost:'Snow hut',waste:'Ash hut'},
    dwarf:{meadow:'Delve',coast:'Dock delve',forest:'Root delve',sand:'Quarry delve',highland:'Cliff delve',frost:'Barrow delve',waste:'Ash delve'},
    ghoul:{meadow:'Lean-to',coast:'Wreck lean-to',forest:'Hide lean-to',sand:'Pit lean-to',highland:'Cliff lean-to',frost:'Ice lean-to',waste:'Scrap lean-to'},
    alien:{meadow:'Pod',coast:'Tide pod',forest:'Canopy pod',sand:'Dune pod',highland:'Ridge pod',frost:'Frost pod',waste:'Ash pod'},
    mycelite:{meadow:'Spore hut',coast:'Mangrove hut',forest:'Cap hut',sand:'Puff hut',highland:'Cliff cap',frost:'Rime hut',waste:'Cinder hut'},
  },
  hamlet:{
    human:{meadow:'Shack',coast:'Stilt shack',forest:'Log shack',sand:'Adobe shack',highland:'Stone shack',frost:'Cabin shack',waste:'Patch shack'},
    dwarf:{meadow:'Hold',coast:'Wharf hold',forest:'Timber hold',sand:'Quarry hold',highland:'Cliff hold',frost:'Barrow hold',waste:'Ash hold'},
    ghoul:{meadow:'Shanty',coast:'Wreck shanty',forest:'Thorn shanty',sand:'Pit shanty',highland:'Cliff shanty',frost:'Ice shanty',waste:'Scrap shanty'},
    alien:{meadow:'Shell',coast:'Tide shell',forest:'Grove shell',sand:'Disc shell',highland:'Beacon shell',frost:'Rime shell',waste:'Scrap shell'},
    mycelite:{meadow:'Cap shack',coast:'Reef shack',forest:'Ring shack',sand:'Bloom shack',highland:'Ledge shack',frost:'Rime shack',waste:'Cinder shack'},
  },
  village:{
    human:{meadow:'Cottage',coast:'Harbor cottage',forest:'Lodge',sand:'Clay cottage',highland:'Hill cottage',frost:'Snow cottage',waste:'Ash cottage'},
    dwarf:{meadow:'Hall-house',coast:'Wharf house',forest:'Timber hall',sand:'Quarry house',highland:'Cliff hall',frost:'Barrow house',waste:'Ash hall'},
    ghoul:{meadow:'Den',coast:'Wreck den',forest:'Thorn den',sand:'Sand den',highland:'Cliff den',frost:'Ice den',waste:'Bone den'},
    alien:{meadow:'Dome',coast:'Tide dome',forest:'Canopy dome',sand:'Dune dome',highland:'Ridge dome',frost:'Frost dome',waste:'Ash dome'},
    mycelite:{meadow:'Mushroom house',coast:'Mangrove house',forest:'Grove house',sand:'Puff house',highland:'Ledge house',frost:'Rime house',waste:'Cinder house'},
  },
  town:{
    human:{meadow:'House',coast:'Harbor house',forest:'Timber house',sand:'Adobe house',highland:'Stone house',frost:'Winter house',waste:'Ash house'},
    dwarf:{meadow:'Stonehold',coast:'Harbor hold',forest:'Timber hold',sand:'Quarry hold',highland:'Cliff hold',frost:'Winter hold',waste:'Ash hold'},
    ghoul:{meadow:'Shelter',coast:'Wreck shelter',forest:'Thorn shelter',sand:'Pit shelter',highland:'Cliff shelter',frost:'Ice shelter',waste:'Scrap shelter'},
    alien:{meadow:'Capsule',coast:'Tide capsule',forest:'Grove capsule',sand:'Disc capsule',highland:'Beacon capsule',frost:'Rime capsule',waste:'Scrap capsule'},
    mycelite:{meadow:'Mushroom house',coast:'Tide house',forest:'Canopy house',sand:'Bloom house',highland:'Cliff house',frost:'Rime house',waste:'Cinder house'},
  },
  city:{
    human:{meadow:'Row house',coast:'Quay house',forest:'Timber row',sand:'Adobe row',highland:'Keep house',frost:'Winter row',waste:'Ash row'},
    dwarf:{meadow:'Keep',coast:'Harbor keep',forest:'Timber keep',sand:'Quarry keep',highland:'Cliff keep',frost:'Winter keep',waste:'Ash keep'},
    ghoul:{meadow:'Keep',coast:'Wreck keep',forest:'Thorn keep',sand:'Pit keep',highland:'Cliff keep',frost:'Ice keep',waste:'Bone keep'},
    alien:{meadow:'Tower',coast:'Tide tower',forest:'Canopy tower',sand:'Obelisk',highland:'Beacon tower',frost:'Rime tower',waste:'Scrap tower'},
    mycelite:{meadow:'Grove house',coast:'Reef house',forest:'Ring house',sand:'Bloom tower',highland:'Ledge tower',frost:'Rime tower',waste:'Cinder tower'},
  },
  capital:{
    human:{meadow:'Manor',coast:'Harbor manor',forest:'Timber manor',sand:'Adobe manor',highland:'Hill manor',frost:'Winter manor',waste:'Ash manor'},
    dwarf:{meadow:'Great hold',coast:'Harbor citadel',forest:'Timber citadel',sand:'Quarry citadel',highland:'Cliff citadel',frost:'Winter citadel',waste:'Ash citadel'},
    ghoul:{meadow:'Citadel',coast:'Wreck citadel',forest:'Thorn citadel',sand:'Pit citadel',highland:'Cliff citadel',frost:'Ice citadel',waste:'Bone citadel'},
    alien:{meadow:'Spire',coast:'Tide spire',forest:'Canopy spire',sand:'Dune spire',highland:'Beacon spire',frost:'Rime spire',waste:'Ash spire'},
    mycelite:{meadow:'Garden hall',coast:'Reef hall',forest:'Grove hall',sand:'Bloom hall',highland:'Ledge hall',frost:'Rime hall',waste:'Cinder hall'},
  },
};
const HALL_NAMES = {
  camp:{
    human:{meadow:'Camp hall',coast:'Shore camp',forest:'Grove camp',sand:'Dune camp',highland:'Ridge camp',frost:'Snow camp',waste:'Ash camp'},
    dwarf:{meadow:'Delve hall',coast:'Dock hall',forest:'Root hall',sand:'Quarry hall',highland:'Cliff hall',frost:'Barrow hall',waste:'Ash hall'},
    ghoul:{meadow:'Hunt hall',coast:'Wreck hall',forest:'Den hall',sand:'Pit hall',highland:'Cliff hall',frost:'Ice hall',waste:'Bone hall'},
    alien:{meadow:'Landing hall',coast:'Tide hall',forest:'Grove hall',sand:'Disc hall',highland:'Beacon hall',frost:'Rime hall',waste:'Scrap hall'},
    mycelite:{meadow:'Spore hall',coast:'Reef hall',forest:'Ring hall',sand:'Bloom hall',highland:'Ledge hall',frost:'Rime ring',waste:'Cinder hall'},
  },
  hamlet:{
    human:{meadow:'Meeting hall',coast:'Harbor hall',forest:'Lodge hall',sand:'Adobe hall',highland:'Stone hall',frost:'Winter hall',waste:'Ash hall'},
    dwarf:{meadow:'Hold hall',coast:'Wharf hall',forest:'Timber hall',sand:'Quarry hall',highland:'Cliff hall',frost:'Barrow hall',waste:'Ash hall'},
    ghoul:{meadow:'Gather den',coast:'Wreck gather',forest:'Thorn gather',sand:'Pit gather',highland:'Cliff gather',frost:'Ice gather',waste:'Bone gather'},
    alien:{meadow:'Assembly shell',coast:'Tide assembly',forest:'Canopy assembly',sand:'Disc assembly',highland:'Beacon assembly',frost:'Rime assembly',waste:'Scrap assembly'},
    mycelite:{meadow:'Cap hall',coast:'Mangrove hall',forest:'Grove hall',sand:'Puff hall',highland:'Ledge hall',frost:'Rime hall',waste:'Cinder hall'},
  },
  village:{
    human:{meadow:'Village hall',coast:'Harbor hall',forest:'Grove hall',sand:'Clay hall',highland:'Hill hall',frost:'Snow hall',waste:'Ash hall'},
    dwarf:{meadow:'Village hold',coast:'Harbor hold',forest:'Timber hold',sand:'Quarry hold',highland:'Cliff hold',frost:'Barrow hold',waste:'Ash hold'},
    ghoul:{meadow:'Village den',coast:'Wreck den',forest:'Thorn den',sand:'Sand den',highland:'Cliff den',frost:'Ice den',waste:'Bone den'},
    alien:{meadow:'Village dome',coast:'Tide dome',forest:'Canopy dome',sand:'Dune dome',highland:'Ridge dome',frost:'Frost dome',waste:'Ash dome'},
    mycelite:{meadow:'Village ring',coast:'Reef ring',forest:'Grove ring',sand:'Bloom ring',highland:'Ledge ring',frost:'Rime ring',waste:'Cinder ring'},
  },
  town:{
    human:{meadow:'Town hall',coast:'Quay hall',forest:'Timber hall',sand:'Adobe hall',highland:'Stone hall',frost:'Winter hall',waste:'Ash hall'},
    dwarf:{meadow:'Town hold',coast:'Harbor hold',forest:'Timber hold',sand:'Quarry hold',highland:'Cliff hold',frost:'Winter hold',waste:'Ash hold'},
    ghoul:{meadow:'Town keep',coast:'Wreck keep',forest:'Thorn keep',sand:'Pit keep',highland:'Cliff keep',frost:'Ice keep',waste:'Bone keep'},
    alien:{meadow:'Town beacon',coast:'Tide beacon',forest:'Canopy beacon',sand:'Disc beacon',highland:'Ridge beacon',frost:'Rime beacon',waste:'Scrap beacon'},
    mycelite:{meadow:'Town grove',coast:'Reef grove',forest:'Canopy grove',sand:'Bloom grove',highland:'Ledge grove',frost:'Rime grove',waste:'Cinder grove'},
  },
  city:{
    human:{meadow:'City hall',coast:'Harbor court',forest:'Timber court',sand:'Adobe court',highland:'Hill court',frost:'Winter court',waste:'Ash court'},
    dwarf:{meadow:'City keep',coast:'Harbor keep',forest:'Timber keep',sand:'Quarry keep',highland:'Cliff keep',frost:'Winter keep',waste:'Ash keep'},
    ghoul:{meadow:'City keep',coast:'Wreck citadel',forest:'Thorn citadel',sand:'Pit citadel',highland:'Cliff citadel',frost:'Ice citadel',waste:'Bone citadel'},
    alien:{meadow:'City spire',coast:'Tide spire',forest:'Canopy spire',sand:'Obelisk hall',highland:'Beacon spire',frost:'Rime spire',waste:'Scrap spire'},
    mycelite:{meadow:'City grove',coast:'Reef court',forest:'Ring court',sand:'Bloom court',highland:'Ledge court',frost:'Rime court',waste:'Cinder court'},
  },
  capital:{
    human:{meadow:'Great hall',coast:'Harbor palace',forest:'Timber palace',sand:'Adobe palace',highland:'Hill palace',frost:'Winter palace',waste:'Ash palace'},
    dwarf:{meadow:'Great hold',coast:'Harbor citadel',forest:'Timber citadel',sand:'Quarry citadel',highland:'Cliff citadel',frost:'Winter citadel',waste:'Ash citadel'},
    ghoul:{meadow:'Great citadel',coast:'Wreck citadel',forest:'Thorn citadel',sand:'Pit citadel',highland:'Cliff citadel',frost:'Ice citadel',waste:'Bone citadel'},
    alien:{meadow:'Great spire',coast:'Tide palace',forest:'Canopy palace',sand:'Dune palace',highland:'Beacon palace',frost:'Rime palace',waste:'Ash palace'},
    mycelite:{meadow:'Great garden',coast:'Reef palace',forest:'Grove palace',sand:'Bloom palace',highland:'Ledge palace',frost:'Rime palace',waste:'Cinder palace'},
  },
};
const FARM_NAMES = {
  human:{meadow:'Field',coast:'Tide garden',forest:'Forest garden',sand:'Oasis plot',highland:'Terrace',frost:'Cold plot',waste:'Ash plot'},
  dwarf:{meadow:'Stone plot',coast:'Dock plot',forest:'Root plot',sand:'Quarry plot',highland:'Terrace',frost:'Cold plot',waste:'Ash plot'},
  ghoul:{meadow:'Kill garden',coast:'Tide pit',forest:'Shade plot',sand:'Bone plot',highland:'Cliff plot',frost:'Ice plot',waste:'Cinder plot'},
  alien:{meadow:'Light field',coast:'Tidal array',forest:'Canopy beds',sand:'Solar plot',highland:'Ridge beds',frost:'Crystal beds',waste:'Ash array'},
  mycelite:{meadow:'Mushroom garden',coast:'Tide garden',forest:'Spore grove',sand:'Sand bloom',highland:'Cliff garden',frost:'Rime garden',waste:'Cinder garden'},
};
const PEN_NAMES = {
  human:{meadow:'Fold',coast:'Shore fold',forest:'Wood fold',sand:'Dune fold',highland:'Hill fold',frost:'Snow fold',waste:'Ash fold'},
  dwarf:{meadow:'Beast fold',coast:'Dock fold',forest:'Timber fold',sand:'Stone fold',highland:'Cliff fold',frost:'Snow fold',waste:'Ash fold'},
  ghoul:{meadow:'Beast pit',coast:'Tide pit',forest:'Thorn pit',sand:'Sand pit',highland:'Cliff pit',frost:'Ice pit',waste:'Bone pit'},
  alien:{meadow:'Stock bay',coast:'Tide bay',forest:'Grove bay',sand:'Dune bay',highland:'Ridge bay',frost:'Frost bay',waste:'Scrap bay'},
  mycelite:{meadow:'Spore yard',coast:'Tide yard',forest:'Cap yard',sand:'Bloom yard',highland:'Ledge yard',frost:'Rime yard',waste:'Cinder yard'},
};
export const EPOCHS = Object.freeze([
  { id:'camp', min:0, name:'Camp', house:{human:'Hut',dwarf:'Delve',ghoul:'Lean-to',alien:'Pod',mycelite:'Spore hut'}, hall:'Camp hall', scale:.82, levels:2, gap:2.7, beds:6, cost:.75, farm:6 },
  { id:'hamlet', min:8, name:'Hamlet', house:{human:'Shack',dwarf:'Hold',ghoul:'Shanty',alien:'Shell',mycelite:'Cap shack'}, hall:'Meeting hall', scale:.9, levels:3, gap:2.5, beds:6, cost:.85, farm:7 },
  { id:'village', min:18, name:'Village', house:{human:'Cottage',dwarf:'Hall-house',ghoul:'Den',alien:'Dome',mycelite:'Mushroom house'}, hall:'Village hall', scale:.96, levels:4, gap:2.35, beds:6, cost:.95, farm:7 },
  { id:'town', min:36, name:'Town', house:{human:'House',dwarf:'Stonehold',ghoul:'Shelter',alien:'Capsule',mycelite:'Mushroom house'}, hall:'Town hall', scale:1, levels:5, gap:2.15, beds:6, cost:1, farm:8 },
  { id:'city', min:72, name:'City', house:{human:'Row house',dwarf:'Keep',ghoul:'Keep',alien:'Tower',mycelite:'Grove house'}, hall:'City hall', scale:1.08, levels:6, gap:1.95, beds:7, cost:1.1, farm:9 },
  { id:'capital', min:130, name:'Capital', house:{human:'Manor',dwarf:'Great hold',ghoul:'Citadel',alien:'Spire',mycelite:'Garden hall'}, hall:'Great hall', scale:1.14, levels:7, gap:1.8, beds:8, cost:1.2, farm:10 },
]);
export function epochOf(population=0) {
  let found=EPOCHS[0];
  for(const e of EPOCHS)if(population>=e.min)found=e;
  return found;
}
export function epochById(id) { return EPOCHS.find(e=>e.id===id)??EPOCHS[0]; }
export function houseRecipe(material,type='house',epoch) {
  const e=typeof epoch==='string'?epochById(epoch):epoch??epochOf(0);
  const scale=n=>Math.max(1,Math.round(n*e.cost));
  if(type==='farm')return {wood:scale(8)};
  if(type==='pen')return {wood:scale(10)};
  return material==='wood'?{wood:scale(14)}:{wood:scale(4),[material]:scale(material==='crystal'?8:12)};
}
export function canAfford(stock,cost){return Object.entries(cost).every(([k,n])=>(stock[k]??0)>=n);}
export function chooseMaterial(v,nearby) {
  const choices=RACES[v.race??'human'].preferred;
  return choices.find(k=>nearby.has(k))??'wood';
}
export function settingOf(tiles=[]) {
  let water=0,sand=0,forest=0,mountain=0,snow=0,ash=0;
  for(const t of tiles){
    if(t<=1)water++;
    else if(t===2)sand++;
    else if(t===4)forest++;
    else if(t===5)mountain++;
    else if(t===6)snow++;
    else if(t===7)ash++;
  }
  if(water>=2)return 'coast';
  if(snow>=1)return 'frost';
  if(mountain>=1)return 'highland';
  if(ash>=2)return 'waste';
  if(sand>=3)return 'sand';
  if(forest>=2)return 'forest';
  return 'meadow';
}
function named(table,race,setting) {
  const row=table[race]??table.human;
  return row[setting]??row.meadow;
}
export function structureName(b,village) {
  const race=b.race??'human';
  const setting=SETTINGS.includes(b.setting)?b.setting:'meadow';
  if(b.type==='farm')return named(FARM_NAMES,race,setting);
  if(b.type==='pen')return `${named(PEN_NAMES,race,setting)} · ${MATERIALS[b.material??'wood']}`;
  const epoch=epochOf(village?.population??0);
  const table=b.type==='hall'?HALL_NAMES[epoch.id]:HOUSE_NAMES[epoch.id];
  const name=table?.[race]?.[setting]??(b.type==='hall'?epoch.hall:(epoch.house[race]??epoch.house.human));
  return `${name} · ${MATERIALS[b.material??'wood']}`;
}
