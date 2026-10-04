'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  HelpCircle,
  FileCode2,
  Sparkles
} from 'lucide-react';
import styles from './KipappSyncModal.module.css';

export default function KipappSyncModal({ 
  isOpen, 
  onClose, 
  monthEntries = [], 
  monthName = '', 
  year = 2026,
  skpList = [] 
}) {
  const [extensionStatus, setExtensionStatus] = useState({ checked: false, connected: false, data: null });
  const [manualToken, setManualToken] = useState('');
  const [autoKirim, setAutoKirim] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Ping companion extension via window message
  const checkExtension = () => {
    window.postMessage({ source: 'SUPERBRAIN_WEB', action: 'PING', requestId: Date.now() }, '*');
  };

  useEffect(() => {
    if (!isOpen) return;

    // Reset results on open
    setSyncResult(null);
    setErrorMsg(null);

    const handleMessage = (e) => {
      if (e.source !== window || !e.data || e.data.source !== 'SUPERBRAIN_EXTENSION') return;

      if (e.data.action === 'PONG') {
        const data = e.data.data;
        setExtensionStatus({
          checked: true,
          connected: Boolean(data?.connected),
          data
        });
      }

      if (e.data.action === 'SYNC_KEGIATAN_RESPONSE') {
        setIsSyncing(false);
        if (e.data.success) {
          setSyncResult(e.data.results);
        } else {
          setErrorMsg(e.data.error || 'Gagal menyinkronkan kegiatan ke KIPAPP');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    checkExtension();

    // Timeout if no extension responds
    const timer = setTimeout(() => {
      setExtensionStatus(prev => prev.checked ? prev : { checked: true, connected: false, data: null });
    }, 1200);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Format valid entries to KIPAPP format
  const validActivities = monthEntries.map(e => {
    const sid = Array.isArray(e.skpIds) && e.skpIds.length > 0 ? e.skpIds[0] : (e.skpId || 1);
    return {
      id: e.id,
      skpId: sid,
      rkId: sid,
      rincian: e.rincian,
      tanggal: e.tanggal,
      kuantitas: e.kuantitas || 1,
      satuan: e.satuan || 'Kegiatan',
      capaian: `${e.kuantitas || 1} ${e.satuan || 'Kegiatan'}`,
      driveUrl: e.driveUrl || e.buktiDukungUrl || '',
      progres: 100
    };
  });

  // Action: Export JSON Batch
  const handleExportJSON = () => {
    const payload = validActivities.map(act => ({
      skpid: act.skpId,
      rkid: act.rkId,
      kegiatan: act.rincian,
      tanggal: act.tanggal,
      tanggalselesai: act.tanggal,
      progres: 100,
      capaian: act.capaian,
      datadukung: act.driveUrl || '-',
      iscapaianskp: true
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KIPAPP_Batch_${monthName}_${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Action: Start Synchronization
  const handleStartSync = async () => {
    setErrorMsg(null);
    setSyncResult(null);
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: validActivities.length });

    // Method A: Via Extension
    if (extensionStatus.connected) {
      window.postMessage({
        source: 'SUPERBRAIN_WEB',
        action: 'SYNC_KEGIATAN',
        requestId: Date.now(),
        payload: {
          activities: validActivities,
          autoKirim
        }
      }, '*');
      return;
    }

    // Method B: Via Manual Token
    if (manualToken.trim()) {
      try {
        const cleanToken = manualToken.trim().replace(/^Bearer\s+/i, '');
        const results = { total: validActivities.length, successCount: 0, failedCount: 0, errors: [] };

        for (let i = 0; i < validActivities.length; i++) {
          const act = validActivities[i];
          setSyncProgress({ current: i + 1, total: validActivities.length });

          const payloadKegiatan = {
            skpid: act.skpId,
            rkid: act.rkId,
            kegiatan: act.rincian,
            tanggal: act.tanggal,
            tanggalselesai: act.tanggal,
            progres: 100,
            capaian: act.capaian,
            datadukung: act.driveUrl || '-',
            iscapaianskp: true
          };

          const res = await fetch('https://kipapp.bps.go.id/api/v1/kegiatan', {
            method: 'POST',
            headers: {
              'x-auth': `Bearer ${cleanToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadKegiatan)
          });

          if (res.ok) {
            results.successCount++;
          } else {
            const errTxt = await res.text();
            results.failedCount++;
            results.errors.push({ id: act.id, date: act.tanggal, title: act.rincian, error: errTxt });
          }

          await new Promise(r => setTimeout(r, 200));
        }

        setIsSyncing(false);
        setSyncResult(results);
      } catch (err) {
        setIsSyncing(false);
        setErrorMsg(`Gagal koneksi ke KIPAPP: ${err.message}. Pastikan izin CORS browser atau gunakan SuperBrain Extension.`);
      }
      return;
    }

    setIsSyncing(false);
    setErrorMsg('Silakan gunakan Ekstensi SuperBrain Companion atau masukkan Token KIPAPP.');
  };

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !isSyncing) onClose(); }}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitle}>
            <Send size={20} color="#4f46e5" />
            <div>
              <h3>Sinkronisasi KIPAPP BPS</h3>
            </div>
            <span className={styles.badgeBps}>Permen PANRB 6/2022</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSyncing}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Status Extension */}
          {extensionStatus.connected ? (
            <div className={`${styles.statusCard} ${styles.statusConnected}`}>
              <div className={styles.statusInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#166534" />
                  <h4>Ekstensi SuperBrain Terhubung</h4>
                </div>
                <p>
                  Sesi login aktif: <strong>{extensionStatus.data?.pegawaiName || 'Yahya Abdurrohman'}</strong>
                  {extensionStatus.data?.nip && ` (NIP: ${extensionStatus.data.nip})`}
                </p>
              </div>
              <button className={styles.statusActionBtn} onClick={checkExtension}>
                <RefreshCw size={12} style={{ marginRight: '4px' }} /> Periksa Ulang
              </button>
            </div>
          ) : (
            <div className={`${styles.statusCard} ${styles.statusDisconnected}`}>
              <div className={styles.statusInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} color="#92400e" />
                  <h4>Ekstensi Belum Terhubung</h4>
                </div>
                <p>
                  Ekstensi Chrome/Edge SuperBrain Companion belum terdeteksi aktif pada browser ini.
                </p>
              </div>
              <button 
                className={styles.statusActionBtn}
                onClick={() => window.open('https://kipapp.bps.go.id/#/home', '_blank')}
              >
                Buka KIPAPP <ExternalLink size={12} style={{ marginLeft: '4px' }} />
              </button>
            </div>
          )}

          {/* Overview Periode */}
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statItemVal}>{validActivities.length}</div>
              <div className={styles.statItemLabel}>Total Kegiatan {monthName}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statItemVal}>100%</div>
              <div className={styles.statItemLabel}>Target Progres</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statItemVal}>{skpList.length || 29}</div>
              <div className={styles.statItemLabel}>Butir SKP Pemetaan</div>
            </div>
          </div>

          {/* Token Direct Input (Fallback jika belum ada ekstensi) */}
          {!extensionStatus.connected && (
            <div className={styles.tokenBox}>
              <label>Token Sesi KIPAPP (Alternatif Manual):</label>
              <input
                type="password"
                className={styles.tokenInput}
                placeholder="Tempelkan nilai token 'Bearer eyJhbGciOi...' dari kipapp.bps.go.id"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                💡 <em>Tip: Pasang folder <code>extension/</code> pada <code>chrome://extensions</code> untuk login otomatis tanpa perlu menyalin token.</em>
              </div>
            </div>
          )}

          {/* Option: Langsung kirim ke penilai */}
          <label className={styles.optionRow}>
            <input 
              type="checkbox" 
              checked={autoKirim} 
              onChange={(e) => setAutoKirim(e.target.checked)} 
            />
            <span>Langsung kirimkan ke Penilai/Ketua Tim setelah berhasil disimpan di KIPAPP.</span>
          </label>

          {/* Sync Progress & Results */}
          {isSyncing && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                <span>Mengirim kegiatan ke portal KIPAPP BPS...</span>
                <span>{syncProgress.current} / {syncProgress.total}</span>
              </div>
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }} 
                />
              </div>
            </div>
          )}

          {syncResult && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ color: '#166534', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Sinkronisasi Selesai!
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                Berhasil mengirim <strong>{syncResult.successCount}</strong> dari {syncResult.total} kegiatan ke KIPAPP BPS.
                {syncResult.failedCount > 0 && ` (${syncResult.failedCount} gagal).`}
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#991b1b', fontSize: '13px' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> Kendala Pengiriman
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={handleExportJSON} title="Unduh berkas JSON format KIPAPP">
            <FileCode2 size={16} /> Ekspor JSON KIPAPP
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className={styles.btnSecondary} onClick={onClose} disabled={isSyncing}>
              Tutup
            </button>
            <button 
              className={styles.btnPrimary} 
              onClick={handleStartSync} 
              disabled={isSyncing || validActivities.length === 0}
            >
              <Send size={15} />
              {isSyncing ? 'Menyinkronkan...' : `Kirim ${validActivities.length} Kegiatan ke KIPAPP`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
