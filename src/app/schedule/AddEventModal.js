'use client';

import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { skpData } from '@/data/skpData';
import styles from './page.module.css';

const KATEGORI = ['Deadline', 'Rapat', 'Survei', 'Pelatihan', 'Lainnya'];
const REMINDER_OPTIONS = ['H-3', 'H-1', '1 Jam Sebelum', '5 Menit Sebelum'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddEventModal({ isOpen, onClose, onSubmit, initialData, onUpdate }) {
  const [form, setForm] = useState({
    judul: '',
    tanggal: toDateStr(new Date()),
    waktu: '09:00',
    kategori: 'Lainnya',
    skpId: '',
    reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
    deskripsi: '',
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        judul: initialData.judul || '',
        tanggal: initialData.tanggal || toDateStr(new Date()),
        waktu: initialData.waktu || '09:00',
        kategori: initialData.kategori || 'Lainnya',
        skpId: initialData.skpId ? String(initialData.skpId) : '',
        reminders: initialData.reminders || [],
        deskripsi: initialData.deskripsi || '',
      });
    } else {
      setForm({
        judul: '',
        tanggal: toDateStr(new Date()),
        waktu: '09:00',
        kategori: 'Lainnya',
        skpId: '',
        reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
        deskripsi: '',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleReminderToggle = (r) => {
    setForm((prev) => {
      const isSelected = prev.reminders.includes(r);
      const newReminders = isSelected 
        ? prev.reminders.filter(x => x !== r)
        : [...prev.reminders, r];
      return { ...prev, reminders: newReminders };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.judul || !form.tanggal) return;
    
    const dataToSave = {
      ...form,
      skpId: form.skpId ? Number(form.skpId) : null,
      sentReminders: initialData ? initialData.sentReminders || [] : [],
      gcalEventId: initialData ? initialData.gcalEventId : null,
      isGCal: initialData ? initialData.isGCal : false,
    };

    if (initialData && onUpdate) {
      onUpdate(initialData.id, dataToSave);
    } else {
      onSubmit(dataToSave);
    }
    
    setForm({
      judul: '',
      tanggal: toDateStr(new Date()),
      waktu: '09:00',
      kategori: 'Lainnya',
      skpId: '',
      reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
      deskripsi: '',
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{initialData ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}</h3>
          <button className={styles.modalClose} type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Judul</label>
            <input
              type="text"
              className={styles.input}
              value={form.judul}
              onChange={handleChange('judul')}
              placeholder="Nama kegiatan / event"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tanggal</label>
              <input
                type="date"
                className={styles.input}
                value={form.tanggal}
                onChange={handleChange('tanggal')}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Waktu</label>
              <input
                type="time"
                className={styles.input}
                value={form.waktu}
                onChange={handleChange('waktu')}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Kategori</label>
              <select className={styles.select} value={form.kategori} onChange={handleChange('kategori')}>
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{flex: 1}}>
              <label className={styles.label}>Pengingat Berulang</label>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px'}}>
                {REMINDER_OPTIONS.map((r) => (
                  <label key={r} style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)'}}>
                    <input 
                      type="checkbox" 
                      checked={form.reminders.includes(r)}
                      onChange={() => handleReminderToggle(r)}
                      style={{accentColor: '#38bdf8'}}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Butir SKP Terkait</label>
            <select className={styles.select} value={form.skpId} onChange={handleChange('skpId')}>
              <option value="">— Tidak terkait SKP —</option>
              {skpData.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}. {item.nama}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Deskripsi</label>
            <textarea
              className={styles.textarea}
              value={form.deskripsi}
              onChange={handleChange('deskripsi')}
              placeholder="Detail kegiatan..."
              rows={3}
            />
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Calendar size={18} /> {initialData ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
