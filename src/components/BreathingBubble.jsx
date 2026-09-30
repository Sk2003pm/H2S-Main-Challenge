import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Wind, Play, Square, Volume2, VolumeX } from 'lucide-react';
import {
  getBreathPosition,
  getPhaseStartMs,
  nextVoiceLead,
  buildSessionEndCue,
  pickCalmVoice,
  BREATH_VOICE_RATE,
  BREATH_LEAD_IN_MS,
  BREATH_INTRO_CUE,
  DEFAULT_VOICE_LEAD_MS,
  MAX_VOICE_WAIT_MS
} from '../utils/breathVoice';
import { useAmbientSound } from '../utils/ambientAudio';

// `voice` is the cue read aloud as the phase starts: a word or two, so it is over long before the next phase
const BREATH_MODES = {
  BOX: {
    name: 'Box Breathing (4-4-4-4)',
    description: 'Used by high-performers & Navy SEALs to relieve acute stress and restore focus.',
    sequence: [
      { action: 'Inhale', duration: 4, scale: 1.2, color: '#f43f5e', voice: 'Breathe in' },
      { action: 'Hold', duration: 4, scale: 1.2, color: '#8b5cf6', voice: 'Hold' },
      { action: 'Exhale', duration: 4, scale: 0.85, color: '#6366f1', voice: 'Breathe out' },
      { action: 'Hold', duration: 4, scale: 0.85, color: '#1e1b4b', voice: 'Hold' }
    ]
  },
  CALM: {
    name: 'Relaxation Breathing (4-7-8)',
    description: 'A classic pranayama technique that acts as a natural nervous system tranquilizer.',
    sequence: [
      { action: 'Inhale', duration: 4, scale: 1.2, color: '#f43f5e', voice: 'Breathe in' },
      { action: 'Hold', duration: 7, scale: 1.2, color: '#8b5cf6', voice: 'Hold' },
      { action: 'Exhale', duration: 8, scale: 0.85, color: '#6366f1', voice: 'Breathe out slowly' }
    ]
  }
};

const VOICE_PREF_KEY = 'mindalign_breath_voice';
// Relative heights of the voice-over level bars
const VOICE_BARS = [0.45, 0.65, 0.8, 0.65, 0.45];
// How often the session clock is read (keeps the bubble and the voice within a frame or two of each other)
const TICK_MS = 40;

export default function BreathingBubble({ onCycleComplete, onTriggerAlert }) {
  const [modeKey, setModeKey] = useState('BOX');
  const [isPlaying, setIsPlaying] = useState(false);
  // "Get ready" countdown between pressing Begin and the first inhale
  const [isPreparing, setIsPreparing] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(BREATH_MODES.BOX.sequence[0].duration);
  const [totalCyclesCompleted, setTotalCyclesCompleted] = useState(0);
  // Voice-over guide: on unless the student turned it off earlier
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  });
  const [voiceCaption, setVoiceCaption] = useState('');
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  // Optional background sound under the voice (same synthesised sounds as the Focus timer)
  const { soundPlaying, toggleSound, stopSound } = useAmbientSound();

  const utteranceRef = useRef(null);
  // One clock for the whole session: the bubble, the countdown and the voice are all derived from `startAt`
  // (the moment the first inhale starts), so they cannot drift apart however long the session runs.
  // `pendingPhase` is the phase whose cue has been sent to the speech engine but is not audible yet.
  const sessionRef = useRef({ sequence: BREATH_MODES.BOX.sequence, startAt: 0, announcedPhase: -1, pendingPhase: null, captionPhase: -1, cyclesAwarded: 0 });
  const voiceLeadRef = useRef(DEFAULT_VOICE_LEAD_MS);
  const tickRef = useRef(null);
  // The clock callback outlives the render that created it, so it reads live values from refs
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const onCycleCompleteRef = useRef(onCycleComplete);
  onCycleCompleteRef.current = onCycleComplete;

  const mode = BREATH_MODES[modeKey];
  const currentStep = mode.sequence[currentStepIdx];
  const isBreathing = isPlaying && !isPreparing;
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

  // Read a cue aloud; its caption appears the moment the voice actually starts.
  // `phase` is the breathing phase the cue belongs to (omitted for the intro and the closing line).
  // Returns true when the cue was handed to the speech engine.
  const speakCue = (text, phase) => {
    if (!voiceSupported || !text) return false;
    const synth = window.speechSynthesis;
    const session = sessionRef.current;
    // Breathing cues queue behind whatever is still being said (only the short intro can overlap them);
    // the closing line replaces it. Cancelling an idle engine would only delay the next cue in Chromium.
    const wasBusy = synth.speaking || synth.pending;
    if (phase === undefined && wasBusy) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickCalmVoice(synth.getVoices());
    if (voice) utterance.voice = voice;
    utterance.rate = BREATH_VOICE_RATE;
    const spokenAt = performance.now();
    utterance.onstart = () => {
      if (utteranceRef.current !== utterance) return; // replaced by a newer cue
      if (phase !== undefined && sessionRef.current === session) {
        const now = performance.now();
        // Learn how long this engine takes to start talking, so the next cue is sent that early
        // (a cue that had to queue behind the intro says nothing about the engine)
        if (!wasBusy) voiceLeadRef.current = nextVoiceLead(voiceLeadRef.current, now - spokenAt);
        if (session.pendingPhase === phase) {
          // Lock the bubble to the voice: this phase begins at the instant its cue becomes audible
          session.startAt = now - getPhaseStartMs(session.sequence, phase);
          session.pendingPhase = null;
        }
        session.captionPhase = phase;
      }
      setVoiceCaption(text);
      setIsVoiceSpeaking(true);
      if (tickRef.current) tickRef.current(); // move the bubble now, not on the next tick
    };
    const finish = () => {
      // A cue that failed before it started must not keep the bubble waiting
      if (phase !== undefined && session.pendingPhase === phase) session.pendingPhase = null;
      if (utteranceRef.current === utterance) setIsVoiceSpeaking(false);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    utteranceRef.current = utterance; // also keeps the utterance alive until it finishes
    synth.speak(utterance);
    return true;
  };

  const stopVoice = () => {
    utteranceRef.current = null;
    sessionRef.current.pendingPhase = null;
    if (voiceSupported) window.speechSynthesis.cancel();
    setIsVoiceSpeaking(false);
    setVoiceCaption('');
  };

  // Award XP and save the cycle counter to local storage
  const recordCycle = () => {
    if (onCycleCompleteRef.current) onCycleCompleteRef.current();
    try {
      const activeUser = localStorage.getItem('mindalign_active_user') || 'default';
      const storedBreaths = localStorage.getItem(`mindalign_breath_cycles_${activeUser}`) || '0';
      localStorage.setItem(`mindalign_breath_cycles_${activeUser}`, String(Number(storedBreaths) + 1));
    } catch (e) {}
  };

  // Never keep talking after the student leaves the Breathing tab
  useEffect(() => {
    return () => {
      utteranceRef.current = null;
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Session clock: every tick reads the time and derives the phase, the countdown and the next voice cue from it
  useEffect(() => {
    if (!isPlaying) return;
    const sequence = BREATH_MODES[modeKey].sequence;
    const session = sessionRef.current;

    const tick = () => {
      let elapsed = performance.now() - session.startAt; // negative during the "get ready" lead-in

      // A cue is on its way: the bubble changes phase when the voice starts (see speakCue), so if the voice is
      // a little late, hold the current phase for it rather than letting the bubble run ahead.
      if (session.pendingPhase !== null) {
        const boundary = getPhaseStartMs(sequence, session.pendingPhase);
        if (elapsed >= boundary) {
          if (elapsed - boundary < MAX_VOICE_WAIT_MS) {
            elapsed = boundary - 1;
          } else {
            // The voice never started: carry on without it, starting the phase now
            session.startAt += elapsed - boundary;
            session.pendingPhase = null;
            elapsed = boundary;
          }
        }
      }
      const position = elapsed < 0 ? null : getBreathPosition(sequence, elapsed);

      // Voice-over: send the next phase's cue early by the speech engine's usual start-up delay, so it becomes
      // audible right on the phase change. A cue that is already late is skipped, never spoken late.
      const upcomingPhase = position ? position.phase + 1 : 0;
      const upcomingAt = position ? position.nextPhaseAtMs : 0;
      if (voiceOnRef.current && session.announcedPhase < upcomingPhase && elapsed >= upcomingAt - voiceLeadRef.current) {
        session.announcedPhase = upcomingPhase;
        if (speakCue(sequence[upcomingPhase % sequence.length].voice, upcomingPhase)) {
          session.pendingPhase = upcomingPhase;
        }
      }

      if (!position) {
        setIsPreparing(true);
        setSecondsRemaining(Math.ceil(-elapsed / 1000));
        return;
      }
      setIsPreparing(false);
      setCurrentStepIdx(position.stepIdx);
      setSecondsRemaining(position.secondsRemaining);
      setTotalCyclesCompleted(position.cycle);
      while (session.cyclesAwarded < position.cycle) {
        session.cyclesAwarded++;
        recordCycle();
      }
      // Caption safety net: if the engine never reported that the cue started, still show it on the phase change
      if (voiceOnRef.current && session.captionPhase < position.phase) {
        session.captionPhase = position.phase;
        setVoiceCaption(sequence[position.stepIdx].voice);
      }
    };

    tickRef.current = tick;
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      tickRef.current = null;
    };
  }, [isPlaying, modeKey]);

  const handleStartStop = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setIsPreparing(false);
      setCurrentStepIdx(0);
      setSecondsRemaining(mode.sequence[0].duration);
      if (voiceOn) speakCue(buildSessionEndCue(totalCyclesCompleted));
      if (onTriggerAlert) {
        onTriggerAlert(
          "Breathing Stopped",
          `Session ended. You completed ${totalCyclesCompleted} cycles this turn! Short breathing patterns help oxygenate the cortex for better exam concentration.`
        );
      }
    } else {
      sessionRef.current = {
        sequence: mode.sequence,
        startAt: performance.now() + BREATH_LEAD_IN_MS,
        announcedPhase: -1,
        pendingPhase: null,
        captionPhase: -1,
        cyclesAwarded: 0
      };
      setIsPreparing(true);
      setIsPlaying(true);
      setCurrentStepIdx(0);
      setSecondsRemaining(Math.ceil(BREATH_LEAD_IN_MS / 1000));
      setTotalCyclesCompleted(0);
      // Spoken inside the click, which also warms up the speech engine before the first breathing cue
      if (voiceOn) speakCue(BREATH_INTRO_CUE);
    }
  };

  const handleVoiceToggle = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      localStorage.setItem(VOICE_PREF_KEY, next ? 'on' : 'off');
    } catch (e) {}
    if (!next) stopVoice();
  };

  const handleModeChange = (key) => {
    stopVoice();
    setIsPlaying(false);
    setIsPreparing(false);
    setModeKey(key);
    setCurrentStepIdx(0);
    setSecondsRemaining(BREATH_MODES[key].sequence[0].duration);
    setTotalCyclesCompleted(0);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wind className="text-rose" style={{ width: 24, height: 24 }} />
          <h3>Mindful Breathing</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-secondary ${modeKey === 'BOX' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: modeKey === 'BOX' ? '1px solid var(--accent-rose)' : '' }}
            onClick={() => handleModeChange('BOX')}
            disabled={isPlaying}
            aria-pressed={modeKey === 'BOX'}
            aria-label="Box breathing mode, four-four-four-four pattern"
          >
            Box (4-4-4-4)
          </button>
          <button
            className={`btn btn-secondary ${modeKey === 'CALM' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: modeKey === 'CALM' ? '1px solid var(--accent-rose)' : '' }}
            onClick={() => handleModeChange('CALM')}
            disabled={isPlaying}
            aria-pressed={modeKey === 'CALM'}
            aria-label="Relaxation breathing mode, four-seven-eight pattern"
          >
            Relax (4-7-8)
          </button>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
        {mode.description}
      </p>

      <div className="breath-circle-container">
        <div
          className="breath-circle"
          style={{
            transform: isBreathing ? `scale(${currentStep.scale})` : 'scale(1)',
            backgroundColor: isBreathing ? currentStep.color : 'rgba(255, 255, 255, 0.05)',
            border: isBreathing ? 'none' : '2px dashed var(--accent-rose)',
            transition: isBreathing ? `transform ${currentStep.duration}s linear, background-color 0.5s ease` : 'all 0.5s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            width: '160px',
            height: '160px',
            boxShadow: isBreathing ? `0 0 40px ${currentStep.color}66` : 'none'
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            {isBreathing ? currentStep.action : (isPlaying ? 'Get ready' : 'Ready')}
          </span>
          <span style={{ fontSize: '1rem', opacity: 0.8 }}>
            {isPlaying ? `${secondsRemaining}s` : 'Focus'}
          </span>
        </div>
      </div>

      {/* Voice-over caption: what the guide is saying right now, with level bars that move while it speaks */}
      {voiceOn && voiceCaption && (isPlaying || isVoiceSpeaking) && (
        <div className="flex-center">
          <div className={`speech-status-pill ${isVoiceSpeaking ? 'speaking' : ''}`}>
            <div className={`voice-level-meter ${isVoiceSpeaking ? 'speaking' : ''}`} aria-hidden="true">
              {VOICE_BARS.map((weight, i) => (
                <span key={i} className="voice-level-bar" style={{ '--bar-weight': weight, '--bar-index': i }} />
              ))}
            </div>
            <span>{voiceCaption}</span>
          </div>
        </div>
      )}

      <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {isPlaying ? (
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cycles Completed: </span>
            <strong style={{ color: 'var(--accent-rose)', fontSize: '1.1rem' }}>{totalCyclesCompleted}</strong>
            <span className="badge badge-success" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>+30 XP each!</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Click begin to start breathing guide</span>
        )}
      </div>

      <div className="flex-center" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleStartStop}
          className={`btn ${isPlaying ? 'btn-secondary' : 'btn-rose'}`}
          style={{ width: '100%', maxWidth: '240px' }}
        >
          {isPlaying ? (
            <>
              <Square size={16} /> Stop Session
            </>
          ) : (
            <>
              <Play size={16} /> Begin Breathing
            </>
          )}
        </button>
        {voiceSupported && (
          <button
            onClick={handleVoiceToggle}
            className="btn btn-secondary"
            style={{ border: voiceOn ? '1px solid var(--accent-rose)' : '' }}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Turn off the spoken breathing guide" : "Turn on the spoken breathing guide"}
          >
            {voiceOn ? (
              <>
                <Volume2 size={16} /> Voice guide on
              </>
            ) : (
              <>
                <VolumeX size={16} /> Voice guide off
              </>
            )}
          </button>
        )}
      </div>

      {/* Background Audio Synthesizer Controls (the same sounds as the Focus timer) */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>
          Calming Synthesized Audio
        </span>
        <div className="sound-toggle-grid">
          <button
            className={`sound-btn ${soundPlaying === 'waves' ? 'active' : ''}`}
            onClick={() => toggleSound('waves')}
            aria-pressed={soundPlaying === 'waves'}
            aria-label="Toggle synthesized ocean waves background sound"
          >
            <Volume2 size={16} />
            <span style={{ fontSize: '0.75rem' }}>Ocean Waves</span>
          </button>
          <button
            className={`sound-btn ${soundPlaying === 'binaural' ? 'active' : ''}`}
            onClick={() => toggleSound('binaural')}
            aria-pressed={soundPlaying === 'binaural'}
            aria-label="Toggle synthesized ten hertz alpha binaural beats sound"
          >
            <Volume2 size={16} />
            <span style={{ fontSize: '0.75rem' }}>Binaural 10Hz</span>
          </button>
          <button
            className="sound-btn"
            style={{ opacity: soundPlaying ? 1 : 0.5 }}
            onClick={stopSound}
            disabled={!soundPlaying}
            aria-label="Mute background audio"
          >
            <VolumeX size={16} />
            <span style={{ fontSize: '0.75rem' }}>Mute</span>
          </button>
        </div>
      </div>
    </div>
  );
}

BreathingBubble.propTypes = {
  /** Called when a full breathing cycle completes, to award XP. */
  onCycleComplete: PropTypes.func,
  /** Callback to display alert dialogs in the parent modal system. */
  onTriggerAlert: PropTypes.func
};
