'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Award, Bell, X, Plus, ChevronLeft, ChevronRight, CheckCircle, Circle, Edit3, Trash2, LayoutGrid, List, MapPin, Video, User, Link as LinkIcon, AlignLeft, Clock, Tag, ClipboardCheck, FileText, Loader2, ListTodo, CloudOff, FolderOpen, AlertTriangle } from 'lucide-react';
import { useSkps } from '@/hooks/useSkps';
import styles from './page.module.css';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGCalEvents, createGCalEvent, updateGCalEvent, deleteGCalEvent } from '@/lib/gcal';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/drive';
import { savePendingUpload, getPendingUploads, removePendingUpload } from '@/lib/localdb';
import AddEventModal, { URGENSI_COLORS } from './AddEventModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import TrainingTracker from './TrainingTracker';
import { useChatAction } from '@/contexts/ChatActionContext';
import { useAIContext } from '@/contexts/AIContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc as firestoreUpdateDoc, collection, getDocs, query, where, writeBatch, addDoc, deleteDoc } from 'firebase/firestore';

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const KATEGORI = ['Deadline', 'Rapat', 'Survei', 'Pelatihan', 'Upacara/Apel', 'Teknis', 'Lainnya'];
const KATEGORI_COLORS = {
  Deadline: '#ef4444',
  Rapat: '#3b82f6',
  Survei: '#10b981',
  Pelatihan: '#8b5cf6',
  'Upacara/Apel': '#f59e0b',
  Teknis: '#06b6d4',
  Lainnya: '#64748b',
  'Google Calendar': '#4285F4',
};
const REMINDER_OPTIONS = ['H-3', 'H-1', '1 Jam Sebelum', '5 Menit Sebelum'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// Calendar generation
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // Adjust to Mon=0

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [];

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  // Next month fill
  const remaining = 42 - days.length; // Always show 6 weeks
  for (let d = 1; d <= remaining; d++) {
    days.push({
      day: d,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }

  return days;
}

// Event Card
function EventCard({ event, onToggle, onEdit, onDelete, onJadikanCKP, ckpCount = 0, pendingUploads = [], skpData = [] }) {
  const skp = event.skpId ? skpData.find((s) => s.id === event.skpId) : null;
  const color = KATEGORI_COLORS[event.kategori] || KATEGORI_COLORS.Lainnya;
  const isSelesai = event.isSelesai;
  const hasCKP = ckpCount > 0;
  const urgensiColor = event.urgensi ? URGENSI_COLORS[event.urgensi] : null;

  return (
    <div className={styles.eventCard} style={{ borderLeftColor: color, opacity: isSelesai ? 0.6 : 1 }}>
      <div className={styles.eventHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(event); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelesai ? '#10b981' : '#cbd5e1', padding: 0, display: 'flex', alignItems: 'center' }}
            title={isSelesai ? "Tandai Belum Selesai" : "Tandai Selesai"}
          >
            {isSelesai ? <CheckCircle size={18} /> : <Circle size={18} />}
          </button>
          <span className={styles.eventKategori} style={{ background: `${color}20`, color, textDecoration: isSelesai ? 'line-through' : 'none' }}>
            {event.kategori}
          </span>
          {urgensiColor && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
              background: urgensiColor.bg, border: `1px solid ${urgensiColor.border}`, color: urgensiColor.text
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgensiColor.dot, display: 'inline-block' }} />
              {event.urgensi}
            </span>
          )}
          {hasCKP && (
            <span className={styles.ckpBadge}>
              <ClipboardCheck size={12} /> CKP Tercatat ({ckpCount})
            </span>
          )}
        </div>
        <span className={styles.eventTime}>{event.waktu}{event.waktuSelesai ? ` – ${event.waktuSelesai}` : ''}</span>
      </div>
      <h4 className={styles.eventTitle} style={{ textDecoration: isSelesai ? 'line-through' : 'none', color: isSelesai ? '#94a3b8' : '#fff', paddingRight: '80px', position: 'relative' }}>
        {event.judul}
        <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onJadikanCKP(event); }}
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}
            title="Buat CKP dari jadwal ini"
          >
            <ClipboardCheck size={12} /> CKP
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(event); }} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '4px' }} title="Edit"><Edit3 size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(event); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Hapus"><Trash2 size={14} /></button>
        </div>
      </h4>
      {event.lokasi && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
          <MapPin size={12} />
          <span>{event.lokasi}</span>
        </div>
      )}
      {event.deskripsi && <p className={styles.eventDesc}>{event.deskripsi}</p>}
      
      {/* Attachments */}
      {event.attachments && event.attachments.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {event.attachments.map((att, idx) => (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                padding: '3px 6px',
                borderRadius: '4px',
                textDecoration: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <FileText size={10} />
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
            </a>
          ))}
        </div>
      )}

      {/* Pending Offline Attachments */}
      {(() => {
        const pendingAttachments = pendingUploads.filter(item => item.id.startsWith(event.id));
        return pendingAttachments.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {pendingAttachments.map((att, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px dashed rgba(239, 68, 68, 0.3)',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  cursor: 'default'
                }}
              >
                <CloudOff size={10} />
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.customFileName.split(' - ').slice(2).join(' - ') || att.customFileName} (Offline)</span>
              </span>
            ))}
          </div>
        );
      })()}

      {skp && (
        <div className={styles.eventSkp}>
          SKP #{event.skpId}: {skp.nama}
        </div>
      )}
      <div className={styles.eventReminder} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Bell size={14} /> Pengingat: {Array.isArray(event.reminders) ? event.reminders.join(', ') : (event.reminder || 'Tidak ada')}
      </div>
      {event.createdAt && (
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', textAlign: 'right' }}>
          Ditambahkan: {event.createdAt?.toDate ? event.createdAt.toDate().toLocaleString('id-ID') : new Date(event.createdAt).toLocaleString('id-ID')}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const { accessToken, loginWithGoogle } = useAuth();
  const router = useRouter();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [viewMode, setViewMode] = useState('month');
  const [activeScheduleTab, setActiveScheduleTab] = useState('calendar'); // 'calendar' | 'training'
  
  const { skpData } = useSkps();
  const { docs: events = [], addDocument, updateDocument, deleteDocument } = useFirestore('schedule');
  const { docs: tasks = [], updateDocument: updateTask, addDocument: addTask, deleteDocument: deleteTask } = useFirestore('tasks');
  const { docs: ckpEvents = [] } = useFirestore('ckp');
  const { setPageData } = useAIContext();

  const [pendingUploads, setPendingUploads] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);

  const handleOpenDriveFolder = async () => {
    if (!accessToken) {
      alert('Silakan hubungkan Google Drive Anda terlebih dahulu.');
      return;
    }
    setOpeningFolder(true);
    try {
      const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
      const folderId = await getOrCreateFolder(accessToken, 'Lampiran Jadwal', parentFolderId);
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

  const fetchPendingUploads = useCallback(async () => {
    const list = await getPendingUploads();
    const scheduleList = list.filter(item => item.type === 'schedule');
    setPendingUploads(scheduleList || []);
  }, []);

  useEffect(() => {
    fetchPendingUploads();
  }, [fetchPendingUploads]);

  useEffect(() => {
    setPageData(events);
  }, [events, setPageData]);

  // Handle auto-sync of telegram file attachments for schedules
  useEffect(() => {
    if (!events || events.length === 0 || !accessToken) return;

    const syncPendingFiles = async () => {
      const pendingEvents = events.filter(e => e.telegramFileId);
      
      for (const event of pendingEvents) {
        try {
          console.log('[Telegram Sync] Syncing attachment for schedule event:', event.id);
          // 1. Download file content from Telegram via proxy
          const res = await fetch(`/api/telegram-file?id=${event.telegramFileId}`);
          if (!res.ok) throw new Error('Gagal mengunduh file Telegram via proxy.');
          
          const blob = await res.blob();
          const disp = res.headers.get('content-disposition');
          const filenameMatch = disp ? disp.match(/filename="([^"]+)"/) : null;
          const filename = filenameMatch ? filenameMatch[1] : `Lampiran_Jadwal_${event.tanggal}.pdf`;
          
          const file = new File([blob], filename, { type: blob.type });

          // 2. Get folder ID ("SuperBrain BPS/Lampiran Jadwal")
          const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
          const folderId = await getOrCreateFolder(accessToken, 'Lampiran Jadwal', parentFolderId);

          // 3. Upload to Google Drive
          const driveUrl = await uploadFileToDrive(file, accessToken, folderId);

          // 4. Update Firestore
          const currentAttachments = event.attachments || [];
          const updatedAttachments = [...currentAttachments, { name: file.name, url: driveUrl }];

          await updateDocument(event.id, {
            attachments: updatedAttachments,
            telegramFileId: null // Clear the temporary ID
          });
          
          console.log('[Telegram Sync] Successfully synced schedule attachment:', filename);
        } catch (err) {
          console.error('Failed to sync telegram file for event', event.id, err);
        }
      }
    };

    syncPendingFiles();
  }, [events, accessToken, updateDocument]);

  // Handle AI Create Schedule
  const handleAICreateSchedule = useCallback(async (data) => {
    try {
      await addDocument({
        judul: data.judul,
        tanggal: data.tanggal,
        waktu: data.waktu || '09:00',
        kategori: data.kategori || 'Lainnya',
        skpId: data.skpId || null,
        reminder: data.reminder || 'H-1',
        isSelesai: false,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('AI Create Schedule Error:', err);
    }
  }, [addDocument]);

  const handleAIUpdateSchedule = useCallback(async (data) => {
    if (!data.id) return;
    try {
      const updates = {};
      if (data.judul) updates.judul = data.judul;
      if (data.tanggal) updates.tanggal = data.tanggal;
      if (data.waktu) updates.waktu = data.waktu;
      if (data.kategori) updates.kategori = data.kategori;
      if (data.reminder) updates.reminder = data.reminder;
      await updateDocument(data.id, updates);
    } catch(e) { console.error(e); }
  }, [updateDocument]);

  const handleAIDeleteSchedule = useCallback(async (data) => {
    if (!data.id) return;
    try {
      await deleteDocument(data.id);
    } catch(e) { console.error(e); }
  }, [deleteDocument]);

  useChatAction('CREATE_SCHEDULE', handleAICreateSchedule);
  useChatAction('UPDATE_SCHEDULE', handleAIUpdateSchedule);
  useChatAction('DELETE_SCHEDULE', handleAIDeleteSchedule);

  // Map: scheduleEventId -> count of CKP entries
  const ckpCountByEventId = useMemo(() => {
    const map = {};
    ckpEvents.forEach(ckp => {
      if (ckp.fromScheduleEventId) {
        map[ckp.fromScheduleEventId] = (map[ckp.fromScheduleEventId] || 0) + 1;
      }
      if (ckp.sourceScheduleId && ckp.sourceScheduleId !== ckp.fromScheduleEventId) {
        map[ckp.sourceScheduleId] = (map[ckp.sourceScheduleId] || 0) + 1;
      }
    });
    return map;
  }, [ckpEvents]);

  const handleJadikanCKP = useCallback((event) => {
    const prefillData = {
      tanggal: event.tanggal,
      waktuMulai: event.waktu || '',
      waktuSelesai: event.waktuSelesai || '',
      skpId: event.skpId ? String(event.skpId) : '',
      rincian: event.judul + (event.deskripsi ? '\n' + event.deskripsi : ''),
      sumber: 'jadwal',
      sourceScheduleId: event.id,
      fromScheduleEventId: event.id, // fallback
      scheduleEventTitle: event.judul,
    };
    sessionStorage.setItem('ckp_prefill', JSON.stringify(prefillData));
    router.push('/ckp?fromSchedule=1');
  }, [router]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const fileInputRef = useRef(null);

  const handleImportInvitation = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/parse-invitation', {
        method: 'POST',
        body: formData,
      });

      // Safely parse response — it may not be JSON if server crashed
      let result;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Server returned non-JSON (e.g. HTML error page)
        const text = await response.text();
        throw new Error(
          response.ok
            ? 'Respon server tidak dalam format JSON.'
            : `Server error ${response.status}: AI sedang sibuk atau tidak tersedia. Silakan coba lagi dalam beberapa saat.`
        );
      }

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memproses dokumen.');
      }

      if (result.success && result.data) {
        setEditingEvent({
          judul: result.data.judul || '',
          tanggal: result.data.tanggal || toDateStr(new Date()),
          waktu: result.data.waktu || '09:00',
          waktuSelesai: result.data.waktuSelesai || '',
          kategori: result.data.kategori || 'Lainnya',
          urgensi: result.data.urgensi || 'Sedang',
          lokasi: result.data.lokasi || '',
          skpId: result.data.skpId || '',
          deskripsi: result.data.deskripsi || '',
          reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
        });
        setModalOpen(true);
      }
    } catch (err) {
      console.error('Import error:', err);
      setParseError(err.message || 'Terjadi kesalahan saat memproses berkas.');
      alert('Gagal membaca undangan: ' + err.message);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  const [selectedEventForDetail, setSelectedEventForDetail] = useState(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const weeklyBodyRef = useRef(null);

  useEffect(() => {
    if (accessToken) {
      const dMin = new Date(currentYear, currentMonth, -7);
      const dMax = new Date(currentYear, currentMonth + 1, 7);
      fetchGCalEvents(accessToken, dMin, dMax).then(evs => {
        setGcalEvents(evs);
      });
    } else {
      setGcalEvents([]);
    }
  }, [accessToken, currentYear, currentMonth, refreshTrigger]);

  const allEvents = useMemo(() => {
    const firestoreEventIds = new Set(events.filter(e => e.gcalEventId).map(e => e.gcalEventId));
    const filteredGcal = gcalEvents.filter(ge => !firestoreEventIds.has(ge.gcalEventId));
    return [...events, ...filteredGcal];
  }, [events, gcalEvents]);

  const handleToggleSelesai = async (event) => {
    try {
      const isMarkingDone = !event.isSelesai;
      await updateDocument(event.id, { isSelesai: isMarkingDone });
      
      if (isMarkingDone && event.linkedTaskIds && event.linkedTaskIds.length > 0) {
        if (window.confirm(`Jadwal ini tertaut dengan ${event.linkedTaskIds.length} tugas di Papan Kanban.\nApakah Anda juga ingin menandai semua tugas tersebut selesai?`)) {
          for (const taskId of event.linkedTaskIds) {
            try {
              await updateTask(taskId, { status: 'done' });
            } catch (err) {
              console.error('Failed to update linked task', taskId, err);
            }
          }
          alert('Semua tugas terkait berhasil ditandai selesai.');
        }
      }
    } catch (e) {
      alert("Gagal memperbarui status: " + e.message);
    }
  };

  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const todayStr = toDateStr(today);

  const eventsByDate = useMemo(() => {
    const map = {};
    allEvents.forEach((ev) => {
      if (!map[ev.tanggal]) map[ev.tanggal] = [];
      map[ev.tanggal].push(ev);
    });
    return map;
  }, [allEvents]);

  const selectedEvents = useMemo(
    () => (eventsByDate[selectedDate] || []).sort((a, b) => a.waktu.localeCompare(b.waktu)),
    [eventsByDate, selectedDate]
  );

  const upcomingEvents = useMemo(() => {
    return allEvents
      .filter((ev) => ev.tanggal >= todayStr)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.waktu.localeCompare(b.waktu))
      .slice(0, 6);
  }, [allEvents, todayStr]);

  const weekDays = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    d.setDate(d.getDate() - day);
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return week;
  }, [selectedDate]);

  const renderWeeklyCalendar = () => {
    let minHour = 7;
    let maxHour = 17;

    weekDays.forEach(date => {
      const dateStr = toDateStr(date);
      const dayEvents = eventsByDate[dateStr] || []; 
      const dayCkp = ckpEvents.filter(ckp => ckp.tanggal === dateStr);

      dayCkp.forEach(ckp => {
        const [sh] = (ckp.waktuMulai || '00:00').split(':').map(Number);
        const [eh] = (ckp.waktuSelesai || `${sh+1}:00`).split(':').map(Number);
        if (sh < minHour) minHour = sh;
        if (eh > maxHour) maxHour = eh;
      });

      dayEvents.forEach(ev => {
        const [hh] = (ev.waktu || '00:00').split(':').map(Number);
        if (hh < minHour) minHour = hh;
        let [eh] = (ev.waktuSelesai || `${hh+1}:00`).split(':').map(Number);
        if (eh > maxHour) maxHour = eh;
      });
    });

    if (minHour < 0) minHour = 0;
    if (maxHour > 23) maxHour = 23;

    const HOURS = Array.from({length: maxHour - minHour + 1}, (_, i) => minHour + i);
    const HOUR_HEIGHT = 48;
    const MIN_SCALE = HOUR_HEIGHT / 60;
    
    return (
      <div className={styles.weeklyWrapper}>
        <div className={styles.weeklyHeaderRow}>
          <div className={styles.weeklyTimeColHeader} />
          {weekDays.map(date => {
            const isToday = toDateStr(date) === todayStr;
            return (
              <div key={date.toISOString()} className={`${styles.weeklyDayHeader} ${isToday ? styles.weeklyDayHeaderToday : ''}`}>
                <div>{HARI[date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                <div style={{fontSize: '18px', fontWeight: isToday ? '700' : '500', marginTop: '4px'}}>{date.getDate()}</div>
              </div>
            );
          })}
        </div>
        
        <div className={styles.weeklyBody} ref={weeklyBodyRef}>
          <div className={styles.weeklyTimeCol}>
            {HOURS.map(h => (
              <div key={h} style={{height: `${HOUR_HEIGHT}px`, position: 'relative'}}>
                <span className={styles.weeklyTimeLabel}>{`${String(h).padStart(2,'0')}:00`}</span>
              </div>
            ))}
          </div>
          
          <div className={styles.weeklyGrid}>
            {HOURS.map(h => (
               <div key={h} className={styles.weeklyHourLine} style={{top: `${(h - minHour) * HOUR_HEIGHT}px`}} />
            ))}
            
            {weekDays.map(date => {
              const dateStr = toDateStr(date);
              const dayEvents = eventsByDate[dateStr] || []; 
              const dayCkp = ckpEvents.filter(ckp => ckp.tanggal === dateStr);
              
              return (
                <div key={dateStr} className={`${styles.weeklyDayCol} ${dateStr === todayStr ? styles.weeklyDayColToday : ''}`}>
                  {/* Realisasi CKP */}
                  {dayCkp.map(ckp => {
                     const [sh, sm] = (ckp.waktuMulai || '00:00').split(':').map(Number);
                     const [eh, em] = (ckp.waktuSelesai || `${sh+1}:00`).split(':').map(Number);
                     const top = ((sh - minHour) * HOUR_HEIGHT) + (sm * MIN_SCALE);
                     let height = ((eh * HOUR_HEIGHT) + (em * MIN_SCALE)) - ((sh * HOUR_HEIGHT) + (sm * MIN_SCALE));
                     if (height < 20) height = 20; // fallback if negative or too short
                     
                     return (
                       <div key={ckp.id} className={styles.weeklyEventBlock} style={{
                         top: `${top}px`, 
                         height: `${height}px`,
                         background: 'rgba(99, 102, 241, 0.2)',
                         border: '1px solid rgba(99, 102, 241, 0.5)',
                         color: '#f1f5f9',
                       }}>
                         <div className={styles.weeklyEventTitle}>[CKP] {ckp.rincian || ckp.butirNama || 'Kegiatan'}</div>
                         <div className={styles.weeklyEventTime}>{ckp.waktuMulai} - {ckp.waktuSelesai}</div>
                       </div>
                     );
                  })}

                  {/* Rencana Jadwal/GCal */}
                  {dayEvents.map((ev, idx) => {
                     const [hh, mm] = (ev.waktu || '00:00').split(':').map(Number);
                     const top = ((hh - minHour) * HOUR_HEIGHT) + (mm * MIN_SCALE);
                     const height = 30 * MIN_SCALE; // 30 mins
                     return (
                       <div key={ev.id} className={styles.weeklyEventBlock} style={{
                         top: `${top}px`, 
                         height: `${height}px`,
                         background: KATEGORI_COLORS[ev.kategori] || KATEGORI_COLORS.Lainnya,
                         borderLeft: '3px solid rgba(255,255,255,0.5)',
                         width: '80%', // Make it slightly narrower to show CKP underneath if overlap
                         left: `${(idx % 2) * 10}%`,
                         zIndex: 5
                       }} onClick={() => { 
                         setSelectedDate(dateStr); 
                         setSelectedEventForDetail(ev);
                         setDetailModalOpen(true);
                       }}>
                         <div className={styles.weeklyEventTitle}>{ev.judul}</div>
                       </div>
                     );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(todayStr);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('fromTask') === 'true') {
        const prefillStr = sessionStorage.getItem('schedule_prefill_from_task');
        if (prefillStr) {
          try {
            const prefill = JSON.parse(prefillStr);
            setEditingEvent(prefill);
            setModalOpen(true);
            sessionStorage.removeItem('schedule_prefill_from_task');
          } catch(e) {}
        }
      }
    }
  }, []);

  const handleAddEvent = useCallback(async (formData, selectedFiles = []) => {
    let gcalEventId = null;
    if (accessToken) {
      try {
        gcalEventId = await createGCalEvent(accessToken, formData);
      } catch (gcalErr) {
        console.error('Failed to sync to Google Calendar:', gcalErr);
        alert('Gagal mensinkronisasi ke Google Calendar. Jadwal tetap disimpan secara lokal.');
      }
    }

    const docRef = await addDocument({ ...formData, gcalEventId, attachments: [] });
    setModalOpen(false);

    // File upload logic
    if (selectedFiles.length > 0) {
      let uploadedList = [];
      let needsOfflineSave = false;
      let offlineFiles = [];

      for (let idx = 0; idx < selectedFiles.length; idx++) {
        const file = selectedFiles[idx];
        const cleanJudul = formData.judul.substring(0, 30).replace(/[^a-zA-Z0-9 -]/g, '').trim();
        const customFileName = `${formData.tanggal} - ${cleanJudul} - ${file.name}`;

        if (accessToken) {
          try {
            const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
            const folderId = await getOrCreateFolder(accessToken, 'Lampiran Jadwal', parentFolderId);
            const driveUrl = await uploadFileToDrive(file, accessToken, folderId, customFileName);
            uploadedList.push({ name: file.name, url: driveUrl });
          } catch (err) {
            console.error("Upload error for file:", file.name, err);
            needsOfflineSave = true;
            offlineFiles.push({ file, customFileName, idx });
          }
        } else {
          needsOfflineSave = true;
          offlineFiles.push({ file, customFileName, idx });
        }
      }

      if (uploadedList.length > 0) {
        await updateDocument(docRef.id, { attachments: uploadedList });
      }

      if (needsOfflineSave) {
        for (const item of offlineFiles) {
          await savePendingUpload(`${docRef.id}_${item.idx}`, item.file, item.customFileName, 'schedule');
        }
        alert('Beberapa lampiran disimpan secara lokal karena kendala koneksi/sesi Google Drive.');
        fetchPendingUploads();
      }
    }

    // If this schedule was created from a task, update the task with this new schedule ID
    if (formData.linkedTaskIds && formData.linkedTaskIds.length > 0) {
      try {
        for (const taskId of formData.linkedTaskIds) {
          await updateTask(taskId, {
            linkedScheduleId: docRef.id
          });
        }
      } catch (e) {
        console.error('Failed to link schedule to tasks:', e);
      }
    } else {
      // PROSES OTOMATIS: Buat tugas di latar belakang jika jadwal tidak dibuat dari tugas
      try {
        const newTaskRef = await addTask({
          judul: formData.judul,
          deskripsi: `Dibuat dari jadwal: ${formData.judul}`,
          status: 'todo',
          skpId: formData.skpId || null,
          peran: 'Ketua Tim',
          checklist: [],
          linkedScheduleId: docRef.id,
          tanggalDibuat: new Date().toISOString().split('T')[0]
        });
        // Update schedule dengan linkedTaskId yang baru dibuat
        await updateDocument(docRef.id, {
          linkedTaskIds: [newTaskRef.id]
        });
      } catch (e) {
        console.error('Failed to auto-create task from schedule:', e);
      }
    }

    // Telegram Notification
    const chatId = localStorage.getItem('telegramChatId');
    if (chatId) {
      try {
        const reminderStr = Array.isArray(formData.reminders) ? formData.reminders.join(', ') : '';
        const msg = `*Jadwal Baru Ditambahkan*\n\n*Judul:* ${formData.judul}\n*Kategori:* ${formData.kategori}\n*Waktu:* ${formData.tanggal} ${formData.waktu}\n*Pengingat:* ${reminderStr}`;
        
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: msg }),
        });
      } catch (e) {
        console.error('Failed to send telegram notification:', e);
      }
    }
  }, [addDocument, accessToken, updateTask, updateDocument, addTask, fetchPendingUploads]);

  const handleUpdateEvent = async (id, formData, selectedFiles = []) => {
    try {
      if (formData.isGCal) {
        if (accessToken && formData.gcalEventId) {
          await updateGCalEvent(accessToken, formData.gcalEventId, formData);
          setRefreshTrigger(prev => prev + 1);
        }
      } else {
        if (accessToken && formData.gcalEventId) {
          await updateGCalEvent(accessToken, formData.gcalEventId, formData);
        }
      }
      
      await updateDocument(id, formData);

      // Handle new file uploads
      if (selectedFiles.length > 0) {
        let uploadedList = [...(formData.attachments || [])];
        let needsOfflineSave = false;
        let offlineFiles = [];

        const startIdx = uploadedList.length;

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const cleanJudul = formData.judul.substring(0, 30).replace(/[^a-zA-Z0-9 -]/g, '').trim();
          const customFileName = `${formData.tanggal} - ${cleanJudul} - ${file.name}`;
          const idx = startIdx + i;

          if (accessToken) {
            try {
              const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
              const folderId = await getOrCreateFolder(accessToken, 'Lampiran Jadwal', parentFolderId);
              const driveUrl = await uploadFileToDrive(file, accessToken, folderId, customFileName);
              uploadedList.push({ name: file.name, url: driveUrl });
            } catch (err) {
              console.error("Upload error for file:", file.name, err);
              needsOfflineSave = true;
              offlineFiles.push({ file, customFileName, idx });
            }
          } else {
            needsOfflineSave = true;
            offlineFiles.push({ file, customFileName, idx });
          }
        }

        await updateDocument(id, { attachments: uploadedList });

        if (needsOfflineSave) {
          for (const item of offlineFiles) {
            await savePendingUpload(`${id}_${item.idx}`, item.file, item.customFileName, 'schedule');
          }
          alert('Beberapa lampiran disimpan secara lokal karena kendala koneksi/sesi Google Drive.');
          fetchPendingUploads();
        }
      }
      
      // Sync update to linked tasks
      try {
        const linkedTasks = tasks.filter(t => t.linkedScheduleId === id);
        for (const t of linkedTasks) {
          const updates = {};
          if (formData.judul) updates.judul = formData.judul;
          if (formData.tanggal) updates.deadline = formData.tanggal;
          await updateTask(t.id, updates);
        }
      } catch (err) {
        console.error('Failed to sync update to linked tasks:', err);
      }

      setModalOpen(false);
      setEditingEvent(null);
    } catch (e) {
      alert("Gagal memperbarui jadwal: " + e.message);
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
      const scheduleList = list.filter(item => item.type === 'schedule');
      if (scheduleList.length === 0) return;
      
      const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
      const folderId = await getOrCreateFolder(accessToken, 'Lampiran Jadwal', parentFolderId);
      const updatesByEventId = {};

      for (const item of scheduleList) {
        try {
          const driveUrl = await uploadFileToDrive(item.file, accessToken, folderId, item.customFileName);
          const [eventId] = item.id.split('_');
          
          if (!updatesByEventId[eventId]) {
            updatesByEventId[eventId] = [];
          }
          updatesByEventId[eventId].push({ name: item.file.name, url: driveUrl });
          
          await removePendingUpload(item.id);
          successCount++;
        } catch (err) {
          console.error("Sync error for item", item.id, err);
          if (err.message && err.message.includes('401')) {
            if (confirm('Sesi Google Drive kedaluwarsa. Apakah Anda ingin menghubungkan ulang sekarang untuk menyinkronkan file?')) {
              try {
                await loginWithGoogle();
                setTimeout(() => handleSyncOfflineFiles(), 500);
              } catch (loginErr) {
                console.error("Login failed:", loginErr);
                alert('Gagal menghubungkan ke Google Drive.');
              }
            }
            break;
          }
        }
      }
      
      for (const eventId of Object.keys(updatesByEventId)) {
        const eventDoc = events.find(e => e.id === eventId);
        const currentAttachments = eventDoc?.attachments || [];
        const newAttachments = [...currentAttachments, ...updatesByEventId[eventId]];
        await updateDocument(eventId, { attachments: newAttachments });
      }

      if (successCount > 0) {
        alert(`Berhasil menyinkronkan ${successCount} file lampiran ke Google Drive.`);
        fetchPendingUploads();
      }
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('401')) {
        if (confirm('Sesi Google Drive kedaluwarsa. Apakah Anda ingin menghubungkan ulang sekarang untuk menyinkronkan file?')) {
          try {
            await loginWithGoogle();
            setTimeout(() => handleSyncOfflineFiles(), 500);
          } catch (loginErr) {
            console.error("Login failed:", loginErr);
            alert('Gagal menghubungkan ke Google Drive.');
          }
        }
      } else {
        alert('Gagal menyinkronkan file lampiran: ' + err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (event) => {
    setDetailModalOpen(false);
    setEditingEvent(event);
    setModalOpen(true);
  };

  const handleDelete = (event) => {
    setConfirmDeleteEvent(event);
  };

  const executeDelete = async () => {
    if (!confirmDeleteEvent) return;
    const event = confirmDeleteEvent;
    try {
      if (accessToken && event.gcalEventId) {
        await deleteGCalEvent(accessToken, event.gcalEventId);
      }
      
      if (event.isGCal) {
        setRefreshTrigger(prev => prev + 1);
      } else {
        await deleteDocument(event.id);
      }

      // Sync delete to linked tasks
      try {
        const linkedTasks = tasks.filter(t => t.linkedScheduleId === event.id);
        for (const t of linkedTasks) {
          await deleteTask(t.id);
        }
      } catch (err) {
        console.error('Failed to sync delete to linked tasks:', err);
      }

      setDetailModalOpen(false);
      setConfirmDeleteEvent(null);
    } catch (e) {
      alert("Gagal menghapus jadwal: " + e.message);
    }
  };

  const renderDescription = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split('\n').map((line, i) => (
      <div key={i} style={{ minHeight: '1.2em' }}>
        {line.split(urlRegex).map((part, j) => {
          if (part.match(urlRegex)) {
            return <a key={j} href={part} target="_blank" rel="noreferrer" style={{color: '#38bdf8', textDecoration: 'underline', wordBreak: 'break-all'}}>{part}</a>;
          }
          return part;
        })}
      </div>
    ));
  };

  const handleDayClick = (dayObj) => {
    const dateStr = `${dayObj.year}-${String(dayObj.month + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    if (!dayObj.isCurrentMonth) {
      setCurrentMonth(dayObj.month < 0 ? 11 : dayObj.month > 11 ? 0 : dayObj.month);
      if (dayObj.month < 0) setCurrentYear((y) => y - 1);
      if (dayObj.month > 11) setCurrentYear((y) => y + 1);
    }
  };

  const getDayDateStr = (dayObj) => {
    const m = dayObj.month < 0 ? 11 : dayObj.month > 11 ? 0 : dayObj.month;
    return `${dayObj.year}-${String(m + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Jadwal & Pengingat</h1>
          <p className={styles.pageSubtitle}>
            Kelola deadline, rapat, dan sinkronisasi otomatis ke Google Calendar
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${viewMode === 'month' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('month')}>Bulan</button>
            <button className={`${styles.viewBtn} ${viewMode === 'week' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('week')}>Minggu</button>
          </div>
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
          <button 
            className={styles.importBtn} 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isParsing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isParsing ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            {isParsing ? 'Membaca Undangan...' : 'Impor dari Undangan'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportInvitation} 
            style={{ display: 'none' }} 
            accept="application/pdf,image/*" 
          />
          <button className={styles.addBtn} onClick={() => { setEditingEvent(null); setModalOpen(true); }} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
            <Plus size={18} /> Tambah Jadwal
          </button>
        </div>
      </header>

      {/* Tab Switcher */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveScheduleTab('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeScheduleTab === 'calendar' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeScheduleTab === 'calendar' ? '#818cf8' : '#94a3b8',
            border: activeScheduleTab === 'calendar' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            padding: '10px 18px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          <Calendar size={16} /> Kalender & Agenda
        </button>
        <button
          onClick={() => setActiveScheduleTab('training')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeScheduleTab === 'training' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeScheduleTab === 'training' ? '#818cf8' : '#94a3b8',
            border: activeScheduleTab === 'training' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            padding: '10px 18px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          <Award size={16} /> Tracker Pelatihan (Gantt Chart)
        </button>
      </div>

      {pendingUploads.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px dashed rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fca5a5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#f87171' }} />
            <span style={{ fontSize: '14px' }}>
              Terdapat <strong>{pendingUploads.length}</strong> file lampiran jadwal yang belum terunggah ke Google Drive (tersimpan di lokal).
            </span>
          </div>
          <button
            onClick={handleSyncOfflineFiles}
            disabled={isSyncing}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {isSyncing ? (
              <>
                <div className={styles.spinnerSmall} />
                Menyinkronkan...
              </>
            ) : (
              accessToken ? 'Unggah Sekarang' : 'Hubungkan Ulang Drive'
            )}
          </button>
        </div>
      )}

      {activeScheduleTab === 'calendar' ? (
        <div className={styles.layout}>
        {/* Calendar Section */}
        <div className={styles.calendarSection}>
          <div className={styles.calendarCard}>
            <div className={styles.calendarHeader}>
              <button className={styles.navBtn} onClick={viewMode === 'month' ? prevMonth : () => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() - 7);
                setSelectedDate(toDateStr(d));
                setCurrentMonth(d.getMonth());
                setCurrentYear(d.getFullYear());
              }}><ChevronLeft size={20} /></button>
              <div className={styles.calendarHeaderMonthLabel}>
                <span className={styles.monthName}>{BULAN[currentMonth]}</span>
                <span className={styles.yearLabel}>{currentYear}</span>
              </div>
              <button className={styles.navBtn} onClick={viewMode === 'month' ? nextMonth : () => {
                const d = new Date(selectedDate + 'T00:00:00');
                d.setDate(d.getDate() + 7);
                setSelectedDate(toDateStr(d));
                setCurrentMonth(d.getMonth());
                setCurrentYear(d.getFullYear());
              }}><ChevronRight size={20} /></button>
              <button className={styles.todayBtn} onClick={goToday}>Hari Ini</button>
            </div>

            {viewMode === 'month' ? (
              <div className={styles.calendarGrid}>
                {HARI.map((h) => (
                  <div key={h} className={styles.dayHeader}>{h}</div>
                ))}
                {calendarDays.map((dayObj, idx) => {
                  const dateStr = getDayDateStr(dayObj);
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={idx}
                      className={`${styles.dayCell} ${!dayObj.isCurrentMonth ? styles.dayCellOther : ''} ${isToday ? styles.dayCellToday : ''} ${isSelected ? styles.dayCellSelected : ''}`}
                      onClick={() => handleDayClick(dayObj)}
                    >
                      <span className={styles.dayNumber}>{dayObj.day}</span>
                      {hasEvents && (
                        <div className={styles.eventDots}>
                          {dayEvents.slice(0, 3).map((ev) => (
                            <span
                              key={ev.id}
                              className={styles.eventDot}
                              style={{ background: KATEGORI_COLORS[ev.kategori] || KATEGORI_COLORS.Lainnya }}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              renderWeeklyCalendar()
            )}
          </div>
        </div>

        {/* Upcoming Events Sidebar */}
        <aside className={styles.sidebar}>
          {/* Selected Date Events */}
          <div className={styles.selectedDateSection} style={{ marginBottom: '24px' }}>
            <h3 className={styles.sectionTitle} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Calendar size={20} /> {formatDateLong(selectedDate)}
            </h3>
            {selectedEvents.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Tidak ada jadwal pada tanggal ini.</p>
                <button className={styles.addSmallBtn} onClick={() => { setEditingEvent(null); setModalOpen(true); }} style={{display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                  <Plus size={16} /> Tambah Jadwal
                </button>
              </div>
            ) : (
              <div className={styles.eventList}>
                {selectedEvents.map((ev) => (
                  <div key={ev.id} onClick={() => {
                    setSelectedEventForDetail(ev);
                    setDetailModalOpen(true);
                  }} style={{cursor: 'pointer'}}>
                    <EventCard 
                      event={ev} 
                      onToggle={handleToggleSelesai} 
                      onEdit={() => handleEdit(ev)} 
                      onDelete={() => handleDelete(ev)}
                      onJadikanCKP={() => handleJadikanCKP(ev)}
                      ckpCount={ckpCountByEventId[ev.id] || 0}
                      pendingUploads={pendingUploads}
                      skpData={skpData}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 className={styles.sidebarTitle} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Bell size={20} /> Jadwal Mendatang
          </h3>
          <div className={styles.upcomingList}>
            {upcomingEvents.map((ev) => {
              const color = KATEGORI_COLORS[ev.kategori] || KATEGORI_COLORS.Lainnya;
              const daysUntil = Math.ceil(
                (new Date(ev.tanggal + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / (1000 * 60 * 60 * 24)
              );
              const urgencyLabel = daysUntil === 0 ? 'Hari Ini'
                : daysUntil === 1 ? 'Besok'
                : `${daysUntil} hari lagi`;

              return (
                <div
                  key={ev.id}
                  className={styles.upcomingItem}
                  onClick={() => {
                    setSelectedDate(ev.tanggal);
                    const evDate = new Date(ev.tanggal + 'T00:00:00');
                    setCurrentMonth(evDate.getMonth());
                    setCurrentYear(evDate.getFullYear());
                  }}
                >
                  <div className={styles.upcomingDot} style={{ background: color }} />
                  <div className={styles.upcomingInfo}>
                    <div className={styles.upcomingTitle}>{ev.judul}</div>
                    <div className={styles.upcomingMeta}>
                      <span>{formatDateLong(ev.tanggal)}</span>
                      <span>•</span>
                      <span>{ev.waktu}</span>
                    </div>
                  </div>
                  <span
                    className={`${styles.upcomingBadge} ${daysUntil <= 1 ? styles.urgentBadge : ''}`}
                  >
                    {urgencyLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <h4 className={styles.legendTitle}>Kategori</h4>
            {KATEGORI.map((k) => (
              <div key={k} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: KATEGORI_COLORS[k] }} />
                <span>{k}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      ) : (
        <TrainingTracker />
      )}

      <AddEventModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleAddEvent}
        initialData={editingEvent}
        onUpdate={handleUpdateEvent}
        skpData={skpData}
      />

      {/* Event Detail Modal */}
      {detailModalOpen && selectedEventForDetail && (
        <div className={styles.modalOverlay} onClick={() => setDetailModalOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}>
              <h2 className={styles.modalTitle} style={{ fontSize: '20px', lineHeight: '1.4' }}>{selectedEventForDetail.judul}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {ckpCountByEventId[selectedEventForDetail.id] > 0 && (
                  <span className={styles.ckpBadge} style={{ fontSize: '12px' }}>
                    <ClipboardCheck size={13} /> CKP ({ckpCountByEventId[selectedEventForDetail.id]})
                  </span>
                )}
                <button 
                  onClick={() => { setDetailModalOpen(false); handleJadikanCKP(selectedEventForDetail); }} 
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Buat CKP dari jadwal ini"
                >
                  <ClipboardCheck size={15} /> Jadikan CKP
                </button>
                <button 
                  className={styles.jadikanTugasBtn}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const event = selectedEventForDetail;
                    try {
                      const ref = await addTask({
                        judul: event.judul,
                        deskripsi: `Dibuat dari jadwal: ${event.judul}`,
                        status: 'todo',
                        skpId: event.skpId || null,
                        peran: 'Ketua Tim',
                        checklist: [],
                        linkedScheduleId: event.id,
                        tanggalDibuat: new Date().toISOString().split('T')[0]
                      });
                      
                      const newLinkedTaskIds = [...(event.linkedTaskIds || []), ref.id];
                      await updateDocument(event.id, {
                        linkedTaskIds: newLinkedTaskIds
                      });
                      
                      alert('Berhasil membuat tugas terkait!');
                    } catch(err) {
                      console.error(err);
                      alert('Gagal membuat tugas.');
                    }
                  }}
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Buat Tugas terkait di Papan Kanban"
                >
                  <ListTodo size={15} /> Buat Tugas
                </button>
                <button onClick={() => handleEdit(selectedEventForDetail)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '4px' }} title="Edit"><Edit3 size={18} /></button>
                <button onClick={() => handleDelete(selectedEventForDetail)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="Hapus"><Trash2 size={18} /></button>
                <button className={styles.modalClose} onClick={() => setDetailModalOpen(false)}><X size={20} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#e2e8f0', fontSize: '14px', padding: '0 24px 24px 24px' }}>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <Clock size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '500' }}>{formatDateLong(selectedEventForDetail.tanggal)}</div>
                  <div style={{ color: '#94a3b8' }}>{selectedEventForDetail.waktu} {selectedEventForDetail.waktuSelesai ? `\u2013 ${selectedEventForDetail.waktuSelesai}` : ''} (WIB)</div>
                </div>
              </div>

              {/* Kategori + Urgensi row */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {selectedEventForDetail.kategori && (
                    <span style={{
                      padding: '4px 10px',
                      background: KATEGORI_COLORS[selectedEventForDetail.kategori] || '#334155',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'white'
                    }}>
                      {selectedEventForDetail.kategori}
                    </span>
                  )}
                  {selectedEventForDetail.urgensi && (() => {
                    const uc = URGENSI_COLORS[selectedEventForDetail.urgensi];
                    return uc ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                        background: uc.bg, border: `1px solid ${uc.border}`, color: uc.text
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: uc.dot, display: 'inline-block' }} />
                        {selectedEventForDetail.urgensi}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              {selectedEventForDetail.linkedTaskIds && selectedEventForDetail.linkedTaskIds.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <ListTodo size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <a 
                      onClick={() => router.push('/tasks')}
                      style={{ color: '#818cf8', fontWeight: '500', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Tertaut dengan {selectedEventForDetail.linkedTaskIds.length} Tugas
                    </a>
                  </div>
                </div>
              )}

              {selectedEventForDetail.lokasi && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <MapPin size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>{selectedEventForDetail.lokasi}</div>
                </div>
              )}

              {selectedEventForDetail.meetLink && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <Video size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div><a href={selectedEventForDetail.meetLink} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{selectedEventForDetail.meetLink}</a></div>
                </div>
              )}

              {selectedEventForDetail.creator && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <User size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <div>
                    <span style={{ color: '#94a3b8' }}>Created by: </span>
                    {selectedEventForDetail.creator}
                  </div>
                </div>
              )}

              {selectedEventForDetail.htmlLink && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Calendar size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <a href={selectedEventForDetail.htmlLink} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                    Lihat di Google Calendar
                  </a>
                </div>
              )}

              {selectedEventForDetail.deskripsi && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <AlignLeft size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', flex: 1 }}>
                    {renderDescription(selectedEventForDetail.deskripsi)}
                  </div>
                </div>
              )}

              {/* Attachments rendering */}
              {selectedEventForDetail.attachments && selectedEventForDetail.attachments.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <FileText size={18} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lampiran ({selectedEventForDetail.attachments.length})</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {selectedEventForDetail.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          <FileText size={14} />
                          <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Telegram pending sync attachment rendering */}
              {selectedEventForDetail.telegramFileId && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '12px' }}>
                  <FileText size={18} color="#eab308" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#eab308', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lampiran Telegram (Menunggu Sinkronisasi)</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <a
                        href={`/api/telegram-file?id=${selectedEventForDetail.telegramFileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          color: '#eab308',
                          background: 'rgba(234, 179, 8, 0.08)',
                          border: '1px dashed rgba(234, 179, 8, 0.3)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontFamily: 'Inter, sans-serif'
                        }}
                        title="Klik untuk membuka/mengunduh berkas langsung dari Telegram"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText size={14} />
                        <span>Undangan_Telegram (Buka File)</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Offline pending attachments rendering */}
              {(() => {
                const pendingAttachments = pendingUploads.filter(item => item.id.startsWith(selectedEventForDetail.id));
                return pendingAttachments.length > 0 && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CloudOff size={18} color="#f87171" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#f87171', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lampiran Offline ({pendingAttachments.length})</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {pendingAttachments.map((att, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px dashed rgba(239, 68, 68, 0.3)',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: 'default',
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            <CloudOff size={14} />
                            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.customFileName.split(' - ').slice(2).join(' - ') || att.customFileName}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}
      <ConfirmDialog 
        isOpen={!!confirmDeleteEvent} 
        onConfirm={executeDelete} 
        onCancel={() => setConfirmDeleteEvent(null)} 
        title="Hapus Jadwal" 
        message="Apakah Anda yakin ingin menghapus jadwal ini?" 
        confirmText="Hapus" 
        variant="danger" 
      />
    </div>
  );
}
