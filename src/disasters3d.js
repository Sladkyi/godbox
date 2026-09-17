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
    this.dropMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62,depthWrite:false});
    this.flakeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false});
    this.sheetMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,blending:add,depthWrite:false,side:THREE.DoubleSide});
    this.glows=r.instances(new THREE.SphereGeometry(1,10,8),this.glowMat,140,false,this.group);
    this.embers=r.instances(new THREE.SphereGeometry(.12,6,4),this.emberMat,2800,false,this.group);
    this.smoke=r.instances(new THREE.SphereGeometry(.7,7,5),this.smokeMat,1100,false,this.group);
    this.rocks=r.instances(new THREE.IcosahedronGeometry(.55,0),this.rockMat,48,true,this.group);
    this.cores=r.instances(new THREE.SphereGeometry(.45,8,6),this.coreMat,36,false,this.group);
    this.rings=r.instances(new THREE.RingGeometry(.55,1,40),this.ringMat,72,false,this.group);
    this.wisps=r.instances(new THREE.ConeGeometry(.22,1.4,5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.55,blending:add,depthWrite:false}),1800,false,this.group);
    this.drops=r.instances(new THREE.BoxGeometry(.04,1,.04),this.dropMat,4800,false,this.group);
    this.flakes=r.instances(new THREE.BoxGeometry(.18,.035,.18),this.flakeMat,3200,false,this.group);
    this.sheets=r.instances(new THREE.PlaneGeometry(1,1),this.sheetMat,48,false,this.group);
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps,this.drops,this.flakes,this.sheets])mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*3),3);
    this.boltPoints=new Float32Array(900*6);
    this.boltGeo=new THREE.BufferGeometry();this.boltGeo.setAttribute('position',new THREE.BufferAttribute(this.boltPoints,3));
    this.bolts=new THREE.LineSegments(this.boltGeo,new THREE.LineBasicMaterial({color:0xf4fbff,transparent:true,opacity:1,blending:add,depthWrite:false}));
    this.bolts.frustumCulled=false;this.bolts.renderOrder=30;this.group.add(this.bolts);
    this.light=new THREE.PointLight(0xffe0a8,0,90,1.7);this.group.add(this.light);
  }
  place(mesh,i,x,y,z,sx,sy,sz,rx,ry,rz,color) {
    if(i>=mesh.instanceMatrix.count)return i;
    this.obj.position.set(x,y,z);this.obj.scale.set(sx,sy,sz);this.obj.rotation.set(rx,ry,rz);this.obj.updateMatrix();
    mesh.setMatrixAt(i,this.obj.matrix);if(color!=null)mesh.setColorAt(i,this.color.set(color));return i+1;
  }
  finish() {
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps,this.drops,this.flakes,this.sheets])this.r.finishInstances(mesh,Math.min(this.counts.get(mesh)??0,mesh.instanceMatrix.count));
  }
  count(mesh) { return this.counts.get(mesh)??0; }
  bump(mesh) { const n=this.count(mesh); this.counts.set(mesh,n+1); return n; }
  update(clock,delta) {
    const now=performance.now(),wall=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):.016;this.lastTime=now;
    this.syncClips(wall);
    const w=this.r.world;this.counts=new Map();this.flash=Math.max(0,this.flash-wall*2.4);this.shake=Math.max(0,this.shake-wall*3.2);
    let bolts=0,light=0,lightColor=0xffe6b0,lx=0,ly=8,lz=0;
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
      } else if(e.kind==='rain'||e.kind==='storm') {
        this.drawRain(x,z,h,e.radius,clock,p,e.kind==='storm',e.x);
        if(e.kind==='storm'&&p<.4) {
          const burst=Math.max(0,1-Math.abs(p-.12)*9);
          bolts=this.drawBolt(bolts,x+(hash(e.x)-.5)*e.radius*.4,h+34,z,x,h+.2,z,8,1.2,e.x+clock,1-p);
          light+=burst*36+4;lightColor=0xd8eef8;lx=x;ly=h+8;lz=z;
          if(burst>.45){this.flash=Math.max(this.flash,burst*.5);this.shake=Math.max(this.shake,burst*.35);}
        } else if(light<2){light+=e.kind==='storm'?1.4:.7;lightColor=e.kind==='storm'?0x8fb4c8:0xa6d4e6;lx=x;ly=h+8;lz=z;}
      } else if(e.kind==='blizzard') {
        this.drawSnow(x,z,h,e.radius,clock,p,e.x);
        if(light<2){light+=.8;lightColor=0xcfe4f0;lx=x;ly=h+7;lz=z;}
      } else if(e.kind==='aurora') {
        this.drawAurora(x,z,h,e.radius,clock,e.x);
        if(light<3){light+=2.6;lightColor=0xa8fff0;lx=x;ly=h+10;lz=z;}
      } else if(e.kind==='bloom') {
        this.drawBloom(x,z,h,e.radius,clock,p,e.y);
        if(light<2){light+=1.2;lightColor=0xe8f6b0;lx=x;ly=h+4;lz=z;}
      } else if(e.kind==='drought') {
        this.drawDrought(x,z,h,e.radius,clock,e.x);
        if(light<1){light+=.5;lightColor=0xe0c080;lx=x;ly=h+5;lz=z;}
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
    const field=this.weatherField(clock,bolts,light,lightColor,lx,ly,lz);
    bolts=field.bolts;light=field.light;lightColor=field.lightColor;lx=field.lx;ly=field.ly;lz=field.lz;
    this.light.position.set(lx,ly,lz);this.light.intensity=light;this.light.color.setHex(lightColor);
    this.light.distance=light>20?110:70;
    this.bolts.visible=bolts>0;this.boltGeo.setDrawRange(0,bolts*2);this.boltGeo.attributes.position.needsUpdate=true;
    this.finish();
  }
  scatter(seed,n,radius) {
    const u=hash(seed+n*17),v=hash(seed+n*31+9);
    const a=u*Math.PI*2,r=Math.sqrt(v)*radius;
    return [Math.cos(a)*r,Math.sin(a)*r,u];
  }
  drawRain(x,z,h,radius,clock,p,storm,seed=0) {
    const count=storm?420:300,slant=storm?.52:.14,fallSpan=storm?10:8.2,lenBase=storm?1.55:1.05,speed=storm?11:7;
    for(let n=0;n<count;n++) {
      const [dx,dz,s]=this.scatter(Math.floor(seed*11),n,radius);
      const drift=clock*(storm?1.6:.32);
      const fall=(n*.37+p*10+s*5+clock*speed)%fallSpan;
      const px=x+dx+drift,pz=z+dz+drift*.35,py=h+9.2-fall,len=lenBase+s*.7;
      this.place(this.drops,this.bump(this.drops),px,py,pz,storm?1.15:.9,len,storm?1.15:.9,slant,0,0,storm?0x8fb4c6:0xb4deee);
    }
    for(let n=0;n<6;n++) {
      const [dx,dz,s]=this.scatter(seed+40,n,radius*.85);
      this.place(this.smoke,this.bump(this.smoke),x+dx,h+.28+s*.12,z+dz,2.6,.16,2.6,0,0,0,storm?0x4e6874:0x7a9aa8);
    }
  }
  drawSnow(x,z,h,radius,clock,p,seed=0) {
    for(let n=0;n<260;n++) {
      const [dx,dz,s]=this.scatter(Math.floor(seed*7)+n,n,radius);
      const sway=Math.sin(clock*.9+n)*.55,fall=(n*.28+clock*2.4+s*8)%11;
      const px=x+dx+sway+clock*.35,pz=z+dz+Math.cos(clock*.7+n)*.4,py=h+10-fall;
      const spin=clock*1.4+n,size=.55+s*.7;
      this.place(this.flakes,this.bump(this.flakes),px,py,pz,size,.7+s,size,spin,spin*.6,0,n%4?0xeef6fb:0xd5e6f0);
    }
    for(let n=0;n<5;n++) {
      const [dx,dz]=this.scatter(seed+90,n,radius*.7);
      this.place(this.smoke,this.bump(this.smoke),x+dx,h+.22,z+dz,2.8,.14,2.8,0,0,0,0xc5d6e0);
    }
  }
  drawAurora(x,z,h,radius,clock,seed=0) {
    for(let n=0;n<8;n++) {
      const a=n*.79+clock*.12,px=x+Math.sin(a)*radius*.62,pz=z+Math.cos(a*.72)*radius*.5;
      const hue=n%3===0?0x7a6cff:n%2?0x4ee8c4:0xc8a0ff;
      const hgt=8.5+Math.sin(clock*.65+n)*2.6;
      this.place(this.sheets,this.bump(this.sheets),px,h+hgt*.52,pz,radius*.42,hgt,1,0,a,Math.sin(clock*.4+n)*.12,hue);
      this.place(this.wisps,this.bump(this.wisps),px,h+hgt*.5,pz,.28,hgt, .28,0,a,0,hue);
    }
  }
  drawBloom(x,z,h,radius,clock,p,seed=0) {
    for(let n=0;n<90;n++) {
      const [dx,dz,s]=this.scatter(Math.floor(seed*5)+n,n,radius);
      const rise=(n*.21+clock*1.5+s*4)%5.2;
      const size=.28+s*.22;
      this.place(this.flakes,this.bump(this.flakes),x+dx,h+.18+rise,z+dz,size,.5,size,clock+n,n,0,n%3?0xffd98a:0xa8e878);
    }
  }
  drawDrought(x,z,h,radius,clock,seed=0) {
    for(let n=0;n<8;n++) {
      const a=n*1.7+clock*.18,s=hash(n*21+seed);
      this.place(this.smoke,this.bump(this.smoke),x+Math.cos(a)*radius*.55,h+.18+s*.1,z+Math.sin(a)*radius*.55,2.2,.12,2.2,0,0,0,0xc8b080);
    }
  }
  weatherField(clock,bolts,light,lightColor,lx,ly,lz) {
    const w=this.r.world;
    for(const field of w.weather??[]) {
      const x=field.x-w.width/2,z=field.y-w.height/2,h=tileHeight(w,field.x,field.y),p=1-field.life/field.total;
      if(field.kind==='rain'||field.kind==='storm') {
        this.drawRain(x,z,h,field.radius,clock,p,field.kind==='storm',field.x+field.y);
        if(field.kind==='storm'&&hash(Math.floor(clock*3)+field.x)>.82) {
          const bx=x+(hash(field.y+Math.floor(clock))- .5)*field.radius*.7,bz=z+(hash(field.x)-.5)*field.radius*.7;
          bolts=this.drawBolt(bolts,bx,h+32,bz,bx,h+.2,bz,7,1.1,clock*8, .85);
          light+=18;lightColor=0xd4eefe;lx=bx;ly=h+7;lz=bz;
          this.flash=Math.max(this.flash,.28);this.shake=Math.max(this.shake,.18);
        } else if(light<2){light+=field.kind==='storm'?1.1:.55;lightColor=field.kind==='storm'?0x8fb4c8:0xa6d4e6;lx=x;ly=h+8;lz=z;}
      } else if(field.kind==='blizzard') {
        this.drawSnow(x,z,h,field.radius,clock,p,field.x);
        if(light<2){light+=.7;lightColor=0xcfe4f0;lx=x;ly=h+6;lz=z;}
      } else if(field.kind==='aurora') {
        this.drawAurora(x,z,h,field.radius,clock,field.x);
        if(light<3){light+=2.4;lightColor=0xb4fff0;lx=x;ly=h+11;lz=z;}
      } else if(field.kind==='bloom') {
        this.drawBloom(x,z,h,field.radius,clock,p,field.y);
        if(light<2){light+=1;lightColor=0xeaf6b4;lx=x;ly=h+3;lz=z;}
      } else if(field.kind==='drought') {
        this.drawDrought(x,z,h,field.radius,clock,field.x);
        if(light<1){light+=.4;lightColor=0xe0c080;lx=x;ly=h+4;lz=z;}
      }
    }
    return {bolts,light,lightColor,lx,ly,lz};
  }
  syncClips(delta) {
    const duration={meteor:2.5,lightning:1.65,rain:3.6,storm:3.8,blizzard:3.4,aurora:4.4,bloom:3.6,drought:2.8,ignite:1.2,spore:1.35};
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
    for(const mesh of [this.glows,this.embers,this.smoke,this.rocks,this.cores,this.rings,this.wisps,this.drops,this.flakes,this.sheets])mesh.dispose();
    this.boltGeo.dispose();
    for(const m of [this.glowMat,this.emberMat,this.smokeMat,this.rockMat,this.coreMat,this.ringMat,this.wisps.material,this.bolts.material,this.dropMat,this.flakeMat,this.sheetMat])m.dispose();
  }
}
