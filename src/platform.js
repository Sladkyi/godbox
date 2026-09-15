import { adsSupported, watchRewardedAd, SPEED_ADS } from './ads.js';

// Host detection follows the existing NewGame RUN integration and SDK 5.27.
export function isRunHost() {
  return __RUN_PLAYGROUND__ || 'ReactNativeWebView' in window || new URLSearchParams(location.search).has('_pid');
}

export class Platform {
  constructor() { this.sdk = null; this.hosted = isRunHost(); this.status = this.hosted ? 'connecting' : 'local'; this.subscriptions = []; this.adBusy = false; }
  async connect({ pause, resume, save, identityChanged }) {
    if (!this.hosted) return;
    try {
      const { default: sdk } = await import('@series-inc/rundot-game-sdk/api');
      // Import awaits SDK initialization. No deprecated initializeAsync / onReady calls.
      if (sdk.isMock?.() && !__RUN_PLAYGROUND__) throw new Error('RUN host bridge is unavailable');
      this.sdk = sdk;
      const area = sdk.system.getSafeArea();
      for (const side of ['top','right','bottom','left']) {
        document.documentElement.style.setProperty(`--safe-${side}`, `${Math.max(0, area[side] || 0)}px`);
      }
      this.subscriptions = [
        sdk.lifecycles.onPause(pause), sdk.lifecycles.onResume(resume),
        sdk.lifecycles.onSleep(() => { pause(); save(); }), sdk.lifecycles.onAwake(resume),
        sdk.lifecycles.onQuit(() => { pause(); save(); }),
        sdk.lifecycles.onIdentityChanged(() => { this.status = 'identity-changed'; pause(); identityChanged(); }),
      ];
      this.status = 'ready';
    } catch (error) { this.status = 'error'; console.warn('RUN connection failed:', error.message); }
  }
  async save(data) {
    if (this.status !== 'ready' || !this.sdk) throw new Error('RUN cloud save is not available yet.');
    if (new TextEncoder().encode(data).length > 950000) throw new Error('This world is too large for cloud save.');
    await this.sdk.appStorage.setItem('godbox-world-v1', data);
  }
  async load() {
    if (this.status !== 'ready' || !this.sdk) throw new Error('RUN cloud save is not available yet.');
    return this.sdk.appStorage.getItem('godbox-world-v1');
  }
  adsRequired() {
    if (this.status !== 'ready' || !this.sdk) return false;
    try {
      return adsSupported({ hosted: this.hosted, mock: this.sdk.isMock?.() === true, env: this.sdk.system.getEnvironment() });
    } catch { return false; }
  }
  async watchRewarded(rate) {
    const placement = SPEED_ADS[rate];
    if (!placement || this.adBusy) return false;
    if (!this.adsRequired()) return true;
    this.adBusy = true;
    try {
      const { earned } = await watchRewardedAd(this.sdk.ads, placement);
      return earned === true;
    } finally { this.adBusy = false; }
  }
  dispose() { for (const sub of this.subscriptions) sub.unsubscribe(); }
}
