import { describe, it, expect } from 'vitest';
import {
  startOceanWaves,
  startBinauralBeats,
  AMBIENT_SOUNDS,
  WAVES_CUTOFF_HZ,
  WAVES_BASE_GAIN,
  WAVES_SWELL_GAIN,
  BINAURAL_TONE_GAIN
} from './ambientAudio';

// Minimal stand-in for the Web Audio API that records what was built, started and stopped
function makeFakeContext() {
  const created = { oscillators: [], sources: [], filters: [], gains: [] };
  const node = (extra = {}) => ({
    connections: [],
    disconnected: false,
    connect(target) { this.connections.push(target); },
    disconnect() { this.disconnected = true; },
    ...extra
  });
  const playable = (extra = {}) => node({
    started: false,
    stopped: false,
    start() { this.started = true; },
    stop() { this.stopped = true; },
    ...extra
  });
  const ctx = {
    sampleRate: 8000,
    destination: node(),
    createBuffer: (channels, length, sampleRate) => {
      const data = new Float32Array(length);
      return { channels, length, sampleRate, getChannelData: () => data };
    },
    createBufferSource: () => { const n = playable({ buffer: null, loop: false }); created.sources.push(n); return n; },
    createOscillator: () => { const n = playable({ type: '', frequency: { value: 0 } }); created.oscillators.push(n); return n; },
    createBiquadFilter: () => { const n = node({ type: '', frequency: { value: 0 } }); created.filters.push(n); return n; },
    createGain: () => { const n = node({ gain: { value: 1 } }); created.gains.push(n); return n; },
    createChannelMerger: () => node()
  };
  return { ctx, created };
}

describe('startBinauralBeats', () => {
  it('plays 200 Hz and 210 Hz tones for a 10 Hz beat', () => {
    const { ctx, created } = makeFakeContext();
    startBinauralBeats(ctx);
    const frequencies = created.oscillators.map(o => o.frequency.value);
    expect(frequencies).toEqual([200, 210]);
    expect(frequencies[1] - frequencies[0]).toBe(10);
    expect(created.oscillators.every(o => o.started && o.type === 'sine')).toBe(true);
  });

  it('stops both tones when the returned function is called', () => {
    const { ctx, created } = makeFakeContext();
    const stop = startBinauralBeats(ctx);
    expect(created.oscillators.some(o => o.stopped)).toBe(false);
    stop();
    expect(created.oscillators.every(o => o.stopped)).toBe(true);
  });
});

describe('startOceanWaves', () => {
  it('loops two seconds of filtered noise with a slow swell', () => {
    const { ctx, created } = makeFakeContext();
    startOceanWaves(ctx);
    const [noise] = created.sources;
    expect(noise.loop).toBe(true);
    expect(noise.started).toBe(true);
    expect(noise.buffer.length).toBe(ctx.sampleRate * 2);
    expect(created.filters[0]).toMatchObject({ type: 'lowpass', frequency: { value: WAVES_CUTOFF_HZ } });
    expect(created.oscillators[0].frequency.value).toBeLessThan(1); // the swell is far below hearing range
  });

  it('fills the noise buffer with samples between -1 and 1', () => {
    const { ctx, created } = makeFakeContext();
    startOceanWaves(ctx);
    const samples = created.sources[0].buffer.getChannelData(0);
    expect(samples.some(s => s !== 0)).toBe(true);
    expect(samples.every(s => s >= -1 && s <= 1)).toBe(true);
  });

  it('stops the noise and the swell when the returned function is called', () => {
    const { ctx, created } = makeFakeContext();
    const stop = startOceanWaves(ctx);
    stop();
    expect(created.sources[0].stopped).toBe(true);
    expect(created.oscillators[0].stopped).toBe(true);
  });
});

describe('audible levels', () => {
  it('keeps the waves audible between swells (the swell never cancels the base level)', () => {
    expect(WAVES_SWELL_GAIN).toBeLessThan(WAVES_BASE_GAIN);
    expect(WAVES_BASE_GAIN - WAVES_SWELL_GAIN).toBeGreaterThan(0.05);
  });

  it('plays well above the old near-silent levels without clipping', () => {
    expect(WAVES_BASE_GAIN).toBeGreaterThanOrEqual(0.2);
    expect(WAVES_BASE_GAIN + WAVES_SWELL_GAIN).toBeLessThan(1);
    expect(BINAURAL_TONE_GAIN).toBeGreaterThanOrEqual(0.1);
    expect(BINAURAL_TONE_GAIN).toBeLessThanOrEqual(0.3);
  });

  it('gives both ears the same tone level', () => {
    const { ctx, created } = makeFakeContext();
    startBinauralBeats(ctx);
    expect(created.gains.filter(g => g.gain.value === BINAURAL_TONE_GAIN)).toHaveLength(2);
  });
});

describe('AMBIENT_SOUNDS', () => {
  it('offers ocean waves and binaural beats', () => {
    expect(Object.keys(AMBIENT_SOUNDS)).toEqual(['waves', 'binaural']);
  });
});
