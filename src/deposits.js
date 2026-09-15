import { DEPOSIT_KINDS } from './civilizations.js';

export function depositFits(w,kind,x,y) {
  const t=w.tile(x,y);
  if(kind==='fish')return t<2&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>w.walkable(x+dx,y+dy));
  return t>=2&&t!==7&&(kind!=='mycelium'||t===3||t===4);
}
export function addDeposit(w,kind,x,y,amount=30) {
  x=Math.floor(x);y=Math.floor(y);
  if(!DEPOSIT_KINDS.includes(kind)||!w.inBounds(x,y)||!depositFits(w,kind,x,y)||w.deposits.length>=700)return null;
  if(w.buildings.some(b=>Math.hypot(b.x-x,b.y-y)<2))return null;
  const existing=w.deposits.find(d=>Math.hypot(d.x-x,d.y-y)<1.8);
  if(existing){if(existing.kind===kind){existing.amount=Math.min(60,existing.amount+amount);existing.max=Math.max(existing.max,existing.amount);w.depositRevision++;}return existing;}
  const d={id:w.nextId++,kind,x,y,amount,max:amount};w.deposits.push(d);w.depositRevision++;return d;
}
// Local hash does not consume the simulation RNG: migration and saves stay stable.
export function seedDeposits(w) {
  w.deposits=[];
  for(let y=2;y<w.height-2;y+=3)for(let x=2;x<w.width-2;x+=3) {
    const t=w.tile(x,y),v=(Math.imul(x+17,73856093)^Math.imul(y+31,19349663)^w.seed)>>>0;
    const mountain=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dy])=>w.tile(x+dx,y+dy)===5);
    let kind=null;
    if(t<2&&v%3===0)kind='fish';
    else if(t>=2&&t!==5&&mountain)kind=['stone','iron','crystal'][v%3];
    else if(t===2&&v%3===0)kind='clay';
    else if(t===4&&v%7===0)kind='mycelium';
    else if(t===3&&v%23===0)kind='stone';
    if(kind)addDeposit(w,kind,x,y,24+v%17);
  }
  for(const v of w.villages){
    const kind={human:'stone',ghoul:'iron',alien:'crystal',mycelite:'mycelium'}[v.race??'human'];let placed=0;
    for(let n=0;n<40&&placed<3;n++){
      const a=n*2.4,r=5+n%7,x=v.x+Math.cos(a)*r,y=v.y+Math.sin(a)*r;
      if(!w.walkable(x,y)||!w.humans.navigation.sameRegion(v,{x,y}))continue;
      const d=addDeposit(w,kind,x,y,32);if(d?.kind===kind)placed++;
    }
  }
}
export function reconcileDeposits(w) {
  const before=w.deposits.length;
  w.deposits=w.deposits.filter(d=>depositFits(w,d.kind,d.x,d.y)&&!w.buildings.some(b=>Math.hypot(b.x-d.x,b.y-d.y)<1.5));
  for(const d of w.deposits)if(d.kind==='mycelium'&&w.fire[w.index(d.x,d.y)]>0&&d.amount){d.amount=0;w.depositRevision++;}
  if(before!==w.deposits.length)w.depositRevision++;
}
