'use client';

import { useState, useEffect } from 'react';
import { Calendar, BarChart2, Users, FileText, CheckCircle, File, ClipboardList, TrendingUp, Zap, Clock, History, Rocket, Send, Settings, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import { skpData } from '@/data/skpData';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getGreeting(hour) {
  if (hour >= 4 && hour < 11) return 'Pagi';
  if (hour >= 11 && hour < 15) return 'Siang';
  if (hour >= 15 && hour < 18) return 'Sore';
  return 'Malam';
}

function formatTanggal(date) {
  const hari = HARI[date.getDay()];
  const tgl = date.getDate();
  const bulan = BULAN[date.getMonth()];
  const tahun = date.getFullYear();
  return `${hari}, ${tgl} ${bulan} ${tahun}`;
}

const MOCK_ACTIVITIES = [
  {
    id: 1,
    waktu: '14:30',
    tanggal: 'Hari ini',
    judul: 'Mengolah data SUSENAS Triwulan II',
    kategori: 'Pengolahan Data',
    ikon: <BarChart2 size={16} />,
  },
  {
    id: 2,
    waktu: '11:00',
    tanggal: 'Hari ini',
    judul: 'Rapat koordinasi tim pengolahan',
    kategori: 'Koordinasi',
    ikon: <Users size={16} />,
  },
  {
    id: 3,
    waktu: '09:15',
    tanggal: 'Hari ini',
    judul: 'Review tabel publikasi Kabupaten',
    kategori: 'Penyajian Data',
    ikon: <FileText size={16} />,
  },
  {
    id: 4,
    waktu: '16:00',
    tanggal: 'Kemarin',
    judul: 'Validasi data SAKERNAS Mei 2026',
    kategori: 'Pengolahan Data',
    ikon: <CheckCircle size={16} />,
  },
  {
    id: 5,
    waktu: '10:30',
    tanggal: 'Kemarin',
    judul: 'Menyusun laporan bulanan CKP',
    kategori: 'Pelaporan',
    ikon: <File size={16} />,
  },
];

const QUICK_ACTIONS = [
  { id: 'catat', label: '+ Catat Kegiatan', href: '/ckp', warna: 'primary' },
  { id: 'skp', label: 'Lihat SKP', href: '/skp', warna: 'cyan' },
  { id: 'jadwal', label: 'Lihat Jadwal', href: '/schedule', warna: 'emerald' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { docs: ckpDocs, loading: ckpLoading } = useFirestore('ckp');
  const { docs: scheduleDocs, loading: scheduleLoading } = useFirestore('schedule');
  const { docs: taskDocs, loading: tasksLoading } = useFirestore('tasks');
  const [now, setNow] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNow(new Date());
    setMounted(true);

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return null;

  const greeting = getGreeting(now.getHours());
  const tanggalFormatted = formatTanggal(now);

  const todayStr = formatTanggal(now);
  const todayYMD = now.toISOString().split('T')[0];

  const kegiatanHariIni = ckpDocs.filter(doc => doc.tanggal === todayYMD);
  
  // Find nearest deadline
  const futureDeadlines = scheduleDocs
    .filter(doc => doc.kategori === 'Deadline' && doc.tanggal >= todayYMD && !doc.isSelesai)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  
  const nearestDeadline = futureDeadlines.length > 0 ? futureDeadlines[0] : null;
  let deadlineText = 'Tidak ada';
  let deadlineDetail = '—';
  
  if (nearestDeadline) {
    const daysUntil = Math.ceil((new Date(nearestDeadline.tanggal + 'T00:00:00') - new Date(todayYMD + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    deadlineText = daysUntil === 0 ? 'Hari Ini' : daysUntil === 1 ? 'Besok' : `${daysUntil} hari`;
    deadlineDetail = nearestDeadline.judul;
  }

  // Find upcoming schedules (nearest 3)
  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const upcomingSchedules = scheduleDocs
    .filter(doc => !doc.isSelesai && (doc.tanggal > todayYMD || (doc.tanggal === todayYMD && (doc.waktu || '00:00') >= currentTime)))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.waktu || '00:00').localeCompare(b.waktu || '00:00'))
    .slice(0, 3);

  // --- LOGIKA LINIMASA TERPADU (NESTED TIMELINE) ---
  const timelineRoots = [];

  // 1. Ambil Schedules sebagai root
  const todaySchedules = scheduleDocs.filter(s => s.tanggal === todayYMD);

  todaySchedules.forEach(s => {
    const allLinkedTasks = taskDocs.filter(t => t.linkedScheduleId === s.id || (s.linkedTaskIds && s.linkedTaskIds.includes(t.id)));
    const linkedCkps = ckpDocs.filter(c => c.tanggal === todayYMD && (c.sourceScheduleId === s.id || c.fromScheduleEventId === s.id || allLinkedTasks.some(t => t.id === c.sourceTaskId)));
    
    const children = [];
    allLinkedTasks.forEach(t => {
      children.push({
        id: `task-${t.id}`,
        type: 'task',
        time: s.waktu || '00:00', 
        sortOrder: 1, // urutan pertama: Tugas
        title: t.judul,
        subtitle: `Tugas Kanban - ${t.status === 'done' ? 'Selesai' : t.status === 'in_progress' ? 'Dikerjakan' : 'Belum'}`,
        status: t.status,
        color: 'purple'
      });
    });
    
    linkedCkps.forEach(c => {
      children.push({
        id: `ckp-${c.id}`,
        type: 'ckp',
        time: c.waktuMulai || s.waktu || '00:00',
        sortOrder: 2, // urutan kedua: CKP
        title: c.rincian || 'Kegiatan CKP',
        subtitle: `CKP SKP #${c.skpId}`,
        color: 'green'
      });
    });
    
    children.sort((a, b) => a.sortOrder - b.sortOrder);

    timelineRoots.push({
      id: `sched-${s.id}`,
      type: 'schedule',
      time: s.waktu || '00:00',
      title: s.judul,
      subtitle: `Jadwal - ${s.kategori}`,
      isSelesai: s.isSelesai,
      color: 'blue',
      children
    });
  });

  // 2. Ambil Tasks hari ini yang TIDAK terhubung ke Schedule manapun
  taskDocs.forEach(t => {
    const isToday = t.tanggalDibuat === todayYMD || t.deadline === todayYMD;
    if (isToday) {
      const isLinkedToAnySchedule = todaySchedules.some(s => t.linkedScheduleId === s.id || (s.linkedTaskIds && s.linkedTaskIds.includes(t.id)));
      if (!isLinkedToAnySchedule) {
        const linkedCkps = ckpDocs.filter(c => c.tanggal === todayYMD && c.sourceTaskId === t.id);
        
        const children = [];
        linkedCkps.forEach(c => {
          children.push({
            id: `ckp-${c.id}`,
            type: 'ckp',
            time: c.waktuMulai || '00:00',
            sortOrder: 2,
            title: c.rincian || 'Kegiatan CKP',
            subtitle: `CKP SKP #${c.skpId}`,
            color: 'green'
          });
        });
        
        timelineRoots.push({
          id: `task-${t.id}`,
          type: 'task',
          time: '23:59',
          title: t.judul,
          subtitle: `Tugas Kanban - ${t.status === 'done' ? 'Selesai' : t.status === 'in_progress' ? 'Dikerjakan' : 'Belum'}`,
          status: t.status,
          color: 'purple',
          children
        });
      }
    }
  });

  // 3. Ambil CKP yang TIDAK terhubung ke Task atau Schedule manapun
  ckpDocs.forEach(c => {
    if (c.tanggal === todayYMD) {
      const isLinkedToSchedule = todaySchedules.some(s => c.sourceScheduleId === s.id || c.fromScheduleEventId === s.id);
      const isLinkedToTask = taskDocs.some(t => c.sourceTaskId === t.id);
      if (!isLinkedToSchedule && !isLinkedToTask) {
        timelineRoots.push({
          id: `ckp-${c.id}`,
          type: 'ckp',
          time: c.waktuMulai || '00:00',
          timeEnd: c.waktuSelesai,
          title: c.rincian || 'Kegiatan CKP',
          subtitle: `CKP SKP #${c.skpId}`,
          color: 'green',
          children: []
        });
      }
    }
  });

  // Sort roots chronologically
  timelineRoots.sort((a, b) => a.time.localeCompare(b.time));

  const statsCards = [
    {
      id: 'skp',
      ikon: <ClipboardList size={24} />,
      label: 'Total SKP',
      value: skpData.length.toString(),
      detail: `${skpData.filter(s => s.kategori === 'utama').length} Utama + ${skpData.filter(s => s.kategori === 'tambahan').length} Tambahan`,
      accent: 'indigo',
    },
    {
      id: 'capaian',
      ikon: <TrendingUp size={24} />,
      label: 'Total CKP (Semua)',
      value: ckpDocs.length.toString(),
      detail: ckpLoading ? 'Memuat...' : 'Kegiatan Tercatat',
      accent: 'emerald',
    },
    {
      id: 'kegiatan',
      ikon: <Zap size={24} />,
      label: 'Kegiatan Hari Ini',
      value: kegiatanHariIni.length.toString(),
      detail: ckpLoading ? 'Memuat...' : 'Tercatat hari ini',
      accent: 'cyan',
    },
    {
      id: 'deadline',
      ikon: <Clock size={24} />,
      label: 'Deadline Terdekat',
      value: deadlineText,
      detail: deadlineDetail,
      accent: 'amber',
    },
  ];

  return (
    <div className={`${styles.page} ${mounted ? styles.visible : ''}`}>
      {/* Ambient Background Glow */}
      <div className={styles.ambientGlow} />
      <div className={styles.ambientGlow2} />

      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.greetingBlock}>
              <h1 className={styles.greeting}>
                Selamat {greeting},{' '}
                <span className={styles.nama}>{user?.displayName?.split(' ')[0] || 'Yahya'}!</span>
              </h1>
              <p className={styles.tanggal}>
                <span className={styles.calendarIcon}><Calendar size={16} /></span>
                {tanggalFormatted}
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link href="/settings" className={styles.settingsMobileBtn} title="Pengaturan">
                <Settings size={20} />
              </Link>
              <div className={styles.avatarCircle}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
                ) : (
                  'YA'
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <section className={styles.statsSection}>
          <div className={styles.statsGrid}>
            {statsCards.map((card, idx) => (
              <div
                key={card.id}
                className={`${styles.statCard} ${styles[`accent_${card.accent}`]}`}
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div className={styles.statCardGlow} />
                <div className={styles.statCardContent}>
                  <div className={styles.statHeader}>
                    <span className={styles.statIcon}>{card.ikon}</span>
                    <span className={styles.statLabel}>{card.label}</span>
                  </div>
                  <div className={styles.statValue}>{card.value}</div>
                  <div className={styles.statDetail}>{card.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Content Grid */}
        <div className={styles.contentGrid}>
          {/* Quick Actions (Aksi Cepat) */}
          <section className={styles.actionsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Rocket size={20} /></span>
                Aksi Cepat
              </h2>
            </div>
            <div className={styles.quickCard}>
              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={`${styles.quickBtn} ${styles[`btn_${action.warna}`]}`}
                  >
                    <span className={styles.quickBtnLabel}>{action.label}</span>
                    <span className={styles.quickBtnArrow}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Jadwal Terdekat */}
          <section className={styles.scheduleSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Calendar size={20} /></span>
                Jadwal Terdekat
              </h2>
            </div>
            <div className={styles.scheduleCard}>
              {scheduleLoading ? (
                <div className={styles.emptyStateText}>Memuat jadwal...</div>
              ) : upcomingSchedules.length === 0 ? (
                <div className={styles.emptyStateText}>Tidak ada jadwal mendatang.</div>
              ) : (
                <div className={styles.eventList}>
                  {upcomingSchedules.map(ev => {
                    const d = new Date(ev.tanggal + 'T00:00:00');
                    const tgl = `${d.getDate()} ${BULAN[d.getMonth()].substring(0, 3)}`;
                    const isToday = ev.tanggal === todayYMD;
                    const colorMap = {
                      Deadline: '#ef4444',
                      Rapat: '#6366f1',
                      Survei: '#10b981',
                      Pelatihan: '#f59e0b',
                      Lainnya: '#22d3ee'
                    };
                    const color = colorMap[ev.kategori] || '#38bdf8';
                    return (
                      <div key={ev.id} className={styles.eventItem} style={{ borderLeftColor: color }}>
                         <div className={styles.eventDateBlock}>
                           <div className={styles.eventDateText} style={{ color: isToday ? '#38bdf8' : 'var(--text-muted)' }}>
                             {isToday ? 'Hari Ini' : tgl}
                           </div>
                           <div className={styles.eventTimeText}>{ev.waktu || 'All Day'}</div>
                         </div>
                         <div className={styles.eventContentBlock}>
                           <div className={styles.eventTitleText}>{ev.judul}</div>
                           <div className={styles.eventCategoryText}>
                             <span className={styles.eventCategoryDot} style={{ background: color }}></span>
                             {ev.kategori}
                           </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Unified Timeline View */}
          <section className={styles.activitySection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><History size={20} /></span>
                Linimasa Terpadu Hari Ini
              </h2>
            </div>
            <div className={styles.activityCard}>
              <ul className={styles.activityList}>
                {(ckpLoading || scheduleLoading || tasksLoading) && <div style={{padding: '20px', color: '#94a3b8'}}>Memuat linimasa...</div>}
                {!(ckpLoading || scheduleLoading || tasksLoading) && timelineRoots.length === 0 && (
                  <div style={{padding: '20px', color: '#94a3b8'}}>Belum ada aktivitas hari ini.</div>
                )}
                {!(ckpLoading || scheduleLoading || tasksLoading) && timelineRoots.map((item, idx) => {
                  return (
                    <li key={item.id}>
                      <div
                        className={styles.activityItem}
                        style={{ animationDelay: `${0.3 + idx * 0.07}s` }}
                      >
                        <div className={`${styles.timelineDot} ${styles['dot_' + item.color]}`} />
                        {idx < timelineRoots.length - 1 && (
                          <div className={styles.timelineLine} />
                        )}
                        <div className={styles.activityContent}>
                          <div className={styles.activityTop}>
                            <span className={`${styles.activityEmoji} ${styles['text_' + item.color]}`}>
                              {item.type === 'schedule' ? <Calendar size={16} /> : item.type === 'ckp' ? <CheckCircle size={16} /> : <CheckSquare size={16} />}
                            </span>
                            <span className={styles.activityTime}>
                              {item.time === '23:59' ? 'Belum dijadwalkan' : item.time === '00:00' && !item.timeEnd ? 'Sepanjang Hari' : item.time} {item.timeEnd ? `- ${item.timeEnd}` : ''}
                            </span>
                          </div>
                          <p className={styles.activityTitle} style={{ textDecoration: item.status === 'done' || item.isSelesai ? 'line-through' : 'none', opacity: item.status === 'done' || item.isSelesai ? 0.6 : 1 }}>{item.title}</p>
                          <span className={styles.activityCategory}>
                            {item.subtitle}
                          </span>
                        </div>
                        
                        {/* Nested Children */}
                        {item.children && item.children.length > 0 && (
                          <ul className={styles.activityChildList}>
                            {item.children.map((child) => (
                              <li key={child.id} className={styles.activityChildItem}>
                                <div className={styles.childLineIndicator} />
                                <div className={`${styles.childDot} ${styles['dot_' + child.color]}`} />
                                <div className={styles.activityContent} style={{ gap: '2px' }}>
                                  <div className={styles.activityTop}>
                                    <span className={`${styles.activityEmoji} ${styles['text_' + child.color]}`} style={{ fontSize: '0.85rem' }}>
                                      {child.type === 'schedule' ? <Calendar size={13} /> : child.type === 'ckp' ? <CheckCircle size={13} /> : <CheckSquare size={13} />}
                                    </span>
                                    <span className={styles.activityTime} style={{ fontSize: '0.7rem' }}>
                                      {child.time === '23:59' ? '' : child.time === '00:00' && !child.timeEnd ? 'All Day' : child.time} {child.timeEnd ? `- ${child.timeEnd}` : ''}
                                    </span>
                                  </div>
                                  <p className={styles.activityTitle} style={{ fontSize: '0.82rem', textDecoration: child.status === 'done' || child.isSelesai ? 'line-through' : 'none', opacity: child.status === 'done' || child.isSelesai ? 0.6 : 1 }}>{child.title}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Motivational quote */}
          <section className={styles.quoteSection}>
            <div className={styles.quoteBox}>
              <p className={styles.quoteText}>
                &ldquo;Data yang akurat adalah fondasi kebijakan yang tepat.&rdquo;
              </p>
              <span className={styles.quoteAuthor}>— Semangat BPS</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
