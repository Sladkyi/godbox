export const SPEED_ADS = {
  2: { adDisplayId: 'godbox_speed_2x', adDisplayName: '2x World Speed' },
  5: { adDisplayId: 'godbox_speed_5x', adDisplayName: '5x World Speed' },
};

export function adsSupported({ hosted = false, mock = false, env = null } = {}) {
  if (!hosted || mock) return false;
  if (env?.platform !== 'ios' && env?.platform !== 'android') return false;
  return env?.capabilities?.ads !== false;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function watchRewardedAd(ads, placement, timeouts = {}) {
  const readyTimeout = timeouts.readyTimeout ?? 8000;
  const showTimeout = timeouts.showTimeout ?? 120000;
  if (!ads?.isRewardedAdReadyAsync || !ads?.showRewardedAdAsync || !placement) {
    return { earned: false, status: 'unsupported' };
  }
  try {
    if (await withTimeout(ads.isRewardedAdReadyAsync(), readyTimeout, 'Ad ready timed out') !== true) {
      return { earned: false, status: 'unavailable' };
    }
    const earned = await withTimeout(ads.showRewardedAdAsync(placement), showTimeout, 'Ad timed out') === true;
    return { earned, status: earned ? 'earned' : 'skipped' };
  } catch {
    return { earned: false, status: 'unavailable' };
  }
}
