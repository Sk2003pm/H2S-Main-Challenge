import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  LayoutDashboard, 
  BookOpen, 
  MessageSquare, 
  Wind, 
  LogOut, 
  Activity, 
  Sparkles, 
  Award,
  Calendar,
  Lock,
  UserCheck,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Brain,
  Gamepad2,
  Video
} from 'lucide-react';
import { storage } from './utils/storage';
import BreathingBubble from './components/BreathingBubble';
import FocusMode from './components/FocusMode';
import JournalAnalyzer from './components/JournalAnalyzer';
import ChatCompanion from './components/ChatCompanion';
import StressBusterGame from './components/StressBusterGame';
import AuraLive from './components/AuraLive';
import confetti from 'canvas-confetti';

export default function App() {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth view switcher
  const [authMode, setAuthMode] = useState('login');
  
  // Auth Form Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupExam, setSetupExam] = useState('JEE Main & Advanced');
  const [setupDate, setSetupDate] = useState('');
  const [setupAvatar, setSetupAvatar] = useState('🧘');
  
  // Custom Modal Overlay State
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    isConfirm: false,
    onConfirm: null
  });

  // Gamification States
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelTitle, setLevelTitle] = useState('Mindful Rookie');

  // Dynamic AI-Generated Quiz & Tips
  const [dailyTips, setDailyTips] = useState({
    focus_tip: 'Tackle your highest yield exam topics in active revision intervals.',
    relaxation_tip: 'Roll your shoulders back, close your eyes, and take three box breathing steps.',
    affirmation: 'I am taking charge of my wellness step-by-step.'
  });
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Dashboard Metrics
  const [stats, setStats] = useState({
    avgStress: 0,
    journalsCount: 0,
    calmCycles: 0
  });

  const [currentQuickMood, setCurrentQuickMood] = useState(3); // 1 to 5 scale

  const avatars = ['🧘', '🧠', '🎯', '🚀', '📚', '🍀', '☀️', '🌈'];
  const exams = [
    'JEE Main & Advanced', 
    'NEET UG', 
    'UPSC CSE', 
    'GATE', 
    'CAT (IIM)', 
    'CUET', 
    'CBSE / ICSE Board Exams'
  ];

  useEffect(() => {
    const activeUser = storage.getActiveUser();
    if (activeUser) {
      setProfile(activeUser);
      loadGamification(activeUser.username);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      calculateStats();
      fetchDailyTipsAndQuiz();
    }
  }, [profile]);

  const loadGamification = (username) => {
    try {
      const storedXp = localStorage.getItem(`mindalign_xp_${username}`) || '0';
      const storedLvl = localStorage.getItem(`mindalign_lvl_${username}`) || '1';
      
      setXp(Number(storedXp));
      setLevel(Number(storedLvl));
      setLevelTitle(getLevelName(Number(storedLvl)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDailyTipsAndQuiz = async () => {
    if (!profile) return;
    setIsQuizLoading(true);

    const logs = storage.getJournalLogs();
    const recentTriggers = logs.length > 0 ? logs[0].analysis.triggers : [];
    const currentStress = logs.length > 0 ? logs[0].stress_input : 50;

    // 1. Fetch AI Daily Tips
    try {
      const tipsRes = await fetch('/api/daily-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: profile.exam,
          triggers: recentTriggers,
          current_stress: currentStress
        })
      });
      if (tipsRes.ok) {
        const data = await tipsRes.json();
        setDailyTips(data);
      }
    } catch (e) {
      console.error("Error loading daily tips:", e);
    }

    // 2. Fetch or restore AI Zen Quiz
    try {
      const quizDone = localStorage.getItem(`mindalign_quiz_done_${profile.username}`);
      if (quizDone) {
        setQuizCompleted(true);
        const ans = localStorage.getItem(`mindalign_quiz_ans_${profile.username}`);
        if (ans !== null) setSelectedAnswerIdx(Number(ans));
        
        const savedQ = localStorage.getItem(`mindalign_quiz_q_${profile.username}`);
        if (savedQ) {
          setQuizQuestion(JSON.parse(savedQ));
          setIsQuizLoading(false);
          return;
        }
      }

      // Generate a new dynamic question using Gemini
      const quizRes = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: profile.exam,
          triggers: recentTriggers
        })
      });
      if (quizRes.ok) {
        const data = await quizRes.json();
        setQuizQuestion(data);
        localStorage.setItem(`mindalign_quiz_q_${profile.username}`, JSON.stringify(data));
        setQuizCompleted(false);
        setSelectedAnswerIdx(null);
      }
    } catch (e) {
      console.error("Error loading daily quiz:", e);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const getLevelName = (lvl) => {
    if (lvl === 1) return 'Mindful Rookie';
    if (lvl === 2) return 'Zen Scholar';
    if (lvl === 3) return 'Focus Guru';
    if (lvl === 4) return 'Calm Conqueror';
    return 'Ascended Sage';
  };

  const triggerAlert = (title, message) => {
    setModal({
      isOpen: true,
      title,
      message,
      isConfirm: false,
      onConfirm: null
    });
  };

  const triggerConfirm = (title, message, callback) => {
    setModal({
      isOpen: true,
      title,
      message,
      isConfirm: true,
      onConfirm: callback
    });
  };

  const rewardXp = (amount, taskName) => {
    if (!profile) return;
    const username = profile.username;
    
    setXp((prevXp) => {
      let newXp = prevXp + amount;
      let currentLvl = level;
      const xpNeeded = currentLvl * 100;
      
      if (newXp >= xpNeeded) {
        newXp = newXp - xpNeeded;
        currentLvl += 1;
        
        localStorage.setItem(`mindalign_lvl_${username}`, String(currentLvl));
        setLevel(currentLvl);
        setLevelTitle(getLevelName(currentLvl));

        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 }
        });
        
        triggerAlert(
          "🌟 MINDSET LEVEL UP!",
          `Amazing work! By practicing ${taskName}, you have ascended to Level ${currentLvl} (${getLevelName(currentLvl)})! Keep maintaining your emotional equilibrium.`
        );
      }

      localStorage.setItem(`mindalign_xp_${username}`, String(newXp));
      return newXp;
    });
  };

  const calculateStats = () => {
    const logs = storage.getJournalLogs();
    const completedBreaths = localStorage.getItem(`mindalign_breath_cycles_${profile?.username}`) || 0;
    
    if (logs.length > 0) {
      const totalStress = logs.reduce((acc, curr) => acc + curr.stress_input, 0);
      setStats({
        avgStress: Math.round(totalStress / logs.length),
        journalsCount: logs.length,
        calmCycles: Number(completedBreaths)
      });
    } else {
      setStats({
        avgStress: 0,
        journalsCount: 0,
        calmCycles: Number(completedBreaths)
      });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput) return;

    const res = await storage.loginUser(usernameInput, passwordInput);
    if (res.success) {
      setProfile(res.user);
      loadGamification(res.user.username);
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.8 }
      });
      setUsernameInput('');
      setPasswordInput('');
    } else {
      triggerAlert("Sign In Error", res.message);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput || !setupName.trim() || !setupDate) {
      triggerAlert("Incomplete Fields", "Please complete all registration options.");
      return;
    }

    if (passwordInput.length < 6) {
      triggerAlert("Weak Password", "Password must contain at least 6 characters.");
      return;
    }

    const registerRes = await storage.registerUser(
      usernameInput,
      passwordInput,
      setupName,
      setupExam,
      setupDate,
      setupAvatar
    );

    if (registerRes.success) {
      const loginRes = await storage.loginUser(usernameInput, passwordInput);
      if (loginRes.success) {
        setProfile(loginRes.user);
        loadGamification(loginRes.user.username);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        setUsernameInput('');
        setPasswordInput('');
        setSetupName('');
        setSetupDate('');
      }
    } else {
      triggerAlert("Registration Error", registerRes.message);
    }
  };

  const handleSignOut = () => {
    triggerConfirm(
      "Confirm Sign Out",
      "Do you want to log out of your MindAlign account? Your local data will remain saved.",
      () => {
        storage.logoutUser();
        setProfile(null);
        setActiveTab('dashboard');
      }
    );
  };

  const handleWipeAll = () => {
    triggerConfirm(
      "CAUTION: WIPE ENTIRE APP",
      "This will permanently delete all registered accounts, hashed passwords, local journals, and statistics. This cannot be undone. Proceed?",
      () => {
        if (profile) {
          localStorage.removeItem(`mindalign_quiz_done_${profile.username}`);
          localStorage.removeItem(`mindalign_quiz_ans_${profile.username}`);
          localStorage.removeItem(`mindalign_quiz_q_${profile.username}`);
        }
        storage.clearAllData();
        setProfile(null);
        setActiveTab('dashboard');
        triggerAlert("Wiped", "All local application data has been wiped.");
      }
    );
  };

  const handleJournalAnalyzed = () => {
    calculateStats();
    rewardXp(40, "Expressive Journaling");
    fetchDailyTipsAndQuiz(); // refresh tips
  };

  const handleQuickCheckinMoodSelection = () => {
    submitQuickCheckin();
  };

  const submitQuickCheckin = () => {
    if (!profile) return;
    const stressMap = { 1: 90, 2: 70, 3: 50, 4: 30, 5: 15 };
    const simulatedStress = stressMap[currentQuickMood];
    
    const responses = {
      1: "I am feeling extremely overwhelmed and having trouble focusing today.",
      2: "Exam stress is building up, mock results are worrying, and revision is behind.",
      3: "A normal preparation day. Some anxiety but managed to study.",
      4: "Had a productive study session. Feeling more confident.",
      5: "Woke up energized and completed my study goals. Minimal anxiety."
    };

    const newLog = {
      id: Date.now(),
      date: new Date().toISOString(),
      text: `[Quick Check-in] ${responses[currentQuickMood]}`,
      stress_input: simulatedStress,
      analysis: {
        mood_score: 100 - simulatedStress,
        primary_emotions: currentQuickMood <= 2 ? ["Anxiety", "Pressure"] : ["Stability", "Calm"],
        triggers: currentQuickMood <= 2 ? ["Study pressure"] : ["Daily Routine"],
        analysis_summary: `Quick wellness mindset logged. You rated your state as ${currentQuickMood}/5. Recommended to try the breathing bubble or chat with Aura to stay grounded.`,
        coping_strategies: [
          { title: "Box Breathing", description: "Practice a quick 2-minute cycle to center yourself." },
          { title: "Chat Companion", description: "Talk to Aura for some positive reinforcement." }
        ],
        milestone_encouragement: `Keep studying. Small efforts every day add up to success in your ${profile.exam}.`
      }
    };

    storage.addJournalLog(newLog);
    calculateStats();
    rewardXp(15, "Mood Check-in");
    fetchDailyTipsAndQuiz(); // refresh
    confetti({
      particleCount: 50,
      spread: 50,
      colors: ['#2dd4bf', '#8b5cf6']
    });
  };

  // Quiz Answer selection
  const handleSelectQuizAnswer = (ansIdx) => {
    if (quizCompleted || !quizQuestion) return;
    
    setSelectedAnswerIdx(ansIdx);
    setQuizCompleted(true);
    
    const isCorrect = quizQuestion.correct_idx === ansIdx;

    localStorage.setItem(`mindalign_quiz_done_${profile.username}`, 'true');
    localStorage.setItem(`mindalign_quiz_ans_${profile.username}`, String(ansIdx));

    if (isCorrect) {
      rewardXp(25, "Zen Brain Quiz (Correct Answer)");
      confetti({
        particleCount: 50,
        spread: 45,
        colors: ['#22c55e', '#14b8a6']
      });
      triggerAlert("✨ CORRECT RESPONSE!", `Excellent logic! +25 XP earned. ${quizQuestion.explanation}`);
    } else {
      rewardXp(10, "Zen Brain Quiz Participation");
      triggerAlert("💡 ANSWER REVIEW", `Not quite, but you still earn +10 XP for participating! ${quizQuestion.explanation}`);
    }
  };

  // Render Login & Signup onboarding if user is not authenticated
  if (!profile) {
    return (
      <div className="setup-container" style={{ margin: '3.5rem auto' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <Heart size={32} className="text-teal" />
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800' }} className="text-gradient">MindAlign</h1>
          </div>
          <p className="text-muted">Empathetic AI Companion for Competitive Exam Aspirants</p>
        </div>

        {/* Toggle between Login and Signup */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: 'var(--border-radius-md)', border: 'var(--border-light)' }}>
          <button 
            type="button" 
            className={`btn btn-secondary ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => setAuthMode('login')}
            style={{ flex: 1, padding: '0.6rem', border: 'none', background: authMode === 'login' ? 'rgba(255,255,255,0.06)' : 'transparent' }}
          >
            Sign In
          </button>
          <button 
            type="button" 
            className={`btn btn-secondary ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => setAuthMode('signup')}
            style={{ flex: 1, padding: '0.6rem', border: 'none', background: authMode === 'signup' ? 'rgba(255,255,255,0.06)' : 'transparent' }}
          >
            Register Account
          </button>
        </div>

        {authMode === 'login' ? (
          <form className="glass-panel" onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} className="text-teal" /> Sign In to Your Companion
            </h3>

            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input 
                id="login-username"
                type="text" 
                className="input-field" 
                placeholder="e.g. skand" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input 
                id="login-password"
                type="password" 
                className="input-field" 
                placeholder="••••••" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-teal" style={{ width: '100%', marginTop: '0.5rem' }}>
              Authenticate
            </button>
          </form>
        ) : (
          <form className="glass-panel" onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={18} className="text-violet" /> Create Wellness Account
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="signup-username">Username</label>
                <input 
                  id="signup-username"
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. skand" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="signup-password">Password (Min. 6 chars)</label>
                <input 
                  id="signup-password"
                  type="password" 
                  className="input-field" 
                  placeholder="••••••" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-name">Full Name / Nickname</label>
              <input 
                id="signup-name"
                type="text" 
                className="input-field" 
                placeholder="e.g. Skand Mishra" 
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <label>Select Profile Avatar</label>
              <div className="avatar-grid" role="radiogroup" aria-label="Select Profile Avatar">
                {avatars.map((av) => (
                  <button 
                    type="button"
                    key={av} 
                    className={`avatar-option ${setupAvatar === av ? 'selected' : ''}`}
                    onClick={() => setSetupAvatar(av)}
                    aria-label={`Select avatar ${av}`}
                    aria-pressed={setupAvatar === av}
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-exam">Target Competitive Exam</label>
              <select 
                id="signup-exam"
                className="input-field" 
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                value={setupExam}
                onChange={(e) => setSetupExam(e.target.value)}
              >
                {exams.map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="signup-date">Exam Date (Used for Timeline Countdown)</label>
              <input 
                id="signup-date"
                type="date" 
                className="input-field" 
                value={setupDate}
                onChange={(e) => setSetupDate(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Register & Setup Profile
            </button>
          </form>
        )}

        <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ShieldCheck size={28} className="text-teal" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
            <strong>Security Protocol:</strong> All student accounts and journal text credentials are secure and saved offline-first. Gemini processing occurs directly via secure serverless nodes.
          </p>
        </div>

        {/* Modal display for auth screen alert overlays */}
        {modal.isOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <Sparkles size={18} className="text-teal" />
                <span>{modal.title}</span>
              </div>
              <div className="modal-body">{modal.message}</div>
              <div className="modal-actions">
                <button className="btn btn-teal" onClick={() => setModal({ ...modal, isOpen: false })}>
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 1rem' }} className="nav-logo">
          <Heart size={20} className="text-teal" />
          <span style={{ fontWeight: '800', fontFamily: 'var(--font-title)', fontSize: '1rem' }} className="text-gradient">MindAlign</span>
        </div>
        
        <button 
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} 
          onClick={() => setActiveTab('dashboard')}
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'journal' ? 'active' : ''}`} 
          onClick={() => setActiveTab('journal')}
          aria-current={activeTab === 'journal' ? 'page' : undefined}
        >
          <BookOpen />
          <span>Journal</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`} 
          onClick={() => setActiveTab('chat')}
          aria-current={activeTab === 'chat' ? 'page' : undefined}
        >
          <MessageSquare />
          <span>Aura Chat</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'aura-live' ? 'active' : ''}`} 
          onClick={() => setActiveTab('aura-live')}
          aria-current={activeTab === 'aura-live' ? 'page' : undefined}
        >
          <Video />
          <span>Aura Live</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'breathing' ? 'active' : ''}`} 
          onClick={() => setActiveTab('breathing')}
          aria-current={activeTab === 'breathing' ? 'page' : undefined}
        >
          <Wind />
          <span>Breathing</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'stress-buster' ? 'active' : ''}`} 
          onClick={() => setActiveTab('stress-buster')}
          aria-current={activeTab === 'stress-buster' ? 'page' : undefined}
        >
          <Gamepad2 />
          <span>Stress Buster</span>
        </button>

        <div className="nav-footer">
          <button 
            className="nav-link" 
            onClick={handleSignOut}
            style={{ opacity: 0.8 }}
            title="Sign Out"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
          <button 
            className="nav-link" 
            onClick={handleWipeAll}
            style={{ opacity: 0.5, fontSize: '0.65rem' }}
            title="Clear all local databases"
          >
            <span>Wipe DB</span>
          </button>
        </div>
      </nav>

      {/* Header Bar with Gamified Level Metrics */}
      <header className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2.2rem' }}>{profile.avatar}</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Hello, {profile.name}!</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Preparing for {profile.exam}
            </span>
          </div>
        </div>
        
        {/* Gamified progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="xp-container" title={`${xp} / ${level * 100} XP for next level`}>
            <Award size={18} className="text-violet" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Lvl {level}: <span className="text-gradient">{levelTitle}</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="xp-bar-bg">
                  <div className="xp-bar-fill" style={{ width: `${(xp / (level * 100)) * 100}%` }}></div>
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{xp}/{level * 100} XP</span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.75rem', borderRadius: 'var(--border-radius-full)', border: 'var(--border-light)', whiteSpace: 'nowrap' }}>
            User: <strong>@{profile.username}</strong>
          </span>
          <div className="header-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handleSignOut}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content Tabs */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid" style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          
          <div className="db-col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* AI-Generated Dynamic Study/Relaxation Tips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-violet)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <Brain className="text-violet" size={24} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>AI Dynamic Focus Tip</span>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>{dailyTips.focus_tip}</p>
                </div>
              </div>

              <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-teal)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <Sparkles className="text-teal" size={24} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>AI Stress-Reliever</span>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>{dailyTips.relaxation_tip}</p>
                </div>
              </div>
            </div>

            {/* Quick mood check-in */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="flex-between">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Activity className="text-teal" size={22} /> Daily Mood Check-In
                </h3>
                <span className="badge badge-teal" style={{ fontSize: '0.75rem' }}>+15 XP</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                Select the emoji that matches your preparation mindset right now to plot your stress trends:
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-around', margin: '0.5rem 0' }}>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(1)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 1 ? 1 : 0.4, transform: currentQuickMood === 1 ? 'scale(1.2)' : 'none', transition: 'all 0.2s', padding: '0.2rem', borderRadius: '50%' }}
                  title="Overwhelmed"
                  aria-label="Mood: Overwhelmed"
                  aria-pressed={currentQuickMood === 1}
                >
                  😞
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(2)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 2 ? 1 : 0.4, transform: currentQuickMood === 2 ? 'scale(1.2)' : 'none', transition: 'all 0.2s', padding: '0.2rem', borderRadius: '50%' }}
                  title="Tensed"
                  aria-label="Mood: Tensed"
                  aria-pressed={currentQuickMood === 2}
                >
                  😐
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(3)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 3 ? 1 : 0.4, transform: currentQuickMood === 3 ? 'scale(1.2)' : 'none', transition: 'all 0.2s', padding: '0.2rem', borderRadius: '50%' }}
                  title="Neutral"
                  aria-label="Mood: Neutral"
                  aria-pressed={currentQuickMood === 3}
                >
                  🙂
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(4)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 4 ? 1 : 0.4, transform: currentQuickMood === 4 ? 'scale(1.2)' : 'none', transition: 'all 0.2s', padding: '0.2rem', borderRadius: '50%' }}
                  title="Focused"
                  aria-label="Mood: Focused"
                  aria-pressed={currentQuickMood === 4}
                >
                  😇
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(5)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 5 ? 1 : 0.4, transform: currentQuickMood === 5 ? 'scale(1.2)' : 'none', transition: 'all 0.2s', padding: '0.2rem', borderRadius: '50%' }}
                  title="Confident"
                  aria-label="Mood: Confident"
                  aria-pressed={currentQuickMood === 5}
                >
                  🚀
                </button>
              </div>

              <button className="btn btn-teal" onClick={handleQuickCheckinMoodSelection} style={{ alignSelf: 'center', width: '100%', maxWidth: '240px' }}>
                Save My State
              </button>
            </div>

            {/* AI Zen Brain Quiz (Gamified Question) */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex-between">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <HelpCircle className="text-violet" size={22} /> Zen Brain Quiz
                </h3>
                <span className="badge badge-violet" style={{ fontSize: '0.75rem' }}>+25 XP</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                Answer today's active retrieval psychology check-in to build academic resilience and earn wellness points!
              </p>
              
              {isQuizLoading ? (
                <div className="flex-center" style={{ padding: '2rem', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="spinner"></div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Generating custom quiz via Gemini...</span>
                </div>
              ) : quizQuestion ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-light)' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginBottom: '1rem' }}>
                    {quizQuestion.question}
                  </strong>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {quizQuestion.options.map((opt, oIdx) => {
                      const isSelected = selectedAnswerIdx === oIdx;
                      let btnClass = 'quiz-option-btn';
                      if (quizCompleted) {
                        if (quizQuestion.correct_idx === oIdx) btnClass += ' selected-correct';
                        else if (isSelected) btnClass += ' selected-incorrect';
                      }

                      return (
                        <button
                          key={oIdx}
                          className={btnClass}
                          onClick={() => handleSelectQuizAnswer(oIdx)}
                          disabled={quizCompleted}
                        >
                          <span style={{ fontSize: '0.85rem', textAlign: 'left' }}>{opt}</span>
                          {quizCompleted && quizQuestion.correct_idx === oIdx && <CheckCircle size={16} color="#4ade80" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center' }}>No quiz active. Complete a journal analysis first!</p>
              )}
            </div>

            {/* Stats widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="glass-panel text-center" style={{ padding: '1rem' }}>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Avg. Stress</span>
                <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-title)' }} className="text-gradient">
                  {stats.avgStress > 0 ? `${stats.avgStress}%` : 'N/A'}
                </span>
              </div>
              <div className="glass-panel text-center" style={{ padding: '1rem' }}>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Journal Logs</span>
                <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-title)' }} className="text-gradient">
                  {stats.journalsCount}
                </span>
              </div>
              <div className="glass-panel text-center" style={{ padding: '1rem' }}>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Mindful Cycles</span>
                <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-title)' }} className="text-gradient">
                  {stats.calmCycles}
                </span>
              </div>
            </div>

          </div>

          <div className="db-col-4">
            <FocusMode examProfile={profile} onTimerComplete={() => rewardXp(50, "Focus Session Complete")} onTriggerAlert={triggerAlert} />
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          <JournalAnalyzer examProfile={profile} onAnalysisComplete={handleJournalAnalyzed} onCopingChecked={() => rewardXp(20, "Coping Task Completed")} />
        </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          <ChatCompanion examProfile={profile} onTriggerConfirm={triggerConfirm} />
        </div>
      )}

      {activeTab === 'aura-live' && (
        <div style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          <AuraLive examProfile={profile} onTriggerConfirm={triggerConfirm} />
        </div>
      )}

      {activeTab === 'breathing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', animation: 'slide-up var(--transition-normal) ease' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <BreathingBubble onCycleComplete={() => rewardXp(30, "Breathing Cycle Done")} onTriggerAlert={triggerAlert} />
          </div>
        </div>
      )}

      {activeTab === 'stress-buster' && (
        <div style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          <StressBusterGame examProfile={profile} onXpReward={rewardXp} onTriggerAlert={triggerAlert} />
        </div>
      )}

      {/* Premium Reusable Dialog Modal Overlay */}
      {modal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <Sparkles size={18} className="text-teal" />
              <span>{modal.title}</span>
            </div>
            <div className="modal-body">
              {modal.message}
            </div>
            <div className="modal-actions">
              {modal.isConfirm ? (
                <>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => setModal({ ...modal, isOpen: false })}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-teal" 
                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      setModal({ ...modal, isOpen: false });
                      if (modal.onConfirm) modal.onConfirm();
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button 
                  className="btn btn-teal" 
                  style={{ padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
                  onClick={() => setModal({ ...modal, isOpen: false })}
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
