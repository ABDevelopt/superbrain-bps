'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Play, Pause, RotateCcw, CheckSquare, Trash2, Plus, 
  ChevronRight, ChevronDown, Check, X, Sparkles, Clock, 
  ArrowRight, ArrowLeft, PlusCircle, Briefcase, Info, 
  Calendar, Edit3, ClipboardCheck, LayoutGrid, Bell,
  GraduationCap, Award, Search, MapPin, Target, Coffee, Zap,
  Monitor, Map as MapIcon, Book, Users, Folder, Network, BarChart2, ClipboardList,
  SlidersHorizontal, FolderOpen, Paperclip, Loader2
} from 'lucide-react';

import { useSkps } from '@/hooks/useSkps';
import { BPS_ROLES, ROLE_TEMPLATES, initialTasks } from '@/data/taskData';
import styles from './page.module.css';
import { useChatAction } from '@/contexts/ChatActionContext';
import { useAIContext } from '@/contexts/AIContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/drive';
import { savePendingUpload, getPendingUploads, removePendingUpload } from '@/lib/localdb';

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
  const { accessToken, loginWithGoogle } = useAuth();
  const router = useRouter();

  // Tab Utama: 0 = Papan Kanban, 1 = Pemetaan SKP
  const [activeTab, setActiveTab] = useState(0);

  const [isDeleting, setIsDeleting] = useState(false);
  const { setPageData } = useAIContext();
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter & Pencarian (Kanban)
  const [filterRole, setFilterRole] = useState('all');
  const [filterSkp, setFilterSkp] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // GDrive & Sync states
  const [openingFolder, setOpeningFolder] = useState(false);
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskLinkUrl, setTaskLinkUrl] = useState('');
  const [taskLinkLabel, setTaskLinkLabel] = useState('');
  const [showTaskShortener, setShowTaskShortener] = useState(false);
  const [taskShortenerSlug, setTaskShortenerSlug] = useState('');
  const [taskShortenerError, setTaskShortenerError] = useState('');
  const [taskShortenerLoading, setTaskShortenerLoading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchPendingUploads = useCallback(async () => {
    const list = await getPendingUploads();
    const tasksList = list.filter(item => item.type === 'tasks');
    setPendingUploads(tasksList || []);
  }, []);

  useEffect(() => {
    fetchPendingUploads();
  }, [fetchPendingUploads]);

  const handleAddLinkAttachment = () => {
    if (!taskLinkUrl) return;
    
    let formattedUrl = taskLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    const label = taskLinkLabel.trim() || 'Tautan Bukti';
    setFormAttachments(prev => [...prev, { name: label, url: formattedUrl }]);
    
    // Clear inputs
    setTaskLinkUrl('');
    setTaskLinkLabel('');
  };

  const handleShortenTaskLinkInline = async () => {
    if (!taskLinkUrl) return;
    
    if (taskLinkUrl.includes('/s/')) {
      alert('Tautan ini sudah merupakan tautan singkat.');
      return;
    }
    
    let formattedUrl = taskLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    setTaskShortenerLoading(true);
    setTaskShortenerError('');
    
    try {
      let finalSlug = taskShortenerSlug.trim().toLowerCase();
      
      if (finalSlug) {
        if (!/^[a-z0-9-_]+$/i.test(finalSlug)) {
          throw new Error('Slug hanya boleh berisi huruf, angka, tanda hubung (-) dan garis bawah (_).');
        }
        
        const q = query(collection(db, 'short_links'), where('slug', '==', finalSlug));
        const snap = await getDocs(q);
        if (!snap.empty) {
          throw new Error('Slug kustom ini sudah digunakan. Silakan gunakan slug lain.');
        }
      } else {
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 10) {
          const rand = Math.random().toString(36).substring(2, 8);
          const q = query(collection(db, 'short_links'), where('slug', '==', rand));
          const snap = await getDocs(q);
          if (snap.empty) {
            finalSlug = rand;
            unique = true;
          }
          attempts++;
        }
        if (!unique) {
          throw new Error('Gagal men-generate slug acak. Silakan coba lagi.');
        }
      }
      
      // Save short link
      await addDoc(collection(db, 'short_links'), {
        slug: finalSlug,
        longUrl: formattedUrl,
        clicks: 0,
        userId: user?.uid || 'anonymous',
        createdAt: serverTimestamp()
      });
      
      const baseShortUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/s/${finalSlug}`
        : `/s/${finalSlug}`;
        
      const label = taskLinkLabel.trim() || `Tautan Singkat (/s/${finalSlug})`;
      setFormAttachments(prev => [...prev, { name: label, url: baseShortUrl }]);
      
      // Clear states
      setTaskLinkUrl('');
      setTaskLinkLabel('');
      setTaskShortenerSlug('');
      setShowTaskShortener(false);
      
      showToast('Link berhasil diringkas dan ditambahkan ke lampiran.', 'success');
      
    } catch (err) {
      setTaskShortenerError(err.message || 'Gagal meringkas tautan.');
    } finally {
      setTaskShortenerLoading(false);
    }
  };

  const handleOpenDriveFolder = async () => {
    if (!accessToken) {
      alert('Silakan hubungkan Google Drive Anda terlebih dahulu.');
      return;
    }
    setOpeningFolder(true);
    try {
      const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
      const folderId = await getOrCreateFolder(accessToken, 'Lampiran Tugas', parentFolderId);
      if (folderId) {
        window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
      } else {
        throw new Error('Folder ID tidak ditemukan.');
      }
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('401')) {
        alert('Sesi Google Drive kedaluwarsa. Menghubungkan ulang...');
        try {
          await loginWithGoogle();
        } catch (loginErr) {
          console.error("Login failed:", loginErr);
        }
      } else {
        alert('Gagal mengakses Google Drive: ' + err.message);
      }
    } finally {
      setOpeningFolder(false);
    }
  };

  const handleSyncOfflineFiles = async () => {
    if (!accessToken) {
      try {
        await loginWithGoogle();
      } catch (err) {
        alert('Gagal menghubungkan ke Google Drive.');
        return;
      }
    }
    setIsSyncing(true);
    let successCount = 0;
    
    try {
      const list = await getPendingUploads();
      const tasksList = list.filter(item => item.type === 'tasks');
      if (tasksList.length === 0) return;
      
      const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
      const folderId = await getOrCreateFolder(accessToken, 'Lampiran Tugas', parentFolderId);
      const updatesByTaskId = {};

      for (const item of tasksList) {
        try {
          const driveUrl = await uploadFileToDrive(item.file, accessToken, folderId, item.customFileName);
          const [taskId] = item.id.split('_');
          
          if (!updatesByTaskId[taskId]) {
            updatesByTaskId[taskId] = [];
          }
          updatesByTaskId[taskId].push({ name: item.file.name, url: driveUrl });
          
          await removePendingUpload(item.id);
          successCount++;
        } catch (err) {
          console.error("Sync error for task item", item.id, err);
          if (err.message && err.message.includes('401')) {
            alert('Sesi Google Drive kedaluwarsa. Hubungkan ulang.');
            break;
          }
        }
      }

      // Update Firestore documents with the new attachments
      for (const taskId of Object.keys(updatesByTaskId)) {
        const existingTask = tasks.find(t => t.id === taskId);
        const currentAttachments = existingTask?.attachments || [];
        await updateTask(taskId, {
          attachments: [...currentAttachments, ...updatesByTaskId[taskId]]
        });
      }

      if (successCount > 0) {
        alert(`Berhasil menyinkronkan ${successCount} file lampiran tugas ke Google Drive.`);
        fetchPendingUploads();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menyinkronkan file lampiran: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

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
  const [formLinkedScheduleId, setFormLinkedScheduleId] = useState('');
  const [formAttachments, setFormAttachments] = useState([]);
  const [formDueDate, setFormDueDate] = useState('');
  const [formReminders, setFormReminders] = useState([]);

  const handleReminderToggle = (r) => {
    setFormReminders((prev) => {
      const isSelected = prev.includes(r);
      return isSelected ? prev.filter(x => x !== r) : [...prev, r];
    });
  };

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

  const { skpData } = useSkps();
  const { docs: tasks = [], loading: tasksLoading, addDocument: addTask, updateDocument: updateTask, deleteDocument: deleteTask } = useFirestore('tasks');
  const { docs: schedules = [], addDocument: addSchedule, updateDocument: updateSchedule } = useFirestore('schedule');

  // Pemetaan Kerja (Tab 2) State
  const [mappingViewMode, setMappingViewMode] = useState('tree'); // 'tree' | 'grid'
  const [mappingGroupBy, setMappingGroupBy] = useState('kategori');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedSkp, setSelectedSkp] = useState(null);

  useEffect(() => {
    setPageData(tasks);
  }, [tasks, setPageData]);

  // Handle auto-sync of telegram file attachments for tasks
  useEffect(() => {
    if (!tasks || tasks.length === 0 || !accessToken) return;

    const syncPendingFiles = async () => {
      const pendingTasks = tasks.filter(t => t.telegramFileId);
      
      for (const task of pendingTasks) {
        try {
          console.log('[Telegram Sync] Syncing attachment for Kanban task:', task.id);
          // 1. Download file content from Telegram via proxy
          const res = await fetch(`/api/telegram-file?id=${task.telegramFileId}`);
          if (!res.ok) throw new Error('Gagal mengunduh file Telegram via proxy.');
          
          const blob = await res.blob();
          const disp = res.headers.get('content-disposition');
          const filenameMatch = disp ? disp.match(/filename="([^"]+)"/) : null;
          const filename = filenameMatch ? filenameMatch[1] : `Lampiran_Tugas_${task.id.substring(0, 5)}.pdf`;
          
          const file = new File([blob], filename, { type: blob.type });

          // 2. Get folder ID ("SuperBrain BPS/Lampiran Tugas")
          const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
          const folderId = await getOrCreateFolder(accessToken, 'Lampiran Tugas', parentFolderId);

          // 3. Upload to Google Drive
          const driveUrl = await uploadFileToDrive(file, accessToken, folderId);

          // 4. Update Firestore
          const currentAttachments = task.attachments || [];
          const updatedAttachments = [...currentAttachments, { name: file.name, url: driveUrl }];

          await updateTask(task.id, {
            attachments: updatedAttachments,
            telegramFileId: null // Clear the temporary ID
          });
          
          console.log('[Telegram Sync] Successfully synced task attachment:', filename);
        } catch (err) {
          console.error('Failed to sync telegram file for task', task.id, err);
        }
      }
    };

    syncPendingFiles();
  }, [tasks, accessToken, updateTask]);

  useEffect(() => {
    const localTasks = localStorage.getItem('bps_superbrain_tasks');
    if (localTasks) {
      try {
        const parsed = JSON.parse(localTasks);
        if (parsed.length > 0) {
          const batch = writeBatch(db);
          parsed.forEach(task => {
            const taskRef = doc(collection(db, 'tasks'));
            const { id, ...dataToUpload } = task;
            batch.set(taskRef, dataToUpload);
          });
          batch.commit().then(() => {
            localStorage.removeItem('bps_superbrain_tasks');
          }).catch(console.error);
        }
      } catch(e) { console.error(e); }
    }
    setIsLoaded(true);
  }, []);

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

  const showToast = (message, type = 'success') => {
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

  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            if (timerType === 'pomodoro') {
              showToast('Sesi fokus selesai! Silakan istirahat sejenak.', 'success');
              setTimerSeconds(300);
              setTimerType('break');
            } else {
              showToast('Waktu istirahat selesai! Mari mulai fokus kembali.', 'success');
              setTimerSeconds(1500);
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

  const handleExitFocus = () => {
    setIsTimerRunning(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setFocusedTask(null);
    setTimerSeconds(1500);
    setTimerType('pomodoro');
  };

  const handleToggleSubtask = async (taskId, index) => {
    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (!taskToUpdate) return;
    
    const newChecklist = [...taskToUpdate.checklist];
    newChecklist[index] = {
      ...newChecklist[index],
      completed: !newChecklist[index].completed,
    };
    
    try {
      await updateTask(taskId, { checklist: newChecklist });
      if (focusedTask && focusedTask.id === taskId) {
        setFocusedTask({ ...taskToUpdate, checklist: newChecklist });
      }
    } catch(e) { console.error(e); }
  };

  const handleMoveStatus = async (taskId, newStatus) => {
    try {
      await updateTask(taskId, { status: newStatus });
      showToast(`Status tugas berhasil dipindahkan.`, 'success');
      
      const taskObj = tasks.find(t => t.id === taskId);
      if (taskObj && taskObj.linkedScheduleId && newStatus === 'done') {
        const scheduleId = taskObj.linkedScheduleId;
        const siblingTasks = tasks.filter(t => t.linkedScheduleId === scheduleId && t.id !== taskId);
        const allDone = siblingTasks.every(t => t.status === 'done');
        if (allDone) {
          await updateSchedule(scheduleId, { isSelesai: true });
          showToast('Semua tugas selesai, jadwal terkait otomatis diselesaikan!', 'success');
        }
      }
    } catch(e) { console.error(e); }
  };

  const handleDeleteTask = async (taskId) => {
    const confirm = window.confirm("Apakah Anda yakin ingin menghapus tugas ini?");
    if (confirm) {
      try {
        await deleteTask(taskId);
        showToast('Tugas berhasil dihapus.', 'success');
      } catch(e) { console.error(e); }
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setSelectedTaskForEdit(null);
    setFormJudul('');
    setFormDesc('');
    setFormPeran('admin');
    setFormSkpId(1);
    setFormChecklist([]);
    setNewChecklistItem('');
    setFormLinkedScheduleId('');
    setFormAttachments([]);
    setFormDueDate('');
    setFormReminders([]);
    setTaskFiles([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    setModalMode('edit');
    setSelectedTaskForEdit(task);
    setFormJudul(task.judul);
    setFormDesc(task.deskripsi || '');
    setFormPeran(task.peran);
    setFormSkpId(task.skpId || 1);
    setFormChecklist(task.checklist || []);
    setNewChecklistItem('');
    setFormLinkedScheduleId(task.linkedScheduleId || '');
    setFormAttachments(task.attachments || []);
    setFormDueDate(task.dueDate || '');
    setFormReminders(task.reminders || []);
    setTaskFiles([]);
    setIsModalOpen(true);
  };

  const handleApplyRoleTemplate = () => {
    const template = ROLE_TEMPLATES[formPeran];
    if (template) {
      const existingTexts = new Set(formChecklist.map((c) => c.text));
      const filteredTemplate = template.filter((item) => !existingTexts.has(item.text));
      setFormChecklist([...formChecklist, ...filteredTemplate]);
      showToast(`Template ${formPeran.replace('_', ' ')} berhasil diterapkan!`, 'success');
    }
  };

  const handleAddFormChecklist = () => {
    if (!newChecklistItem.trim()) return;
    setFormChecklist([...formChecklist, { text: newChecklistItem.trim(), completed: false }]);
    setNewChecklistItem('');
  };

  const handleRemoveFormChecklist = (index) => {
    const updated = formChecklist.filter((_, i) => i !== index);
    setFormChecklist(updated);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formJudul.trim()) {
      showToast('Judul tugas wajib diisi!', 'error');
      return;
    }

    try {
      let finalScheduleId = formLinkedScheduleId === 'NEW' ? null : (formLinkedScheduleId || null);

      let savedTaskId = null;
      if (modalMode === 'add') {
        const newTask = {
          judul: formJudul.trim(),
          deskripsi: formDesc.trim(),
          status: 'todo',
          peran: formPeran,
          skpId: Number(formSkpId),
          tanggalDibuat: new Date().toISOString().split('T')[0],
          checklist: formChecklist,
          linkedScheduleId: finalScheduleId,
          attachments: [],
          dueDate: formDueDate || null,
          reminders: formReminders,
          sentReminders: []
        };
        const ref = await addTask(newTask);
        savedTaskId = ref.id;
        showToast('Tugas baru berhasil ditambahkan.', 'success');
      } else {
        savedTaskId = selectedTaskForEdit.id;
        const didDueDateChange = (selectedTaskForEdit.dueDate || '') !== formDueDate;
        const finalSentReminders = didDueDateChange ? [] : (selectedTaskForEdit.sentReminders || []);

        await updateTask(savedTaskId, {
          judul: formJudul.trim(),
          deskripsi: formDesc.trim(),
          peran: formPeran,
          skpId: Number(formSkpId),
          checklist: formChecklist,
          linkedScheduleId: finalScheduleId,
          attachments: formAttachments,
          dueDate: formDueDate || null,
          reminders: formReminders,
          sentReminders: finalSentReminders
        });
        showToast('Tugas berhasil diperbarui.', 'success');
      }

      // Handle file uploads to Google Drive under "Lampiran Tugas"
      if (taskFiles.length > 0) {
        setIsUploadingFiles(true);
        const uploadedAttachments = [];
        const offlineFilesToSave = [];
        let needsOfflineSave = false;

        const cleanJudul = formJudul.substring(0, 30).replace(/[^a-zA-Z0-9 -]/g, '').trim();
        const startIdx = formAttachments.length;

        for (let i = 0; i < taskFiles.length; i++) {
          const file = taskFiles[i];
          const customFileName = `${new Date().toISOString().split('T')[0]} - ${cleanJudul} - ${file.name}`;
          const idx = startIdx + i;

          if (accessToken) {
            try {
              const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
              const folderId = await getOrCreateFolder(accessToken, 'Lampiran Tugas', parentFolderId);
              const driveUrl = await uploadFileToDrive(file, accessToken, folderId, customFileName);
              uploadedAttachments.push({ name: file.name, url: driveUrl });
            } catch (err) {
              console.error("Gagal unggah file tugas:", file.name, err);
              needsOfflineSave = true;
              offlineFilesToSave.push({ file, customFileName, idx });
            }
          } else {
            needsOfflineSave = true;
            offlineFilesToSave.push({ file, customFileName, idx });
          }
        }

        const finalAttachments = [...formAttachments, ...uploadedAttachments];
        await updateTask(savedTaskId, { attachments: finalAttachments });

        if (needsOfflineSave && offlineFilesToSave.length > 0) {
          for (const item of offlineFilesToSave) {
            await savePendingUpload(savedTaskId + '_' + item.idx, item.file, item.customFileName, 'tasks');
          }
          alert('Beberapa lampiran tugas disimpan secara lokal karena kendala koneksi/sesi Google Drive.');
          fetchPendingUploads();
        }
      }

      setIsModalOpen(false);

      if (formLinkedScheduleId === 'NEW') {
        const prefill = {
          judul: formJudul.trim(),
          deskripsi: formDesc.trim(),
          skpId: Number(formSkpId),
          linkedTaskIds: [savedTaskId]
        };
        sessionStorage.setItem('schedule_prefill_from_task', JSON.stringify(prefill));
        router.push('/schedule?fromTask=true');
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal menyimpan tugas.', 'error');
    } finally {
      setIsUploadingFiles(false);
      setTaskFiles([]);
    }
  };

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
      sumber: 'tugas',
      sourceTaskId: task.id,
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

  const toggleCardAccordion = (taskId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleStartFocus = (task) => {
    setFocusedTask(task);
    setTimerSeconds(1500);
    setTimerType('pomodoro');
    setIsTimerRunning(false);
  };

  const handleAICreateTask = useCallback(async (taskData) => {
    const newTask = {
      judul: taskData.judul,
      deskripsi: taskData.deskripsi,
      peran: taskData.peran || 'admin',
      skpId: taskData.skpId || 1,
      urgensi: taskData.urgensi || 'Sedang',
      status: 'todo',
      checklist: (taskData.checklist || []).map(item => ({
        id: Math.random().toString(36).substring(7),
        text: item,
        completed: false
      }))
    };
    
    try {
      await addTask(newTask);
      setToast({ message: `Tugas "${newTask.judul}" berhasil dibuat oleh AI!` });
      setTimeout(() => setToast(null), 3000);
    } catch(e) { console.error(e); }
  }, [addTask]);

  const handleAIUpdateTask = useCallback(async (taskData) => {
    if (!taskData.id) return;
    try {
      const taskRef = doc(db, 'tasks', taskData.id);
      const updates = {};
      if (taskData.judul) updates.judul = taskData.judul;
      if (taskData.deskripsi) updates.deskripsi = taskData.deskripsi;
      if (taskData.status) updates.status = taskData.status;
      if (taskData.urgensi) updates.urgensi = taskData.urgensi;
      
      await updateTask(taskData.id, updates);
      setToast({ message: `Tugas "${taskData.judul || taskData.id}" berhasil diperbarui oleh AI!` });
      setTimeout(() => setToast(null), 3000);
    } catch(e) { console.error(e); }
  }, []);

  const handleAIDeleteTask = useCallback(async (taskData) => {
    if (!taskData.id) return;
    try {
      await deleteTask(taskData.id);
      setToast({ message: `Tugas berhasil dihapus oleh AI!` });
      setTimeout(() => setToast(null), 3000);
    } catch(e) { console.error(e); }
  }, []);

  useChatAction('CREATE_TASK', handleAICreateTask);
  useChatAction('UPDATE_TASK', handleAIUpdateTask);
  useChatAction('DELETE_TASK', handleAIDeleteTask);
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
    if (!groupName) return <Folder size={16} />;
    const name = groupName.toLowerCase();

    if (name === 'utama') return <Target size={16} color="#6366f1" />;
    if (name === 'tambahan') return <Plus size={16} color="#f59e0b" />;
    if (name === 'subbagian umum') return <Folder size={16} />;
    if (name === 'tim ipjkd & dls') return <Network size={16} />;
    if (name === 'tim statistik sosial') return <Users size={16} />;
    if (name === 'tim statistik harga & sensus ekonomi') return <BarChart2 size={16} />;

    // Map projects by keywords
    if (name.includes('peta') || name.includes('wilkerstat') || name.includes('desa cantik') || name.includes('desa cinta')) {
      return <MapIcon size={16} />;
    }
    if (name.includes('it') || name.includes('aplikasi') || name.includes('humas')) {
      return <Monitor size={16} />;
    }
    if (name.includes('sbr') || name.includes('business register')) {
      return <Network size={16} />;
    }
    if (name.includes('sakernas') || name.includes('susenas') || name.includes('sensus') || name.includes('sektoral') || name.includes('pdrb') || name.includes('data')) {
      return <BarChart2 size={16} />;
    }
    if (name.includes('publikasi') || name.includes('kda') || name.includes('buku') || name.includes('rekomendasi')) {
      return <Book size={16} />;
    }
    if (name.includes('administrasi') || name.includes('kepegawaian') || name.includes('keuangan') || name.includes('bmn')) {
      return <ClipboardList size={16} />;
    }
    if (name.includes('pelayanan') || name.includes('pst') || name.includes('koordinasi')) {
      return <Users size={16} />;
    }

    // Old fallbacks
    switch (groupName) {
      case 'IT & Digital': return <Monitor size={16} />;
      case 'Geospasial': return <MapIcon size={16} />;
      case 'Survei & Sensus': return <BarChart2 size={16} />;
      case 'Publikasi & Data': return <Book size={16} />;
      case 'Pelayanan & Koordinasi': return <Users size={16} />;
      case 'Administrasi': return <ClipboardList size={16} />;
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
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className={styles.title}>
            <LayoutGrid size={28} color="#6366f1" /> Papan & Peta Kerja
          </h1>
          <p className={styles.subtitle}>
            Kelola penugasan khusus organisasi BPS Anda. Hubungkan tugas dengan SKP strategis dan urai menjadi checklist mikro.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {pendingUploads.length > 0 && (
            <button
              onClick={handleSyncOfflineFiles}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {isSyncing ? 'Sinkronisasi...' : `Sinkronkan ${pendingUploads.length} File`}
            </button>
          )}
          {accessToken ? (
            <button
              onClick={handleOpenDriveFolder}
              disabled={openingFolder}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {openingFolder ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Membuka...
                </>
              ) : (
                <>
                  <FolderOpen size={16} />
                  Buka Folder Drive
                </>
              )}
            </button>
          ) : (
            <button
              onClick={loginWithGoogle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              <FolderOpen size={16} style={{ opacity: 0.5 }} />
              Hubungkan Drive
            </button>
          )}
        </div>
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
              <div className={styles.progressCircleWrapper}>
                <svg className={styles.progressCircle} viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
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
                <div className={styles.progressStatsRow}>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#64748b' }} />
                    <span>{tasks.filter(t => t.status === 'todo').length} Belum</span>
                  </div>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#f59e0b' }} />
                    <span>{tasks.filter(t => t.status === 'in_progress').length} Proses</span>
                  </div>
                  <div className={styles.progressStatItem}>
                    <div className={styles.progressStatDot} style={{ background: '#10b981' }} />
                    <span>{tasks.filter(t => t.status === 'done').length} Selesai</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <input 
                type="text" 
                placeholder="Cari tugas..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                className={`${styles.filterToggleBtn} ${showFilter ? styles.filterToggleActive : ''}`}
                onClick={() => setShowFilter(f => !f)}
                title="Filter"
              >
                <SlidersHorizontal size={16} />
                {(filterRole !== 'all' || filterSkp !== 'all') && <span className={styles.filterDot} />}
              </button>
            </div>
            <button className={styles.addBtn} onClick={handleOpenAddModal}>
              <Plus size={18} /> Tambah Tugas
            </button>
          </div>

          {/* Collapsible Filter Panel */}
          {showFilter && (
            <div className={styles.filterPanel}>
              <select 
                className={styles.filterSelect}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">Semua Peran Kerja</option>
                {BPS_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select 
                className={styles.filterSelect}
                value={filterSkp}
                onChange={(e) => setFilterSkp(e.target.value)}
              >
                <option value="all">Semua Target SKP</option>
                {skpData.map((s) => (
                  <option key={s.id} value={s.id}>SKP #{s.id}: {s.nama}</option>
                ))}
              </select>
              {(filterRole !== 'all' || filterSkp !== 'all') && (
                <button className={styles.clearFilterBtn} onClick={() => { setFilterRole('all'); setFilterSkp('all'); }}>
                  <X size={13} /> Reset
                </button>
              )}
            </div>
          )}

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
                    skpData={skpData}
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
                    skpData={skpData}
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
                    skpData={skpData}
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
                  <option value="cluster">Proyek Tim</option>
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
                <label>Jadwal Terkait (Opsional)</label>
                <select 
                  className={styles.select}
                  value={formLinkedScheduleId}
                  onChange={(e) => setFormLinkedScheduleId(e.target.value)}
                >
                  <option value="">-- Tidak ada --</option>
                  <option value="NEW">+ Buat Jadwal Baru (Otomatis hari ini)</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.tanggal} - {s.judul} {s.isSelesai ? '(Selesai)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Butir Target SKP Terkait</label>
                <select 
                  className={styles.select}
                  value={formSkpId}
                  onChange={(e) => setFormSkpId(e.target.value)}
                >
                  {skpData.length === 0 ? (
                    <option value="">Belum ada SKP - Atur di menu SKP</option>
                  ) : (
                    skpData.map((s) => (
                      <option key={s.id} value={s.id}>
                        SKP #{s.id}: {s.nama} ({s.kategori})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#6366f1" />
                  Tenggat Waktu (Opsional)
                </label>
                <input 
                  type="date"
                  className={styles.input}
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>

              {formDueDate && (
                <div className={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={14} color="#6366f1" />
                    Pengingat Telegram
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {['Hari H', 'H-1', 'H-3'].map((r) => (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                          type="checkbox"
                          checked={formReminders.includes(r)}
                          onChange={() => handleReminderToggle(r)}
                          style={{ accentColor: '#6366f1' }}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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

              <div className={styles.formGroup} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={14} color="#6366f1" />
                  Berkas Pendukung / Lampiran
                </label>
                
                {formAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Lampiran Terunggah:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {formAttachments.map((att, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '12px'
                          }}
                        >
                          <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                            {att.name}
                          </a>
                          <button 
                            type="button" 
                            onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Hapus Lampiran"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => setTaskFiles(Array.from(e.target.files))}
                  style={{ display: 'none' }}
                  id="task-file-input"
                />
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    type="button" 
                    className={styles.templateBtn}
                    onClick={() => document.getElementById('task-file-input').click()}
                    style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                    disabled={isUploadingFiles}
                  >
                    {isUploadingFiles ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Mengunggah...
                      </>
                    ) : (
                      <>
                        <Paperclip size={14} />
                        Pilih Berkas Lampiran
                      </>
                    )}
                  </button>
                </div>

                {taskFiles.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Terpilih ({taskFiles.length} file):</span>
                    {taskFiles.map((f, i) => (
                      <span key={i} style={{ fontFamily: 'monospace' }}>• {f.name} ({Math.round(f.size / 1024)} KB)</span>
                    ))}
                  </div>
                )}

                {/* Tambah Tautan Web */}
                <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', display: 'block', marginBottom: '8px' }}>🔗 Tambah Tautan Web (Link)</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Nama/Label Tautan (misal: Spreadsheet SBR)" 
                      value={taskLinkLabel}
                      onChange={(e) => setTaskLinkLabel(e.target.value)}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="url" 
                        placeholder="https://docs.google.com/..." 
                        value={taskLinkUrl}
                        onChange={(e) => setTaskLinkUrl(e.target.value)}
                        className="input-base"
                        style={{ fontSize: '12px', padding: '8px 12px', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleAddLinkAttachment}
                        disabled={!taskLinkUrl}
                        className="btn btn-secondary"
                        style={{ padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      >
                        Tambah
                      </button>
                      {taskLinkUrl && !taskLinkUrl.includes('/s/') && /^https?:\/\//i.test(taskLinkUrl) && (
                        <button
                          type="button"
                          onClick={() => setShowTaskShortener(true)}
                          className="btn btn-primary"
                          style={{ padding: '0 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                        >
                          <Sparkles size={12} /> Ringkas
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Shortener Modal for Tasks */}
                {showTaskShortener && (
                  <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 7, 40, 0.7)', backdropFilter: 'blur(8px)',
                    zIndex: 1100, display: 'flex', alignItems: 'center',
                    padding: '20px', justifyContent: 'center'
                  }}>
                    <div style={{
                      background: 'rgba(30, 27, 75, 0.95)', border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px', maxWidth: '450px', width: '100%', padding: '24px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                      display: 'flex', flexDirection: 'column', textAlign: 'left'
                    }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px 0' }}>⚡ Buat Tautan Ringkas BPS</h3>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                        Tautan web ini akan disingkat dan ditambahkan secara otomatis ke daftar lampiran tugas.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 500 }}>Tautan Asal:</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }} title={taskLinkUrl}>
                            {taskLinkUrl}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>Slug Kustom (Opsional)</label>
                          <input 
                            type="text" 
                            placeholder="Contoh: link-sbr-maret" 
                            value={taskShortenerSlug}
                            onChange={(e) => setTaskShortenerSlug(e.target.value)}
                            className="input-base"
                            style={{ fontSize: '13px', padding: '8px 12px' }}
                          />
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Karakter aman: a-z, 0-9, dash (-), underscore (_). Biarkan kosong untuk slug acak.</span>
                        </div>
                      </div>

                      {taskShortenerError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                          {taskShortenerError}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button 
                          type="button" 
                          onClick={() => { setShowTaskShortener(false); setTaskShortenerSlug(''); setTaskShortenerError(''); }} 
                          className="btn btn-secondary"
                          disabled={taskShortenerLoading}
                          style={{ fontSize: '13px', padding: '8px 16px' }}
                        >
                          Batal
                        </button>
                        <button 
                          type="button" 
                          onClick={handleShortenTaskLinkInline} 
                          className="btn btn-primary"
                          disabled={taskShortenerLoading}
                          style={{ fontSize: '13px', padding: '8px 16px' }}
                        >
                          {taskShortenerLoading ? 'Memproses...' : 'Ringkas & Tambah'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Tim Kerja: {selectedSkp.tim}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Proyek Tim: {selectedSkp.cluster}</span>
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
  onMoveStatus, onDelete, onEdit, onStartFocus, onJadikanCKP,
  skpData = []
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
        {task.linkedScheduleId && (
          <span className={styles.skpTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(14, 165, 233, 0.3)', color: '#38bdf8' }} title="Tertaut dengan Jadwal">
            <Calendar size={11} /> Tertaut Jadwal
          </span>
        )}
        {task.dueDate && (
          <span className={styles.skpTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }} title={`Tenggat waktu: ${task.dueDate}`}>
            <Clock size={11} /> Tenggat: {task.dueDate}
          </span>
        )}
        {task.dueDate && task.reminders && task.reminders.length > 0 && (
          <span className={styles.skpTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }} title={`Pengingat Telegram aktif: ${task.reminders.join(', ')}`}>
            <Bell size={11} /> Pengingat: {task.reminders.join(', ')}
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

      {task.attachments && task.attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Paperclip size={12} /> Lampiran ({task.attachments.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {task.attachments.map((att, idx) => (
              <a 
                key={idx} 
                href={att.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '11px',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '150px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={att.name}
              >
                {att.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {task.telegramFileId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#eab308', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Paperclip size={12} /> Lampiran Telegram (Menunggu Sinkronisasi)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <a 
              href={`/api/telegram-file?id=${task.telegramFileId}`}
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: '11px',
                color: '#eab308',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px dashed rgba(234, 179, 8, 0.3)',
                padding: '3px 8px',
                borderRadius: '6px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '180px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Klik untuk membuka/mengunduh berkas langsung dari Telegram"
            >
              <Paperclip size={10} />
              Undangan_Telegram (Buka File)
            </a>
          </div>
        </div>
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
