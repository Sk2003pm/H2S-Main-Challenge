import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Heart, Sparkles } from 'lucide-react';
import { storage } from '../utils/storage';

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
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(storage.getChatMessages());
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend) => {
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
          student_context: {
            exam: examProfile?.exam || 'Competitive Exam',
            current_stress: currentStress,
            recent_triggers: recentTriggers
          }
        })
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const result = await response.json();

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
        content: 'Hey. I am having a little trouble connecting right now, but please take a deep breath. Focus on inhaling for 4 seconds, holding for 4, and exhaling for 4. What is bothering you?',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
    <div className="glass-panel chat-container">
      <div className="chat-header">
        <div className="chat-avatar">
          <Heart size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Aura <Sparkles size={14} className="text-teal" />
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Empathetic Exam Wellness Companion
          </span>
        </div>
        <button 
          onClick={handleClearChat} 
          className="btn btn-secondary" 
          style={{ padding: '0.5rem', borderRadius: '50%' }}
          title="Reset Chat"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="chat-messages">
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
        />
        <button 
          onClick={() => handleSendMessage()} 
          className="btn btn-teal" 
          style={{ padding: '0.75rem' }}
          disabled={isLoading || !inputText.trim()}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
