'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Pause, RotateCcw, CheckSquare, Trash2, Plus, 
  ChevronRight, ChevronDown, Check, X, Sparkles, Clock, 
  ArrowRight, ArrowLeft, PlusCircle, Briefcase, Info, 
  Calendar, Edit3, ClipboardCheck, LayoutGrid,
  GraduationCap, Award, Search, MapPin, Target, Coffee, Zap
} from 'lucide-react';

import { skpData } from '@/data/skpData';
import { BPS_ROLES, ROLE_TEMPLATES, initialTasks } from '@/data/taskData';
import styles from './page.module.css';

function getRoleIcon(iconName, size = 14) {
  switch (iconName) {
    case 'Briefcase': return <Briefcase size={size} />;
    case 'GraduationCap': return <GraduationCap size={size} />;
    case 'Award': return <Award size={size} />;
    case 'Search': return <Search size={size} />;
    case 'MapPin': return <MapPin size={size} />;
    default: return <Briefcase size={size} />;
  }
}

export default function TasksPage() {
  const router = useRouter();

  // State utama daftar tugas
  const [tasks, setTasks] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter & Pencarian
  const [filterRole, setFilterRole] = useState('all');
  const [filterSkp, setFilterSkp] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState(null);

  // Form State
  const [formJudul, setFormJudul] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPeran, setFormPeran] = useState('admin');
  const [formSkpId, setFormSkpId] = useState(1);
  const [formChecklist, setFormChecklist] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Mode Fokus Tenang
  const [focusedTask, setFocusedTask] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 menit default
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerType, setTimerType] = useState('pomodoro'); // 'pomodoro' | 'break'

  // Accordion task card checklist
  const [expandedCards, setExpandedCards] = useState({});

  // Toast Notification
  const [toast, setToast] = useState(null);

  // Refs
  const timerIntervalRef = useRef(null);

  // Load tasks from LocalStorage
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('bps_superbrain_tasks');
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      } else {
        setTasks(initialTasks);
        localStorage.setItem('bps_superbrain_tasks', JSON.stringify(initialTasks));
      }
    } catch (e) {
      console.error('Failed to load tasks:', e);
      setTasks(initialTasks);
    }
    setIsLoaded(true);
  }, []);

  // Save tasks to LocalStorage helper
  const saveTasks = (newTasks) => {
    setTasks(newTasks);
    try {
      localStorage.setItem('bps_superbrain_tasks', JSON.stringify(newTasks));
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  };

  // Toast Helper
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Timer interval effect
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            if (timerType === 'pomodoro') {
              showToast('Sesi fokus selesai! Silakan istirahat sejenak.', 'success');
              setTimerSeconds(300); // 5 menit istirahat
              setTimerType('break');
            } else {
              showToast('Waktu istirahat selesai! Mari mulai fokus kembali.', 'success');
              setTimerSeconds(1500); // 25 menit fokus
              setTimerType('pomodoro');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, timerType]);

  // Clean up timer on exit focus
  const handleExitFocus = () => {
    setIsTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setFocusedTask(null);
    setTimerSeconds(1500);
    setTimerType('pomodoro');
  };

  // Toggle subtask checkbox
  const handleToggleSubtask = (taskId, index) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const newChecklist = [...t.checklist];
        newChecklist[index] = {
          ...newChecklist[index],
          completed: !newChecklist[index].completed,
        };
        return { ...t, checklist: newChecklist };
      }
      return t;
    });
    saveTasks(updated);

    // Update focused task state if currently in focus mode
    if (focusedTask && focusedTask.id === taskId) {
      const found = updated.find((t) => t.id === taskId);
      setFocusedTask(found);
    }
  };

  // Move task to next/prev column status
  const handleMoveStatus = (taskId, newStatus) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus };
      }
      return t;
    });
    saveTasks(updated);
    showToast(`Status tugas berhasil dipindahkan.`, 'success');
  };

  // Delete Task
  const handleDeleteTask = (taskId) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    saveTasks(updated);
    showToast('Tugas berhasil dihapus.', 'info');
  };

  // Open modal in Add mode
  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormJudul('');
    setFormDesc('');
    setFormPeran('admin');
    setFormSkpId(1);
    setFormChecklist([]);
    setNewChecklistItem('');
    setIsModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEditModal = (task) => {
    setModalMode('edit');
    setSelectedTaskForEdit(task);
    setFormJudul(task.judul);
    setFormDesc(task.deskripsi || '');
    setFormPeran(task.peran);
    setFormSkpId(task.skpId || 1);
    setFormChecklist(task.checklist || []);
    setNewChecklistItem('');
    setIsModalOpen(true);
  };

  // Import checklist template based on BPS Role
  const handleApplyRoleTemplate = () => {
    const template = ROLE_TEMPLATES[formPeran];
    if (template) {
      // Merge with existing items, avoiding duplicates
      const existingTexts = new Set(formChecklist.map((c) => c.text));
      const filteredTemplate = template.filter((item) => !existingTexts.has(item.text));
      setFormChecklist([...formChecklist, ...filteredTemplate]);
      showToast(`Template ${formPeran.replace('_', ' ')} berhasil diterapkan!`, 'success');
    }
  };

  // Add checklist item in form modal
  const handleAddFormChecklist = () => {
    if (!newChecklistItem.trim()) return;
    setFormChecklist([...formChecklist, { text: newChecklistItem.trim(), completed: false }]);
    setNewChecklistItem('');
  };

  // Remove checklist item in form modal
  const handleRemoveFormChecklist = (index) => {
    const updated = formChecklist.filter((_, i) => i !== index);
    setFormChecklist(updated);
  };

  // Save / Submit Form Modal
  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!formJudul.trim()) {
      showToast('Judul tugas wajib diisi!', 'error');
      return;
    }

    if (modalMode === 'add') {
      const newTask = {
        id: `task-${Date.now()}`,
        judul: formJudul.trim(),
        deskripsi: formDesc.trim(),
        status: 'todo',
        peran: formPeran,
        skpId: Number(formSkpId),
        tanggalDibuat: new Date().toISOString().split('T')[0],
        checklist: formChecklist,
      };
      saveTasks([newTask, ...tasks]);
      showToast('Tugas baru berhasil ditambahkan.', 'success');
    } else {
      const updated = tasks.map((t) => {
        if (t.id === selectedTaskForEdit.id) {
          return {
            ...t,
            judul: formJudul.trim(),
            deskripsi: formDesc.trim(),
            peran: formPeran,
            skpId: Number(formSkpId),
            checklist: formChecklist,
          };
        }
        return t;
      });
      saveTasks(updated);
      showToast('Perubahan tugas berhasil disimpan.', 'success');
    }

    setIsModalOpen(false);
  };

  // Convert task to CKP (prefetch format and redirect)
  const handleJadikanCKP = (task) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Compile checklist items that were completed
    const completedItems = task.checklist
      .filter((c) => c.completed)
      .map((c) => c.text)
      .join(', ');

    const ckpDescription = `${task.judul}${completedItems ? `: Menyelesaikan (${completedItems})` : ''}`;

    const prefill = {
      tanggal: today,
      waktuMulai: '08:00',
      waktuSelesai: '10:00',
      skpId: task.skpId,
      rincian: ckpDescription,
      fromScheduleEventId: `task-conversion-${task.id}`,
    };

    try {
      sessionStorage.setItem('ckp_prefill', JSON.stringify(prefill));
      showToast('Mengarahkan ke halaman pencatatan CKP...', 'success');
      
      // Let focus exit gracefully before routing
      if (focusedTask) {
        handleExitFocus();
      }

      setTimeout(() => {
        router.push('/ckp?fromSchedule=true');
      }, 800);
    } catch (e) {
      console.error('Failed to set CKP prefill:', e);
      showToast('Gagal memproses integrasi CKP', 'error');
    }
  };

  // Toggle card checklist accordion
  const toggleCardAccordion = (taskId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Start Focus Mode for specific task
  const handleStartFocus = (task) => {
    setFocusedTask(task);
    setTimerSeconds(1500);
    setTimerType('pomodoro');
    setIsTimerRunning(false);
  };

  // Helper formats
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filter tasks based on filters and search queries
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchRole = filterRole === 'all' || task.peran === filterRole;
      const matchSkp = filterSkp === 'all' || String(task.skpId) === filterSkp;
      
      const query = searchQuery.toLowerCase();
      const matchSearch = 
        task.judul.toLowerCase().includes(query) || 
        (task.deskripsi && task.deskripsi.toLowerCase().includes(query));

      return matchRole && matchSkp && matchSearch;
    });
  }, [tasks, filterRole, filterSkp, searchQuery]);

  // Group tasks by status for columns
  const todoTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'todo'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'in_progress'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'done'), [filteredTasks]);

  // Total stats for header
  const completedRatio = useMemo(() => {
    if (tasks.length === 0) return 0;
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    return Math.round((doneCount / tasks.length) * 100);
  }, [tasks]);

  return (
    <div className={styles.container}>
      {/* Toast */}
      {toast && (
        <div className={styles.toast}>
          <Info size={16} color="#6366f1" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <LayoutGrid size={28} color="#6366f1" /> Papan Kerja & Fokus
        </h1>
        <p className={styles.subtitle}>
          Kelola penugasan khusus organisasi BPS Anda. Uraikan menjadi checklist mikro untuk menghindari kejenuhan. 
          {tasks.length > 0 && ` Progres tugas keseluruhan: ${completedRatio}% selesai (${tasks.filter(t => t.status === 'done').length}/${tasks.length} tugas).`}
        </p>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input 
            type="text" 
            placeholder="Cari tugas..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Filter Peran BPS */}
          <select 
            className={styles.filterSelect}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Peran Kerja</option>
            {BPS_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Filter SKP */}
          <select 
            className={styles.filterSelect}
            value={filterSkp}
            onChange={(e) => setFilterSkp(e.target.value)}
          >
            <option value="all">Semua Target SKP</option>
            {skpData.map((s) => (
              <option key={s.id} value={s.id}>
                SKP #{s.id}: {s.nama}
              </option>
            ))}
          </select>
        </div>

        <button className={styles.addBtn} onClick={handleOpenAddModal}>
          <Plus size={18} /> Tambah Tugas Baru
        </button>
      </div>

      {/* Kanban Board */}
      <div className={styles.board}>
        {/* Column 1: TODO */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              Rencana (To-Do)
            </span>
            <span className={styles.columnCount}>{todoTasks.length}</span>
          </div>

          <div className={styles.taskList}>
            {todoTasks.map((task) => (
              <TaskCard 
                key={task.id}
                task={task}
                expanded={expandedCards[task.id]}
                onToggleExpand={() => toggleCardAccordion(task.id)}
                onToggleSubtask={(idx) => handleToggleSubtask(task.id, idx)}
                onMoveStatus={(status) => handleMoveStatus(task.id, status)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => handleOpenEditModal(task)}
                onStartFocus={() => handleStartFocus(task)}
                onJadikanCKP={() => handleJadikanCKP(task)}
              />
            ))}
            {todoTasks.length === 0 && <EmptyColumnState />}
          </div>
        </div>

        {/* Column 2: IN PROGRESS */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
              Fokus Kerja
            </span>
            <span className={styles.columnCount}>{inProgressTasks.length}</span>
          </div>

          <div className={styles.taskList}>
            {inProgressTasks.map((task) => (
              <TaskCard 
                key={task.id}
                task={task}
                expanded={expandedCards[task.id]}
                onToggleExpand={() => toggleCardAccordion(task.id)}
                onToggleSubtask={(idx) => handleToggleSubtask(task.id, idx)}
                onMoveStatus={(status) => handleMoveStatus(task.id, status)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => handleOpenEditModal(task)}
                onStartFocus={() => handleStartFocus(task)}
                onJadikanCKP={() => handleJadikanCKP(task)}
              />
            ))}
            {inProgressTasks.length === 0 && <EmptyColumnState />}
          </div>
        </div>

        {/* Column 3: DONE */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <span className={styles.columnTitle}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Selesai
            </span>
            <span className={styles.columnCount}>{doneTasks.length}</span>
          </div>

          <div className={styles.taskList}>
            {doneTasks.map((task) => (
              <TaskCard 
                key={task.id}
                task={task}
                expanded={expandedCards[task.id]}
                onToggleExpand={() => toggleCardAccordion(task.id)}
                onToggleSubtask={(idx) => handleToggleSubtask(task.id, idx)}
                onMoveStatus={(status) => handleMoveStatus(task.id, status)}
                onDelete={() => handleDeleteTask(task.id)}
                onEdit={() => handleOpenEditModal(task)}
                onStartFocus={() => handleStartFocus(task)}
                onJadikanCKP={() => handleJadikanCKP(task)}
              />
            ))}
            {doneTasks.length === 0 && <EmptyColumnState />}
          </div>
        </div>
      </div>

      {/* Mode Fokus Tenang (Overlay) */}
      {focusedTask && (
        <div className={styles.focusModeOverlay}>
          <div className={`${styles.focusGlowBG} ${isTimerRunning ? styles.focusGlowBGPulse : ''}`} />
          
          <div className={styles.focusCard}>
            <button className={styles.exitFocusBtn} onClick={handleExitFocus}>
              <X size={14} /> Keluar dari Fokus
            </button>

            {/* Focus Card Header */}
            <div className={styles.focusCardHeader}>
              {(() => {
                const roleObj = BPS_ROLES.find((r) => r.id === focusedTask.peran);
                return roleObj ? (
                  <span className={styles.focusRoleBadge} style={{ background: roleObj.color }}>
                    {getRoleIcon(roleObj.iconName, 14)} Peran: {roleObj.name}
                  </span>
                ) : null;
              })()}

              <h2 className={styles.focusTaskTitle}>{focusedTask.judul}</h2>
              {focusedTask.deskripsi && <p className={styles.focusTaskDesc}>{focusedTask.deskripsi}</p>}
            </div>

            {/* Focus Card Body Split */}
            <div className={styles.focusMainGrid}>
              
              {/* Left Column: Checklist */}
              <div className={styles.focusChecklistSection}>
                <h3 className={styles.focusChecklistTitle}>Langkah Kerja Mikro</h3>
                
                <div className={styles.focusChecklist}>
                  {focusedTask.checklist && focusedTask.checklist.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`${styles.focusCheckItem} ${item.completed ? styles.focusCheckItemChecked : ''}`}
                      onClick={() => handleToggleSubtask(focusedTask.id, idx)}
                    >
                      <input 
                        type="checkbox" 
                        className={styles.focusCheckbox}
                        checked={item.completed}
                        onChange={() => {}} // Handled by outer click
                      />
                      <span className={`${styles.focusCheckLabel} ${item.completed ? styles.focusCheckLabelCompleted : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                  {(!focusedTask.checklist || focusedTask.checklist.length === 0) && (
                    <p style={{ fontStyle: 'italic', color: '#64748b', fontSize: '13px' }}>
                      Tidak ada checklist subtugas untuk tugas ini.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Pomodoro Timer */}
              <div className={styles.focusTimerSection}>
                <span className={styles.timerLabel}>
                  {timerType === 'pomodoro' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Zap size={12} /> Sesi Fokus (25m)</span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Coffee size={12} /> Rehat Sejenak</span>
                  )}
                </span>
                
                <div className={`${styles.timerDisplay} ${isTimerRunning ? styles.timerTicking : ''}`}>
                  {formatTime(timerSeconds)}
                </div>

                <div className={styles.timerControls}>
                  <button 
                    className={`${styles.timerBtn} ${isTimerRunning ? styles.timerBtnActive : ''}`}
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    title={isTimerRunning ? 'Jeda Timer' : 'Mulai Timer'}
                  >
                    {isTimerRunning ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button 
                    className={styles.timerBtn}
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(timerType === 'pomodoro' ? 1500 : 300);
                    }}
                    title="Reset Timer"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Show direct conversion shortcut when all completed */}
                {(() => {
                  const hasChecklist = focusedTask.checklist && focusedTask.checklist.length > 0;
                  const allDone = hasChecklist && focusedTask.checklist.every((c) => c.completed);
                  
                  if (allDone || focusedTask.status === 'done') {
                    return (
                      <button 
                        className={styles.focusSuccessBtn}
                        onClick={() => {
                          // Update status to done if not already
                          if (focusedTask.status !== 'done') {
                            handleMoveStatus(focusedTask.id, 'done');
                          }
                          handleJadikanCKP(focusedTask);
                        }}
                      >
                        <ClipboardCheck size={18} /> Kirim Hasil ke CKP
                      </button>
                    );
                  }
                  return (
                    <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '8px', lineHeight: '1.4' }}>
                      Ceklis seluruh langkah mikro untuk langsung mencatat ke CKP Harian.
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modalMode === 'add' ? 'Tambah Tugas Baru' : 'Ubah Rincian Tugas'}
              </h3>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSubmitForm}>
              {/* Judul */}
              <div className={styles.formGroup}>
                <label>Judul Tugas</label>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="Contoh: Manajer Kelas Susenas Hari-1"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  required
                />
              </div>

              {/* Deskripsi */}
              <div className={styles.formGroup}>
                <label>Deskripsi (Opsional)</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="Keterangan rincian tugas..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              {/* Peran BPS & Template Button */}
              <div className={styles.formGroup}>
                <label>Peran Kerja Organisasi BPS</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    className={styles.select}
                    value={formPeran}
                    onChange={(e) => setFormPeran(e.target.value)}
                    style={{ flexGrow: 1 }}
                  >
                    {BPS_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    className={styles.templateBtn}
                    onClick={handleApplyRoleTemplate}
                    title="Gunakan checklist template bawaan untuk peran ini"
                  >
                    <Sparkles size={13} /> Pakai Template
                  </button>
                </div>
              </div>

              {/* Target SKP Mapped */}
              <div className={styles.formGroup}>
                <label>Butir Target SKP Terkait</label>
                <select 
                  className={styles.select}
                  value={formSkpId}
                  onChange={(e) => setFormSkpId(e.target.value)}
                >
                  {skpData.map((s) => (
                    <option key={s.id} value={s.id}>
                      SKP #{s.id}: {s.nama} ({s.kategori})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subtask Checklist Builder */}
              <div className={styles.formGroup}>
                <label>Langkah Kerja Mikro Checklist ({formChecklist.length})</label>
                
                <div className={styles.modalChecklistList}>
                  {formChecklist.map((item, idx) => (
                    <div key={idx} className={styles.modalCheckItem}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{idx + 1}.</span>
                      <input 
                        type="text" 
                        className={`${styles.input} ${styles.modalCheckInput}`}
                        value={item.text}
                        onChange={(e) => {
                          const updated = [...formChecklist];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setFormChecklist(updated);
                        }}
                      />
                      <button 
                        type="button"
                        className={styles.cardActionBtn}
                        style={{ color: '#ef4444' }}
                        onClick={() => handleRemoveFormChecklist(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className={styles.modalCheckItem} style={{ marginTop: '8px' }}>
                  <input 
                    type="text" 
                    className={`${styles.input} ${styles.modalCheckInput}`}
                    placeholder="Tambah checklist baru..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFormChecklist();
                      }
                    }}
                  />
                  <button 
                    type="button"
                    className={styles.addBtn}
                    style={{ padding: '8px 12px' }}
                    onClick={handleAddFormChecklist}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelModalBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.saveModalBtn}>
                  {modalMode === 'add' ? 'Tambah Tugas' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-Component: TaskCard
function TaskCard({ 
  task, expanded, onToggleExpand, onToggleSubtask, 
  onMoveStatus, onDelete, onEdit, onStartFocus, onJadikanCKP 
}) {
  const roleObj = BPS_ROLES.find((r) => r.id === task.peran);
  const skpObj = skpData.find((s) => s.id === task.skpId);

  // Calculate checklist progress
  const totalSubtasks = task.checklist ? task.checklist.length : 0;
  const completedSubtasks = task.checklist ? task.checklist.filter((c) => c.completed).length : 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div 
      className={styles.taskCard} 
      style={{ borderLeftColor: roleObj ? roleObj.color : '#6366f1' }}
    >
      <div className={styles.taskCardHeader}>
        <h4 className={styles.taskTitleText}>{task.judul}</h4>
      </div>

      {task.deskripsi && <p className={styles.taskDesc}>{task.deskripsi}</p>}

      {/* Metadata Tags */}
      <div className={styles.cardTags}>
        {roleObj && (
          <span className={styles.roleTag} style={{ background: `${roleObj.color}25`, border: `1px solid ${roleObj.color}45`, color: roleObj.color }}>
            {getRoleIcon(roleObj.iconName, 12)} {roleObj.name}
          </span>
        )}
        {skpObj && (
          <span className={styles.skpTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={skpObj.nama}>
            <Target size={11} /> SKP #{task.skpId}: {skpObj.nama}
          </span>
        )}
      </div>

      {/* Subtask Progress Bar */}
      {totalSubtasks > 0 && (
        <div className={styles.progressContainer}>
          <div className={styles.progressLabelRow}>
            <span>Progres checklist</span>
            <span>{completedSubtasks}/{totalSubtasks} ({progressPercent}%)</span>
          </div>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Accordion checklist expander */}
      {totalSubtasks > 0 && (
        <>
          <button className={styles.checklistToggle} onClick={onToggleExpand}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Langkah Mikro</span>
          </button>

          {expanded && (
            <div className={styles.subtasksList}>
              {task.checklist.map((item, idx) => (
                <label 
                  key={idx} 
                  className={styles.subtaskItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubtask(idx);
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={item.completed}
                    onChange={() => {}} // Handled by label click
                    style={{ marginRight: '6px' }}
                  />
                  <span className={item.completed ? styles.subtaskCompleted : ''}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      )}

      {/* Task Card Footer Actions */}
      <div className={styles.cardActions}>
        <div className={styles.cardActionGroup}>
          {/* Shift status columns */}
          {task.status !== 'todo' && (
            <button 
              className={styles.cardActionBtn} 
              onClick={() => onMoveStatus(task.status === 'done' ? 'in_progress' : 'todo')}
              title="Pindah ke kolom sebelumnya"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {task.status !== 'done' && (
            <button 
              className={styles.cardActionBtn} 
              onClick={() => onMoveStatus(task.status === 'todo' ? 'in_progress' : 'done')}
              title="Pindah ke kolom berikutnya"
            >
              <ArrowRight size={14} />
            </button>
          )}
          <button className={styles.cardActionBtn} onClick={onEdit} title="Ubah data tugas">
            <Edit3 size={14} />
          </button>
          <button className={`${styles.cardActionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Hapus tugas">
            <Trash2 size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {/* Focus button */}
          {task.status !== 'done' && (
            <button className={styles.focusBtn} onClick={onStartFocus} title="Mulai Mode Fokus Pomodoro">
              <Zap size={12} /> Fokus
            </button>
          )}

          {/* CKP integration button */}
          {task.status === 'done' && (
            <button className={styles.ckpBtn} onClick={onJadikanCKP} title="Kirim rincian tugas ke CKP Harian">
              <ClipboardCheck size={12} /> CKP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-Component: Empty Column
function EmptyColumnState() {
  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      border: '1.5px dashed rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      color: '#64748b',
      fontSize: '12px',
      textAlign: 'center',
      minHeight: '80px',
      fontStyle: 'italic'
    }}>
      Belum ada tugas di kolom ini.
    </div>
  );
}
