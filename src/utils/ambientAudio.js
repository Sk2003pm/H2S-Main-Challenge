// Ambient sounds synthesised with the Web Audio API (no audio files to download).
// Shared by the Focus timer and the breathing guide.
import { useState, useRef, useEffect } from 'react';

// Levels are set to be clearly audible on laptop speakers at a normal volume setting. (The first version peaked
// around -40 dBFS, all below 350 Hz, which small speakers barely reproduce, so it sounded like nothing was playing.)
export const WAVES_CUTOFF_HZ = 1000;  // bright enough for small speakers, still a soft wash
export const WAVES_BASE_GAIN = 0.3;   // level between waves
export const WAVES_SWELL_GAIN = 0.22; // how much each wave rises and falls (less than the base, so it never cuts out)
export const WAVES_SWELL_HZ = 0.1;    // one wave every 10 seconds
export const BINAURAL_TONE_GAIN = 0.12;
const FADE_IN_SECONDS = 0.4;

// Output stage that fades the sound in, so starting it never clicks
function createFadeIn(ctx) {
  const fade = ctx.createGain();
  fade.gain.value = 0;
  if (fade.gain.setValueAtTime && fade.gain.linearRampToValueAtTime) {
    const now = ctx.currentTime || 0;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + FADE_IN_SECONDS);
  } else {
    fade.gain.value = 1;
  }
  fade.connect(ctx.destination);
  return fade;
}

/**
 * Ocean waves: looped white noise through a low-pass filter, with a slow LFO swelling the volume.
 * @param {AudioContext} ctx
 * @returns {Function} Call to stop the sound.
 */
export function startOceanWaves(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = WAVES_CUTOFF_HZ;

  const waveGain = ctx.createGain();
  waveGain.gain.value = WAVES_BASE_GAIN;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = WAVES_SWELL_HZ;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = WAVES_SWELL_GAIN;

  lfo.connect(lfoGain);
  lfoGain.connect(waveGain.gain);

  const fadeIn = createFadeIn(ctx);
  noiseSource.connect(lowpass);
  lowpass.connect(waveGain);
  waveGain.connect(fadeIn);

  noiseSource.start();
  lfo.start();

  return () => {
    noiseSource.stop();
    lfo.stop();
    fadeIn.disconnect();
  };
}

/**
 * Binaural beats: 200 Hz in the left ear and 210 Hz in the right, heard as a 10 Hz alpha beat (needs headphones).
 * @param {AudioContext} ctx
 * @returns {Function} Call to stop the sound.
 */
export function startBinauralBeats(ctx) {
  const merger = ctx.createChannelMerger(2);

  const oscL = ctx.createOscillator();
  oscL.frequency.value = 200;
  oscL.type = 'sine';

  const oscR = ctx.createOscillator();
  oscR.frequency.value = 210; // creates 10Hz Alpha focus beats
  oscR.type = 'sine';

  const gainL = ctx.createGain();
  const gainR = ctx.createGain();
  gainL.gain.value = BINAURAL_TONE_GAIN;
  gainR.gain.value = BINAURAL_TONE_GAIN;

  oscL.connect(gainL);
  oscR.connect(gainR);

  gainL.connect(merger, 0, 0);
  gainR.connect(merger, 0, 1);

  const fadeIn = createFadeIn(ctx);
  merger.connect(fadeIn);

  oscL.start();
  oscR.start();

  return () => {
    oscL.stop();
    oscR.stop();
    fadeIn.disconnect();
  };
}

export const AMBIENT_SOUNDS = {
  waves: startOceanWaves,
  binaural: startBinauralBeats
};

/**
 * One ambient sound at a time for a component, stopped automatically when the component unmounts.
 * @returns {{soundPlaying: ('waves'|'binaural'|null), toggleSound: Function, stopSound: Function}}
 */
export function useAmbientSound() {
  const [soundPlaying, setSoundPlaying] = useState(null); // 'waves', 'binaural', null
  const audioCtxRef = useRef(null);
  const stopRef = useRef(null);

  const silence = () => {
    if (stopRef.current) {
      try {
        stopRef.current();
      } catch (e) {}
      stopRef.current = null;
    }
  };

  const stopSound = () => {
    silence();
    setSoundPlaying(null);
  };

  // Play the sound, or stop it if it is the one already playing
  const toggleSound = (soundType) => {
    const start = AMBIENT_SOUNDS[soundType];
    if (soundPlaying === soundType || !start) {
      stopSound();
      return;
    }
    silence();
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      stopRef.current = start(audioCtxRef.current);
      setSoundPlaying(soundType);
    } catch (e) {
      console.error(e);
      setSoundPlaying(null);
    }
  };

  useEffect(() => {
    return () => {
      silence();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { soundPlaying, toggleSound, stopSound };
}
