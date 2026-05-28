'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { LogIn, AlertCircle } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';

export default function LoginPage() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      // Router will handle redirect via useEffect
    } catch (err) {
      setError(err.message || 'Gagal login. Silakan coba lagi.');
      setIsLoggingIn(false);
    }
  };

  if (loading || user) {
    return <LoadingScreen message="Menyiapkan Sesi..." />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🧠 SuperBrain</div>
        <h1 className={styles.title}>Selamat Datang</h1>
        <p className={styles.subtitle}>
          Silakan masuk menggunakan akun Google Anda untuk mengakses manajemen kinerja BPS.
        </p>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button 
          className={styles.loginBtn} 
          onClick={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <div className={styles.spinnerSmall}></div>
          ) : (
            <LogIn size={20} />
          )}
          <span>{isLoggingIn ? 'Memproses...' : 'Login dengan Google'}</span>
        </button>

        <p className={styles.footer}>
          Pastikan Anda sudah menyetujui izin Google Drive jika diminta, agar fitur unggah file dapat berfungsi.
        </p>

        <div className={styles.legalLinks}>
          <Link href="/privacy" className={styles.legalLink}>Kebijakan Privasi</Link>
          <span className={styles.legalDivider}>&bull;</span>
          <Link href="/terms" className={styles.legalLink}>Syarat & Ketentuan</Link>
        </div>
      </div>
    </div>
  );
}
