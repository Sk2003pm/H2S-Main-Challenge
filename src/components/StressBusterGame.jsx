import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Play, RefreshCw, Award, Heart, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const AFFIRMATIONS = [
  "Mock scores don't define my worth!",
  "I am learning at my own perfect pace.",
  "Deep breaths dissolve examination panic.",
  "One topic at a time; I am capable.",
  "My health is more important than a grade.",
  "I have prepared well, and I will do my best.",
  "Failures are just diagnostic feedback loops.",
  "I am resilient, focused, and steady."
];

export default function StressBusterGame({ examProfile, onXpReward, onTriggerAlert }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [balloons, setBalloons] = useState([]);
  const [affirmation, setAffirmation] = useState('');
  
  const gameAreaRef = useRef(null);
  const animationFrameRef = useRef(null);
  const balloonIdRef = useRef(0);

  // Synthesize popping audio using Web Audio API
  const playPopSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      // Quick pitch sweep up
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error("Audio Context failed", e);
    }
  };

  const getStressThoughts = () => {
    const exam = examProfile?.exam || "Exams";
    return [
      `Failed mock test`,
      `${exam} Backlog`,
      `Peer comparison`,
      `Sleepless night`,
      `Forgot formulas`,
      `Family expectations`,
      `Exam day panic`,
      `Time running out`,
      `Useless revision`
    ];
  };

  const spawnBalloon = () => {
    if (!gameAreaRef.current) return;
    const width = gameAreaRef.current.clientWidth;
    const thoughts = getStressThoughts();
    const text = thoughts[Math.floor(Math.random() * thoughts.length)];
    
    // Calm pastel colors
    const colors = [
      'rgba(239, 68, 68, 0.7)',  // soft red
      'rgba(245, 158, 11, 0.7)', // soft orange
      'rgba(139, 92, 246, 0.7)', // soft purple
      'rgba(20, 184, 166, 0.7)', // soft teal
      'rgba(59, 130, 246, 0.7)'  // soft blue
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const newBalloon = {
      id: balloonIdRef.current++,
      x: Math.random() * (width - 120) + 10,
      y: gameAreaRef.current.clientHeight,
      speed: Math.random() * 1.5 + 1.2, // speed
      size: Math.random() * 20 + 80,    // size diameter
      text,
      color,
      popped: false
    };

    setBalloons((prev) => [...prev, newBalloon]);
  };

  // Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    const updateLoop = () => {
      setBalloons((prev) => {
        return prev
          .map((b) => ({ ...b, y: b.y - b.speed }))
          .filter((b) => b.y > -150); // Remove when off screen
      });
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animationFrameRef.current = requestAnimationFrame(updateLoop);

    // Spawn balloon every 1.5 seconds
    const spawner = setInterval(spawnBalloon, 1500);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      clearInterval(spawner);
    };
  }, [isPlaying]);

  const startGame = () => {
    setScore(0);
    setPoppedCount(0);
    setBalloons([]);
    setAffirmation('');
    setIsPlaying(true);
  };

  const popBalloon = (id, text, e) => {
    e.stopPropagation();
    
    playPopSound();
    
    setBalloons((prev) => 
      prev.map((b) => (b.id === id ? { ...b, popped: true } : b))
    );

    // Add score
    setScore((s) => s + 10);
    setPoppedCount((c) => {
      const nextC = c + 1;
      
      // Award XP points in gamification module!
      if (onXpReward) {
        onXpReward(10, "Stress Buster Balloon Popped");
      }

      // Show random supportive affirmation
      const aff = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
      setAffirmation(`"${text}" popped! ➔ ${aff}`);

      // Complete game after 10 pops
      if (nextC >= 10) {
        endGame(true);
      }
      return nextC;
    });

    // Sparkle confetti effect at click position
    const rect = e.target.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2 / window.innerWidth;
    const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
    confetti({
      particleCount: 20,
      spread: 40,
      origin: { x, y }
    });
  };

  const endGame = (completed = false) => {
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameRef.current);
    
    if (completed) {
      if (onXpReward) {
        onXpReward(50, "Stress Buster Quest Completed");
      }
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      if (onTriggerAlert) {
        onTriggerAlert(
          "🎉 Quest Completed! (+50 XP)",
          "Incredible stress busting! You popped 10 stress thoughts and transformed them into active positive affirmations. Keep carrying this peaceful study mindset!"
        );
      }
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '620px' }}>
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gamepad2 className="text-teal" size={24} />
          <h3>Zen Stress Buster</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Score: <strong style={{ color: 'var(--accent-teal)' }}>{score}</strong></span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Busted: <strong style={{ color: 'var(--accent-violet)' }}>{poppedCount}/10</strong></span>
        </div>
      </div>

      <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.4', margin: 0 }}>
        **Zen Arcade:** Float up exam stresses. Tap/Click to pop them, converting stress into positive cognitive affirmations. Bust 10 stressors to complete the quest!
      </p>

      {/* Game Playing Window Area */}
      <div 
        ref={gameAreaRef} 
        style={{ 
          flex: 1, 
          background: 'rgba(10, 15, 29, 0.4)', 
          border: '1px solid rgba(255, 255, 255, 0.05)', 
          borderRadius: 'var(--border-radius-md)', 
          position: 'relative', 
          overflow: 'hidden',
          cursor: isPlaying ? 'crosshair' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {!isPlaying ? (
          <div style={{ zIndex: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-teal-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart className="text-teal" size={32} />
            </div>
            <h4>Ready to Bust Some Stress?</h4>
            <p className="text-muted" style={{ fontSize: '0.8rem', maxWidth: '300px', lineHeight: '1.4' }}>
              Floating balloons carry stressful thoughts customized for your {examProfile?.exam || 'exams'}. Pop them to earn XP and read positive affirmations.
            </p>
            <button className="btn btn-teal" onClick={startGame}>
              <Play size={16} /> Start Stress Buster
            </button>
          </div>
        ) : (
          balloons.map((b) => {
            if (b.popped) return null;
            return (
              <button
                type="button"
                key={b.id}
                onClick={(e) => popBalloon(b.id, b.text, e)}
                aria-label={`Pop stress balloon: ${b.text}`}
                style={{
                  position: 'absolute',
                  left: b.x,
                  top: b.y,
                  width: b.size,
                  height: b.size * 1.2,
                  borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
                  background: b.color,
                  boxShadow: `inset -10px -10px 20px rgba(0,0,0,0.3), 0 10px 20px ${b.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: b.size < 90 ? '0.7rem' : '0.8rem',
                  textAlign: 'center',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  border: 'none',
                  fontFamily: 'inherit',
                  animation: 'float 3s ease-in-out infinite',
                  transition: 'transform 0.1s'
                }}
              >
                {b.text}
                {/* Balloon string trailing effect */}
                <div style={{
                  position: 'absolute',
                  bottom: '-12px',
                  left: '50%',
                  width: '2px',
                  height: '14px',
                  background: 'rgba(255, 255, 255, 0.4)'
                }}></div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating affirmation bar */}
      {affirmation && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '0.75rem 1rem', 
            background: 'var(--accent-teal-glow)', 
            border: '1px solid var(--accent-teal)', 
            borderRadius: 'var(--border-radius-sm)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            animation: 'slide-up 0.2s ease-out' 
          }}
        >
          <Sparkles className="text-teal" size={16} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#2dd4bf', lineHeight: '1.4' }}>
            {affirmation}
          </span>
        </div>
      )}
    </div>
  );
}
