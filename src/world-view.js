import { Renderer as Renderer2D } from './renderer2d.js';

const SHARED=['hover','radius','tool','labels','grid','selectedId','followId','inspectorOpen','watch'];

// Both renderers point to the same simulation; switching never creates a World.
export class WorldView {
  constructor(container,world) {
    this.container=container;this.world=world;this.mode='2d';this.renderers=new Map();this.disposed=false;
    const canvas=this.createCanvas('2d');this.active=new Renderer2D(canvas,world);this.renderers.set('2d',this.active);
    for(const key of SHARED)Object.defineProperty(this,key,{get:()=>this.active[key],set:value=>{this.active[key]=value;if(key==='inspectorOpen')this.active.updateCamera?.();}});
  }
  createCanvas(mode) {const canvas=document.createElement('canvas');canvas.className='world-surface';canvas.dataset.view=mode;canvas.setAttribute('aria-hidden','true');this.container.append(canvas);return canvas;}
  get zoom(){return this.active.zoom;}
  set zoom(value){this.active.zoom=value;this.active.updateCamera?.();}
  async switchMode(mode) {
    if(!['2d','3d'].includes(mode)||mode===this.mode||this.loading)return false;
    this.loading=true;
    try {
      let next=this.renderers.get(mode);
      if(!next) {
        const {Renderer}=await import('./renderer3d.js');if(this.disposed)return false;
        const canvas=this.createCanvas(mode);
        try {next=new Renderer(canvas,this.world);this.renderers.set(mode,next);}catch(error){canvas.nextElementSibling?.classList.contains('village-labels')&&canvas.nextElementSibling.remove();canvas.remove();throw error;}
      }
      for(const key of SHARED)next[key]=this.active[key];
      if(next.followId)next.zoom=Math.max(2,next.zoom);
      this.active.canvas.hidden=true;if(this.active.labelLayer)this.active.labelLayer.hidden=true;
      next.canvas.hidden=false;if(next.labelLayer)next.labelLayer.hidden=false;
      this.active=next;this.mode=mode;next.resize();return true;
    } finally {this.loading=false;}
  }
  setWorld(world){this.world=world;for(const r of this.renderers.values())r.setWorld(world);}
  pan(dx,dy){this.active.pan(dx,dy);}
  orbit(dx,dy){this.active.orbit?.(dx,dy);}
  changeZoom(...args){this.active.changeZoom(...args);}
  resetCamera(){this.active.resetCamera();}
  screenToWorld(x,y){return this.active.screenToWorld(x,y);}
  render(delta,animate){this.active.render(delta,animate);}
  dispose(){this.disposed=true;for(const r of this.renderers.values()){r.dispose();r.canvas.remove();}}
}
