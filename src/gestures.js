export const TAP_SLOP = 12;

export function pairStats(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}

export function wrapAngle(delta) {
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function twoFingerDelta(prev, next) {
  const scale = prev.dist > 24 ? next.dist / prev.dist : 1;
  const rotate = wrapAngle(next.angle - prev.angle);
  const panX = next.mid.x - prev.mid.x, panY = next.mid.y - prev.mid.y;
  return { panX, panY, scale, rotate, pan: Math.hypot(panX, panY), dist: prev.dist };
}

export function createFingerLock(allowOrbit = true) {
  return { lock: null, pinch: 0, orbit: 0, pan: 0, allowOrbit };
}

export function stepFingerLock(state, delta) {
  if (state.lock) return state.lock;
  const span = Math.max(delta.dist, 1);
  state.pinch += Math.abs(delta.scale - 1) * span;
  state.orbit += Math.abs(delta.rotate) * span;
  state.pan += delta.pan;
  if (state.pinch >= 14 && state.pinch >= state.orbit && state.pinch >= state.pan * 0.55) state.lock = 'pinch';
  else if (state.allowOrbit && state.orbit >= 16 && state.orbit > state.pinch && state.orbit >= state.pan * 0.7) state.lock = 'orbit';
  else if (state.pan >= 12 && state.pan >= state.pinch && state.pan >= state.orbit) state.lock = 'pan';
  return state.lock;
}

export function filterTwoFinger(delta, lock) {
  if (lock === 'pan') return { ...delta, scale: 1, rotate: 0 };
  if (lock === 'pinch') return { ...delta, panX: 0, panY: 0, rotate: 0 };
  if (lock === 'orbit') return { ...delta, panX: 0, panY: 0, scale: 1 };
  return { ...delta, panX: 0, panY: 0, scale: 1, rotate: 0 };
}

export function pinchZoom(scale) {
  if (scale === 1) return 1;
  return Math.pow(scale, 1.7);
}

export function isTap(origin, point, slop = TAP_SLOP) {
  return Math.hypot(point.x - origin.x, point.y - origin.y) < slop;
}

export function orbitFromRotate(rotate) {
  return rotate / 0.007;
}
