'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Paperclip } from 'lucide-react';
import styles from './AIChatbot.module.css';
import { useChatAction } from '@/contexts/ChatActionContext';
import { useAIContext } from '@/contexts/AIContext';
import { useFirestore } from '@/hooks/useFirestore';

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Saya SuperBrain AI Global. Anda bisa melampirkan file atau menyuruh saya untuk mencatat jadwal, tugas, dan CKP.' }
  ]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const { dispatchAction } = useChatAction();
  const { pageData } = useAIContext();
  
  // Global context for AI
  const { docs: tasks = [] } = useFirestore('tasks');
  const { docs: schedule = [] } = useFirestore('schedule');
  const { docs: ckp = [] } = useFirestore('ckp');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Maaf, hanya mendukung JPG, PNG, atau PDF untuk saat ini.');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }

    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedFile) return;

    // Prepare payload
    let inlineData = null;
    let fileMetaMsg = '';

    if (selectedFile) {
      fileMetaMsg = `\n[Melampirkan file: ${selectedFile.name}]`;
      const base64Str = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // split "data:image/png;base64,....."
          const b64 = reader.result.split(',')[1];
          resolve(b64);
        };
        reader.readAsDataURL(selectedFile);
      });
      inlineData = {
        data: base64Str,
        mimeType: selectedFile.type
      };
    }

    const userContent = input.trim() + fileMetaMsg;
    const userMessage = { 
      role: 'user', 
      content: userContent,
      inlineData: inlineData // Pass locally, but we need to structure it for API
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    removeFile();
    setIsLoading(true);

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          currentPath: window.location.pathname,
          pageData: pageData,
          globalStats: {
            totalTasks: tasks.length,
            uncompletedTasks: tasks.filter(t => t.status !== 'done').length,
            totalSchedules: schedule.length,
            uncompletedSchedules: schedule.filter(s => !s.isSelesai).length,
            totalCkp: ckp.length,
            ckpToday: ckp.filter(c => c.tanggal === new Date().toISOString().split('T')[0]).length,
          }
        }),
      });

      if (!res.ok) {
        let errMsg = 'Gagal menghubungi AI';
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (data.type === 'function_call') {
        const { functionName, arguments: args } = data;
        
        // Dispatch to global event bus
        if (functionName === 'create_task') {
          dispatchAction('CREATE_TASK', args);
        } else if (functionName === 'update_task') {
          dispatchAction('UPDATE_TASK', args);
        } else if (functionName === 'delete_task') {
          dispatchAction('DELETE_TASK', args);
        } else if (functionName === 'create_schedule') {
          dispatchAction('CREATE_SCHEDULE', args);
        } else if (functionName === 'update_schedule') {
          dispatchAction('UPDATE_SCHEDULE', args);
        } else if (functionName === 'delete_schedule') {
          dispatchAction('DELETE_SCHEDULE', args);
        } else if (functionName === 'create_ckp') {
          dispatchAction('CREATE_CKP', args);
        } else if (functionName === 'update_ckp') {
          dispatchAction('UPDATE_CKP', args);
        } else if (functionName === 'delete_ckp') {
          dispatchAction('DELETE_CKP', args);
        }
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || `Instruksi ${functionName} berhasil dieksekusi!`,
          isSystemAction: true 
        }]);
      } else {
        // Normal text response
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: error.message || 'Maaf, terjadi kesalahan saat menghubungi AI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        className={styles.toggleBtn} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Chat"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

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

          <div className={styles.inputAreaWrapper} style={{ background: 'var(--surface)', borderTop: '1px solid var(--surface-border)', padding: '12px' }}>
            {selectedFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '12px' }}>
                <Paperclip size={12} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</span>
                <button onClick={removeFile} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><X size={14}/></button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className={styles.attachButton} 
                onClick={() => fileInputRef.current?.click()}
                title="Lampirkan File"
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }}
              >
                <Paperclip size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
              />
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
                disabled={(!input.trim() && !selectedFile) || isLoading}
              >
                <Send size={18} style={{ marginLeft: '2px' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
