import React, { useState, useEffect } from 'react';
import { PenTool, BrainCircuit, Activity, Heart, Quote, Calendar } from 'lucide-react';
import { storage } from '../utils/storage';
import confetti from 'canvas-confetti';

export default function JournalAnalyzer({ examProfile, onAnalysisComplete, onCopingChecked }) {
  const [entryText, setEntryText] = useState('');
  const [stressLevel, setStressLevel] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [pastLogs, setPastLogs] = useState([]);
  const [completedCopings, setCompletedCopings] = useState({});

  useEffect(() => {
    setPastLogs(storage.getJournalLogs());
    try {
      const completed = localStorage.getItem('mindalign_coping_completed');
      if (completed) {
        setCompletedCopings(JSON.parse(completed));
      }
    } catch (e) {}
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (entryText.trim().length < 10) return;

    setIsLoading(true);
    setCurrentAnalysis(null);

    try {
      const response = await fetch('/api/analyze-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: entryText,
          exam: examProfile?.exam || 'Competitive Exam',
          current_stress: Number(stressLevel)
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      const newLog = {
        id: Date.now(),
        date: new Date().toISOString(),
        text: entryText,
        stress_input: Number(stressLevel),
        analysis: result
      };

      const updatedLogs = storage.addJournalLog(newLog);
      setPastLogs(updatedLogs);
      setCurrentAnalysis(result);
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#8b5cf6', '#14b8a6', '#22c55e']
      });

      setEntryText('');

    } catch (error) {
      console.error('Error analyzing journal:', error);
      // Fail back gracefully silently
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCoping = (strategyTitle) => {
    const next = { ...completedCopings, [strategyTitle]: !completedCopings[strategyTitle] };
    setCompletedCopings(next);
    localStorage.setItem('mindalign_coping_completed', JSON.stringify(next));

    if (next[strategyTitle]) {
      // Award XP!
      if (onCopingChecked) {
        onCopingChecked();
      }
      confetti({
        particleCount: 30,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
    }
  };

  const selectPastLog = (log) => {
    setCurrentAnalysis(log.analysis);
  };

  const getMoodBadgeClass = (score) => {
    if (score >= 70) return 'badge-success';
    if (score >= 45) return 'badge-warning';
    return 'badge-danger';
  };

  const getMoodLabel = (score) => {
    if (score >= 75) return 'Calm & Focused';
    if (score >= 60) return 'Balanced';
    if (score >= 40) return 'Stressed';
    return 'Severe Burnout Alert';
  };

  return (
    <div className="dashboard-grid">
      <div className="db-col-8 journal-editor-container">
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <PenTool className="text-violet" size={22} />
            <h3 style={{ margin: 0 }}>Expressive Journaling</h3>
          </div>
          
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Write freely about your day, mock test scores, time struggles, syllabus stress, or exam fears. 
            Our empathetic AI analyzes your writing to detect hidden triggers standard logs miss.
          </p>

          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="journal-textarea">How are your thoughts today? (Minimum 10 characters)</label>
              <textarea
                id="journal-textarea"
                className="input-field journal-textarea"
                placeholder="Today was tough. I spent 4 hours on mathematics but still got stuck on mock test questions. I feel like I'm falling behind, and my peers are revising faster. Sleeping is getting harder..."
                value={entryText}
                onChange={(e) => setEntryText(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div className="flex-between">
                <label htmlFor="journal-stress">Self-Reported Tension/Stress Level: <strong>{stressLevel}%</strong></label>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {stressLevel > 75 ? '🔥 High Stress' : stressLevel > 40 ? '⚡ Tension' : '🍃 Calm'}
                </span>
              </div>
              <input
                id="journal-stress"
                type="range"
                min="1"
                max="100"
                className="slider"
                value={stressLevel}
                onChange={(e) => setStressLevel(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || entryText.trim().length < 10}
              style={{ alignSelf: 'flex-start' }}
            >
              {isLoading ? (
                <>
                  <div className="spinner"></div> Analyzing Sentiments...
                </>
              ) : (
                <>
                  <BrainCircuit size={18} /> Analyze with GenAI
                </>
              )}
            </button>
          </form>
        </div>

        {currentAnalysis && (
          <div className="glass-panel analysis-results-grid" style={{ animation: 'slide-up 0.4s ease' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span className={`badge ${getMoodBadgeClass(currentAnalysis.mood_score)}`}>
                  Mood Score: {currentAnalysis.mood_score}/100
                </span>
                <h3 className="text-gradient" style={{ marginTop: '0.5rem', fontSize: '1.5rem' }}>
                  {getMoodLabel(currentAnalysis.mood_score)}
                </h3>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {currentAnalysis.primary_emotions.map((emotion, idx) => (
                  <span key={idx} className="badge badge-violet">
                    {emotion}
                  </span>
                ))}
              </div>

              <div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Heart size={16} className="text-teal" /> AI Empathetic Analysis
                </h4>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {currentAnalysis.analysis_summary}
                </p>
              </div>

              {currentAnalysis.milestone_encouragement && (
                <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px dashed var(--accent-violet)', borderRadius: 'var(--border-radius-md)', padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <Quote size={20} className="text-violet" style={{ flexShrink: 0 }} />
                  <p style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {currentAnalysis.milestone_encouragement}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Detected Triggers</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {currentAnalysis.triggers.map((trigger, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-teal)' }}></span>
                      {trigger}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Recommended Steps</h4>
                <div className="coping-checklist">
                  {currentAnalysis.coping_strategies.map((strategy, idx) => (
                    <label 
                      key={idx}
                      htmlFor={`coping-check-${idx}`}
                      className={`coping-item ${completedCopings[strategy.title] ? 'completed' : ''}`}
                      style={{ cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center' }}
                    >
                      <input 
                        id={`coping-check-${idx}`}
                        type="checkbox" 
                        checked={!!completedCopings[strategy.title]} 
                        onChange={() => toggleCoping(strategy.title)} 
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{strategy.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {strategy.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="db-col-4">
        <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-teal" />
            Journal History
          </h4>
          
          {pastLogs.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', margin: 'auto 0' }}>
              Your past logs will appear here. Start by writing your first journal entry.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pastLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="glass-panel clickable" 
                  style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderRadius: 'var(--border-radius-sm)' }}
                  onClick={() => selectPastLog(log)}
                >
                  <div className="flex-between">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`badge ${getMoodBadgeClass(log.analysis.mood_score)}`} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>
                      Mood: {log.analysis.mood_score}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                    {log.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
