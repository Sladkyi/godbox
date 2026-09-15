import test from 'node:test';
import assert from 'node:assert/strict';
import { pairStats, twoFingerDelta, isTap, wrapAngle, orbitFromRotate, TAP_SLOP, pinchZoom, createFingerLock, stepFingerLock, filterTwoFinger } from '../src/gestures.js';

function locked(prev, next, allowOrbit = true) {
  const raw = twoFingerDelta(prev, next);
  const state = createFingerLock(allowOrbit);
  const lock = stepFingerLock(state, raw);
  return { raw, lock, delta: filterTwoFinger(raw, lock) };
}

test('two fingers moving together pan without zoom or spin', () => {
  const prev = pairStats({ x: 100, y: 100 }, { x: 180, y: 100 });
  const next = pairStats({ x: 130, y: 140 }, { x: 210, y: 140 });
  const { lock, delta: d } = locked(prev, next);
  assert.equal(lock, 'pan');
  assert.equal(d.panX, 30);
  assert.equal(d.panY, 40);
  assert.equal(d.scale, 1);
  assert.equal(d.rotate, 0);
});

test('a pinch with a little twist still zooms and does not orbit', () => {
  const prev = pairStats({ x: 80, y: 120 }, { x: 160, y: 120 });
  const next = pairStats({ x: 42, y: 128 }, { x: 198, y: 112 });
  const { lock, delta: d } = locked(prev, next);
  assert.equal(lock, 'pinch');
  assert.ok(d.scale > 1.4);
  assert.equal(d.rotate, 0);
});

test('pinch zoom is stronger than the raw finger distance', () => {
  assert.ok(pinchZoom(1.2) > 1.2);
  assert.equal(pinchZoom(1), 1);
});

test('a clear two-finger twist locks to orbit and does not pan', () => {
  const prev = pairStats({ x: 100, y: 100 }, { x: 180, y: 100 });
  const next = pairStats({ x: 100, y: 100 }, { x: 100, y: 180 });
  const { lock, delta: d } = locked(prev, next);
  assert.equal(lock, 'orbit');
  assert.ok(Math.abs(d.rotate - Math.PI / 2) < 1e-12);
  assert.equal(d.panX, 0);
  assert.equal(d.panY, 0);
  assert.equal(d.scale, 1);
});

test('once a pan is locked, later twist does not steal the camera', () => {
  const state = createFingerLock(true);
  const start = pairStats({ x: 100, y: 100 }, { x: 180, y: 100 });
  const slid = pairStats({ x: 140, y: 100 }, { x: 220, y: 100 });
  assert.equal(stepFingerLock(state, twoFingerDelta(start, slid)), 'pan');
  const twisted = pairStats({ x: 140, y: 60 }, { x: 220, y: 140 });
  const d = filterTwoFinger(twoFingerDelta(slid, twisted), stepFingerLock(state, twoFingerDelta(slid, twisted)));
  assert.equal(state.lock, 'pan');
  assert.equal(d.rotate, 0);
});

test('finger-pair rotation maps 1:1 onto 3D yaw', () => {
  const prev = pairStats({ x: 100, y: 100 }, { x: 160, y: 100 });
  const next = pairStats({ x: 100, y: 100 }, { x: 100, y: 160 });
  const d = twoFingerDelta(prev, next);
  assert.ok(Math.abs(d.rotate - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(orbitFromRotate(d.rotate) - Math.PI / 2 / 0.007) < 1e-6);
});

test('angle wrap stays on the short arc across the -pi seam', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 1.5) + Math.PI / 2) < 1e-12);
});

test('a short touch counts as a tap, a paint stroke does not', () => {
  assert.equal(isTap({ x: 10, y: 10 }, { x: 14, y: 12 }), true);
  assert.equal(isTap({ x: 10, y: 10 }, { x: 10 + TAP_SLOP + 1, y: 10 }), false);
});
