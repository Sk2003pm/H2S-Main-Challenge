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
  Info
} from 'lucide-react';
import { storage } from './utils/storage';
import BreathingBubble from './components/BreathingBubble';
import FocusMode from './components/FocusMode';
import JournalAnalyzer from './components/JournalAnalyzer';
import ChatCompanion from './components/ChatCompanion';
import confetti from 'canvas-confetti';

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
    }
  }, []);

  useEffect(() => {
    if (profile) {
      calculateStats();
    }
  }, [profile]);

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
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { y: 0.8 }
      });
      // Clear credentials form
      setUsernameInput('');
      setPasswordInput('');
    } else {
      alert(res.message);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput || !setupName.trim() || !setupDate) {
      alert('Please fill out all fields.');
      return;
    }

    if (passwordInput.length < 6) {
      alert('Password must be at least 6 characters long.');
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
      // Auto login after successful signup
      const loginRes = await storage.loginUser(usernameInput, passwordInput);
      if (loginRes.success) {
        setProfile(loginRes.user);
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        // Reset forms
        setUsernameInput('');
        setPasswordInput('');
        setSetupName('');
        setSetupDate('');
      }
    } else {
      alert(registerRes.message);
    }
  };

  const handleSignOut = () => {
    storage.logoutUser();
    setProfile(null);
    setActiveTab('dashboard');
  };

  const handleWipeAll = () => {
    if (window.confirm('WARNING: This will permanently delete all registered user accounts, passwords, logs, and settings. Proceed?')) {
      storage.clearAllData();
      setProfile(null);
      setActiveTab('dashboard');
      alert('Application database wiped successfully.');
    }
  };

  const handleJournalAnalyzed = () => {
    calculateStats();
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
        analysis_summary: `Quick wellness log logged. You rated your state as ${currentQuickMood}/5. Recommended to try the breathing bubble or chat with Aura to stay grounded.`,
        coping_strategies: [
          { title: "Box Breathing", description: "Practice a quick 2-minute cycle to center yourself." },
          { title: "Chat Companion", description: "Talk to Aura for some positive reinforcement." }
        ],
        milestone_encouragement: `Keep studying. Small efforts every day add up to success in your ${profile.exam}.`
      }
    };

    storage.addJournalLog(newLog);
    calculateStats();
    confetti({
      particleCount: 50,
      spread: 50,
      colors: ['#2dd4bf', '#8b5cf6']
    });
    alert('Quick mindset check-in logged! Your metrics dashboard has been updated.');
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

      {/* Header Bar */}
      <header className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>{profile.avatar}</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Hello, {profile.name}!</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Preparing for {profile.exam}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.75rem', borderRadius: 'var(--border-radius-full)', border: 'var(--border-light)' }}>
            User: <strong>@{profile.username}</strong>
          </span>
        </div>
      </header>

      {/* Content Tabs */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-grid" style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          {/* Quick mood check-in */}
          <div className="db-col-8">
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="flex-between">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Activity className="text-teal" size={22} /> Daily Mood Check-In
                </h3>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Instant Log</span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                Select the emoji that matches your preparation mindset right now to plot your stress trends:
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-around', margin: '1rem 0' }}>
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

              <button className="btn btn-teal" onClick={submitQuickCheckin} style={{ alignSelf: 'center', width: '100%', maxWidth: '240px' }}>
                Save My State
              </button>
            </div>

            {/* Stats widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
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

            {/* Assessment targets helper */}
            <div className="glass-panel" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--accent-violet)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Info size={18} className="text-violet" /> Security & Compliance Panel
              </h4>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                <li><strong>Local Cryptography:</strong> Client-side SHA-256 password hashing prevents cleartext exposure.</li>
                <li><strong>Server-Side API key storage:</strong> Serverless architecture prevents API key leaks in browser networks.</li>
                <li><strong>Privacy Isolation:</strong> Database isolate logs per user profile key (`mindalign_journals_[username]`).</li>
                <li><strong>Accessibility:</strong> Pure HTML5 input validation, screen contrast ratios, and semantic structure.</li>
              </ul>
            </div>
          </div>

          <div className="db-col-4">
            <FocusMode examProfile={profile} />
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div style={{ animation: 'slide-up var(--transition-normal) ease' }}>
          <JournalAnalyzer examProfile={profile} onAnalysisComplete={handleJournalAnalyzed} />
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
            <BreathingBubble />
          </div>
        </div>
      )}
    </div>
  );
}
