'use client';

import { useState, useEffect } from 'react';
import { useAlert } from '@/contexts/AlertContext';
import { Settings as SettingsIcon, Send, User, Bell, Shield } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [chatId, setChatId] = useState('');
  const [savedChatId, setSavedChatId] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('telegramChatId');
    if (saved) {
      setSavedChatId(saved);
      setChatId(saved);
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

      </div>
    </div>
  );
}
