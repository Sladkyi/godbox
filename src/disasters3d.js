import * as THREE from 'three';
import { tileHeight } from './terrain3d.js';

const mix=(a,b,t)=>a+(b-a)*t;
const easeOut=t=>1-(1-t)*(1-t);
const easeIn=t=>t*t;

function hash(n) { n|=0; n=Math.imul(n^n>>>16,2246822507); n=Math.imul(n^n>>>13,3266489909); return ((n^n>>>16)>>>0)/4294967296; }

export class Disasters3D {
  constructor(r) {
    this.r=r;this.flash=0;this.shake=0;this.clips=[];this.seen=new Set();this.group=new THREE.Group();r.scene.add(this.group);
    this.obj=new THREE.Object3D();this.color=new THREE.Color();
    const add=THREE.AdditiveBlending;
    this.glowMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,blending:add,depthWrite:false});
    this.emberMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,blending:add,depthWrite:false});
    this.smokeMat=new THREE.MeshBasicMaterial({color:0x6a5a52,transparent:true,opacity:.22,depthWrite:false});
    this.rockMat=new THREE.MeshStandardMaterial({color:0x4c3a32,emissive:0xff5a1a,emissiveIntensity:.9,roughness:.72,flatShading:true});
    this.coreMat=new THREE.MeshBasicMaterial({color:0xfff4c8,transparent:true,opacity:.9,blending:add,depthWrite:false});
    this.ringMat=new THREE.MeshBasicMaterial({color:0xffe7b0,transparent:true,opacity:.8,blending:add,depthWrite:false,side:THREE.DoubleSide});
    this.glows=r.instances(new THREE.SphereGeometry(1,10,8),this.glowMat,80,false,this.group);
    this.embers=r.instances(new THREE.SphereGeometry(.12,6,4),this.emberMat,2200,false,this.group);
    this.smoke=r.instances(new THREE.SphereGeometry(.7,7,5),this.smokeMat,900,false,this.group);
    this.rocks=r.instances(new THREE.IcosahedronGeometry(.55,0),this.rockMat,48,true,this.group);
    this.cores=r.instances(new THREE.SphereGeometry(.45,8,6),this.coreMat,36,false,this.group);
    this.rings=r.instances(new THREE.RingGeometry(.55,1,40),this.ringMat,36,false,this.group);
    this.wisps=r.instances(new THREE.ConeGeometry(.22,1.4,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.55,blending:add,depthWrite:false}),1800,false,this.group);
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps])mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*3),3);
    this.boltPoints=new Float32Array(900*6);
    this.boltGeo=new THREE.BufferGeometry();this.boltGeo.setAttribute('position',new THREE.BufferAttribute(this.boltPoints,3));
    this.bolts=new THREE.LineSegments(this.boltGeo,new THREE.LineBasicMaterial({color:0xf4fbff,transparent:true,opacity:1,blending:add,depthWrite:false}));
    this.bolts.frustumCulled=false;this.bolts.renderOrder=30;this.group.add(this.bolts);
    this.rainPoints=new Float32Array(900*6);
    this.rainGeo=new THREE.BufferGeometry();this.rainGeo.setAttribute('position',new THREE.BufferAttribute(this.rainPoints,3));
    this.rain=new THREE.LineSegments(this.rainGeo,new THREE.LineBasicMaterial({color:0xc5eefe,transparent:true,opacity:.72,blending:add,depthWrite:false}));
    this.rain.frustumCulled=false;this.group.add(this.rain);
    this.light=new THREE.PointLight(0xffe0a8,0,90,1.7);this.group.add(this.light);
  }
  place(mesh,i,x,y,z,sx,sy,sz,rx,ry,rz,color) {
    if(i>=mesh.instanceMatrix.count)return i;
    this.obj.position.set(x,y,z);this.obj.scale.set(sx,sy,sz);this.obj.rotation.set(rx,ry,rz);this.obj.updateMatrix();
    mesh.setMatrixAt(i,this.obj.matrix);if(color!=null)mesh.setColorAt(i,this.color.set(color));return i+1;
  }
  finish() {
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps])this.r.finishInstances(mesh,Math.min(this.counts.get(mesh)??0,mesh.instanceMatrix.count));
  }
  count(mesh) { return this.counts.get(mesh)??0; }
  bump(mesh) { const n=this.count(mesh); this.counts.set(mesh,n+1); return n; }
  update(clock,delta) {
    const now=performance.now(),wall=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):.016;this.lastTime=now;
    this.syncClips(wall);
    const w=this.r.world;this.counts=new Map();this.flash=Math.max(0,this.flash-wall*2.4);this.shake=Math.max(0,this.shake-wall*3.2);
    let bolts=0,rain=0,light=0,lightColor=0xffe6b0,lx=0,ly=8,lz=0;
    this.fireField(clock);
    for(const e of this.clips) {
      const p=Math.min(1,e.t/e.duration),x=e.x-w.width/2,z=e.y-w.height/2,h=tileHeight(w,e.x,e.y);
      if(e.kind==='meteor') {
        const fall=Math.min(1,p/.52),hit=p>.5,rise=hit?easeOut((p-.5)/.5):0;
        const mx=x-mix(18,0,easeIn(fall)),my=mix(h+46,h+1.2,easeIn(fall)),mz=z-mix(11,0,easeIn(fall));
        this.place(this.rocks,this.bump(this.rocks),mx,my,mz,1.7,1.4,1.7,clock*4,clock*2.2,clock,0x5a3c2c);
        this.place(this.cores,this.bump(this.cores),mx,my,mz,2.4,2.4,2.4,0,0,0,0xfff1c2);
        this.place(this.glows,this.bump(this.glows),mx,my,mz,3.6+fall*2,3.6+fall*2,3.6+fall*2,0,0,0,0xff7a32);
        for(let n=1;n<10;n++) {
          const t=n/10,tx=mix(x-18,mx,1-t*.35),ty=mix(h+46,my,1-t*.35)-t*1.2,tz=mix(z-11,mz,1-t*.35);
          this.place(this.glows,this.bump(this.glows),tx,ty,tz,(1.4-t)* (1.2+fall), (1.4-t)*(1.2+fall),(1.4-t)*(1.2+fall),0,0,0,n<3?0xfff0c4:0xff6a28);
        }
        if(hit) {
          const boom=easeOut(Math.min(1,(p-.5)*3.4));
          this.place(this.glows,this.bump(this.glows),x,h+1.4,z,e.radius*(1.2+boom*3.2),e.radius*(.7+boom*1.6),e.radius*(1.2+boom*3.2),0,0,0,0xffc878);
          this.place(this.cores,this.bump(this.cores),x,h+1.1,z,e.radius*(.6+boom),e.radius*(.4+boom*.7),e.radius*(.6+boom),0,0,0,0xfff7de);
          for(let k=0;k<3;k++) {
            const s=e.radius*(.4+rise*(1.6+k*.7));
            this.place(this.rings,this.bump(this.rings),x,h+.2+k*.08,z,s,s,s,-Math.PI/2,0,0,k?0xff9a4a:0xfff1c0);
          }
          for(let n=0;n<18;n++) {
            const a=n*2.15+e.x,d=rise*(2.2+n%5*.7)*e.radius*.28,up=(1-rise)*6+Math.sin(n)*2;
            this.place(this.rocks,this.bump(this.rocks),x+Math.cos(a)*d,h+.4+up,z+Math.sin(a)*d,.35+n%3*.12,.28,.35+n%3*.12,rise*3,a,rise,0x6a4a38);
            this.place(this.embers,this.bump(this.embers),x+Math.cos(a+1)*d*1.2,h+up*1.4,z+Math.sin(a+1)*d*1.2,.8,.8,.8,0,0,0,n%2?0xffd27a:0xff6d2e);
          }
          const burst=Math.max(0,1-Math.abs(p-.58)*8);
          light+=burst*42+rise*8;lightColor=0xffb060;lx=x;ly=h+3;lz=z;
          if(burst>.4){this.flash=Math.max(this.flash,burst*.55);this.shake=Math.max(this.shake,burst*1.1);}
        } else {light+=2+fall*6;lightColor=0xff8a3a;lx=mx;ly=my;lz=mz;}
      } else if(e.kind==='lightning') {
        const strike=Math.min(1,p/.18),fade=p>.22?easeOut((p-.22)/.78):0,alive=1-fade*.85;
        bolts=this.drawBolt(bolts,x,h+38,z,x,h+.2,z,9,1.15,e.x*3.1,alive);
        for(let b=0;b<3;b++) {
          const mid=.35+b*.18,bx=x+(hash(e.x*10+b)-.5)*7,bz=z+(hash(e.y*10+b)-.5)*7;
          const sx=mix(x,x,mid)+ (hash(20+b)-.5)*.4,sy=mix(h+38,h+.2,mid),sz=mix(z,z,mid);
          bolts=this.drawBolt(bolts,sx,sy,sz,bx,h+.4+b*.3,bz,5,.7,e.y+b*8,alive*.8);
        }
        this.place(this.cores,this.bump(this.cores),x,h+mix(20,2,strike),z,.35,.9,.35,0,0,0,0xf5fbff);
        this.place(this.glows,this.bump(this.glows),x,h+1.2,z,2.2+strike*3,4+strike*6,2.2+strike*3,0,0,0,0xd7eeff);
        this.place(this.rings,this.bump(this.rings),x,h+.18,z,e.radius*(.6+fade*3.4),e.radius*(.6+fade*3.4),e.radius*(.6+fade*3.4),-Math.PI/2,0,0,0xeaf4ff);
        for(let n=0;n<14;n++) {
          const a=n*2.3,d=fade*(1.4+n%4)*.9;
          this.place(this.embers,this.bump(this.embers),x+Math.cos(a)*d,h+.5+fade*3+n%3*.4,z+Math.sin(a)*d,.5,.5,.5,0,0,0,n%2?0xffffff:0x9fd6ff);
        }
        const burst=Math.max(0,1-Math.abs(p-.12)*10);
        light+=burst*70+alive*6;lightColor=0xdef2ff;lx=x;ly=h+6;lz=z;
        if(burst>.35){this.flash=Math.max(this.flash,burst*.85);this.shake=Math.max(this.shake,burst*.55);}
      } else if(e.kind==='rain') {
        for(let n=0;n<90&&rain<900;n++) {
          const seed=hash(Math.floor(e.x*9)+n*17),spin=n*2.07+clock*1.4;
          const px=x+Math.sin(spin)*e.radius*(.2+seed),pz=z+Math.cos(spin*.83)*e.radius*(.25+hash(n+3));
          const fall=((n*.31+p*11+seed*4)%7);
          const py=h+7.5-fall,len=.85+seed*.5;
          this.rainPoints.set([px,py,pz,px-.05,py-len,pz+.04],rain++*6);
          if(fall>6.2)this.place(this.rings,this.bump(this.rings),px,h+.16,pz,.25+p*.2,.25+p*.2,.25+p*.2,-Math.PI/2,0,0,0xb7e7f4);
        }
        this.place(this.glows,this.bump(this.glows),x,h+4,z,e.radius*1.1,2.4,e.radius*1.1,0,0,0,0x7fb8c8);
        light+=1.4;lightColor=0xa6d4e6;lx=x;ly=h+8;lz=z;
      } else if(e.kind==='ignite') {
        const puff=easeOut(p);
        for(let n=0;n<16;n++) {
          const a=n*2.4+e.x,d=puff*(.6+n%4*.25);
          this.place(this.embers,this.bump(this.embers),x+Math.cos(a)*d,h+.4+puff*2.2,z+Math.sin(a)*d,.7,.7,.7,0,0,0,n%2?0xffd56a:0xff5e24);
        }
        this.place(this.glows,this.bump(this.glows),x,h+1,z,1.6+puff*2,1.2+puff,1.6+puff*2,0,0,0,0xff8a3c);
        light+= (1-p)*10;lightColor=0xff8a40;lx=x;ly=h+2;lz=z;
      } else if(e.kind==='spore') {
        const puff=easeOut(p);
        this.place(this.glows,this.bump(this.glows),x,h+1.1,z,1.2+puff*2,1+puff,1.2+puff*2,0,0,0,0xd5efba);
        this.place(this.rings,this.bump(this.rings),x,h+.2,z,.8+puff*2.2,.8+puff*2.2,.8+puff*2.2,-Math.PI/2,0,0,0xc8acec);
      }
    }
    this.light.position.set(lx,ly,lz);this.light.intensity=light;this.light.color.setHex(lightColor);
    this.light.distance=light>20?110:70;
    this.bolts.visible=bolts>0;this.boltGeo.setDrawRange(0,bolts*2);this.boltGeo.attributes.position.needsUpdate=true;
    this.rain.visible=rain>0;this.rainGeo.setDrawRange(0,rain*2);this.rainGeo.attributes.position.needsUpdate=true;
    this.finish();
  }
  syncClips(delta) {
    const duration={meteor:2.5,lightning:1.65,rain:2.4,ignite:1.2,spore:1.35};
    for(const e of this.r.world.effects) {
      if(!duration[e.kind]||this.seen.has(e.id??`${e.kind}:${e.x}:${e.y}`))continue;
      this.seen.add(e.id??`${e.kind}:${e.x}:${e.y}`);
      this.clips.push({kind:e.kind,x:e.x,y:e.y,radius:e.radius,t:0,duration:duration[e.kind]});
    }
    const step=Math.min(.05,delta);
    for(const clip of this.clips)clip.t+=step;
    this.clips=this.clips.filter(c=>c.t<c.duration);
  }
  fireField(clock) {
    const w=this.r.world;let wisps=0,embers=0,smoke=0;
    for(let i=0;i<w.fire.length&&wisps<1800;i++) if(w.fire[i]>0) {
      const x=i%w.width,y=Math.floor(i/w.width),wx=x-w.width/2+.5,wz=y-w.height/2+.5,h=tileHeight(w,x,y);
      const heat=Math.min(1,w.fire[i]/6),flick=Math.sin(clock*14+i)*.18,hgt=1.1+heat*.8+flick;
      this.place(this.wisps,wisps++,wx,h+hgt*.55,wz,.7+heat*.4,hgt, .7+heat*.4,flick*.4,i,0,i%2?0xffe08a:0xff6a2b);
      if(smoke<900&&i%2===0) {
        const up=(clock*.55+hash(i)*4)%3.4;
        this.place(this.smoke,smoke++,wx+(hash(i+3)-.5)*.6,h+1.2+up*2.1,wz+(hash(i+9)-.5)*.6,.8+up*.7,1+up*.8,.8+up*.7,0,0,0,0x5c5048);
      }
      if(embers<2100) for(let n=0;n<3;n++) {
        const seed=hash(i*13+n*7),rise=(clock*1.3+seed*5+n)%2.6;
        this.place(this.embers,embers++,wx+(seed-.5)*1.1,h+.3+rise*2.8,wz+(hash(i+n)-.5)*1.1,.45+seed*.3,.45,.45,0,0,0,n?0xffd36a:0xff5a20);
      }
    }
    this.counts.set(this.wisps,wisps);this.counts.set(this.embers,embers);this.counts.set(this.smoke,smoke);
  }
  drawBolt(index,ax,ay,az,bx,by,bz,segs,jag,seed,alpha) {
    let px=ax,py=ay,pz=az;
    for(let i=1;i<=segs&&index<900;i++) {
      const t=i/segs,nx=mix(ax,bx,t),ny=mix(ay,by,t),nz=mix(az,bz,t);
      const o=i===segs?0:(hash(seed+i*19)-.5)*jag*2;
      const qx=nx+o,qy=ny,qz=nz+(hash(seed+i*7)-.5)*jag*2;
      this.boltPoints.set([px,py,pz,qx,qy,qz],index++*6);
      if(alpha>.55&&i<segs)this.place(this.embers,this.bump(this.embers),qx,qy,qz,.28,.28,.28,0,0,0,0xffffff);
      px=qx;py=qy;pz=qz;
    }
    return index;
  }
  dispose() {
    this.r.scene.remove(this.group);
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps])mesh.dispose();
    this.boltGeo.dispose();this.rainGeo.dispose();
    for(const m of [this.glowMat,this.emberMat,this.smokeMat,this.rockMat,this.coreMat,this.ringMat,this.wisps.material,this.bolts.material,this.rain.material])m.dispose();
  }
}
