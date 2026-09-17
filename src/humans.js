import { Navigation } from './navigation.js';
import { RACES, RESOURCES, STOCKS, TRADE_GOODS, GATHER_ACTIONS, DEPOSIT_KINDS, cargoCount, emptyStock, raceOf, chooseMaterial, houseRecipe, canAfford, epochOf, UNIT_LIMIT, isLivestock, livestockSlots, PEN_SLOTS, isDwelling } from './civilizations.js';
import { bumpTie, tieTrust } from './chronicle.js';

export const JOBS = { forager:'Forager', farmer:'Farmer', woodcutter:'Woodcutter', builder:'Builder', guard:'Guard', child:'Child',mason:'Mason',miner:'Miner',crystalist:'Crystalist',potter:'Potter',mycologist:'Mycologist',fisher:'Fisher',herder:'Herder' };
export const TRAITS = { diligent:'Diligent', careful:'Careful', social:'Sociable', brave:'Brave', hardy:'Hardy', curious:'Curious' };
export const ACTIONS = { idle:'Looking around', wander:'Exploring nearby', forage:'Picking berries', chop:'Chopping a tree', farm:'Harvesting a field', build:'Building', deliver:'Carrying stores home', eat:'Eating', rest:'Resting', socialize:'Talking', flee:'Fleeing danger', defend:'Defending the town', patrol:'Patrolling', scout:'Scouting the land', migrate:'Looking for a new town',mine:'Mining rock',dig:'Digging clay',cultivate:'Gathering mycelium',fish:'Fishing',hunt:'Hunting',steal:'Stealing foreign stores',siege:'Storming a building',cheer:'Cheering at a find',herd:'Driving animals to the fold',shelter:'Seeking shelter',marvel:'Watching the sky',dance:'Dancing in the street',cart:'Driving a cart' };
export const REASONS = { danger:'Fire or a predator is nearby. Survive first.', protect:'A predator or stranger is close. Defending self and neighbors.', hungry:'Hungry, and looking for food that can be reached.', tired:'Tired. Recovering strength.', lonely:'Needs company.', cargo:'Need to deliver the haul to the shared store.', wood:'The town needs wood for buildings.', food:'Filling the shared food store.', housing:'Building homes for a growing town.', farming:'The town needs more fields.', duty:'Keeping the town safe.', scout:'Walking past the edge of their land to see who lives nearby.', explore:'Looking for useful places nearby.', stranded:'The old town is unreachable. Looking for a new home.', blocked:'The path is blocked. Picking another goal.', child:'A child playing and spending time with family.', recovery:'Health needs food and rest.', raid:'A foreign town is storing food. It can be taken by force.', claim:'A stranger is gathering a resource on the town border.', war:'The town is at war. Strike the enemy.', refuge:'The town is under attack. Seeking safety.', bounty:'A new deposit appeared. Claiming it for the town.', weather:'The sky has changed. People are answering it.', marvel:'A wonder hangs in the sky.', festival:'A feast with a neighboring town.', trade:'Taking goods down the road to a neighboring town.' };
const MALE=['Aren','Miron','Tikhon','Lev','Yaromir','Dan','Lucas','Radan','Finn','Eric','Ren','Theo'];
const FEMALE=['Mira','Lina','Eira','Nora','Asya','Iva','Leia','Rada','Ella','Maya','Yana','Vesta'];
const FAMILIES=['Forest','Shore','Ash','Heather','Cedar','Falcon','Spark','Stone'];
Object.assign(REASONS,{stone:'Stone is needed for strong walls.',iron:'Mining ore for metal houses.',crystal:'Crystals are needed for glowing buildings.',clay:'Gathering clay for new houses.',mycelium:'Collecting living material for mushroom houses.',fish:'Filling the fish stores from the shore.',herd:'A wild animal can be brought into the fold.'});
const SKILL_FOR_JOB={farmer:'farm',woodcutter:'chop',builder:'build',guard:'combat',forager:'forage',mason:'mine',miner:'mine',crystalist:'mine',potter:'dig',mycologist:'cultivate',fisher:'fish',herder:'farm'};
const SKILLS=['farm','chop','build','combat','forage','mine','dig','cultivate','fish'];
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const has=(u,t)=>u.traits.includes(t);
const ready=b=>b.complete!==false;

export function initializeHuman(world,u,parents=[]) {
  const rng=world.rng, sex=u.id%2===0?'f':'m', choices=Object.keys(TRAITS);
  const inherited=parents.length?parents[rng.int(parents.length)].traits[0]:choices[rng.int(choices.length)];
  const remaining=choices.filter(t=>t!==inherited);
  Object.assign(u,{ sex, name:(sex==='f'?FEMALE:MALE)[rng.int(12)], surname:parents[0]?.surname??FAMILIES[rng.int(FAMILIES.length)],
    traits:[inherited,remaining[rng.int(remaining.length)]], job:'forager', hunger:18+rng.next()*18, energy:75+rng.next()*25, social:35+rng.next()*15,
    race:u.race??parents[0]?.race??'human',skills:Object.fromEntries(SKILLS.map(s=>[s,parents.length?0:rng.next()*1.5])), inventory:emptyStock(),
    homeId:null, partnerId:null, parentIds:parents.map(p=>p.id), bonds:[], memories:[], pregnancy:0, pregnancyPartnerId:null, familyCooldown:0,
    task:null, action:'idle', reason:'explore', path:[], pathRevision:-1, stuck:0, progress:0, lifetime:76+rng.next()*16+(has({traits:[inherited]},'hardy')?8:0),
    harvested:0, delivered:0, structures:0, dangerTimer:0, decision:rng.next(), bornYear:Math.max(1,world.year-Math.floor(u.age)) });
  if(parents.length) { u.age=0; u.job='child'; u.hunger=10; u.energy=100; }
  if(u.race==='alien'){u.name=['Zi','Ori','Xi','Ion','Neo','Vega'][rng.int(6)];u.surname=['Tau','Lyra','Omega'][rng.int(3)];}
  if(u.race==='mycelite'){u.name=['Miko','Spore','Moss','Lumi','Truff','Pori'][rng.int(6)];u.surname=['Root','Dew','Cap'][rng.int(3)];}
  if(u.race==='ghoul'){u.name=['Rei','Aki','Rin','Yuki','Haru','Sora'][rng.int(6)];u.surname=['Kuro','Tsuki','Arai'][rng.int(3)];}
  if(u.race==='dwarf'){
    u.name=['Bram','Durn','Karg','Helga','Nara','Thora'][rng.int(6)];u.surname=['Ironfoot','Stonebeard','Anvil','Deepdelve'][rng.int(4)];
    u.lifetime=Math.min(120,u.lifetime+22);
    if(!u.traits.includes('hardy'))u.traits=[u.traits[0],'hardy'];
    u.skills.mine=Math.min(10,(u.skills.mine??0)+1.2);
  }
}

export function humanMood(u) { return Math.round(clamp((100-u.hunger)*.3+u.energy*.25+(100-u.social)*.25+u.hp*.2-(u.homeId==null?12:0))); }
export function activityLabel(u) {
  const action=u.action==='cheer'?`Cheering at ${RESOURCES[u.task?.depositKind]?.name??'a find'}`:u.action==='mine'?`Mining ${u.task?.depositKind==='iron'?'ore':u.task?.depositKind==='crystal'?'crystals':'stone'}`:u.action==='cart'?`Hauling ${RESOURCES[u.task?.good]?.name??'stores'} to market`:ACTIONS[u.action]??ACTIONS.idle;
  if(!u.path?.length) return action;
  return ({chop:'Walking to a tree',forage:'Walking for berries',farm:'Walking to a field',build:'Walking to a building site',eat:'Walking for food',rest:'Heading back to rest',socialize:'Walking to a friend',mine:'Walking to a deposit',dig:'Walking for clay',cultivate:'Walking to the mycelium',fish:'Walking to fish',hunt:'On the trail',steal:'Sneaking toward foreign stores',defend:'Running to defend',scout:'Heading out to scout',patrol:'Walking the border',siege:'Marching to siege',herd:'Driving a beast home',shelter:'Running for a roof',marvel:'Walking out to see the sky',dance:'Going to dance',cart:'Walking the trade road'})[u.action]??action;
}

export function validateHuman(u,tiles,nextId) {
  const finite=n=>typeof n==='number'&&Number.isFinite(n), ref=n=>n==null||(Number.isInteger(n)&&n>0&&n<nextId);
  if(!Object.hasOwn(RACES,u.race))return false;
  if(!['m','f'].includes(u.sex)||typeof u.name!=='string'||u.name.length>32||typeof u.surname!=='string'||u.surname.length>32||!(u.job in JOBS)||!(u.action in ACTIONS)||!(u.reason in REASONS))return false;
  if(!Array.isArray(u.traits)||u.traits.length>2||u.traits.some(t=>!(t in TRAITS))||!['hunger','energy','social'].every(k=>finite(u[k])&&u[k]>=0&&u[k]<=100))return false;
  if(!u.skills||!SKILLS.every(k=>finite(u.skills[k])&&u.skills[k]>=0&&u.skills[k]<=10)||!u.inventory||!STOCKS.every(k=>finite(u.inventory[k])&&u.inventory[k]>=0&&u.inventory[k]<=6)||cargoCount(u)>6)return false;
  if(!['homeId','partnerId','pregnancyPartnerId'].every(k=>ref(u[k]))||!Array.isArray(u.parentIds)||u.parentIds.length>2||u.parentIds.some(id=>!ref(id)))return false;
  if(!Array.isArray(u.path)||u.path.length>128||u.path.some(i=>!Number.isInteger(i)||i<0||i>=tiles))return false;
  if(!['pathRevision','stuck','progress','lifetime','harvested','delivered','structures','dangerTimer','bornYear','pregnancy','familyCooldown'].every(k=>finite(u[k])))return false;
  if(u.lifetime<1||u.lifetime>120||u.pregnancy<0||u.pregnancy>6||u.familyCooldown<0||u.familyCooldown>100)return false;
  if(!Array.isArray(u.bonds)||u.bonds.length>4||u.bonds.some(b=>!b||!ref(b.id)||!finite(b.value)||b.value<0||b.value>100))return false;
  if(!Array.isArray(u.memories)||u.memories.length>5||u.memories.some(m=>!m||!['loss','wood','build','friend','family','birth','move','defend','hunt','steal','clash','disaster','scout','siege','refuge','gift','herd','weather','festival','marvel','trade'].includes(m.type)||!finite(m.year)||!ref(m.otherId)))return false;
  if(u.task) {
    const t=u.task;
    if(!(t.type in ACTIONS)||!(t.reason in REASONS)||!finite(t.x)||!finite(t.y)||!ref(t.targetId))return false;
    if(t.resource!=null&&(!Number.isInteger(t.resource)||t.resource<0||t.resource>=tiles))return false;
    if(['chop','forage'].includes(t.type)&&t.resource==null)return false;
    if(['build','farm','socialize','defend','migrate','hunt','steal','siege','cheer','herd'].includes(t.type)&&t.targetId==null)return false;
    if((t.type==='cheer'||GATHER_ACTIONS.includes(t.type))&&(t.targetId==null||!DEPOSIT_KINDS.includes(t.depositKind)||(t.type!=='cheer'&&RESOURCES[t.depositKind].action!==t.type)))return false;
  }
  return true;
}

export class HumanSystem {
  constructor(world) { this.world=world; this.navigation=new Navigation(world); this.byId=new Map(); this.villages=new Map(); this.buildings=new Map(); this.buckets=new Map(); this.claims=new Map(); this.resourceRevision=-1; this.woodSites=[]; this.foodSites=[]; }
  prepare() {
    const w=this.world; this.navigation.beginTick(); this.byId=new Map(w.units.map(u=>[u.id,u])); this.villages=new Map(w.villages.map(v=>[v.id,v])); this.buildings=new Map(w.buildings.map(b=>[b.id,b])); this.buckets.clear(); this.claims.clear();
    for(const u of w.units) {
      const key=`${Math.floor(u.x/8)},${Math.floor(u.y/8)}`;
      if(!this.buckets.has(key)) this.buckets.set(key,[]); this.buckets.get(key).push(u);
      if(u.kind==='human'&&u.task&&['chop','forage','farm','herd',...GATHER_ACTIONS].includes(u.task.type)) this.claims.set(`${u.task.type}:${u.task.resource??u.task.targetId}`,u.id);
    }
    if(this.resourceRevision!==w.resourceRevision) {
      this.woodSites=[];this.foodSites=[];
      for(let i=0;i<w.tiles.length;i++) { if(w.wood[i]>0&&w.tiles[i]===4)this.woodSites.push(i);if(w.berries[i]>0)this.foodSites.push(i); }
      this.resourceRevision=w.resourceRevision;
    }
  }
  nearby(u,radius=10) {
    const result=[], bx=Math.floor(u.x/8),by=Math.floor(u.y/8),span=Math.ceil(radius/8);
    for(let y=by-span;y<=by+span;y++) for(let x=bx-span;x<=bx+span;x++) for(const other of this.buckets.get(`${x},${y}`)??[]) if(other.id!==u.id&&other.hp>0&&dist(u,other)<=radius)result.push(other);
    return result;
  }
  claimVillage(d) {
    const owner=this.world.ownerAt(d.x+.5,d.y+.5);
    if(owner&&this.approach(owner,d))return owner;
    return this.world.villages.filter(v=>dist(v,d)<this.world.claimRadius(v)&&this.approach(v,d)).sort((a,b)=>dist(a,d)-dist(b,d))[0]??null;
  }
  danger(u) {
    const w=this.world, x=Math.floor(u.x),y=Math.floor(u.y);
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(w.inBounds(x+dx,y+dy)&&w.fire[w.index(x+dx,y+dy)]>0)return {x:x+dx+.5,y:y+dy+.5,kind:'fire'};
    const near=this.nearby(u,has(u,'careful')?9:6);
    const wolf=near.find(a=>a.kind==='wolf');if(wolf)return wolf;
    const hunter=near.find(a=>a.kind==='human'&&a.action==='hunt'&&a.task?.targetId===u.id);if(hunter)return hunter;
    if(u.race!=='ghoul'){const ghoul=near.find(a=>a.kind==='human'&&a.race==='ghoul'&&a.action==='hunt');if(ghoul)return ghoul;}
    const raider=near.find(a=>a.kind==='human'&&(a.action==='steal'||a.action==='siege')&&a.villageId!==u.villageId);
    if(raider&&(u.job==='guard'||has(u,'brave')||this.atWar(this.villages.get(u.villageId),this.villages.get(raider.villageId))))return raider;
    if(u.job==='guard') {
      const poacher=near.find(a=>a.kind==='human'&&raceOf(a)!==raceOf(u)&&GATHER_ACTIONS.includes(a.action));
      if(poacher){const d=w.deposits.find(p=>p.id===poacher.task?.targetId);if(d&&this.claimVillage(d)?.id===u.villageId){this.alertBorder(u,poacher);return poacher;}}
      const trespasser=near.find(a=>a.kind==='human'&&a.villageId!==u.villageId&&raceOf(a)!==raceOf(u)&&w.ownerAt(a.x,a.y)?.id===u.villageId);
      if(trespasser){this.alertBorder(u,trespasser);return trespasser;}
    }
    return null;
  }
  remember(u,type,otherId=null) { u.memories.unshift({type,year:this.world.year,otherId});u.memories.length=Math.min(5,u.memories.length); }
  alertBorder(guard,intruder) {
    const w=this.world,v=this.villages.get(guard.villageId);
    if(!v||v.borderYear===w.year)return;
    v.borderYear=w.year;
    const home=this.villages.get(intruder.villageId);
    w.tell('border',{town:v.name,other:home?.name??'nowhere',home:home?.name,who:intruder.name});
    w.emit('border',guard.x,guard.y,{race:guard.race},1.05);
    if(home)this.heatUp(v,home,12);
  }
  heatOf(v,id) { return v?.heat?.find(h=>h.id===id)?.value??0; }
  atWar(a,b) { return !!(a&&b&&((a.wars??[]).includes(b.id)||(b.wars??[]).includes(a.id))); }
  heatUp(from,to,amount) {
    if(!from||!to||from.id===to.id)return;
    from.heat??=[];
    let row=from.heat.find(h=>h.id===to.id);
    if(!row){
      if(from.heat.length>=8)from.heat.sort((a,b)=>a.value-b.value).shift();
      row={id:to.id,value:0};from.heat.push(row);
    }
    row.value=clamp(row.value+amount);
    bumpTie(from,to,{grudge:amount});
    if(row.value>=40)this.declareWar(from,to);
  }
  declareWar(a,b) {
    if(!a||!b||a.id===b.id)return;
    a.wars??=[];b.wars??=[];
    if(a.wars.includes(b.id))return;
    a.wars.push(b.id);if(!b.wars.includes(a.id))b.wars.push(a.id);
    this.world.tell('war',{town:a.name,other:b.name,home:a.name,there:b.name});
    this.world.emit('war',(a.x+b.x)/2,(a.y+b.y)/2,{race:a.race},1.5);
  }
  coolWars() {
    const w=this.world;
    for(const v of w.villages) {
      for(const h of v.heat??[])h.value=Math.max(0,h.value-2);
      v.heat=(v.heat??[]).filter(h=>h.value>=1);
      const next=[];
      for(const id of v.wars??[]) {
        const other=this.villages.get(id);
        if(other&&(this.heatOf(v,id)>=12||this.heatOf(other,v.id)>=12))next.push(id);
        else if(other&&v.id<other.id) {
          other.wars=(other.wars??[]).filter(x=>x!==v.id);
          w.tell('peace',{town:v.name,other:other.name,home:v.name,there:other.name});
        }
      }
      v.wars=next;
    }
  }
  tryAlliance() {
    const w=this.world;
    for(const v of w.villages) {
      for(const id of v.known??[]) {
        const other=this.villages.get(id);
        if(!other||this.atWar(v,other)||(v.allies??[]).includes(other.id))continue;
        const foeId=(v.wars??[]).find(wid=>(other.wars??[]).includes(wid));
        const trust=tieTrust(v,other.id);
        const kin=raceOf(v)===raceOf(other)&&trust>=18;
        const craft=(raceOf(v)==='dwarf'&&raceOf(other)==='human'||raceOf(v)==='human'&&raceOf(other)==='dwarf')&&trust>=12;
        if(!foeId&&trust<32&&!kin&&!craft)continue;
        this.bindAllies(v,other,foeId?'shared spears':kin?'kindred roofs':craft?'iron and grain':'open hands');
        w.tell('ally',{town:v.name,other:other.name,foe:this.villages.get(foeId)?.name??'the long road',home:v.name,there:other.name});
        return true;
      }
    }
    return false;
  }
  bindAllies(a,b,legend) {
    a.allies=[...(a.allies??[]),b.id];b.allies=[...(b.allies??[]),a.id];
    bumpTie(a,b,{trust:16,legend});bumpTie(b,a,{trust:16,legend});
  }
  breakAllies(a,b) {
    a.allies=(a.allies??[]).filter(id=>id!==b.id);b.allies=(b.allies??[]).filter(id=>id!==a.id);
  }
  tradeGood(buyer, seller) {
    const preferred = RACES[buyer.race]?.preferred ?? [];
    return TRADE_GOODS.filter(k => (seller[k] ?? 0) >= 3).sort((a, b) => {
      const score = k => (preferred.includes(k) ? 24 : 0) + ((buyer[k] ?? 0) < 6 ? 16 : 0) + Math.min(40, seller[k] ?? 0) - (buyer[k] ?? 0);
      return score(b) - score(a);
    })[0] ?? null;
  }
  closeDeal(buyer, seller, { blessed = false } = {}) {
    const w = this.world;
    if (!buyer || !seller || buyer.id === seller.id || this.atWar(buyer, seller)) return null;
    const grudge = buyer.ties?.find(t => t.id === seller.id)?.grudge ?? 0;
    if (!blessed && grudge > 40) return null;
    const allied = (buyer.allies ?? []).includes(seller.id);
    const open = Math.max(buyer.market ?? 0, seller.market ?? 0);
    const grain = blessed ? 8 : 6;
    const haul = blessed || allied ? 4 : 3;
    const need = blessed ? grain : allied || open >= 20 ? 16 : 40;
    let good = this.tradeGood(buyer, seller);
    if (!good && blessed) {
      good = (RACES[buyer.race]?.preferred ?? ['wood']).find(k => TRADE_GOODS.includes(k)) ?? 'wood';
      seller[good] = (seller[good] ?? 0) + haul;
    }
    if (!good) return null;
    if (blessed && buyer.food < grain) buyer.food = grain;
    if (blessed && (seller[good] ?? 0) < haul) seller[good] = haul;
    if (buyer.food < need || (seller[good] ?? 0) < haul) return null;
    buyer.food -= grain;
    seller.food = Math.min(999, seller.food + grain);
    seller[good] -= haul;
    buyer[good] = Math.min(999, (buyer[good] ?? 0) + haul);
    buyer.tradeYear = w.year; seller.tradeYear = w.year;
    buyer.lastTrade = { year: w.year, partnerId: seller.id, good, role: 'buy' };
    seller.lastTrade = { year: w.year, partnerId: buyer.id, good, role: 'sell' };
    bumpTie(buyer, seller, { trust: blessed ? 12 : 8, debt: -4, legend: blessed ? 'blessed market' : 'carts on the road' });
    bumpTie(seller, buyer, { trust: blessed ? 12 : 8, legend: blessed ? 'blessed market' : 'carts on the road' });
    const ware = (RESOURCES[good]?.name ?? good).toLowerCase();
    w.tell('trade', { town: buyer.name, other: seller.name, home: buyer.name, there: seller.name, good: ware });
    w.spawnCaravan(seller, buyer, { good, race: seller.race, blessed });
    this.dispatchCart(seller, buyer, good);
    return good;
  }
  tryTrade() {
    const w = this.world;
    for (const v of w.villages) {
      if ((v.tradeYear ?? 0) >= w.year) continue;
      for (const id of v.known ?? []) {
        const other = this.villages.get(id);
        if (!other || (other.tradeYear ?? 0) >= w.year) continue;
        if (this.closeDeal(v, other) || this.closeDeal(other, v)) return true;
      }
    }
    return false;
  }
  forceTrade(v, opts = {}) {
    const w = this.world;
    const known = (v.known ?? []).map(id => this.villages.get(id)).filter(Boolean);
    const pool = known.length ? known : w.villages.filter(o => o.id !== v.id && !this.atWar(v, o));
    pool.sort((a, b) => dist(v, a) - dist(v, b));
    for (const other of pool) {
      if (this.closeDeal(v, other, opts) || this.closeDeal(other, v, opts)) return true;
    }
    return false;
  }
  blessMarket(x, y) {
    this.prepare();
    const w = this.world;
    const v = w.villages.filter(o => dist(o, { x, y }) <= 10).sort((a, b) => dist(a, { x, y }) - dist(b, { x, y }))[0];
    if (!v) return false;
    v.market = clamp((v.market ?? 0) + 55);
    v.cult = clamp((v.cult ?? 0) + 10);
    if (v.food < Math.max(6, (v.population || 0) * 1.2) && v.faith !== 'fear') v.faith = 'patron';
    w.markAct('mercy');
    w.emit('trade', v.x, v.y, { race: v.race, blessed: true }, 1.7);
    if (!(v.known ?? []).length) {
      const near = w.villages.filter(o => o.id !== v.id && !this.atWar(v, o)).sort((a, b) => dist(v, a) - dist(v, b))[0];
      if (near && dist(v, near) < 48) this.discover(v, near);
    }
    if (!this.forceTrade(v, { blessed: true })) w.tell('market', { town: v.name, home: v.name, who: w.units.find(u => u.id === v.leaderId)?.name });
    return true;
  }
  dispatchCart(from, to, good) {
    const walker = this.world.units.find(u => u.kind === 'human' && u.villageId === from.id && u.age >= 18 && u.hp > 35 && !['flee', 'defend', 'hunt', 'siege', 'steal', 'cart'].includes(u.action));
    if (!walker) return false;
    const p = this.accessibleVillage(walker, to) ?? { x: to.x, y: to.y };
    return this.setTask(walker, this.taskTarget('cart', p.x, p.y, 'trade', { targetId: to.id, good, leg: 'out' }));
  }
  tryRelief() {
    const w=this.world;
    for(const v of w.villages) {
      if(v.population<2||v.food>=Math.max(6,v.population*1.4))continue;
      if((v.reliefYear??0)>=w.year)continue;
      for(const id of v.known??[]) {
        const other=this.villages.get(id);
        if(!other||this.atWar(v,other)||other.food<other.population*4+10)continue;
        const close=(v.allies??[]).includes(other.id)||raceOf(v)===raceOf(other)||tieTrust(other,v.id)>=10;
        if(!close)continue;
        const send=Math.min(10,other.food-8);
        if(send<4)continue;
        other.food-=send;v.food+=send;v.reliefYear=w.year;other.reliefYear=w.year;
        bumpTie(v,other,{trust:10,debt:6,legend:'grain in a hard year'});bumpTie(other,v,{trust:14,legend:'grain in a hard year'});
        w.tell('relief',{town:other.name,other:v.name,home:other.name,there:v.name});
        w.emit('gift',v.x,v.y,{race:v.race},1.3);
        return true;
      }
    }
    return false;
  }
  tryFestival() {
    const w=this.world;
    for(const v of w.villages) {
      if(v.festivalYear&&v.festivalYear+6>w.year||v.food<16||(v.wars??[]).length)continue;
      for(const id of v.allies??[]) {
        const other=this.villages.get(id);
        if(!other||other.food<16||(other.wars??[]).length||(other.festivalYear&&other.festivalYear+6>w.year))continue;
        v.festivalYear=w.year;other.festivalYear=w.year;
        bumpTie(v,other,{trust:12,legend:'shared feast'});bumpTie(other,v,{trust:12,legend:'shared feast'});
        w.tell('festival',{town:v.name,other:other.name,home:v.name,there:other.name});
        w.emit('festival',(v.x+other.x)/2,(v.y+other.y)/2,{race:v.race},2.2);
        for(const u of w.units) {
          if(u.kind!=='human'||(u.villageId!==v.id&&u.villageId!==other.id)||['flee','defend','hunt','siege'].includes(u.action))continue;
          const hall=u.villageId===v.id?v:other;
          u.task=this.taskTarget('dance',hall.x,hall.y,'festival');u.action='dance';u.reason='festival';
          u.path=[];u.pathRevision=-1;u.progress=0;u.decision=2.4;this.remember(u,'festival',hall.id);
        }
        return true;
      }
    }
    return false;
  }
  tryMarriage() {
    const w=this.world;
    for(const v of w.villages) {
      if(v.marriageYear&&v.marriageYear+8>w.year||(v.wars??[]).length)continue;
      for(const id of v.known??[]) {
        const other=this.villages.get(id);
        if(!other||this.atWar(v,other)||(other.marriageYear&&other.marriageYear+8>w.year))continue;
        const trust=tieTrust(v,other.id),allied=(v.allies??[]).includes(other.id);
        if(trust<36&&!(allied&&trust>=12))continue;
        v.marriageYear=w.year;other.marriageYear=w.year;
        if(!allied)this.bindAllies(v,other,'joined houses');
        else {bumpTie(v,other,{trust:18,legend:'joined houses'});bumpTie(other,v,{trust:18,legend:'joined houses'});}
        w.tell('marriage',{town:v.name,other:other.name,home:v.name,there:other.name,leader:w.units.find(u=>u.id===v.leaderId)?.name});
        w.emit('family',(v.x+other.x)/2,(v.y+other.y)/2,{race:v.race},1.6);
        return true;
      }
    }
    return false;
  }
  tryTribute() {
    const w=this.world;
    for(const v of w.villages) {
      if((v.tributeYear??0)>=w.year||v.food<12||v.population<2)continue;
      for(const id of v.known??[]) {
        const other=this.villages.get(id);
        if(!other||this.atWar(v,other)||(v.allies??[]).includes(other.id))continue;
        if(other.population<v.population*1.7+3)continue;
        const heat=this.heatOf(v,other.id)+this.heatOf(other,v.id);
        if(heat<8&&tieTrust(v,other.id)<8)continue;
        const send=Math.min(8,v.food-4);
        v.food-=send;other.food+=send;v.tributeYear=w.year;
        bumpTie(v,other,{debt:10,grudge:-6,legend:'tribute'});bumpTie(other,v,{trust:8,legend:'tribute'});
        w.tell('tribute',{town:v.name,other:other.name,home:v.name,there:other.name});
        w.emit('deliver',other.x,other.y,{amount:send,race:v.race},1.1);
        return true;
      }
    }
    return false;
  }
  tryBetrayal() {
    const w=this.world;
    for(const v of w.villages) {
      for(const id of v.allies??[]) {
        const other=this.villages.get(id);
        if(!other)continue;
        const grudge=v.ties?.find(t=>t.id===other.id)?.grudge??0;
        if(grudge<32&&this.heatOf(v,other.id)<28)continue;
        this.breakAllies(v,other);
        const take=Math.min(8,other.food);
        other.food-=take;v.food+=take;
        this.heatUp(v,other,18);this.heatUp(other,v,22);
        bumpTie(v,other,{legend:'broken oath'});bumpTie(other,v,{legend:'broken oath'});
        w.tell('betrayal',{town:v.name,other:other.name,home:v.name,there:other.name});
        w.emit('steal',other.x,other.y,{race:v.race},1.4);
        return true;
      }
    }
    return false;
  }
  discover(from,to,u) {
    if(!from||!to||from.id===to.id)return false;
    from.known??=[];
    if(from.known.includes(to.id))return false;
    from.known.push(to.id);
    if(u)this.remember(u,'scout',to.id);
    this.world.tell('scout',{who:u?.name??'A scout',home:from.name,there:to.name,town:from.name});
    this.world.emit('scout',u?.x??to.x,u?.y??to.y,{race:u?.race??from.race},1.25);
    return true;
  }
  noticeNeighbors(u) {
    const v=this.villages.get(u.villageId);
    if(!v||u.age<18)return;
    const w=this.world;
    for(const other of w.villages) {
      if(other.id===v.id)continue;
      if(dist(u,other)<=w.claimRadius(other)+5)this.discover(v,other,u);
    }
  }
  clearTask(u,reason=null) { u.task=null;u.path=[];u.action='idle';u.progress=0;u.tx=u.x;u.ty=u.y;u.decision=.3+this.world.rng.next()*.7;if(reason)u.reason=reason; }
  taskTarget(type,x,y,reason,extra={}) { return {type,x:Math.floor(x)+.5,y:Math.floor(y)+.5,reason,...extra}; }
  approach(u,b) {
    const candidates=[];
    for(const [dx,dy]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1]]){const p={x:b.x+dx+.5,y:b.y+dy+.5};if(this.navigation.passable(p.x,p.y)&&this.navigation.sameRegion(u,p))candidates.push(p);}
    return candidates.sort((a,b)=>dist(u,a)-dist(u,b))[0]??null;
  }
  openPen(villageId,beast) {
    let best=null,bestLoad=99;
    for(const pen of this.world.buildings.filter(b=>b.villageId===villageId&&b.type==='pen'&&ready(b))) {
      const load=this.world.units.filter(a=>a.penId===pen.id).reduce((n,a)=>n+livestockSlots(a),0);
      if(load+(beast.penId===pen.id?0:livestockSlots(beast))>PEN_SLOTS)continue;
      if(!best||load<bestLoad||(load===bestLoad&&dist(beast,pen)<dist(beast,best))){best=pen;bestLoad=load;}
    }
    return best;
  }
  accessibleVillage(u,v) {
    const hall=this.world.buildings.find(b=>b.villageId===v.id&&b.type==='hall'&&ready(b));
    return hall?this.approach(u,hall):null;
  }
  depositTasks(u) {
    const tasks=[];
    for(const d of this.world.deposits){
      if(d.amount<1||dist(u,d)>30||this.world.fire[this.world.index(d.x,d.y)]>0)continue;
      const type=RESOURCES[d.kind].action,owner=this.claims.get(`${type}:${d.id}`);if(owner&&owner!==u.id)continue;
      const p=this.approach(u,d);if(p)tasks.push(this.taskTarget(type,p.x,p.y,d.kind,{targetId:d.id,depositKind:d.kind}));
    }
    return tasks.sort((a,b)=>dist(u,a)-dist(u,b));
  }
  noticeGift(d) {
    const w=this.world,spot={x:d.x+.5,y:d.y+.5};
    this.navigation.refresh();
    const witnesses=[];
    for(const u of w.units) {
      if(u.kind!=='human'||u.hp<=0)continue;
      if(['flee','defend','hunt','steal','siege'].includes(u.action))continue;
      const preferred=(RACES[u.race]?.preferred??[]).includes(d.kind)||d.kind==='fish';
      if(dist(u,spot)>(preferred?24:14))continue;
      if(!this.approach(u,d))continue;
      witnesses.push({u,preferred,distance:dist(u,spot)});
    }
    witnesses.sort((a,b)=>(b.preferred?1:0)-(a.preferred?1:0)||a.distance-b.distance);
    for(const {u} of witnesses.slice(0,10)) {
      u.task=this.taskTarget('cheer',u.x,u.y,'bounty',{targetId:d.id,depositKind:d.kind});
      u.action='cheer';u.reason='bounty';u.path=[];u.pathRevision=w.navRevision;u.progress=0;u.stuck=0;
      u.decision=2;u.tx=spot.x;u.ty=spot.y;
      this.remember(u,'gift',d.id);
    }
    if(witnesses.length)w.emit('cheer',spot.x,spot.y,{resource:d.kind,race:witnesses[0].u.race},1.2);
  }
  claimBounty(u,d) {
    const type=RESOURCES[d.kind].action,p=this.approach(u,d);
    if(u.age>=18&&cargoCount(u)<6&&p&&d.amount>=1) {
      const owner=this.claims.get(`${type}:${d.id}`);
      if((!owner||owner===u.id)&&this.setTask(u,this.taskTarget(type,p.x,p.y,d.kind,{targetId:d.id,depositKind:d.kind})))return;
      if(this.setTask(u,this.taskTarget('wander',p.x,p.y,'bounty')))return;
    }
    this.clearTask(u);
  }
  setTask(u,task) {
    const path=this.navigation.findPath(u,task,{allowFire:task.type==='flee'});
    if(path===undefined){u.decision=.2;return false;}
    if(path===null)return false;
    u.task=task;u.action=task.type;u.reason=task.reason;u.path=path;u.pathRevision=this.world.navRevision;u.progress=0;u.stuck=0;
    if(['chop','forage','farm','herd',...GATHER_ACTIONS].includes(task.type))this.claims.set(`${task.type}:${task.resource??task.targetId}`,u.id);
    u.decision=1+this.world.rng.next(); return true;
  }
  resources(u,kind) {
    const w=this.world, candidates=[],sites=kind==='chop'?this.woodSites:this.foodSites;
    for(const i of sites) {
      if((kind==='chop'?w.wood[i]:w.berries[i])<=0||w.fire[i]>0)continue;
      const owner=this.claims.get(`${kind}:${i}`);if(owner&&owner!==u.id)continue;
      const p={x:i%w.width+.5,y:Math.floor(i/w.width)+.5};const distance=dist(u,p);
      if(distance<=32&&this.navigation.sameRegion(u,p))candidates.push({...p,resource:i,distance});
    }
    return candidates.sort((a,b)=>a.distance-b.distance).slice(0,5).map(p=>this.taskTarget(kind,p.x,p.y,kind==='chop'?'wood':'food',{resource:p.resource}));
  }
  choose(u,danger=null) {
    const w=this.world,v=this.villages.get(u.villageId), candidates=[];
    const add=(score,task)=>{if(task)candidates.push({score,task});};
    if(danger) {
      const fight=danger.kind!=='fire'&&u.age>=18&&u.hp>45&&(u.job==='guard'||has(u,'brave'));
      if(fight&&danger.id&&this.navigation.passable(danger.x,danger.y)&&this.setTask(u,this.taskTarget('defend',danger.x,danger.y,danger.kind==='human'?'claim':'protect',{targetId:danger.id})))return;
      const escapes=[];
      for(let i=0;i<20;i++) {
        const a=i/20*Math.PI*2,r=5+(i%3)*2,p={x:u.x+Math.cos(a)*r,y:u.y+Math.sin(a)*r};
        if(this.navigation.passable(p.x,p.y)&&!w.fire[w.index(p.x,p.y)]&&this.navigation.sameRegion(u,p))escapes.push({...p,score:dist(p,danger)});
      }
      for(const p of escapes.sort((a,b)=>b.score-a.score).slice(0,4))if(this.setTask(u,this.taskTarget('flee',p.x,p.y,'danger')))return;
      this.clearTask(u,'blocked');return;
    }
    if(u.hunger>65&&cargoCount(u)>=6&&!u.inventory.food){const k=STOCKS.find(k=>k!=='food'&&u.inventory[k]>0);if(k)u.inventory[k]=Math.max(0,u.inventory[k]-3);}
    const store=v?this.accessibleVillage(u,v):null;
    const cargo=cargoCount(u);
    if(u.hunger>48) {
      if(u.inventory.food>0)add(300,this.taskTarget('eat',u.x,u.y,'hungry',{personal:true}));
      if(store&&v.food>=1)add((u.race==='ghoul'?120:180)+u.hunger,this.taskTarget('eat',store.x,store.y,'hungry'));
      else if(u.race!=='ghoul')for(const task of this.resources(u,'forage'))add(155+u.hunger, {...task,reason:'hungry'});
    }
    if(u.race==='ghoul'&&u.age>=18&&u.hunger>40) {
      const prey=this.nearby(u,16).filter(a=>(isLivestock(a)||(a.kind==='human'&&raceOf(a)!=='ghoul'&&a.age>=18))&&this.navigation.sameRegion(u,a));
      prey.sort((a,b)=>(isLivestock(a)?0:1)-(isLivestock(b)?0:1)||dist(u,a)-dist(u,b));
      for(const p of prey.slice(0,3))add((isLivestock(p)?150:125)+u.hunger,this.taskTarget('hunt',p.x,p.y,'hungry',{targetId:p.id}));
    }
    if(u.age>=18&&cargo<6&&(u.race==='ghoul'||has(u,'curious')||(v&&v.food<8)||(v?.wars??[]).length)) {
      for(const other of w.villages) {
        if(other.id===u.villageId||raceOf(other)===raceOf(u)||other.food<4)continue;
        if((v?.allies??[]).includes(other.id)||tieTrust(v,other.id)>=28)continue;
        const p=this.accessibleVillage(u,other);if(p&&dist(u,other)<32)add((this.atWar(v,other)?(u.job==='guard'?48:72):0)+(u.race==='ghoul'?125:46),this.taskTarget('steal',p.x,p.y,'raid',{targetId:other.id}));
      }
    }
    if(u.energy<28||(u.hp<65&&u.hunger<50)) {
      const home=this.buildings.get(u.homeId),p=home?this.approach(u,home):{x:u.x,y:u.y};
      if(p)add(130+(100-u.energy),this.taskTarget('rest',p.x,p.y,u.energy<28?'tired':'recovery',{targetId:home?.id??null}));
    }
    const wx=w.weatherAt(u.x,u.y);
    if(wx&&(['storm','blizzard'].includes(wx.kind)||wx.kind==='rain'&&u.race==='dwarf')) {
      const home=this.buildings.get(u.homeId),p=home?this.approach(u,home):store??{x:u.x,y:u.y};
      if(p)add(248+(u.age<18?20:0)+(u.race==='dwarf'?18:0),this.taskTarget('shelter',p.x,p.y,'weather',{targetId:home?.id??null}));
    }
    if(wx?.kind==='aurora')add(155+(u.race==='alien'?48:0),this.taskTarget('marvel',u.x+(w.rng.next()-.5),u.y+(w.rng.next()-.5),'marvel'));
    if(wx&&['rain','bloom'].includes(wx.kind)&&v)add(82+(wx.kind==='bloom'?24:0)+(u.age<18?12:0)-(wx.kind==='rain'&&u.race==='dwarf'?70:0),this.taskTarget('dance',v.x,v.y,'weather'));
    if(wx?.kind==='drought'&&(store||v))add(74,this.taskTarget('marvel',(store??v).x,(store??v).y,'weather'));
    if(cargo>0&&store)add(cargo>=6?170:125,this.taskTarget('deliver',store.x,store.y,'cargo'));
    if(u.social>40||u.age<18) {
      const friends=this.nearby(u,18).filter(a=>a.kind==='human'&&a.villageId===u.villageId&&this.navigation.sameRegion(u,a));
      friends.sort((a,b)=>(b.id===u.partnerId?100:0)-(a.id===u.partnerId?100:0)||dist(u,a)-dist(u,b));
      for(const friend of friends.slice(0,2))add(35+u.social*.65+(has(u,'social')?12:0),this.taskTarget('socialize',friend.x,friend.y,u.age<18?'child':'lonely',{targetId:friend.id}));
    }
    if(u.age>=18) {
      const foodLow=!v||v.food<Math.max(18,v.population*3),woodLow=v&&v.wood<28;
      if(cargo<6)for(const task of this.depositTasks(u)) {
        const resource=RESOURCES[task.depositKind],needed=v?.planMaterial===task.depositKind&&(v[task.depositKind]??0)<24;
        const food=task.depositKind==='fish',specialist=u.job===resource.job;
        const gift=u.memories.some(m=>m.type==='gift'&&m.otherId===task.targetId);
        if(food||gift||(v&&(needed||specialist)))add((food?(foodLow?99:38):(needed?98:40))+(specialist?12:0)+(gift?50:0),task);
      }
      if(cargo<6) {
        if(foodLow||u.job==='forager')for(const task of this.resources(u,'forage'))add(foodLow?76:42,task);
        if(v&&(woodLow||u.job==='woodcutter'))for(const task of this.resources(u,'chop'))add(woodLow?72+(u.job==='woodcutter'?8:0):40,task);
      }
      if(v)for(const b of w.buildings.filter(b=>b.villageId===v.id)) {
        const p=this.approach(u,b);if(!p)continue;
        if(b.type==='farm'&&ready(b)&&b.crop>=2&&cargo<6) {
          const owner=this.claims.get(`farm:${b.id}`);if(owner&&owner!==u.id)continue;
          add((foodLow?95:50)+(u.job==='farmer'?15:0)+((wx?.kind==='rain'||wx?.kind==='bloom')?42:0),this.taskTarget('farm',p.x,p.y,'food',{targetId:b.id}));
        }
        if(!ready(b))add((u.job==='builder'?92:50),this.taskTarget('build',p.x,p.y,b.type==='farm'?'farming':b.type==='pen'?'herd':'housing',{targetId:b.id}));
      }
      if(v&&u.race!=='ghoul')for(const beast of this.nearby(u,22).filter(a=>isLivestock(a)&&this.navigation.sameRegion(u,a))) {
        if(beast.penId||(beast.villageId!=null&&beast.villageId!==v.id))continue;
        const owner=this.claims.get(`herd:${beast.id}`);if(owner&&owner!==u.id)continue;
        const p=this.approach(u,beast)??{x:beast.x,y:beast.y};
        add((foodLow?72:52)+(u.job==='herder'?22:0)+(beast.kind==='cow'?6:0),this.taskTarget('herd',p.x,p.y,'herd',{targetId:beast.id}));
      }
      if(u.job==='guard'&&v&&store){
        const unknown=w.villages.filter(o=>o.id!==v.id&&!(v.known??[]).includes(o.id)&&dist(v,o)<48)
          .sort((a,b)=>dist(v,a)-dist(v,b));
        for(const other of unknown){
          const span=dist(v,other)||1,stop=Math.max(2,span-w.claimRadius(other)*.55);
          const raw={x:v.x+(other.x-v.x)/span*stop,y:v.y+(other.y-v.y)/span*stop};
          const p=w.walkable(raw.x,raw.y)&&this.navigation.passable(raw.x,raw.y)?raw:w.findLand(raw.x,raw.y,8);
          if(p&&this.navigation.sameRegion(u,p)){add(58,this.taskTarget('scout',p.x,p.y,'scout',{targetId:other.id}));break;}
        }
        const R=w.claimRadius(v),a=w.rng.next()*Math.PI*2;
        const edge={x:v.x+Math.cos(a)*R*.85,y:v.y+Math.sin(a)*R*.85};
        const p=w.walkable(edge.x,edge.y)?edge:{x:store.x+(w.rng.next()-.5)*8,y:store.y+(w.rng.next()-.5)*8};
        add(36,this.taskTarget('patrol',p.x,p.y,'duty'));
      }
      if(v&&(v.wars??[]).length&&u.hp>42&&u.hunger<78&&(u.job==='guard'||has(u,'brave')||u.race==='ghoul')) {
        for(const id of v.wars) {
          const enemy=this.villages.get(id);if(!enemy)continue;
          const marks=w.buildings.filter(b=>b.villageId===enemy.id).sort((a,b)=>(a.type==='hall'?1:0)-(b.type==='hall'?1:0)||dist(u,a)-dist(u,b));
          for(const b of marks.slice(0,4)) {
            const p=this.approach(u,b);if(p){add(86+(u.job==='guard'?14:0),this.taskTarget('siege',p.x,p.y,'war',{targetId:b.id}));break;}
          }
        }
      }
    }
    if(v&&u.job!=='guard'&&((v.wars??[]).length||!store)&&(u.age<18||has(u,'careful')||u.hp<50||!store)) {
      const press=w.units.some(a=>a.kind==='human'&&a.hp>0&&(v.wars??[]).includes(a.villageId)&&(a.action==='siege'||a.action==='steal')&&dist(a,v)<w.claimRadius(v)+8);
      if(press||!store) for(const other of w.villages) {
        if(other.id===v.id||raceOf(other)!==raceOf(u)||(other.wars??[]).includes(v.id))continue;
        const p=this.accessibleVillage(u,other);if(p)add(press?158:118,this.taskTarget('migrate',p.x,p.y,'refuge',{targetId:other.id}));
      }
    }
    if(v&&!store) {
      for(const other of w.villages.filter(a=>a.id!==v.id&&raceOf(a)===raceOf(u))) { const p=this.accessibleVillage(u,other);if(p)add(110,this.taskTarget('migrate',p.x,p.y,'stranded',{targetId:other.id})); }
    }
    for(let i=0;i<3;i++) {
      const center=u.age<18&&v?store??u:u,r=has(u,'curious')?14:7;
      const x=center.x+(w.rng.next()-.5)*r,y=center.y+(w.rng.next()-.5)*r;
      if(this.navigation.passable(x,y))add(5,this.taskTarget('wander',x,y,u.age<18?'child':'explore'));
    }
    candidates.sort((a,b)=>b.score-a.score||dist(u,a.task)-dist(u,b.task));
    for(const {task}of candidates.slice(0,12))if(this.setTask(u,task))return;
    this.clearTask(u,'blocked');u.decision=2;
  }
  valid(u) {
    const t=u.task,w=this.world;if(!t)return false;
    if(t.type==='cheer'||GATHER_ACTIONS.includes(t.type)){const d=w.deposits.find(d=>d.id===t.targetId);return !!d&&d.kind===t.depositKind&&d.amount>=1;}
    if(t.type==='chop')return w.tiles[t.resource]===4&&w.wood[t.resource]>0;
    if(t.type==='forage')return w.berries[t.resource]>0;
    if(t.type==='build')return this.buildings.has(t.targetId)&&!ready(this.buildings.get(t.targetId));
    if(t.type==='farm')return this.buildings.has(t.targetId)&&ready(this.buildings.get(t.targetId))&&this.buildings.get(t.targetId).crop>=1;
    if(['socialize','defend','hunt','herd'].includes(t.type))return (this.byId.get(t.targetId)?.hp??0)>0;
    if(t.type==='steal')return (this.villages.get(t.targetId)?.food??0)>=1;
    if(t.type==='siege')return this.buildings.has(t.targetId);
    if(t.type==='scout')return t.targetId==null||this.villages.has(t.targetId);
    if(t.type==='cart')return this.villages.has(t.targetId);
    if(t.type==='rest'&&t.targetId!=null)return this.buildings.has(t.targetId);
    if(t.type==='shelter'&&t.targetId!=null)return this.buildings.has(t.targetId);
    if(t.type==='eat'&&!t.personal)return (this.villages.get(u.villageId)?.food??0)>=1;
    return true;
  }
  move(u,dt) {
    const w=this.world,t=u.task;
    if(!t)return false;
    if(u.pathRevision!==w.navRevision||(!u.path.length&&dist(u,t)>1)) {
      const path=this.navigation.findPath(u,t,{allowFire:t.type==='flee'});
      if(path===undefined)return true;
      if(path===null){this.clearTask(u,'blocked');return true;}
      u.path=path;u.pathRevision=w.navRevision;
    }
    if(!u.path.length){u.tx=u.x;u.ty=u.y;return false;}
    const next=u.path[0],x=next%w.width+.5,y=Math.floor(next/w.width)+.5;
    if(!this.navigation.passable(x,y)||(t.type!=='flee'&&w.fire[next]>0)){u.path=[];u.pathRevision=-1;u.stuck+=dt;if(u.stuck>2)this.clearTask(u,'blocked');return true;}
    const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy),speed=(t.type==='flee'?3.8:t.type==='cart'?1.55:2.2)*(u.age<18?.8:1)*(u.energy<15?.7:1)*(u.race==='dwarf'?.88:1);
    const step=Math.min(d,dt*speed);
    u.tx=x;u.ty=y;
    if(d>0){const nx=u.x+dx/d*step,ny=u.y+dy/d*step;if(w.walkable(nx,ny)){u.x=nx;u.y=ny;}else{u.path=[];u.pathRevision=-1;return true;}}
    if(d<=step+.001)u.path.shift();
    u.energy=clamp(u.energy-dt*.16);return true;
  }
  tick(u,dt) {
    const w=this.world;
    const forest=w.tiles[w.index(u.x,u.y)]===4;
    const hungerRate=u.race==='ghoul'?.9:u.race==='alien'?.42:u.race==='dwarf'?.58:u.race==='mycelite'?(forest?.28:.52):.72;
    u.age+=dt/6;u.hunger=clamp(u.hunger+dt*(u.age<18?.55:hungerRate));u.social=clamp(u.social+dt*(has(u,'social')?.95:.65));u.energy=clamp(u.energy-dt*.12);
    const wx=w.weatherAt(u.x,u.y);
    if(wx) {
      if(wx.kind==='blizzard'){u.energy=clamp(u.energy-dt*(u.race==='dwarf'?.08:.22));u.hunger=clamp(u.hunger+dt*(u.race==='dwarf'?.06:.18));}
      if(wx.kind==='storm'&&u.action!=='shelter'&&u.action!=='rest')u.energy=clamp(u.energy-dt*(u.race==='dwarf'?.08:.16));
      if(wx.kind==='aurora')u.social=clamp(u.social+dt*.55);
      if(wx.kind==='bloom')u.energy=clamp(u.energy+dt*.18);
      if(wx.kind==='rain'&&['farm','forage','dance'].includes(u.action))u.energy=clamp(u.energy+dt*.12);
      if(wx.kind==='drought')u.hunger=clamp(u.hunger+dt*.12);
    }
    u.familyCooldown=Math.max(0,u.familyCooldown-dt);u.decision-=dt;u.dangerTimer-=dt;
    if(u.hunger>92)u.hp-=dt*(has(u,'hardy')?1.4:2.3);
    if(u.age>u.lifetime)u.hp-=dt*2;
    if(w.fire[w.index(u.x,u.y)]>0)u.hp-=dt*(has(u,'hardy')?42:58);
    if(u.partnerId&&!this.byId.has(u.partnerId)){this.remember(u,'loss',u.partnerId);u.partnerId=null;u.social=clamp(u.social+25);}
    this.noticeNeighbors(u);
    let danger=null;
    if(u.dangerTimer<=0){danger=this.danger(u);u.dangerTimer=.35;}
    if(danger&&u.action!=='flee'&&u.action!=='defend'){this.clearTask(u);this.choose(u,danger);}
    if(u.task&&!this.valid(u))this.clearTask(u);
    if(u.decision<=0) {
      const urgent=(u.hunger>72&&!['eat','forage','fish','deliver','flee','defend','hunt','steal','siege','cheer','herd','shelter','cart'].includes(u.action))||(u.energy<12&&!['rest','flee','defend','hunt','siege','cheer','herd','shelter','cart'].includes(u.action));
      if(!u.task||urgent)this.choose(u,danger);
      else u.decision=1;
    }
    if(!u.task)return;
    // Dynamic targets are refreshed without abandoning their current objective.
    if(u.action==='cheer'){this.work(u,dt);return;}
    if(['dance','marvel','shelter'].includes(u.action)) {
      if(dist(u,u.task)>1.35&&this.move(u,dt))return;
      this.work(u,dt);return;
    }
    if(['socialize','defend','hunt'].includes(u.action)) {
      const target=this.byId.get(u.task.targetId);
      if(target&&dist(target,u.task)>2){u.task.x=Math.floor(target.x)+.5;u.task.y=Math.floor(target.y)+.5;u.pathRevision=-1;}
      if(target&&dist(u,target)<1.6)u.path=[];
    }
    if(u.action==='herd') {
      const beast=this.byId.get(u.task.targetId);
      if(beast?.villageId===u.villageId) {
        const pen=this.openPen(u.villageId,beast);
        if(pen){
          const nx=pen.x+.5,ny=pen.y+.5;
          if(u.task.x!==nx||u.task.y!==ny){u.task.x=nx;u.task.y=ny;u.pathRevision=-1;}
        }
      } else if(beast&&dist(beast,u.task)>2){u.task.x=Math.floor(beast.x)+.5;u.task.y=Math.floor(beast.y)+.5;u.pathRevision=-1;}
    }
    const closeTarget=['socialize','defend','hunt'].includes(u.action)&&dist(u,this.byId.get(u.task.targetId)??u)>1.6;
    const beast=u.action==='herd'?this.byId.get(u.task.targetId):null;
    const chaseBeast=!!beast&&!beast.villageId&&dist(u,beast)>1.7;
    const walkPen=!!beast&&beast.villageId===u.villageId&&dist(u,u.task)>1.5;
    if((!['socialize','defend','hunt','herd'].includes(u.action)||closeTarget||chaseBeast||walkPen)&&this.move(u,dt))return;
    this.work(u,dt);
  }
  work(u,dt) {
    const w=this.world,t=u.task,v=this.villages.get(u.villageId);if(!t)return;
    const gain=(skill,amount=.12)=>{u.skills[skill]=Math.min(10,u.skills[skill]+amount);};
    const affinity=u.race==='alien'&&t.type==='mine'||u.race==='dwarf'&&t.type==='mine'||u.race==='mycelite'&&t.type==='cultivate'||u.race==='ghoul'&&(t.type==='chop'||t.type==='hunt');
    const rate=1+(has(u,'diligent')?.25:0)+(affinity?.45:0)+(u.skills[t.type]??0)*.12;
    u.progress+=dt*rate;
    if(['chop','forage','farm','build','defend','hunt','steal','siege','herd',...GATHER_ACTIONS].includes(t.type))u.energy=clamp(u.energy-dt*.35);
    if(t.type==='cheer') {
      const d=w.deposits.find(x=>x.id===t.targetId);if(!d){this.clearTask(u);return;}
      u.tx=d.x+.5;u.ty=d.y+.5;
      if(u.progress<1.05+dist(u,{x:d.x+.5,y:d.y+.5})*.05)return;
      this.claimBounty(u,d);return;
    }
    if(GATHER_ACTIONS.includes(t.type)){
      const d=w.deposits.find(d=>d.id===t.targetId);if(!d||dist(u,{x:d.x+.5,y:d.y+.5})>2.2){this.clearTask(u,'blocked');return;}
      const resource=RESOURCES[d.kind];if(u.progress<resource.work)return;
      const amount=Math.min(3,Math.floor(d.amount),6-cargoCount(u));
      d.amount-=amount;u.inventory[resource.stock]+=amount;u.harvested+=amount;gain(t.type);w.depositRevision++;
      if(u.race==='alien'&&d.kind==='crystal')u.hunger=clamp(u.hunger-14);
      if(u.race==='mycelite'&&d.kind==='mycelium')w.spreadSpores(d.x+.5,d.y+.5);
      w.emit('gather',d.x+.5,d.y+.5,{resource:d.kind,amount,race:u.race});this.clearTask(u);return;
    }
    if(t.type==='eat') {
      if(u.progress<1)return;
      const supply=t.personal?u.inventory:v;
      if(supply?.food>=1){supply.food--;u.hunger=clamp(u.hunger-(u.race==='ghoul'?18:42));u.hp=clamp(u.hp+3);}
      this.clearTask(u);return;
    }
    if(t.type==='rest') {u.energy=clamp(u.energy+dt*(u.homeId?10:5));if(u.hunger<70)u.hp=clamp(u.hp+dt*1.3);if(u.energy>95||u.hunger>75)this.clearTask(u);return;}
    if(t.type==='shelter') {
      u.energy=clamp(u.energy+dt*(u.race==='dwarf'?11:8));u.social=clamp(u.social-dt*(u.race==='dwarf'?8:4));
      if(u.race==='dwarf')u.hunger=clamp(u.hunger-dt*5);
      const sky=w.weatherAt(u.x,u.y);
      const hiding=sky&&(sky.kind==='storm'||sky.kind==='blizzard'||sky.kind==='rain'&&u.race==='dwarf');
      if(!hiding||u.energy>92){this.remember(u,'weather');this.clearTask(u);}
      return;
    }
    if(t.type==='dance'||t.type==='marvel') {
      u.tx=t.x;u.ty=t.y;u.social=clamp(u.social-dt*12);u.energy=clamp(u.energy+dt*.25);
      if(t.type==='marvel'&&u.race==='alien')u.energy=clamp(u.energy+dt*.2);
      if(u.progress>2.2){this.remember(u,t.type==='marvel'?'marvel':'weather');this.clearTask(u);}
      return;
    }
    if(t.type==='deliver') {
      if(u.progress<.65)return;
      if(v){const amount=cargoCount(u);for(const k of STOCKS){v[k]=Math.min(999,(v[k]??0)+u.inventory[k]);u.inventory[k]=0;}u.delivered+=amount;w.emit('deliver',u.x,u.y,{amount,race:u.race});}
      this.clearTask(u);return;
    }
    if(t.type==='cart') {
      const dest=this.villages.get(t.targetId);
      if(!dest||dist(u,dest)>2.4)return;
      this.remember(u,'trade',dest.id);
      w.emit('trade',u.x,u.y,{good:t.good,race:u.race},1.05);
      if(t.leg==='home'||t.targetId===u.villageId){this.clearTask(u);return;}
      const home=this.villages.get(u.villageId),p=home&&this.accessibleVillage(u,home);
      if(p)this.setTask(u,this.taskTarget('cart',p.x,p.y,'trade',{targetId:home.id,good:t.good,leg:'home'}));
      else this.clearTask(u);
      return;
    }
    if(t.type==='chop'&&u.progress>=2.8) {
      const amount=Math.min(2,w.wood[t.resource],6-cargoCount(u));
      w.wood[t.resource]-=amount;u.inventory.wood+=amount;u.harvested+=amount;gain('chop');w.resourceRevision++;
      w.emit(w.wood[t.resource]?'gather':'fell',t.resource%w.width+.5,Math.floor(t.resource/w.width)+.5,{resource:'wood',race:u.race});
      if(!w.wood[t.resource]){w.tiles[t.resource]=3;w.revision++;}
      this.remember(u,'wood');this.clearTask(u);return;
    }
    if(t.type==='forage'&&u.progress>=1.8) {
      const amount=Math.min(3,w.berries[t.resource],6-cargoCount(u));
      w.berries[t.resource]-=amount;u.inventory.food+=amount;u.harvested+=amount;gain('forage');w.resourceRevision++;
      w.emit('gather',u.x,u.y,{resource:'food',amount});
      this.clearTask(u);return;
    }
    if(t.type==='farm'&&u.progress>=2.5) {
      const b=this.buildings.get(t.targetId),amount=Math.min(Math.floor(b?.crop??0),4,6-cargoCount(u));
      if(b)b.crop-=amount;u.inventory.food+=amount;u.harvested+=amount;gain('farm');this.clearTask(u);return;
    }
    // Gathering must finish its work timer before the generic idle timeout.
    if(['chop','forage','farm'].includes(t.type))return;
    if(t.type==='build') {
      const b=this.buildings.get(t.targetId);if(!b){this.clearTask(u);return;}
      b.progress=Math.min(1,b.progress+dt*rate/14);gain('build',dt*.025);
      if(b.progress>=1){b.complete=true;b.crop=b.type==='farm'?4:0;u.structures++;w.navRevision++;w.emit('complete',b.x,b.y,{race:b.race},1.4);w.tell(b.type==='pen'?'fold':'build',{who:u.name,town:v?.name??'the town'});this.remember(u,'build');this.clearTask(u);}
      return;
    }
    if(t.type==='socialize') {
      const other=this.byId.get(t.targetId);if(!other||dist(u,other)>2){this.clearTask(u);return;}
      u.social=clamp(u.social-dt*15);other.social=clamp(other.social-dt*9);
      if(u.age<18&&other.age>=18){const skill=SKILL_FOR_JOB[other.job]??'forage';u.skills[skill]=Math.min(3,u.skills[skill]+dt*.04);}
      if(u.progress>=2.5){this.bond(u,other,18);this.bond(other,u,18);this.remember(u,'friend',other.id);this.clearTask(u);}return;
    }
    if(t.type==='defend') {
      const enemy=this.byId.get(t.targetId);
      if(enemy&&dist(u,enemy)<1.7&&u.progress>=.9){
        enemy.hp-=13+u.skills.combat*2+(has(u,'brave')?4:0);gain('combat',.18);u.progress=0;w.emit('hit',enemy.x,enemy.y,{race:u.race});
        if(enemy.hp<=0){
          const label=enemy.kind==='wolf'?'a wolf':`a ${(RACES[enemy.race]?.singular??'stranger').toLowerCase()}`;
          this.remember(u,enemy.kind==='wolf'?'defend':'clash',enemy.id);
          if(enemy.kind==='human'){const home=this.villages.get(u.villageId),foe=this.villages.get(enemy.villageId);if(home&&foe){this.heatUp(home,foe,22);this.heatUp(foe,home,18);}}
          w.tell('life',{message:`${u.name} defended the village from ${label}.`,who:u.name,town:v?.name});this.clearTask(u);
        }
      }return;
    }
    if(t.type==='hunt') {
      const prey=this.byId.get(t.targetId);if(!prey||dist(u,prey)>2.4){this.clearTask(u,'blocked');return;}
      if(u.progress<.55)return;
      prey.hp-=20+u.skills.combat*2+(has(u,'brave')?6:0);u.progress=0;gain('combat',.2);w.emit('hit',prey.x,prey.y,{race:'ghoul'});
      if(prey.hp<=0){u.hunger=clamp(u.hunger-58);u.hp=clamp(u.hp+8);this.remember(u,'hunt',prey.id);w.tell('life',{message:prey.kind==='human'?`${u.name} fed on another life.`:`${u.name} caught prey.`,who:u.name});this.clearTask(u);}
      return;
    }
    if(t.type==='herd') {
      const beast=this.byId.get(t.targetId);
      if(!beast||!isLivestock(beast)||beast.hp<=0||beast.penId){this.clearTask(u);return;}
      if(beast.villageId&&beast.villageId!==u.villageId){this.clearTask(u,'blocked');return;}
      if(!beast.villageId) {
        if(dist(u,beast)>1.85||u.progress<.3)return;
        beast.villageId=u.villageId;beast.herderId=u.id;beast.penId=null;u.progress=0;
        w.emit('cheer',beast.x,beast.y,{race:u.race});return;
      }
      beast.herderId=u.id;
      const pen=this.openPen(u.villageId,beast);
      if(!pen){
        const rising=w.buildings.some(b=>b.villageId===u.villageId&&b.type==='pen'&&!ready(b));
        if(!rising&&u.progress>8)this.clearTask(u);
        return;
      }
      const at={x:pen.x+.5,y:pen.y+.5};
      if(dist(u,at)>2.7||dist(beast,at)>2.9)return;
      beast.penId=pen.id;beast.herderId=null;
      this.remember(u,'herd',beast.id);
      w.tell('herd',{who:u.name,town:v?.name??'the town',beast:beast.kind==='cow'?'cow':'sheep'});
      w.emit('complete',pen.x+.5,pen.y+.5,{race:u.race},1.1);
      this.clearTask(u);return;
    }
    if(t.type==='steal') {
      const foreign=this.villages.get(t.targetId),hall=foreign&&this.accessibleVillage(u,foreign);
      if(!foreign||!hall||dist(u,hall)>2.2){this.clearTask(u,'blocked');return;}
      if(u.progress<1.1)return;
      const take=Math.min(4,foreign.food,6-cargoCount(u));
      foreign.food-=take;u.inventory.food+=take;this.remember(u,'steal',foreign.id);w.emit('steal',hall.x,hall.y,{race:u.race});
      if(v){this.heatUp(v,foreign,16);this.heatUp(foreign,v,18);bumpTie(v,foreign,{debt:take*3,legend:`the debt of ${v.name}`});bumpTie(foreign,v,{grudge:14,legend:`the debt of ${v.name}`});}
      const secret=(u.race==='ghoul'?(foreign.known??[]):[]).find(id=>id!==v?.id&&!(v?.known??[]).includes(id));
      if(secret&&v){v.known.push(secret);w.tell('spy',{who:u.name,home:v.name,there:foreign.name,secret:this.villages.get(secret)?.name??'another town'});}
      else w.tell('raid',{who:u.name,home:v?.name??'raiders',there:foreign.name,town:v?.name,other:foreign.name});
      this.clearTask(u);return;
    }
    if(t.type==='siege') {
      const b=this.buildings.get(t.targetId);if(!b||dist(u,{x:b.x+.5,y:b.y+.5})>2.4){this.clearTask(u,'blocked');return;}
      if(u.progress<.7)return;
      b.hp=Math.max(0,(b.hp??36)-(10+u.skills.combat*1.6+(has(u,'brave')?4:0)));u.progress=0;gain('combat',.2);w.emit('hit',b.x+.5,b.y+.5,{race:u.race});
      if(b.hp>0)return;
      w.buildings=w.buildings.filter(x=>x.id!==b.id);this.buildings.delete(b.id);w.navRevision++;w.revision++;
      const home=this.villages.get(u.villageId),mark=this.villages.get(b.villageId);
      if(home&&mark){this.heatUp(home,mark,20);this.heatUp(mark,home,24);}
      this.remember(u,'siege',b.villageId);w.emit('siege',b.x+.5,b.y+.5,{race:u.race},1.4);
      w.tell('siege',{who:u.name,there:mark?.name??'a town',home:home?.name,town:home?.name});
      this.clearTask(u);return;
    }
    if(t.type==='migrate'&&v?.id!==t.targetId){u.villageId=t.targetId;u.homeId=null;this.remember(u,u.reason==='refuge'?'refuge':'move');w.tell(u.reason==='refuge'?'refuge':'village-move',{who:u.name,home:v.name,there:this.villages.get(t.targetId)?.name,town:v.name});}
    if(t.type==='scout'){const other=this.villages.get(t.targetId);if(other)this.discover(v,other,u);this.noticeNeighbors(u);this.clearTask(u);return;}
    if(u.progress>1)this.clearTask(u);
  }
  bond(a,b,amount){let bond=a.bonds.find(x=>x.id===b.id);if(!bond){bond={id:b.id,value:0};a.bonds.push(bond);}bond.value=clamp(bond.value+amount);a.bonds.sort((x,y)=>y.value-x.value);a.bonds.length=Math.min(4,a.bonds.length);}
  related(a,b) { return a.parentIds.includes(b.id)||b.parentIds.includes(a.id)||a.parentIds.some(id=>b.parentIds.includes(id)); }
  society(dt) {
    const w=this.world;this.prepare();
    this.coolWars();this.tryAlliance();this.tryTrade();
    this.tryRelief()||this.tryFestival()||this.tryMarriage()||this.tryTribute()||this.tryBetrayal();
    this.tendFolds(dt);
    for(const b of w.buildings)if(b.type==='farm'&&ready(b)) {
      const home=this.villages.get(b.villageId);
      const faith=(home?.cult??0)>=20?dt*.18:home?.faith==='fear'?-dt*.08:0;
      const sky=w.weatherAt(b.x+.5,b.y+.5);
      const weather=sky?.kind==='rain'||sky?.kind==='bloom'?dt*.5:sky?.kind==='storm'?dt*.18:sky?.kind==='blizzard'||sky?.kind==='drought'?-dt*.45:0;
      b.crop=Math.min(12,Math.max(0,b.crop+dt*(b.race==='mycelite'?.55:.3)+faith+weather));
    }
    for(const v of w.villages) {
      v.market=Math.max(0,(v.market??0)-3);
      const citizens=w.units.filter(u=>u.kind==='human'&&u.hp>0&&u.villageId===v.id), adults=citizens.filter(u=>u.age>=18);
      const housing=w.buildings.filter(b=>b.villageId===v.id&&ready(b)&&isDwelling(b));
      const epoch=epochOf(v.population);
      const beds=epoch.beds;
      const assigned=new Map(housing.map(b=>[b.id,0]));
      for(const u of citizens){if(!assigned.has(u.homeId))u.homeId=null;if(u.homeId)assigned.set(u.homeId,assigned.get(u.homeId)+1);}
      for(const u of citizens.filter(a=>a.homeId==null)) {
        const partner=this.byId.get(u.partnerId),parent=this.byId.get(u.parentIds[0]);
        const preferred=partner?.homeId??parent?.homeId;
        const home=housing.find(b=>b.id===preferred&&assigned.get(b.id)<beds&&this.approach(u,b))??housing.find(b=>assigned.get(b.id)<beds&&this.approach(u,b));
        if(home){u.homeId=home.id;assigned.set(home.id,assigned.get(home.id)+1);}
      }
      const leader=adults.reduce((best,u)=>!best||u.age+(has(u,'social')?10:0)>best.age+(has(best,'social')?10:0)?u:best,null);
      v.leaderId=leader?.id??null;
      const available=[...adults],farmsCount=w.buildings.filter(b=>b.villageId===v.id&&b.type==='farm'&&ready(b)).length;
      const nearby=new Set(w.deposits.filter(d=>d.amount>=1&&dist(v,d)<28&&this.approach(v,d)).map(d=>d.kind));
      const hasWood=this.woodSites.some(i=>dist(v,{x:i%w.width,y:Math.floor(i/w.width)})<28&&this.navigation.sameRegion(v,{x:i%w.width+.5,y:Math.floor(i/w.width)+.5}));
      if(hasWood)nearby.add('wood');
      v.planMaterial=chooseMaterial(v,nearby);
      const resourceJobs=[...nearby].filter(k=>RESOURCES[k]?.job).sort((a,b)=>(b===v.planMaterial?1:0)-(a===v.planMaterial?1:0));
      const nearbyHerd=w.units.filter(a=>isLivestock(a)&&((a.villageId===v.id)||(!a.villageId&&dist(v,a)<26&&this.navigation.sameRegion(v,a))));
      const quotas=[['builder',Math.max(1,Math.floor(adults.length/12))],...resourceJobs.map(k=>[RESOURCES[k].job,Math.max(v.race==='dwarf'&&k==='iron'?2:1,Math.floor(adults.length/(v.race==='dwarf'&&k==='iron'?7:10)))]),['farmer',Math.min(farmsCount,Math.ceil(adults.length*.2))],['herder',v.race==='ghoul'?0:nearbyHerd.length?Math.max(1,Math.min(3,Math.ceil(nearbyHerd.length/4))):0],['woodcutter',hasWood?Math.ceil(adults.length*.15):0],['guard',adults.length>=(v.race==='ghoul'||v.race==='dwarf'?4:5)?((v.wars??[]).length?Math.max(2,Math.floor(adults.length/(v.race==='dwarf'?4:5))):(v.race==='ghoul'||v.race==='dwarf'?2:1)):0],['forager',adults.length]];
      for(const [job,quota]of quotas)for(let i=0;i<quota&&available.length;i++) {
        const skill=SKILL_FOR_JOB[job];
        const fit=u=>u.skills[skill]*2+(u.job===job?1.5:0)+(job==='guard'&&has(u,'brave')?2:0)+(job==='miner'&&u.race==='dwarf'?2:0)+(job!=='guard'&&has(u,'diligent')?.5:0);
        available.sort((a,b)=>fit(b)-fit(a)||a.id-b.id);available.shift().job=job;
      }
      citizens.filter(u=>u.age<18).forEach(u=>u.job='child');
      const unfinished=w.buildings.filter(b=>b.villageId===v.id&&!ready(b));
      if(adults.length&&unfinished.length<(epoch.min>=72?2:1)) {
        const farms=w.buildings.filter(b=>b.villageId===v.id&&b.type==='farm').length;
        const needFarms=farms<Math.max(1,Math.ceil(citizens.length/epoch.farm));
        const pens=w.buildings.filter(b=>b.villageId===v.id&&b.type==='pen').length;
        const herdLoad=w.units.filter(a=>isLivestock(a)&&((a.villageId===v.id)||(!a.villageId&&dist(v,a)<26&&this.navigation.sameRegion(v,a)))).reduce((n,a)=>n+livestockSlots(a),0);
        const needPen=v.race!=='ghoul'&&herdLoad>pens*PEN_SLOTS&&pens<Math.max(1,Math.ceil(adults.length/3));
        const foodTight=v.food<citizens.length*3;
        const needsHouse=housing.length*beds<citizens.length+4;
        const desperateHouse=housing.length*beds<citizens.length;
        const type=foodTight&&needFarms?'farm':needPen&&(!pens||!desperateHouse)?'pen':needsHouse?'house':needPen?'pen':needFarms&&v.food<citizens.length*5?'farm':null;
        const material=type==='farm'||type==='pen'?'wood':v.planMaterial,cost=houseRecipe(material,type,epoch);
        if(type&&canAfford(v,cost)) {
          const building=w.addBuilding(v,type,false,material,cost);
          if(building)for(const [key,amount]of Object.entries(cost))v[key]-=amount;
        }
      }
      for(const u of adults) {
        if(u.partnerId||u.age>55)continue;
        const bond=u.bonds.find(b=>{const other=this.byId.get(b.id);return b.value>=12&&other?.villageId===v.id&&raceOf(other)===raceOf(u)&&other.age>=18&&other.age<55&&other.sex!==u.sex&&!other.partnerId&&!this.related(u,other);});
        const other=bond?this.byId.get(bond.id):null;
        if(other&&!other.partnerId&&other.sex!==u.sex&&other.age<55&&!this.related(u,other)) {
          u.partnerId=other.id;other.partnerId=u.id;this.remember(u,'family',other.id);this.remember(other,'family',u.id);
          w.tell('family',{who:u.name,partner:other.name,town:v.name});
        }
      }
    }
  }
  families(dt) {
    const w=this.world;
    for(const mother of w.units.filter(u=>u.kind==='human'&&u.sex==='f'&&u.hp>0)) {
      const v=this.villages.get(mother.villageId),partner=this.byId.get(mother.partnerId);
      if(mother.pregnancy>0) {
        mother.pregnancy=Math.max(0,mother.pregnancy-dt);
        if(mother.pregnancy===0) {
          if(mother.hp>35&&mother.hunger<90&&w.units.length<UNIT_LIMIT) {
            const p=w.findLand(mother.x,mother.y,3),father=this.byId.get(mother.pregnancyPartnerId);
            if(p){const child=w.spawn('human',p.x,p.y,mother.villageId,{parents:[mother,...(father?[father]:[])]});if(child){child.homeId=mother.homeId;this.remember(mother,'birth',child.id);w.tell('birth',{who:child.name,family:mother.surname,town:v?.name??'the town'});}}
          }
          mother.familyCooldown=28;mother.pregnancyPartnerId=null;
        }
        continue;
      }
      if(!v||!partner||partner.hp<=0||partner.villageId!==mother.villageId||mother.age<18||mother.age>48||mother.familyCooldown>0||mother.hunger>55||mother.hp<70||partner.hunger>65||dist(mother,partner)>5||v.food<10)continue;
      const epoch=epochOf(v.population),beds=epoch.beds;
      const capacity=w.buildings.filter(b=>b.villageId===v.id&&ready(b)&&isDwelling(b)).length*beds;
      const reserved=w.units.filter(u=>u.kind==='human'&&u.villageId===v.id&&u.pregnancy>0).length;
      if(capacity>v.population+reserved&&mother.homeId){mother.pregnancy=6;mother.pregnancyPartnerId=partner.id;v.food-=4;}
    }
  }
  tendFolds(dt) {
    const w=this.world;
    for(const pen of w.buildings.filter(b=>b.type==='pen'&&ready(b))) {
      const home=this.villages.get(pen.villageId);if(!home)continue;
      const flock=w.units.filter(a=>isLivestock(a)&&a.penId===pen.id&&a.hp>0);
      const milk=flock.reduce((n,a)=>n+(a.kind==='cow'?.18:.08),0);
      home.food=Math.min(999,home.food+dt*milk);
      const used=flock.reduce((n,a)=>n+livestockSlots(a),0);
      if(used+1>PEN_SLOTS||w.units.length>=UNIT_LIMIT)continue;
      for(const kind of ['sheep','cow']) {
        if(flock.filter(a=>a.kind===kind&&a.age>=6).length<2)continue;
        if(w.rng.next()>dt*.02)continue;
        const baby=w.spawn(kind,pen.x+.5,pen.y+.5,home.id);
        if(baby){baby.age=1;baby.penId=pen.id;baby.villageId=home.id;}
        break;
      }
    }
  }
}
