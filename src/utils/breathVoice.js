// Timing and voice-over for the breathing exercises.
// The bubble and the spoken guide both follow one session clock, and that clock is re-locked to the voice
// every time a cue starts, so the two cannot drift apart.

// Slower than normal speech so the guide sounds calm (cues are a word or two, so they still finish early in a phase)
export const BREATH_VOICE_RATE = 0.85;
// "Get ready" time between pressing Begin and the first inhale (also lets the speech engine warm up)
export const BREATH_LEAD_IN_MS = 3000;
// Spoken during the lead-in
export const BREATH_INTRO_CUE = "Let's begin.";
// Speech engines start talking a moment after speak() is called. Each cue is sent this much before its phase
// starts so the word lands on the phase change; the value is then refined from the measured start-up delay.
export const DEFAULT_VOICE_LEAD_MS = 300;
export const MAX_VOICE_LEAD_MS = 800;
// The bubble changes phase the instant the voice starts. If the voice is late, the bubble waits at most this long for it.
export const MAX_VOICE_WAIT_MS = 600;

/**
 * Session time at which a phase starts (the counterpart of getBreathPosition().phase).
 * @param {Array<{duration: number}>} sequence - Phases of one cycle, durations in seconds.
 * @param {number} phase - Phase number counted across cycles (0 = the first inhale).
 * @returns {number} Milliseconds since the first inhale started.
 */
export function getPhaseStartMs(sequence, phase) {
  const cycleMs = sequence.reduce((sum, step) => sum + step.duration * 1000, 0);
  let startMs = Math.floor(phase / sequence.length) * cycleMs;
  for (let i = 0; i < phase % sequence.length; i++) {
    startMs += sequence[i].duration * 1000;
  }
  return startMs;
}

/**
 * Works out where a breathing session is at a given moment on the session clock.
 * @param {Array<{duration: number}>} sequence - Phases of one cycle, durations in seconds.
 * @param {number} elapsedMs - Milliseconds since the first inhale started.
 * @returns {{cycle: number, stepIdx: number, phase: number, secondsRemaining: number, nextPhaseAtMs: number}}
 *   cycle = completed cycles; phase = phases started before the current one (across cycles);
 *   nextPhaseAtMs = session time at which the next phase starts.
 */
export function getBreathPosition(sequence, elapsedMs) {
  const stepMs = (idx) => sequence[idx].duration * 1000;
  const cycleMs = sequence.reduce((sum, step) => sum + step.duration * 1000, 0);
  const elapsed = Math.max(0, elapsedMs);
  const cycle = Math.floor(elapsed / cycleMs);
  let intoStep = elapsed - cycle * cycleMs;
  let stepIdx = 0;
  while (stepIdx < sequence.length - 1 && intoStep >= stepMs(stepIdx)) {
    intoStep -= stepMs(stepIdx);
    stepIdx++;
  }
  return {
    cycle,
    stepIdx,
    phase: cycle * sequence.length + stepIdx,
    secondsRemaining: Math.max(1, Math.ceil((stepMs(stepIdx) - intoStep) / 1000)),
    nextPhaseAtMs: elapsed - intoStep + stepMs(stepIdx)
  };
}

/**
 * Refines how early cues are sent, from how long the speech engine just took to start talking.
 * @param {number} currentLeadMs - Lead time in use.
 * @param {number} measuredDelayMs - Time from speak() to the utterance's start event.
 * @returns {number} The lead time to use for the next cue.
 */
export function nextVoiceLead(currentLeadMs, measuredDelayMs) {
  if (!Number.isFinite(measuredDelayMs) || measuredDelayMs < 0) return currentLeadMs;
  // Average with the previous value so one slow start doesn't throw the next cue off
  return Math.min(MAX_VOICE_LEAD_MS, (currentLeadMs + measuredDelayMs) / 2);
}

/**
 * Builds the line spoken when the student stops the session.
 * @param {number} cyclesCompleted - Full breathing cycles finished in this session.
 * @returns {string}
 */
export function buildSessionEndCue(cyclesCompleted) {
  if (!cyclesCompleted || cyclesCompleted < 1) return 'Session ended.';
  return `Well done. You completed ${cyclesCompleted} ${cyclesCompleted === 1 ? 'cycle' : 'cycles'}.`;
}

/**
 * Picks the most natural-sounding English voice the browser offers (null = use the browser default).
 * @param {SpeechSynthesisVoice[]} voices - From speechSynthesis.getVoices(); may be empty while voices load.
 * @returns {SpeechSynthesisVoice|null}
 */
export function pickCalmVoice(voices) {
  if (!Array.isArray(voices)) return null;
  const english = voices.filter(v => typeof v?.lang === 'string' && v.lang.toLowerCase().startsWith('en'));
  return english.find(v => /natural|google|microsoft/i.test(v.name || '')) || english[0] || null;
}
