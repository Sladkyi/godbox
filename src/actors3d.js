import * as THREE from 'three';
import { RACES, RESOURCES, STOCKS, cargoCount } from './civilizations.js';
import { samplePose, WORK_ACTIONS } from './animation.js';
import { tileHeight } from './terrain3d.js';

const FIGURE = .48;

export class Actors3D {
  constructor(renderer) {
    this.r=renderer;this.group=new THREE.Group();renderer.scene.add(this.group);this.state=new Map();
    const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,flatShading:true});
    const glow=new THREE.MeshBasicMaterial({color:0xffffff});
    this.meshes={};this.counts={};this.materials=[mat,glow];
    const specs={box:[new THREE.BoxGeometry(1,1,1),mat,24000],round:[new THREE.SphereGeometry(.5,8,6),mat,8000],limb:[new THREE.CylinderGeometry(.5,.5,1,5),mat,28000],cap:[new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),mat,2500],glow:[new THREE.SphereGeometry(.5,6,4),glow,10000]};
    for(const [name,[geometry,material,max]]of Object.entries(specs))this.meshes[name]=renderer.instances(geometry,material,max,name!=='glow',this.group);
    this.matrix=new THREE.Object3D();this.color=new THREE.Color();this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);
  }
  part(kind,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0) {
    const index=this.counts[kind]++,mesh=this.meshes[kind];if(index>=mesh.instanceMatrix.count)return;
    this.matrix.position.set(x,y,z);this.matrix.scale.set(sx,sy,sz);this.matrix.rotation.set(rx,ry,rz);this.matrix.updateMatrix();mesh.setMatrixAt(index,this.matrix.matrix);mesh.setColorAt(index,this.color.set(color));
  }
  segment(a,b,width,color,kind='limb') {
    const i=this.counts[kind]++,mesh=this.meshes[kind];if(i>=mesh.instanceMatrix.count)return;
    this.a.set(...a);this.b.set(...b);const length=this.a.distanceTo(this.b);
    this.matrix.position.copy(this.a).add(this.b).multiplyScalar(.5);this.matrix.scale.set(width,length,width);
    this.matrix.quaternion.setFromUnitVectors(this.up,this.b.sub(this.a).normalize());this.matrix.updateMatrix();mesh.setMatrixAt(i,this.matrix.matrix);mesh.setColorAt(i,this.color.set(color));
  }
  update(time,delta) {
    const r=this.r,w=r.world,alive=new Set();for(const key of Object.keys(this.meshes))this.counts[key]=0;
    for(const u of w.units) {
      alive.add(u.id);let state=this.state.get(u.id);
      if(!state){state={x:u.x,y:u.y,angle:0,hp:u.hp,hit:0};this.state.set(u.id,state);}
      const targetAngle=Math.atan2(u.tx-u.x,u.ty-u.y),turning=u.action==='cheer'||Math.hypot(u.tx-u.x,u.ty-u.y)>.12;
      if(turning){const diff=Math.atan2(Math.sin(targetAngle-state.angle),Math.cos(targetAngle-state.angle));state.angle+=diff*Math.min(1,delta*16);}
      const blend=delta===0?0:Math.min(1,delta*20);state.x+=(u.x-state.x)*blend;state.y+=(u.y-state.y)*blend;
      if(Math.hypot(u.x-state.x,u.y-state.y)>5){state.x=u.x;state.y=u.y;}
      if(u.hp<state.hp)state.hit=.4;state.hp=u.hp;state.hit=Math.max(0,state.hit-delta);
      const x=state.x-w.width/2,z=state.y-w.height/2,h=tileHeight(w,state.x,state.y),angle=state.angle;
      if(u.kind!=='human'){this.animal(u,x,h,z,angle,time);continue;}
      const race=RACES[u.race??'human'],p=samplePose(u,time),size=(u.age<18?.67:1)*FIGURE*(u.race==='dwarf'?.82:1);
      const co=Math.cos(angle),si=Math.sin(angle),pos=(v)=>[x+(v[0]*co+v[2]*si)*size,h+(v[1]+p.bob)*size,z+(-v[0]*si+v[2]*co)*size];
      const coat=state.hit>0?'#fff0d2':race.coat,skin=state.hit>0?'#fff4df':race.skin;
      const stout=u.race==='dwarf'?1.22:1;
      const body=pos(p.body),head=pos(p.head);this.part('box',...body,.5*size*stout,.65*size,.4*size*stout,coat,p.lean,angle);
      const village=w.villages.find(v=>v.id===u.villageId);this.part('box',...pos([0,p.body[1]+.12,.2]),.37*size,.13*size,.045*size,village?.color??race.color,p.lean,angle);
      const mark={scout:'#7ee0d8',defend:'#ffb078',steal:'#f08a8a',hunt:'#ed839d',flee:'#e7f0b4',patrol:'#c9d6ea',siege:'#ff6b5a',cheer:'#ffe08a',cart:'#f0c86a'}[u.action];
      if(mark)this.part('glow',x,h+.04,z,.52+Math.sin(time*4+u.id)*.07,.04,.52,mark);
      this.part(u.race==='alien'?'round':'box',...head,(u.race==='alien'?.72:u.race==='dwarf'?.52:.44)*size,(u.race==='alien'?.69:.44)*size,.43*size,skin,p.resting?Math.PI/2:0,angle+p.headTurn);
      if(u.race==='dwarf')this.part('box',...pos([0,1.42,.18]),.42*size,.22*size,.22*size,'#6a4a32',0,angle);
      for(const sign of [-1,1]) {
        const shoulder=pos([sign*.3,p.body[1]+.2,0]),hand=pos(sign<0?p.leftHand:p.rightHand);
        const elbow=[(shoulder[0]+hand[0])/2+sign*.06,(shoulder[1]+hand[1])/2-.08,(shoulder[2]+hand[2])/2];
        this.segment(shoulder,elbow,.17*size,coat);this.segment(elbow,hand,.13*size,skin);this.part('round',...hand,.16*size,.16*size,.16*size,skin);
        const hip=pos([sign*.16,p.resting?.25:.73,0]),foot=pos(sign<0?p.leftFoot:p.rightFoot);
        const knee=[(hip[0]+foot[0])/2,(hip[1]+foot[1])/2,(hip[2]+foot[2])/2+(p.resting?0:.06)];
        this.segment(hip,knee,.19*size,coat);this.segment(knee,foot,.16*size,'#394352');this.part('box',...foot,.2*size,.14*size,.3*size,'#303847',0,angle);
      }
      if(u.race==='ghoul') {
        this.part('box',...pos([0,1.76,-.03]),.5*size,.15*size,.44*size,'#e8e7e0',0,angle);
        this.part('box',...pos([0,1.43,.22]),.44*size,.16*size,.06*size,'#1c2431',0,angle);
        this.part('glow',...pos([.11,1.57,.24]),.095*size,.07*size,.045*size,'#ff284d');
        for(let arm=0;arm<4;arm++){
          const sign=arm<2?-1:1,lift=arm%2,active=WORK_ACTIONS.includes(u.action)||u.action==='defend'||u.action==='hunt';
          let previous=pos([sign*.15,1,-.17]);
          for(let j=1;j<=5;j++){const f=j/5,reach=active?1.45:.85;const next=pos([sign*(.18+f*reach),1+Math.sin(f*2.5+time*3+arm)*.25+lift*f*.65,-.15-f*.5+Math.sin(time*3+arm)*f*.2]);this.segment(previous,next,(.16-f*.1)*size,j<3?'#9e2452':'#ee426c');previous=next;}
        }
      } else if(u.race==='alien') {
        for(const sign of [-1,1])this.part('box',...pos([sign*.16,1.56,.2]),.18*size,.16*size,.1*size,'#172a3d',0,angle,sign*.25);
        this.segment(pos([0,1.85,0]),pos([0,2.08,0]),.04*size,'#759ca7');this.part('glow',...pos([0,2.12,0]),.14*size,.14*size,.14*size,'#86fff4');
      } else if(u.race==='mycelite') {
        this.part('cap',...pos([0,1.68,0]),.65*size,.48*size,.6*size,'#ac6dab',0,angle);
        for(let i=0;i<4;i++){const a=i*2.4;this.part('glow',...pos([Math.cos(a)*.35,1.95,Math.sin(a)*.28]),.12*size,.04*size,.12*size,'#f3dca2');}
        this.part('glow',...pos([Math.sin(time*2+u.id)*.65,2.05+Math.sin(time+u.id)*.3,-.1]),.06,.06,.06,'#d5efba');
      } else if(u.race==='dwarf') {
        this.part('box',...pos([0,1.76,0]),.56*size,.2*size,.5*size,u.job==='miner'?'#bcbaca':u.job==='guard'?'#97acbf':'#6a5340',0,angle);
        this.part('box',...pos([0,1.86,0]),.62*size,.08*size,.54*size,'#8a7358',0,angle);
      } else {
        const hats={farmer:'#e8cd79',woodcutter:'#af8157',builder:'#ebc168',guard:'#97acbf',miner:'#bcbaca',mason:'#b0bfc2',crystalist:'#83d9e0',potter:'#c38d73',mycologist:'#bc93d5',fisher:'#769cb2',herder:'#d4b56a'};
        this.part('box',...pos([0,1.8,0]),.5*size,.13*size,.46*size,hats[u.job]??'#796751',0,angle);
        if(u.job==='farmer'||u.job==='fisher'||u.job==='herder')this.part('box',...pos([0,1.76,0]),.73*size,.05*size,.65*size,hats[u.job],0,angle);
      }
      const carrying=cargoCount(u)>0||u.action==='cart';
      if(carrying){const key=STOCKS.find(k=>u.inventory[k]>0)??u.task?.good,c=RESOURCES[key]?.color??'#d9c976';this.part('box',...pos([0,1,-.36]),.43*size,.48*size,.34*size,'#665744',0,angle);this.part('round',...pos([0,1.3,-.35]),.4*size,.2*size,.33*size,c);}
      if(u.action==='cart'){
        this.part('box',...pos([0,.55,-.85]),.78*size,.32*size,1.05*size,'#6a5138',0,angle);
        this.part('box',...pos([0,.82,-.82]),.52*size,.24*size,.58*size,RESOURCES[u.task?.good]?.color??'#d9c976',0,angle);
        for(const side of [-1,1]){this.part('round',...pos([side*.42,.22,-.48]),.2*size,.2*size,.2*size,'#3a3228',Math.PI/2,angle);this.part('round',...pos([side*.42,.22,-1.12]),.2*size,.2*size,.2*size,'#3a3228',Math.PI/2,angle);}
      }
      if(p.tool)this.tool(u,p,pos,size,time);
      if(u.race==='alien'&&!p.moving&&WORK_ACTIONS.includes(u.action)) {
        const start=pos([.5,1.15,.5]),target=pos([.2,.1,.9]);this.segment(start,target,.025,'#8cf8f4','glow');this.part('glow',...target,.12,.12,.12,'#ceffff');
      }
      if(p.impact>.6&&!p.moving)for(let n=0;n<4;n++){const f=(time*3+n*.23)%1,at=pos([.1+Math.cos(n*4)*f*.6,.25+Math.sin(f*Math.PI)*.7,.7+Math.sin(n*3)*f*.3]);this.part('glow',...at,.06,.06,.06,u.action==='mine'?'#ece7b5':'#c7a578');}
      if(p.resting){for(let n=0;n<2;n++){const f=(time*.45+n*.5)%1;this.part('glow',...pos([.25+f*.2,.9+f,.5]),.08,.06,.08,'#bedbe6');}}
      if(u.action==='socialize'&&!p.moving){const at=pos([.6,1.95+Math.sin(time*4)*.06,0]);this.part('round',...at,.4,.23,.13,'#f0e8ce');for(let n=0;n<3;n++)this.part('box',at[0]-.1+n*.1,at[1],at[2]+.07,.035,.035,.02,'#586961');}
      if(u.action==='cheer'||u.action==='dance'){
        const color=u.action==='dance'?'#ffe08a':(RESOURCES[u.task?.depositKind]?.color??'#ffe08a');
        for(let n=0;n<5;n++){const f=(time*2.4+n*.18+u.id)%1;this.part('glow',...pos([(n%2?1:-1)*(.25+f*.45),1.55+f*.9,.15]),.07+f*.04,.07,.07,color);}
      }
      if(u.action==='marvel'&&!p.moving){
        for(let n=0;n<4;n++){const f=(time*1.4+n*.2+u.id)%1;this.part('glow',...pos([(n%2?.4:-.4)*f,1.8+f*1.1,.1]),.06,.06,.06,n%2?'#7ff0d2':'#c8a0ff');}
      }
    }
    for(const cart of w.caravans??[]) {
      const x=cart.x-w.width/2,z=cart.y-w.height/2,h=tileHeight(w,cart.x,cart.y);
      const angle=Math.atan2(cart.bx-cart.ax,cart.by-cart.ay);
      const co=Math.cos(angle),si=Math.sin(angle),p=(dx,dy,dz)=>[x+(dx*co+dz*si),h+dy,z+(-dx*si+dz*co)];
      const load=RESOURCES[cart.good]?.color??'#d9c976';
      this.part('box',...p(0,.4,0),.78,.3,1.05,'#6a5138',0,angle);
      this.part('box',...p(0,.62,.05),.55,.24,.62,load,0,angle);
      this.part('box',...p(0,.48,.58),.16,.08,.32,'#4a3a28',0,angle);
      for(const side of [-1,1]){this.part('round',...p(side*.4,.2,.32),.22,.22,.22,'#3a3228',Math.PI/2,angle);this.part('round',...p(side*.4,.2,-.32),.22,.22,.22,'#3a3228',Math.PI/2,angle);}
      if(cart.blessed)this.part('glow',...p(0,.95,0),.28,.08,.28,'#ffe08a');
    }
    for(const id of this.state.keys())if(!alive.has(id))this.state.delete(id);
    for(const [kind,mesh]of Object.entries(this.meshes))this.r.finishInstances(mesh,Math.min(this.counts[kind],mesh.instanceMatrix.count));
  }
  tool(u,p,pos,size,time) {
    const hand=p.rightHand,point=(v)=>pos([hand[0]+v[0],hand[1]+v[1],hand[2]+v[2]]);
    if(p.tool==='food'){this.part('round',...point([0,.08,.05]),.18,.15,.18,'#d3b771');return;}
    if(p.tool==='crate'){this.part('box',...pos([0,.66,.65]),.55,.42,.4,'#b28a5d');return;}
    const length=p.tool==='rod'?1.7:p.tool==='spear'?1.3:.72;
    const end=point([0,length*.75,.2-length*.5]);this.segment(point([0,-.18,.05]),end,.055*size,u.race==='alien'?'#8eb5c6':'#8b694e');
    if(p.tool==='rod'){this.segment(end,point([0,-hand[1]+.18,1.7]),.012,'#d8ecdc');this.part('glow',...point([0,-hand[1]+.2+Math.sin(time*5)*.03,1.7]),.12,.09,.12,'#f2c27c');}
    else this.part('box',...end,(p.tool==='pick'?.52:.3)*size,.12*size,.15*size,u.race==='alien'?'#6ce7f0':'#c1cbd0',0,this.state.get(u.id).angle);
  }
  animal(u,x,h,z,angle,time) {
    const co=Math.cos(angle),si=Math.sin(angle),moving=Math.hypot(u.tx-u.x,u.ty-u.y)>.15,attack=(u.animAttack??0)>0;
    const cow=u.kind==='cow',size=FIGURE*(cow?1.28:1);
    const p=(dx,dy,dz)=>[x+(dx*co+dz*si)*size,h+dy*size,z+(-dx*si+dz*co)*size];
    const bob=moving?Math.abs(Math.sin(time*10+u.id))*.06:0;
    const body=u.kind==='sheep'?'#eee9d2':cow?'#8a6238':'#778795';
    this.part('round',...p(0,.53+bob,attack?.15:0),(cow?.85:.75)*size,(cow?.72:.68)*size,(cow?1.35:1.1)*size,body,0,angle);
    const grazing=!moving&&u.kind!=='wolf';this.part('box',...p(0,grazing?.24:.67+bob,.57),(cow?.38:.32)*size,.37*size,.4*size,u.kind==='sheep'?'#887557':cow?'#5c3d24':'#445668',grazing?.6:attack?-.35:0,angle);
    for(const side of [-1,1])for(const front of [-1,1]){const step=moving?Math.sin(time*10+u.id+(side===front?0:Math.PI))*.2:0;this.segment(p(side*.25,.5+bob,front*.35),p(side*.25,.08,front*.35+step),.12*size,cow?'#4a3424':'#394753');}
    if(u.kind==='sheep')for(const side of [-1,1])this.part('box',...p(side*.2,.89+bob,.53),.13*size,.19*size,.13*size,'#ad977e',0,angle,side*.4);
    if(cow)for(const side of [-1,1])this.part('box',...p(side*.22,.92+bob,.5),.08*size,.22*size,.08*size,'#efe6d4',0,angle,side*.55);
    this.segment(p(0,.62,-.5),p(Math.sin(time*5)*.15,.7,-.86),.1*size,body);
  }
}
