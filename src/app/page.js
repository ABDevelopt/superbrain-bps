'use client';

import { useState, useEffect } from 'react';
import { Calendar, BarChart2, Users, FileText, CheckCircle, File, ClipboardList, TrendingUp, Zap, Clock, History, Rocket, Send, Settings } from 'lucide-react';
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

  // Get recent 5 activities
  const recentActivities = ckpDocs.slice(0, 5);

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

        {/* Two Column Layout: Activity + Quick Actions */}
        <div className={styles.bottomGrid}>
          {/* Recent Activity */}
          <section className={styles.activitySection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><History size={20} /></span>
                Aktivitas Terkini
              </h2>
            </div>
            <div className={styles.activityCard}>
              <ul className={styles.activityList}>
                {ckpLoading && <div style={{padding: '20px', color: '#94a3b8'}}>Memuat aktivitas...</div>}
                {!ckpLoading && recentActivities.length === 0 && (
                  <div style={{padding: '20px', color: '#94a3b8'}}>Belum ada aktivitas tercatat.</div>
                )}
                {!ckpLoading && recentActivities.map((item, idx) => {
                  const isNewDay =
                    idx === 0 ||
                    recentActivities[idx - 1].tanggal !== item.tanggal;
                  
                  const itemTanggal = item.tanggal === todayYMD ? 'Hari ini' : item.tanggal;

                  return (
                    <li key={item.id}>
                      {isNewDay && (
                        <div className={styles.dayDivider}>
                          <span>{itemTanggal}</span>
                        </div>
                      )}
                      <div
                        className={styles.activityItem}
                        style={{ animationDelay: `${0.3 + idx * 0.07}s` }}
                      >
                        <div className={styles.timelineDot} />
                        {idx < recentActivities.length - 1 && (
                          <div className={styles.timelineLine} />
                        )}
                        <div className={styles.activityContent}>
                          <div className={styles.activityTop}>
                            <span className={styles.activityEmoji}>
                              <CheckCircle size={16} />
                            </span>
                            <span className={styles.activityTime}>
                              {item.waktuMulai} - {item.waktuSelesai}
                            </span>
                          </div>
                          <p className={styles.activityTitle}>{item.rincian}</p>
                          <span className={styles.activityCategory}>
                            SKP #{item.skpId}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Right Column */}
          <section className={styles.quickSection}>
            {/* Jadwal Terdekat */}
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Calendar size={20} /></span>
                Jadwal Terdekat
              </h2>
            </div>
            <div className={styles.quickCard} style={{marginBottom: '24px', padding: '16px'}}>
              {scheduleLoading ? (
                <div style={{color: '#94a3b8', fontSize: '14px'}}>Memuat jadwal...</div>
              ) : upcomingSchedules.length === 0 ? (
                <div style={{color: '#94a3b8', fontSize: '14px'}}>Tidak ada jadwal mendatang.</div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
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
                      <div key={ev.id} style={{display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', borderLeft: `3px solid ${color}`}}>
                         <div style={{minWidth: '55px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px'}}>
                           <div style={{fontSize: '11px', color: isToday ? '#38bdf8' : '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold'}}>{isToday ? 'Hari Ini' : tgl}</div>
                           <div style={{fontSize: '13px', fontWeight: 'bold', color: '#f1f5f9'}}>{ev.waktu || 'All Day'}</div>
                         </div>
                         <div style={{flex: 1, minWidth: 0}}>
                           <div style={{fontSize: '14px', fontWeight: '600', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{ev.judul}</div>
                           <div style={{fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px'}}>
                             <span style={{display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: color}}></span>
                             {ev.kategori}
                           </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}><Rocket size={20} /></span>
                Aksi Cepat
              </h2>
            </div>
            <div className={styles.quickCard}>
              <div className={styles.quickActions}>
                {QUICK_ACTIONS.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    className={`${styles.quickBtn} ${styles[`btn_${action.warna}`]}`}
                  >
                    <span className={styles.quickBtnLabel}>{action.label}</span>
                    <span className={styles.quickBtnArrow}>→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Motivational quote */}
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
