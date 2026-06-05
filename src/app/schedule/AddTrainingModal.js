'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2, Award, Layers } from 'lucide-react';
import styles from './page.module.css';

const DEFAULT_LATSAR_PHASES = [
  {
    id: 'phase-1',
    name: '1. Registrasi (Aplikasi Gojags)',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    platform: 'Aplikasi Gojags BPS',
    notes: 'Registrasi peserta, unggah berkas kelengkapan administrasi, dan download berkas panduan kelas.',
    links: [
      { label: 'Portal Gojags', url: 'https://gojags.web.bps.go.id' },
      { label: 'Panduan Pelatihan Dasar (PDF)', url: 'https://drive.google.com/file/d/1sb6vvm_Tz6niz2Y4X8rwDxr8TVYTs7EZ/view?usp=sharing' },
      { label: 'Panduan Penyiapan Kelas (PDF)', url: 'https://drive.google.com/file/d/1RX7E_wSFksDJhAC2ZDG4c1ZORpC8AhSt/view?usp=sharing' },
      { label: 'Jadwal Pembelajaran Resmi', url: 'https://drive.google.com/drive/folders/1jf2Jn9spmxJEpmHcKxAHlocRAd1P8vP2?usp=sharing' }
    ],
    checklist: [
      { id: 'c1-1', text: 'Membuat akun Gojags BPS', completed: false },
      { id: 'c1-2', text: 'Mengunggah SK CPNS dan berkas administrasi', completed: false },
      { id: 'c1-3', text: 'Mengunduh Panduan Pelatihan Dasar & Penyiapan Kelas', completed: false },
      { id: 'c1-4', text: 'Mengunduh Jadwal Pembelajaran Resmi', completed: false }
    ]
  },
  {
    id: 'phase-2',
    name: '2. MOOC (Pembelajaran Mandiri)',
    startDate: '2026-06-02',
    endDate: '2026-06-12',
    platform: 'Aplikasi Sibangkom LAN',
    notes: 'Pembelajaran mandiri modul-modul materi LAN. Batas minimal nilai kelulusan evaluasi akademik adalah 70.',
    links: [
      { label: 'Portal Sibangkom LAN', url: 'https://sibangkom.lan.go.id' },
      { label: 'Bahan Tayang Pembelajaran', url: 'https://drive.google.com/drive/folders/10G9dvU9tYHdmeUFaExnDspGU-T51G7fc?usp=share_link' }
    ],
    checklist: [
      { id: 'c2-1', text: 'Mengunduh Bahan Tayang Pembelajaran', completed: false },
      { id: 'c2-2', text: 'Mempelajari materi Sikap Perilaku Bela Negara (Modul 1)', completed: false },
      { id: 'c2-3', text: 'Mempelajari materi Nilai-Nilai Dasar PNS (Modul 2 - BerAKHLAK)', completed: false },
      { id: 'c2-4', text: 'Mempelajari materi Kedudukan dan Peran PNS (Modul 3)', completed: false },
      { id: 'c2-5', text: 'Mengikuti Evaluasi Akademik MOOC (Mencapai Passing Grade minimal 70)', completed: false },
      { id: 'c2-6', text: 'Mengunduh Sertifikat kelulusan MOOC', completed: false }
    ]
  },
  {
    id: 'phase-3',
    name: '3. Pembelajaran Jarak Jauh (PJJ)',
    startDate: '2026-06-15',
    endDate: '2026-09-11',
    platform: 'e-Warkop LMS BPS & Zoom',
    notes: 'Pembelajaran virtual kolaboratif. Wajib mengisi absensi pagi/sore, menyusun laporan mingguan aktualisasi, dan bimbingan rancangan.',
    links: [
      { label: 'e-Warkop LMS BPS', url: 'https://lms.bps.go.id' },
      { label: 'Jobdesk Pengurus Kelas (Word)', url: 'https://docs.google.com/document/d/15WLbl2VmHGKCt4N_xTJuFySuP5LR9rdZ/edit?usp=sharing&ouid=117420667435523880709&rtpof=true&sd=true' },
      { label: 'Panduan Breakout Room Zoom', url: 'http://s.bps.go.id/BOZoom' },
      { label: 'Link Lapor Dokumentasi PJJ', url: 'https://s.bps.go.id/lapordokumentasipjj' },
      { label: 'Template Laporan Mingguan', url: 'https://drive.google.com/drive/folders/14OXG0b1AzPZWPDGv2CemLffNccUpKGw4?usp=sharing' },
      { label: 'Bahan Pembukaan Latsar BPS', url: 'https://drive.google.com/drive/folders/1A6k13os19EQHoqVnSuxcpnLlhX_hKY1c?usp=drive_link' }
    ],
    checklist: [
      { id: 'c3-1', text: 'Mengisi Presensi Kehadiran Harian (Pagi & Sore) di e-Warkop BPS', completed: false },
      { id: 'c3-2', text: 'Mengunduh Panduan Breakout Room Zoom & Jobdesk Pengurus Kelas', completed: false },
      { id: 'c3-3', text: 'Menyusun Laporan Mingguan Aktualisasi (Minggu 1 s.d. 3)', completed: false },
      { id: 'c3-4', text: 'Melaporkan dokumentasi harian ke link s.bps.go.id/lapordokumentasipjj', completed: false },
      { id: 'c3-5', text: 'Menyusun Draft Laporan Rancangan Aktualisasi (Rancangan Aktualisasi)', completed: false },
      { id: 'c3-6', text: 'Mengikuti Seminar Rancangan Aktualisasi (Virtual)', completed: false }
    ]
  },
  {
    id: 'phase-4',
    name: '4. Tahapan Klasikal (Offline)',
    startDate: '2026-09-14',
    endDate: '2026-09-19',
    platform: 'Pusdiklat BPS Jakarta (Offline)',
    notes: 'Evaluasi akhir tatap muka di asrama Pusdiklat. Wajib melengkapi berkas perjalanan dinas SPPD, menyusun laporan aktualisasi akhir, dan melaksanakan seminar hasil.',
    links: [
      { label: 'Smartbangkom LAN (e-STTP)', url: 'https://smartbangkom.lan.go.id' },
      { label: 'Template Administrasi Perjalanan', url: 'https://drive.google.com/drive/folders/17DVfgHdes2ozAMdt8MSOTljSut-Loul0?usp=sharing' },
      { label: 'Template Laporan Akhir & PKTBT', url: 'https://drive.google.com/drive/folders/1Seh1ZWBsQQfKC6P7zArGA9sX9tREHOcQ?usp=sharing' },
      { label: 'Formulir FAQ Latsar 2026', url: 'https://docs.google.com/forms/d/e/1FAIpQLSeoCqyKWolwTqFQcOOQ0Gpi0zyG0g215NH77Rj-w1FWHVS7hQ/viewform' }
    ],
    checklist: [
      { id: 'c4-1', text: 'Mengunduh Template Administrasi Perjalanan', completed: false },
      { id: 'c4-2', text: 'Melengkapi berkas SPPD, kuitansi riil, tiket, dan boarding pass', completed: false },
      { id: 'c4-3', text: 'Menyusun Laporan Aktualisasi Akhir & Penilaian PKTBT', completed: false },
      { id: 'c4-4', text: 'Menyiapkan bahan tayang presentasi seminar akhir', completed: false },
      { id: 'c4-5', text: 'Melaksanakan Seminar Laporan Hasil Aktualisasi di Pusdiklat BPS', completed: false },
      { id: 'c4-6', text: 'Menyelesaikan pertanggungjawaban keuangan perjalanan dinas', completed: false },
      { id: 'c4-7', text: 'Mengunduh e-STTP sertifikat kelulusan di smartbangkom.lan.go.id', completed: false }
    ]
  }
];

export default function AddTrainingModal({ isOpen, onClose, onSubmit, initialData, onUpdate }) {
  const emptyForm = {
    title: '',
    description: '',
    startDate: '2026-05-01',
    endDate: '2026-09-19',
    status: 'in_progress',
    phases: []
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({
          title: initialData.title || '',
          description: initialData.description || '',
          startDate: initialData.startDate || '2026-05-01',
          endDate: initialData.endDate || '2026-09-19',
          status: initialData.status || 'in_progress',
          phases: initialData.phases ? JSON.parse(JSON.stringify(initialData.phases)) : []
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

  const handleApplyLatsarTemplate = () => {
    setForm({
      title: 'Pelatihan Dasar CPNS BPS 2026',
      description: 'Program Pelatihan Dasar Calon Pegawai Negeri Sipil Golongan III BPS tahun 2026.',
      startDate: '2026-05-01',
      endDate: '2026-09-19',
      status: 'in_progress',
      phases: JSON.parse(JSON.stringify(DEFAULT_LATSAR_PHASES))
    });
  };

  const handleAddPhase = () => {
    const newPhase = {
      id: `phase-${Date.now()}`,
      name: `Fase Baru #${form.phases.length + 1}`,
      startDate: form.startDate,
      endDate: form.endDate,
      platform: 'Platform Aplikasi/Venue',
      notes: '',
      links: [],
      checklist: []
    };
    setForm((prev) => ({
      ...prev,
      phases: [...prev.phases, newPhase]
    }));
  };

  const handleRemovePhase = (idx) => {
    setForm((prev) => {
      const copy = [...prev.phases];
      copy.splice(idx, 1);
      return { ...prev, phases: copy };
    });
  };

  const handlePhaseChange = (idx, field, value) => {
    setForm((prev) => {
      const copy = [...prev.phases];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, phases: copy };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.startDate || !form.endDate) return;

    if (initialData && initialData.id && onUpdate) {
      onUpdate(initialData.id, form);
    } else {
      onSubmit(form);
    }
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={`${styles.modal} glass-strong animate-fade-in`} 
        style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {initialData ? 'Edit Program Pelatihan' : 'Tambah Pelatihan & Timeline'}
          </h3>
          <button className={styles.modalClose} onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {!initialData && (
            <div 
              className="glass-card"
              style={{ 
                marginBottom: '20px', 
                padding: '16px', 
                background: 'var(--primary-glow)', 
                borderColor: 'rgba(99, 102, 241, 0.25)',
                borderWidth: '1px',
                borderStyle: 'solid',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Award size={22} color="var(--primary-light)" style={{ filter: 'drop-shadow(0 0 5px var(--primary-glow))' }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>Template Latsar CPNS BPS 2026</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Gojags, Sibangkom MOOC, e-Warkop PJJ & Klasikal</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyLatsarTemplate}
                style={{
                  padding: '8px 16px',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)'
                }}
              >
                Gunakan Template
              </button>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Nama Pelatihan/Program</label>
            <input
              type="text"
              className={`${styles.input} input-base`}
              value={form.title}
              onChange={handleChange('title')}
              placeholder="Contoh: Latsar CPNS BPS 2026"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Deskripsi Program</label>
            <textarea
              className={`${styles.input} input-base`}
              rows="2"
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Deskripsi singkat pelatihan..."
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.label}>Tanggal Mulai Utama</label>
              <input
                type="date"
                className={`${styles.input} input-base`}
                value={form.startDate}
                onChange={handleChange('startDate')}
                required
              />
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.label}>Tanggal Selesai Utama</label>
              <input
                type="date"
                className={`${styles.input} input-base`}
                value={form.endDate}
                onChange={handleChange('endDate')}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.label}>Status</label>
              <select
                className={`${styles.input} input-base`}
                value={form.status}
                onChange={handleChange('status')}
              >
                <option value="not_started">Belum Mulai</option>
                <option value="in_progress">Berlangsung</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--surface-border)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>Tahapan / Fase Kegiatan ({form.phases.length})</h4>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddPhase}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-xs)'
                }}
              >
                <Plus size={14} /> Tambah Fase
              </button>
            </div>

            {form.phases.map((phase, idx) => (
              <div
                key={phase.id || idx}
                className="glass-card"
                style={{
                  padding: '20px',
                  marginBottom: '16px',
                  position: 'relative',
                  background: 'rgba(255,255,255,0.015)'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRemovePhase(idx)}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    opacity: 0.8
                  }}
                  title="Hapus Fase"
                >
                  <Trash2 size={16} />
                </button>

                <div className={styles.formGroup} style={{ width: '90%', marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nama Fase</label>
                  <input
                    type="text"
                    className={`${styles.input} input-base`}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    value={phase.name}
                    onChange={(e) => handlePhaseChange(idx, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formRow} style={{ marginBottom: '16px' }}>
                  <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mulai</label>
                    <input
                      type="date"
                      className={`${styles.input} input-base`}
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      value={phase.startDate}
                      onChange={(e) => handlePhaseChange(idx, 'startDate', e.target.value)}
                      required
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selesai</label>
                    <input
                      type="date"
                      className={`${styles.input} input-base`}
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      value={phase.endDate}
                      onChange={(e) => handlePhaseChange(idx, 'endDate', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform / Aplikasi / Tempat</label>
                  <input
                    type="text"
                    className={`${styles.input} input-base`}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                    value={phase.platform}
                    onChange={(e) => handlePhaseChange(idx, 'platform', e.target.value)}
                    placeholder="Contoh: Aplikasi Gojags BPS / Pusdiklat BPS Jakarta"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.modalActions} style={{ marginTop: '28px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '20px' }}>
            <button type="button" className={`${styles.cancelBtn} btn btn-secondary`} onClick={onClose}>Batal</button>
            <button type="submit" className={`${styles.addBtn} btn btn-primary`}>
              {initialData ? 'Simpan Perubahan' : 'Buat Pelatihan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
