import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Volume2, Sparkles, AlertTriangle } from 'lucide-react';
import { storage } from '../utils/storage';

export default function AuraLive({ examProfile, onTriggerConfirm }) {
  const [isActive, setIsActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captions, setCaptions] = useState([]);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisUtteranceRef = useRef(null);
  const transcriptsEndRef = useRef(null);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

  // Clean up all resources when tab is closed
  useEffect(() => {
    return () => {
      stopCamera();
      stopVoiceEngine();
    };
  }, []);

  // Web Speech API: Speech Recognition Setup
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = async (event) => {
      const speechText = event.results[0][0].transcript;
      if (!speechText.trim()) return;

      // Add user speech to captions list
      const userCap = {
        id: Date.now(),
        sender: 'Student',
        text: speechText,
        role: 'user'
      };
      setCaptions(prev => [...prev, userCap]);

      // Stop listening while we call backend and speak
      rec.stop();
      setIsListening(false);
      
      await handleAuraQuery(speechText);
    };

    rec.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (e.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // If session is still active and we're not speaking/loading, restart listening
      if (isActive && !isSpeaking && !isLoading) {
        try {
          rec.start();
        } catch (err) {
          // Ignore if already started
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

      // Use the existing chat messages list for full history, or just seed a brief history
      const history = storage.getChatMessages();
      const newMessages = [...history, { role: 'user', content: queryText }];
      
      const response = await fetch('/api/chat-companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
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

    const utterance = new SpeechUtterance(cleanText);
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
        } catch (e) {}
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
        } catch (err) {}
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
      } catch (err) {}
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
          {cameraActive ? (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="camera-video"
              aria-label="Student live webcam view"
            />
          ) : (
            <div className="camera-placeholder text-muted">🧘</div>
          )}
        </div>

        {/* State Status Indicator */}
        {isActive && (
          <div className={`speech-status-pill ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            {isListening && (
              <>
                <div className="pulse-indicator"></div>
                <span>Listening to you...</span>
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
                <span>Aura is thinking...</span>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
          <button 
            onClick={toggleSession} 
            className={`btn ${isActive ? 'btn-danger' : 'btn-teal'}`}
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
              className={`btn ${isListening ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              disabled={isSpeaking || isLoading}
              aria-pressed={isListening}
              aria-label={isListening ? "Mute Microphone" : "Unmute Microphone"}
            >
              {isListening ? (
                <>
                  <Mic size={16} /> Listening...
                </>
              ) : (
                <>
                  <MicOff size={16} /> Microphone Off
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
            <Sparkles className="text-teal" size={20} />
            <h4 style={{ margin: 0 }}>Interactive Live Transcripts</h4>
          </div>
          <span className="badge badge-teal" style={{ fontSize: '0.75rem' }}>Aura Speak Enabled</span>
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
          {captions.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0', padding: '1rem', lineHeight: '1.5' }}>
              A live transcript of your spoken session will populate here. Click <strong>Start Live Session</strong> above and authorize your camera and microphone options to interact with Aura verbally.
            </p>
          ) : (
            captions.map((cap) => (
              <div key={cap.id} className={`caption-wrapper ${cap.role === 'user' ? 'user' : 'model'}`}>
                <span className="caption-sender">{cap.sender}</span>
                <div className="caption-bubble">{cap.text}</div>
              </div>
            ))
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
