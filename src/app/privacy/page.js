'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.backBtnWrap}>
          <Link href="/login" className={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Kembali ke Login</span>
          </Link>
        </div>

        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <Shield size={36} />
          </div>
          <h1 className={styles.title}>Kebijakan Privasi</h1>
          <p className={styles.subtitle}>Terakhir diperbarui: 28 Mei 2026</p>
        </header>

        <main className={styles.content}>
          <section className={styles.section}>
            <h2>1. Pendahuluan</h2>
            <p>
              Aplikasi <strong>SuperBrain — Second Brain BPS</strong> menghormati privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi informasi Anda ketika Anda menggunakan aplikasi kami, terutama terkait integrasi dengan Google Auth, Google Drive, dan Google Calendar.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Informasi yang Kami Kumpulkan</h2>
            <p>
              Kami mengumpulkan informasi minimal yang diperlukan untuk menjalankan fungsionalitas aplikasi:
            </p>
            <ul>
              <li><strong>Informasi Profil Dasar:</strong> Nama lengkap, alamat email, dan URL foto profil Anda yang diperoleh dari akun Google Anda saat proses otentikasi.</li>
              <li><strong>Token Akses Google:</strong> Token keamanan sementara untuk menghubungkan aplikasi Anda ke Google Drive dan Google Calendar Anda.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Penggunaan Izin Khusus Google</h2>
            <p>
              Aplikasi kami meminta izin Google khusus (OAuth Scopes) untuk fungsionalitas inti berikut:
            </p>
            
            <div className={styles.scopeBox}>
              <h3>Google Drive API (<code>.../auth/drive.file</code>)</h3>
              <p>
                Digunakan secara eksklusif untuk memungkinkan Anda mengambil foto ber-geotag koordinat dan mengunggah dokumen bukti dukung kegiatan (seperti PDF atau Word) langsung ke folder Google Drive pribadi Anda dari menu Capaian Kinerja Harian (CKP). Aplikasi ini hanya memiliki akses ke file yang dibuat sendiri oleh aplikasi ini, dan tidak dapat membaca atau memodifikasi file lain di Google Drive Anda.
              </p>
            </div>

            <div className={styles.scopeBox}>
              <h3>Google Calendar API (<code>.../auth/calendar.events</code>)</h3>
              <p>
                Digunakan untuk menyinkronkan jadwal penting, jadwal pelatihan, rapat koordinasi, serta deadline publikasi dari aplikasi SuperBrain langsung ke Google Calendar pribadi Anda sehingga Anda mendapatkan pengingat yang terintegrasi.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h2>4. Penyimpanan dan Keamanan Data</h2>
            <p>
              Kami tidak menyimpan file atau dokumen Anda di server pihak ketiga mana pun. Semua dokumen bukti dukung dan foto geotag Anda diunggah langsung ke penyimpanan Google Drive pribadi Anda. Informasi log kinerja dan profil dasar disimpan dengan aman di database Firebase terenkripsi yang dikonfigurasi khusus untuk aplikasi internal BPS.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Pembagian Data Pihak Ketiga</h2>
            <p>
              Kami tidak menjual, memperdagangkan, atau membagikan data pribadi Anda kepada pihak luar. Data Anda murni digunakan untuk kepentingan dokumentasi Sasaran Kinerja Pegawai (SKP) dan Capaian Kinerja Harian (CKP) internal Anda.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Kontak Kami</h2>
            <p>
              Jika Anda memiliki pertanyaan mengenai Kebijakan Privasi ini, Anda dapat menghubungi tim pengembang internal BPS melalui saluran koordinasi resmi.
            </p>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>&copy; 2026 SuperBrain BPS. Seluruh hak cipta dilindungi.</p>
        </footer>
      </div>
    </div>
  );
}
