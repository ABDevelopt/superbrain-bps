'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import styles from './AIChatbot.module.css';

export default function AIChatbot({ onTaskCreate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Saya SuperBrain AI. Ada yang bisa saya bantu untuk merencanakan tugas atau pekerjaan Anda hari ini?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        throw new Error('Gagal menghubungi AI');
      }

      const data = await res.json();

      if (data.type === 'function_call' && data.functionName === 'create_task') {
        // Trigger the callback to create task in the parent page
        if (onTaskCreate) {
          onTaskCreate(data.arguments);
        }
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || 'Papan tugas berhasil dibuat!',
          isSystemAction: true 
        }]);
      } else {
        // Normal text response
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: 'Maaf, terjadi kesalahan saat menghubungi AI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button 
        className={styles.toggleBtn} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Chat"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className={styles.chatContainer}>
          <div className={styles.chatHeader}>
            <div className={styles.headerTitle}>
              <Sparkles size={18} />
              SuperBrain AI
            </div>
            <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className={styles.messagesArea}>
            {messages.map((msg, idx) => {
              if (msg.role === 'system') {
                return <div key={idx} className={styles.messageSystem}>{msg.content}</div>;
              }
              return (
                <div 
                  key={idx} 
                  className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                  style={msg.isSystemAction ? { border: '1px solid var(--primary)', backgroundColor: 'var(--primary-light)', color: 'var(--text-primary)' } : {}}
                >
                  {msg.content}
                </div>
              );
            })}
            {isLoading && (
              <div className={styles.loadingIndicator}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <input
              type="text"
              className={styles.inputField}
              placeholder="Ketik ide tugas..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
            />
            <button 
              className={styles.sendButton} 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
            >
              <Send size={18} style={{ marginLeft: '2px' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
