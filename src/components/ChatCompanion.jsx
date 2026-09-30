import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Send, Trash2, Heart, Sparkles, BookOpen, MessageCircle, X } from 'lucide-react';
import { storage } from '../utils/storage';
import { buildJournalContext, formatJournalDate } from '../utils/journalContext';

const QUICK_CHIPS = [
  "Feeling overwhelmed by syllabus load",
  "Just got a low score in mock test",
  "I cannot concentrate today",
  "Family expectations are stressing me out",
  "What if I fail on exam day?"
];

export default function ChatCompanion({ examProfile, onTriggerConfirm }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [journals, setJournals] = useState([]);
  const [focusedJournalId, setFocusedJournalId] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(storage.getChatMessages());
    setJournals(storage.getJournalLogs());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const focusedJournal = journals.find(log => log.id === focusedJournalId) || null;

  // focusIdOverride lets "Discuss with Aura" reference an entry before the focus state has updated
  const handleSendMessage = async (textToSend, focusIdOverride) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    if (!textToSend) {
      setInputText('');
    }

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    storage.saveChatMessages(newMessages);

    setIsLoading(true);

    try {
      const journalLogs = storage.getJournalLogs();
      const recentTriggers = journalLogs.length > 0 ? journalLogs[0].analysis.triggers : [];
      const currentStress = journalLogs.length > 0 ? journalLogs[0].stress_input : 50;

      const response = await fetch('/api/chat-companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          username: storage.getActiveUsername() || undefined,
          student_context: {
            exam: examProfile?.exam || 'Competitive Exam',
            current_stress: currentStress,
            recent_triggers: recentTriggers
          },
          // Journal entries Aura can reference (the one being discussed first)
          journal_context: buildJournalContext(journalLogs, focusIdOverride !== undefined ? focusIdOverride : focusedJournalId)
        })
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const result = await response.json();
      if (typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('Empty reply');
      }

      const assistantMessage = {
        role: 'model',
        content: result.reply,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      storage.saveChatMessages(updatedMessages);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'model',
        // Must stay crisis-safe: the server-side helpline guardrail can't run when the request fails
        content: 'Hey. I am having a little trouble connecting right now, but please take a deep breath. Focus on inhaling for 4 seconds, holding for 4, and exhaling for 4. If you feel unsafe or overwhelmed, please call Tele-MANAS at 14416 or KIRAN at 1800-599-0019, free and available 24x7. What is bothering you?',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a conversation about one journal entry; Aura keeps it in focus until the student clears it
  const handleDiscussJournal = (log) => {
    setFocusedJournalId(log.id);
    handleSendMessage(`Can we talk about my journal entry from ${formatJournalDate(log.date)}?`, log.id);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    const clearAction = () => {
      const defaultChat = [
        {
          role: 'model',
          content: 'Hi! I am Aura, your wellness companion. How is your exam preparation going today? Feel free to share your thoughts, fears, or goals, and we will work through them together.',
          timestamp: new Date().toISOString()
        }
      ];
      setMessages(defaultChat);
      storage.saveChatMessages(defaultChat);
      setFocusedJournalId(null);
    };

    if (onTriggerConfirm) {
      onTriggerConfirm(
        "Reset Chat History",
        "Are you sure you want to clear your chat messages with Aura? This will reset your conversation logs.",
        clearAction
      );
    } else {
      clearAction();
    }
  };

  return (
    <div className="chat-layout">
      <div className="glass-panel chat-container">
        <div className="chat-header">
          <div className="chat-avatar">
            <Heart size={20} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Aura <Sparkles size={14} className="text-rose" />
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Empathetic Exam Wellness Companion{journals.length > 0 ? ` · reading ${journals.length} journal ${journals.length === 1 ? 'entry' : 'entries'}` : ''}
            </span>
          </div>
          <button
            onClick={handleClearChat}
            className="btn btn-secondary"
            style={{ padding: '0.5rem', borderRadius: '50%' }}
            title="Reset Chat"
            aria-label="Reset chat history"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="chat-messages" aria-live="polite" aria-label="Conversation with Aura">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'user' : 'model'}`}>
              <div className="chat-bubble">
                {msg.content}
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)',
                    textAlign: 'right',
                    marginTop: '0.35rem'
                  }}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="chat-bubble-wrapper model">
              <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <span>Aura is typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {focusedJournal && (
          <div className="chat-reference-bar">
            <BookOpen size={14} />
            <span>Discussing your journal from <strong>{formatJournalDate(focusedJournal.date)}</strong></span>
            <button
              type="button"
              className="chat-reference-clear"
              onClick={() => setFocusedJournalId(null)}
              aria-label="Stop discussing this journal entry"
              title="Stop discussing this entry"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="chat-quick-chips">
          {QUICK_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              className="quick-chip"
              onClick={() => handleSendMessage(chip)}
              disabled={isLoading}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="chat-input-area">
          <input
            type="text"
            className="input-field"
            placeholder="Talk to Aura... (e.g. 'I am feeling burned out')"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            aria-label="Message input for Aura companion"
          />
          <button
            onClick={() => handleSendMessage()}
            className="btn btn-rose"
            style={{ padding: '0.75rem' }}
            disabled={isLoading || !inputText.trim()}
            aria-label="Send message to Aura"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Journal references: Aura reads these, and the student can pick one to discuss */}
      <aside className="glass-panel journal-reference-panel" aria-label="Your journal entries">
        <div className="journal-reference-header">
          <BookOpen size={18} className="text-violet" />
          <h4 style={{ margin: 0, flex: 1 }}>Your Journals</h4>
          <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>{journals.length}</span>
        </div>
        <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0, lineHeight: '1.4' }}>
          Aura reads your recent entries to personalise every reply. Pick one to talk it through.
        </p>

        <div className="journal-reference-list">
          {journals.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', margin: 'auto 0', lineHeight: '1.5' }}>
              No journal entries yet. Write one in the <strong>Journal</strong> tab and Aura will use it here.
            </p>
          ) : (
            journals.map((log) => {
              const isFocused = log.id === focusedJournalId;
              const triggers = Array.isArray(log.analysis?.triggers) ? log.analysis.triggers.slice(0, 3) : [];
              return (
                <article key={log.id} className={`journal-reference-card ${isFocused ? 'active' : ''}`}>
                  <div className="journal-reference-meta">
                    <span>{formatJournalDate(log.date)}</span>
                    {Number.isFinite(log.analysis?.mood_score) && (
                      <span className="journal-reference-mood">Mood {log.analysis.mood_score}</span>
                    )}
                  </div>
                  <p className="journal-reference-excerpt">{log.text}</p>
                  {triggers.length > 0 && (
                    <div className="journal-reference-triggers">
                      {triggers.map((trigger) => (
                        <span key={trigger} className="journal-reference-trigger">{trigger}</span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`btn ${isFocused ? 'btn-rose' : 'btn-secondary'} journal-reference-action`}
                    onClick={() => handleDiscussJournal(log)}
                    disabled={isLoading || isFocused}
                    aria-label={`Discuss your journal entry from ${formatJournalDate(log.date)} with Aura`}
                  >
                    <MessageCircle size={14} /> {isFocused ? 'In discussion' : 'Discuss with Aura'}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

ChatCompanion.propTypes = {
  /** The current logged-in student's exam profile object. */
  examProfile: PropTypes.shape({
    exam: PropTypes.string,
    name: PropTypes.string,
    username: PropTypes.string
  }),
  /** Callback to open a confirm dialog. */
  onTriggerConfirm: PropTypes.func
};
