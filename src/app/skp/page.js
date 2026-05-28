'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, Search, Inbox, Users, Folder } from 'lucide-react';
import { skpData } from '@/data/skpData';
import styles from './page.module.css';
import { useFirestore } from '@/hooks/useFirestore';

const STATUS_CONFIG = {
  selesai: { label: 'Selesai', class: styles.statusSelesai },
  progress: { label: 'Dalam Proses', class: styles.statusProgress },
  belum: { label: 'Belum Dimulai', class: styles.statusBelum },
  terlambat: { label: 'Terlambat', class: styles.statusTerlambat },
};

function getProgressClass(value) {
  if (value >= 80) return styles.progressHigh;
  if (value <= 30) return styles.progressLow;
  return null;
}

export default function SKPPage() {
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterTim, setFilterTim] = useState('semua');
  const [filterCluster, setFilterCluster] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');

  // Derive unique tim and cluster lists
  const timList = useMemo(
    () => [...new Set(skpData.map((item) => item.tim))].sort(),
    []
  );
  const clusterList = useMemo(
    () => [...new Set(skpData.map((item) => item.cluster))].sort(),
    []
  );

  const { docs: ckpDocs } = useFirestore('ckp');

  // Compute realization from CKP
  const realisasiMap = useMemo(() => {
    const map = {};
    ckpDocs.forEach(doc => {
      if (doc.skpId) {
        if (!map[doc.skpId]) map[doc.skpId] = 0;
        map[doc.skpId] += Number(doc.kuantitas) || 0;
      }
    });
    return map;
  }, [ckpDocs]);

  // Transform skpData to inject dynamic realisasi and status
  const dynamicSkpData = useMemo(() => {
    return skpData.map(item => {
      const kuantitasIndikator = item.indikator.find(i => i.jenis === 'kuantitas');
      const realisasiKuantitas = realisasiMap[item.id] || 0;
      
      const target = realisasiKuantitas > 0 ? realisasiKuantitas : 1;
      
      // Determine status based on realisasi
      let status = 'belum';
      if (realisasiKuantitas >= target) {
        status = 'selesai';
      } else if (realisasiKuantitas > 0) {
        status = 'progress';
      }

      return {
        ...item,
        status,
        indikator: item.indikator.map(i => {
          if (i.jenis === 'kuantitas') {
            return { ...i, realisasi: realisasiKuantitas, target: realisasiKuantitas > 0 ? realisasiKuantitas : 1 };
          }
          // For kualitas we keep the mock or logic can be added later
          return i;
        })
      };
    });
  }, [realisasiMap]);

  // Filtered data
  const filtered = useMemo(() => {
    return dynamicSkpData.filter((item) => {
      if (
        filterKategori !== 'semua' &&
        item.kategori !== filterKategori
      )
        return false;
      if (filterTim !== 'semua' && item.tim !== filterTim) return false;
      if (filterCluster !== 'semua' && item.cluster !== filterCluster)
        return false;
      if (filterStatus !== 'semua' && item.status !== filterStatus)
        return false;
      if (
        search.trim() &&
        !item.nama.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [search, filterKategori, filterTim, filterCluster, filterStatus, dynamicSkpData]);

  // Summary stats (always computed from full dynamic dataset)
  const stats = useMemo(() => {
    const counts = { total: dynamicSkpData.length, selesai: 0, progress: 0, belum: 0, terlambat: 0 };
    dynamicSkpData.forEach((item) => {
      if (counts[item.status] !== undefined) counts[item.status]++;
    });
    return counts;
  }, [dynamicSkpData]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title} style={{display: 'flex', alignItems: 'center', gap: '8px'}}><ClipboardList size={28} /> Sasaran Kinerja Pegawai</h1>
        <p className={styles.subtitle}>
          Periode: 1 Maret – 31 Desember 2026
        </p>
      </header>

      {/* Summary Stats */}
      <div className={styles.summaryRow}>
        <div className={`${styles.statCard} ${styles.statTotal}`}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total SKP</span>
        </div>
        <div className={`${styles.statCard} ${styles.statSelesai}`}>
          <span className={styles.statValue}>{stats.selesai}</span>
          <span className={styles.statLabel}>Selesai</span>
        </div>
        <div className={`${styles.statCard} ${styles.statProgress}`}>
          <span className={styles.statValue}>{stats.progress}</span>
          <span className={styles.statLabel}>Dalam Proses</span>
        </div>
        <div className={`${styles.statCard} ${styles.statBelum}`}>
          <span className={styles.statValue}>{stats.belum}</span>
          <span className={styles.statLabel}>Belum Dimulai</span>
        </div>
        <div className={`${styles.statCard} ${styles.statTerlambat}`}>
          <span className={styles.statValue}>{stats.terlambat}</span>
          <span className={styles.statLabel}>Terlambat</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}><Search size={18} /></span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari SKP berdasarkan nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.filterSelect}
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          aria-label="Filter Kategori"
        >
          <option value="semua">Semua Kategori</option>
          <option value="utama">Utama</option>
          <option value="tambahan">Tambahan</option>
        </select>

        <select
          className={styles.filterSelect}
          value={filterTim}
          onChange={(e) => setFilterTim(e.target.value)}
          aria-label="Filter Tim Kerja"
        >
          <option value="semua">Semua Tim</option>
          {timList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filterCluster}
          onChange={(e) => setFilterCluster(e.target.value)}
          aria-label="Filter Cluster"
        >
          <option value="semua">Semua Cluster</option>
          {clusterList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter Status"
        >
          <option value="semua">Semua Status</option>
          <option value="selesai">Selesai</option>
          <option value="progress">Dalam Proses</option>
          <option value="belum">Belum Dimulai</option>
          <option value="terlambat">Terlambat</option>
        </select>

        <span className={styles.resultCount}>
          {filtered.length} dari {skpData.length} item
        </span>
      </div>

      {/* Card List */}
      <div className={styles.cardList}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><Inbox size={48} /></div>
            <p className={styles.emptyText}>Tidak ada SKP ditemukan</p>
            <p className={styles.emptySubtext}>
              Coba ubah filter atau kata kunci pencarian
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const kuantitas = item.indikator.find(
              (i) => i.jenis === 'kuantitas'
            );
            const kualitas = item.indikator.find(
              (i) => i.jenis === 'kualitas'
            );
            const kuantitasPct = kuantitas
              ? Math.round((kuantitas.realisasi / kuantitas.target) * 100)
              : 0;
            const kualitasPct = kualitas
              ? Math.round((kualitas.realisasi / kualitas.target) * 100)
              : 0;
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.belum;

            return (
              <div key={item.id} className={styles.card}>
                {/* Top row: info + status */}
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <div className={styles.numberBadge}>{item.id}</div>
                    <div className={styles.cardInfo}>
                      <p className={styles.cardName}>{item.nama}</p>
                      <div className={styles.cardTags}>
                        <span
                          className={`${styles.categoryBadge} ${
                            item.kategori === 'utama'
                              ? styles.categoryUtama
                              : styles.categoryTambahan
                          }`}
                        >
                          {item.kategori}
                        </span>
                        <span className={styles.timTag}>
                          <span className={styles.tagIcon}><Users size={14} /></span>
                          {item.tim}
                        </span>
                        <span className={styles.clusterTag}>
                          <span className={styles.tagIcon}><Folder size={14} /></span>
                          {item.cluster}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${statusCfg.class}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Progress bars */}
                <div className={styles.progressSection}>
                  {/* Kuantitas */}
                  <div className={styles.progressItem}>
                    <div className={styles.progressHeader}>
                      <span className={styles.progressLabel}>Kuantitas</span>
                      <span className={styles.progressValue}>
                        {kuantitas ? kuantitas.realisasi : 0} tercatat
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressFill} ${styles.progressKuantitas}`}
                        style={{ width: kuantitas && kuantitas.realisasi > 0 ? '100%' : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Kualitas */}
                  <div className={styles.progressItem}>
                    <div className={styles.progressHeader}>
                      <span className={styles.progressLabel}>Kualitas</span>
                      <span className={styles.progressValue}>
                        {kualitas ? kualitas.realisasi : 0} / {kualitas ? kualitas.target : 100}
                        <span style={{ marginLeft: 6, opacity: 0.6, fontSize: '0.72rem' }}>
                          ({kualitasPct}%)
                        </span>
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={`${styles.progressFill} ${
                          getProgressClass(kualitasPct) || styles.progressKualitas
                        }`}
                        style={{ width: `${kualitasPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
