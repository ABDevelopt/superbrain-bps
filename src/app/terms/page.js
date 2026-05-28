'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import styles from '../privacy/page.module.css'; // Reuse layout styles

export default function TermsPage() {
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
          <div className={styles.iconWrap} style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(34, 211, 238, 0.25)', boxShadow: '0 0 15px rgba(34, 211, 238, 0.15)' }}>
            <ClipboardList size={36} />
          </div>
          <h1 className={styles.title}>Syarat & Ketentuan</h1>
          <p className={styles.subtitle}>Terakhir diperbarui: 28 Mei 2026</p>
        </header>

        <main className={styles.content}>
          <section className={styles.section}>
            <h2>1. Penerimaan Ketentuan</h2>
            <p>
              Dengan mengakses dan menggunakan aplikasi <strong>SuperBrain — Second Brain BPS</strong>, Anda menyatakan bahwa Anda menyetujui, tunduk, dan terikat oleh Syarat dan Ketentuan Penggunaan ini. Jika Anda tidak menyetujui bagian mana pun dari ketentuan ini, Anda tidak diperkenankan menggunakan aplikasi ini.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Kelayakan Pengguna</h2>
            <p>
              Aplikasi ini disediakan khusus dan terbatas untuk keperluan produktivitas pegawai di lingkungan Badan Pusat Statistik (BPS). Anda bertanggung jawab penuh untuk menjaga kerahasiaan kredensial login Google Akun instansi Anda dan semua aktivitas yang dilakukan di bawah akun Anda.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Ketentuan Penggunaan Layanan Google</h2>
            <p>
              Aplikasi ini berintegrasi dengan layanan Google API (Google Drive dan Google Calendar). Penggunaan data yang diperoleh dari Google API akan mematuhi Kebijakan Data Pengguna Layanan Google API, termasuk persyaratan penggunaan terbatas.
            </p>
            <ul>
              <li>Anda bertanggung jawab atas semua file bukti dukung yang Anda unggah ke Google Drive pribadi Anda melalui aplikasi ini.</li>
              <li>Aplikasi tidak bertanggung jawab atas hilangnya atau modifikasi data secara manual yang Anda lakukan langsung pada Google Calendar atau Google Drive di luar aplikasi ini.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Penggunaan yang Dilarang</h2>
            <p>
              Anda setuju untuk tidak menggunakan aplikasi ini untuk:
            </p>
            <ul>
              <li>Mengunggah dokumen bukti dukung palsu atau file berbahaya (malware/virus) ke Google Drive.</li>
              <li>Mencoba merusak, mengganggu, atau memodifikasi integritas sistem database Firebase aplikasi.</li>
              <li>Menyalahgunakan fitur bot notifikasi Telegram untuk tujuan di luar kedinasan.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Batasan Tanggung Jawab</h2>
            <p>
              Aplikasi ini disediakan "sebagaimana adanya" (*as is*) tanpa jaminan dalam bentuk apa pun. Pengembang tidak bertanggung jawab atas kerugian tidak langsung, insidental, atau konsekuensial yang timbul dari ketidakmampuan Anda menggunakan aplikasi ini atau kegagalan koneksi API pihak ketiga (Google/Telegram).
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Perubahan Ketentuan</h2>
            <p>
              Kami dapat memperbarui Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan diumumkan di halaman ini dengan memperbarui tanggal "Terakhir diperbarui". Penggunaan aplikasi secara berkelanjutan setelah pembaruan menandakan persetujuan Anda terhadap ketentuan baru tersebut.
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
