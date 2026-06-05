'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { Plus, Edit, Trash2, Award, CheckSquare, BookOpen, ExternalLink, Layers, CheckCircle2, Circle } from 'lucide-react';
import AddTrainingModal from './AddTrainingModal';
import GanttChart from './GanttChart';
import styles from './page.module.css';

// Automatically provide rules for BPS Latsar CPNS based on phase name keywords
const getPhaseRules = (phaseName) => {
  const name = phaseName.toLowerCase();
  if (name.includes('registrasi') || name.includes('gojags')) {
    return [
      'Lengkapi seluruh berkas administratif: SK CPNS, Pas Foto, Surat Tugas, dan berkas persyaratan lainnya.',
      'Unggah berkas hanya melalui portal resmi Gojags BPS.',
      'Periksa secara berkala status verifikasi berkas pendaftaran Anda.',
      'Pastikan Anda telah mengunduh Jadwal Pembelajaran resmi dari Pusdiklat BPS.'
    ];
  } else if (name.includes('mooc') || name.includes('sibangkom') || name.includes('mandiri')) {
    return [
      'Pembelajaran mandiri dilaksanakan secara asinkronus melalui portal Sibangkom LAN.',
      'Evaluasi Akademik MOOC wajib diselesaikan untuk dapat melanjutkan ke tahap berikutnya.',
      'Nilai Passing Grade kelulusan evaluasi akademik MOOC adalah minimal 70.00.',
      'Anda diberikan maksimal 3 kali percobaan evaluasi untuk memperoleh skor terbaik (skor tertinggi akan disimpan).',
      'Setelah dinyatakan lulus, segera unduh sertifikat (e-STTP) MOOC Anda.'
    ];
  } else if (name.includes('jarak jauh') || name.includes('pjj') || name.includes('warkop') || name.includes('virtual')) {
    return [
      'Pembelajaran Jarak Jauh (PJJ) menggunakan platform e-Warkop LMS Pusdiklat BPS.',
      'Wajib melakukan Presensi Kehadiran harian sebanyak 2 kali: Pagi (07.00 - 07.30) dan Sore (16.00 - 16.30). Keterlambatan akan mengurangi nilai sikap perilaku.',
      'Ikuti sesi tatap muka virtual (Synchronous) melalui Zoom Meeting dengan pakaian rapi dan sopan (kemeja putih polos, dasi hitam, bagi wanita berjilbab hitam).',
      'Setiap akhir pekan, susun Laporan Mingguan Aktualisasi dan lakukan bimbingan (coaching) secara daring dengan Coach & Mentor.',
      'Kumpulkan dokumentasi kegiatan harian Anda melalui tautan s.bps.go.id/lapordokumentasipjj.'
    ];
  } else if (name.includes('klasikal') || name.includes('pusdiklat') || name.includes('offline')) {
    return [
      'Tahap klasikal dilaksanakan secara tatap muka (offline) bertempat di Pusdiklat BPS, Jagakarsa, Jakarta Selatan.',
      'Peserta wajib mematuhi seluruh tata tertib asrama Pusdiklat BPS (jam malam, larangan keluar asrama tanpa izin, dll).',
      'Siapkan kelengkapan administrasi perjalanan dinas (SPPD lembar asli yang ditandatangani kantor asal, tiket pesawat/kereta, kuitansi riil, boarding pass).',
      'Pakaian selama klasikal: kemeja putih lengan panjang, celana/rok hitam bahan kain (bukan jeans), dasi hitam polos, lencana pin BPS, dan sepatu pantofel hitam.',
      'Siapkan draf Laporan Aktualisasi Akhir yang telah disetujui Mentor dan Coach untuk diujikan pada Seminar Evaluasi Akhir.'
    ];
  }
  return [
    'Lakukan pemantauan kemajuan tugas secara mandiri.',
    'Lengkapi seluruh catatan dan laporan sebelum tenggat waktu fase berakhir.',
    'Gunakan tautan pintasan untuk mengakses aplikasi pendukung secara cepat.'
  ];
};

export default function TrainingTracker() {
  const { docs: programs = [], addDocument, updateDocument, deleteDocument } = useFirestore('training_programs');

  const [activeProgramId, setActiveProgramId] = useState(null);
  const [activePhaseId, setActivePhaseId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState('checklist'); // 'checklist' | 'rules' | 'links'

  // Set active program on load or updates
  useEffect(() => {
    if (programs.length > 0 && !activeProgramId) {
      setActiveProgramId(programs[0].id);
      if (programs[0].phases && programs[0].phases.length > 0) {
        setActivePhaseId(programs[0].phases[0].id);
      }
    }
  }, [programs, activeProgramId]);

  const activeProgram = programs.find(p => p.id === activeProgramId);
  const activePhase = activeProgram?.phases?.find(p => p.id === activePhaseId);

  // Auto select phase if active program changes
  useEffect(() => {
    if (activeProgram?.phases && activeProgram.phases.length > 0) {
      const hasPhase = activeProgram.phases.some(p => p.id === activePhaseId);
      if (!hasPhase) {
        setActivePhaseId(activeProgram.phases[0].id);
      }
    } else {
      setActivePhaseId(null);
    }
  }, [activeProgramId, activeProgram, activePhaseId]);

  const handleToggleChecklist = async (programId, phaseId, checklistId) => {
    const prog = programs.find(p => p.id === programId);
    if (!prog) return;

    const updatedPhases = prog.phases.map(phase => {
      if (phase.id === phaseId) {
        const updatedChecklist = phase.checklist.map(item => {
          if (item.id === checklistId) {
            return { ...item, completed: !item.completed };
          }
          return item;
        });
        return { ...phase, checklist: updatedChecklist };
      }
      return phase;
    });

    await updateDocument(programId, { phases: updatedPhases });
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!newChecklistText.trim() || !activeProgramId || !activePhaseId) return;

    const prog = programs.find(p => p.id === activeProgramId);
    if (!prog) return;

    const updatedPhases = prog.phases.map(phase => {
      if (phase.id === activePhaseId) {
        const newChecklist = [...(phase.checklist || [])];
        newChecklist.push({
          id: `custom-check-${Date.now()}`,
          text: newChecklistText.trim(),
          completed: false
        });
        return { ...phase, checklist: newChecklist };
      }
      return phase;
    });

    await updateDocument(activeProgramId, { phases: updatedPhases });
    setNewChecklistText('');
  };

  const handleRemoveChecklistItem = async (checklistId) => {
    if (!activeProgramId || !activePhaseId) return;

    const prog = programs.find(p => p.id === activeProgramId);
    if (!prog) return;

    const updatedPhases = prog.phases.map(phase => {
      if (phase.id === activePhaseId) {
        const updatedChecklist = (phase.checklist || []).filter(item => item.id !== checklistId);
        return { ...phase, checklist: updatedChecklist };
      }
      return phase;
    });

    await updateDocument(activeProgramId, { phases: updatedPhases });
  };

  const calculateProgress = (prog) => {
    if (!prog?.phases || prog.phases.length === 0) return 0;
    let totalItems = 0;
    let completedItems = 0;

    prog.phases.forEach(phase => {
      if (phase.checklist) {
        totalItems += phase.checklist.length;
        completedItems += phase.checklist.filter(item => item.completed).length;
      }
    });

    if (totalItems === 0) return prog.status === 'completed' ? 100 : 0;
    return Math.round((completedItems / totalItems) * 100);
  };

  const handleDeleteProgram = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus program pelatihan ini beserta seluruh fasenya?')) {
      await deleteDocument(id);
      setActiveProgramId(null);
    }
  };

  const getStatusClass = (status) => {
    if (status === 'completed') return 'status-selesai';
    if (status === 'in_progress') return 'status-progress';
    return 'status-belum';
  };

  const getStatusLabel = (status) => {
    if (status === 'completed') return 'Selesai';
    if (status === 'in_progress') return 'Berlangsung';
    return 'Belum Mulai';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', marginTop: '20px' }}>
      
      {/* LEFT COLUMN: PROGRAMS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in stagger-1">
        <button 
          className={styles.addBtn}
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => {
            setEditingProgram(null);
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={16} /> Tambah Pelatihan
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '75vh', overflowY: 'auto' }}>
          {programs.length === 0 ? (
            <div 
              className="glass-card" 
              style={{ 
                padding: '24px 16px', 
                textAlign: 'center', 
                color: 'var(--text-muted)', 
                borderStyle: 'dashed',
                fontSize: 'var(--font-size-sm)' 
              }}
            >
              Belum ada program pelatihan. Klik tombol di atas untuk membuat.
            </div>
          ) : (
            programs.map(prog => {
              const isActive = prog.id === activeProgramId;
              const progress = calculateProgress(prog);
              return (
                <div
                  key={prog.id}
                  onClick={() => setActiveProgramId(prog.id)}
                  className="glass-card-interactive"
                  style={{
                    padding: '16px',
                    background: isActive ? 'var(--surface-hover)' : 'var(--surface)',
                    borderColor: isActive ? 'var(--primary)' : 'var(--surface-border)',
                    boxShadow: isActive ? 'var(--shadow-glow-primary)' : 'none',
                    position: 'relative'
                  }}
                >
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: isActive ? 'var(--primary-light)' : 'var(--text-primary)', marginBottom: '6px', paddingRight: '24px' }}>
                    {prog.title}
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {new Date(prog.startDate).toLocaleDateString('id-ID', { month: 'short' })} - {new Date(prog.endDate).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                  </p>
                  
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))', borderRadius: 'var(--radius-full)', transition: 'width var(--transition-slow)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    <span>Progres</span>
                    <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--accent-cyan)' }}>{progress}%</span>
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div style={{ position: 'absolute', top: '16px', right: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProgram(prog);
                          setIsAddModalOpen(true);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                        title="Edit Pelatihan"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProgram(prog.id);
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                        title="Hapus Pelatihan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: GANTT CHART & DETAILS PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column' }} className="animate-fade-in stagger-2">
        {activeProgram ? (
          <>
            {/* Header Pelatihan */}
            <div 
              className="glass-card" 
              style={{ 
                padding: '20px', 
                marginBottom: '20px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)',
                background: 'rgba(255,255,255,0.02)'
              }}
            >
              <div>
                <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)', marginBottom: '6px' }}>{activeProgram.title}</h2>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{activeProgram.description || 'Tidak ada deskripsi.'}</p>
              </div>
              <div>
                <span className={`badge ${getStatusClass(activeProgram.status)}`}>
                  {getStatusLabel(activeProgram.status)}
                </span>
              </div>
            </div>

            {/* Gantt Chart component */}
            <GanttChart
              startDate={activeProgram.startDate}
              endDate={activeProgram.endDate}
              phases={activeProgram.phases}
              activePhaseId={activePhaseId}
              onSelectPhase={setActivePhaseId}
            />

            {/* Details Panel for Selected Phase */}
            {activePhase ? (
              <div 
                className="glass-card" 
                style={{ 
                  padding: '24px',
                  boxShadow: 'var(--shadow-md)',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 'var(--font-weight-bold)', color: 'var(--primary-light)', display: 'block', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Fase Pelatihan Aktif</span>
                      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>{activePhase.name}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-secondary)', display: 'block' }}>Rentang Waktu</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
                        {new Date(activePhase.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(activePhase.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {activePhase.platform && (
                    <div style={{ marginTop: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={15} color="var(--primary-light)" />
                      <span>Platform/Aplikasi: <strong style={{ color: 'var(--text-primary)' }}>{activePhase.platform}</strong></span>
                    </div>
                  )}
                  {activePhase.notes && (
                    <p style={{ marginTop: '12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--primary-light)' }}>
                      &ldquo;{activePhase.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Sub Tab Switcher */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-lg)', width: 'fit-content' }}>
                  <button
                    onClick={() => setActiveDetailTab('checklist')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      background: activeDetailTab === 'checklist' ? 'var(--surface-active)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: activeDetailTab === 'checklist' ? 'var(--primary-light)' : 'var(--text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)'
                    }}
                  >
                    <CheckSquare size={14} /> Checklist Tugas ({activePhase.checklist?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveDetailTab('rules')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      background: activeDetailTab === 'rules' ? 'var(--surface-active)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      color: activeDetailTab === 'rules' ? 'var(--primary-light)' : 'var(--text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-semibold)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-base)'
                    }}
                  >
                    <BookOpen size={14} /> Aturan & Ketentuan
                  </button>
                  {activePhase.links && activePhase.links.length > 0 && (
                    <button
                      onClick={() => setActiveDetailTab('links')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: activeDetailTab === 'links' ? 'var(--surface-active)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: activeDetailTab === 'links' ? 'var(--primary-light)' : 'var(--text-secondary)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-semibold)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-base)'
                      }}
                    >
                      <ExternalLink size={14} /> Tautan Pintasan ({activePhase.links.length})
                    </button>
                  )}
                </div>

                {/* Sub Tab Content */}
                {activeDetailTab === 'checklist' && (
                  <div>
                    {/* Add checklist item */}
                    <form onSubmit={handleAddChecklistItem} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                      <input
                        type="text"
                        placeholder="Tambah tugas khusus untuk fase ini..."
                        className="input-base"
                        style={{ margin: 0, padding: '8px 14px', fontSize: 'var(--font-size-sm)' }}
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                      />
                      <button type="submit" className={styles.addBtn} style={{ padding: '8px 16px' }}>Tambah</button>
                    </form>

                    {/* Checklist items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {!activePhase.checklist || activePhase.checklist.length === 0 ? (
                        <div 
                          className="glass-card" 
                          style={{ 
                            padding: '24px', 
                            textAlign: 'center', 
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.01)',
                            borderStyle: 'dashed'
                          }}
                        >
                          Belum ada tugas di tahapan ini.
                        </div>
                      ) : (
                        activePhase.checklist.map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleToggleChecklist(activeProgramId, activePhaseId, item.id)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: 'var(--radius-sm)',
                                  accentColor: 'var(--primary)',
                                  cursor: 'pointer'
                                }}
                              />
                              <span 
                                style={{ 
                                  fontSize: 'var(--font-size-sm)', 
                                  color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                  textDecoration: item.completed ? 'line-through' : 'none',
                                  transition: 'all var(--transition-base)'
                                }}
                              >
                                {item.text}
                              </span>
                            </label>
                            
                            <button
                              onClick={() => handleRemoveChecklistItem(item.id)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--danger)', opacity: 0.5, cursor: 'pointer', padding: '4px' }}
                              title="Hapus"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeDetailTab === 'rules' && (
                  <div style={{ background: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.12)', borderRadius: 'var(--radius-lg)', padding: '20px' }} className="animate-fade-in">
                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--primary-light)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={16} /> Ketentuan Resmi Latsar CPNS BPS
                    </h4>
                    <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {getPhaseRules(activePhase.name).map((rule, rIdx) => (
                        <li key={rIdx} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeDetailTab === 'links' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }} className="animate-fade-in">
                    {activePhase.links?.map((link, lIdx) => (
                      <a
                        key={lIdx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass-card-interactive"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          textDecoration: 'none',
                          color: 'var(--text-primary)',
                          background: 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', width: '85%' }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.label}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span>
                        </div>
                        <ExternalLink size={14} color="var(--primary-light)" style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                )}

              </div>
            ) : (
              <div 
                className="glass-card" 
                style={{ 
                  padding: '40px', 
                  textAlign: 'center', 
                  color: 'var(--text-muted)', 
                  background: 'rgba(255,255,255,0.02)',
                  fontSize: 'var(--font-size-sm)'
                }}
              >
                Silakan pilih salah satu tahapan pelatihan di atas untuk melihat detail checklist dan ketentuan.
              </div>
            )}
          </>
        ) : (
          <div 
            className="glass-card" 
            style={{ 
              padding: '60px', 
              textAlign: 'center', 
              color: 'var(--text-muted)', 
              background: 'rgba(255,255,255,0.02)', 
              borderStyle: 'dashed'
            }}
          >
            <Award size={48} style={{ color: 'var(--primary-glow)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)', marginBottom: '8px' }}>Papan Tracker Pelatihan & Kegiatan</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
              Anda belum memilih atau membuat program pelatihan. Klik &ldquo;Tambah Pelatihan&rdquo; dan pilih opsi template Latsar CPNS BPS untuk langsung mengaktifkan modul.
            </p>
          </div>
        )}
      </div>

      {/* Modal for adding/editing training */}
      <AddTrainingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (data) => {
          const docRef = await addDocument(data);
          setActiveProgramId(docRef.id);
        }}
        initialData={editingProgram}
        onUpdate={async (id, data) => {
          await updateDocument(id, data);
        }}
      />

    </div>
  );
}
