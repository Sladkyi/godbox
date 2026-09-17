export const WORK_ACTIONS=['chop','mine','dig','farm','forage','cultivate','build','fish'];
const mix=(a,b,t)=>a+(b-a)*t;

// A small procedural rig: every activity has a pose, not just a vertical bounce.
export function samplePose(u,time) {
  const moving=u.action!=='cheer'&&u.action!=='dance'&&u.action!=='marvel'&&((u.path?.length??0)>0||Math.hypot(u.tx-u.x,u.ty-u.y)>.25);
  const action=moving?'walk':u.action??'idle',phase=time*(u.action==='flee'?13:8)+u.id*1.71;
  const stride=moving?Math.sin(phase):0,breathe=Math.sin(time*2.3+u.id)*.025;
  const p={action,moving,bob:moving?Math.abs(Math.sin(phase))*.065:breathe,lean:u.action==='flee'?-.27:0,headTurn:moving?0:Math.sin(time*.8+u.id)*.16,
    head:[0,1.54,0],body:[0,1.04,0],leftHand:[-.4,.78,stride*.23],rightHand:[.4,.78,-stride*.23],
    leftFoot:[-.17,.09,-stride*.3],rightFoot:[.17,.09,stride*.3],tool:null,impact:0,resting:false};
  if(action==='walk'){if(u.action==='patrol'||u.action==='scout'||u.action==='defend'||u.action==='hunt'||u.action==='siege'){p.rightHand=[.35,1.05,.35];p.tool='spear';}if(u.action==='steal'||u.action==='cart')p.tool='crate';return p;}
  const wave=Math.sin(time*6+u.id),cycle=(time*1.2+u.id*.13)%1;
  if(['chop','mine','build','defend','hunt','siege'].includes(action)) {
    const swing=cycle<.6?cycle/.6:1-(cycle-.6)/.4;
    p.lean=-.12-swing*.14;p.rightHand=[.33,mix(.68,1.95,swing),mix(.65,-.25,swing)];
    p.leftHand=action==='build'?[-.3,.75,.45]:[-.16,p.rightHand[1]-.12,p.rightHand[2]+.12];
    p.tool={chop:'axe',mine:'pick',build:'hammer',defend:'spear',hunt:'spear',siege:'spear'}[action];p.impact=cycle>.9?(cycle-.9)*10:0;
    if(action==='defend'||action==='hunt'||action==='siege'){p.bob-=.08;p.rightFoot[2]=.4;p.leftFoot[2]=-.3;}
  }
  if(['forage','farm','dig','cultivate'].includes(action)) {
    p.body[1]=.82;p.head=[0,1.24,.23];p.lean=-.35;
    p.rightHand=[.26,.3+Math.max(0,wave)*.45,.58];p.leftHand=[-.27,.44+Math.max(0,-wave)*.3,.47];
    p.leftFoot[2]=-.16;p.rightFoot[2]=.2;p.tool=action==='dig'?'shovel':action==='farm'?'hoe':null;p.impact=Math.max(0,-wave);
  }
  if(action==='fish'){p.rightHand=[.28,1.1+wave*.06,.5];p.leftHand=[-.1,1,.45];p.headTurn=.15;p.tool='rod';}
  if(action==='eat'){p.rightHand=[.17,1.27+wave*.18,.25];p.leftHand=[-.23,1.08,.35];p.head[2]=.08;p.tool='food';}
  if(action==='socialize'){p.rightHand=[.44+wave*.12,1.2+wave*.12,.2];p.leftHand=[-.4,1.02-Math.cos(time*5)*.16,.1];p.headTurn=wave*.18;}
  if(action==='deliver'||action==='steal'||action==='cart'){p.lean=-.23;p.leftHand=[-.26,.68,.57];p.rightHand=[.26,.68,.57];p.tool='crate';}
  if(action==='rest'){p.resting=true;p.body=[0,.32,0];p.head=[0,.3,.6];p.leftHand=[-.3,.18,.05];p.rightHand=[.3,.18,.05];p.leftFoot=[-.16,.15,-.65];p.rightFoot=[.16,.15,-.65];p.lean=Math.PI/2;p.bob=breathe*.25;}
  if(action==='patrol'||action==='scout'){p.rightHand=[.3,1.13,.3];p.tool='spear';p.headTurn=Math.sin(time)*.45;}
  if(action==='flee'){p.lean=-.25;p.leftHand=[-.5,1.4,.1];p.rightHand=[.5,1.3,-.1];}
  if(action==='migrate'||action==='shelter'){p.headTurn=Math.sin(time)*.3;p.leftHand=[-.4,1.02,0];p.lean=action==='shelter'?-.18:-.08;}
  if(action==='shelter'&&!moving){p.resting=true;p.body=[0,.32,0];p.head=[0,.3,.6];p.leftHand=[-.3,.18,.05];p.rightHand=[.3,.18,.05];p.leftFoot=[-.16,.15,-.65];p.rightFoot=[.16,.15,-.65];p.lean=Math.PI/2;p.bob=breathe*.25;}
  if(action==='cheer'||action==='dance'){
    const hop=Math.abs(Math.sin(time*11+u.id));
    p.bob+=hop*.16;p.lean=-.06;p.head[1]=1.62;p.headTurn=Math.sin(time*5+u.id)*.28;
    p.leftHand=[-.46,1.62+hop*.24,.08];p.rightHand=[.5,1.68+hop*.2,.14];
    p.leftFoot=[-.18,.09,-.14];p.rightFoot=[.2,.09,.18];
  }
  if(action==='marvel'){
    p.head=[0,1.72,.18];p.headTurn=Math.sin(time*.6+u.id)*.12;p.lean=-.08;
    p.leftHand=[-.36,1.48+wave*.06,.12];p.rightHand=[.4,1.55+wave*.08,.16];
  }
  return p;
}
