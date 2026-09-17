import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { addDeposit } from '../src/deposits.js';

function plain() {
  const w=new World({width:48,height:48,preset:'ocean',populate:false});
  w.tiles.fill(TILE.GRASS);w.wood.fill(0);w.berries.fill(0);w.navRevision++;w.resourceRevision++;
  return w;
}
function step(w,seconds) {for(let i=0;i<Math.ceil(seconds*10);i++)w.tick(.1);}
function comfortable(u) {u.hunger=0;u.social=0;u.energy=100;u.decision=0;u.traits=['hardy','curious'];}

test('pathfinder goes through a gap and never cuts blocked corners',()=>{
  const w=plain(),nav=w.humans.navigation;
  for(let y=0;y<47;y++)w.tiles[w.index(20,y)]=TILE.MOUNTAIN;w.navRevision++;
  const from={x:10.5,y:10.5},to={x:30.5,y:10.5};nav.beginTick();
  const route=nav.findPath(from,to);assert.ok(route?.length>60);assert.equal(route.at(-1),w.index(to.x,to.y));
  let prev=from;
  for(const i of route){const next={x:i%w.width+.5,y:Math.floor(i/w.width)+.5};assert.ok(w.walkable(next.x,next.y));if(prev.x!==next.x&&prev.y!==next.y){assert.ok(w.walkable(prev.x,next.y));assert.ok(w.walkable(next.x,prev.y));}prev=next;}
  w.tiles[w.index(20,47)]=TILE.MOUNTAIN;w.navRevision++;assert.equal(nav.findPath(from,to),null);
});

test('a terrain edit makes a person find a new route before crossing water',()=>{
  const w=plain(),u=w.spawn('human',5.5,10.5);comfortable(u);w.humans.prepare();
  assert.ok(w.humans.setTask(u,{type:'wander',x:25.5,y:10.5,reason:'explore'}));
  step(w,1);w.paint('water',15,10,3);
  for(let i=0;i<180;i++){w.tick(.1);assert.ok(w.walkable(u.x,u.y));}
  assert.ok(u.x>18,'crossed around the obstacle');
});

test('wood is harvested from finite trees and carried back to the village',()=>{
  const w=plain(),v=w.createVillage(20,20,false),u=w.spawn('human',21.5,20.5,v.id);comfortable(u);
  v.food=100;v.wood=0;
  const resource=w.index(23,20);w.tiles[resource]=TILE.FOREST;w.wood[resource]=8;w.resourceRevision++;w.navRevision++;
  step(w,28);
  assert.ok(u.harvested>=2,'gathering work must reach completion');
  assert.ok(u.delivered>=2,'wood must reach the store');
  const spent=w.buildings.reduce((n,b)=>n+(b.cost?.wood??0),0);
  assert.equal(v.wood+u.inventory.wood+w.wood[resource]+spent,8,'no wood is created for free');
  assert.ok(u.skills.chop>0);
});

test('berries and farm harvest finish their timers and deplete their source',()=>{
  for(const type of ['forage','farm']) {
    const w=plain(),u=w.spawn('human',10.5,10.5);comfortable(u);let target;
    if(type==='forage'){const i=w.index(10,10);w.berries[i]=6;w.resourceRevision++;target={resource:i};}
    else {w.buildings.push({id:w.nextId++,villageId:999,x:11,y:10,type:'farm',complete:true,progress:1,crop:6});target={targetId:w.buildings[0].id};}
    w.humans.prepare();w.humans.setTask(u,{type,x:10.5,y:10.5,reason:'food',...target});
    // One assigned job: stop as soon as the human has completed it.
    for(let i=0;i<40&&u.task;i++){w.humans.prepare();w.humans.tick(u,.1);}
    assert.equal(u.inventory.food,type==='forage'?3:4);
    assert.equal(type==='forage'?w.berries[target.resource]:w.buildings[0].crop,type==='forage'?3:2);
  }
});

test('empty settlements cannot generate stock, complete construction or reproduce',()=>{
  const w=plain(),v=w.createVillage(20,20),b=w.addBuilding(v,'house',false);const food=v.food,wood=v.wood;
  step(w,35);assert.equal(v.food,food);assert.equal(v.wood,wood);assert.equal(b.progress,0);assert.equal(w.units.length,0);
});

test('a builder must reach the site before construction progresses',()=>{
  const w=plain(),v=w.createVillage(20,20,false),b=w.addBuilding(v,'house',false),u=w.spawn('human',2.5,2.5,v.id);comfortable(u);v.food=100;v.wood=0;
  w.humans.prepare();const p=w.humans.approach(u,b);assert.ok(p);assert.ok(w.humans.setTask(u,{type:'build',...p,reason:'housing',targetId:b.id}));
  step(w,1);assert.equal(b.progress,0);
  step(w,35);assert.equal(b.complete,true);assert.equal(u.structures,1);
});

test('hunger uses carried food first, fatigue causes rest and fire interrupts work',()=>{
  const w=plain(),v=w.createVillage(20,20),u=w.spawn('human',10.5,10.5,v.id);comfortable(u);u.hunger=80;u.inventory.food=2;u.energy=8;
  w.humans.prepare();w.humans.choose(u);assert.equal(u.action,'eat');assert.equal(u.task.personal,true);
  step(w,2);assert.ok(u.hunger<45);step(w,1);assert.equal(u.action,'rest');
  w.paint('fire',Math.floor(u.x),Math.floor(u.y),1);w.humans.prepare();u.dangerTimer=0;w.humans.tick(u,.1);assert.equal(u.action,'flee');
});

test('settlers on disconnected islands cannot form a joint village',()=>{
  const w=new World({width:48,height:48,preset:'ocean',populate:false});
  w.paint('grass',15,20,2);w.paint('grass',21,20,2);
  w.spawn('human',15,20);w.spawn('human',16,20);w.spawn('human',21,20);w.settle();assert.equal(w.villages.length,0);
});

test('families require housing and supplies; children inherit parents and learn',()=>{
  const w=plain(),v=w.createVillage(20,20),a=w.spawn('human',21.5,20.5,v.id),b=w.spawn('human',21.5,21.5,v.id);
  for(const u of [a,b]){comfortable(u);u.age=25;u.homeId=w.buildings[0].id;}
  a.partnerId=b.id;b.partnerId=a.id;w.updatePopulations();w.humans.prepare();
  v.food=0;w.humans.families(.1);assert.equal(a.pregnancy+b.pregnancy,0);
  v.food=20;w.humans.families(.1);assert.equal(a.pregnancy+b.pregnancy,6);
  for(let i=0;i<61;i++){w.humans.prepare();w.humans.families(.1);}
  const child=w.units.find(u=>u.age<18);assert.ok(child);assert.deepEqual(new Set(child.parentIds),new Set([a.id,b.id]));assert.equal(child.job,'child');
  child.x=a.x;child.y=a.y;w.humans.prepare();w.humans.setTask(child,{type:'socialize',x:a.x,y:a.y,reason:'child',targetId:a.id});
  for(let i=0;i<20;i++){w.humans.prepare();w.humans.tick(child,.1);}
  assert.ok(child.skills.forage>0);assert.equal(child.harvested,0);
});

test('version 1 saves migrate and malformed AI routes are rejected',()=>{
  const w=new World(),old=JSON.parse(w.serialize());old.version=1;
  for(const u of old.units)if(u.kind==='human'){delete u.traits;delete u.path;delete u.skills;}
  const migrated=World.deserialize(JSON.stringify(old));assert.ok(migrated.units.filter(u=>u.kind==='human').every(u=>u.traits.length===2&&Array.isArray(u.path)));
  const invalid=JSON.parse(w.serialize());invalid.units.find(u=>u.kind==='human').path=[-1];assert.throws(()=>World.deserialize(JSON.stringify(invalid)));
});

test('a town can keep growing past 500 people',()=>{
  const w=new World({preset:'continent'});
  const p=w.findLand(96,64);while(w.units.length<520)assert.ok(w.spawn('human',p.x,p.y,w.villages[0].id));
  assert.ok(w.units.length>=520);
  w.updatePopulations();
  assert.equal(w.villages[0].epoch,'capital');
});

test('500 humans keep finite needs and a save below the RUN storage limit',()=>{
  const w=new World({preset:'continent'});
  const p=w.findLand(96,64);while(w.units.length<500)w.spawn('human',p.x,p.y,w.villages[0].id);
  step(w,8);
  assert.ok(w.units.every(u=>u.kind!=='human'||[u.hunger,u.energy,u.social].every(n=>Number.isFinite(n)&&n>=0&&n<=100)));
  assert.ok(Buffer.byteLength(w.serialize())<950000);assert.doesNotThrow(()=>World.deserialize(w.serialize()));
});

test('a hungry ghoul hunts nearby sheep instead of foraging',()=>{
  const w=plain(),g=w.spawn('ghoul',10.5,10.5),sheep=w.spawn('sheep',12.5,10.5);
  comfortable(g);g.hunger=80;g.inventory.food=0;w.humans.prepare();w.humans.choose(g);
  assert.equal(g.action,'hunt');assert.equal(g.task.targetId,sheep.id);
});

test('ghouls steal food from a foreign store when their own is empty',()=>{
  const w=plain(),home=w.createVillage(12,12,true,'ghoul'),foreign=w.createVillage(22,12,true,'human');
  home.food=0;foreign.food=40;const g=w.spawn('ghoul',12.5,12.5,home.id);comfortable(g);g.hunger=70;g.inventory.food=0;
  w.humans.prepare();w.humans.choose(g);assert.equal(g.action,'steal');assert.equal(g.task.targetId,foreign.id);
});

test('a guard clashes with a foreign miner on a claimed deposit',()=>{
  const w=plain(),human=w.createVillage(20,20,false,'human'),ghoul=w.createVillage(26,20,false,'ghoul');
  const d=addDeposit(w,'iron',23,20,30);assert.ok(d);
  const guard=w.spawn('human',21.5,20.5,human.id),miner=w.spawn('ghoul',24.5,20.5,ghoul.id);
  comfortable(guard);comfortable(miner);guard.job='guard';w.humans.prepare();
  assert.ok(w.humans.setTask(miner,w.humans.taskTarget('mine',22.5,20.5,'iron',{targetId:d.id,depositKind:'iron'})));
  w.humans.prepare();guard.dangerTimer=0;w.humans.tick(guard,.1);
  assert.equal(guard.action,'defend');assert.equal(guard.task.targetId,miner.id);
});

test('mycelites spread forest or mycelium when spores take hold',()=>{
  const w=plain();w.spawn('mycelite',10.5,10.5);
  let grew=false;
  for(let i=0;i<40&&!grew;i++){w.spreadSpores(10.5,10.5);grew=w.tiles[w.index(11,10)]===4||w.deposits.some(d=>d.kind==='mycelium');}
  assert.ok(grew);
});

test('aliens recover hunger while mining crystals',()=>{
  const w=plain(),d=addDeposit(w,'crystal',11,10,24),u=w.spawn('alien',10.5,10.5);
  comfortable(u);u.hunger=50;w.humans.prepare();
  assert.ok(w.humans.setTask(u,w.humans.taskTarget('mine',10.5,10.5,'crystal',{targetId:d.id,depositKind:'crystal'})));
  for(let i=0;i<80&&u.task;i++){w.humans.prepare();w.humans.tick(u,.1);}
  assert.ok(u.harvested>=1);assert.ok(u.hunger<50);
});

test('a guard scouts an unknown town and writes it into the chronicle',()=>{
  const w=plain(),home=w.createVillage(10,20,true,'human'),foreign=w.createVillage(30,20,true,'ghoul');
  const guard=w.spawn('human',10.5,20.5,home.id);comfortable(guard);guard.job='guard';guard.social=0;
  w.humans.prepare();w.humans.choose(guard);
  assert.equal(guard.action,'scout');assert.equal(guard.task.targetId,foreign.id);
  step(w,18);
  assert.ok(home.known.includes(foreign.id));
  assert.ok(w.events.some(e=>e.type==='scout'&&e.message.includes(foreign.name)));
  const copy=World.deserialize(w.serialize());
  assert.deepEqual(copy.villages.find(v=>v.id===home.id).known,[foreign.id]);
});

test('a trespasser on claimed land is named in the chronicle',()=>{
  const w=plain(),human=w.createVillage(20,20,false,'human'),ghoul=w.createVillage(36,20,false,'ghoul');
  const guard=w.spawn('human',21.5,20.5,human.id),intruder=w.spawn('ghoul',22.5,20.5,ghoul.id);
  comfortable(guard);comfortable(intruder);guard.job='guard';
  w.humans.prepare();guard.dangerTimer=0;w.humans.tick(guard,.1);
  assert.equal(guard.action,'defend');assert.equal(guard.task.targetId,intruder.id);
  assert.ok(w.events.some(e=>e.type==='border'&&e.message.includes(human.name)&&e.message.includes(ghoul.name)));
});

test('border heat starts a war and a guard sieges a foreign house',()=>{
  const w=plain(),home=w.createVillage(10,20,true,'human'),foreign=w.createVillage(26,20,true,'ghoul');
  w.humans.prepare();
  for(let i=0;i<4;i++)w.humans.heatUp(home,foreign,12);
  assert.ok(home.wars.includes(foreign.id));
  assert.ok(foreign.wars.includes(home.id));
  assert.ok(w.events.some(e=>e.type==='war'&&e.message.includes(home.name)&&e.message.includes(foreign.name)));
  const house=w.buildings.find(b=>b.villageId===foreign.id&&b.type==='house');
  const guard=w.spawn('human',10.5,20.5,home.id);comfortable(guard);guard.job='guard';guard.social=0;guard.traits=['brave','hardy'];
  w.humans.prepare();w.humans.choose(guard);
  assert.equal(guard.action,'siege');
  assert.ok(w.buildings.some(b=>b.id===guard.task.targetId&&b.villageId===foreign.id));
  const mark=guard.task.targetId;
  step(w,28);
  assert.equal(w.buildings.some(b=>b.id===mark),false);
  assert.ok(w.events.some(e=>e.type==='siege'));
  const copy=World.deserialize(w.serialize());
  assert.ok(copy.villages.find(v=>v.id===home.id).wars.includes(foreign.id));
  assert.ok(copy.villages.find(v=>v.id===home.id).heat.some(h=>h.id===foreign.id&&h.value>=40));
});

test('civilians flee a town under siege as refugees',()=>{
  const w=plain(),home=w.createVillage(10,20,true,'human'),haven=w.createVillage(10,36,true,'human'),foe=w.createVillage(26,20,true,'ghoul');
  home.wars=[foe.id];foe.wars=[home.id];
  const hall=w.buildings.find(b=>b.villageId===home.id&&b.type==='hall');
  const child=w.spawn('human',10.5,20.5,home.id);comfortable(child);child.age=8;child.job='child';child.social=0;
  const raider=w.spawn('ghoul',12.5,20.5,foe.id);comfortable(raider);raider.action='siege';raider.task={type:'siege',x:hall.x+.5,y:hall.y+.5,reason:'war',targetId:hall.id};
  w.humans.prepare();w.humans.choose(child);
  assert.equal(child.action,'migrate');assert.equal(child.reason,'refuge');assert.equal(child.task.targetId,haven.id);
});

test('people cheer when the player places a deposit and then go claim it',()=>{
  const w=plain(),u=w.spawn('human',20.5,20.5);comfortable(u);
  w.humans.prepare();
  assert.ok(w.paint('stone',22,20));
  assert.equal(u.action,'cheer');
  assert.equal(u.task.depositKind,'stone');
  assert.ok(w.effects.some(e=>e.kind==='cheer'));
  assert.equal(u.memories[0]?.type,'gift');
  for(let i=0;i<40&&u.action==='cheer';i++){w.humans.prepare();w.humans.tick(u,.1);}
  assert.equal(u.action,'mine');
  assert.equal(u.task.depositKind,'stone');
  assert.doesNotThrow(()=>World.deserialize(w.serialize()));
});

test('seeded deposits do not make people cheer, and sheep ignore a gift',()=>{
  const w=plain(),u=w.spawn('human',20.5,20.5),sheep=w.spawn('sheep',21.5,20.5);
  comfortable(u);addDeposit(w,'stone',22,20,30);
  w.humans.prepare();w.humans.tick(u,.1);
  assert.notEqual(u.action,'cheer');
  w.paint('iron',26,20);
  assert.equal(u.action,'cheer');
  assert.notEqual(sheep.action,'cheer');
});

test('aliens cheer at distant crystals that humans do not notice',()=>{
  const w=plain(),alien=w.spawn('alien',10.5,10.5),human=w.spawn('human',10.5,12.5);
  comfortable(alien);comfortable(human);w.humans.prepare();
  assert.ok(w.paint('crystal',10,30));
  assert.equal(alien.action,'cheer');
  assert.notEqual(human.action,'cheer');
});

test('people choose to herd nearby wild sheep',()=>{
  const w=plain(),v=w.createVillage(20,20,true);
  const u=w.spawn('human',21.5,20.5,v.id);comfortable(u);u.job='herder';u.age=24;
  v.food=80;v.wood=80;
  const sheep=w.spawn('sheep',23.5,20.5);
  w.humans.prepare();w.humans.choose(u);
  assert.equal(u.action,'herd');
  assert.equal(u.task.targetId,sheep.id);
});

test('a herder catches a sheep and drives it into a fold',()=>{
  const w=plain(),v=w.createVillage(20,20,true);
  const u=w.spawn('human',21.5,20.5,v.id);comfortable(u);u.job='herder';u.age=24;
  v.food=80;v.wood=80;
  const pen=w.addBuilding(v,'pen',true);
  assert.ok(pen);
  const sheep=w.spawn('sheep',22.5,20.5);
  w.humans.prepare();
  assert.ok(w.humans.setTask(u,{type:'herd',x:sheep.x,y:sheep.y,reason:'herd',targetId:sheep.id}));
  step(w,22);
  assert.equal(sheep.villageId,v.id);
  assert.equal(sheep.penId,pen.id);
  assert.ok(w.events.some(e=>e.type==='herd'&&e.message.includes(u.name)));
});

test('a town with wild sheep starts a fold',()=>{
  const w=plain(),v=w.createVillage(20,20,true);
  v.food=80;v.wood=40;
  for(let i=0;i<4;i++)w.spawn('sheep',24.5+i*.2,20.5);
  const u=w.spawn('human',21.5,20.5,v.id);comfortable(u);u.age=24;
  step(w,8);
  assert.ok(w.buildings.some(b=>b.type==='pen'));
});

test('a growing town still raises a fold before extra houses',()=>{
  const w=plain(),v=w.createVillage(20,20,true);
  v.food=80;v.wood=40;
  for(let i=0;i<8;i++){const u=w.spawn('human',21.2+i*.12,20.5,v.id);comfortable(u);u.age=24;}
  for(let i=0;i<4;i++)w.spawn('sheep',24.5+i*.2,20.5);
  step(w,8);
  assert.ok(w.buildings.some(b=>b.type==='pen'));
});

test('ghouls hunt cows instead of herding them',()=>{
  const w=plain(),g=w.spawn('ghoul',10.5,10.5),cow=w.spawn('cow',12.5,10.5);
  comfortable(g);g.hunger=70;w.humans.prepare();w.humans.choose(g);
  assert.equal(g.action,'hunt');assert.equal(g.task.targetId,cow.id);
});

test('dwarves live long, keep hardy, and raise stronger halls',()=>{
  const human=plain(),hv=human.createVillage(20,20,true,'human');
  const dwarf=plain(),dv=dwarf.createVillage(20,20,true,'dwarf');
  const u=dwarf.spawn('dwarf',20.5,20.5,dv.id);
  assert.equal(u.race,'dwarf');
  assert.ok(u.lifetime>90);
  assert.ok(u.traits.includes('hardy'));
  assert.ok(u.skills.mine>=1);
  assert.ok(dwarf.buildings.find(b=>b.type==='hall').hp>human.buildings.find(b=>b.type==='hall').hp);
  assert.equal(dv.name,'Irondeep');
});

test('dwarves and humans bind as allies with less trust than strangers',()=>{
  const w=plain(),a=w.createVillage(12,12,true,'dwarf'),b=w.createVillage(28,12,true,'human');
  a.known=[b.id];b.known=[a.id];
  a.ties=[{id:b.id,debt:0,grudge:0,trust:14,legend:''}];
  b.ties=[{id:a.id,debt:0,grudge:0,trust:14,legend:''}];
  w.humans.prepare();
  assert.equal(w.humans.tryAlliance(),true);
  assert.ok((a.allies??[]).includes(b.id));
});

test('known towns trade food for a real store good and send a cart',()=>{
  const w=plain(),buyer=w.createVillage(12,12,true),seller=w.createVillage(28,12,true);
  buyer.known=[seller.id];seller.known=[buyer.id];
  buyer.food=50;seller.food=20;seller.iron=12;buyer.iron=0;
  const trader=w.spawn('human',28.5,12.5,seller.id);comfortable(trader);trader.age=24;
  w.humans.prepare();
  assert.equal(w.humans.tryTrade(),true);
  assert.ok(buyer.iron>=3);
  assert.ok(seller.food>20);
  assert.equal(buyer.lastTrade?.good,'iron');
  assert.equal(seller.lastTrade?.partnerId,buyer.id);
  assert.ok(w.caravans.some(c=>c.good==='iron'&&c.fromId===seller.id&&c.toId===buyer.id));
  assert.ok(w.events.some(e=>e.type==='trade'&&e.message.includes('iron')));
  const copy=World.deserialize(w.serialize());
  assert.equal(copy.villages.find(v=>v.id===buyer.id).lastTrade.good,'iron');
  assert.equal(copy.villages.find(v=>v.id===seller.id).iron,seller.iron);
});

test('a market stamp on a town opens a road and forces a deal',()=>{
  const w=plain(),home=w.createVillage(12,12,true),there=w.createVillage(30,12,true);
  home.food=2;there.stone=0;there.food=8;
  w.spawn('human',12.5,12.5,home.id);
  assert.equal(w.paint('trade',12,12),true);
  assert.ok((home.known??[]).includes(there.id));
  assert.ok((home.market??0)>=40);
  assert.ok(home.lastTrade||there.lastTrade);
  assert.ok(w.caravans.length>=1);
  assert.equal(w.paint('trade',2,2),false);
});
