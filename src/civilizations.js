export const RACES = {
  human: {name:'Humans',singular:'Human',color:'#f0cf8f',skin:'#efc59b',coat:'#a5bfa2',preferred:['stone','clay','wood'],description:'Masters of stone and wood. They raise cabins, stone houses, and clay manors.'},
  ghoul: {name:'Ghouls',singular:'Ghoul',color:'#ed839d',skin:'#ddd0cc',coat:'#302e43',preferred:['iron','stone','wood'],description:'Ghouls in the spirit of Tokyo Ghoul: dark clothes, a red eye, and living kagune. They hunt sheep and strangers and steal stores. They build sharp-roofed shelters.'},
  alien: {name:'Aliens',singular:'Alien',color:'#7fe5e2',skin:'#80d3c5',coat:'#566b91',preferred:['crystal','iron','stone','wood'],description:'They mine with a beam tool and feed on crystal light. Their towns are domes, capsules, and glowing towers.'},
  mycelite: {name:'Mycelites',singular:'Mycelite',color:'#c8acec',skin:'#e4d5b6',coat:'#8678a1',preferred:['mycelium','clay','wood'],description:'A fungal people: they grow living houses, gather mycelium, and leave spores that turn meadows into forest.'},
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
export const DEPOSIT_KINDS=['stone','iron','crystal','clay','mycelium','fish'];
export const GATHER_ACTIONS=['mine','dig','cultivate','fish'];
export const cargoCount=u=>STOCKS.reduce((sum,k)=>sum+(u.inventory[k]??0),0);
export const inventoryText=stock=>STOCKS.filter(k=>stock[k]>0).map(k=>`${RESOURCES[k].name}: ${Math.floor(stock[k])}`).join(' · ')||'Empty';
export const emptyStock=()=>Object.fromEntries(STOCKS.map(k=>[k,0]));
export const raceOf=u=>u.race??'human';
export function houseRecipe(material,type='house') {
  if(type==='farm')return {wood:8};
  return material==='wood'?{wood:14}:{wood:4,[material]:material==='crystal'?8:12};
}
export function canAfford(stock,cost){return Object.entries(cost).every(([k,n])=>(stock[k]??0)>=n);}
export function chooseMaterial(v,nearby) {
  const choices=RACES[v.race??'human'].preferred;
  return choices.find(k=>nearby.has(k))??'wood';
}
export function structureName(b) {
  if(b.type==='farm')return b.race==='mycelite'?'Mushroom garden':'Field';
  const names={human:'House',ghoul:'Shelter',alien:'Capsule',mycelite:'Mushroom house'};
  return `${b.type==='hall'?'Hall':names[b.race??'human']} · ${MATERIALS[b.material??'wood']}`;
}
