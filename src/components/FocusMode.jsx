import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Volume2, VolumeX, Calendar } from 'lucide-react';

export default function FocusMode({ examProfile, onTimerComplete, onTriggerAlert }) {
  // Timer States
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('study'); // study (25m), break (5m), longBreak (15m)
  
  // Ambient Sound States
  const [soundPlaying, setSoundPlaying] = useState(null); // 'waves', 'binaural', null
  
  // Ref for AudioContext
  const audioCtxRef = useRef(null);
  const soundNodesRef = useRef({ source: null, gain: null, lfo: null });
  const countdownIntervalRef = useRef(null);

  // Sync Timer settings on mode switch
  useEffect(() => {
    resetTimer(mode);
  }, [mode]);

  // Pomodoro Countdown Timer logic
  useEffect(() => {
    if (isActive) {
      countdownIntervalRef.current = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            triggerTimerComplete();
            clearInterval(countdownIntervalRef.current);
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    } else {
      clearInterval(countdownIntervalRef.current);
    }
    return () => clearInterval(countdownIntervalRef.current);
  }, [isActive, minutes, seconds]);

  const triggerTimerComplete = () => {
    setIsActive(false);
    // Play a gentle beep using Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 note
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.error(e);
    }

    if (mode === 'study') {
      if (onTimerComplete) onTimerComplete(); // rewards +50 XP
      if (onTriggerAlert) {
        onTriggerAlert(
          "🍅 Pomodoro Completed! (+50 XP)",
          "Incredible focus! You completed your 25-minute Pomodoro study chunk. Taking a 5-minute breather now prevents fatigue."
        );
      }
      setMode('break');
    } else {
      if (onTriggerAlert) {
        onTriggerAlert(
          "🌸 Break Session Ended",
          "You are fully recharged and ready. Let's return to our next focused topic block!"
        );
      }
      setMode('study');
    }
  };

  const startPauseTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = (newMode = mode) => {
    setIsActive(false);
    if (newMode === 'study') {
      setMinutes(25);
    } else if (newMode === 'break') {
      setMinutes(5);
    } else if (newMode === 'longBreak') {
      setMinutes(15);
    }
    setSeconds(0);
  };

  // WEB AUDIO SYNTHESIS FOR FOCUS SOUNDS
  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const stopFocusSounds = () => {
    const nodes = soundNodesRef.current;
    if (nodes.source) {
      try {
        nodes.source.stop();
      } catch (e) {}
      nodes.source = null;
    }
    if (nodes.lfo) {
      try {
        nodes.lfo.stop();
      } catch (e) {}
      nodes.lfo = null;
    }
    setSoundPlaying(null);
  };

  const playBinauralBeats = () => {
    stopFocusSounds();
    initAudioContext();
    const ctx = audioCtxRef.current;

    const merger = ctx.createChannelMerger(2);
    
    const oscL = ctx.createOscillator();
    oscL.frequency.value = 200;
    oscL.type = 'sine';
    
    const oscR = ctx.createOscillator();
    oscR.frequency.value = 210; // creates 10Hz Alpha focus beats
    oscR.type = 'sine';

    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 0.05;
    gainR.gain.value = 0.05;

    oscL.connect(gainL);
    oscR.connect(gainR);
    
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;

    merger.connect(masterGain);
    masterGain.connect(ctx.destination);

    oscL.start();
    oscR.start();

    soundNodesRef.current.source = {
      stop: () => {
        oscL.stop();
        oscR.stop();
      }
    };
    setSoundPlaying('binaural');
  };

  const playOceanWaves = () => {
    stopFocusSounds();
    initAudioContext();
    const ctx = audioCtxRef.current;

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
    lowpass.frequency.value = 350;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.02;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.08;

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    noiseSource.connect(lowpass);
    lowpass.connect(waveGain);
    waveGain.connect(ctx.destination);

    noiseSource.start();
    lfo.start();

    soundNodesRef.current.source = noiseSource;
    soundNodesRef.current.lfo = lfo;
    setSoundPlaying('waves');
  };

  const toggleSound = (soundType) => {
    if (soundPlaying === soundType) {
      stopFocusSounds();
    } else {
      if (soundType === 'binaural') playBinauralBeats();
      if (soundType === 'waves') playOceanWaves();
    }
  };

  useEffect(() => {
    return () => stopFocusSounds();
  }, []);

  const calculateDaysRemaining = () => {
    if (!examProfile || !examProfile.examDate) return null;
    const diff = new Date(examProfile.examDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysRemaining = calculateDaysRemaining();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Countdown Card */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-violet)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <Calendar className="text-violet" size={20} />
          <h4 style={{ margin: 0 }}>Exam Countdown</h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.5rem 0' }}>
          <span style={{ fontSize: '2.2rem', fontWeight: '800', fontFamily: 'var(--font-title)' }} className="text-gradient">
            {daysRemaining !== null ? daysRemaining : '—'}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Days until {examProfile?.exam || 'Exam'}</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          "Focus on the process, not the finish line. Each 25-minute study chunk is a victory."
        </p>
      </div>

      {/* Pomodoro Timer */}
      <div className="glass-panel">
        <div className="flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Timer className="text-teal" size={20} />
            <h4 style={{ margin: 0 }}>Study Focus Timer</h4>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--border-radius-sm)', padding: '2px' }}>
            <button 
              className={`btn btn-secondary ${mode === 'study' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
              onClick={() => setMode('study')}
            >
              Study
            </button>
            <button 
              className={`btn btn-secondary ${mode === 'break' ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
              onClick={() => setMode('break')}
            >
              Break
            </button>
          </div>
        </div>

        <div className="timer-display">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        <div className="flex-center" style={{ gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={startPauseTimer} className="btn btn-teal" style={{ padding: '0.6rem 1.2rem', flex: 1 }}>
            {isActive ? <Pause size={16} /> : <Play size={16} />}
            {isActive ? 'Pause' : 'Start Focus'}
          </button>
          <button onClick={() => resetTimer()} className="btn btn-secondary" style={{ padding: '0.6rem' }} aria-label="Reset study timer">
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Focus Audio Synthesizer Controls */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>
            Focus Synthesized Audio
          </span>
          <div className="sound-toggle-grid">
            <button 
              className={`sound-btn ${soundPlaying === 'waves' ? 'active' : ''}`}
              onClick={() => toggleSound('waves')}
            >
              <Volume2 size={16} />
              <span style={{ fontSize: '0.75rem' }}>Ocean Waves</span>
            </button>
            <button 
              className={`sound-btn ${soundPlaying === 'binaural' ? 'active' : ''}`}
              onClick={() => toggleSound('binaural')}
            >
              <Volume2 size={16} />
              <span style={{ fontSize: '0.75rem' }}>Binaural 10Hz</span>
            </button>
            <button 
              className="sound-btn"
              style={{ opacity: soundPlaying ? 1 : 0.5 }}
              onClick={stopFocusSounds}
              disabled={!soundPlaying}
            >
              <VolumeX size={16} />
              <span style={{ fontSize: '0.75rem' }}>Mute</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
