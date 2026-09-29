import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Video, VideoOff, Mic, MicOff, Volume2, Sparkles, AlertTriangle } from 'lucide-react';
import { storage } from '../utils/storage';
import DimensionalAnalysisVisualizer from './DimensionalAnalysisVisualizer';

export default function AuraLive({ examProfile, onTriggerConfirm }) {
  const [isActive, setIsActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [liveInterim, setLiveInterim] = useState('');
  const [isPausing, setIsPausing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisUtteranceRef = useRef(null);
  const transcriptsEndRef = useRef(null);
  const speechBufferRef = useRef('');
  const silenceTimerRef = useRef(null);
  const pauseIndicatorTimerRef = useRef(null);

  // 2.5 seconds pause grace period so the student can breathe, hesitate, and finish naturally
  const SILENCE_PAUSE_DELAY = 2500;

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions, liveInterim]);

  // Clean up all resources when tab is closed
  useEffect(() => {
    return () => {
      stopCamera();
      stopVoiceEngine();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (pauseIndicatorTimerRef.current) clearTimeout(pauseIndicatorTimerRef.current);
    };
  }, []);

  // Web Speech API: Continuous Speech Recognition with Silence Buffer & Pause Tolerance
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      setIsPausing(false);
    };

    rec.onresult = (event) => {
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          speechBufferRef.current += (speechBufferRef.current ? ' ' : '') + transcriptChunk;
        } else {
          interimStr += transcriptChunk;
        }
      }

      const fullAccumulated = (speechBufferRef.current + ' ' + interimStr).trim();
      if (fullAccumulated) {
        setLiveInterim(fullAccumulated);
        setIsPausing(false);

        // Reset existing silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        if (pauseIndicatorTimerRef.current) {
          clearTimeout(pauseIndicatorTimerRef.current);
        }

        // Visual cue after 1s of pause so the student knows Aura is waiting for them
        pauseIndicatorTimerRef.current = setTimeout(() => {
          setIsPausing(true);
        }, 1100);

        // Commit query after 2.5s of sustained pause
        silenceTimerRef.current = setTimeout(async () => {
          const finalQuery = (speechBufferRef.current + ' ' + interimStr).trim();
          if (finalQuery) {
            speechBufferRef.current = '';
            setLiveInterim('');
            setIsPausing(false);

            try {
              rec.stop();
            } catch (err) {}
            setIsListening(false);

            const userCap = {
              id: Date.now(),
              sender: 'Student',
              text: finalQuery,
              role: 'user'
            };
            setCaptions(prev => [...prev, userCap]);

            await handleAuraQuery(finalQuery);
          }
        }, SILENCE_PAUSE_DELAY);
      }
    };

    rec.onerror = (e) => {
      // Tolerate 'no-speech' gracefully if user starts late
      if (e.error === 'no-speech') {
        return;
      }
      console.warn("Speech recognition notice:", e.error);
      if (e.error !== 'aborted') {
        setIsListening(false);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // If user hasn't finished speaking, session is active, and we're not speaking/loading, keep listening seamlessly
      if (isActive && !isSpeaking && !isLoading) {
        try {
          rec.start();
        } catch (err) {
          // Ignore if already active
        }
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  const handleAuraQuery = async (queryText) => {
    setIsLoading(true);
    try {
      const journalLogs = storage.getJournalLogs();
      const recentTriggers = journalLogs.length > 0 ? journalLogs[0].analysis.triggers : [];
      const currentStress = journalLogs.length > 0 ? journalLogs[0].stress_input : 50;
      const activeUser = storage.getActiveUsername();

      // Use the existing chat messages list for full history
      const history = storage.getChatMessages();
      const newMessages = [...history, { role: 'user', content: queryText }];

      const response = await fetch('/api/chat-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          username: activeUser || undefined,
          student_context: {
            exam: examProfile?.exam || 'Competitive Exam',
            current_stress: currentStress,
            recent_triggers: recentTriggers
          }
        })
      });

      if (!response.ok) throw new Error('API failed');

      const data = await response.json();

      // Save full chat history back to storage
      storage.saveChatMessages([...newMessages, { role: 'model', content: data.reply }]);

      const auraCap = {
        id: Date.now() + 1,
        sender: 'Aura',
        text: data.reply,
        role: 'model'
      };
      setCaptions(prev => [...prev, auraCap]);
      setIsLoading(false);

      // Read output aloud
      speakAura(data.reply);

    } catch (e) {
      console.error(e);
      setIsLoading(false);
      const errorMsg = "I am having trouble connecting to my servers right now, but please take a deep breath. Inhale for 4 seconds, hold for 4, and exhale for 4. What is bothering you?";
      setCaptions(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'Aura',
        text: errorMsg,
        role: 'model'
      }]);
      speakAura(errorMsg);
    }
  };

  // Web Speech API: Text to Speech Synthesis
  const speakAura = (text) => {
    if (!window.speechSynthesis) return;

    // Cancel any active speech
    window.speechSynthesis.cancel();

    // Remove brackets from text for fallback notes (e.g. "[Offline Mode]") so TTS reads cleanly
    const cleanText = text.replace(/\[.*?\]/g, "").trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    synthesisUtteranceRef.current = utterance;

    // Set voice options (look for a nice natural Google or default female/male voice)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft')) &&
      v.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.05; // Slightly warmer/softer pitch

    utterance.onstart = () => {
      setIsSpeaking(true);
      // Double check recognition is stopped to prevent feedback
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) { }
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      // Restart listening after speech ends if still active
      if (isActive && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to restart listening after speech:", e);
        }
      }
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis error:", e);
      setIsSpeaking(false);
      if (isActive && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) { }
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Camera Management
  const startCamera = async () => {
    try {
      const constraints = { video: { width: 320, height: 320, facingMode: "user" }, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Failed to open camera", err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start/Stop Entire Wellness Live Session
  const toggleSession = async () => {
    if (isActive) {
      // End Session
      stopVoiceEngine();
      stopCamera();
      setIsActive(false);
      setCaptions(prev => [...prev, {
        id: Date.now(),
        sender: 'Aura',
        text: "Session closed. Remember that taking breaks and studying focus blocks is key to NEET/JEE success. Let me know if you need to talk again!",
        role: 'model'
      }]);
    } else {
      // Start Session
      setIsActive(true);
      setCaptions([]);
      await startCamera();

      const welcome = `Welcome to Aura Live! I'm your digital counseling speaker. I can hear your voice and talk back. How are you feeling about your ${examProfile?.exam || 'competitive exams'} today?`;
      setCaptions([{
        id: Date.now(),
        sender: 'Aura',
        text: welcome,
        role: 'model'
      }]);

      // Initialize voice engine and speak welcome
      const recObj = initSpeechRecognition();
      speakAura(welcome);

      // Trigger recognition if speech isn't speaking (it handles restart on utterance.onend)
    }
  };

  const stopVoiceEngine = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleManualMicToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      try {
        recognitionRef.current.start();
      } catch (err) { }
    }
  };

  // Check if speech recognition is available in current browser
  const isSpeechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div className="aura-live-grid" style={{ animation: 'slide-up var(--transition-normal) ease' }}>

      {/* Camera & Controls Panel */}
      <div className="glass-panel camera-panel text-center">
        <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Live Webcam Feed</h4>

        <div
          className={`camera-bubble-container ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
          style={{ width: '200px', height: '200px' }}
        >
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="camera-video"
            style={{ display: cameraActive ? 'block' : 'none' }}
            aria-label="Student live webcam view"
          />
          {!cameraActive && (
            <div className="camera-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DimensionalAnalysisVisualizer isAnalyzing={isListening || isLoading || isSpeaking} compact={true} />
              </div>
            </div>
          )}
        </div>

        {/* State Status Indicator */}
        {isActive && (
          <div className={`speech-status-pill ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            {isListening && (
              <>
                <div className="pulse-indicator"></div>
                <span>{isPausing ? "Waiting for you to finish..." : "Listening to you..."}</span>
              </>
            )}
            {isSpeaking && (
              <>
                <Volume2 size={14} className="text-violet" />
                <span>Aura is speaking...</span>
              </>
            )}
            {!isListening && !isSpeaking && !isLoading && <span>Ready</span>}
            {isLoading && (
              <>
                <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                <span>Aura is answering...</span>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
          <button
            onClick={toggleSession}
            className={`btn ${isActive ? 'btn-danger' : 'btn-rose'}`}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            aria-pressed={isActive}
            aria-label={isActive ? "Close Live Counseling Session" : "Start Live Voice & Video Session"}
          >
            {isActive ? (
              <>
                <VideoOff size={16} /> Close Session
              </>
            ) : (
              <>
                <Video size={16} /> Start Live Session
              </>
            )}
          </button>

          {isActive && (
            <button 
              onClick={handleManualMicToggle} 
              className={`btn ${isListening ? 'btn-rose' : 'btn-secondary'}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              disabled={isSpeaking || isLoading}
              aria-pressed={isListening}
              aria-label={isListening ? "Listening active, click to pause" : "Click to Speak"}
            >
              {isListening ? (
                <>
                  <Mic size={16} /> {isPausing ? "Listening (Paused)..." : "Listening..."}
                </>
              ) : (
                <>
                  <Mic size={16} /> Tap to Speak
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Closed Captions & Transcripts Panel */}
      <div className="glass-panel live-captions-panel">
        <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles className="text-rose" size={20} />
            <h4 style={{ margin: 0 }}>Interactive Live Transcripts</h4>
          </div>
          <span className="badge badge-rose" style={{ fontSize: '0.75rem' }}>Aura Voice Guarded</span>
        </div>

        {!isSpeechSupported && (
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--danger-glow)', border: '1px solid var(--danger)', borderRadius: 'var(--border-radius-sm)', padding: '0.75rem 1rem' }}>
            <AlertTriangle size={20} className="text-danger" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0, lineHeight: '1.4' }}>
              <strong>Browser Compatibility Warning:</strong> Web Speech Recognition API is not supported in your current browser environment. We recommend using Google Chrome, Microsoft Edge, or Safari to speak aloud.
            </p>
          </div>
        )}

        <div className="live-transcripts">
          {captions.length === 0 && !liveInterim ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0', padding: '1rem', lineHeight: '1.5' }}>
              A live transcript of your spoken session will populate here. Click <strong>Start Live Session</strong> above and speak naturally at your own pace—Aura will wait for you to finish.
            </p>
          ) : (
            captions.map((cap) => (
              <div key={cap.id} className={`caption-wrapper ${cap.role === 'user' ? 'user' : 'model'}`}>
                <span className="caption-sender">{cap.sender}</span>
                <div className="caption-bubble">{cap.text}</div>
              </div>
            ))
          )}

          {/* Real-time speaking buffer with pause indicator */}
          {liveInterim && (
            <div className="caption-wrapper user" style={{ opacity: 0.9 }}>
              <span className="caption-sender" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="pulse-indicator" style={{ width: '8px', height: '8px' }}></span>
                {isPausing ? "Aura waiting for you to finish..." : "Speaking..."}
              </span>
              <div className="caption-bubble" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' }}>
                {liveInterim}
                {isPausing && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd', marginTop: '0.35rem' }}>
                    ⏳ Paused... Aura giving you time to breathe and finish your thought.
                  </span>
                )}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="caption-wrapper model">
              <span className="caption-sender">Aura</span>
              <div className="caption-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                <span>Translating thoughts...</span>
              </div>
            </div>
          )}
          <div ref={transcriptsEndRef} />
        </div>
      </div>

    </div>
  );
}

AuraLive.propTypes = {
  /** Active student exam profile for contextual wellness counseling prompts. */
  examProfile: PropTypes.shape({
    exam: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string
  }),
  /** Callback to display confirm dialogs in the parent modal system. */
  onTriggerConfirm: PropTypes.func
};
