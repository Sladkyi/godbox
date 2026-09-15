const STINGS = {
  world: { f: 180, t: .35, type: 'sine', vol: .08 },
  village: { f: 320, t: .4, type: 'triangle', vol: .09 },
  scout: { f: 420, t: .45, type: 'sine', vol: .08 },
  border: { f: 210, t: .3, type: 'square', vol: .05 },
  raid: { f: 90, t: .35, type: 'sawtooth', vol: .07 },
  spy: { f: 140, t: .4, type: 'triangle', vol: .07 },
  war: { f: 70, t: .55, type: 'square', vol: .08 },
  siege: { f: 64, t: .5, type: 'sawtooth', vol: .08 },
  peace: { f: 260, t: .5, type: 'sine', vol: .07 },
  birth: { f: 640, t: .35, type: 'sine', vol: .07 },
  death: { f: 90, t: .7, type: 'sine', vol: .1 },
  family: { f: 480, t: .4, type: 'triangle', vol: .07 },
  cult: { f: 300, t: .7, type: 'sine', vol: .09 },
  wrath: { f: 48, t: .8, type: 'sawtooth', vol: .1 },
  disaster: { f: 40, t: .9, type: 'sawtooth', vol: .11 },
  omen: { f: 110, t: .8, type: 'triangle', vol: .08 },
  wolves: { f: 220, t: .9, type: 'sawtooth', vol: .09 },
  drought: { f: 160, t: .6, type: 'sine', vol: .06 },
  trade: { f: 520, t: .25, type: 'triangle', vol: .07 },
  ally: { f: 380, t: .4, type: 'sine', vol: .08 },
  gift: { f: 500, t: .45, type: 'sine', vol: .08 },
  refuge: { f: 150, t: .5, type: 'triangle', vol: .07 },
};

const MOOD = {
  calm: { cut: 280, a: 54, b: 81, noise: .035 },
  forest: { cut: 210, a: 46, b: 69, noise: .055 },
  tense: { cut: 150, a: 40, b: 92, noise: .07 },
  war: { cut: 170, a: 36, b: 48, noise: .08 },
  fire: { cut: 380, a: 32, b: 118, noise: .13 },
};

export function moodOf(world) {
  const s = world.stats();
  if (s.burning > 4) return 'fire';
  if (world.villages.some(v => (v.wars ?? []).length)) return 'war';
  if (world.story?.pending || world.units.some(u => u.kind === 'wolf' && world.units.some(a => a.kind === 'sheep' || a.kind === 'human'))) return 'tense';
  if (s.forests > s.land * .28) return 'forest';
  return 'calm';
}

export class Soundscape {
  constructor() {
    this.muted = (typeof localStorage !== 'undefined' && localStorage.getItem('godbox-mute') === '1');
    this.ctx = null;
    this.started = false;
    this.lastKey = '';
    this.mood = 'calm';
  }
  async unlock() {
    if (this.muted || typeof AudioContext === 'undefined') return;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.started) this.startAmbient();
  }
  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('godbox-mute', this.muted ? '1' : '0'); } catch { /* private mode */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : .2, this.ctx?.currentTime ?? 0, .05);
    if (!this.muted) void this.unlock();
    return this.muted;
  }
  startAmbient() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : .2;
    this.master.connect(ctx.destination);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 280;
    this.filter.connect(this.master);
    this.oscA = ctx.createOscillator(); this.oscA.type = 'sine'; this.oscA.frequency.value = 54;
    this.gainA = ctx.createGain(); this.gainA.gain.value = .14;
    this.oscA.connect(this.gainA).connect(this.filter);
    this.oscB = ctx.createOscillator(); this.oscB.type = 'triangle'; this.oscB.frequency.value = 81;
    this.gainB = ctx.createGain(); this.gainB.gain.value = .07;
    this.oscB.connect(this.gainB).connect(this.filter);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter(); this.noiseFilter.type = 'bandpass'; this.noiseFilter.frequency.value = 700;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = .035;
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.filter);
    this.oscA.start(); this.oscB.start(); this.noise.start();
    this.started = true;
  }
  setMood(mood) {
    this.mood = mood;
    if (!this.started || this.muted) return;
    const spec = MOOD[mood] ?? MOOD.calm;
    const t = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(spec.cut, t, .4);
    this.oscA.frequency.setTargetAtTime(spec.a, t, .45);
    this.oscB.frequency.setTargetAtTime(spec.b, t, .45);
    this.noiseGain.gain.setTargetAtTime(spec.noise, t, .4);
  }
  sting(type) {
    if (!this.started || this.muted) return;
    const spec = STINGS[type] ?? STINGS.world;
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = spec.type; osc.frequency.value = spec.f;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(spec.vol, t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + spec.t);
    osc.connect(gain).connect(this.master);
    if (type === 'wolves' || type === 'omen') osc.frequency.exponentialRampToValueAtTime(Math.max(40, spec.f * .45), t + spec.t);
    if (type === 'disaster' || type === 'wrath') {
      const noise = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * spec.t, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      noise.buffer = buf;
      const ng = ctx.createGain(); ng.gain.value = .12;
      noise.connect(ng).connect(this.master); noise.start(); noise.stop(t + spec.t);
    }
    osc.start(t); osc.stop(t + spec.t + .05);
  }
  tick(world) {
    this.setMood(moodOf(world));
    const e = world.events[0];
    const key = e ? `${e.year}:${e.type}:${e.message.slice(0, 32)}` : '';
    if (key && key !== this.lastKey) {
      this.lastKey = key;
      this.sting(e.type);
    }
  }
  dispose() {
    try { this.oscA?.stop(); this.oscB?.stop(); this.noise?.stop(); this.ctx?.close(); } catch { /* already closed */ }
    this.started = false;
  }
}
