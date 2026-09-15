import test from 'node:test';
import assert from 'node:assert/strict';
import { adsSupported, watchRewardedAd, SPEED_ADS } from '../src/ads.js';

test('ads are only required on a real mobile RUN host', () => {
  assert.equal(adsSupported({ hosted: false, env: { platform: 'ios', capabilities: { ads: true } } }), false);
  assert.equal(adsSupported({ hosted: true, mock: true, env: { platform: 'ios', capabilities: { ads: true } } }), false);
  assert.equal(adsSupported({ hosted: true, env: { platform: 'desktop', capabilities: { ads: true } } }), false);
  assert.equal(adsSupported({ hosted: true, env: { platform: 'ios', capabilities: { ads: false } } }), false);
  assert.equal(adsSupported({ hosted: true, env: { platform: 'android', capabilities: { ads: true } } }), true);
});

test('a finished rewarded ad grants the speed, a skip does not', async () => {
  const earned = await watchRewardedAd({
    isRewardedAdReadyAsync: async () => true,
    showRewardedAdAsync: async (placement) => {
      assert.equal(placement.adDisplayId, SPEED_ADS[5].adDisplayId);
      return true;
    },
  }, SPEED_ADS[5]);
  assert.deepEqual(earned, { earned: true, status: 'earned' });

  const skipped = await watchRewardedAd({
    isRewardedAdReadyAsync: async () => true,
    showRewardedAdAsync: async () => false,
  }, SPEED_ADS[2]);
  assert.deepEqual(skipped, { earned: false, status: 'skipped' });
});

test('no inventory and a missing ads API never grant the boost', async () => {
  const empty = await watchRewardedAd({
    isRewardedAdReadyAsync: async () => false,
    showRewardedAdAsync: async () => true,
  }, SPEED_ADS[2]);
  assert.equal(empty.earned, false);
  assert.equal(empty.status, 'unavailable');

  const missing = await watchRewardedAd(null, SPEED_ADS[2]);
  assert.equal(missing.earned, false);
  assert.equal(missing.status, 'unsupported');
});
