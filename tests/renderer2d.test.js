import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/renderer2d.js';

test('2D painting coordinates stay accurate after zoom, pan and following a person',()=>{
  const r=Object.create(Renderer.prototype);Object.assign(r,{w:1366,h:768,world:{width:192,height:128,units:[{id:7,x:70.5,y:50.5}]},zoom:1,offset:{x:0,y:0},followId:null});
  const cell={x:63.5,y:81.5};
  for(const change of [()=>{},()=>r.pan(150,-45),()=>r.changeZoom(2.7,600,300),()=>{r.followId=7;},()=>r.pan(-30,80),()=>{r.w=390;r.h=780;r.resetCamera();}]) {
    change();const p=r.worldToScreen(cell.x,cell.y),back=r.screenToWorld(p.x,p.y);
    assert.ok(Math.abs(back.x-cell.x)<1e-8);assert.ok(Math.abs(back.y-cell.y)<1e-8);
  }
});
