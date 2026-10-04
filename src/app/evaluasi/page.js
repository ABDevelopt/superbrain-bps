'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  Printer, 
  Layers, 
  HeartHandshake, 
  SlidersHorizontal,
  Clock,
  Search,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import styles from './page.module.css';
import { useSkps } from '@/hooks/useSkps';
import { useFirestore } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';

const BERAKHLAK_STANDARDS = [
  {
    id: 'berorientasi_pelayanan',
    kode: 'BP',
    nama: 'Berorientasi Pelayanan',
    warna: '#3b82f6',
    bg: '#eff6ff',
    panduan: 'Memahami dan memenuhi kebutuhan masyarakat/pengguna data, ramah, cekatan, solutif, dan melakukan perbaikan tiada henti.',
    ekspektasiDefault: 'Memberikan pelayanan konsultasi statistik terpadu (PST) dan rekomendasi statistik secara responsif, solutif, dan ramah.',
    umpanBalikDefault: '+ Sangat sigap membantu satuan kerja dan OPD mitra dalam asistensi metadata dan rekomendasi statistik.'
  },
  {
    id: 'akuntabel',
    kode: 'AK',
    nama: 'Akuntabel',
    warna: '#10b981',
    bg: '#f0fdf4',
    panduan: 'Melaksanakan tugas dengan jujur, bertanggung jawab, cermat, disiplin, berintegritas tinggi, dan tidak menyalahgunakan kewenangan.',
    ekspektasiDefault: 'Menjaga integritas data sensus/survei, mematuhi SOP pemeriksaan kuesioner, dan disiplin waktu pelaporan.',
    umpanBalikDefault: '+ Seluruh berkas administrasi dan pelaporan SPT/BMN diselesaikan dengan cermat tanpa keterlambatan.'
  },
  {
    id: 'kompeten',
    kode: 'KP',
    nama: 'Kompeten',
    warna: '#8b5cf6',
    bg: '#f5f3ff',
    panduan: 'Meningkatkan kompetensi diri untuk menjawab tantangan, membantu orang lain belajar, dan melaksanakan tugas dengan kualitas terbaik.',
    ekspektasiDefault: 'Terus mengembangkan kemampuan otomatisasi pengolahan data statistik dan teknologi informasi BPS.',
    umpanBalikDefault: '+ Aktif berbagi wawasan teknis pengolahan dan tools visualisasi data kepada rekan tim.'
  },
  {
    id: 'harmonis',
    kode: 'HM',
    nama: 'Harmonis',
    warna: '#f59e0b',
    bg: '#fffbeb',
    panduan: 'Menghargai setiap orang apapun latar belakangnya, suka menolong, dan membangun lingkungan kerja yang kondusif.',
    ekspektasiDefault: 'Membangun komunikasi kolegial yang erat antar fungsi teknis survei dan Subbagian Umum.',
    umpanBalikDefault: '+ Selalu bersikap kooperatif dan suportif dalam kepanitiaan pelatihan dan kegiatan lapangan bersama.'
  },
  {
    id: 'loyal',
    kode: 'LY',
    nama: 'Loyal',
    warna: '#ef4444',
    bg: '#fef2f2',
    panduan: 'Memegang teguh ideologi Pancasila, UUD 1945, setia kepada NKRI, menjaga nama baik ASN, pimpinan, dan rahasia jabatan.',
    ekspektasiDefault: 'Menjaga kerahasiaan data mikro responden sesuai UU No. 16 Tahun 1997 tentang Statistik dan dedikasi pada visi BPS.',
    umpanBalikDefault: '+ Menunjukkan komitmen tinggi terhadap kerahasiaan dan integritas data institusi.'
  },
  {
    id: 'adaptif',
    kode: 'AD',
    nama: 'Adaptif',
    warna: '#06b6d4',
    bg: '#ecfeff',
    panduan: 'Cepat menyesuaikan diri menghadapi perubahan, terus berinovasi dan mengembangkan kreativitas, serta bertindak proaktif.',
    ekspektasiDefault: 'Cepat menguasai instrumen baru pengumpulan data berbasis CAPI/FASIH dan sistem manajemen CKP modern.',
    umpanBalikDefault: '+ Berinisiatif mempermudah alur kerja pencatatan harian dan kompresi berkas pendukung.'
  },
  {
    id: 'kolaboratif',
    kode: 'KL',
    nama: 'Kolaboratif',
    warna: '#6366f1',
    bg: '#eef2ff',
    panduan: 'Memberi kesempatan kepada berbagai pihak untuk berkontribusi, terbuka dalam bekerja sama, serta menggerakkan pemanfaatan sumber daya.',
    ekspektasiDefault: 'Membangun sinergi lintas fungsi dalam penanganan anomali sensus dan pembinaan Desa Cinta Statistik.',
    umpanBalikDefault: '+ Sangat terbuka berkolaborasi dengan ketua tim lain dalam menyelesaikan target survei yang mendesak.'
  }
];

export default function EvaluasiKinerjaPage() {
  const { user } = useAuth();
  const { skpData, loading: skpLoading } = useSkps();
  const { docs: ckpDocs } = useFirestore('ckp');

  // Filter Periode
  const [periode, setPeriode] = useState('tw3'); // tw1, tw2, tw3, tw4, tahunan
  const [activeTab, setActiveTab] = useState('kuadran'); // 'kuadran', 'hasil', 'perilaku'

  // View Mode for SKP tab (card vs table)
  const [skpViewMode, setSkpViewMode] = useState('cards');
  const [skpSearch, setSkpSearch] = useState('');

  // Override State for Rating Hasil Kerja & Perilaku
  const [ratingHasilOverride, setRatingHasilOverride] = useState(null); // 'di_atas', 'sesuai', 'di_bawah'
  const [ratingPerilakuOverride, setRatingPerilakuOverride] = useState(null);

  // Set default view mode based on screen width on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSkpViewMode('cards');
    }
  }, []);

  // BerAKHLAK State
  const [berakhlakData, setBerakhlakData] = useState(() => {
    const init = {};
    BERAKHLAK_STANDARDS.forEach(item => {
      init[item.id] = {
        rating: 'sesuai', // 'di_atas', 'sesuai', 'di_bawah'
        ekspektasi: item.ekspektasiDefault,
        umpanBalik: item.umpanBalikDefault
      };
    });
    return init;
  });

  // Periode mapping to months (0-indexed)
  const periodMonths = useMemo(() => {
    switch (periode) {
      case 'tw1': return [0, 1, 2];
      case 'tw2': return [3, 4, 5];
      case 'tw3': return [6, 7, 8];
      case 'tw4': return [9, 10, 11];
      case 'tahunan': return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      default: return [6, 7, 8];
    }
  }, [periode]);

  const periodLabel = useMemo(() => {
    switch (periode) {
      case 'tw1': return 'Triwulan I (Jan - Mar 2026)';
      case 'tw2': return 'Triwulan II (Apr - Jun 2026)';
      case 'tw3': return 'Triwulan III (Jul - Sep 2026)';
      case 'tw4': return 'Triwulan IV (Okt - Des 2026)';
      case 'tahunan': return 'Tahunan (Jan - Des 2026)';
      default: return 'Triwulan III 2026';
    }
  }, [periode]);

  // Filtered CKP within period
  const filteredCkp = useMemo(() => {
    return ckpDocs.filter(doc => {
      if (!doc.tanggal) return false;
      const d = new Date(doc.tanggal + 'T00:00:00');
      return periodMonths.includes(d.getMonth());
    });
  }, [ckpDocs, periodMonths]);

  // Aggregate Realization by SKP
  const skpRealizationMap = useMemo(() => {
    const map = {};
    filteredCkp.forEach(doc => {
      const sids = Array.isArray(doc.skpIds) && doc.skpIds.length > 0
        ? doc.skpIds.map(Number).filter(n => !isNaN(n) && n > 0)
        : (doc.skpId ? [Number(doc.skpId)] : []);

      sids.forEach(sid => {
        if (!map[sid]) map[sid] = { totalQty: 0, count: 0 };
        map[sid].totalQty += Number(doc.kuantitas) || 0;
        map[sid].count += 1;
      });
    });
    return map;
  }, [filteredCkp]);

  // Summary Metrics of SKP
  const skpMetrics = useMemo(() => {
    let totalTarget = 0;
    let totalRealisasi = 0;
    let countAbove = 0;
    let countMet = 0;
    let countBelow = 0;

    skpData.forEach(skp => {
      const kuantitasInd = skp.indikator?.find(i => i.jenis === 'kuantitas') || { target: 100 };
      const target = Number(kuantitasInd.target) || 100;
      const realisasi = skpRealizationMap[skp.id]?.totalQty || 0;

      totalTarget += target;
      totalRealisasi += realisasi;

      const pct = target > 0 ? (realisasi / target) * 100 : 0;
      if (pct >= 100) countAbove++;
      else if (pct >= 65) countMet++;
      else countBelow++;
    });

    const avgPct = totalTarget > 0 ? (totalRealisasi / totalTarget) * 100 : 0;
    return {
      totalTarget,
      totalRealisasi,
      avgPct: Math.round(avgPct),
      countAbove,
      countMet,
      countBelow,
      totalSkp: skpData.length
    };
  }, [skpData, skpRealizationMap]);

  // Calculated Rating Hasil Kerja
  const autoRatingHasil = useMemo(() => {
    if (skpMetrics.avgPct >= 90 && skpMetrics.countBelow === 0) return 'di_atas';
    if (skpMetrics.avgPct >= 65) return 'sesuai';
    return 'di_bawah';
  }, [skpMetrics]);

  const effectiveRatingHasil = ratingHasilOverride || autoRatingHasil;

  // Calculated Rating Perilaku Kerja
  const autoRatingPerilaku = useMemo(() => {
    let diAtasCount = 0;
    let diBawahCount = 0;
    Object.values(berakhlakData).forEach(val => {
      if (val.rating === 'di_atas') diAtasCount++;
      if (val.rating === 'di_bawah') diBawahCount++;
    });

    if (diBawahCount > 0) return 'di_bawah';
    if (diAtasCount >= 4) return 'di_atas';
    return 'sesuai';
  }, [berakhlakData]);

  const effectiveRatingPerilaku = ratingPerilakuOverride || autoRatingPerilaku;

  // Predikat Kinerja Pegawai Matrix (Permen PANRB 6/2022)
  const predikatKinerja = useMemo(() => {
    if (effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'di_atas') {
      return {
        nama: 'Sangat Baik',
        key: 'sangatBaik',
        desc: 'Hasil kerja di atas ekspektasi dan perilaku kerja menjadi role model bagi pegawai lain.',
        class: styles.sangatBaik
      };
    }
    if (
      (effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'sesuai') ||
      (effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'di_atas') ||
      (effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'sesuai')
    ) {
      return {
        nama: 'Baik',
        key: 'baik',
        desc: 'Memenuhi ekspektasi pimpinan baik dalam capaian hasil kerja maupun perilaku BerAKHLAK.',
        class: styles.baik
      };
    }
    if (effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku !== 'di_bawah') {
      return {
        nama: 'Butuh Perbaikan',
        key: 'butuhPerbaikan',
        desc: 'Perilaku kerja sudah sesuai/di atas ekspektasi, namun hasil kerja perlu bimbingan/mentoring.',
        class: styles.butuhPerbaikan
      };
    }
    if (effectiveRatingHasil !== 'di_bawah' && effectiveRatingPerilaku === 'di_bawah') {
      return {
        nama: 'Kurang / Misconduct',
        key: 'kurang',
        desc: 'Hasil kerja tercapai namun terdapat pelanggaran atau perilaku kerja di bawah ekspektasi.',
        class: styles.kurang
      };
    }
    return {
      nama: 'Sangat Kurang',
      key: 'sangatKurang',
      desc: 'Hasil kerja dan perilaku kerja keduanya berada di bawah standar ekspektasi organisasi.',
      class: styles.sangatKurang
    };
  }, [effectiveRatingHasil, effectiveRatingPerilaku]);

  const handleBerakhlakChange = (id, field, value) => {
    setBerakhlakData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetOverride = () => {
    setRatingHasilOverride(null);
    setRatingPerilakuOverride(null);
  };

  // Filtered SKPs for Tab 3
  const filteredSkps = useMemo(() => {
    if (!skpSearch.trim()) return skpData;
    const q = skpSearch.toLowerCase();
    return skpData.filter(s => 
      s.nama.toLowerCase().includes(q) || 
      (s.tim && s.tim.toLowerCase().includes(q)) ||
      (s.cluster && s.cluster.toLowerCase().includes(q))
    );
  }, [skpData, skpSearch]);

  const isOverrideActive = Boolean(ratingHasilOverride || ratingPerilakuOverride);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>
            <Award size={26} color="#4f46e5" />
            Evaluasi Kinerja & Kuadran ASN
            <span className={styles.badgeRegulasi}>Permen PANRB 6/2022</span>
          </h1>
          <p className={styles.subtitle}>
            Evaluasi capaian periodik dan tahunan ASN berbasis dialog kinerja, realisasi IKI, dan perilaku BerAKHLAK.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={handlePrint} title="Cetak Formulir Lampiran Permen PANRB 6/2022">
            <Printer size={15} /> Cetak Form Evaluasi
          </button>
        </div>
      </div>

      {/* Profil Banner */}
      <div className={styles.profileCard}>
        <div className={styles.profileInfo}>
          <div className={styles.avatar}>
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              'YA'
            )}
          </div>
          <div className={styles.nameBlock}>
            <h3>{user?.displayName || 'Yahya Abdurrohman, S.Tr.Stat'}</h3>
            <p>Pranata Komputer Ahli Pertama • BPS Kabupaten Penajam Paser Utara</p>
          </div>
        </div>

        <div className={styles.periodSelector}>
          <Clock size={15} color="#64748b" />
          <span className={styles.periodLabel}>Periode:</span>
          <select 
            className={styles.selectPeriod}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
          >
            <option value="tw1">Triwulan I (Jan - Mar)</option>
            <option value="tw2">Triwulan II (Apr - Jun)</option>
            <option value="tw3">Triwulan III (Jul - Sep)</option>
            <option value="tw4">Triwulan IV (Okt - Des)</option>
            <option value="tahunan">Tahunan 2026</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabNav}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'kuadran' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('kuadran')}
        >
          <Layers size={16} /> Matriks Kuadran (3x3)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'perilaku' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('perilaku')}
        >
          <HeartHandshake size={16} /> Perilaku BerAKHLAK (7)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'hasil' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('hasil')}
        >
          <TrendingUp size={16} /> Capaian SKP ({skpData.length})
        </button>
      </div>

      {/* Executive KPI Summary Cards */}
      <div className={styles.summaryGrid}>
        {/* Rating Hasil Kerja */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.cardHeader}>
              <h4>Rating Hasil Kerja</h4>
              <div className={styles.cardIcon} style={{ background: '#e0e7ff', color: '#4338ca' }}>
                <TrendingUp size={16} />
              </div>
            </div>
            <div className={styles.ratingValue}>
              {effectiveRatingHasil === 'di_atas' && 'Di Atas Ekspektasi'}
              {effectiveRatingHasil === 'sesuai' && 'Sesuai Ekspektasi'}
              {effectiveRatingHasil === 'di_bawah' && 'Di Bawah Ekspektasi'}
            </div>
            <p className={styles.ratingDetail}>
              Rata-rata realisasi target SKP: <strong>{skpMetrics.avgPct}%</strong> ({skpMetrics.countAbove} Melampaui, {skpMetrics.countMet} Sesuai, {skpMetrics.countBelow} Di Bawah).
            </p>
          </div>

          <div className={styles.ratingPillGroup}>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingHasil === 'di_bawah' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingHasilOverride('di_bawah')}
            >
              Di Bawah
            </button>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingHasil === 'sesuai' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingHasilOverride('sesuai')}
            >
              Sesuai
            </button>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingHasil === 'di_atas' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingHasilOverride('di_atas')}
            >
              Di Atas
            </button>
          </div>
        </div>

        {/* Rating Perilaku Kerja */}
        <div className={styles.summaryCard}>
          <div>
            <div className={styles.cardHeader}>
              <h4>Rating Perilaku Kerja</h4>
              <div className={styles.cardIcon} style={{ background: '#fce7f3', color: '#be185d' }}>
                <HeartHandshake size={16} />
              </div>
            </div>
            <div className={styles.ratingValue}>
              {effectiveRatingPerilaku === 'di_atas' && 'Di Atas Ekspektasi'}
              {effectiveRatingPerilaku === 'sesuai' && 'Sesuai Ekspektasi'}
              {effectiveRatingPerilaku === 'di_bawah' && 'Di Bawah Ekspektasi'}
            </div>
            <p className={styles.ratingDetail}>
              Berdasarkan 7 nilai dasar BerAKHLAK dan kesepakatan ekspektasi khusus pimpinan.
            </p>
          </div>

          <div className={styles.ratingPillGroup}>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingPerilaku === 'di_bawah' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingPerilakuOverride('di_bawah')}
            >
              Di Bawah
            </button>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingPerilaku === 'sesuai' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingPerilakuOverride('sesuai')}
            >
              Sesuai
            </button>
            <button 
              className={`${styles.ratingPill} ${effectiveRatingPerilaku === 'di_atas' ? styles.ratingPillActive : ''}`}
              onClick={() => setRatingPerilakuOverride('di_atas')}
            >
              Di Atas
            </button>
          </div>
        </div>

        {/* Predikat Kinerja Akhir */}
        <div className={`${styles.predikatBox} ${predikatKinerja.class}`}>
          <div className={styles.predikatBadgeLabel}>Predikat Kinerja Pegawai</div>
          <div className={styles.predikatName}>{predikatKinerja.nama}</div>
          <div className={styles.predikatDesc}>{predikatKinerja.desc}</div>
        </div>
      </div>

      {/* TAB 1: MATRIKS KUADRAN 3X3 */}
      {activeTab === 'kuadran' && (
        <div className={styles.matrixSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h3 className={styles.sectionTitle}>
              <SlidersHorizontal size={18} color="#4f46e5" />
              Matriks Kuadran Kinerja Pegawai (3x3)
            </h3>
            {isOverrideActive && (
              <button 
                onClick={handleResetOverride} 
                style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={12} /> Reset ke Otomatis
              </button>
            )}
          </div>
          <p className={styles.sectionSubtitle}>
            Hasil penyelarasan Hasil Kerja × Perilaku Kerja ({periodLabel}) sesuai ketentuan Permen PANRB No. 6 Tahun 2022.
          </p>

          {/* Position Banner */}
          <div className={styles.positionBanner}>
            <div>
              <span>🎯 Posisi Anda Saat Ini: </span>
              <strong>
                Hasil Kerja: {effectiveRatingHasil === 'di_atas' ? 'Di Atas' : effectiveRatingHasil === 'sesuai' ? 'Sesuai' : 'Di Bawah'} × Perilaku: {effectiveRatingPerilaku === 'di_atas' ? 'Di Atas' : effectiveRatingPerilaku === 'sesuai' ? 'Sesuai' : 'Di Bawah'}
              </strong>
              <span> ➔ Predikat: </span>
              <strong style={{ color: '#4f46e5' }}>{predikatKinerja.nama}</strong>
            </div>
            <span className={styles.scrollHint}>👉 Geser matriks untuk melihat seluruh sel</span>
          </div>

          <div className={styles.matrixScrollWrapper}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th style={{ width: '130px', background: 'transparent' }}></th>
                  <th className={styles.thHeaderX}>Di Bawah Ekspektasi</th>
                  <th className={styles.thHeaderX}>Sesuai Ekspektasi</th>
                  <th className={styles.thHeaderX}>Di Atas Ekspektasi</th>
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Di Atas Ekspektasi */}
                <tr>
                  <td className={styles.thHeaderY}>Di Atas Ekspektasi</td>
                  
                  {/* (Di Atas, Di Bawah) -> KURANG */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'di_bawah' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#ffedd5', borderColor: '#fdba74' }}
                    onClick={() => { setRatingHasilOverride('di_atas'); setRatingPerilakuOverride('di_bawah'); }}
                  >
                    {effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'di_bawah' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#c2410c' }}>KURANG</div>
                    <div className={styles.cellSub}>Misconduct / Etika</div>
                  </td>

                  {/* (Di Atas, Sesuai) -> BAIK */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'sesuai' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#dcfce7', borderColor: '#86efac' }}
                    onClick={() => { setRatingHasilOverride('di_atas'); setRatingPerilakuOverride('sesuai'); }}
                  >
                    {effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'sesuai' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#15803d' }}>BAIK</div>
                    <div className={styles.cellSub}>Hasil Melampaui</div>
                  </td>

                  {/* (Di Atas, Di Atas) -> SANGAT BAIK */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'di_atas' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#bbf7d0', borderColor: '#4ade80' }}
                    onClick={() => { setRatingHasilOverride('di_atas'); setRatingPerilakuOverride('di_atas'); }}
                  >
                    {effectiveRatingHasil === 'di_atas' && effectiveRatingPerilaku === 'di_atas' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#166534' }}>SANGAT BAIK</div>
                    <div className={styles.cellSub}>Role Model ASN</div>
                  </td>
                </tr>

                {/* Row 2: Sesuai Ekspektasi */}
                <tr>
                  <td className={styles.thHeaderY}>Sesuai Ekspektasi</td>

                  {/* (Sesuai, Di Bawah) -> KURANG */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'di_bawah' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#ffedd5', borderColor: '#fdba74' }}
                    onClick={() => { setRatingHasilOverride('sesuai'); setRatingPerilakuOverride('di_bawah'); }}
                  >
                    {effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'di_bawah' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#c2410c' }}>KURANG</div>
                    <div className={styles.cellSub}>Perilaku Rendah</div>
                  </td>

                  {/* (Sesuai, Sesuai) -> BAIK */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'sesuai' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#dcfce7', borderColor: '#86efac' }}
                    onClick={() => { setRatingHasilOverride('sesuai'); setRatingPerilakuOverride('sesuai'); }}
                  >
                    {effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'sesuai' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#15803d' }}>BAIK</div>
                    <div className={styles.cellSub}>Target Terpenuhi</div>
                  </td>

                  {/* (Sesuai, Di Atas) -> BAIK */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'di_atas' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#dcfce7', borderColor: '#86efac' }}
                    onClick={() => { setRatingHasilOverride('sesuai'); setRatingPerilakuOverride('di_atas'); }}
                  >
                    {effectiveRatingHasil === 'sesuai' && effectiveRatingPerilaku === 'di_atas' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#15803d' }}>BAIK</div>
                    <div className={styles.cellSub}>Perilaku Teladan</div>
                  </td>
                </tr>

                {/* Row 3: Di Bawah Ekspektasi */}
                <tr>
                  <td className={styles.thHeaderY}>Di Bawah Ekspektasi</td>

                  {/* (Di Bawah, Di Bawah) -> SANGAT KURANG */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'di_bawah' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#fee2e2', borderColor: '#fca5a5' }}
                    onClick={() => { setRatingHasilOverride('di_bawah'); setRatingPerilakuOverride('di_bawah'); }}
                  >
                    {effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'di_bawah' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#991b1b' }}>SANGAT KURANG</div>
                    <div className={styles.cellSub}>Tindakan Korektif</div>
                  </td>

                  {/* (Di Bawah, Sesuai) -> BUTUH PERBAIKAN */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'sesuai' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#fef3c7', borderColor: '#fcd34d' }}
                    onClick={() => { setRatingHasilOverride('di_bawah'); setRatingPerilakuOverride('sesuai'); }}
                  >
                    {effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'sesuai' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#92400e' }}>BUTUH PERBAIKAN</div>
                    <div className={styles.cellSub}>Coaching / Bimbingan</div>
                  </td>

                  {/* (Di Bawah, Di Atas) -> BUTUH PERBAIKAN */}
                  <td 
                    className={`${styles.matrixCell} ${effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'di_atas' ? styles.matrixCellActive : ''}`}
                    style={{ background: '#fef3c7', borderColor: '#fcd34d' }}
                    onClick={() => { setRatingHasilOverride('di_bawah'); setRatingPerilakuOverride('di_atas'); }}
                  >
                    {effectiveRatingHasil === 'di_bawah' && effectiveRatingPerilaku === 'di_atas' && <span className={styles.activePin}>POSISI ANDA</span>}
                    <div className={styles.cellTitle} style={{ color: '#92400e' }}>BUTUH PERBAIKAN</div>
                    <div className={styles.cellSub}>Peningkatan Kapasitas</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
            💡 <em>Tip: Anda dapat mengetuk kotak sel mana saja untuk mensimulasikan perubahan posisi predikat kinerja secara instan.</em>
          </div>
        </div>
      )}

      {/* TAB 2: EVALUASI PERILAKU BERAKHLAK */}
      {activeTab === 'perilaku' && (
        <div className={styles.berakhlakList}>
          {BERAKHLAK_STANDARDS.map((val) => {
            const current = berakhlakData[val.id] || {};
            return (
              <div key={val.id} className={styles.berakhlakItem}>
                <div className={styles.berakhlakHeader}>
                  <div className={styles.coreValueTitle}>
                    <div 
                      className={styles.coreValueIcon}
                      style={{ background: val.bg, color: val.warna }}
                    >
                      {val.kode}
                    </div>
                    <div>
                      <div className={styles.coreValueName}>{val.nama}</div>
                      <div className={styles.coreValueGuide}>{val.panduan}</div>
                    </div>
                  </div>

                  <div className={styles.ratingSelectGroup}>
                    <button
                      className={`${styles.ratingPill} ${current.rating === 'di_bawah' ? styles.ratingPillActive : ''}`}
                      onClick={() => handleBerakhlakChange(val.id, 'rating', 'di_bawah')}
                    >
                      Di Bawah
                    </button>
                    <button
                      className={`${styles.ratingPill} ${current.rating === 'sesuai' ? styles.ratingPillActive : ''}`}
                      onClick={() => handleBerakhlakChange(val.id, 'rating', 'sesuai')}
                    >
                      Sesuai
                    </button>
                    <button
                      className={`${styles.ratingPill} ${current.rating === 'di_atas' ? styles.ratingPillActive : ''}`}
                      onClick={() => handleBerakhlakChange(val.id, 'rating', 'di_atas')}
                    >
                      Di Atas
                    </button>
                  </div>
                </div>

                <div className={styles.berakhlakInputs}>
                  <div className={styles.inputGroup}>
                    <label>Ekspektasi Khusus Pimpinan:</label>
                    <textarea
                      className={styles.textInput}
                      value={current.ekspektasi || ''}
                      onChange={(e) => handleBerakhlakChange(val.id, 'ekspektasi', e.target.value)}
                      placeholder="Tuliskan ekspektasi pimpinan untuk perilaku ini..."
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Umpan Balik Berkala (Feedforward):</label>
                    <textarea
                      className={styles.textInput}
                      value={current.umpanBalik || ''}
                      onChange={(e) => handleBerakhlakChange(val.id, 'umpanBalik', e.target.value)}
                      placeholder="Tuliskan umpan balik/apresiasi/arahan perbaikan..."
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: CAPAIAN HASIL KERJA SKP */}
      {activeTab === 'hasil' && (
        <div>
          {/* Toolbar */}
          <div className={styles.tableToolbar}>
            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Cari butir SKP atau tim kerja..." 
                className={styles.searchInput}
                value={skpSearch}
                onChange={(e) => setSkpSearch(e.target.value)}
              />
            </div>

            <div className={styles.viewModeToggle}>
              <button 
                className={`${styles.viewModeBtn} ${skpViewMode === 'cards' ? styles.viewModeBtnActive : ''}`}
                onClick={() => setSkpViewMode('cards')}
                title="Tampilan Kartu (Nyaman di Smartphone)"
              >
                <LayoutGrid size={14} /> Kartu
              </button>
              <button 
                className={`${styles.viewModeBtn} ${skpViewMode === 'table' ? styles.viewModeBtnActive : ''}`}
                onClick={() => setSkpViewMode('table')}
                title="Tampilan Tabel Lengkap"
              >
                <List size={14} /> Tabel
              </button>
            </div>
          </div>

          {/* Mode 1: Kartu (Mobile First) */}
          {skpViewMode === 'cards' && (
            <div className={styles.skpCardGrid}>
              {filteredSkps.map((skp, idx) => {
                const targetQty = skp.indikator?.find(i => i.jenis === 'kuantitas')?.target || 100;
                const realisasiQty = skpRealizationMap[skp.id]?.totalQty || 0;
                const pct = Math.round((realisasiQty / targetQty) * 100);

                let statusBadge = <span className={`${styles.statusTag} ${styles.tagYellow}`}>Di Bawah</span>;
                let barColor = '#f59e0b';
                if (pct >= 100) {
                  statusBadge = <span className={`${styles.statusTag} ${styles.tagGreen}`}>Di Atas</span>;
                  barColor = '#10b981';
                } else if (pct >= 65) {
                  statusBadge = <span className={`${styles.statusTag} ${styles.tagBlue}`}>Sesuai</span>;
                  barColor = '#3b82f6';
                }

                return (
                  <div key={skp.id || idx} className={styles.skpCard}>
                    <div>
                      <div className={styles.skpCardHeader}>
                        <span className={styles.skpCardNo}>#{skp.id || idx + 1}</span>
                        {statusBadge}
                      </div>
                      <div className={styles.skpCardTitle}>{skp.nama}</div>
                      <div className={styles.skpMeta} style={{ marginTop: '8px' }}>
                        <span className={styles.metaBadge}>{skp.tim}</span>
                        <span className={styles.metaBadge}>{skp.cluster}</span>
                      </div>
                    </div>

                    <div className={styles.skpProgressSection}>
                      <div className={styles.progressLabelRow}>
                        <span>Realisasi: <strong>{realisasiQty}</strong> / {targetQty}</span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div className={styles.progressBarBg}>
                        <div 
                          className={styles.progressBarFill} 
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mode 2: Tabel Lengkap */}
          {skpViewMode === 'table' && (
            <div className={styles.tableCard}>
              <table className={styles.evalTable}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No</th>
                    <th>Rencana Hasil Kerja (RHK)</th>
                    <th>Tim Kerja & Klaster</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Target</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Realisasi</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Capaian</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkps.map((skp, idx) => {
                    const targetQty = skp.indikator?.find(i => i.jenis === 'kuantitas')?.target || 100;
                    const realisasiQty = skpRealizationMap[skp.id]?.totalQty || 0;
                    const pct = Math.round((realisasiQty / targetQty) * 100);

                    let statusBadge = <span className={`${styles.statusTag} ${styles.tagYellow}`}>Di Bawah</span>;
                    if (pct >= 100) {
                      statusBadge = <span className={`${styles.statusTag} ${styles.tagGreen}`}>Di Atas</span>;
                    } else if (pct >= 65) {
                      statusBadge = <span className={`${styles.statusTag} ${styles.tagBlue}`}>Sesuai</span>;
                    }

                    return (
                      <tr key={skp.id || idx}>
                        <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{skp.nama}</td>
                        <td>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{skp.tim}</div>
                          <div style={{ fontSize: '12px' }}>{skp.cluster}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{targetQty}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{realisasiQty}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: pct >= 100 ? '#166534' : pct >= 65 ? '#1e40af' : '#9a3412' }}>
                          {pct}%
                        </td>
                        <td style={{ textAlign: 'center' }}>{statusBadge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
