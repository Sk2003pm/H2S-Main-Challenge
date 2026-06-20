import React, { useState, useEffect, useRef } from 'react';
import { Wind, Play, Square } from 'lucide-react';

const BREATH_MODES = {
  BOX: {
    name: 'Box Breathing (4-4-4-4)',
    description: 'Used by high-performers & Navy SEALs to relieve acute stress and restore focus.',
    sequence: [
      { action: 'Inhale', duration: 4, scale: 1.2, color: 'var(--accent-teal)' },
      { action: 'Hold', duration: 4, scale: 1.2, color: 'var(--accent-violet)' },
      { action: 'Exhale', duration: 4, scale: 0.85, color: '#0d9488' },
      { action: 'Hold', duration: 4, scale: 0.85, color: '#1f2937' }
    ]
  },
  CALM: {
    name: 'Relaxation Breathing (4-7-8)',
    description: 'A classic pranayama technique that acts as a natural nervous system tranquilizer.',
    sequence: [
      { action: 'Inhale', duration: 4, scale: 1.2, color: 'var(--accent-teal)' },
      { action: 'Hold', duration: 7, scale: 1.2, color: 'var(--accent-violet)' },
      { action: 'Exhale', duration: 8, scale: 0.85, color: '#0d9488' }
    ]
  }
};

export default function BreathingBubble({ onCycleComplete, onTriggerAlert }) {
  const [modeKey, setModeKey] = useState('BOX');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(BREATH_MODES.BOX.sequence[0].duration);
  const [totalCyclesCompleted, setTotalCyclesCompleted] = useState(0);
  
  const timerRef = useRef(null);
  const mode = BREATH_MODES[modeKey];
  const currentStep = mode.sequence[currentStepIdx];

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setCurrentStepIdx((idx) => {
              const nextIdx = (idx + 1) % mode.sequence.length;
              if (nextIdx === 0) {
                // Cycle complete!
                setTotalCyclesCompleted((c) => {
                  const nextC = c + 1;
                  // Award XP and save cycle counter to local storage
                  if (onCycleComplete) {
                    onCycleComplete();
                  }
                  try {
                    const activeUser = localStorage.getItem('mindalign_active_user') || 'default';
                    const storedBreaths = localStorage.getItem(`mindalign_breath_cycles_${activeUser}`) || '0';
                    localStorage.setItem(`mindalign_breath_cycles_${activeUser}`, String(Number(storedBreaths) + 1));
                  } catch (e) {}
                  return nextC;
                });
              }
              setSecondsRemaining(mode.sequence[nextIdx].duration);
              return nextIdx;
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isPlaying, modeKey, currentStepIdx]);

  const handleStartStop = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentStepIdx(0);
      setSecondsRemaining(mode.sequence[0].duration);
      if (onTriggerAlert) {
        onTriggerAlert(
          "Breathing Stopped", 
          `Session ended. You completed ${totalCyclesCompleted} cycles this turn! Short breathing patterns help oxygenate the cortex for better exam concentration.`
        );
      }
    } else {
      setIsPlaying(true);
      setCurrentStepIdx(0);
      setSecondsRemaining(mode.sequence[0].duration);
      setTotalCyclesCompleted(0);
    }
  };

  const handleModeChange = (key) => {
    setIsPlaying(false);
    setModeKey(key);
    setCurrentStepIdx(0);
    setSecondsRemaining(BREATH_MODES[key].sequence[0].duration);
    setTotalCyclesCompleted(0);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wind className="text-teal" style={{ width: 24, height: 24 }} />
          <h3>Mindful Breathing</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn btn-secondary ${modeKey === 'BOX' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: modeKey === 'BOX' ? '1px solid var(--accent-teal)' : '' }}
            onClick={() => handleModeChange('BOX')}
            disabled={isPlaying}
            aria-pressed={modeKey === 'BOX'}
            aria-label="Box breathing mode, four-four-four-four pattern"
          >
            Box (4-4-4-4)
          </button>
          <button 
            className={`btn btn-secondary ${modeKey === 'CALM' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: modeKey === 'CALM' ? '1px solid var(--accent-teal)' : '' }}
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
            transform: isPlaying ? `scale(${currentStep.scale})` : 'scale(1)',
            backgroundColor: isPlaying ? currentStep.color : 'rgba(255, 255, 255, 0.05)',
            border: isPlaying ? 'none' : '2px dashed var(--accent-teal)',
            transition: isPlaying ? `transform ${currentStep.duration}s linear, background-color 0.5s ease` : 'all 0.5s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            width: '160px',
            height: '160px',
            boxShadow: isPlaying ? `0 0 40px ${currentStep.color}66` : 'none'
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>
            {isPlaying ? currentStep.action : 'Ready'}
          </span>
          <span style={{ fontSize: '1rem', opacity: 0.8 }}>
            {isPlaying ? `${secondsRemaining}s` : 'Focus'}
          </span>
        </div>
      </div>

      <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {isPlaying ? (
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cycles Completed: </span>
            <strong style={{ color: 'var(--accent-teal)', fontSize: '1.1rem' }}>{totalCyclesCompleted}</strong>
            <span className="badge badge-success" style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>+30 XP each!</span>
          </div>
        ) : (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Click begin to start breathing guide</span>
        )}
      </div>

      <div className="flex-center">
        <button 
          onClick={handleStartStop} 
          className={`btn ${isPlaying ? 'btn-secondary' : 'btn-teal'}`}
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
      </div>
    </div>
  );
}
