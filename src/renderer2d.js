import { TILE } from './world.js';
import { activityLabel } from './humans.js';
import { RESOURCES, epochOf, RACES } from './civilizations.js';
import { growT, growDelay, growOvershoot, growWait, GROW_LAND, GROW_TREE, GROW_BLADE } from './growth.js';

const PALETTE = ['#1e5c6c','#348a8c','#e2d08e','#7db45e','#4e8a52','#8b9891','#dce8da','#6b7764'];
const HATS = {forager:'#c9dca5',farmer:'#e7c567',woodcutter:'#bf7953',builder:'#ede0af',guard:'#b7c8dc',child:'#f4d8ac',herder:'#d4b56a'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const compactView=()=>typeof window!=='undefined'&&(window.innerWidth<=700||window.matchMedia?.('(pointer: coarse)')?.matches);
const zoomMax=()=>compactView()?18:12;

// Terrain is cached; people, work and selection stay visible above the scenery.
export class Renderer {
  constructor(canvas,world) {
    this.canvas=canvas;this.world=world;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Canvas 2D unavailable');
    this.terrain=document.createElement('canvas');this.cacheRevision=-1;
    this.zoom=compactView()?1.55:1;this.offset={x:0,y:0};this.clock=0;this.hover=null;this.radius=3;
    this.tool='grass';this.labels=true;this.grid=false;this.selectedId=null;this.followId=null;this.watch=false;
    this.sprouts=[];this.trees=[];this.treeBorn=new Map();this.displayTiles=null;this.grows=new Map();this.seenRevision=-1;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
  }
  resize() {
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    this.w=rect.width;this.h=rect.height;this.dpr=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
  }
  layout() {
    const left=this.w>1150?252:this.w>700?232:12,right=this.w>1150?272:this.w>700?22:12;
    const top=this.w>700?125:72,bottom=this.w>700?95:this.inspectorOpen?400:188;
    return {width:Math.max(170,this.w-left-right),height:Math.max(120,this.h-top-bottom),x:left+(this.w-left-right)/2,y:top+(this.h-top-bottom)/2};
  }
  transform() {
    const l=this.layout(),s=Math.min(l.width/this.world.width,l.height/this.world.height)*this.zoom;
    const followed=this.followId?this.world.units.find(u=>u.id===this.followId):null;
    const cx=followed?.x??this.world.width/2,cy=followed?.y??this.world.height/2;
    return {s,x:l.x-cx*s+(followed?0:this.offset.x),y:l.y-cy*s+(followed?0:this.offset.y)};
  }
  worldToScreen(x,y) {const t=this.transform();return {x:t.x+x*t.s,y:t.y+y*t.s};}
  screenToWorld(x,y) {const t=this.transform();return {x:(x-t.x)/t.s,y:(y-t.y)/t.s};}
  resetCamera() {this.zoom=compactView()?1.55:1;this.offset={x:0,y:0};this.followId=null;this.watch=false;}
  setWorld(world) {this.world=world;this.cacheRevision=-1;this.selectedId=null;this.sprouts=[];this.trees=[];this.treeBorn.clear();this.displayTiles=null;this.grows.clear();this.seenRevision=-1;this.resetCamera();}
  pan(dx,dy) {
    if(this.followId){const t=this.transform(),l=this.layout();this.offset={x:t.x-l.x+this.world.width*t.s/2,y:t.y-l.y+this.world.height*t.s/2};this.followId=null;}
    this.watch=false;
    this.offset.x+=dx;this.offset.y+=dy;
  }
  changeZoom(factor,sx,sy) {
    const l=this.layout();sx??=l.x;sy??=l.y;
    const before=this.screenToWorld(sx,sy);this.zoom=clamp(this.zoom*factor,.55,zoomMax());
    if(!this.followId){const after=this.worldToScreen(before.x,before.y);this.offset.x+=sx-after.x;this.offset.y+=sy-after.y;}
  }
  bakeDisplay() {
    const w=this.world,now=performance.now()/1000;
    if(!this.displayTiles||this.displayTiles.length!==w.tiles.length){this.displayTiles=w.tiles.slice();this.grows.clear();this.seenRevision=w.revision;return true;}
    if(this.grows.size===0&&this.seenRevision===w.revision)return false;
    let baked=false;
    for(let i=0;i<w.tiles.length;i++) {
      const to=w.tiles[i],shown=this.displayTiles[i];
      if(to===shown){this.grows.delete(i);continue;}
      let g=this.grows.get(i);
      if(!g||g.to!==to){
        g={from:shown,to,start:now,delay:growDelay(i,w.variation[i])};this.grows.set(i,g);
        if(to===TILE.GRASS||to===TILE.FOREST)this.sprouts.push({i,born:now,delay:g.delay,type:to});
        if(to===TILE.FOREST){
          const x=i%w.width,y=Math.floor(i/w.width);
          if((x+y)%3===0){const key=`${x+.5},${y+.5}`;this.trees??=[];if(!this.treeBorn.has(key)){this.trees.push({x:x+.5,y:y+.5,v:w.variation[i]});this.treeBorn.set(key,now);}}
        }
      }
      if(now-g.start>=growWait(g.from,g.to,g.delay)){this.displayTiles[i]=to;this.grows.delete(i);baked=true;}
    }
    this.sprouts=this.sprouts.filter(s=>now-s.born<1.6);this.seenRevision=w.revision;return baked;
  }
  rebuild() {
    const w=this.world,q=4,shown=this.displayTiles??w.tiles;this.terrain.width=w.width*q;this.terrain.height=w.height*q;
    const c=this.terrain.getContext('2d');this.trees=[];
    for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++) {
      const i=w.index(x,y),tile=shown[i],v=w.variation[i];
      c.fillStyle=PALETTE[tile];c.fillRect(x*q,y*q,q,q);
      if(tile>=2){c.fillStyle=v>160?'#ffffff09':'#102a2408';c.fillRect(x*q,y*q,q,q);}
      if(tile===TILE.SHALLOW&&shown[w.index(x,Math.max(0,y-1))]>=2){c.fillStyle='#a0d0b777';c.fillRect(x*q,y*q,q,1);}
      if(tile===TILE.GRASS&&v%7===0){c.fillStyle='#b2cd853f';c.fillRect(x*q+1,y*q+1,1,2);}
      if(w.tiles[i]===TILE.FOREST&&(x+y)%3===0)this.trees.push({x:x+.5,y:y+.5,v});
      if(tile===TILE.MOUNTAIN&&x%3===0&&y%3===0) {
        c.fillStyle='#647b75';c.beginPath();c.moveTo(x*q-2,y*q+5);c.lineTo(x*q+5,y*q-6);c.lineTo(x*q+11,y*q+5);c.fill();
        c.fillStyle='#bcc7b0';c.beginPath();c.moveTo(x*q+5,y*q-6);c.lineTo(x*q+5,y*q+5);c.lineTo(x*q-2,y*q+5);c.fill();
      }
    }
    this.cacheRevision=w.revision;
    const now=performance.now()/1000,live=new Set();
    if(!this.treeBorn.size)for(const tree of this.trees)this.treeBorn.set(`${tree.x},${tree.y}`,now-10);
    for(const tree of this.trees){const key=`${tree.x},${tree.y}`;live.add(key);if(!this.treeBorn.has(key))this.treeBorn.set(key,now);}
    for(const key of this.treeBorn.keys())if(!live.has(key))this.treeBorn.delete(key);
  }
  label(text,x,y,{color='#e8efda',small=false}={}) {
    const c=this.ctx,compact=small||this.w<700;
    c.font=`${compact?'700 8':'600 12'}px "Segoe UI", sans-serif`;c.textAlign='center';c.textBaseline='middle';
    const width=c.measureText(text).width+(compact?8:18),height=compact?14:26;
    c.fillStyle='#172e32ed';c.beginPath();c.roundRect(x-width/2,y-height/2,width,height,compact?3:5);c.fill();
    c.fillStyle=color;c.fillText(text,x,y+.5);
  }
  building(b,t) {
    const c=this.ctx,p={x:t.x+(b.x+.5)*t.s,y:t.y+(b.y+.5)*t.s};
    if(p.x<-50||p.x>this.w+50||p.y<-50||p.y>this.h+50)return;
    const s=Math.max(.4,t.s*.14),v=this.world.villages.find(v=>v.id===b.villageId);
    const race=b.race??'human',setting=b.setting??'meadow',epoch=epochOf(v?.population??0);
    const wall={human:'#ead6ab',dwarf:'#c4b496',ghoul:'#6a5a68',alien:'#8fd4d0',mycelite:'#d7c4e8'}[race]??'#ead6ab';
    const roof={meadow:'#8b4f36',coast:'#3f6b68',forest:'#3d4f32',sand:'#a57a48',highland:'#4d5a63',frost:'#d5e2e8',waste:'#4a4038'}[setting]??'#8b4f36';
    const soil={meadow:'#816447',coast:'#6a6b4a',forest:'#4f5c38',sand:'#b08a58',highland:'#6d6550',frost:'#8a8b78',waste:'#5a4a3a'}[setting]??'#816447';
    const grow=b.type==='hall'||epoch.min>=72?1.12:epoch.min>=36?1.06:1;
    c.save();c.translate(Math.round(p.x),Math.round(p.y));c.scale(s*grow,s*grow);
    c.fillStyle='#183e3140';c.fillRect(-4,1,10,5);
    if(!b.complete) {
      c.fillStyle='#9b865b';c.fillRect(-4,-3,8,7);c.fillStyle='#e0c798';
      for(const x of [-4,3])c.fillRect(x,-7,1,11);c.fillRect(-4,-6,8,1);c.fillRect(-4,-1,8,1);
      c.fillStyle='#263e35';c.fillRect(-4,6,8,1.4);c.fillStyle='#daf09e';c.fillRect(-4,6,8*b.progress,1.4);
    } else if(b.type==='farm') {
      c.fillStyle=soil;c.fillRect(-5,-4,10,8);
      for(let x=-4;x<=4;x+=2){
        if(race==='mycelite'){c.fillStyle=RACES.mycelite.color;c.beginPath();c.ellipse(x,-1,1.2,1.6,0,0,Math.PI*2);c.fill();}
        else if(race==='dwarf'){c.fillStyle='#7a868c';c.fillRect(x-0.2,-2.4,1.4,5);if(b.crop>1){c.fillStyle=b.crop>5?'#93b167':'#6a7a52';c.fillRect(x,-2.2,1,3);}}
        else {c.fillStyle='#af9056';c.fillRect(x,-3,1,6);if(b.crop>1){c.fillStyle=race==='alien'?'#91efe7':b.crop>5?'#e6cc70':'#93b167';c.fillRect(x,-3,1,5);}}
      }
    } else if(b.type==='pen') {
      c.fillStyle=soil;c.fillRect(-5,-4,10,8);c.strokeStyle='#5a4734';c.lineWidth=.7;c.strokeRect(-5,-4,10,8);
      c.fillStyle=wall;c.fillRect(-5,-4,4,3);c.fillStyle=roof;c.fillRect(-5,-6,4,2);
    } else {
      const hall=b.type==='hall',w=hall?5:4;
      if(race==='dwarf'){
        c.fillStyle='#2a4a3c88';c.fillRect(-w-1,-2,w*2+2,7);
        c.fillStyle=wall;c.fillRect(-w,-2,w*2,6);
        c.fillStyle=roof;c.fillRect(-w-1.2,-3.2,w*2+2.4,1.8);
        c.fillStyle='#5c4a38';c.fillRect(w-1.4,-7,.7,4);
        c.fillStyle='#2a3a32';c.fillRect(-1,0,2,4);c.fillStyle='#ffc078';c.fillRect(-w+1,-.2,1.6,1.4);
      } else if(race==='alien'){
        c.fillStyle='#344e3b';c.beginPath();c.ellipse(0,2,w+1,3.2,0,0,Math.PI*2);c.fill();
        c.fillStyle=wall;c.beginPath();c.ellipse(0,-1,w,5.2,0,0,Math.PI*2);c.fill();
        c.strokeStyle=RACES.alien.color;c.lineWidth=.7;c.beginPath();c.ellipse(0,0,w+1.4,2.2,0,0,Math.PI*2);c.stroke();
        c.fillStyle=roof;c.beginPath();c.moveTo(0,-8);c.lineTo(1.2,-4);c.lineTo(-1.2,-4);c.fill();
      } else if(race==='mycelite'){
        c.fillStyle=wall;c.fillRect(-1.4,-1,2.8,5);
        c.fillStyle=roof;c.beginPath();c.ellipse(0,-3,w+1,4,0,0,Math.PI*2);c.fill();
        c.fillStyle=RACES.mycelite.color;c.beginPath();c.ellipse(-w+1,2,1.4,1.2,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(w-1,1.5,1.2,1,0,0,Math.PI*2);c.fill();
      } else {
        c.fillStyle='#2a4a3c88';c.fillRect(-w-1,-3,w*2+2,8);
        if(setting==='waste'){
          c.fillStyle=wall;c.fillRect(-w,-2,w*1.4,6);c.fillStyle='#4a4038';c.beginPath();c.moveTo(-w-1,-2);c.lineTo(-1,-7);c.lineTo(w-1,-1);c.fill();
        } else if(setting==='forest'&&race==='human'){
          c.fillStyle=wall;c.fillRect(-w,-3,w*2,7);
          for(let i=0;i<4;i++){c.fillStyle=i%2?'#c4a06e':'#8a6244';c.fillRect(-w,-2+i*1.6,w*2,.7);}
          c.fillStyle=roof;c.beginPath();c.moveTo(-w-1.5,-3);c.lineTo(0,-9);c.lineTo(w+1.5,-3);c.fill();
        } else if(setting==='meadow'&&race==='human'&&!hall){
          c.fillStyle=wall;c.fillRect(-w+0.4,-2,w*1.7,6);
          c.fillStyle=roof;c.beginPath();c.ellipse(0,-4,w+1.4,4.2,0,Math.PI,0);c.fill();
          c.fillStyle='#d08090';c.fillRect(-w+1,1,1.4,1.2);c.fillRect(w-2.4,1,1.4,1.2);
        } else {
          c.fillStyle=wall;c.fillRect(-w,-3,w*2,7);c.fillStyle=race==='ghoul'?'#4a3c48':'#d4c08a';c.fillRect(0,-3,w,7);
          const peak=race==='ghoul'||setting==='frost'?-10:setting==='sand'?-5:-7.5;
          c.fillStyle=roof;c.beginPath();c.moveTo(-w-1.2, -3);c.lineTo(0, peak);c.lineTo(w+1.2,-3);c.closePath();c.fill();
        }
        if(setting==='coast'){c.fillStyle='#5c4a38';c.fillRect(-w,-1,1.1,6);c.fillRect(w-1.1,-1,1.1,6);}
        if(setting==='frost'){c.fillStyle='#e8f2f6cc';c.fillRect(-w-1,-3.4,w*2+2,1.2);}
        c.fillStyle='#2a3a32';c.fillRect(-1,0,2,4);c.fillStyle='#ffe08a';c.fillRect(-w+1,-1,1.6,1.5);
      }
      if(hall){c.fillStyle='#ddcdb0';c.fillRect(w-1,-13,.7,7);c.fillStyle=v?.color??'#efcb8c';c.fillRect(w-.3,-13,4,2.5);}
    }
    c.restore();
  }
  unit(u,t) {
    const c=this.ctx,p={x:t.x+u.x*t.s,y:t.y+u.y*t.s};
    if(p.x<-30||p.x>this.w+30||p.y<-30||p.y>this.h+30)return;
    const human=u.kind==='human',s=human?Math.max(.35,t.s*.155)*(u.age<18?.78:1)*(u.race==='dwarf'?.84:1):Math.max(.32,t.s*.16);
    const moving=Math.hypot(u.tx-u.x,u.ty-u.y)>.2,bob=moving?Math.sin(this.clock*11+u.id)*.45:0;
    const working=human&&!u.path.length&&['build','chop','farm','forage'].includes(u.action);
    c.save();c.translate(Math.round(p.x),Math.round(p.y));
    if(u.id===this.selectedId){c.strokeStyle='#f8ffa6';c.lineWidth=2;c.beginPath();c.ellipse(0,0,s*4.2,s*2.3,0,0,Math.PI*2);c.stroke();}
    c.scale(s,s);c.fillStyle='#16352d70';c.beginPath();c.ellipse(0,.8,3.4,1.4,0,0,Math.PI*2);c.fill();c.translate(0,bob);
    if(human) {
      const v=this.world.villages.find(v=>v.id===u.villageId),step=moving?Math.sin(this.clock*12+u.id):0,dwarf=u.race==='dwarf';
      c.fillStyle='#263a34';c.fillRect(dwarf?-2.4:-2,dwarf?-4:-5,dwarf?4.8:4,dwarf?5:6);c.fillRect(-1.8,0,1.3,1+step);c.fillRect(.5,0,1.3,1-step);
      c.fillStyle=v?.color??'#b3d5ae';c.fillRect(dwarf?-2:-1.5,-4.5,dwarf?4:3,4);c.fillStyle='#283b2c';c.fillRect(-2,-8,4,4);
      c.fillStyle=RACES[u.race]?.skin??'#f1c998';c.fillRect(-1.5,-7.5,3,2.8);
      if(dwarf){c.fillStyle='#6a4a32';c.fillRect(-1.8,-6.2,3.6,2);c.fillStyle='#8a7358';c.fillRect(-2.2,-8.8,4.4,1.6);}
      else {c.fillStyle=HATS[u.job];c.fillRect(-2,-8.4,4,1.8);if(u.job==='farmer'||u.job==='herder')c.fillRect(-3,-7.2,6,.8);}
      if(u.inventory.wood+u.inventory.food>0||u.action==='cart'){c.fillStyle='#304334';c.fillRect(1,-4,3,4);c.fillStyle=u.action==='cart'?(RESOURCES[u.task?.good]?.color??'#d9c976'):u.inventory.wood?'#b98454':'#ddb954';c.fillRect(1.5,-3.5,2,3);}
      if(u.action==='cart'){c.fillStyle='#6a5138';c.fillRect(-5,-2,4,3);c.fillStyle='#3a3228';c.fillRect(-4.6,-.2,1.2,1.4);c.fillRect(-2.4,-.2,1.2,1.4);}
      if(working){c.save();c.translate(2,-3);c.rotate(Math.sin(this.clock*9+u.id)*.5);c.fillStyle='#634c33';c.fillRect(1,-4,.8,5);c.fillStyle='#e2dcb0';c.fillRect(0,-4,3,1.5);c.restore();}
      if(u.action==='flee'){c.fillStyle='#ffca96';c.fillRect(3,-11,1,3);c.fillRect(3,-7,1,1);}
      if(u.hp<50){c.fillStyle='#293a30';c.fillRect(-3,3,6,1);c.fillStyle='#e78f79';c.fillRect(-3,3,6*u.hp/100,1);}
      if(u.action==='socialize'&&!u.path.length){c.fillStyle='#eee6be';c.fillRect(2,-12,4,2.5);c.fillRect(2,-10,1,1);}
      if(u.action==='rest'&&!u.path.length){c.fillStyle='#bcd6d4';c.font='4px sans-serif';c.fillText('z',3,-10);}
      if(u.action==='cheer'||u.action==='dance'){
        const hop=Math.abs(Math.sin(this.clock*10+u.id));
        c.fillStyle='#f1c998';c.fillRect(-3.4,-9-hop,1.3,4);c.fillRect(2.1,-9-hop,1.3,4);
        c.fillStyle=u.action==='dance'?'#ffe08a':RESOURCES[u.task?.depositKind]?.color??'#ffe08a';
        c.fillRect(-.6,-14-hop,1.2,1.2);c.fillRect(2.4,-13-hop,1,1);
      }
      if(u.action==='marvel'&&!u.path.length){c.fillStyle='#8ee0d0';c.fillRect(-.5,-14,1,3);c.fillRect(-2,-13,1.2,1.2);c.fillRect(1.4,-13,1.2,1.2);}
      if(u.action==='shelter'&&!u.path.length){c.fillStyle='#bcd6d4';c.font='4px sans-serif';c.fillText('z',3,-10);}
    } else {
      const cow=u.kind==='cow';
      c.fillStyle=u.kind==='sheep'?'#384b39':cow?'#3a2a1c':'#233c38';c.fillRect(-3,-4,cow?7:6,5);c.fillRect(-3,0,1,2);c.fillRect(2,0,1,2);
      c.fillStyle=u.kind==='sheep'?'#f0ebd3':cow?'#8a6238':'#8a9a98';c.fillRect(-3,-4,cow?7:6,4);c.fillStyle=u.kind==='sheep'?'#695e4c':cow?'#efe6d4':'#536967';c.fillRect(2,-4,2.5,3);
      if(u.kind==='wolf'){c.fillRect(2,-5,1,1.5);c.fillRect(-4,-4,1,2);}
      if(cow){c.fillRect(2,-5.2,.7,1.6);c.fillRect(3.2,-5.2,.7,1.6);}
    }
    c.restore();
  }
  render(delta,animate=true) {
    if(!this.w||!this.h)return;if(animate)this.clock+=delta;
    const c=this.ctx,w=this.world,t=this.transform();
    if(this.bakeDisplay()||this.cacheRevision===-1)this.rebuild();
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;c.fillStyle='#1a4a58';c.fillRect(0,0,this.w,this.h);
    c.drawImage(this.terrain,t.x,t.y,w.width*t.s,w.height*t.s);
    const now=performance.now()/1000;
    for(const [i,g] of this.grows) {
      const e=growT(now-g.start,g.delay,GROW_LAND);if(e<=0)continue;
      const x=i%w.width,y=Math.floor(i/w.width),px=t.x+x*t.s,py=t.y+y*t.s;
      if(g.to<TILE.SAND){
        const s=t.s*(1-e);c.fillStyle=PALETTE[g.from]??PALETTE[0];c.fillRect(px+(t.s-s)/2,py+(t.s-s)/2,s,s);
      } else if(g.from<TILE.SAND){
        const s=t.s*Math.min(1,e);c.fillStyle=PALETTE[g.to];c.fillRect(px+(t.s-s)/2,py+(t.s-s)/2,s,s);
      } else {
        c.globalAlpha=.4+e*.6;c.fillStyle=PALETTE[g.to];c.fillRect(px,py,t.s,t.s);c.globalAlpha=1;
      }
    }
    c.strokeStyle='#97c2b426';c.lineWidth=1;c.strokeRect(t.x-.5,t.y-.5,w.width*t.s+1,w.height*t.s+1);
    c.fillStyle='#bdd9c721';
    for(let i=0;i<45;i++){const x=(i*43.7)%w.width,y=(i*23.1)%w.height;if(w.tile(x,y)<2)c.fillRect(t.x+x*t.s+Math.sin(this.clock*.4+i)*2,t.y+y*t.s,Math.max(3,t.s*1.8),1);}
    for(const tree of this.trees) {
      const x=t.x+tree.x*t.s,y=t.y+tree.y*t.s,grow=growOvershoot(growT(now-(this.treeBorn.get(`${tree.x},${tree.y}`)??0),.05,GROW_TREE));
      if(grow<=0)continue;const s=t.s*.42*grow;if(x<-15||x>this.w+15||y<-15||y>this.h+15)continue;
      c.fillStyle='#264f3652';c.fillRect(x-s*2,y,s*5,s*2);c.fillStyle='#856749';c.fillRect(x-.4*s,y-s,s*.8,s*3);
      if(tree.v>168){
        c.fillStyle='#2f6a45';c.beginPath();c.moveTo(x,y-s*6);c.lineTo(x-s*2.2,y-s);c.lineTo(x+s*2.2,y-s);c.fill();
        c.fillStyle='#3d7a52';c.beginPath();c.moveTo(x,y-s*7);c.lineTo(x-s*1.5,y-s*3);c.lineTo(x+s*1.5,y-s*3);c.fill();
      } else {
        c.fillStyle=tree.v>130?'#345f3c':'#3f7246';c.fillRect(x-s*2,y-s*4,s*4,s*4);c.fillRect(x-s*3,y-s*3,s*6,s*2);
        c.fillStyle='#78a45c';c.fillRect(x-s*2,y-s*4,s*2,s*1.5);
      }
    }
    for(const s of this.sprouts) {
      const e=growOvershoot(growT(now-s.born,s.delay,GROW_BLADE));if(e<=0)continue;
      const x=s.i%w.width+.5,y=Math.floor(s.i/w.width)+.5,px=t.x+x*t.s,py=t.y+y*t.s,h=Math.max(2,t.s*.45*e);
      c.fillStyle=s.type===TILE.FOREST?'#4e7a4ccc':'#97c56acc';
      for(let k=0;k<4;k++)c.fillRect(px+(k-1.5)*t.s*.16-1,py-h*(.7+k%2*.3),Math.max(1,t.s*.1),h*(.7+k%2*.3));
    }
    for(const b of [...w.buildings].sort((a,b)=>a.y-b.y))this.building(b,t);
    const drawn=new Set();
    for(const v of w.villages) {
      const last=v.lastTrade;
      if(!last||last.year<w.year-1)continue;
      const other=w.villages.find(o=>o.id===last.partnerId);if(!other)continue;
      const key=v.id<other.id?`${v.id}:${other.id}`:`${other.id}:${v.id}`;
      if(drawn.has(key))continue;drawn.add(key);
      const a=this.worldToScreen(v.x,v.y),b=this.worldToScreen(other.x,other.y);
      c.strokeStyle='#e2c07acc';c.lineWidth=Math.max(1.4,t.s*.12);c.setLineDash([6,5]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);
      c.fillStyle='#f0d080';c.fillRect((a.x+b.x)/2-2,(a.y+b.y)/2-2,4,4);
    }
    const chosen=w.units.find(u=>u.id===this.selectedId);
    if(chosen?.path.length) {
      c.strokeStyle='#f4f6bb';c.lineWidth=1.5;c.setLineDash([3,4]);c.beginPath();c.moveTo(t.x+chosen.x*t.s,t.y+chosen.y*t.s);
      for(const i of chosen.path)c.lineTo(t.x+(i%w.width+.5)*t.s,t.y+(Math.floor(i/w.width)+.5)*t.s);c.stroke();c.setLineDash([]);
    }
    for(const u of [...w.units].sort((a,b)=>a.y-b.y))if(u!==chosen)this.unit(u,t);
    if(chosen)this.unit(chosen,t);
    for(const cart of w.caravans??[]) {
      const p=this.worldToScreen(cart.x,cart.y),s=Math.max(2.2,t.s*.28);
      c.fillStyle='#3a3228';c.fillRect(p.x-s*.9,p.y-s*.15,s*.5,s*.5);c.fillRect(p.x+s*.35,p.y-s*.15,s*.5,s*.5);
      c.fillStyle='#6a5138';c.fillRect(p.x-s,p.y-s*.85,s*2,s*1.1);
      c.fillStyle=RESOURCES[cart.good]?.color??'#d9c976';c.fillRect(p.x-s*.7,p.y-s*1.15,s*1.4,s*.55);
      if(cart.blessed){c.fillStyle='#ffe08a';c.fillRect(p.x-s*.2,p.y-s*1.5,s*.4,s*.3);}
    }
    for(let i=0;i<w.fire.length;i++)if(w.fire[i]>0) {
      const x=t.x+(i%w.width+.5)*t.s,y=t.y+(Math.floor(i/w.width)+.5)*t.s,s=t.s*(.5+Math.sin(this.clock*8+i)*.15);
      c.fillStyle='#ef8446';c.fillRect(x-s,y-s*2,s*2,s*3);c.fillStyle='#ffdc83';c.fillRect(x-s*.4,y-s,s*.8,s*2);
    }
    for(const field of w.weather??[]) {
      const p=this.worldToScreen(field.x,field.y),alpha=Math.min(.7,field.life/field.total*.85);
      c.globalAlpha=alpha;
      if(field.kind==='rain'||field.kind==='storm') {
        c.strokeStyle=field.kind==='storm'?'#8eb8cc':'#b8e6ef';c.lineWidth=field.kind==='storm'?1.4:1;
        const n=field.kind==='storm'?48:36,len=field.kind==='storm'?16:11,slant=field.kind==='storm'?9:3;
        for(let i=0;i<n;i++){
          const u=(i*0.618+this.clock*(field.kind==='storm'?1.4:.7))%1,a=i*2.4,r=field.radius*t.s*Math.sqrt((i%9)/9);
          const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r-u*28;
          c.beginPath();c.moveTo(x,y);c.lineTo(x-slant,y+len);c.stroke();
        }
      } else if(field.kind==='blizzard') {
        c.fillStyle='#eef6fb';
        for(let n=0;n<40;n++){
          const a=n*1.7+this.clock*.6,r=field.radius*t.s*Math.sqrt((n%8)/8);
          const y=p.y+Math.sin(a)*r-((this.clock*22+n*11)%36);
          c.fillRect(p.x+Math.cos(a)*r-1.2,y-1.2,2.4,1.4);
        }
      } else if(field.kind==='aurora') {
        for(let n=0;n<5;n++){
          c.strokeStyle=n%2?'#7ff0d2':'#b09cff';c.lineWidth=2;c.globalAlpha=alpha*(.45+n*.08);
          c.beginPath();c.moveTo(p.x-field.radius*t.s,p.y-16-n*7);c.quadraticCurveTo(p.x,p.y-44-n*9,p.x+field.radius*t.s,p.y-14-n*6);c.stroke();
        }
      } else if(field.kind==='bloom') {
        c.fillStyle='#d4f08a';
        for(let n=0;n<18;n++){const a=n*2.2+this.clock*.8,r=field.radius*t.s*(.15+(n%5)*.14);c.fillRect(p.x+Math.cos(a)*r-1,p.y+Math.sin(a)*r-1,2,2);}
      } else if(field.kind==='drought') {
        c.fillStyle='#c4a060';
        for(let n=0;n<16;n++){const a=n*1.9+this.clock*.2,r=field.radius*t.s*(.2+(n%4)*.18);c.fillRect(p.x+Math.cos(a)*r-2,p.y+Math.sin(a)*r-1,4,1.5);}
      }
      c.globalAlpha=1;
    }
    for(const e of w.effects) {
      c.globalAlpha=e.life/e.total;const p=this.worldToScreen(e.x,e.y);
      const weather=['rain','storm','blizzard','aurora','bloom','drought'].includes(e.kind);
      if(!weather){
        c.strokeStyle=e.kind==='cheer'||e.kind==='festival'?(RESOURCES[e.resource]?.color??'#ffe08a'):'#ffe7ad';c.lineWidth=2;
        c.beginPath();c.arc(p.x,p.y,e.radius*t.s*(1.3-e.life/e.total*.3),0,Math.PI*2);c.stroke();
      }
      if(e.kind==='lightning'||e.kind==='storm'){c.strokeStyle='#e8f4ff';c.lineWidth=2;c.beginPath();c.moveTo(p.x+8,p.y-85);c.lineTo(p.x-5,p.y-40);c.lineTo(p.x+9,p.y-44);c.lineTo(p.x,p.y);c.stroke();}
      if(e.kind==='cheer'||e.kind==='festival'){c.fillStyle=c.strokeStyle;for(let n=0;n<6;n++){const a=n*1.05+(1-e.life/e.total)*2,r=e.radius*t.s*(.4+(1-e.life/e.total));c.fillRect(p.x+Math.cos(a)*r-1,p.y+Math.sin(a)*r-1-e.life,2,2);}}
      c.globalAlpha=1;
    }
    if(this.labels)for(const v of w.villages)if(v.population>0){const p=this.worldToScreen(v.x,v.y);this.label(this.w<700?v.name:`${v.name} · ${epochOf(v.population).name} · ${v.population}`,p.x,p.y-(this.w<700?14:42),{color:v.color,small:this.w<700});}
    if(chosen?.kind==='human') {const p=this.worldToScreen(chosen.x,chosen.y);this.label(`${chosen.name} · ${activityLabel(chosen)}`,p.x,p.y-Math.max(25,t.s*5),{small:true});}
    if(this.grid&&t.s>=5) {
      c.strokeStyle='#284d3630';c.lineWidth=.5;c.beginPath();
      for(let x=0;x<=w.width;x++){c.moveTo(t.x+x*t.s,t.y);c.lineTo(t.x+x*t.s,t.y+w.height*t.s);}
      for(let y=0;y<=w.height;y++){c.moveTo(t.x,t.y+y*t.s);c.lineTo(t.x+w.width*t.s,t.y+y*t.s);}c.stroke();
    }
    if(this.hover&&w.inBounds(this.hover.x,this.hover.y)) {
      const p=this.worldToScreen(Math.floor(this.hover.x)+.5,Math.floor(this.hover.y)+.5),single=['inspect','trade',...Object.keys(RACES),'sheep','cow','wolf'].includes(this.tool);
      c.strokeStyle='#f5f6d4';c.fillStyle='#ecf4b514';c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,Math.max(single?5:this.radius*t.s,3),0,Math.PI*2);c.fill();c.stroke();
    }
  }
  dispose() {this.resizeObserver.disconnect();}
}
