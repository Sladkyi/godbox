import { TILE } from './world.js';

const PALETTE = [0x24758a, 0x55b8b7, 0xe4d1a0, 0x95b879, 0x719b65, 0x8a9288, 0xe4ebdf, 0x7b7466];
const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];

export function tileHeight(world, x, y) {
  if (!world.inBounds(x, y)) return -1;
  const i = world.index(x, y), type = world.tiles[i], v = world.variation[i] / 255;
  if (type < TILE.SAND) return -.25;
  if (type === TILE.SAND) return .65;
  if (type === TILE.GRASS || type === TILE.FOREST) return 1.25 + Math.floor(v * 3) * .22;
  if (type === TILE.MOUNTAIN) return 3.6 + Math.floor(v * 6) * .85;
  if (type === TILE.SNOW) {
    let mountain = false;
    for (let r = 1; r <= 6 && !mountain; r++) {
      for (const [dx, dy] of [[r,0],[-r,0],[0,r],[0,-r]]) if (world.tile(x + dx, y + dy) === TILE.MOUNTAIN) mountain = true;
    }
    return mountain ? 7.5 + Math.floor(v * 3) * .6 : 2 + Math.floor(v * 4) * .3;
  }
  return .8;
}

// One merged mesh with only exposed faces. No 24,576 individual tile objects.
export function buildTerrainData(world) {
  const positions = [], normals = [], colors = [];
  function face(vertices, normal, color) {
    for (const i of [0,1,2,0,2,3]) { positions.push(...vertices[i]); normals.push(...normal); colors.push(...color); }
  }
  const w = world.width, h = world.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = world.index(x, y), type = world.tiles[i];
    if (type < TILE.SAND) continue;
    const top = tileHeight(world, x, y), X = x - w / 2, Z = y - h / 2;
    const shade = .93 + world.variation[i] / 255 * .1;
    const color = rgb(PALETTE[type]).map(c => c * shade);
    face([[X,top,Z],[X,top,Z+1],[X+1,top,Z+1],[X+1,top,Z]], [0,1,0], color);
    for (const [dx, dy, normal, points] of [
      [-1,0,[-1,0,0], [[X,Z+1],[X,Z]]],
      [1,0,[1,0,0], [[X+1,Z],[X+1,Z+1]]],
      [0,-1,[0,0,-1], [[X,Z],[X+1,Z]]],
      [0,1,[0,0,1], [[X+1,Z+1],[X,Z+1]]],
    ]) {
      const bottom = Math.max(-.4, tileHeight(world, x + dx, y + dy));
      if (bottom >= top) continue;
      const side = (type === TILE.GRASS || type === TILE.FOREST ? rgb(0x9b9069) : color).map(c => c * .85);
      const [[ax,az],[bx,bz]] = points;
      face([[ax,top,az],[bx,top,bz],[bx,bottom,bz],[ax,bottom,az]], normal, side);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors) };
}
