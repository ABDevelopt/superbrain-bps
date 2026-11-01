'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, Paperclip } from 'lucide-react';
import styles from './AIChatbot.module.css';
import { useChatAction } from '@/contexts/ChatActionContext';
import { useAIContext } from '@/contexts/AIContext';
import { useFirestore } from '@/hooks/useFirestore';
import { useSkps } from '@/hooks/useSkps';
import { useAuth } from '@/contexts/AuthContext';

export default function AIChatbot() {
  const { user } = useAuth();
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
  const { skpData } = useSkps();
  const { 
    docs: tasks = [], 
    addDocument: addTaskDoc, 
    updateDocument: updateTaskDoc, 
    deleteDocument: deleteTaskDoc 
  } = useFirestore('tasks');

  const { 
    docs: schedule = [], 
    addDocument: addScheduleDoc, 
    updateDocument: updateScheduleDoc, 
    deleteDocument: deleteScheduleDoc 
  } = useFirestore('schedule');

  const { 
    docs: ckp = [], 
    addDocument: addCkpDoc, 
    updateDocument: updateCkpDoc, 
    deleteDocument: deleteCkpDoc 
  } = useFirestore('ckp');

  const { 
    docs: trips = [], 
    addDocument: addTripDoc 
  } = useFirestore('perjalanan_dinas');

  // Fallback executor if no page-specific listener is active
  const executeGlobalFallback = async (functionName, args) => {
    try {
      if (functionName === 'create_task') {
        await addTaskDoc({
          userId: user?.uid || null,
          judul: args.judul || 'Tugas Baru',
          deskripsi: args.deskripsi || '',
          peran: args.peran || 'admin',
          skpId: args.skpId ? Number(args.skpId) : 1,
          status: 'todo',
          urgensi: args.urgensi || 'Sedang',
          createdAt: new Date().toISOString(),
          checklist: (args.checklist || []).map(item => ({
            id: Math.random().toString(36).substring(7),
            text: item,
            completed: false
          }))
        });
      } else if (functionName === 'update_task' && args.id) {
        const updates = {};
        if (args.judul) updates.judul = args.judul;
        if (args.deskripsi) updates.deskripsi = args.deskripsi;
        if (args.status) updates.status = args.status;
        if (args.urgensi) updates.urgensi = args.urgensi;
        await updateTaskDoc(args.id, updates);
      } else if (functionName === 'delete_task' && args.id) {
        await deleteTaskDoc(args.id);
      } else if (functionName === 'create_schedule') {
        await addScheduleDoc({
          userId: user?.uid || null,
          judul: args.judul || 'Agenda Baru',
          tanggal: args.tanggal || new Date().toISOString().split('T')[0],
          waktu: args.waktu || '09:00',
          kategori: args.kategori || 'Rapat',
          skpId: args.skpId ? Number(args.skpId) : 1,
          reminders: args.reminder && args.reminder !== 'Tidak ada' ? [args.reminder] : [],
          isSelesai: false
        });
      } else if (functionName === 'update_schedule' && args.id) {
        const updates = {};
        if (args.judul) updates.judul = args.judul;
        if (args.tanggal) updates.tanggal = args.tanggal;
        if (args.waktu) updates.waktu = args.waktu;
        if (args.kategori) updates.kategori = args.kategori;
        await updateScheduleDoc(args.id, updates);
      } else if (functionName === 'delete_schedule' && args.id) {
        await deleteScheduleDoc(args.id);
      } else if (functionName === 'create_ckp') {
        await addCkpDoc({
          userId: user?.uid || null,
          tanggal: args.tanggal || new Date().toISOString().split('T')[0],
          waktuMulai: args.waktuMulai || '08:00',
          waktuSelesai: args.waktuSelesai || '09:00',
          skpId: args.skpId ? Number(args.skpId) : 1,
          rincian: args.rincian || 'Aktivitas Tercatat',
          outputKuantitas: Number(args.outputKuantitas) || 1,
          satuan: args.satuan || 'Kegiatan',
          tim: args.tim || 'Subbagian Umum',
          buktiDukungStatus: 'none',
          buktiDukung: ''
        });
      } else if (functionName === 'update_ckp' && args.id) {
        const updates = {};
        if (args.rincian) updates.rincian = args.rincian;
        if (args.outputKuantitas) updates.outputKuantitas = Number(args.outputKuantitas);
        await updateCkpDoc(args.id, updates);
      } else if (functionName === 'delete_ckp' && args.id) {
        await deleteCkpDoc(args.id);
      } else if (functionName === 'create_dinas_lapangan') {
        const tMulai = args.tanggalMulai || new Date().toISOString().split('T')[0];
        const tSelesai = args.tanggalSelesai || tMulai;
        const autoST = args.nomorSuratTugas || `B-${Math.floor(1000 + Math.random()*9000)}/BPS/64090/DL/${new Date().getFullYear()}`;

        await addTripDoc({
          userId: user?.uid || null,
          nomorSuratTugas: autoST,
          tanggalSuratTugas: tMulai,
          pejabatPemberiTugas: 'Kepala BPS Kabupaten Penajam Paser Utara',
          maksudTujuan: args.maksudTujuan || 'Tugas Lapangan BPS',
          daerahTujuan: args.daerahTujuan || 'Penajam Paser Utara',
          tanggalMulai: tMulai,
          tanggalSelesai: tSelesai,
          lamaHari: Number(args.lamaHari) || 1,
          skpId: args.skpId ? Number(args.skpId) : null,
          kendaraan: args.kendaraan || 'Kendaraan Operasional / Dinas',
          status: 'rencana',
          pelaksana: [{ nama: user?.displayName || 'Yahya Abdurrohman, S.Tr.Stat.', peran: 'Utama' }]
        });

        // Mirror to Schedule Calendar
        try {
          await addScheduleDoc({
            userId: user?.uid || null,
            judul: `[DL] ${args.maksudTujuan || 'Perjalanan Dinas'}`,
            tanggal: tMulai,
            tanggalSelesai: tSelesai,
            waktu: '08:00',
            kategori: 'Survei',
            lokasi: args.daerahTujuan || '',
            skpId: args.skpId ? Number(args.skpId) : null,
            isSelesai: false
          });
        } catch (scErr) {
          console.warn('Auto mirror to schedule error:', scErr);
        }
      }
    } catch (fbErr) {
      console.error('Global fallback execution failed:', fbErr);
    }
  };

  // Reset chat messages when user changes or logs out
  useEffect(() => {
    setMessages([
      { role: 'assistant', content: 'Halo! Saya SuperBrain AI Global. Anda bisa melampirkan file atau menyuruh saya untuk mencatat jadwal, tugas, dan CKP.' }
    ]);
  }, [user?.uid]);

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
          skps: skpData,
          globalStats: {
            totalTasks: tasks.length,
            uncompletedTasks: tasks.filter(t => t.status !== 'done').length,
            totalSchedules: schedule.length,
            uncompletedSchedules: schedule.filter(s => !s.isSelesai).length,
            totalCkp: ckp.length,
            ckpToday: ckp.filter(c => c.tanggal === new Date().toISOString().split('T')[0]).length,
            totalTrips: trips.length
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
        
        // Dispatch to active page listener if mounted
        let actionHandled = false;
        if (functionName === 'create_task') actionHandled = dispatchAction('CREATE_TASK', args);
        else if (functionName === 'update_task') actionHandled = dispatchAction('UPDATE_TASK', args);
        else if (functionName === 'delete_task') actionHandled = dispatchAction('DELETE_TASK', args);
        else if (functionName === 'create_schedule') actionHandled = dispatchAction('CREATE_SCHEDULE', args);
        else if (functionName === 'update_schedule') actionHandled = dispatchAction('UPDATE_SCHEDULE', args);
        else if (functionName === 'delete_schedule') actionHandled = dispatchAction('DELETE_SCHEDULE', args);
        else if (functionName === 'create_ckp') actionHandled = dispatchAction('CREATE_CKP', args);
        else if (functionName === 'update_ckp') actionHandled = dispatchAction('UPDATE_CKP', args);
        else if (functionName === 'delete_ckp') actionHandled = dispatchAction('DELETE_CKP', args);
        else if (functionName === 'create_dinas_lapangan') actionHandled = dispatchAction('CREATE_DINAS_LAPANGAN', args);

        // If no page listener is currently active (e.g. user is on Dashboard or another page), execute directly via Firestore
        if (!actionHandled) {
          await executeGlobalFallback(functionName, args);
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

            {messages.length <= 1 && (
              <div style={{ margin: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>
                  💡 Contoh instruksi cepat:
                </span>
                {[
                  'Catat rapat koordinasi besok jam 09.00',
                  'Buat tugas Kanban: Rekonsiliasi Data Susenas',
                  'Catat CKP hari ini: Pengolahan 2 Dokumen',
                  'Jadwalkan Dinas Lapangan ke Sepaku lusa'
                ].map((promptText, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setInput(promptText)}
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      color: '#38bdf8',
                      fontSize: '11px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    💬 {promptText}
                  </button>
                ))}
              </div>
            )}
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
