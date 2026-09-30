import { describe, it, expect } from 'vitest';
import { encodeWav, CAPTURE_CHUNK_SIZE, PCM_CAPTURE_WORKLET } from './audioCapture';

const readAscii = (view, position, length) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(position + i)));

describe('encodeWav', () => {
  it('writes a valid 16 kHz mono 16-bit PCM WAV header', () => {
    const wav = encodeWav([new Float32Array(48000)], 48000);
    const view = new DataView(wav);
    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(readAscii(view, 8, 4)).toBe('WAVE');
    expect(readAscii(view, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);      // PCM
    expect(view.getUint16(22, true)).toBe(1);      // mono
    expect(view.getUint32(24, true)).toBe(16000);  // downsampled rate
    expect(view.getUint16(34, true)).toBe(16);     // bits per sample
    expect(view.getUint32(40, true)).toBe(16000 * 2);
    expect(wav.byteLength).toBe(44 + 16000 * 2);
  });

  it('merges chunks in order and downsamples 48 kHz to 16 kHz', () => {
    const first = new Float32Array(3).fill(0.5);
    const second = new Float32Array(3).fill(-0.5);
    const samples = new Int16Array(encodeWav([first, second], 48000), 44);
    expect(Array.from(samples)).toEqual([Math.trunc(0.5 * 0x7fff), -0.5 * 0x8000]);
  });

  it('clamps out-of-range samples and never upsamples', () => {
    const wav = encodeWav([Float32Array.from([2, -2])], 8000);
    const view = new DataView(wav);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(Array.from(new Int16Array(wav, 44))).toEqual([0x7fff, -0x8000]);
  });

  it('produces an empty data chunk for no audio', () => {
    const wav = encodeWav([], 48000);
    expect(wav.byteLength).toBe(44);
    expect(new DataView(wav).getUint32(40, true)).toBe(0);
  });
});

describe('PCM_CAPTURE_WORKLET', () => {
  it('registers the capture processor with the shared chunk size', () => {
    expect(PCM_CAPTURE_WORKLET).toContain("registerProcessor('aura-pcm-capture'");
    expect(PCM_CAPTURE_WORKLET).toContain(`new Float32Array(${CAPTURE_CHUNK_SIZE})`);
  });
});
