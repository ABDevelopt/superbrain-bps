'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle({ showLabel = false, className = '' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${styles.toggleBtn} ${className}`}
      title={theme === 'dark' ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
      aria-label={theme === 'dark' ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
    >
      <span className={styles.iconWrapper}>
        {theme === 'dark' ? (
          <Sun size={18} className={styles.sunIcon} />
        ) : (
          <Moon size={18} className={styles.moonIcon} />
        )}
      </span>
      {showLabel && (
        <span className={styles.label}>
          {theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}
        </span>
      )}
    </button>
  );
}
