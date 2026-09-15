import { TILE } from './world.js';
import { activityLabel } from './humans.js';
import { RESOURCES } from './civilizations.js';

const PALETTE = ['#285764','#397e85','#d9cd92','#87ae68','#608f58','#8b9891','#d7e4d5','#6b7764'];
const HATS = {forager:'#c9dca5',farmer:'#e7c567',woodcutter:'#bf7953',builder:'#ede0af',guard:'#b7c8dc',child:'#f4d8ac'};
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
  setWorld(world) {this.world=world;this.cacheRevision=-1;this.selectedId=null;this.resetCamera();}
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
  rebuild() {
    const w=this.world,q=4;this.terrain.width=w.width*q;this.terrain.height=w.height*q;
    const c=this.terrain.getContext('2d');this.trees=[];
    for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++) {
      const i=w.index(x,y),tile=w.tiles[i],v=w.variation[i];
      c.fillStyle=PALETTE[tile];c.fillRect(x*q,y*q,q,q);
      if(tile>=2){c.fillStyle=v>160?'#ffffff09':'#102a2408';c.fillRect(x*q,y*q,q,q);}
      if(tile===TILE.SHALLOW&&w.tile(x,y-1)>=2){c.fillStyle='#a0d0b777';c.fillRect(x*q,y*q,q,1);}
      if(tile===TILE.GRASS&&v%7===0){c.fillStyle='#b2cd853f';c.fillRect(x*q+1,y*q+1,1,2);}
      if(tile===TILE.FOREST&&(x+y)%3===0)this.trees.push({x:x+.5,y:y+.5,v});
      if(tile===TILE.MOUNTAIN&&x%3===0&&y%3===0) {
        c.fillStyle='#647b75';c.beginPath();c.moveTo(x*q-2,y*q+5);c.lineTo(x*q+5,y*q-6);c.lineTo(x*q+11,y*q+5);c.fill();
        c.fillStyle='#bcc7b0';c.beginPath();c.moveTo(x*q+5,y*q-6);c.lineTo(x*q+5,y*q+5);c.lineTo(x*q-2,y*q+5);c.fill();
      }
    }
    this.cacheRevision=w.revision;
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
    c.save();c.translate(Math.round(p.x),Math.round(p.y));c.scale(s,s);
    c.fillStyle='#183e3140';c.fillRect(-4,1,10,5);
    if(!b.complete) {
      c.fillStyle='#9b865b';c.fillRect(-4,-3,8,7);c.fillStyle='#e0c798';
      for(const x of [-4,3])c.fillRect(x,-7,1,11);c.fillRect(-4,-6,8,1);c.fillRect(-4,-1,8,1);
      c.fillStyle='#263e35';c.fillRect(-4,6,8,1.4);c.fillStyle='#daf09e';c.fillRect(-4,6,8*b.progress,1.4);
    } else if(b.type==='farm') {
      c.fillStyle='#816447';c.fillRect(-5,-4,10,8);
      for(let x=-4;x<=4;x+=2){c.fillStyle='#af9056';c.fillRect(x,-3,1,6);if(b.crop>1){c.fillStyle=b.crop>5?'#e6cc70':'#93b167';c.fillRect(x,-3,1,5);}}
    } else {
      const hall=b.type==='hall',w=hall?5:4;
      c.fillStyle='#344e3b';c.fillRect(-w-1,-3,w*2+2,8);
      c.fillStyle='#e5d9b0';c.fillRect(-w,-3,w*2,7);c.fillStyle='#beae81';c.fillRect(0,-3,w,7);
      c.fillStyle='#563f31';c.fillRect(-w-1,-5,w*2+2,3);c.fillRect(-w,-7,w*2,2);
      c.fillStyle=hall?'#7c667c':'#b46f50';c.fillRect(-w,-5,w*2,2);c.fillRect(-w+1,-7,w*2-2,2);
      c.fillStyle='#394b3a';c.fillRect(-1,0,2,4);c.fillStyle='#f8e39b';c.fillRect(-w+1,-1,1.5,1.5);
      if(hall){c.fillStyle='#ddcdb0';c.fillRect(w-1,-13,.7,7);c.fillStyle=v?.color??'#efcb8c';c.fillRect(w-.3,-13,4,2.5);}
    }
    c.restore();
  }
  unit(u,t) {
    const c=this.ctx,p={x:t.x+u.x*t.s,y:t.y+u.y*t.s};
    if(p.x<-30||p.x>this.w+30||p.y<-30||p.y>this.h+30)return;
    const human=u.kind==='human',s=human?Math.max(.35,t.s*.155)*(u.age<18?.78:1):Math.max(.32,t.s*.16);
    const moving=Math.hypot(u.tx-u.x,u.ty-u.y)>.2,bob=moving?Math.sin(this.clock*11+u.id)*.45:0;
    const working=human&&!u.path.length&&['build','chop','farm','forage'].includes(u.action);
    c.save();c.translate(Math.round(p.x),Math.round(p.y));
    if(u.id===this.selectedId){c.strokeStyle='#f8ffa6';c.lineWidth=2;c.beginPath();c.ellipse(0,0,s*4.2,s*2.3,0,0,Math.PI*2);c.stroke();}
    c.scale(s,s);c.fillStyle='#16352d70';c.beginPath();c.ellipse(0,.8,3.4,1.4,0,0,Math.PI*2);c.fill();c.translate(0,bob);
    if(human) {
      const v=this.world.villages.find(v=>v.id===u.villageId),step=moving?Math.sin(this.clock*12+u.id):0;
      c.fillStyle='#263a34';c.fillRect(-2,-5,4,6);c.fillRect(-1.8,0,1.3,1+step);c.fillRect(.5,0,1.3,1-step);
      c.fillStyle=v?.color??'#b3d5ae';c.fillRect(-1.5,-4.5,3,4);c.fillStyle='#283b2c';c.fillRect(-2,-8,4,4);
      c.fillStyle='#f1c998';c.fillRect(-1.5,-7.5,3,2.8);c.fillStyle=HATS[u.job];c.fillRect(-2,-8.4,4,1.8);
      if(u.job==='farmer')c.fillRect(-3,-7.2,6,.8);
      if(u.inventory.wood+u.inventory.food>0){c.fillStyle='#304334';c.fillRect(1,-4,3,4);c.fillStyle=u.inventory.wood?'#b98454':'#ddb954';c.fillRect(1.5,-3.5,2,3);}
      if(working){c.save();c.translate(2,-3);c.rotate(Math.sin(this.clock*9+u.id)*.5);c.fillStyle='#634c33';c.fillRect(1,-4,.8,5);c.fillStyle='#e2dcb0';c.fillRect(0,-4,3,1.5);c.restore();}
      if(u.action==='flee'){c.fillStyle='#ffca96';c.fillRect(3,-11,1,3);c.fillRect(3,-7,1,1);}
      if(u.hp<50){c.fillStyle='#293a30';c.fillRect(-3,3,6,1);c.fillStyle='#e78f79';c.fillRect(-3,3,6*u.hp/100,1);}
      if(u.action==='socialize'&&!u.path.length){c.fillStyle='#eee6be';c.fillRect(2,-12,4,2.5);c.fillRect(2,-10,1,1);}
      if(u.action==='rest'&&!u.path.length){c.fillStyle='#bcd6d4';c.font='4px sans-serif';c.fillText('z',3,-10);}
      if(u.action==='cheer'){
        const hop=Math.abs(Math.sin(this.clock*10+u.id));
        c.fillStyle='#f1c998';c.fillRect(-3.4,-9-hop,1.3,4);c.fillRect(2.1,-9-hop,1.3,4);
        c.fillStyle=RESOURCES[u.task?.depositKind]?.color??'#ffe08a';
        c.fillRect(-.6,-14-hop,1.2,1.2);c.fillRect(2.4,-13-hop,1,1);
      }
    } else {
      c.fillStyle=u.kind==='sheep'?'#384b39':'#233c38';c.fillRect(-3,-4,6,5);c.fillRect(-3,0,1,2);c.fillRect(2,0,1,2);
      c.fillStyle=u.kind==='sheep'?'#f0ebd3':'#8a9a98';c.fillRect(-3,-4,6,4);c.fillStyle=u.kind==='sheep'?'#695e4c':'#536967';c.fillRect(2,-4,2.5,3);
      if(u.kind==='wolf'){c.fillRect(2,-5,1,1.5);c.fillRect(-4,-4,1,2);}
    }
    c.restore();
  }
  render(delta,animate=true) {
    if(!this.w||!this.h)return;if(animate)this.clock+=delta;
    const c=this.ctx,w=this.world,t=this.transform();
    if(this.cacheRevision!==w.revision)this.rebuild();
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;c.fillStyle='#285764';c.fillRect(0,0,this.w,this.h);
    c.drawImage(this.terrain,t.x,t.y,w.width*t.s,w.height*t.s);
    c.strokeStyle='#97c2b426';c.lineWidth=1;c.strokeRect(t.x-.5,t.y-.5,w.width*t.s+1,w.height*t.s+1);
    c.fillStyle='#bdd9c721';
    for(let i=0;i<45;i++){const x=(i*43.7)%w.width,y=(i*23.1)%w.height;if(w.tile(x,y)<2)c.fillRect(t.x+x*t.s+Math.sin(this.clock*.4+i)*2,t.y+y*t.s,Math.max(3,t.s*1.8),1);}
    for(const tree of this.trees) {
      const x=t.x+tree.x*t.s,y=t.y+tree.y*t.s,s=t.s*.42;if(x<-15||x>this.w+15||y<-15||y>this.h+15)continue;
      c.fillStyle='#264f3652';c.fillRect(x-s*2,y,s*5,s*2);c.fillStyle='#856749';c.fillRect(x-.4*s,y-s,s*.8,s*3);
      c.fillStyle=tree.v>130?'#345f3c':'#3f7246';c.fillRect(x-s*2,y-s*4,s*4,s*4);c.fillRect(x-s*3,y-s*3,s*6,s*2);
      c.fillStyle='#78a45c';c.fillRect(x-s*2,y-s*4,s*2,s*1.5);
    }
    for(const b of [...w.buildings].sort((a,b)=>a.y-b.y))this.building(b,t);
    const chosen=w.units.find(u=>u.id===this.selectedId);
    if(chosen?.path.length) {
      c.strokeStyle='#f4f6bb';c.lineWidth=1.5;c.setLineDash([3,4]);c.beginPath();c.moveTo(t.x+chosen.x*t.s,t.y+chosen.y*t.s);
      for(const i of chosen.path)c.lineTo(t.x+(i%w.width+.5)*t.s,t.y+(Math.floor(i/w.width)+.5)*t.s);c.stroke();c.setLineDash([]);
    }
    for(const u of [...w.units].sort((a,b)=>a.y-b.y))if(u!==chosen)this.unit(u,t);
    if(chosen)this.unit(chosen,t);
    for(let i=0;i<w.fire.length;i++)if(w.fire[i]>0) {
      const x=t.x+(i%w.width+.5)*t.s,y=t.y+(Math.floor(i/w.width)+.5)*t.s,s=t.s*(.5+Math.sin(this.clock*8+i)*.15);
      c.fillStyle='#ef8446';c.fillRect(x-s,y-s*2,s*2,s*3);c.fillStyle='#ffdc83';c.fillRect(x-s*.4,y-s,s*.8,s*2);
    }
    for(const e of w.effects) {
      c.globalAlpha=e.life/e.total;const p=this.worldToScreen(e.x,e.y);c.strokeStyle=e.kind==='rain'?'#b8e6ef':e.kind==='cheer'?(RESOURCES[e.resource]?.color??'#ffe08a'):'#ffe7ad';c.lineWidth=2;
      c.beginPath();c.arc(p.x,p.y,e.radius*t.s*(1.3-e.life/e.total*.3),0,Math.PI*2);c.stroke();
      if(e.kind==='lightning'){c.beginPath();c.moveTo(p.x+8,p.y-85);c.lineTo(p.x-5,p.y-40);c.lineTo(p.x+9,p.y-44);c.lineTo(p.x,p.y);c.stroke();}
      if(e.kind==='cheer'){c.fillStyle=c.strokeStyle;for(let n=0;n<6;n++){const a=n*1.05+(1-e.life/e.total)*2,r=e.radius*t.s*(.4+(1-e.life/e.total));c.fillRect(p.x+Math.cos(a)*r-1,p.y+Math.sin(a)*r-1-e.life,2,2);}}
      c.globalAlpha=1;
    }
    if(this.labels)for(const v of w.villages)if(v.population>0){const p=this.worldToScreen(v.x,v.y);this.label(this.w<700?v.name:`${v.name} · ${v.population}`,p.x,p.y-(this.w<700?14:42),{color:v.color,small:this.w<700});}
    if(chosen?.kind==='human') {const p=this.worldToScreen(chosen.x,chosen.y);this.label(`${chosen.name} · ${activityLabel(chosen)}`,p.x,p.y-Math.max(25,t.s*5),{small:true});}
    if(this.grid&&t.s>=5) {
      c.strokeStyle='#284d3630';c.lineWidth=.5;c.beginPath();
      for(let x=0;x<=w.width;x++){c.moveTo(t.x+x*t.s,t.y);c.lineTo(t.x+x*t.s,t.y+w.height*t.s);}
      for(let y=0;y<=w.height;y++){c.moveTo(t.x,t.y+y*t.s);c.lineTo(t.x+w.width*t.s,t.y+y*t.s);}c.stroke();
    }
    if(this.hover&&w.inBounds(this.hover.x,this.hover.y)) {
      const p=this.worldToScreen(Math.floor(this.hover.x)+.5,Math.floor(this.hover.y)+.5),single=['inspect','human','sheep','wolf'].includes(this.tool);
      c.strokeStyle='#f5f6d4';c.fillStyle='#ecf4b514';c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,Math.max(single?5:this.radius*t.s,3),0,Math.PI*2);c.fill();c.stroke();
    }
  }
  dispose() {this.resizeObserver.disconnect();}
}
