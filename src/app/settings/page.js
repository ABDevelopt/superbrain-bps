'use client';

import { useState, useEffect } from 'react';
import { useAlert } from '@/contexts/AlertContext';
import { Settings as SettingsIcon, Send, User, Bell, Shield, LogOut, Database, Cloud, UploadCloud, DownloadCloud } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { exportToJSON, createCloudSnapshot, restoreFromCloudSnapshot, restoreFromBackupData } from '@/lib/backupService';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [chatId, setChatId] = useState('');
  const [savedChatId, setSavedChatId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastCloudBackup, setLastCloudBackup] = useState('Belum pernah');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('telegramChatId');
    if (saved) {
      setSavedChatId(saved);
      setChatId(saved);
    }
    
    const lastBackup = localStorage.getItem('last_cloud_backup');
    if (lastBackup) {
      setLastCloudBackup(new Date(lastBackup).toLocaleString('id-ID'));
    }
  }, []);

  const handleSaveChatId = () => {
    if (chatId.trim()) {
      localStorage.setItem('telegramChatId', chatId.trim());
      setSavedChatId(chatId.trim());
      showAlert('Chat ID berhasil disimpan! Notifikasi Telegram sudah aktif.');
    } else {
      localStorage.removeItem('telegramChatId');
      setSavedChatId('');
      showAlert('Integrasi Telegram dimatikan.');
    }
  };

  const handleTestNotification = async () => {
    if (!savedChatId) {
      showAlert('Silakan masukkan dan simpan Chat ID terlebih dahulu!');
      return;
    }
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: savedChatId, 
          message: `*Halo ${user?.displayName?.split(' ')[0] || 'Pengguna'}!*\nIni adalah pesan uji coba dari sistem *SuperBrain BPS*.\n\nJika Anda menerima pesan ini, artinya integrasi Telegram Anda sudah berjalan 100% dengan sempurna!` 
        }),
      });
      if (res.ok) {
        showAlert('Pesan tes berhasil dikirim! Silakan cek Telegram Anda.');
      } else {
        const data = await res.json();
        showAlert('Gagal mengirim pesan. Error: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      showAlert('Gagal mengirim pesan: ' + e.message);
    }
  };

  const handleBackupLokal = async () => {
    try {
      setIsBackingUp(true);
      await exportToJSON();
      showAlert('Data (Jadwal, CKP, SKP, Tugas) berhasil di-export ke JSON!');
    } catch (err) {
      showAlert('Gagal backup lokal: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreLokal = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('Peringatan: Proses ini akan menyisipkan/menggantikan data yang ada. Lanjutkan?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsBackingUp(true);
        const data = JSON.parse(event.target.result);
        await restoreFromBackupData(data);
        showAlert('Data berhasil dipulihkan dari file JSON!');
      } catch (err) {
        showAlert('Gagal memulihkan: ' + err.message);
      } finally {
        setIsBackingUp(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleBackupCloud = async () => {
    try {
      setIsBackingUp(true);
      await createCloudSnapshot();
      setLastCloudBackup(new Date().toLocaleString('id-ID'));
      showAlert('Snapshot berhasil disimpan ke Firestore (Cloud)!');
    } catch (err) {
      showAlert('Gagal backup cloud: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreCloud = async () => {
    if (!confirm('Peringatan: Ini akan mengembalikan seluruh data Anda ke snapshot terakhir di cloud. Lanjutkan?')) return;
    try {
      setIsBackingUp(true);
      await restoreFromCloudSnapshot();
      showAlert('Data berhasil dipulihkan dari Cloud Snapshot!');
    } catch (err) {
      showAlert('Gagal memulihkan dari Cloud: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>
          <SettingsIcon size={28} className={styles.titleIcon} />
          Pengaturan
        </h1>
        <p className={styles.pageSubtitle}>
          Kelola preferensi akun, integrasi, dan notifikasi aplikasi Anda
        </p>
      </header>

      <div className={styles.layout}>
        {/* Profile Card */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <User size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Profil Pengguna</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.profileRow}>
              <div className={styles.avatarCircle}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" style={{width: '100%', height: '100%', borderRadius: '50%'}} />
                ) : (
                  user?.displayName?.substring(0, 2).toUpperCase() || 'YA'
                )}
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.profileName}>{user?.displayName || 'Yahya Abdurrohman'}</div>
                <div className={styles.profileEmail}>{user?.email || 'yahya@bps.go.id'}</div>
                <div className={styles.profileRole}>BPS Kab. Penajam Paser Utara</div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations Card */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <Bell size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Notifikasi & Integrasi</h2>
          </div>
          <div className={styles.card}>
            
            {/* Telegram Integration */}
            <div className={styles.integrationItem}>
              <div className={styles.integrationHeader}>
                <div className={styles.integrationIconWrap} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                  <Send size={24} />
                </div>
                <div className={styles.integrationTexts}>
                  <h3 className={styles.integrationTitle}>Bot Telegram</h3>
                  <p className={styles.integrationDesc}>
                    Dapatkan notifikasi pengingat jadwal dan laporan harian secara otomatis. Cari bot <strong>@userinfobot</strong> di Telegram untuk melihat Chat ID Anda.
                  </p>
                </div>
              </div>
              
              <div className={styles.integrationAction}>
                <input 
                  type="text" 
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Masukkan Chat ID Anda" 
                  className={styles.input}
                />
                <button 
                  onClick={handleSaveChatId}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {savedChatId ? 'Update' : 'Simpan'}
                </button>
                {savedChatId && (
                  <button 
                    onClick={handleTestNotification}
                    className={`${styles.btn} ${styles.btnSuccess}`}
                  >
                    Tes Pesan
                  </button>
                )}
              </div>
              {savedChatId && (
                <div className={styles.successMsg}>
                  ✓ Telegram bot sudah terhubung ke ID: {savedChatId}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* Manajemen & Backup Data Card */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <Database size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Manajemen & Backup Data</h2>
          </div>
          <div className={styles.card}>
            
            {/* Backup Lokal */}
            <div className={styles.integrationItem} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '24px' }}>
              <div className={styles.integrationHeader}>
                <div className={styles.integrationIconWrap} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <Database size={24} />
                </div>
                <div className={styles.integrationTexts}>
                  <h3 className={styles.integrationTitle}>Backup Offline (JSON)</h3>
                  <p className={styles.integrationDesc}>
                    Unduh salinan data (CKP, Tugas, Jadwal, SKP) ke perangkat Anda sebagai file JSON, atau pulihkan data dari file.
                  </p>
                </div>
              </div>
              <div className={styles.backupControls} style={{ marginLeft: '64px' }}>
                <button onClick={handleBackupLokal} disabled={isBackingUp} className={`${styles.btn} ${styles.btnOutline}`}>
                  <DownloadCloud size={16} style={{display:'inline', marginRight:'6px', verticalAlign:'text-bottom'}}/> 
                  Unduh File
                </button>
                <label className={`${styles.btn} ${styles.btnPrimary}`} style={{ cursor: 'pointer' }}>
                  <UploadCloud size={16} style={{display:'inline', marginRight:'6px', verticalAlign:'text-bottom'}}/>
                  Pulihkan
                  <input type="file" accept=".json" onChange={handleRestoreLokal} style={{ display: 'none' }} disabled={isBackingUp} />
                </label>
              </div>
            </div>

            {/* Backup Cloud */}
            <div className={styles.integrationItem} style={{ marginTop: '24px' }}>
              <div className={styles.integrationHeader}>
                <div className={styles.integrationIconWrap} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                  <Cloud size={24} />
                </div>
                <div className={styles.integrationTexts}>
                  <h3 className={styles.integrationTitle}>Cloud Snapshot</h3>
                  <p className={styles.integrationDesc}>
                    Simpan snapshot seluruh data secara instan ke Cloud Firestore. Data lama akan tertimpa (hanya menyimpan 1 snapshot terbaru).
                  </p>
                  <p className={styles.successMsg} style={{ marginLeft: 0, marginTop: '4px', fontSize: '12px' }}>
                    Backup terakhir: {lastCloudBackup}
                  </p>
                </div>
              </div>
              <div className={styles.backupControls} style={{ marginLeft: '64px' }}>
                <button onClick={handleBackupCloud} disabled={isBackingUp} className={`${styles.btn} ${styles.btnSuccess}`}>
                  Buat Snapshot
                </button>
                <button onClick={handleRestoreCloud} disabled={isBackingUp} className={`${styles.btn} ${styles.btnWarning}`}>
                  Pulihkan dari Cloud
                </button>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Logout Section - Mobile Only */}
      <div className={styles.mobileLogoutSection}>
        <button onClick={logout} className={styles.logoutBtn}>
          <LogOut size={18} />
          <span>Keluar Aplikasi</span>
        </button>
      </div>
    </div>
  );
}
