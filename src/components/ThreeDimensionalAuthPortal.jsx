import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Heart, 
  Lock, 
  UserCheck, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  KeyRound, 
  Brain
} from 'lucide-react';
import BrainHologram3D from './BrainHologram3D';

/**
 * ThreeDimensionalAuthPortal
 * 
 * Clean, vibrant authentication experience with a floating 3D Brain Hologram
 * on the left side (borderless, seamless) and modern colorful login card on the right.
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

  const onFormSubmit = async (e, handler) => {
    setIsSubmitting(true);
    try {
      await handler(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-portal-wrapper" style={{
      maxWidth: '1180px',
      margin: '1.5rem auto',
      padding: '1.5rem',
      position: 'relative',
      zIndex: 10,
      width: '100%'
    }}>
      {/* Main Dual-Column Layout: Seamless Brain Hologram on Left, Card on Right */}
      <div 
        className="auth-portal-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr',
          gap: '2.5rem',
          alignItems: 'center'
        }}
      >
        {/* Left Side: Seamless Floating 3D Brain Hologram (No Box, No Borders) */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            position: 'relative',
            padding: '1rem 0'
          }}
        >
          {/* Brand Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.2) 0%, rgba(247, 37, 133, 0.2) 100%)',
              border: '1px solid rgba(0, 245, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 245, 212, 0.3)'
            }}>
              <Brain size={26} style={{ color: '#00f5d4' }} />
            </div>
            <h1 style={{ 
              fontSize: '3.2rem', 
              fontWeight: 900, 
              letterSpacing: '-0.03em', 
              margin: 0,
              background: 'linear-gradient(135deg, #00f5d4 0%, #a78bfa 40%, #f72585 80%, #ffb703 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1
            }}>
              MindAlign
            </h1>
          </div>

          <p style={{ 
            fontSize: '1.05rem', 
            fontWeight: 500, 
            color: '#f1f5f9', 
            margin: '0.25rem 0 0.5rem 0',
            lineHeight: '1.5'
          }}>
            Empathetic AI Companion for Competitive Exam Aspirants
          </p>

          <p style={{ 
            fontSize: '0.85rem', 
            color: '#94a3b8', 
            margin: '0 0 1rem 0',
            lineHeight: '1.4'
          }}>
            Designed specifically for NEET, JEE, UPSC, GATE, CAT & Board Exam students to track wellness and conquer burnout.
          </p>

          {/* Floating 3D Brain Hologram Viewport — NOT IN A BOX */}
          <div style={{ 
            width: '100%', 
            height: '400px', 
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BrainHologram3D 
              activeFocus={activeFocusField || authMode} 
              isSubmitting={isSubmitting} 
            />
          </div>

          {/* Minimalist interactive hint */}
          <div style={{
            fontSize: '0.78rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.25rem'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00f5d4', display: 'inline-block', boxShadow: '0 0 6px #00f5d4' }} />
            <span>Interactive 3D Hologram • Drag cursor to rotate</span>
          </div>
        </div>

        {/* Right Side: Modern Vibrant Authentication Card */}
        <div 
          className="glass-panel"
          style={{
            borderRadius: 'var(--border-radius-lg)',
            padding: '2.2rem',
            background: 'linear-gradient(135deg, rgba(19, 26, 48, 0.88) 0%, rgba(15, 23, 42, 0.96) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.4rem',
            position: 'relative'
          }}
        >
          {/* Subtle Ambient Glow */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(247, 37, 133, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
            borderRadius: 'var(--border-radius-lg)'
          }} />

          {/* Mode Switcher Tabs */}
          <div 
            style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '4px', 
              borderRadius: 'var(--border-radius-md)', 
              border: '1px solid rgba(255, 255, 255, 0.1)' 
            }}
          >
            <button 
              type="button" 
              className={`btn btn-secondary ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
              style={{ 
                flex: 1, 
                padding: '0.75rem', 
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                background: authMode === 'login' 
                  ? 'linear-gradient(135deg, rgba(0, 245, 212, 0.25) 0%, rgba(67, 97, 238, 0.25) 100%)' 
                  : 'transparent',
                color: authMode === 'login' ? '#ffffff' : '#94a3b8',
                border: authMode === 'login' ? '1px solid #00f5d4' : '1px solid transparent',
                boxShadow: authMode === 'login' ? '0 0 15px rgba(0, 245, 212, 0.25)' : 'none',
                transition: 'all 0.25s ease',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
            <button 
              type="button" 
              className={`btn btn-secondary ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => setAuthMode('signup')}
              style={{ 
                flex: 1, 
                padding: '0.75rem', 
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                background: authMode === 'signup' 
                  ? 'linear-gradient(135deg, rgba(247, 37, 133, 0.25) 0%, rgba(114, 9, 183, 0.25) 100%)' 
                  : 'transparent',
                color: authMode === 'signup' ? '#ffffff' : '#94a3b8',
                border: authMode === 'signup' ? '1px solid #f72585' : '1px solid transparent',
                boxShadow: authMode === 'signup' ? '0 0 15px rgba(247, 37, 133, 0.25)' : 'none',
                transition: 'all 0.25s ease',
                cursor: 'pointer'
              }}
            >
              Register Account
            </button>
          </div>

          {authMode === 'login' ? (
            /* Login Form */
            <form onSubmit={(e) => onFormSubmit(e, handleLoginSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Lock size={20} style={{ color: '#00f5d4' }} />
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>Sign In</h3>
              </div>

              <div className="form-group">
                <label htmlFor="login-username" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="login-username"
                    type="text" 
                    className="input-field" 
                    placeholder="Enter your username (e.g. skand)" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onFocus={() => setActiveFocusField('username')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{ 
                      paddingRight: '2.5rem',
                      borderColor: activeFocusField === 'username' ? '#00f5d4' : undefined,
                      boxShadow: activeFocusField === 'username' ? '0 0 12px rgba(0, 245, 212, 0.25)' : undefined
                    }}
                  />
                  <UserCheck size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: '#00f5d4' }} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="login-password" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="login-password"
                    type="password" 
                    className="input-field" 
                    placeholder="••••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onFocus={() => setActiveFocusField('password')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                    style={{ 
                      paddingRight: '2.5rem',
                      borderColor: activeFocusField === 'password' ? '#f72585' : undefined,
                      boxShadow: activeFocusField === 'password' ? '0 0 12px rgba(247, 37, 133, 0.25)' : undefined
                    }}
                  />
                  <KeyRound size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: '#f72585' }} />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-teal" 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #00f5d4 0%, #06d6a0 100%)',
                  color: '#0a0f1d',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 25px rgba(0, 245, 212, 0.4)',
                  marginTop: '0.4rem',
                  cursor: 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px', borderColor: '#0a0f1d', borderTopColor: 'transparent' }} /> 
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Signup Form */
            <form onSubmit={(e) => onFormSubmit(e, handleSignupSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} style={{ color: '#f72585' }} />
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>Create Your Account</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="signup-username" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Username</label>
                  <input 
                    id="signup-username"
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. skand" 
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onFocus={() => setActiveFocusField('username')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-password" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Password</label>
                  <input 
                    id="signup-password"
                    type="password" 
                    className="input-field" 
                    placeholder="Min. 6 chars" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onFocus={() => setActiveFocusField('password')}
                    onBlur={() => setActiveFocusField(null)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-name" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Full Name / Nickname</label>
                <input 
                  id="signup-name"
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Skand Mishra" 
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  onFocus={() => setActiveFocusField('name')}
                  onBlur={() => setActiveFocusField(null)}
                  required 
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Select Wellness Avatar</label>
                <div className="avatar-grid" role="radiogroup" aria-label="Select Profile Avatar">
                  {avatars.map((av) => (
                    <button 
                      type="button" 
                      key={av} 
                      className={`avatar-option ${setupAvatar === av ? 'selected' : ''}`}
                      onClick={() => setSetupAvatar(av)}
                      aria-label={`Select avatar ${av}`}
                      aria-pressed={setupAvatar === av}
                      style={{ 
                        border: setupAvatar === av ? '2px solid #00f5d4' : '1px solid rgba(255,255,255,0.1)', 
                        background: setupAvatar === av ? 'rgba(0, 245, 212, 0.2)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', 
                        fontFamily: 'inherit',
                        boxShadow: setupAvatar === av ? '0 0 12px rgba(0,245,212,0.4)' : 'none'
                      }}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-exam" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Target Competitive Exam</label>
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
                <label htmlFor="signup-date" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>Target Exam Date</label>
                <input 
                  id="signup-date"
                  type="date" 
                  className="input-field" 
                  value={setupDate}
                  onChange={(e) => setSetupDate(e.target.value)}
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  marginTop: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #f72585 0%, #7209b7 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 25px rgba(247, 37, 133, 0.4)',
                  cursor: 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '18px', height: '18px' }} /> Creating Profile...
                  </>
                ) : (
                  <>
                    Register & Setup Profile <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Security & Offline Protocol */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            alignItems: 'center', 
            padding: '0.85rem', 
            borderRadius: 'var(--border-radius-sm)',
            background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.05) 0%, rgba(247, 37, 133, 0.05) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <ShieldCheck size={24} style={{ color: '#00f5d4', flexShrink: 0 }} />
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.4', margin: 0 }}>
              <strong>Zero-Knowledge Security:</strong> Offline-first student vault. Passwords cryptographic salted, journal entries privately safeguarded.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Overlay if an alert is active */}
      {modal.isOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={modal.title}>
          <div className="modal-card">
            <div className="modal-header">
              <Sparkles size={18} style={{ color: '#00f5d4' }} />
              <span>{modal.title}</span>
            </div>
            <div className="modal-body">{modal.message}</div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-teal" 
                onClick={() => setModal({ ...modal, isOpen: false })}
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
