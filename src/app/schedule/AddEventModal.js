'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Calendar, MapPin, AlertTriangle, Plus, FileText, ChevronDown } from 'lucide-react';
import { skpData } from '@/data/skpData';
import styles from './page.module.css';

const KATEGORI = ['Deadline', 'Rapat', 'Survei', 'Pelatihan', 'Upacara/Apel', 'Teknis', 'Lainnya'];
const REMINDER_OPTIONS = ['H-3', 'H-1', '1 Jam Sebelum', '5 Menit Sebelum'];
export const URGENSI_OPTIONS = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];
export const URGENSI_COLORS = {
  Rendah:  { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  text: '#10b981', dot: '#10b981' },
  Sedang:  { bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.4)',   text: '#eab308', dot: '#eab308' },
  Tinggi:  { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  text: '#f97316', dot: '#f97316' },
  Kritis:  { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#ef4444', dot: '#ef4444' },
};

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AddEventModal({ isOpen, onClose, onSubmit, initialData, onUpdate, skpData }) {
  const emptyForm = {
    judul: '',
    tanggal: toDateStr(new Date()),
    waktu: '09:00',
    waktuSelesai: '',
    kategori: 'Lainnya',
    urgensi: 'Sedang',
    lokasi: '',
    skpId: '',
    reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
    deskripsi: '',
    attachments: [],
  };

  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [showSkpDropdown, setShowSkpDropdown] = useState(false);
  const [skpSearch, setSkpSearch] = useState('');
  const skpDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (skpDropdownRef.current && !skpDropdownRef.current.contains(event.target)) {
        setShowSkpDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFiles([]);
      setShowSkpDropdown(false);
      setSkpSearch('');
      if (initialData) {
        setForm({
          judul: initialData.judul || '',
          tanggal: initialData.tanggal || toDateStr(new Date()),
          waktu: initialData.waktu || '09:00',
          waktuSelesai: initialData.waktuSelesai || '',
          kategori: initialData.kategori || 'Lainnya',
          urgensi: initialData.urgensi || 'Sedang',
          lokasi: initialData.lokasi || '',
          skpId: initialData.skpId ? String(initialData.skpId) : '',
          reminders: initialData.reminders || [],
          deskripsi: initialData.deskripsi || '',
          attachments: initialData.attachments || [],
        });
      } else {
        setForm(emptyForm);
      }
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
      sentReminders: (initialData && initialData.sentReminders) ? initialData.sentReminders : [],
      gcalEventId: (initialData && initialData.gcalEventId) ? initialData.gcalEventId : null,
      isGCal: (initialData && initialData.isGCal) ? initialData.isGCal : false,
      linkedTaskIds: (initialData && initialData.linkedTaskIds) ? initialData.linkedTaskIds : [],
      attachments: form.attachments || [],
    };

    if (initialData && initialData.id && onUpdate) {
      onUpdate(initialData.id, dataToSave, files);
    } else {
      onSubmit(dataToSave, files);
    }

    setForm(emptyForm);
    setFiles([]);
  };

  const urgensiColor = URGENSI_COLORS[form.urgensi] || URGENSI_COLORS.Sedang;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{initialData ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}</h3>
          <button className={styles.modalClose} type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>

          {/* Judul */}
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

          {/* Tanggal & Waktu */}
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
              <label className={styles.label}>Waktu Mulai</label>
              <input
                type="time"
                className={styles.input}
                value={form.waktu}
                onChange={handleChange('waktu')}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Waktu Selesai</label>
              <input
                type="time"
                className={styles.input}
                value={form.waktuSelesai}
                onChange={handleChange('waktuSelesai')}
                placeholder="Opsional"
              />
            </div>
          </div>

          {/* Kategori & Urgensi */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Kategori</label>
              <select className={styles.select} value={form.kategori} onChange={handleChange('kategori')}>
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tingkat Urgensi</label>
              <div className={styles.urgensiSelector}>
                {URGENSI_OPTIONS.map((u) => {
                  const uc = URGENSI_COLORS[u];
                  const isActive = form.urgensi === u;
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, urgensi: u }))}
                      className={styles.urgensiBtn}
                      style={{
                        background: isActive ? uc.bg : 'transparent',
                        border: `1px solid ${isActive ? uc.border : 'rgba(255,255,255,0.1)'}`,
                        color: isActive ? uc.text : '#64748b',
                        fontWeight: isActive ? '700' : '400',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? uc.dot : '#475569', display: 'inline-block', flexShrink: 0 }} />
                      {u}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lokasi */}
          <div className={styles.formGroup}>
            <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} /> Tempat / Lokasi
            </label>
            <input
              type="text"
              className={styles.input}
              value={form.lokasi}
              onChange={handleChange('lokasi')}
              placeholder="Contoh: Aula BPS, Ruang Rapat, Online via Zoom..."
            />
          </div>

          {/* Pengingat */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Pengingat Berulang</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              {REMINDER_OPTIONS.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <input
                    type="checkbox"
                    checked={form.reminders.includes(r)}
                    onChange={() => handleReminderToggle(r)}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* Butir SKP */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Butir SKP Terkait</label>
            <div className={styles.customSelectWrapper} ref={skpDropdownRef}>
              <div 
                className={`${styles.input} ${styles.customSelectInput}`}
                onClick={() => {
                  setShowSkpDropdown(true);
                  setSkpSearch('');
                }}
              >
                {form.skpId 
                  ? `${form.skpId}. ${skpData.find(s => s.id == form.skpId)?.nama || ''}` 
                  : '— Tidak terkait SKP —'}
                <ChevronDown size={16} />
              </div>
              
              {showSkpDropdown && (
                <div className={styles.customDropdown}>
                  <div className={styles.customDropdownSearch}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ketik untuk mencari SKP..."
                      value={skpSearch}
                      onChange={(e) => setSkpSearch(e.target.value)}
                      className={styles.input}
                      style={{ padding: '8px', fontSize: '13px' }}
                    />
                  </div>
                  <div className={styles.customDropdownList}>
                    <div 
                      className={styles.customDropdownItem}
                      onClick={() => {
                        setForm(prev => ({...prev, skpId: ''}));
                        setShowSkpDropdown(false);
                      }}
                    >
                      <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Tidak terkait SKP</span>
                    </div>
                    {skpData.length === 0 ? (
                      <div className={styles.customDropdownItem} style={{ color: '#fb7185', fontStyle: 'italic', padding: '10px' }}>
                        Belum ada SKP. Silakan atur SKP di menu Manajemen SKP.
                      </div>
                    ) : (
                      skpData
                        .filter(s => s.nama.toLowerCase().includes(skpSearch.toLowerCase()) || String(s.id).includes(skpSearch))
                        .map((item) => (
                          <div 
                            key={item.id} 
                            className={styles.customDropdownItem}
                            onClick={() => {
                              setForm(prev => ({...prev, skpId: String(item.id)}));
                              setShowSkpDropdown(false);
                            }}
                          >
                            <span className={styles.customDropdownItemId}>{item.id}.</span> {item.nama}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deskripsi */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Deskripsi</label>
            <textarea
              className={styles.textarea}
              value={form.deskripsi}
              onChange={handleChange('deskripsi')}
              placeholder="Detail kegiatan, agenda, link meet, dll..."
              rows={3}
            />
          </div>

          {/* Lampiran (Optional) */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Lampiran (Opsional)</label>
            <input
              type="file"
              multiple
              className={styles.fileInput}
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                setFiles(prev => [...prev, ...selected]);
              }}
              id="scheduleAttachments"
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label
                htmlFor="scheduleAttachments"
                className={styles.fileLabel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  fontWeight: '500',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Plus size={16} /> Pilih File (PDF, Gambar, Doc...)
              </label>
              
              {/* List of existing attachments */}
              {form.attachments && form.attachments.length > 0 && form.attachments.map((att, idx) => (
                <div
                  key={`exist-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#38bdf8'
                  }}
                >
                  <FileText size={12} />
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        attachments: prev.attachments.filter((_, i) => i !== idx)
                      }));
                    }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              {/* List of new selected files */}
              {files.map((f, idx) => (
                <div
                  key={`new-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#cbd5e1'
                  }}
                >
                  <FileText size={12} />
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} /> {initialData ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
