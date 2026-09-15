import * as THREE from 'three';
import { RACES, RESOURCES } from './civilizations.js';
import { tileHeight } from './terrain3d.js';

const MATERIAL_PALETTES={wood:['#bfa37e','#806044','#d8c38e'],stone:['#9cacb3','#596e80','#d7e1d5'],iron:['#687988','#424a61','#d6a17b'],crystal:['#679aa8','#6884ad','#91efe7'],clay:['#d2a08b','#986955','#f1cf9e'],mycelium:['#c1b0bb','#875fa1','#e4d9ac']};
const BUILDING = .5;

export class Scenery3D {
  constructor(r) {
    this.r=r;this.palette=new Map();this.nodeGroup=new THREE.Group();r.scene.add(this.nodeGroup);
    this.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,flatShading:true});
    this.glowMaterial=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x274d50,emissiveIntensity:.65,roughness:.3});
    this.rocks=r.instances(new THREE.IcosahedronGeometry(1,0),this.material,2800,true,this.nodeGroup);
    this.crystals=r.instances(new THREE.ConeGeometry(.5,1,5),this.glowMaterial,2200,true,this.nodeGroup);
    this.mushrooms=r.instances(new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI/2),this.material,2200,true,this.nodeGroup);
    this.stems=r.instances(new THREE.CylinderGeometry(.1,.16,1,5),this.material,2200,true,this.nodeGroup);
    this.fish=r.instances(new THREE.ConeGeometry(.12,.55,4),this.glowMaterial,2200,false,this.nodeGroup);
    this.particles=r.instances(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff}),2400,false,this.nodeGroup);
  }
  mat(color,glow=false) {
    const key=color+glow;if(!this.palette.has(key))this.palette.set(key,new THREE.MeshStandardMaterial({color,roughness:glow?.35:.88,metalness:glow?.3:0,emissive:glow?color:'#000000',emissiveIntensity:glow?.25:0,flatShading:true}));return this.palette.get(key);
  }
  structure(b) {
    const r=this.r,w=r.world,g=r.buildingGroup,x=b.x-w.width/2+.5,z=b.y-w.height/2+.5,h=tileHeight(w,b.x,b.y);
    const [wallColor,roofColor,trimColor]=MATERIAL_PALETTES[b.material??'wood'],race=b.race??'human';
    const wall=this.mat(wallColor),roof=this.mat(roofColor),trim=this.mat(trimColor,b.material==='crystal'),dark=this.mat('#354653'),accent=this.mat(RACES[race].color,race==='alien');
    const local=new THREE.Group();local.position.set(x,h,z);local.scale.setScalar((b.type==='hall'?1.22:1)*BUILDING);g.add(local);
    const box=(mat,dx,dy,dz,sx,sy,sz)=>r.addBox(local,mat,dx,dy,dz,sx,sy,sz);
    const mesh=(geo,mat,dx,dy,dz,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(dx,dy,dz);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;local.add(m);return m;};
    const s=1;
    if(b.type==='farm'&&b.complete){box(this.mat('#806949'),0,.12,0,2.7,.22,2.4);for(let n=0;n<5;n++){
      if(race==='mycelite')mesh(new THREE.SphereGeometry(.45,8,4,0,Math.PI*2,0,Math.PI/2),accent,-1+n*.5,.5,(n%2-.5)*.8,1,.7,1);
      else box(this.mat('#d9c074'),-1+n*.5,.25+Math.min(1,b.crop/12)*.28,0,.18,.2+Math.min(1,b.crop/12)*.4,2);
    }return;}
    box(dark,0,.08,0,2.5*s,.16,2.3*s);
    if(!b.complete){
      const p=Math.max(.08,b.progress),levels=Math.max(1,Math.ceil(p*5));
      for(let n=0;n<levels;n++)box(wall,0,.2+n*.35,0,1.9*s,.27,1.7*s);
      for(const dx of [-1.2,1.2])for(const dz of [-1.1,1.1])box(this.mat('#a4865d'),dx,1.2,dz,.09,2.4,.09);
      box(trim,0,2.2,1.1,2.5,.1,.1);box(dark,0,.25,1.4,2,.1,.16);box(accent,-1+b.progress,.31,1.4,2*b.progress,.12,.17);
      for(let n=0;n<3;n++)box(wall,1.55,.15+n*.16,-.6,.55,.15,.4);return;
    }
    if(race==='human') {
      if(b.material==='wood'){
        for(let level=0;level<5;level++){box(wall,0,.35+level*.3,0,2.1*s,.26,1.75*s);box(roof,-.85*s,.35+level*.3,.87*s,.2,.2,.12);}
        const top=mesh(new THREE.ConeGeometry(1.8*s,1.2*s,4),roof,0,2.25*s,0);top.rotation.y=Math.PI/4;
      } else if(b.material==='clay'){
        mesh(new THREE.CylinderGeometry(1*s,1.12*s,1.8*s,8),wall,0,.95*s,0);
        mesh(new THREE.SphereGeometry(1.2*s,10,6,0,Math.PI*2,0,Math.PI/2),roof,0,1.8*s,0,1,.5,1);
      } else {
        box(wall,0,1*s,0,2.1*s,1.8*s,1.9*s);box(roof,0,2.05*s,0,2.3*s,.25,2.1*s);
        for(const dx of [-.95,.95])for(const dz of [-.85,.85])box(trim,dx*s,2.3*s,dz*s,.32,.5,.32);
        for(let n=0;n<3;n++)box(roof,0,.5+n*.5,.96*s,2.1*s,.045,.045);
      }
      box(dark,0,.5,.99*s,.47,1,.07);box(trim,-.58*s,1.15,.99*s,.35,.42,.07);box(trim,.58*s,1.15,.99*s,.35,.42,.07);
    } else if(race==='ghoul') {
      box(wall,0,1.2*s,0,1.8*s,2.3*s,1.65*s);
      const roofMesh=mesh(new THREE.ConeGeometry(1.55*s,1.9*s,4),roof,0,3.05*s,0);roofMesh.rotation.y=Math.PI/4;
      for(const dx of [-.65,.65]){box(dark,dx*s,1.3*s,.86*s,.18,2.2*s,.06);box(accent,dx*s,1.9*s,.9*s,.12,.45,.06);}
      box(dark,0,.7,.88*s,.45,1.4,.08);box(accent,0,2.4*s,.9*s,1.45*s,.08,.1);
      for(const dx of [-1.15,1.15])mesh(new THREE.ConeGeometry(.18,1.2,5),accent,dx,1.8,-.3);
    } else if(race==='alien') {
      mesh(new THREE.CylinderGeometry(1.2*s,1.35*s,.5,12),dark,0,.3,0);
      mesh(new THREE.SphereGeometry(1.3*s,12,8,0,Math.PI*2,0,Math.PI/2),wall,0,.5,0,1,1.2,1);
      const ring=mesh(new THREE.TorusGeometry(1.24*s,.07,5,18),accent,0,.7,0);ring.rotation.x=Math.PI/2;
      mesh(new THREE.ConeGeometry(.32,1.4,5),trim,0,2.25*s,0);
      for(let i=0;i<3;i++){const a=i/3*Math.PI*2;box(dark,Math.cos(a)*1.3,.9,Math.sin(a)*1.3,.24,1.4,.24);mesh(new THREE.SphereGeometry(.15,6,4),accent,Math.cos(a)*1.3,1.7,Math.sin(a)*1.3);}
      box(dark,0,.6,1.17*s,.55,.9,.13);box(accent,0,1.05,1.25*s,.55,.07,.07);
    } else {
      mesh(new THREE.CylinderGeometry(.75*s,1.0*s,1.9*s,8),wall,0,1*s,0);
      mesh(new THREE.SphereGeometry(1.6*s,12,7,0,Math.PI*2,0,Math.PI/2),roof,0,1.9*s,0,1,.6,1);
      for(let i=0;i<7;i++){const a=i*2.4;mesh(new THREE.SphereGeometry(.16,6,4),trim,Math.cos(a)*.95*s,2.6*s,Math.sin(a)*.8*s,1,.2,1);}
      box(dark,0,.55,.92*s,.45,1.05,.1);mesh(new THREE.SphereGeometry(.18,8,5),accent,.5,1.3,.73*s,1,1,.3);
      for(const sign of [-1,1]){mesh(new THREE.CylinderGeometry(.12,.22,.65,5),wall,sign*1.25,.3,.6);mesh(new THREE.SphereGeometry(.45,8,4,0,Math.PI*2,0,Math.PI/2),accent,sign*1.25,.65,.6,1,.6,1);}
    }
    if(b.material==='crystal')for(const dx of [-1.1,1.1])mesh(new THREE.ConeGeometry(.23,1,5),trim,dx,.5,1.1);
    if(b.material==='iron')for(const dx of [-1,1])box(this.mat('#d4a37d'),dx,.8,1, .1,1.5,.1);
    if(b.material==='stone')for(let i=0;i<4;i++)box(trim,-.9+i*.6,.23,1.1,.5,.26,.3);
    if(b.material==='mycelium')for(let i=0;i<4;i++)mesh(new THREE.SphereGeometry(.1,6,4),accent,-.7+i*.45,.3,1.1);
    if(b.type==='hall'){box(dark,1.1,2.8,-.6,.07,2.8,.07);box(accent,1.5,3.9,-.6,.85,.45,.05);}
  }
  update(time) {
    const r=this.r,w=r.world;let rocks=0,crystals=0,mushrooms=0,stems=0,fish=0,particles=0;
    for(const d of w.deposits){
      if(d.amount<1)continue;const x=d.x-w.width/2+.5,z=d.y-w.height/2+.5,h=Math.max(.3,tileHeight(w,d.x,d.y));
      const count=Math.max(1,Math.ceil(d.amount/d.max*3)),color=RESOURCES[d.kind].color;
      for(let j=0;j<count;j++){
        const dx=(j-1)*.43,dz=Math.sin(j*5+d.id)*.3,s=.55+j*.17;
        if(d.kind==='crystal')r.put(this.crystals,crystals++,x+dx,h+.7+j*.2,z+dz,s,1.4+j*.4,s,j,color);
        else if(d.kind==='mycelium'){
          r.put(this.stems,stems++,x+dx,h+.4,z+dz,1,.8,1,0,'#d9d4b1');r.put(this.mushrooms,mushrooms++,x+dx,h+.7,z+dz,.48,.35,.48,j,j%2?'#ba84d1':'#8f76b8');
        } else if(d.kind==='fish'){
          const f=time*.7+d.id+j*2;const px=x+Math.sin(f)*.55,pz=z+Math.cos(f)*.5;r.put(this.fish,fish++,px,.34+Math.sin(f*3)*.04,pz,1,.8,1,f,'#b7e6d4');
        } else {
          r.put(this.rocks,rocks++,x+dx,h+.36,z+dz,s,d.kind==='clay'?.2:.5,s,j,d.kind==='iron'?'#566471':color);
          if(d.kind==='iron')r.put(this.crystals,crystals++,x+dx,h+.7,z+dz,.35,.4,.35,j,color);
        }
      }
    }
    for(const e of w.effects) {
      if(!['gather','deliver','birth','death','complete','hit','fell','steal','scout','border','war','siege','cheer'].includes(e.kind))continue;
      const t=1-e.life/e.total,x=e.x-w.width/2,z=e.y-w.height/2,h=tileHeight(w,e.x,e.y);
      const color=e.kind==='scout'?'#7ee0d8':e.kind==='border'?'#ffb078':e.kind==='steal'||e.kind==='siege'||e.kind==='war'?'#f08a8a':e.kind==='cheer'?(RESOURCES[e.resource]?.color??'#ffe08a'):RESOURCES[e.resource]?.color??RACES[e.race??'human'].color;
      const burst=e.kind==='complete'?24:e.kind==='scout'?16:e.kind==='war'||e.kind==='siege'?20:e.kind==='cheer'?18:10;
      for(let n=0;n<burst;n++){
        const a=n*2.4,spread=(e.kind==='complete'?2:e.kind==='scout'?1.4:1)*t;
        const py=e.kind==='death'?t*2:e.kind==='scout'?t*2.4:e.kind==='cheer'?1.4+t*1.6:Math.sin(t*Math.PI)*(1+n%3*.3);
        r.put(this.particles,particles++,x+Math.cos(a)*spread,h+.3+py,z+Math.sin(a)*spread,.12*(1-t),.12*(1-t),.12*(1-t),a,color);
      }
      if(e.kind==='fell')r.put(this.rocks,rocks++,x+t*.65,h+.35,z,.16,Math.max(.05,1-t)*1.2,.16,t,'#aa7e50');
    }
    for(const [mesh,count]of[[this.rocks,rocks],[this.crystals,crystals],[this.mushrooms,mushrooms],[this.stems,stems],[this.fish,fish],[this.particles,particles]])r.finishInstances(mesh,count);
  }
  dispose(){for(const material of this.palette.values())material.dispose();}
}
