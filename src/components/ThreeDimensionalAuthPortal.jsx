import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  ShieldCheck, 
  ArrowRight, 
  Brain,
  Eye,
  EyeOff,
  Globe,
  Smartphone,
  Palette,
  Sparkles
} from 'lucide-react';
import BrainHologram3D from './BrainHologram3D';

/**
 * ThreeDimensionalAuthPortal
 * 
 * Liquid frosted glassmorphism authentication experience (iOS / Apple frosted glass).
 * Engineered to fit 100% inside standard viewports with ZERO scroll,
 * keeping "MindAlign" title and 3D Brain Hologram perfectly stable on the left.
 */
export default function ThreeDimensionalAuthPortal({
  authMode,
  setAuthMode,
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  setupName,
  setSetupName,
  setupExam,
  setSetupExam,
  setupDate,
  setSetupDate,
  setupAvatar,
  setSetupAvatar,
  handleLoginSubmit,
  handleSignupSubmit,
  avatars,
  exams,
  modal,
  setModal
}) {
  const [activeFocusField, setActiveFocusField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const onFormSubmit = async (e, handler) => {
    setIsSubmitting(true);
    try {
      await handler(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = (e) => {
    e.preventDefault();
    setUsernameInput('aarav');
    setPasswordInput('password123');
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      onFormSubmit(fakeEvent, handleLoginSubmit);
    }, 80);
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setModal({
      isOpen: true,
      title: '🔐 Password Recovery',
      message: 'MindAlign uses a zero-knowledge local student vault. Enter your registered username, or use the Quick Demo mode to sign in immediately.'
    });
  };

  const handleQuickAction = (featureName) => {
    setModal({
      isOpen: true,
      title: `✨ ${featureName}`,
      message: `${featureName} is ready to use. Sign in or use Quick Demo to access full offline student wellness analytics.`
    });
  };

  return (
    <div className="auth-portal-wrapper" style={{
      maxWidth: '1160px',
      margin: '0 auto',
      padding: '0.75rem 1.25rem',
      position: 'relative',
      zIndex: 10,
      width: '100%',
      maxHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Radiant Fluid Ambient Orbs behind the layout to illuminate frosted glass */}
      <div 
        style={{
          position: 'absolute',
          top: '-30px',
          right: '-20px',
          width: '460px',
          height: '460px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.40) 0%, rgba(249, 115, 22, 0.30) 45%, transparent 75%)',
          filter: 'blur(75px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'pulse-glow 9s ease-in-out infinite alternate'
        }} 
        aria-hidden="true"
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '-40px',
          right: '120px',
          width: '440px',
          height: '440px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(217, 70, 239, 0.22) 45%, transparent 75%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'pulse-glow 11s ease-in-out infinite alternate-reverse'
        }} 
        aria-hidden="true"
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '-30px',
          left: '20px',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.32) 0%, rgba(139, 92, 246, 0.22) 50%, transparent 75%)',
          filter: 'blur(85px)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'pulse-glow 13s ease-in-out infinite alternate'
        }} 
        aria-hidden="true"
      />

      {/* Main Dual-Column Grid: Fixed Vertical Anchoring */}
      <div 
        className="auth-portal-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: '2rem',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2
        }}
      >
        {/* Left Side: Fixed Anchor Floating 3D Brain Hologram (MindAlign Never Moves Down) */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            position: 'relative',
            padding: '0.2rem 0',
            alignSelf: 'center'
          }}
        >
          {/* Brand Logo & Crisp White Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)'
            }}>
              <Brain size={24} style={{ color: '#ffffff' }} />
            </div>
            <h1 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 800, 
              letterSpacing: '-0.03em', 
              margin: 0,
              color: '#ffffff',
              lineHeight: 1.1
            }}>
              MindAlign
            </h1>
          </div>

          <p style={{ 
            fontSize: '0.95rem', 
            fontWeight: 500, 
            color: '#f8fafc', 
            margin: '0.15rem 0 0.25rem 0',
            lineHeight: '1.4'
          }}>
            Empathetic AI Companion for Competitive Exam Aspirants
          </p>

          <p style={{ 
            fontSize: '0.8rem', 
            color: 'rgba(255, 255, 255, 0.70)', 
            margin: '0 0 0.4rem 0',
            lineHeight: '1.35'
          }}>
            Engineered for NEET, JEE, UPSC, GATE, CAT & Boards to master stress.
          </p>

          {/* Floating 3D Brain Hologram Viewport — Compact & Responsive */}
          <div style={{ 
            width: '100%', 
            height: '280px', 
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BrainHologram3D 
              activeFocus={activeFocusField || authMode} 
              isSubmitting={isSubmitting}
              width={380}
              height={280}
            />
          </div>
        </div>

        {/* Right Side: Ultra-Translucent Frosted Liquid Glass Card (Fits on Screen Without Scroll) */}
        <div 
          className="glass-card-container"
          style={{
            borderRadius: '26px',
            padding: '1.25rem 1.6rem',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(36px) saturate(190%)',
            WebkitBackdropFilter: 'blur(36px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.24)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            alignSelf: 'center',
            minHeight: '430px'
          }}
        >
          {/* Subtle internal glass gloss reflection at top */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '30%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%)',
              pointerEvents: 'none'
            }} 
            aria-hidden="true"
          />

          {/* Mode Switcher Tabs */}
          <div 
            style={{ 
              display: 'flex', 
              background: 'rgba(0, 0, 0, 0.28)', 
              padding: '3px', 
              borderRadius: '14px', 
              border: '1px solid rgba(255, 255, 255, 0.14)',
              position: 'relative',
              zIndex: 1
            }}
          >
            <button 
              type="button" 
              onClick={() => setAuthMode('login')}
              style={{ 
                flex: 1, 
                padding: '0.45rem', 
                borderRadius: '11px',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: authMode === 'login' 
                  ? 'rgba(255, 255, 255, 0.24)' 
                  : 'transparent',
                color: authMode === 'login' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                border: authMode === 'login' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                boxShadow: authMode === 'login' ? '0 3px 10px rgba(0, 0, 0, 0.2)' : 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button 
              type="button" 
              onClick={() => setAuthMode('signup')}
              style={{ 
                flex: 1, 
                padding: '0.45rem', 
                borderRadius: '11px',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: authMode === 'signup' 
                  ? 'rgba(255, 255, 255, 0.24)' 
                  : 'transparent',
                color: authMode === 'signup' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                border: authMode === 'signup' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                boxShadow: authMode === 'signup' ? '0 3px 10px rgba(0, 0, 0, 0.2)' : 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              Register Account
            </button>
          </div>

          {/* Smooth CSS tab-transition animation */}
          <style>{`
            @keyframes auth-tab-fade {
              from {
                opacity: 0;
                transform: translateY(6px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .auth-tab-content {
              animation: auth-tab-fade 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>

          <div key={authMode} className="auth-tab-content">
          {authMode === 'login' ? (
            /* Login Form - Matches Mockup Compactly */
            <form onSubmit={(e) => onFormSubmit(e, handleLoginSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', position: 'relative', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em' }}>
                  Sign in
                </h2>
                <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.85)', margin: '0.2rem 0 0 0' }}>
                  Good to see you again.
                </p>
              </div>

              {/* Email Address / Username Field */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label htmlFor="login-username" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>
                  Email address / Username
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="login-username"
                    type="text" 
                    placeholder="you@studio.com" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onFocus={() => setActiveFocusField('username')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{ 
                      width: '100%',
                      height: '42px',
                      padding: '0 0.9rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: activeFocusField === 'username' ? '1px solid rgba(255, 255, 255, 0.65)' : '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '13px',
                      color: '#ffffff',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxShadow: activeFocusField === 'username' ? '0 0 0 3px rgba(255, 255, 255, 0.18)' : 'none',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Password Field with Eye Toggle */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label htmlFor="login-password" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="login-password"
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="••••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onFocus={() => setActiveFocusField('password')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{ 
                      width: '100%',
                      height: '42px',
                      padding: '0 2.5rem 0 0.9rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: activeFocusField === 'password' ? '1px solid rgba(255, 255, 255, 0.65)' : '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '13px',
                      color: '#ffffff',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxShadow: activeFocusField === 'password' ? '0 0 0 3px rgba(255, 255, 255, 0.18)' : 'none',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'rgba(255, 255, 255, 0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Utility Row: Remember me + Forgot password */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-0.1rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.9)', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#ffffff', cursor: 'pointer' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.92)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Solid White Pill Action Button */}
              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  height: '44px',
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: '#ffffff',
                  color: '#0b1120',
                  border: 'none',
                  borderRadius: '13px',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.28)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderColor: '#0b1120', borderTopColor: 'transparent' }} /> 
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={17} color="#0b1120" />
                  </>
                )}
              </button>

              {/* Bottom Footer Info */}
              <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
                <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
                  New to MindAlign?{' '}
                  <button 
                    type="button" 
                    onClick={() => setAuthMode('signup')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Create an account
                  </button>
                  {' '}&bull;{' '}
                  <button 
                    type="button" 
                    onClick={handleQuickDemoLogin}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.70)',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Quick Demo
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* Register Account Form - Fits 100% On Screen, No Scrolling */
            <form onSubmit={(e) => onFormSubmit(e, handleSignupSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', position: 'relative', zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: '1.65rem', margin: 0, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em' }}>
                  Create account
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.85)', margin: '0.15rem 0 0 0' }}>
                  Start your mindful exam preparation.
                </p>
              </div>

              {/* Row 1: Username & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="signup-username" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Username</label>
                  <input 
                    id="signup-username"
                    type="text" 
                    placeholder="e.g. aarav_sharma" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onFocus={() => setActiveFocusField('username')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{
                      height: '38px',
                      padding: '0 0.8rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="signup-password" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Password</label>
                  <input 
                    id="signup-password"
                    type="password" 
                    placeholder="Min. 6 chars" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onFocus={() => setActiveFocusField('password')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{
                      height: '38px',
                      padding: '0 0.8rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Full Name & Exam Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="signup-name" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Full Name</label>
                  <input 
                    id="signup-name"
                    type="text" 
                    placeholder="e.g. Aarav Sharma" 
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    onFocus={() => setActiveFocusField('name')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{
                      height: '38px',
                      padding: '0 0.8rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="signup-date" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Target Date</label>
                  <input 
                    id="signup-date"
                    type="date" 
                    value={setupDate}
                    onChange={(e) => setSetupDate(e.target.value)}
                    required 
                    style={{
                      height: '38px',
                      padding: '0 0.7rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Target Exam & Avatar Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '0.65rem' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="signup-exam" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Target Exam</label>
                  <select 
                    id="signup-exam"
                    style={{ 
                      height: '38px',
                      padding: '0 0.6rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    value={setupExam}
                    onChange={(e) => setSetupExam(e.target.value)}
                  >
                    {exams.map((ex) => (
                      <option key={ex} value={ex} style={{ background: '#0f172a', color: '#ffffff' }}>{ex}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>Select Avatar</label>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {avatars.slice(0, 5).map((av) => (
                      <button 
                        type="button" 
                        key={av} 
                        onClick={() => setSetupAvatar(av)}
                        aria-label={`Select avatar ${av}`}
                        style={{ 
                          width: '32px',
                          height: '32px',
                          border: setupAvatar === av ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.18)', 
                          background: setupAvatar === av ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255,255,255,0.08)',
                          cursor: 'pointer', 
                          borderRadius: '50%',
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: setupAvatar === av ? '0 3px 10px rgba(0,0,0,0.35)' : 'none'
                        }}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  height: '42px',
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  marginTop: '0.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: '#ffffff',
                  color: '#0b1120',
                  border: 'none',
                  borderRadius: '13px',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.28)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderColor: '#0b1120', borderTopColor: 'transparent' }} /> Creating Profile...
                  </>
                ) : (
                  <>
                    Create account <ArrowRight size={17} color="#0b1120" />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => setAuthMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}
          </div>

          {/* Compact Security Pill */}
          <div style={{ 
            display: 'flex', 
            gap: '0.55rem', 
            alignItems: 'center', 
            padding: '0.5rem 0.8rem', 
            borderRadius: '13px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            position: 'relative',
            zIndex: 1
          }}>
            <ShieldCheck size={18} style={{ color: '#ffffff', flexShrink: 0, opacity: 0.9 }} />
            <p style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.82)', lineHeight: '1.3', margin: 0 }}>
              <strong>Zero-Knowledge SQLite Vault:</strong> Cryptographically salted passwords, private student journal safeguarding.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Overlay if an alert is active */}
      {modal.isOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={modal.title}>
          <div 
            className="modal-card"
            style={{
              background: 'rgba(255, 255, 255, 0.14)',
              backdropFilter: 'blur(36px) saturate(200%)',
              WebkitBackdropFilter: 'blur(36px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              borderRadius: '24px',
              color: '#ffffff',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.18)' }}>
              <Sparkles size={18} style={{ color: '#ffffff' }} />
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{modal.title}</span>
            </div>
            <div className="modal-body" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{modal.message}</div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn" 
                onClick={() => setModal({ ...modal, isOpen: false })}
                style={{ 
                  background: '#ffffff',
                  color: '#0b1120',
                  fontWeight: 700,
                  borderRadius: '13px',
                  padding: '0.55rem 1.3rem',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
                }}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ThreeDimensionalAuthPortal.propTypes = {
  authMode: PropTypes.string.isRequired,
  setAuthMode: PropTypes.func.isRequired,
  usernameInput: PropTypes.string.isRequired,
  setUsernameInput: PropTypes.func.isRequired,
  passwordInput: PropTypes.string.isRequired,
  setPasswordInput: PropTypes.func.isRequired,
  setupName: PropTypes.string.isRequired,
  setSetupName: PropTypes.func.isRequired,
  setupExam: PropTypes.string.isRequired,
  setSetupExam: PropTypes.func.isRequired,
  setupDate: PropTypes.string.isRequired,
  setSetupDate: PropTypes.func.isRequired,
  setupAvatar: PropTypes.string.isRequired,
  setSetupAvatar: PropTypes.func.isRequired,
  handleLoginSubmit: PropTypes.func.isRequired,
  handleSignupSubmit: PropTypes.func.isRequired,
  avatars: PropTypes.arrayOf(PropTypes.string).isRequired,
  exams: PropTypes.arrayOf(PropTypes.string).isRequired,
  modal: PropTypes.shape({
    isOpen: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    isConfirm: PropTypes.bool,
    onConfirm: PropTypes.func
  }).isRequired,
  setModal: PropTypes.func.isRequired
};
