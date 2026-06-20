import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  LayoutDashboard, 
  BookOpen, 
  MessageSquare, 
  Wind, 
  User, 
  LogOut, 
  Activity, 
  Sparkles, 
  Award,
  Calendar,
  Lock,
  UserCheck,
  ShieldCheck,
  Info,
  CheckCircle,
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { storage } from './utils/storage';
import BreathingBubble from './components/BreathingBubble';
import FocusMode from './components/FocusMode';
import JournalAnalyzer from './components/JournalAnalyzer';
import ChatCompanion from './components/ChatCompanion';
import confetti from 'canvas-confetti';

const ZEN_QUIZZES = [
  {
    id: 1,
    question: "Why is taking a active 5-minute break every 25 minutes of study (Pomodoro) highly effective for retrieval?",
    options: [
      { text: "It resets your neural paths and allows focus memory consolidation.", isCorrect: true },
      { text: "It allows you to study faster and cram more details.", isCorrect: false },
      { text: "It has no physiological impact; it just wastes study time.", isCorrect: false }
    ],
    explanation: "Consolidation happens when the brain rests. High intensity study without short pauses causes interference, leading to faster forgetting of equations and concepts."
  },
  {
    id: 2,
    question: "How does deep slow exhalation (like in 4-7-8 breathing) reduce sudden exam panic?",
    options: [
      { text: "It alerts the prefrontal cortex to study harder.", isCorrect: false },
      { text: "It activates the parasympathetic nervous system, lowering heart rate.", isCorrect: true },
      { text: "It temporarily reduces oxygen levels to make you sleepy.", isCorrect: false }
    ],
    explanation: "Deep exhalations stimulate the vagus nerve, which tells your heart and brain that you are safe. This reduces cortisol and shuts off the 'fight-or-flight' stress reaction."
  },
  {
    id: 3,
    question: "Why is pulling an 'all-nighter' right before a major board exam or test counterproductive?",
    options: [
      { text: "It prevents REM and deep sleep cycles where mock memories are organized and saved.", isCorrect: true },
      { text: "It makes you too confident, leading to careless mistakes.", isCorrect: false },
      { text: "It causes your eyes to hurt during the test.", isCorrect: false }
    ],
    explanation: "Without sleep, the hippocampus cannot transfer what you studied into long-term retrieval centers. You will likely experience brain fog or blank out under stress."
  }
];

export default function App() {
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Auth view switcher: 'login' or 'signup'
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

  // Quiz States
  const [selectedQuizIdx, setSelectedQuizIdx] = useState(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

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
    // Check if user session is active on mount
    const activeUser = storage.getActiveUser();
    if (activeUser) {
      setProfile(activeUser);
      loadGamification(activeUser.username);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      calculateStats();
    }
  }, [profile]);

  const loadGamification = (username) => {
    try {
      const storedXp = localStorage.getItem(`mindalign_xp_${username}`) || '0';
      const storedLvl = localStorage.getItem(`mindalign_lvl_${username}`) || '1';
      
      const currentXp = Number(storedXp);
      const currentLvl = Number(storedLvl);
      
      setXp(currentXp);
      setLevel(currentLvl);
      setLevelTitle(getLevelName(currentLvl));

      // Load quiz state
      const quizDone = localStorage.getItem(`mindalign_quiz_done_${username}`);
      if (quizDone) {
        setQuizCompleted(true);
        const ans = localStorage.getItem(`mindalign_quiz_ans_${username}`);
        if (ans !== null) setSelectedAnswerIdx(Number(ans));
      } else {
        // Pick quiz based on day
        const day = new Date().getDate();
        setSelectedQuizIdx(day % ZEN_QUIZZES.length);
        setQuizCompleted(false);
        setSelectedAnswerIdx(null);
      }
    } catch (e) {
      console.error(e);
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
        
        // Save level up
        localStorage.setItem(`mindalign_lvl_${username}`, String(currentLvl));
        setLevel(currentLvl);
        setLevelTitle(getLevelName(currentLvl));

        // Celebrations!
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
    confetti({
      particleCount: 50,
      spread: 50,
      colors: ['#2dd4bf', '#8b5cf6']
    });
  };

  // Quiz submission handler
  const handleSelectQuizAnswer = (ansIdx) => {
    if (quizCompleted) return;
    
    setSelectedAnswerIdx(ansIdx);
    setQuizCompleted(true);
    
    const activeQuiz = ZEN_QUIZZES[selectedQuizIdx];
    const isCorrect = activeQuiz.options[ansIdx].isCorrect;

    // Save states
    localStorage.setItem(`mindalign_quiz_done_${profile.username}`, 'true');
    localStorage.setItem(`mindalign_quiz_ans_${profile.username}`, String(ansIdx));

    if (isCorrect) {
      rewardXp(25, "Zen Brain Quiz (Correct Answer)");
      confetti({
        particleCount: 50,
        spread: 45,
        colors: ['#22c55e', '#14b8a6']
      });
      triggerAlert("✨ CORRECT RESPONSE!", `Excellent logic! +25 XP earned. ${activeQuiz.explanation}`);
    } else {
      rewardXp(10, "Zen Brain Quiz Participation");
      triggerAlert("💡 ANSWER REVIEW", `Not quite, but you still earn +10 XP for participating! ${activeQuiz.explanation}`);
    }
  };

  // Onboarding & Authentication Interface
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
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--border-radius-md)', border: 'var(--border-light)' }}>
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
              <label>Username</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. skand" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required 
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input 
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
                <label>Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. skand" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Password (Min. 6 chars)</label>
                <input 
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
              <label>Full Name / Nickname</label>
              <input 
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
              <div className="avatar-grid">
                {avatars.map((av) => (
                  <div 
                    key={av} 
                    className={`avatar-option ${setupAvatar === av ? 'selected' : ''}`}
                    onClick={() => setSetupAvatar(av)}
                  >
                    {av}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Target Competitive Exam</label>
              <select 
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
              <label>Exam Date (Used for Timeline Countdown)</label>
              <input 
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
      </div>
    );
  }

  // Active Quiz Object
  const currentQuiz = ZEN_QUIZZES[selectedQuizIdx];

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
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'journal' ? 'active' : ''}`} 
          onClick={() => setActiveTab('journal')}
        >
          <BookOpen />
          <span>Journal</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`} 
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare />
          <span>Aura Chat</span>
        </button>

        <button 
          className={`nav-link ${activeTab === 'breathing' ? 'active' : ''}`} 
          onClick={() => setActiveTab('breathing')}
        >
          <Wind />
          <span>Breathing</span>
        </button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%' }}>
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
        </div>
      </header>

      {/* Content Tabs */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid" style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          
          <div className="db-col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 1 ? 1 : 0.4, transform: currentQuickMood === 1 ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }}
                  title="Overwhelmed"
                >
                  😞
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(2)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 2 ? 1 : 0.4, transform: currentQuickMood === 2 ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }}
                  title="Tensed"
                >
                  😐
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(3)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 3 ? 1 : 0.4, transform: currentQuickMood === 3 ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }}
                  title="Neutral"
                >
                  🙂
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(4)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 4 ? 1 : 0.4, transform: currentQuickMood === 4 ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }}
                  title="Focused"
                >
                  😇
                </button>
                <button 
                  type="button"
                  onClick={() => setCurrentQuickMood(5)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.5rem', opacity: currentQuickMood === 5 ? 1 : 0.4, transform: currentQuickMood === 5 ? 'scale(1.2)' : 'none', transition: 'all 0.2s' }}
                  title="Confident"
                >
                  🚀
                </button>
              </div>

              <button className="btn btn-teal" onClick={handleQuickCheckinMoodSelection} style={{ alignSelf: 'center', width: '100%', maxWidth: '240px' }}>
                Save My State
              </button>
            </div>

            {/* Zen Brain Quiz (Gamification Question) */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex-between">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <HelpCircle className="text-violet" size={22} /> Zen Brain Quiz
                </h3>
                <span className="badge badge-violet" style={{ fontSize: '0.75rem' }}>+25 XP</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                Answer today's retrieval psychology check-in to build academic resilience and earn wellness points!
              </p>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', border: 'var(--border-light)' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginBottom: '1rem' }}>
                  {currentQuiz.question}
                </strong>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentQuiz.options.map((opt, oIdx) => {
                    const isSelected = selectedAnswerIdx === oIdx;
                    let btnClass = 'quiz-option-btn';
                    if (quizCompleted) {
                      if (opt.isCorrect) btnClass += ' selected-correct';
                      else if (isSelected) btnClass += ' selected-incorrect';
                    }

                    return (
                      <button
                        key={oIdx}
                        className={btnClass}
                        onClick={() => handleSelectQuizAnswer(oIdx)}
                        disabled={quizCompleted}
                      >
                        <span style={{ fontSize: '0.85rem', textAlign: 'left' }}>{opt.text}</span>
                        {quizCompleted && opt.isCorrect && <CheckCircle size={16} color="#4ade80" />}
                      </button>
                    );
                  })}
                </div>
              </div>
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
          <ChatCompanion examProfile={profile} />
        </div>
      )}

      {activeTab === 'breathing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', animation: 'slide-up var(--transition-normal) ease' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <BreathingBubble onCycleComplete={() => rewardXp(30, "Breathing Cycle Done")} onTriggerAlert={triggerAlert} />
          </div>
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
