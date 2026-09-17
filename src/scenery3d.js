import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RACES, RESOURCES, epochOf } from './civilizations.js';
import { tileHeight } from './terrain3d.js';
import { houseKit, houseForm, buildHouse, disposeHouseGeometry } from './houses3d.js';

const MATERIAL_PALETTES={wood:['#ead6ab','#8b4f36','#f3e2b6'],stone:['#c8d3d8','#5a6d7c','#e7eee8'],iron:['#7c8b98','#3c4458','#d08a5c'],crystal:['#7ebac8','#6a90c4','#b6fff4'],clay:['#e8b898','#a66c52','#f6dcb4'],mycelium:['#d6c4d2','#7a4e98','#f0e6c0']};
const SITE_TINT={meadow:['#3a5a28',.12],coast:['#4a8890',.2],forest:['#3a5230',.26],sand:['#c9a066',.26],highland:['#6a7884',.28],frost:['#d5e4ea',.3],waste:['#4a433c',.34]};
const SOIL={meadow:'#806949',coast:'#6a6b4a',forest:'#4f5c38',sand:'#b08a58',highland:'#6d6550',frost:'#8a8b78',waste:'#5a4a3a'};
const YARD={meadow:'#6f7d4c',coast:'#6a7a58',forest:'#4f6a42',sand:'#9a8a52',highland:'#6a7360',frost:'#8a9580',waste:'#5a5644'};
const BUILDING = .5;
const WINDOW_LIGHT={human:'#ffd79a',dwarf:'#ffc078',ghoul:'#ff9b86',alien:'#9ef0e8',mycelite:'#ffe3a4'};
function hexMix(a, b, t=.35) {
  const n=c=>parseInt(c.slice(1),16),pa=n(a),pb=n(b),ch=s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t);
  return `#${((ch(16)<<16)|(ch(8)<<8)|ch(0)).toString(16).padStart(6,'0')}`;
}
// One id gives a house its variant, its lean and its size, so a street never repeats itself.
function scatter(id) { return Math.imul((id ?? 1) ^ 0x9e3779b9, 2654435761) >>> 0; }

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
    const lit=glow===true?.25:glow||0,key=`${color}|${lit}`;
    if(!this.palette.has(key))this.palette.set(key,new THREE.MeshStandardMaterial({color,roughness:lit?.35:.88,metalness:lit?.3:0,emissive:lit?color:'#000000',emissiveIntensity:lit,flatShading:true}));
    return this.palette.get(key);
  }
  // A house is drawn as twenty odd little meshes, then flattened into one so the GPU
  // pays for the materials it uses rather than for every plank and window.
  structure(b) { const local=this.raise(b); if(local)this.fuse(local); }
  fuse(group) {
    const byMaterial=new Map();
    for(const child of group.children) {
      if(!child.isMesh||!child.geometry)continue;
      child.updateMatrix();
      const geometry=child.geometry.clone().applyMatrix4(child.matrix);
      const list=byMaterial.get(child.material);
      if(list)list.push(geometry);else byMaterial.set(child.material,[geometry]);
    }
    if(!byMaterial.size)return;
    const parts=[],materials=[],spent=[];
    for(const [material,list] of byMaterial) {
      const part=list.length===1?list[0]:mergeGeometries(list,false);
      if(list.length>1)spent.push(...list);
      if(!part){spent.forEach(geometry=>geometry.dispose());return;}
      parts.push(part);materials.push(material);
    }
    const merged=mergeGeometries(parts,true);
    spent.forEach(geometry=>geometry.dispose());parts.forEach(geometry=>geometry.dispose());
    if(!merged)return;
    group.clear();
    const mesh=new THREE.Mesh(merged,materials);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  raise(b) {
    const r=this.r,w=r.world,g=r.buildingGroup,x=b.x-w.width/2+.5,z=b.y-w.height/2+.5,h=tileHeight(w,b.x,b.y);
    const village=w.villages.find(v=>v.id===b.villageId);
    const epoch=epochOf(village?.population??0);
    const setting=b.setting??'meadow',[tint,amount]=SITE_TINT[setting]??SITE_TINT.meadow;
    const shade=hex=>amount?hexMix(hex,tint,amount):hex;
    const [wallColor,roofColor,trimColor]=MATERIAL_PALETTES[b.material??'wood'].map(shade),race=b.race??'human';
    const roofHex=setting==='frost'?hexMix(roofColor,'#eef6f8',.55):roofColor;
    const wall=this.mat(wallColor),roof=this.mat(roofHex),trim=this.mat(trimColor,b.material==='crystal'||setting==='frost'),dark=this.mat('#2c3c48'),accent=this.mat(RACES[race].color,race==='alien'? .45 : race==='ghoul' ? .18 : race==='dwarf' ? .12 : 0);
    const glass=this.mat(WINDOW_LIGHT[race]??WINDOW_LIGHT.human,.85);
    const noise=scatter(b.id),variant=Number.isInteger(b.variant)?b.variant:noise%3;
    const local=new THREE.Group();local.position.set(x,h,z);
    const size=b.type==='house'?1+(((noise>>4)%9)-4)*.012:1;
    local.scale.setScalar((b.type==='hall'?1.18:1)*BUILDING*epoch.scale*size);g.add(local);
    if(b.type==='house')local.rotation.y=(((noise>>12)%9)-4)*.05;
    const box=(mat,dx,dy,dz,sx,sy,sz)=>r.addBox(local,mat,dx,dy,dz,sx,sy,sz);
    const mesh=(geo,mat,dx,dy,dz,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(dx,dy,dz);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;local.add(m);return m;};
    const gable=(mat,y,radius,height)=>{const top=mesh(new THREE.ConeGeometry(radius,height,4),mat,0,y,0);top.rotation.y=Math.PI/4;return top;};
    const storeys=b.type==='hall'?Math.min(6,epoch.levels+1):Math.min(5,epoch.levels);
    const storeyH=.42, bodyW=epoch.id==='camp'?1.65:epoch.id==='hamlet'?1.85:2.05, bodyD=bodyW*.86;
    const bodyTop=.28+storeys*storeyH;
    const dress=()=>{
      if(setting==='coast')for(const dx of [-bodyW*.42,bodyW*.42])for(const dz of [-bodyD*.4,bodyD*.4])box(this.mat('#5c4a38'),dx,.28,dz,.12,.7,.12);
      if(setting==='forest'){for(const n of [-.7,.7])box(this.mat('#6a4e32'),n*.9,.22,bodyD*.55,.28,.28,.7);box(this.mat('#4f6a42'),bodyW*.55,.16,-.35,.4,.18,.45);}
      if(setting==='sand')for(const n of [-1,1])box(this.mat('#c9a66a'),n*1.15,.14,0,.65,.18,bodyD+.15);
      if(setting==='highland'){box(this.mat('#7a868c'),0,.1,0,bodyW+.65,.18,bodyD+.55);for(const dx of [-bodyW*.4,bodyW*.4])box(this.mat('#8a9498'),dx,.42,-bodyD*.48,.18,.55,.18);}
      if(setting==='frost'){for(const dx of [-.7,0,.7])mesh(new THREE.ConeGeometry(.1,.45,5),this.mat('#e8f2f6',true),dx,bodyTop+.85,bodyD*.2);box(this.mat('#eef6f8',true),0,bodyTop+.08,0,bodyW*.7,.08,bodyD*.7);}
      if(setting==='waste')for(const n of [-1,1])box(this.mat('#6a5a48'),n*1.1,.2,.8,.32,.32,.26);
      if(setting==='meadow')for(const n of [-1,1])box(this.mat('#6f8a4a'),n*bodyW*.55,.14,bodyD*.55,.28,.16,.22);
    };
    if(b.type==='pen'){
      const post=this.mat('#5c4a38'),rail=this.mat('#8d7352'),yard=this.mat(YARD[setting]??YARD.meadow);
      box(yard,0,.07,0,3.6,.14,3.4);
      for(const dx of [-1.55,-.52,.52,1.55])for(const dz of [-1.45,1.45])box(post,dx,.55,dz,.12,1.05,.12);
      for(const dz of [-1.45,1.45])box(rail,0,.62,dz,3.2,.08,.08);
      for(const dx of [-1.55,1.55])box(rail,dx,.62,0,.08,.08,2.9);
      if(!b.complete){box(this.mat('#daf09e'),-1.5+b.progress*1.5,.16,1.7,3*b.progress,.1,.16);return local;}
      if(race==='alien'){mesh(new THREE.CylinderGeometry(.55,.7,.9,10),wall,-1.15,.5,-1.05);mesh(new THREE.SphereGeometry(.7,10,6,0,Math.PI*2,0,Math.PI/2),accent,-1.15,.9,-1.05,1,.45,1);}
      else if(race==='mycelite'){mesh(new THREE.CylinderGeometry(.22,.32,.7,6),wall,-1.15,.4,-1.05);mesh(new THREE.SphereGeometry(.7,10,6,0,Math.PI*2,0,Math.PI/2),accent,-1.15,.75,-1.05,1,.5,1);}
      else if(race==='ghoul'){box(wall,-1.15,.58,-1.05,1.2,1.15,1.05);gable(roof,.58+1.15+.55,.85,.95);mesh(new THREE.ConeGeometry(.14,.7,5),accent,-.55,1.5,-1.05);}
      else if(race==='dwarf'){box(wall,-1.15,.5,-1.05,1.2,.9,1.1);box(trim,-1.15,1.02,-1.05,1.4,.18,1.25);box(dark,-1.15,1.35,-1.05,.16,.55,.16);}
      else {box(wall,-1.15,.58,-1.05,1.35,1.05,1.2);gable(roof,.58+1.05+.42,.95,.7);}
      box(dark,-1.15,.42,-.42,.45,.7,.08);
      box(this.mat('#8a6a45'),.85,.22,.35,1.2,.22,.4);
      box(this.mat('#c9b36a'),.85,.38,.35,.9,.12,.22);
      if(setting==='coast')for(const dx of [-1.5,1.5])box(post,dx,.35,0,.12,.7,.12);
      if(setting==='frost')box(this.mat('#e8f2f6'),.85,.46,.35,.9,.08,.22);
      return local;
    }
    if(b.type==='farm'&&b.complete){
      box(this.mat(SOIL[setting]??SOIL.meadow),0,.12,0,2.7,.22,2.4);
      for(let n=0;n<5;n++){
        const px=-1+n*.5,pz=(n%2-.5)*.8,grown=Math.min(1,b.crop/12);
        if(race==='mycelite')mesh(new THREE.SphereGeometry(.45,8,4,0,Math.PI*2,0,Math.PI/2),accent,px,.5,pz,1,.7,1);
        else if(race==='alien')mesh(new THREE.ConeGeometry(.12,.28+grown*.45,5),this.mat('#91efe7',true),px,.22+grown*.2,0);
        else if(race==='ghoul')box(this.mat('#6a4a52'),px,.22+grown*.2,0,.14,.18+grown*.32,1.6);
        else if(race==='dwarf')box(this.mat('#7a868c'),px,.16+grown*.12,0,.22,.12+grown*.2,1.7);
        else if(setting==='frost')box(this.mat('#c9d6b0'),px,.2+grown*.18,0,.16,.16+grown*.28,1.8);
        else if(setting==='coast')box(this.mat('#93b167'),px,.18+grown*.16,0,.2,.14+grown*.22,1.9);
        else box(this.mat('#d9c074'),px,.25+grown*.28,0,.18,.2+grown*.4,2);
      }
      if(setting==='highland')box(this.mat('#7a868c'),0,.06,1.3,2.7,.18,.22);
      return local;
    }
    box(dark,0,.08,0,bodyW+.4,.16,bodyD+.4);
    if(!b.complete){
      const p=Math.max(.08,b.progress),shown=Math.max(1,Math.ceil(p*storeys));
      for(let n=0;n<shown;n++)box(wall,0,.28+n*storeyH,0,bodyW,.32,bodyD);
      for(const dx of [-1.15,1.15])for(const dz of [-1.05,1.05])box(this.mat('#a4865d'),dx,1.15,dz,.09,2.2,.09);
      box(trim,0,2.1,1.05,2.4,.1,.1);box(dark,0,.25,1.35,1.9,.1,.16);box(accent,-1+b.progress,.31,1.35,2*b.progress,.12,.17);
      return local;
    }
    const kit=houseKit(
      (geo,material,dx,dy,dz,sx,sy,sz)=>geo?mesh(geo,material,dx,dy,dz,sx,sy,sz):box(material,dx,dy,dz,sx,sy,sz),
      {wall,roof,trim,dark,accent,glass,mat:(color,glow)=>this.mat(color,glow)},
      {race,setting,material:b.material??'wood',epoch,variant,storeys,storeyH,bodyW,bodyD,bodyTop,hall:b.type==='hall'},
    );
    buildHouse(kit,houseForm(race,setting,epoch,b.material??'wood'));
    if(b.material==='crystal')for(const dx of [-1,1])mesh(new THREE.ConeGeometry(.2,.9,5),trim,dx,.45,1);
    if(b.material==='iron')for(const dx of [-.9,.9])box(this.mat('#d4a37d'),dx,.75,.95,.08,1.35,.08);
    if(b.material==='stone')for(let i=0;i<4;i++)box(trim,-.85+i*.55,.22,1.05,.45,.22,.26);
    if(b.material==='mycelium')for(let i=0;i<4;i++)mesh(new THREE.SphereGeometry(.1,6,4),accent,-.65+i*.42,.28,1.05);
    dress();
    if(b.type==='hall'){
      box(dark,bodyW*.52,bodyTop+1.1,-.45,.07,2.4,.07);box(accent,bodyW*.7,bodyTop+2.2,-.45,.75,.4,.05);
      mesh(new THREE.SphereGeometry(.12,8,6),this.mat(WINDOW_LIGHT[race]??WINDOW_LIGHT.human,.7),-bodyW*.45,bodyTop+.35,bodyD*.48);
    }
    return local;
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
      if(!['gather','deliver','birth','death','complete','hit','fell','steal','scout','border','war','siege','cheer','festival','family'].includes(e.kind))continue;
      const t=1-e.life/e.total,x=e.x-w.width/2,z=e.y-w.height/2,h=tileHeight(w,e.x,e.y);
      const color=e.kind==='scout'?'#7ee0d8':e.kind==='border'?'#ffb078':e.kind==='steal'||e.kind==='siege'||e.kind==='war'?'#f08a8a':e.kind==='festival'?'#ffe08a':e.kind==='family'?'#f0b8d0':e.kind==='cheer'?(RESOURCES[e.resource]?.color??'#ffe08a'):RESOURCES[e.resource]?.color??RACES[e.race??'human'].color;
      const burst=e.kind==='complete'?24:e.kind==='scout'?16:e.kind==='war'||e.kind==='siege'?20:e.kind==='festival'?22:e.kind==='cheer'?18:10;
      for(let n=0;n<burst;n++){
        const a=n*2.4,spread=(e.kind==='complete'?2:e.kind==='scout'?1.4:1)*t;
        const py=e.kind==='death'?t*2:e.kind==='scout'?t*2.4:e.kind==='cheer'?1.4+t*1.6:Math.sin(t*Math.PI)*(1+n%3*.3);
        r.put(this.particles,particles++,x+Math.cos(a)*spread,h+.3+py,z+Math.sin(a)*spread,.12*(1-t),.12*(1-t),.12*(1-t),a,color);
      }
      if(e.kind==='fell')r.put(this.rocks,rocks++,x+t*.65,h+.35,z,.16,Math.max(.05,1-t)*1.2,.16,t,'#aa7e50');
    }
    for(const [mesh,count]of[[this.rocks,rocks],[this.crystals,crystals],[this.mushrooms,mushrooms],[this.stems,stems],[this.fish,fish],[this.particles,particles]])r.finishInstances(mesh,count);
  }
  dispose(){for(const material of this.palette.values())material.dispose();disposeHouseGeometry();}
}
