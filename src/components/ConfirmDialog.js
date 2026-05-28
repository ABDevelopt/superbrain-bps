'use client';

import { X, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({ 
  isOpen, 
  title = "Konfirmasi", 
  message = "Apakah Anda yakin?", 
  confirmText = "Ya", 
  cancelText = "Batal", 
  onConfirm, 
  onCancel,
  variant = "danger" // "danger" or "primary"
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={24} className={variant === 'danger' ? styles.iconDanger : styles.iconPrimary} />
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={variant === 'danger' ? styles.confirmDangerBtn : styles.confirmPrimaryBtn} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
