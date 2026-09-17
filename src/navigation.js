// Deterministic A* with reusable buffers, connected regions and a per-tick budget.
const DIRECTIONS = [[1,0], [0,1], [-1,0], [0,-1], [1,1], [-1,1], [-1,-1], [1,-1]];
class Heap {
  constructor() { this.items = []; }
  push(node) {
    const a = this.items; a.push(node); let i = a.length - 1;
    while (i > 0) { const p = (i-1)>>1; if (a[p].f <= node.f) break; a[i] = a[p]; i = p; } a[i] = node;
  }
  pop() {
    const a = this.items, root = a[0], tail = a.pop();
    if (a.length) { let i = 0; while (i*2+1 < a.length) { let child = i*2+1; if (child+1 < a.length && a[child+1].f < a[child].f) child++; if (a[child].f >= tail.f) break; a[i] = a[child]; i = child; } a[i] = tail; }
    return root;
  }
}

export class Navigation {
  constructor(world) {
    this.world = world; const n = world.tiles.length;
    this.regions = new Int32Array(n); this.blocked = new Uint8Array(n);
    this.seen = new Uint32Array(n); this.closed = new Uint32Array(n); this.parents = new Int32Array(n); this.cost = new Float32Array(n);
    this.stamp = 0; this.revision = -1; this.budget = 16000; this.searches = 0; this.expanded = 0;
  }
  beginTick() { this.budget = 16000; this.searches = 0; this.expanded = 0; this.refresh(); }
  passable(x, y) { return this.world.walkable(x, y) && !this.blocked[this.world.index(x, y)]; }
  refresh() {
    if (this.revision === this.world.navRevision) return;
    const w = this.world, queue = new Int32Array(w.tiles.length);
    this.blocked.fill(0); this.regions.fill(0);
    for (const b of w.buildings) if (b.complete && b.type !== 'farm' && b.type !== 'pen') this.blocked[w.index(b.x,b.y)] = 1;
    let region = 0;
    for (let i=0;i<w.tiles.length;i++) {
      if (this.regions[i] || !this.passable(i%w.width, Math.floor(i/w.width))) continue;
      let head=0, tail=1; queue[0]=i; this.regions[i]=++region;
      while(head<tail) {
        const at=queue[head++], x=at%w.width, y=Math.floor(at/w.width);
        for(const [dx,dy] of DIRECTIONS.slice(0,4)) {
          const nx=x+dx,ny=y+dy;
          if(!this.passable(nx,ny)) continue;
          const next=w.index(nx,ny); if(this.regions[next]) continue;
          this.regions[next]=region; queue[tail++]=next;
        }
      }
    }
    this.revision=w.navRevision;
  }
  sameRegion(a, b) {
    this.refresh(); const w=this.world;
    if(!w.inBounds(a.x,a.y)||!w.inBounds(b.x,b.y)) return false;
    const first=this.regions[w.index(a.x,a.y)], second=this.regions[w.index(b.x,b.y)];
    // A person can leave a tile on which a new house has just been completed.
    if(!first && second) return DIRECTIONS.slice(0,4).some(([dx,dy])=>w.inBounds(a.x+dx,a.y+dy)&&this.regions[w.index(a.x+dx,a.y+dy)]===second);
    return first>0 && first===second;
  }
  findPath(from, to, { allowFire = false, limit = 5000 } = {}) {
    this.refresh(); const w=this.world;
    if(!this.sameRegion(from,to)||!this.passable(to.x,to.y)) return null;
    const start=w.index(from.x,from.y), end=w.index(to.x,to.y);
    if(start===end) return [];
    if(this.budget<=0) return undefined; // Defer; not an unreachable goal.
    const stamp=++this.stamp, heap=new Heap(); this.searches++;
    const heuristic=i=>{const dx=Math.abs(i%w.width-end%w.width),dy=Math.abs(Math.floor(i/w.width)-Math.floor(end/w.width)); return Math.max(dx,dy)+.41421356*Math.min(dx,dy);};
    this.seen[start]=stamp; this.cost[start]=0; heap.push({i:start,f:heuristic(start)});
    let expanded=0;
    while(heap.items.length && expanded<limit && this.budget>0) {
      const {i}=heap.pop(); if(this.closed[i]===stamp) continue;
      if(i===end) { const path=[]; let cursor=end; while(cursor!==start) { path.push(cursor); cursor=this.parents[cursor]; } return path.reverse().slice(0,128); }
      this.closed[i]=stamp; expanded++; this.budget--; this.expanded++;
      const x=i%w.width,y=Math.floor(i/w.width);
      for(const [dx,dy] of DIRECTIONS) {
        const nx=x+dx,ny=y+dy;
        if(!this.passable(nx,ny)) continue;
        if(dx&&dy&&(!this.passable(x+dx,y)||!this.passable(x,y+dy))) continue;
        const j=w.index(nx,ny); if(this.closed[j]===stamp||(!allowFire&&w.fire[j]>0)) continue;
        // Diagonal movement must not cut between burning cells either.
        if(dx&&dy&&!allowFire&&(w.fire[w.index(x+dx,y)]>0||w.fire[w.index(x,y+dy)]>0)) continue;
        const cost=this.cost[i]+(dx&&dy?Math.SQRT2:1)+(w.fire[j]>0?12:0)+(w.tiles[j]===6?.3:0);
        if(this.seen[j]!==stamp||cost<this.cost[j]) { this.seen[j]=stamp; this.cost[j]=cost; this.parents[j]=i; heap.push({i:j,f:cost+heuristic(j)}); }
      }
    }
    return this.budget<=0 ? undefined : null;
  }
}
