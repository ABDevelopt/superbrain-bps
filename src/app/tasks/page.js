'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Pause, RotateCcw, CheckSquare, Trash2, Plus, 
  ChevronRight, ChevronDown, Check, X, Sparkles, Clock, 
  ArrowRight, ArrowLeft, PlusCircle, Briefcase, Info, 
  Calendar, Edit3, ClipboardCheck, LayoutGrid,
  GraduationCap, Award, Search, MapPin, Target, Coffee, Zap,
  Monitor, Map as MapIcon, Book, Users, Folder, Network, BarChart2, ClipboardList
} from 'lucide-react';

import { skpData } from '@/data/skpData';
import { BPS_ROLES, ROLE_TEMPLATES, initialTasks } from '@/data/taskData';
import styles from './page.module.css';
import { useChatAction } from '@/contexts/ChatActionContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';

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

  // Tab Utama: 0 = Papan Kanban, 1 = Pemetaan SKP
  const [activeTab, setActiveTab] = useState(0);

  // State utama daftar tugas
  const [tasks, setTasks] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter & Pencarian (Kanban)
  const [filterRole, setFilterRole] = useState('all');
  const [filterSkp, setFilterSkp] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Forms (Tugas)
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

  // Pemetaan Kerja (Tab 2) State
  const [mappingViewMode, setMappingViewMode] = useState('tree'); // 'tree' | 'grid'
  const [mappingGroupBy, setMappingGroupBy] = useState('cluster'); // 'cluster' | 'tim' | 'kategori'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedSkp, setSelectedSkp] = useState(null);

  // Refs
  const timerIntervalRef = useRef(null);

  // Load tasks from Firebase
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Migration: if Firestore is empty but we have local tasks, upload them
      if (fetchedTasks.length === 0) {
        const localTasks = localStorage.getItem('bps_superbrain_tasks');
        if (localTasks) {
          try {
            const parsed = JSON.parse(localTasks);
            if (parsed.length > 0) {
              const batch = writeBatch(db);
              parsed.forEach(task => {
                const taskRef = doc(collection(db, 'tasks'));
                const { id, ...dataToUpload } = task; // Exclude old local ID
                batch.set(taskRef, dataToUpload);
              });
              batch.commit().then(() => {
                localStorage.removeItem('bps_superbrain_tasks');
              }).catch(console.error);
              return; // Wait for the next snapshot
            }
          } catch(e) { console.error(e); }
        } else {
          // If totally empty everywhere, we can optionally populate initialTasks, but we'll leave it empty.
        }
      }
      
      setTasks(fetchedTasks);
      setIsLoaded(true);
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Handle URL parameter filters and session prefill
  useEffect(() => {
    if (!isLoaded) return;
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const skpParam = params.get('skpId');
      if (skpParam) {
        setFilterSkp(skpParam);
        setActiveTab(0);
      }
      
      const prefillSkpId = sessionStorage.getItem('prefill_task_skpId');
      if (prefillSkpId) {
        sessionStorage.removeItem('prefill_task_skpId');
        setFormSkpId(Number(prefillSkpId));
        setFormJudul('');
        setFormDesc('');
        setFormPeran('admin');
        setFormChecklist([]);
        setNewChecklistItem('');
        setModalMode('add');
        setIsModalOpen(true);
        setActiveTab(0);
      }
    }
  }, [isLoaded]);



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
  const handleToggleSubtask = async (taskId, index) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;
    
    const newChecklist = [...taskToUpdate.checklist];
    newChecklist[index] = {
      ...newChecklist[index],
      completed: !newChecklist[index].completed,
    };
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { checklist: newChecklist });
      // Update focused task state if currently in focus mode
      if (focusedTask && focusedTask.id === taskId) {
        setFocusedTask({ ...taskToUpdate, checklist: newChecklist });
      }
    } catch(e) { console.error(e); }
  };

  // Move task to next/prev column status
  const handleMoveStatus = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus });
      showToast(`Status tugas berhasil dipindahkan.`, 'success');
    } catch(e) { console.error(e); }
  };

  // Delete Task
  const handleDeleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      showToast('Tugas berhasil dihapus.', 'info');
    } catch(e) { console.error(e); }
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
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formJudul.trim()) {
      showToast('Judul tugas wajib diisi!', 'error');
      return;
    }

    try {
      if (modalMode === 'add') {
        const newTask = {
          judul: formJudul.trim(),
          deskripsi: formDesc.trim(),
          status: 'todo',
          peran: formPeran,
          skpId: Number(formSkpId),
          tanggalDibuat: new Date().toISOString().split('T')[0],
          checklist: formChecklist,
        };
        await addDoc(collection(db, 'tasks'), newTask);
        showToast('Tugas baru berhasil ditambahkan.', 'success');
      } else {
        await updateDoc(doc(db, 'tasks', selectedTaskForEdit.id), {
          judul: formJudul.trim(),
          deskripsi: formDesc.trim(),
          peran: formPeran,
          skpId: Number(formSkpId),
          checklist: formChecklist,
        });
        showToast('Tugas berhasil diperbarui.', 'success');
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      showToast('Gagal menyimpan tugas.', 'error');
    }
  };

  // Convert task to CKP (prefetch format and redirect)
  const handleJadikanCKP = (task) => {
    const today = new Date().toISOString().split('T')[0];
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

  // Handle AI Task Creation
  const handleAICreateTask = useCallback(async (taskData) => {
    const newTask = {
      judul: taskData.judul,
      deskripsi: taskData.deskripsi,
      peran: taskData.peran || 'admin',
      skpId: taskData.skpId || 1,
      status: 'todo',
      checklist: (taskData.checklist || []).map(item => ({
        id: Math.random().toString(36).substring(7),
        text: item,
        completed: false
      }))
    };
    
    try {
      await addDoc(collection(db, 'tasks'), newTask);
      setToast({ message: `Tugas "${taskData.judul}" berhasil ditambahkan oleh AI!` });
      setTimeout(() => setToast(null), 3000);
    } catch(e) { console.error(e); }
  }, []);

  useChatAction('CREATE_TASK', handleAICreateTask);
  // Helper formats
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Filter tasks based on filters and search queries (Kanban)
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

  // ============================================
  // TAB 2: PEMETAAN KERJA LOGIC
  // ============================================
  const skpTasksMap = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!map[task.skpId]) {
        map[task.skpId] = [];
      }
      map[task.skpId].push(task);
    });
    return map;
  }, [tasks]);

  const groupedData = useMemo(() => {
    const groupField = mappingGroupBy === 'kategori' ? 'kategori' : mappingGroupBy === 'tim' ? 'tim' : 'cluster';
    
    const groups = skpData.reduce((acc, item) => {
      const key = item[groupField] || 'Lainnya';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    // Auto expanded groups
    const initialExpanded = {};
    Object.keys(groups).forEach(key => {
      initialExpanded[key] = true;
    });
    setExpandedGroups(prev => {
      if (Object.keys(prev).length === 0) {
        return initialExpanded;
      }
      return prev;
    });

    return groups;
  }, [mappingGroupBy]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleOpenSkpDetail = (skp) => {
    setSelectedSkp(skp);
  };

  // Direct addition of task from SKP Modal
  const handleAddNewTaskFromSkp = (skpId) => {
    setFormSkpId(Number(skpId));
    setFormJudul('');
    setFormDesc('');
    setFormPeran('admin');
    setFormChecklist([]);
    setNewChecklistItem('');
    setModalMode('add');
    setSelectedSkp(null);
    setActiveTab(0); // switch to Kanban Papan Kerja
    setIsModalOpen(true); // open modal
  };

  const handleManageTasksFromSkp = (skpId) => {
    setFilterSkp(String(skpId));
    setSelectedSkp(null);
    setActiveTab(0); // switch to Kanban
  };

  // Helper BPS Group Icons
  const getGroupIcon = (groupName) => {
    switch (groupName) {
      case 'IT & Digital': return <Monitor size={16} />;
      case 'Geospasial': return <MapIcon size={16} />;
      case 'Survei & Sensus': return <BarChart2 size={16} />;
      case 'Publikasi & Data': return <Book size={16} />;
      case 'Pelayanan & Koordinasi': return <Users size={16} />;
      case 'Administrasi': return <ClipboardList size={16} />;
      case 'utama': return <Target size={16} color="#6366f1" />;
      case 'tambahan': return <Plus size={16} color="#f59e0b" />;
      case 'Subbagian Umum': return <Folder size={16} />;
      case 'Tim IPJKD & DLS': return <Network size={16} />;
      case 'Tim Statistik Sosial': return <Users size={16} />;
      case 'Tim Statistik Harga & Sensus Ekonomi': return <BarChart2 size={16} />;
      default: return <Folder size={16} />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'belum': return styles.status_belum;
      case 'progress': return styles.status_progress;
      case 'selesai': return styles.status_selesai;
      case 'terlambat': return styles.status_terlambat;
      default: return styles.status_belum;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'belum': return 'Belum Mulai';
      case 'progress': return 'On Progress';
      case 'selesai': return 'Selesai';
      case 'terlambat': return 'Terlambat';
      default: return 'Belum Mulai';
    }
  };

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
          <LayoutGrid size={28} color="#6366f1" /> Papan & Peta Kerja
        </h1>
        <p className={styles.subtitle}>
          Kelola penugasan khusus organisasi BPS Anda. Hubungkan tugas dengan SKP strategis dan urai menjadi checklist mikro.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className={styles.tabBar}>
        <button 
          className={`${styles.tab} ${activeTab === 0 ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(0)}
        >
          <LayoutGrid size={16} /> Papan Kanban
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 1 ? styles.tabActive : ''}`}
          onClick={() => setActiveTab(1)}
        >
          <Network size={16} /> Peta Pohon SKP
        </button>
      </div>





      {/* ============================================
          TAB 1: PAPAN KANBAN VIEW
          ============================================ */}
      {activeTab === 0 && (
        <>
          {tasks.length > 0 && (
            <div className={styles.progressCard}>
              <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className={styles.progressCircleWrapper}>
                <svg className={styles.progressCircle} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className={styles.progressCircleBg} />
                  <circle 
                    cx="50" cy="50" r="40" 
                    className={styles.progressCircleFill} 
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (251.2 * completedRatio / 100)} 
                  />
                </svg>
                <div className={styles.progressTextAbsolute}>{completedRatio}%</div>
              </div>
              <div className={styles.progressInfo}>
                <h3 className={styles.progressTitle}>Progres Keseluruhan</h3>
                <p className={styles.progressDesc}>
                  {tasks.filter(t => t.status === 'done').length} dari {tasks.length} tugas telah diselesaikan
                </p>
                <div className={styles.progressBarContainer}>
                  <div className={styles.progressBarFill} style={{ width: `${completedRatio}%` }}></div>
                </div>
                <div className={styles.progressStatsRow}>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#64748b' }}></div>
                    <span>Belum: {tasks.filter(t => t.status === 'todo').length}</span>
                  </div>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#f59e0b' }}></div>
                    <span>Progres: {tasks.filter(t => t.status === 'in_progress').length}</span>
                  </div>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#10b981' }}></div>
                    <span>Selesai: {tasks.filter(t => t.status === 'done').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* Kanban Board columns */}
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
        </>
      )}

      {/* ============================================
          TAB 2: PEMETAAN POHON SKP VIEW
          ============================================ */}
      {activeTab === 1 && (
        <>
          {/* Toolbar Peta */}
          <div className={styles.toolbar}>
            <div className={styles.toggleGroup}>
              <button 
                className={`${styles.toggleBtn} ${mappingViewMode === 'tree' ? styles.toggleBtnActive : ''}`}
                onClick={() => setMappingViewMode('tree')}
              >
                <Network size={16} /> Pohon Interaktif
              </button>
              <button 
                className={`${styles.toggleBtn} ${mappingViewMode === 'grid' ? styles.toggleBtnActive : ''}`}
                onClick={() => setMappingViewMode('grid')}
              >
                <LayoutGrid size={16} /> Tampilan Grid
              </button>
            </div>

            {mappingViewMode === 'tree' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>CABANG POHON:</span>
                <select 
                  className={styles.filterSelect}
                  value={mappingGroupBy}
                  onChange={(e) => setMappingGroupBy(e.target.value)}
                >
                  <option value="cluster">Kelompok Bidang (Klaster)</option>
                  <option value="tim">Tim Kerja BPS</option>
                  <option value="kategori">Kategori (Utama/Tambahan)</option>
                </select>
              </div>
            )}
          </div>

          {/* Visual Container */}
          <div className={styles.mapContainer}>
            {mappingViewMode === 'tree' ? (
              /* HORIZONTAL MIND-MAP TREE */
              <div className={styles.treeWrapper}>
                <div className={styles.treeBranch}>
                  {/* Root Node */}
                  <div className={`${styles.nodeCard} ${styles.rootNodeCard}`}>
                    <div className={styles.rootSubtitle}>SASARAN KINERJA</div>
                    <h2 className={styles.rootTitle}>SuperBrain BPS</h2>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#818cf8', fontWeight: '600', marginTop: '8px' }}>
                      <CheckSquare size={13} /> {tasks.length} Tugas Terhubung
                    </div>
                  </div>

                  {/* Branches */}
                  <div className={styles.branchChildren}>
                    {Object.entries(groupedData).map(([groupName, items]) => {
                      const isExpanded = !!expandedGroups[groupName];
                      const totalGroupTasks = items.reduce((acc, item) => {
                        return acc + (skpTasksMap[item.id] || []).length;
                      }, 0);

                      return (
                        <div key={groupName} className={styles.childContainer}>
                          {/* Intermediate Node Card */}
                          <div 
                            className={`${styles.nodeCard} ${styles.groupNodeCard} ${!isExpanded ? styles.collapsedBranchCard : ''}`}
                            onClick={() => toggleGroup(groupName)}
                          >
                            <div className={styles.groupHeader}>
                              {getGroupIcon(groupName)}
                              <span style={{ textTransform: mappingGroupBy === 'kategori' ? 'capitalize' : 'none' }}>
                                {groupName}
                              </span>
                            </div>
                            <div className={styles.groupMeta}>
                              <span>{items.length} SKP</span>
                              {totalGroupTasks > 0 && (
                                <span className={styles.taskCountBadge} style={{ fontSize: '9px', padding: '1px 5px' }}>
                                  {totalGroupTasks} Tugas
                                </span>
                              )}
                              <span className={styles.collapseIndicator}>
                                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              </span>
                            </div>
                          </div>

                          {/* Leaves Column */}
                          {isExpanded && (
                            <div className={styles.branchChildren} style={{ gap: '12px' }}>
                              {items.map((item) => {
                                const itemTasks = skpTasksMap[item.id] || [];
                                const activeTasks = itemTasks.filter(t => t.status !== 'done').length;
                                const doneTasks = itemTasks.filter(t => t.status === 'done').length;

                                return (
                                  <div 
                                    key={item.id} 
                                    className={`${styles.nodeCard} ${styles.skpNodeCard}`}
                                    onClick={() => handleOpenSkpDetail(item)}
                                  >
                                    <div className={styles.skpHeader}>
                                      <span className={styles.skpBadge} style={{ background: item.kategori === 'utama' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: item.kategori === 'utama' ? '#818cf8' : '#f59e0b' }}>
                                        {item.kategori}
                                      </span>
                                      {itemTasks.length > 0 && (
                                        <span className={`${styles.taskCountBadge} ${activeTasks === 0 ? styles.taskCountBadgeCompleted : ''}`}>
                                          {activeTasks > 0 ? `📋 ${activeTasks} Aktif` : `✓ ${doneTasks} Selesai`}
                                        </span>
                                      )}
                                    </div>
                                    <h3 className={styles.skpTitle} title={item.nama}>{item.nama}</h3>
                                    <div className={styles.skpMetaRow}>
                                      <span>SKP #{item.id}</span>
                                      <span style={{ opacity: 0.8 }} title={item.tim}>{item.tim.split(' ').slice(-2).join(' ')}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* GRID LAYOUT FALLBACK */
              <div className={styles.clusterGrid}>
                {Object.entries(groupedData).map(([groupName, items]) => (
                  <div key={groupName} className={styles.cluster}>
                    <div className={styles.clusterHeader}>
                      <span>{getGroupIcon(groupName)}</span>
                      <span style={{ textTransform: mappingGroupBy === 'kategori' ? 'capitalize' : 'none' }}>{groupName}</span>
                      <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '8px' }}>({items.length} kegiatan)</span>
                    </div>
                    
                    <div className={styles.nodes}>
                      {items.map(item => {
                        const itemTasks = skpTasksMap[item.id] || [];
                        return (
                          <div 
                            key={item.id} 
                            className={styles.gridNode}
                            onClick={() => handleOpenSkpDetail(item)}
                          >
                            <div className={styles.skpHeader}>
                              <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                                {getStatusLabel(item.status)}
                              </span>
                              {itemTasks.length > 0 && (
                                <span className={styles.taskCountBadge}>
                                  📋 {itemTasks.length} Tugas
                                </span>
                              )}
                            </div>
                            <h3 className={styles.skpTitle} style={{ fontSize: '13.5px', margin: 0 }}>{item.nama}</h3>
                            <div className={styles.skpMetaRow}>
                              <span>SKP #{item.id} | {item.kategori}</span>
                              <span>{item.tim}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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

              <div className={styles.formGroup}>
                <label>Deskripsi (Opsional)</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="Keterangan rincian tugas..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

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

      {/* SKP Detail Modal from Tree Map */}
      {selectedSkp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <span className={styles.skpBadge} style={{ background: selectedSkp.kategori === 'utama' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: selectedSkp.kategori === 'utama' ? '#818cf8' : '#f59e0b', alignSelf: 'flex-start' }}>
                  Sasaran {selectedSkp.kategori}
                </span>
                <h3 className={styles.modalTitle}>{selectedSkp.nama}</h3>
                <div className={styles.modalMetaRow}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Nomor SKP: #{selectedSkp.id}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Tim: {selectedSkp.tim}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Klaster: {selectedSkp.cluster}</span>
                </div>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedSkp(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Target & Realisasi Progress */}
            <div className={styles.modalContentSection}>
              <h4 className={styles.sectionTitle}>Indikator Sasaran Kinerja</h4>
              <div className={styles.indicatorCardList}>
                {selectedSkp.indikator && selectedSkp.indikator.map((ind, idx) => (
                  <div key={idx} className={styles.indicatorCard}>
                    <div className={styles.indicatorInfo}>
                      <span className={styles.indicatorLabel}>Target {ind.jenis}</span>
                      <span className={styles.indicatorVal}>Realisasi: {ind.realisasi}% / Target: {ind.target}%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${ind.realisasi}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Associated Tasks from Papan Tugas */}
            <div className={styles.modalContentSection}>
              <h4 className={styles.sectionTitle}>Daftar Tugas Terkait di Papan Tugas</h4>
              <div className={styles.modalTasksList}>
                {(() => {
                  const itemTasks = skpTasksMap[selectedSkp.id] || [];
                  if (itemTasks.length === 0) {
                    return (
                      <p className={styles.emptyStateText}>
                        Belum ada tugas di papan tugas yang dihubungkan ke SKP ini.
                      </p>
                    );
                  }

                  return itemTasks.map((t) => {
                    const totalSub = t.checklist ? t.checklist.length : 0;
                    const doneSub = t.checklist ? t.checklist.filter(c => c.completed).length : 0;
                    const roleObj = BPS_ROLES.find(r => r.id === t.peran);

                    return (
                      <div key={t.id} className={styles.modalTaskItem}>
                        <div>
                          <div className={styles.modalTaskTitle}>{t.judul}</div>
                          <div className={styles.modalTaskSub}>
                            {roleObj && `${getRoleIcon(roleObj.iconName, 12)} Peran: ${roleObj.name}`} 
                            {totalSub > 0 && ` • Checklist: ${doneSub}/${totalSub}`}
                          </div>
                        </div>
                        <span className={`${styles.modalTaskStatus} ${styles[`taskStatus_${t.status}`]}`}>
                          {t.status === 'in_progress' ? 'Focus' : t.status}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Action Buttons inside SKP Modal */}
            <div className={styles.modalActionsPanel}>
              <button 
                type="button" 
                className={styles.actionBtnSecondary}
                onClick={() => handleManageTasksFromSkp(selectedSkp.id)}
              >
                <CheckSquare size={14} /> Kelola di Papan Tugas
              </button>
              <button 
                type="button" 
                className={styles.actionBtnPrimary}
                onClick={() => handleAddNewTaskFromSkp(selectedSkp.id)}
              >
                <Plus size={14} /> + Tugas Baru untuk SKP Ini
              </button>
            </div>
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
                    checked={item.completed || false}
                    onChange={() => {}} 
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

      <div className={styles.cardActions}>
        <div className={styles.cardActionGroup}>
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
          {task.status !== 'done' && (
            <button className={styles.focusBtn} onClick={onStartFocus} title="Mulai Mode Fokus Pomodoro">
              <Zap size={12} /> Fokus
            </button>
          )}

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

export { EmptyColumnState };
