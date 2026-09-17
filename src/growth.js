export const GROW_LAND = .58;
export const GROW_TREE = .9;
export const GROW_BLADE = .7;

export function growT(age, delay = 0, duration = GROW_LAND) {
  const t = Math.max(0, Math.min(1, (age - delay) / duration));
  return t * t * (3 - 2 * t);
}

export function growDelay(i, variation = 0) {
  return ((i * 19 + variation) % 11) * .032;
}

export function growOvershoot(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < .82 ? t / .82 * 1.08 : 1.08 - (t - .82) / .18 * .08;
}

export function growWait(from, to, delay = 0) {
  if (from === to) return delay;
  const plants = to === 3 || to === 4;
  return delay + GROW_LAND + (plants ? .28 : 0);
}
