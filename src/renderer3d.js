import * as THREE from 'three';
import { TILE } from './world.js';
import { buildTerrainData, tileHeight } from './terrain3d.js';
import { activityLabel } from './humans.js';
import { RACES } from './civilizations.js';
import { Actors3D } from './actors3d.js';
import { Scenery3D } from './scenery3d.js';
import { Disasters3D } from './disasters3d.js';

const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const compactView = () => typeof window !== 'undefined' && (window.innerWidth <= 700 || window.matchMedia?.('(pointer: coarse)')?.matches);
const zoomMax = () => compactView() ? 18 : 12;

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas; this.world = world;
    this.gpu = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.gpu.outputColorSpace = THREE.SRGBColorSpace;
    this.gpu.toneMapping = THREE.ACESFilmicToneMapping; this.gpu.toneMappingExposure = 1.14;
    this.gpu.shadowMap.enabled = true; this.gpu.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#1f4652');
    this.scene.fog = new THREE.Fog('#1f4652', 340, 620);
    this.camera = new THREE.OrthographicCamera(-100,100,100,-100,.1,1000);
    this.target = new THREE.Vector3(0, 1, 0); this.yaw = -.28; this.pitch = .86;
    this.zoom = compactView() ? 1.55 : 1; this.clock = 0; this.hover = null; this.radius = 3; this.tool = 'grass'; this.labels = true; this.grid = false;
    this.cacheRevision = -1; this.lastRebuild = -1; this.lastBuildings = ''; this.lastTerritories = ''; this.lastLabelTime = -1;
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0,1,0), -.25);
    this.matrix = new THREE.Object3D(); this.color = new THREE.Color(); this.temp = new THREE.Vector3();
    this.staticGroup = new THREE.Group(); this.scene.add(this.staticGroup);
    this.buildingGroup = new THREE.Group(); this.scene.add(this.buildingGroup);
    this.territoryGroup = new THREE.Group(); this.scene.add(this.territoryGroup);
    this.effectGroup = new THREE.Group(); this.scene.add(this.effectGroup);
    this.labelLayer = document.createElement('div'); this.labelLayer.className = 'village-labels'; this.labelLayer.setAttribute('aria-hidden', 'true'); canvas.after(this.labelLayer);
    this.labelElements = new Map();
    this.scene.add(new THREE.HemisphereLight(0xf3f6ea, 0x4e6758, 1.75));
    const sun = new THREE.DirectionalLight(0xfff1d4, 2.55); sun.position.set(-90, 170, 80); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left = -145; sun.shadow.camera.right = 145;
    sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120; sun.shadow.camera.far = 400; sun.shadow.normalBias = .1; sun.shadow.bias = -.00015;
    this.scene.add(sun);
    this.materials = {
      ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: 0x886946, roughness: 1 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      wall: new THREE.MeshStandardMaterial({ color: 0xf1deab, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0xb17454, roughness: 1, flatShading: true }),
      door: new THREE.MeshStandardMaterial({ color: 0x655646, roughness: 1 }),
      field: new THREE.MeshStandardMaterial({ color: 0x9c8250, roughness: 1 }),
      wheat: new THREE.MeshStandardMaterial({ color: 0xdccb72, roughness: 1 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xefc79c, roughness: 1 }),
      units: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
      wool: new THREE.MeshStandardMaterial({ color: 0xeae5cc, roughness: 1 }),
      wolf: new THREE.MeshStandardMaterial({ color: 0x718089, roughness: 1 }),
      fire: new THREE.MeshBasicMaterial({ color: 0xffa447 }),
    };
    this.box = new THREE.BoxGeometry(1,1,1);
    this.flames = this.instances(new THREE.ConeGeometry(.36, 1.8, 5), this.materials.fire, 2200, false);
    this.fireLight = new THREE.MeshBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: .8, depthWrite: false });
    this.createBrush(); this.createOcean();
    this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(.34,.44,32),new THREE.MeshBasicMaterial({color:0xe8f7b4,side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.8}));
    this.selectionRing.rotation.x=-Math.PI/2;this.selectionRing.renderOrder=15;this.selectionRing.visible=false;this.scene.add(this.selectionRing);
    this.pathPoints=new Float32Array(129*3);
    this.pathGeometry=new THREE.BufferGeometry();this.pathGeometry.setAttribute('position',new THREE.BufferAttribute(this.pathPoints,3));
    this.pathLine=new THREE.Line(this.pathGeometry,new THREE.LineBasicMaterial({color:0xeff5bb,depthTest:false,transparent:true,opacity:.65}));
    this.pathLine.frustumCulled=false;this.pathLine.renderOrder=14;this.scene.add(this.pathLine);
    this.personLabel=document.createElement('span');this.personLabel.className='village-label person-world-label';this.personLabel.hidden=true;this.labelLayer.append(this.personLabel);
    this.momentPool=Array.from({length:10},()=>{const el=document.createElement('span');el.className='moment-label';el.hidden=true;this.labelLayer.append(el);return el;});
    this.selectedId=null;this.followId=null;this.watch=false;
    this.actors=new Actors3D(this);this.scenery=new Scenery3D(this);this.disasters=new Disasters3D(this);this.animationDelta=0;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas); this.resize();
  }
  instances(geometry, material, capacity, shadows = true, parent = this.scene) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity); mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = shadows; mesh.receiveShadow = shadows; mesh.frustumCulled = false;
    parent.add(mesh); return mesh;
  }
  put(mesh, index, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, color = null) {
    this.matrix.position.set(x,y,z); this.matrix.scale.set(sx,sy,sz); this.matrix.rotation.set(0,ry,0); this.matrix.updateMatrix(); mesh.setMatrixAt(index, this.matrix.matrix);
    if (color !== null) mesh.setColorAt(index, this.color.set(color));
  }
  finishInstances(mesh, count) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  clearGroup(group) {
    // Geometry is owned by the group; shared palette materials live for the renderer.
    const geometry = new Set(), materials = new Set();
    group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry !== this.box) geometry.add(o.geometry); if (o.userData.ownMaterial) materials.add(o.material); });
    group.clear(); geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
  setWorld(world) { this.world = world; this.cacheRevision = -1; this.lastBuildings = ''; this.lastTerritories = ''; this.actors.state.clear();this.disasters.flash=0;this.disasters.shake=0;this.disasters.clips=[];this.disasters.seen.clear();this.createOcean(); this.resetCamera(); }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.w = rect.width; this.h = rect.height;
    if (!this.w || !this.h) return;
    this.gpu.setSize(this.w, this.h, false); this.updateCamera();
  }
  resetCamera() { this.followId=null; this.watch=false; this.zoom = compactView() ? 1.55 : 1; this.yaw = -.28; this.pitch = .86; this.target.set(0,1,0); this.updateCamera(); }
  layout() {
    const left = this.w > 1150 ? 252 : this.w > 700 ? 228 : 8;
    const right = this.w > 1150 ? 262 : this.w > 700 ? 22 : 8;
    const top = this.w > 700 ? 68 : 62, bottom = this.w > 700 ? 105 : this.inspectorOpen ? 400 : 188;
    return { width: Math.max(170,this.w-left-right), height: Math.max(130,this.h-top-bottom), x: left+(this.w-left-right)/2, y: top+(this.h-top-bottom)/2 };
  }
  updateCamera() {
    if (!this.w || !this.h) return;
    const l = this.layout(), w = this.world.width, h = this.world.height;
    // Keep the full board inside the usable space, leaving room for game controls.
    const projectedWidth = Math.abs(Math.cos(this.yaw))*w + Math.abs(Math.sin(this.yaw))*h;
    const projectedHeight = (Math.abs(Math.sin(this.yaw))*w + Math.abs(Math.cos(this.yaw))*h)*Math.sin(this.pitch) + 14;
    this.pixelWorld = Math.max(projectedWidth/l.width, projectedHeight/l.height)*1.04/this.zoom;
    const s = this.pixelWorld;
    this.camera.left = -l.x*s; this.camera.right = (this.w-l.x)*s;
    this.camera.top = l.y*s; this.camera.bottom = -(this.h-l.y)*s;
    this.camera.position.set(this.target.x + Math.sin(this.yaw)*Math.cos(this.pitch)*320, this.target.y + Math.sin(this.pitch)*320, this.target.z + Math.cos(this.yaw)*Math.cos(this.pitch)*320);
    this.camera.lookAt(this.target); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  screenRay(sx, sy) { this.pointer.set(sx/this.w*2-1, -(sy/this.h)*2+1); this.raycaster.setFromCamera(this.pointer, this.camera); }
  screenToWorld(sx, sy) {
    this.screenRay(sx,sy);
    const land = this.landMesh ? this.raycaster.intersectObject(this.landMesh, false)[0] : null;
    const hit = land?.point ?? this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    return hit ? { x: hit.x+this.world.width/2, y: hit.z+this.world.height/2 } : { x:-1,y:-1 };
  }
  pan(dx, dy) {
    this.followId=null; this.watch=false;
    const s = this.pixelWorld, yaw = this.yaw, depth = dy*s/Math.sin(this.pitch);
    this.target.x = clamp(this.target.x-dx*s*Math.cos(yaw)-depth*Math.sin(yaw), -this.world.width, this.world.width);
    this.target.z = clamp(this.target.z+dx*s*Math.sin(yaw)-depth*Math.cos(yaw), -this.world.height, this.world.height);
    this.updateCamera();
  }
  orbit(dx, dy = 0) { this.yaw -= dx*.007; this.pitch = clamp(this.pitch+dy*.005, .36, 1.42); this.updateCamera(); }
  changeZoom(factor, sx, sy) {
    let before;
    if (sx !== undefined) { this.screenRay(sx,sy); before = this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3()); }
    this.zoom = clamp(this.zoom*factor,.55,zoomMax()); this.updateCamera();
    if (before) {
      this.screenRay(sx,sy); const after = this.raycaster.ray.intersectPlane(this.plane,new THREE.Vector3());
      if (after) { this.target.x += before.x-after.x; this.target.z += before.z-after.z; this.updateCamera(); }
    }
  }
  createOcean() {
    if (this.oceanGroup) { this.clearGroup(this.oceanGroup); this.scene.remove(this.oceanGroup); }
    const group = this.oceanGroup = new THREE.Group(); this.scene.add(group);
    const w = this.world.width, h = this.world.height;
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f8fa8, metalness: .16, roughness: .34 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w,h), waterMat); water.rotation.x = -Math.PI/2; water.position.y = .25; water.receiveShadow = true; water.userData.ownMaterial = true; group.add(water);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x285561, roughness: 1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w,3,h), baseMat); base.position.y = -1.35; base.receiveShadow = true; base.userData.ownMaterial = true; group.add(base);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c424c, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600,1600), floorMat); floor.rotation.x = -Math.PI/2; floor.position.y = -6; floor.receiveShadow = true; floor.userData.ownMaterial = true; group.add(floor);
    const rippleMat = new THREE.MeshBasicMaterial({ color: 0xa7e5da, transparent: true, opacity: .19, depthWrite: false });
    this.ripples = this.instances(new THREE.BoxGeometry(1,.025,.11), rippleMat, 100, false, group); this.ripples.userData.ownMaterial = true;
  }
  rebuild() {
    this.clearGroup(this.staticGroup);
    const world = this.world, data = buildTerrainData(world), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
    // Colors in the mesh are authored in sRGB, convert them for Three's linear lighting.
    for (let i=0;i<data.colors.length;i+=3) { this.color.setRGB(data.colors[i],data.colors[i+1],data.colors[i+2],THREE.SRGBColorSpace); data.colors[i]=this.color.r; data.colors[i+1]=this.color.g; data.colors[i+2]=this.color.b; }
    geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3)); geometry.computeBoundingSphere();
    this.landMesh = new THREE.Mesh(geometry,this.materials.ground); this.landMesh.receiveShadow = true; this.landMesh.castShadow = true; this.staticGroup.add(this.landMesh);
    const trees = [], shallows = [];
    for (let y=0;y<world.height;y++) for (let x=0;x<world.width;x++) {
      const i=world.index(x,y), type=world.tiles[i], v=world.variation[i];
      if (type===TILE.FOREST && world.wood[i]>0 && !world.buildings.some(b=>Math.hypot(b.x-x,b.y-y)<2)) trees.push({ x:x-world.width/2+.5, z:y-world.height/2+.5, h:tileHeight(world,x,y), v });
      if (type===TILE.SHALLOW) shallows.push({x:x-world.width/2+.5,z:y-world.height/2+.5});
    }
    const trunks = this.instances(new THREE.CylinderGeometry(.12,.2,1.2,5),this.materials.wood,Math.max(1,trees.length),true,this.staticGroup);
    const crowns = this.instances(new THREE.ConeGeometry(.95,2.3,5),this.materials.foliage,Math.max(1,trees.length*2),true,this.staticGroup);
    trees.forEach((tree,i) => {
      const s=.43+tree.v/255*.16, angle=tree.v/255*TAU;
      this.put(trunks,i,tree.x,tree.h+.6,tree.z,1,1,1,angle);
      this.put(crowns,i*2,tree.x,tree.h+1.7*s,tree.z,s,s,s,angle,tree.v>140?0x528755:0x3d744e);
      this.put(crowns,i*2+1,tree.x,tree.h+2.55*s,tree.z,s*.68,s*.75,s*.68,angle,0x65935c);
    });
    this.finishInstances(trunks,trees.length); this.finishInstances(crowns,trees.length*2);
    const shoalMat = new THREE.MeshStandardMaterial({ color: 0x79cabe, transparent:true, opacity:.44, roughness:.5, depthWrite:false });
    const shoalMesh = this.instances(new THREE.BoxGeometry(1,.015,1),shoalMat,Math.max(1,shallows.length),false,this.staticGroup); shoalMesh.userData.ownMaterial=true;
    shallows.forEach((p,i)=>this.put(shoalMesh,i,p.x,.28,p.z)); this.finishInstances(shoalMesh,shallows.length);
    // A light grid follows the actual top surface, including mountains.
    const lines=[];
    for (let y=0;y<world.height;y++) for(let x=0;x<world.width;x++) {
      const h=Math.max(.28,tileHeight(world,x,y))+.035, X=x-world.width/2,Z=y-world.height/2;
      lines.push(X,h,Z,X+1,h,Z, X,h,Z,X,h,Z+1);
    }
    const gridGeometry=new THREE.BufferGeometry(); gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    this.gridMesh=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x284b44,transparent:true,opacity:.18})); this.gridMesh.userData.ownMaterial=true; this.staticGroup.add(this.gridMesh);
    this.cacheRevision=world.revision; this.lastBuildings=''; this.lastTerritories='';
  }
  addBox(group,material,x,y,z,sx,sy,sz) {
    const mesh=new THREE.Mesh(this.box,material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  rebuildBuildings() {
    this.clearGroup(this.buildingGroup);
    for(const b of this.world.buildings)this.scenery.structure(b);
    this.lastBuildings=this.buildingKey();
  }
  territoryKey() { return this.world.villages.map(v=>`${v.id}:${v.x}:${v.y}:${this.world.claimRadius(v).toFixed(1)}:${v.population>0?1:0}:${(v.known??[]).join('.')}:${(v.wars??[]).join('.')}`).join(','); }
  claimLoop(v, radius, lift) {
    const w=this.world, pts=[];
    for(let i=0;i<=72;i++) {
      const a=i/72*TAU,x=v.x+Math.cos(a)*radius,z=v.y+Math.sin(a)*radius;
      pts.push(x-w.width/2, Math.max(.28, tileHeight(w,x,z))+lift, z-w.height/2);
    }
    return pts;
  }
  addLoop(points, color, opacity, pulse) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const line=new THREE.Line(geo, new THREE.LineBasicMaterial({color, transparent:true, opacity, depthWrite:false}));
    line.renderOrder=5; line.frustumCulled=false; line.userData.ownMaterial=true; line.userData.pulse=pulse;
    this.territoryGroup.add(line);
    return line;
  }
  rebuildTerritories() {
    this.clearGroup(this.territoryGroup);
    const w=this.world;
    for(const v of w.villages) {
      if(!v.population) continue;
      const R=w.claimRadius(v);
      const fighting=(v.wars??[]).length>0;
      const fill=new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({color:fighting?0xe07060:v.color, transparent:true, opacity:fighting?.22:.14, side:THREE.DoubleSide, depthWrite:false}));
      fill.rotation.x=-Math.PI/2; fill.position.set(v.x-w.width/2, Math.max(.26, tileHeight(w,v.x,v.y))+.16, v.y-w.height/2);
      fill.renderOrder=2; fill.userData.ownMaterial=true; fill.userData.pulse=fighting?'warfill':'fill';
      this.territoryGroup.add(fill);
      this.addLoop(this.claimLoop(v, R, .46), fighting?0xe07060:v.color, fighting?.98:.92, 'edge');
      this.addLoop(this.claimLoop(v, Math.max(2, R-.7), .38), fighting?0xffb078:v.color, .32, 'inner');
    }
    const drawn=new Set();
    for(const v of w.villages) {
      for(const id of [...new Set([...(v.known??[]), ...(v.wars??[])])]) {
        const other=w.villages.find(o=>o.id===id);
        if(!other) continue;
        const key=v.id<other.id?`${v.id}:${other.id}`:`${other.id}:${v.id}`;
        if(drawn.has(key)) continue;
        drawn.add(key);
        const h1=Math.max(.4, tileHeight(w,v.x,v.y))+.55, h2=Math.max(.4, tileHeight(w,other.x,other.y))+.55;
        const span=Math.hypot(other.x-v.x, other.y-v.y), lift=2.4+span*.03, pts=[];
        for(let i=0;i<=18;i++) {
          const t=i/18, x=v.x+(other.x-v.x)*t, z=v.y+(other.y-v.y)*t;
          pts.push(x-w.width/2, h1+(h2-h1)*t+t*(1-t)*4*lift, z-w.height/2);
        }
        const fighting=(v.wars??[]).includes(other.id)||(other.wars??[]).includes(v.id);
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const line=new THREE.Line(geo, fighting
          ? new THREE.LineBasicMaterial({color:0xe07060, transparent:true, opacity:.95, depthWrite:false})
          : new THREE.LineDashedMaterial({color:v.color, dashSize:1.35, gapSize:.7, transparent:true, opacity:.88, depthWrite:false}));
        if(!fighting) line.computeLineDistances();
        line.renderOrder=6; line.frustumCulled=false; line.userData.ownMaterial=true; line.userData.pulse=fighting?'war':'link';
        this.territoryGroup.add(line);
        const mid=new THREE.Mesh(new THREE.SphereGeometry(fighting?.38:.28, 8, 6), new THREE.MeshBasicMaterial({color:fighting?0xff8a6a:v.color, transparent:true, opacity:.9, depthWrite:false}));
        mid.position.set((v.x+other.x)/2-w.width/2, (h1+h2)/2+lift*.95, (v.y+other.y)/2-w.height/2);
        mid.renderOrder=7; mid.userData.ownMaterial=true; mid.userData.pulse='bead';
        this.territoryGroup.add(mid);
      }
    }
    this.lastTerritories=this.territoryKey();
  }
  buildingKey() { return this.world.buildings.map(b=>`${b.id}:${b.material}:${b.race}:${b.complete?5:Math.floor(b.progress*5)}:${b.type==='farm'?Math.floor(b.crop/4):0}`).join(','); }
  createBrush() {
    this.brushGeometry=new THREE.BufferGeometry(); this.brushPoints=new Float32Array(97*3); this.brushGeometry.setAttribute('position',new THREE.BufferAttribute(this.brushPoints,3));
    this.brush=new THREE.Line(this.brushGeometry,new THREE.LineBasicMaterial({color:0xf5ffd7,depthTest:false,transparent:true,opacity:.95})); this.brush.renderOrder=20; this.brush.frustumCulled=false; this.scene.add(this.brush);
  }
  updateBrush() {
    const p=this.hover,world=this.world; this.brush.visible=!!p&&world.inBounds(p.x,p.y);
    if(!this.brush.visible) return;
    const r=['human','ghoul','alien','mycelite','sheep','wolf','inspect'].includes(this.tool)?1.3:this.radius+.5;
    for(let i=0;i<=96;i++) {
      const a=i/96*TAU,x=p.x+Math.cos(a)*r,z=p.y+Math.sin(a)*r;
      this.brushPoints[i*3]=x-world.width/2; this.brushPoints[i*3+1]=Math.max(.3,tileHeight(world,x,z))+.12; this.brushPoints[i*3+2]=z-world.height/2;
    }
    this.brushGeometry.attributes.position.needsUpdate=true;
    this.brush.material.color.set(['fire','meteor','lightning','erase'].includes(this.tool)?0xffbf93:0xf5ffd7);
  }
  updateUnits() {
    const world=this.world;this.actors.update(this.clock,this.animationDelta);
    const selected=world.units.find(u=>u.id===this.selectedId);this.selectionRing.visible=!!selected;
    if(selected)this.selectionRing.position.set(selected.x-world.width/2,Math.max(.3,tileHeight(world,selected.x,selected.y))+.08,selected.y-world.height/2);
    let points=0;
    if(selected?.path.length){
      this.pathPoints.set([selected.x-world.width/2,tileHeight(world,selected.x,selected.y)+.2,selected.y-world.height/2],points++*3);
      for(const i of selected.path){const x=i%world.width+.5,y=Math.floor(i/world.width)+.5;this.pathPoints.set([x-world.width/2,tileHeight(world,x,y)+.2,y-world.height/2],points++*3);}
    }
    this.pathGeometry.setDrawRange(0,points);this.pathGeometry.attributes.position.needsUpdate=true;this.pathLine.visible=points>1;
  }
  updateEffects() {
    const world=this.world; let count=0;
    for(let i=0;i<world.fire.length&&count<2200;i++) if(world.fire[i]>0) {
      const x=i%world.width,y=Math.floor(i/world.width),s=.75+Math.sin(this.clock*13+i)*.25;
      this.put(this.flames,count++,x-world.width/2+.5,tileHeight(world,x,y)+s*.9,y-world.height/2+.5,1,s,1,i, i%3===0?0xffd46f:0xff913b);
    }
    this.finishInstances(this.flames,count);
    this.disasters.update(this.clock,this.animationDelta);
  }
  projectLabel(x, y, z) {
    this.temp.set(x, y, z).project(this.camera);
    return { x:(this.temp.x+1)*this.w/2, y:(1-this.temp.y)*this.h/2, behind:this.temp.z>1 };
  }
  updateLabels() {
    const selected=this.world.units.find(u=>u.id===this.selectedId);
    this.personLabel.hidden=!selected;
    if(selected){
      const p=this.projectLabel(selected.x-this.world.width/2, tileHeight(this.world,selected.x,selected.y)+1.7, selected.y-this.world.height/2);
      this.personLabel.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      this.personLabel.textContent=`${selected.name} · ${activityLabel(selected)}`;
    }
    const ids=new Set();
    for(const v of this.world.villages) {
      ids.add(v.id); let el=this.labelElements.get(v.id);
      if(!el) { el=document.createElement('span'); el.className='village-label'; this.labelLayer.append(el); this.labelElements.set(v.id,el); }
      const p=this.projectLabel(v.x-this.world.width/2, tileHeight(this.world,v.x,v.y)+2.8, v.y-this.world.height/2);
      el.hidden=!this.labels||!v.population||p.behind||p.x<0||p.x>this.w||p.y<0||p.y>this.h;
      el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-100%)`; el.style.setProperty('--village-color',v.color);
      const title=document.createElement('b'); title.textContent=v.name;
      if(this.w>700) {
        const meta=document.createElement('i'); meta.textContent=`${RACES[v.race]?.name??'People'} · ${v.population}`;
        el.replaceChildren(title, meta);
      } else el.replaceChildren(title);
    }
    for(const [id,el] of this.labelElements) if(!ids.has(id)) { el.remove(); this.labelElements.delete(id); }
    const MOMENT={scout:'Scout',defend:'Defend',steal:'Raid',hunt:'Hunt',flee:'Fleeing',patrol:'Watch',siege:'Siege',cheer:'Wow!'};
    const COLOR={scout:'#7ee0d8',defend:'#ffb078',steal:'#f08a8a',hunt:'#ed839d',flee:'#e7f0b4',patrol:'#c9d6ea',siege:'#ff6b5a',cheer:'#ffe08a'};
    const cx=this.target.x+this.world.width/2, cy=this.target.z+this.world.height/2;
    const notable=this.world.units.filter(u=>u.kind==='human'&&MOMENT[u.action]&&u.id!==this.selectedId)
      .sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));
    for(let i=0;i<this.momentPool.length;i++) {
      const el=this.momentPool[i], u=notable[i];
      if(!u){el.hidden=true;continue;}
      const p=this.projectLabel(u.x-this.world.width/2, tileHeight(this.world,u.x,u.y)+1.25, u.y-this.world.height/2);
      el.hidden=p.behind||p.x<8||p.x>this.w-8||p.y<8||p.y>this.h-8;
      el.textContent=MOMENT[u.action];
      el.style.setProperty('--moment-color', COLOR[u.action]);
      el.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-120%)`;
    }
  }
  render(delta,animate=true) {
    this.animationDelta=animate?delta:0;
    if(animate) this.clock+=delta;
    // Paint changes can arrive many times per frame; rebuild at most ~12 times/s.
    const now=performance.now();
    if(this.cacheRevision!==this.world.revision && (now-this.lastRebuild>80||this.cacheRevision===-1)) { this.rebuild(); this.lastRebuild=now; }
    if(this.lastBuildings!==this.buildingKey()) this.rebuildBuildings();
    if(this.lastTerritories!==this.territoryKey()) this.rebuildTerritories();
    if(this.gridMesh) this.gridMesh.visible=this.grid;
    this.updateUnits(); this.updateBrush(); this.updateEffects();this.scenery.update(this.clock);
    let rippleCount=0;
    for(let i=0;i<100;i++) {
      const x=(i*37.81+this.world.seed%30)%this.world.width,z=(i*23.13)%this.world.height;
      if(this.world.tile(x,z)>1) continue;
      this.put(this.ripples,rippleCount++,x-this.world.width/2,.32,z-this.world.height/2,1.4+Math.sin(this.clock*.8+i)*.6,1,1,0);
    }
    this.finishInstances(this.ripples,rippleCount);
    const followed=this.world.units.find(u=>u.id===this.followId);
    if(followed){this.target.set(followed.x-this.world.width/2,tileHeight(this.world,followed.x,followed.y),followed.y-this.world.height/2);}
    else if(this.watch) {
      const notable=[...this.world.effects].reverse().find(e=>['meteor','lightning','war','siege','steal','birth','death','rain','scout','border','ignite'].includes(e.kind));
      if(notable){
        const tx=notable.x-this.world.width/2,tz=notable.y-this.world.height/2;
        this.target.x+=(tx-this.target.x)*Math.min(1,delta*1.7);
        this.target.z+=(tz-this.target.z)*Math.min(1,delta*1.7);
        this.target.y+=(tileHeight(this.world,notable.x,notable.y)-this.target.y)*Math.min(1,delta);
        if(this.zoom<2.6)this.zoom+= (2.6-this.zoom)*Math.min(1,delta*.8);
      }
    }
    this.updateCamera();
    if(now-this.lastLabelTime>70) { this.updateLabels(); this.lastLabelTime=now; }
    this.gpu.toneMappingExposure=1.14+this.disasters.flash*.9;
    const cam=this.camera.position,ox=cam.x,oy=cam.y,oz=cam.z,s=this.disasters.shake;
    if(s>0){cam.x+=Math.sin(this.clock*53)*s*.55;cam.y+=Math.cos(this.clock*41)*s*.22;cam.z+=Math.sin(this.clock*37)*s*.4;this.camera.updateMatrixWorld();}
    const wave=Math.sin(this.clock*1.7)*.07;
    for(const o of this.territoryGroup.children) {
      if(!o.material||!o.userData.pulse) continue;
      o.material.opacity={fill:.12+wave, warfill:.2+wave, edge:.88+wave, inner:.28+wave*.4, link:.78+wave*.4, war:.92+wave, bead:.85+wave}[o.userData.pulse]??o.material.opacity;
      if(o.userData.pulse==='bead') o.scale.setScalar(1+Math.sin(this.clock*3)*.12);
    }
    this.gpu.render(this.scene,this.camera);
    if(s>0)cam.set(ox,oy,oz);
  }
  dispose() {
    this.resizeObserver.disconnect(); this.labelLayer.remove();this.scenery.dispose();this.disasters.dispose();
    const geometries=new Set(), materials=new Set();
    this.scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); this.gpu.dispose();
  }
}
