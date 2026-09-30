import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Video, VideoOff, Mic, MicOff, Send, Hand, Volume2, Sparkles, AlertTriangle } from 'lucide-react';
import { storage } from '../utils/storage';
import { encodeWav, PCM_CAPTURE_WORKLET, CAPTURE_CHUNK_SIZE } from '../utils/audioCapture';
import DimensionalAnalysisVisualizer from './DimensionalAnalysisVisualizer';

const SPEECH_LANG = 'en-US';
// Aura replies automatically once the student has been silent this long
const SILENCE_PAUSE_DELAY = 3000;
// When the "paused, sending soon" cue appears
const PAUSE_INDICATOR_DELAY = 1000;
// If the transcript stops changing this long, send even though the mic still hears background noise
const STALE_TRANSCRIPT_DELAY = 8000;
// How often the voice monitor samples the microphone and checks for the pause
const MONITOR_INTERVAL = 100;
// Relative heights of the live mic level meter bars
const METER_BARS = [0.45, 0.65, 0.8, 0.65, 0.45];
// Gemini transcription engine: longest spoken turn sent in one request, and pre-roll kept before speech starts
const MAX_RECORDING_MS = 45000;
const PREROLL_CHUNKS = 12;

// Errors meaning the browser's own speech service can't be used here (e.g. blocked by a corporate proxy).
// Aura switches speech engines instead of failing on these.
const BROWSER_SERVICE_ERRORS = ['network', 'service-not-allowed', 'language-not-supported'];

// Recognition errors that restarting won't fix, with what the student should do about them
const RECOGNITION_ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone for this site, then tap to speak.',
  'service-not-allowed': 'Speech recognition is turned off in this browser. Try Google Chrome or Microsoft Edge.',
  'audio-capture': 'No microphone was found. Connect one, then tap to speak.',
  'network': 'The browser speech service is unreachable. Check your internet connection, then tap to speak.',
  'language-not-supported': 'English speech recognition is not available in this browser.'
};

const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();
// Case/punctuation-only edits (the browser finalizing a phrase) don't count as the student still talking
const comparableText = (text) => normalizeText(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ''));

export default function AuraLive({ examProfile, onTriggerConfirm }) {
  const [isActive, setIsActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [liveInterim, setLiveInterim] = useState('');
  const [isPausing, setIsPausing] = useState(false);
  const [sendCountdown, setSendCountdown] = useState(0);
  const [hearingVoice, setHearingVoice] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisUtteranceRef = useRef(null);
  const transcriptsEndRef = useRef(null);
  const levelMeterRef = useRef(null);
  const pauseProgressRef = useRef(null);
  const voiceMonitorRef = useRef(null);
  const monitorTimerRef = useRef(null);
  const commitFallbackTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const speechDoneRef = useRef(null);
  const speechStartedAtRef = useRef(0);
  const idleSinceRef = useRef(0);

  // Speech API callbacks outlive the render that created them, so they read live values from refs.
  // (Reading state there saw stale values, so Aura never started listening again on her own.)
  const isActiveRef = useRef(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const examProfileRef = useRef(examProfile);
  examProfileRef.current = examProfile;

  // The student's current spoken turn
  const carryoverTextRef = useRef(''); // text from earlier recognition sessions within this turn
  const sessionTextRef = useRef('');   // final + interim text of the running recognition session
  const heardSpeechRef = useRef(false);
  const lastTextChangeRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const commitPendingRef = useRef(false);
  const discardResultsRef = useRef(false);
  const manualPauseRef = useRef(false);

  // Speech engine: 'browser' = Web Speech API (on-device when Chrome's local model is installed, otherwise the
  // browser's cloud service); 'gemini' = record the turn and transcribe it on our backend (works behind proxies
  // and in browsers without speech recognition, e.g. Firefox)
  const engineRef = useRef('browser');
  const onDeviceReadyRef = useRef(false);
  const engineSwitchPendingRef = useRef(false);
  const recordingRef = useRef(null); // Float32Array chunks of the turn being recorded (gemini engine)

  const updateActive = (value) => { isActiveRef.current = value; setIsActive(value); };
  const updateListening = (value) => { isListeningRef.current = value; setIsListening(value); };
  const updateSpeaking = (value) => { isSpeakingRef.current = value; setIsSpeaking(value); };
  const updateLoading = (value) => { isLoadingRef.current = value; setIsLoading(value); };

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions, liveInterim]);

  // Clean up all resources when tab is closed
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      stopCamera();
      stopVoiceEngine();
    };
  }, []);

  // ---------------------------------------------------------------
  // Current spoken turn
  // ---------------------------------------------------------------
  const getTurnText = () => normalizeText(`${carryoverTextRef.current} ${sessionTextRef.current}`);

  // Meter and progress bar are updated through the DOM (10x per second) instead of re-rendering React
  const setMicLevel = (level) => {
    levelMeterRef.current?.style.setProperty('--mic-level', level.toFixed(3));
  };

  const setPauseProgress = (fraction) => {
    if (pauseProgressRef.current) {
      pauseProgressRef.current.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
    }
  };

  const resetTurn = () => {
    carryoverTextRef.current = '';
    sessionTextRef.current = '';
    heardSpeechRef.current = false;
    lastTextChangeRef.current = Date.now();
    lastVoiceRef.current = 0;
    setLiveInterim('');
    setIsPausing(false);
    setSendCountdown(0);
    setHearingVoice(false);
    setPauseProgress(0);
  };

  const markSpeechHeard = () => {
    heardSpeechRef.current = true;
    setHearingVoice(true);
    setVoiceError('');
    setIsPausing(false);
    setSendCountdown(0);
    setPauseProgress(0);
  };

  // ---------------------------------------------------------------
  // Microphone level monitor (voice activity detection)
  // Detects the 3-second pause from the actual audio, so auto-send also works in browsers that
  // only return text once recognition is stopped. Also drives the live level meter.
  // ---------------------------------------------------------------
  const startVoiceActivityMonitor = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!isActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const audioContext = new AudioContextClass();
      audioContext.resume().catch(() => {});
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const monitor = {
        stream,
        audioContext,
        analyser,
        samples: new Float32Array(analyser.fftSize),
        noiseFloor: 0.01,
        captureNode: null
      };
      voiceMonitorRef.current = monitor;
      monitor.captureNode = await startPcmCapture(audioContext, source);
    } catch (err) {
      console.warn("Voice activity monitor unavailable, relying on transcript timing:", err);
    }
  };

  // Raw PCM tap on the microphone, used by the Gemini transcription engine
  const startPcmCapture = async (audioContext, source) => {
    if (!audioContext.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
    const moduleUrl = URL.createObjectURL(new Blob([PCM_CAPTURE_WORKLET], { type: 'application/javascript' }));
    try {
      await audioContext.audioWorklet.addModule(moduleUrl);
      const captureNode = new AudioWorkletNode(audioContext, 'aura-pcm-capture');
      captureNode.port.onmessage = (event) => {
        const recording = recordingRef.current;
        if (!recording) return;
        recording.push(event.data);
        // Until the student starts talking, keep only a short pre-roll so a quiet mic doesn't pile up audio
        if (!heardSpeechRef.current && recording.length > PREROLL_CHUNKS) recording.shift();
      };
      // The worklet is only pulled while connected to the output, so route it through a muted gain node
      const mute = audioContext.createGain();
      mute.gain.value = 0;
      source.connect(captureNode);
      captureNode.connect(mute);
      mute.connect(audioContext.destination);
      return captureNode;
    } catch (err) {
      console.warn("Microphone capture for transcription unavailable:", err);
      return null;
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  };

  // Chrome can run speech recognition fully on-device, which needs no network (so proxies can't break it).
  // Uses the English model if installed, otherwise downloads it in the background for later turns.
  const prepareOnDeviceRecognition = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof SpeechRecognition?.available !== 'function') return;
    const options = { langs: [SPEECH_LANG], processLocally: true };
    try {
      const status = await SpeechRecognition.available(options);
      if (status === 'available') {
        onDeviceReadyRef.current = true;
      } else if ((status === 'downloadable' || status === 'downloading') && typeof SpeechRecognition.install === 'function') {
        SpeechRecognition.install(options).then((installed) => {
          if (!installed) return;
          onDeviceReadyRef.current = true;
          if (isActiveRef.current && engineRef.current === 'gemini') {
            setVoiceNotice('On-device speech recognition is ready, so your words will appear live from your next turn.');
          }
        }).catch((err) => console.warn("On-device speech model install failed:", err));
      }
    } catch (err) {
      console.warn("On-device speech recognition check failed:", err);
    }
  };

  const stopVoiceActivityMonitor = () => {
    const monitor = voiceMonitorRef.current;
    voiceMonitorRef.current = null;
    if (!monitor) return;
    monitor.stream.getTracks().forEach(track => track.stop());
    monitor.audioContext.close().catch(() => {});
  };

  const readMicActivity = () => {
    const monitor = voiceMonitorRef.current;
    if (!monitor) return { voice: false, level: 0 };
    monitor.analyser.getFloatTimeDomainData(monitor.samples);
    let sumSquares = 0;
    for (let i = 0; i < monitor.samples.length; i++) {
      sumSquares += monitor.samples[i] * monitor.samples[i];
    }
    const rms = Math.sqrt(sumSquares / monitor.samples.length);
    // Adaptive noise floor (drops instantly, rises slowly) so steady fan/AC hum isn't mistaken for speech
    monitor.noiseFloor = rms < monitor.noiseFloor ? rms : monitor.noiseFloor * 0.98 + rms * 0.02;
    return {
      voice: rms > Math.max(monitor.noiseFloor * 3, 0.015),
      level: Math.min(1, Math.sqrt(Math.max(0, rms - monitor.noiseFloor) / 0.12))
    };
  };

  // ---------------------------------------------------------------
  // Web Speech API: continuous recognition with live transcript and 3-second pause auto-send
  // ---------------------------------------------------------------
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = SPEECH_LANG;

    rec.onstart = () => {
      updateListening(true);
    };

    rec.onresult = (event) => {
      if (discardResultsRef.current) return;
      // Rebuild this session's transcript from every result, so revised or repeated chunks never duplicate text
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += ` ${chunk}`;
        } else {
          interimText += ` ${chunk}`;
        }
      }
      const previousText = getTurnText();
      sessionTextRef.current = normalizeText(`${finalText} ${interimText}`);
      const currentText = getTurnText();
      if (currentText && comparableText(currentText) !== comparableText(previousText)) {
        lastTextChangeRef.current = Date.now();
        markSpeechHeard();
      }
      setLiveInterim(currentText);
    };

    rec.onerror = (e) => {
      // 'no-speech' (student hasn't started yet) and 'aborted' (we stopped it) are expected; onend restarts
      if (e.error === 'no-speech' || e.error === 'aborted') {
        return;
      }
      console.warn("Speech recognition notice:", e.error);
      if (BROWSER_SERVICE_ERRORS.includes(e.error)) {
        // The browser's speech service is unusable here: switch engines (onend restarts listening) instead of failing
        if (onDeviceReadyRef.current && !rec.processLocally) {
          engineSwitchPendingRef.current = true;
          return;
        }
        if (voiceMonitorRef.current?.captureNode) {
          engineRef.current = 'gemini';
          engineSwitchPendingRef.current = true;
          setVoiceNotice("This network blocks the browser's speech service, so Aura is transcribing your voice herself. Your words appear after each pause.");
          return;
        }
      }
      if (RECOGNITION_ERROR_MESSAGES[e.error]) {
        manualPauseRef.current = true; // restarting would only hit the same error again
        setVoiceError(RECOGNITION_ERROR_MESSAGES[e.error]);
      }
    };

    rec.onend = () => {
      updateListening(false);
      setMicLevel(0);
      if (commitPendingRef.current) {
        finalizeTurn();
        return;
      }
      if (engineSwitchPendingRef.current) {
        // Continue the same turn on the other speech engine
        engineSwitchPendingRef.current = false;
        carryoverTextRef.current = getTurnText();
        sessionTextRef.current = '';
        restartTimerRef.current = setTimeout(() => startListening({ keepTurn: true }), 250);
        return;
      }
      if (discardResultsRef.current) return; // stopped on purpose: Aura speaking, mic paused or session closed
      // The browser ended the session by itself (silence timeout, network blip): keep the words and resume
      carryoverTextRef.current = getTurnText();
      sessionTextRef.current = '';
      if (isActiveRef.current && !isSpeakingRef.current && !isLoadingRef.current && !manualPauseRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!manualPauseRef.current) startListening({ keepTurn: true });
        }, 250);
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  const startListening = ({ keepTurn = false } = {}) => {
    if (!isActiveRef.current || isListeningRef.current || isSpeakingRef.current || isLoadingRef.current || commitPendingRef.current) {
      return;
    }
    // Chrome's on-device model finished installing: go back to the browser engine for live transcripts
    if (engineRef.current === 'gemini' && onDeviceReadyRef.current && recognitionRef.current) {
      engineRef.current = 'browser';
    }
    const rec = recognitionRef.current;
    if (engineRef.current === 'browser' && !rec) return;
    clearTimeout(restartTimerRef.current);
    manualPauseRef.current = false;
    discardResultsRef.current = false;
    engineSwitchPendingRef.current = false;
    if (!keepTurn) resetTurn();

    if (engineRef.current === 'gemini') {
      if (!voiceMonitorRef.current?.captureNode) {
        manualPauseRef.current = true;
        setVoiceError("Aura can't record your voice. Allow microphone access for this site (or try Google Chrome or Microsoft Edge), then tap to speak.");
        return;
      }
      recordingRef.current = [];
      updateListening(true);
      return;
    }
    rec.processLocally = onDeviceReadyRef.current;
    try {
      rec.start();
    } catch (err) {
      // Already started (InvalidStateError): nothing to do
    }
  };

  // Stop listening and throw away anything still being recognized or recorded
  const abortRecognition = () => {
    clearTimeout(restartTimerRef.current);
    discardResultsRef.current = true;
    if (recordingRef.current) {
      recordingRef.current = null;
      updateListening(false);
    }
    try {
      recognitionRef.current?.abort();
    } catch (err) { }
  };

  // Send the current turn. stop() makes the browser flush its final transcript, then onend calls finalizeTurn.
  const commitTurn = () => {
    if (commitPendingRef.current) return;
    commitPendingRef.current = true;
    setIsPausing(false);
    setSendCountdown(0);
    if (recordingRef.current) {
      // Gemini engine: stop recording and transcribe the turn on the backend
      const chunks = recordingRef.current;
      recordingRef.current = null;
      updateListening(false);
      setMicLevel(0);
      transcribeRecording(chunks);
      return;
    }
    if (!isListeningRef.current) {
      finalizeTurn();
      return;
    }
    try {
      recognitionRef.current?.stop();
    } catch (err) { }
    // Don't hang if the browser never fires onend after stop()
    commitFallbackTimerRef.current = setTimeout(finalizeTurn, 1500);
  };

  // Gemini engine: upload the recorded turn as WAV, then continue exactly like a browser-transcribed turn
  const transcribeRecording = async (chunks) => {
    if (chunks.length > 0) {
      const sampleRate = voiceMonitorRef.current?.audioContext.sampleRate || 48000;
      setIsTranscribing(true);
      try {
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav' },
          body: encodeWav(chunks, sampleRate)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
        sessionTextRef.current = normalizeText(typeof data.text === 'string' ? data.text : '');
      } catch (err) {
        console.warn("Transcription failed:", err);
        if (isActiveRef.current) setVoiceError(`Aura couldn't transcribe that (${err.message}). Please try again.`);
      } finally {
        setIsTranscribing(false);
      }
    }
    finalizeTurn();
  };

  const finalizeTurn = () => {
    if (!commitPendingRef.current) return;
    clearTimeout(commitFallbackTimerRef.current);
    commitPendingRef.current = false;
    if (isListeningRef.current) abortRecognition(); // fallback path: drop any late results
    const finalQuery = getTurnText();
    resetTurn();
    if (!isActiveRef.current) return;
    if (!finalQuery) {
      // Only noise was heard: keep listening once the stopped session has fully ended
      restartTimerRef.current = setTimeout(() => startListening(), 300);
      return;
    }

    const userCap = {
      id: Date.now(),
      sender: 'Student',
      text: finalQuery,
      role: 'user'
    };
    setCaptions(prev => [...prev, userCap]);
    handleAuraQuery(finalQuery);
  };

  const handleAuraQuery = async (queryText) => {
    updateLoading(true);
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
            exam: examProfileRef.current?.exam || 'Competitive Exam',
            current_stress: currentStress,
            recent_triggers: recentTriggers
          }
        })
      });

      if (!response.ok) throw new Error('API failed');

      const data = await response.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Empty reply');

      // Save full chat history back to storage
      storage.saveChatMessages([...newMessages, { role: 'model', content: data.reply }]);

      const auraCap = {
        id: Date.now() + 1,
        sender: 'Aura',
        text: data.reply,
        role: 'model'
      };
      setCaptions(prev => [...prev, auraCap]);
      updateLoading(false);

      // Read output aloud; listening resumes by itself when Aura finishes
      if (isActiveRef.current) speakAura(data.reply);

    } catch (e) {
      console.error(e);
      updateLoading(false);
      // Offline reply must stay crisis-safe: the server-side helpline guardrail can't run when the request fails
      const errorMsg = "I am having trouble connecting to my servers right now, but please take a deep breath. Inhale for 4 seconds, hold for 4, and exhale for 4. If you feel unsafe or overwhelmed, please call Tele-MANAS at 14416 or KIRAN at 1800-599-0019, free and available 24x7. What is bothering you?";
      setCaptions(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'Aura',
        text: errorMsg,
        role: 'model'
      }]);
      if (isActiveRef.current) speakAura(errorMsg);
    }
  };

  // Web Speech API: Text to Speech Synthesis
  const speakAura = (text) => {
    if (!window.speechSynthesis) {
      startListening();
      return;
    }

    // Never listen while Aura talks, or she would transcribe her own voice
    abortRecognition();
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

    // Hand the conversation back to the student once Aura finishes, is interrupted, or the engine fails
    const finishSpeaking = () => {
      if (synthesisUtteranceRef.current !== utterance) return; // superseded, or already handled
      synthesisUtteranceRef.current = null;
      speechDoneRef.current = null;
      updateSpeaking(false);
      startListening();
    };
    speechDoneRef.current = finishSpeaking;

    utterance.onend = finishSpeaking;
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error("Speech Synthesis error:", e);
      }
      finishSpeaking();
    };

    updateSpeaking(true);
    speechStartedAtRef.current = Date.now();
    window.speechSynthesis.speak(utterance);
  };

  // Barge-in: stop Aura mid-sentence and start listening right away
  const interruptAura = () => {
    window.speechSynthesis?.cancel();
    speechDoneRef.current?.();
  };

  // Runs every 100ms during a session: mic level meter, 3-second pause auto-send and recovery watchdogs
  const monitorTick = () => {
    const now = Date.now();

    if (isSpeakingRef.current) {
      // Chrome sometimes never fires utterance.onend; recover so Aura still hands the turn back
      const synth = window.speechSynthesis;
      if (speechDoneRef.current && synth && !synth.speaking && !synth.pending && now - speechStartedAtRef.current > 1500) {
        speechDoneRef.current();
      }
      return;
    }

    if (!isListeningRef.current) {
      setMicLevel(0);
      // Hands-free safety net: nothing is using the mic and the student didn't pause it, so listen again
      const idle = isActiveRef.current && (recognitionRef.current || engineRef.current === 'gemini') &&
        !isLoadingRef.current && !commitPendingRef.current && !manualPauseRef.current;
      if (!idle) {
        idleSinceRef.current = 0;
      } else if (!idleSinceRef.current) {
        idleSinceRef.current = now;
      } else if (now - idleSinceRef.current > 2000) {
        idleSinceRef.current = 0;
        startListening({ keepTurn: true });
      }
      return;
    }
    idleSinceRef.current = 0;
    if (commitPendingRef.current) return;

    const { voice, level } = readMicActivity();
    setMicLevel(level);
    if (voice) {
      lastVoiceRef.current = now;
      markSpeechHeard();
    }
    if (!heardSpeechRef.current) return;

    // Gemini engine: cap one recorded turn so the upload stays small
    const recording = recordingRef.current;
    const sampleRate = voiceMonitorRef.current?.audioContext.sampleRate || 48000;
    if (recording && (recording.length * CAPTURE_CHUNK_SIZE * 1000) / sampleRate >= MAX_RECORDING_MS) {
      commitTurn();
      return;
    }

    const silentFor = now - Math.max(lastTextChangeRef.current, lastVoiceRef.current);
    const transcriptStaleFor = getTurnText() ? now - lastTextChangeRef.current : 0;
    if (silentFor >= SILENCE_PAUSE_DELAY || transcriptStaleFor >= STALE_TRANSCRIPT_DELAY) {
      commitTurn();
    } else if (silentFor >= PAUSE_INDICATOR_DELAY) {
      setIsPausing(true);
      setSendCountdown(Math.ceil((SILENCE_PAUSE_DELAY - silentFor) / 1000));
      setPauseProgress((silentFor - PAUSE_INDICATOR_DELAY) / (SILENCE_PAUSE_DELAY - PAUSE_INDICATOR_DELAY));
    }
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
      updateActive(false);
      stopVoiceEngine();
      stopCamera();
      setCaptions(prev => [...prev, {
        id: Date.now(),
        sender: 'Aura',
        text: "Session closed. Remember that taking breaks and studying focus blocks is key to NEET/JEE success. Let me know if you need to talk again!",
        role: 'model'
      }]);
    } else {
      // Start Session
      updateActive(true);
      setVoiceError('');
      setVoiceNotice('');
      setCaptions([]);
      // Browsers without speech recognition (e.g. Firefox) use Gemini transcription from the start
      engineRef.current = (window.SpeechRecognition || window.webkitSpeechRecognition) ? 'browser' : 'gemini';
      // Runs inside this click so Chrome may download its on-device speech model in the background
      prepareOnDeviceRecognition();
      await startCamera();
      if (!isActiveRef.current) return; // closed while the camera was starting

      const welcome = `Welcome to Aura Live! I'm your digital counseling speaker. Just talk naturally and I'll reply when you pause. How are you feeling about your ${examProfile?.exam || 'competitive exams'} today?`;
      setCaptions([{
        id: Date.now(),
        sender: 'Aura',
        text: welcome,
        role: 'model'
      }]);

      // Voice engine + pause detector; listening starts by itself as soon as the welcome finishes
      initSpeechRecognition();
      await startVoiceActivityMonitor();
      if (!isActiveRef.current) return;
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = setInterval(monitorTick, MONITOR_INTERVAL);
      speakAura(welcome);
    }
  };

  const stopVoiceEngine = () => {
    clearInterval(monitorTimerRef.current);
    monitorTimerRef.current = null;
    clearTimeout(commitFallbackTimerRef.current);
    clearTimeout(restartTimerRef.current);
    commitPendingRef.current = false;
    engineSwitchPendingRef.current = false;
    recordingRef.current = null;
    setIsTranscribing(false);
    synthesisUtteranceRef.current = null;
    speechDoneRef.current = null;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      abortRecognition();
      recognitionRef.current.onend = null;
      recognitionRef.current = null;
    }
    stopVoiceActivityMonitor();
    updateListening(false);
    updateSpeaking(false);
    resetTurn();
    setMicLevel(0);
  };

  // One button, context-aware: interrupt Aura, send what you said now, pause the mic, or start talking
  const handleManualMicToggle = () => {
    if (isSpeakingRef.current) {
      interruptAura();
      return;
    }
    if (engineRef.current === 'browser' && !recognitionRef.current) return;
    if (isListeningRef.current) {
      if (heardSpeechRef.current) {
        commitTurn();
      } else {
        manualPauseRef.current = true;
        abortRecognition();
      }
    } else {
      setVoiceError('');
      startListening();
    }
  };

  // Voice works with the browser's speech recognition, or with any browser that can record audio for Gemini
  const isSpeechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition ||
    (typeof AudioWorkletNode !== 'undefined' && navigator.mediaDevices?.getUserMedia));

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
            {(isListening || isSpeaking) && (
              <div ref={levelMeterRef} className={`voice-level-meter ${isSpeaking ? 'speaking' : ''}`} aria-hidden="true">
                {METER_BARS.map((weight, i) => (
                  <span key={i} className="voice-level-bar" style={{ '--bar-weight': weight, '--bar-index': i }} />
                ))}
              </div>
            )}
            {isListening && (
              <span>{isPausing ? `Paused, sending in ${sendCountdown}s...` : (hearingVoice ? "Hearing you..." : "Listening, just talk...")}</span>
            )}
            {isSpeaking && (
              <>
                <Volume2 size={14} className="text-violet" />
                <span>Aura is speaking...</span>
              </>
            )}
            {isTranscribing && (
              <>
                <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                <span>Transcribing your words...</span>
              </>
            )}
            {!isListening && !isSpeaking && !isLoading && !isTranscribing && <span>Ready</span>}
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
              className={`btn ${isListening || isSpeaking ? 'btn-rose' : 'btn-secondary'}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              disabled={isLoading || isTranscribing}
              aria-pressed={isListening}
              aria-label={
                isSpeaking ? "Interrupt Aura and speak"
                  : isListening ? (hearingVoice ? "Send what you said to Aura now" : "Pause the microphone")
                    : "Tap to speak to Aura"
              }
            >
              {isSpeaking ? (
                <>
                  <Hand size={16} /> Interrupt & Speak
                </>
              ) : isListening ? (
                hearingVoice ? (
                  <>
                    <Send size={16} /> Send now
                  </>
                ) : (
                  <>
                    <MicOff size={16} /> Pause mic
                  </>
                )
              ) : (
                <>
                  <Mic size={16} /> Tap to Speak
                </>
              )}
            </button>
          )}

          {isActive && (
            <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0, lineHeight: '1.4' }}>
              Hands-free: just talk. Your words appear live, and Aura replies after a 3-second pause.
            </p>
          )}

          {voiceNotice && (
            <p role="status" style={{ fontSize: '0.75rem', color: '#93c5fd', margin: 0, lineHeight: '1.4' }}>
              {voiceNotice}
            </p>
          )}

          {voiceError && (
            <p role="alert" style={{ fontSize: '0.75rem', color: '#f87171', margin: 0, lineHeight: '1.4' }}>
              {voiceError}
            </p>
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
              A live transcript of your spoken session will populate here. Click <strong>Start Live Session</strong> above and speak naturally. Your words appear as you talk, and Aura replies after you pause for 3 seconds.
            </p>
          ) : (
            captions.map((cap) => (
              <div key={cap.id} className={`caption-wrapper ${cap.role === 'user' ? 'user' : 'model'}`}>
                <span className="caption-sender">{cap.sender}</span>
                <div className="caption-bubble">{cap.text}</div>
              </div>
            ))
          )}

          {/* Real-time speaking buffer with pause countdown */}
          {(liveInterim || (isListening && hearingVoice)) && (
            <div className="caption-wrapper user" style={{ opacity: 0.9 }}>
              <span className="caption-sender" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="pulse-indicator" style={{ width: '8px', height: '8px' }}></span>
                {isPausing ? `Sending to Aura in ${sendCountdown}s...` : "Speaking..."}
              </span>
              <div className="caption-bubble" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' }}>
                {liveInterim || "🎙️ Hearing you..."}
                {isPausing && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd', marginTop: '0.35rem' }}>
                    ⏳ Paused. Keep talking to add more, or wait and Aura will reply.
                  </span>
                )}
                <div className="pause-progress" aria-hidden="true">
                  <div ref={pauseProgressRef} className="pause-progress-fill" />
                </div>
              </div>
            </div>
          )}

          {isTranscribing && (
            <div className="caption-wrapper user" style={{ opacity: 0.9 }}>
              <span className="caption-sender">Student</span>
              <div className="caption-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)' }}>
                <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                <span>Transcribing your words...</span>
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
