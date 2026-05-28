'use client';

import React, { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import styles from './LoadingScreen.module.css';

const LOGS = [
  'Menghubungkan sinapsis...',
  'Menyelaraskan data SKP...',
  'Mengindeks memori...',
  'Menyusun struktur dasbor...',
  'Sinkronisasi Google Drive...',
  'Memuat visualisasi grafis...',
  'Mengamankan enkripsi sesi...',
  'Mempersiapkan ruang kerja...'
];

export default function LoadingScreen({ inline = false, message = '' }) {
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (inline) return;
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % LOGS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [inline]);

  return (
    <div className={inline ? styles.containerInline : styles.containerFullscreen}>
      <div className={styles.loaderBox}>
        {/* Glow Aura */}
        <div className={styles.glowAura} />
        
        {/* Outer dashed spinning ring */}
        <div className={styles.outerRing} />
        
        {/* Middle gradient flowing ring */}
        <div className={styles.middleRing} />
        
        {/* Inner glassmorphic core with pulsing brain SVG */}
        <div className={styles.core}>
          <Brain className={styles.logoIcon} size={32} />
        </div>
      </div>
      
      <div className={styles.textWrapper}>
        <h3 className={styles.title}>{message || 'SuperBrain'}</h3>
        {!inline && <p className={styles.logText}>{LOGS[logIndex]}</p>}
      </div>
    </div>
  );
}
