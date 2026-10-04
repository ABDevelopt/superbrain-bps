'use client';

import { useState, useRef, useCallback } from 'react';
import { 
  FileArchive, UploadCloud, Download, Trash2, Eye, 
  Sparkles, Zap, ShieldCheck, HelpCircle, X, Check,
  FileText, Image as ImageIcon, Sliders, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { useAlert } from '@/contexts/AlertContext';
import { 
  compressFile, 
  formatBytes 
} from '@/lib/compressor';
import styles from './page.module.css';

const PRESETS = [
  {
    id: 'balanced',
    title: 'Rekomendasi (Seimbang)',
    desc: 'Hemat 60-80% ukuran. Keterbacaan teks & detail dokumen tetap sangat tajam.',
    icon: <Sparkles size={16} color="#818cf8" />,
    quality: 0.70,
    maxWidth: 1600,
    scale: 1.4
  },
  {
    id: 'extreme',
    title: 'Kompresi Maksimal (< 1 MB)',
    desc: 'Hemat 80-95% ukuran. Sangat cocok untuk syarat portal instansi / SSCASN / KipApp.',
    icon: <Zap size={16} color="#fbbf24" />,
    quality: 0.50,
    maxWidth: 1200,
    scale: 1.1
  },
  {
    id: 'high',
    title: 'Kualitas Tinggi (Minimal)',
    desc: 'Kompresi ringan (30-50%). Mempertahankan resolusi tinggi untuk arsip penting.',
    icon: <ShieldCheck size={16} color="#34d399" />,
    quality: 0.85,
    maxWidth: 2048,
    scale: 1.8
  },
  {
    id: 'custom',
    title: 'Pengaturan Kustom',
    desc: 'Atur sendiri tingkat kualitas gambar dan resolusi/skala halaman PDF.',
    icon: <Sliders size={16} color="#38bdf8" />
  }
];

export default function CompressPage() {
  const { showAlert } = useAlert();
  const fileInputRef = useRef(null);

  const [filesQueue, setFilesQueue] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [customQuality, setCustomQuality] = useState(70);
  const [customMaxWidth, setCustomMaxWidth] = useState(1600);
  const [customScale, setCustomScale] = useState(1.4);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  // Helper to trigger browser file download
  const triggerDownload = (file, fileName) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || file.name || 'compressed-file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Add files to queue and automatically start compression
  const handleFilesAdded = useCallback(async (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;

    const validFiles = Array.from(newFiles).filter(file => {
      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return isImg || isPdf;
    });

    if (validFiles.length === 0) {
      showAlert('Format file tidak didukung. Harap pilih gambar (JPG/PNG/WebP) atau dokumen PDF.', 'warning');
      return;
    }

    const newQueueItems = validFiles.map((f, i) => ({
      id: `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      originalFile: f,
      name: f.name,
      type: f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
      originalSize: f.size,
      compressedFile: null,
      compressedSize: 0,
      percentSaved: 0,
      status: 'pending', // 'pending' | 'processing' | 'done' | 'error'
      progress: 0,
      progressText: '',
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : ''
    }));

    setFilesQueue(prev => [...prev, ...newQueueItems]);

    // Process each newly added file
    setIsProcessing(true);
    for (const item of newQueueItems) {
      const presetObj = PRESETS.find(p => p.id === selectedPreset) || PRESETS[0];
      const options = {
        mode: selectedPreset === 'custom' ? 'balanced' : selectedPreset,
        quality: selectedPreset === 'custom' ? customQuality / 100 : presetObj.quality,
        maxWidth: selectedPreset === 'custom' ? customMaxWidth : presetObj.maxWidth,
        maxHeight: selectedPreset === 'custom' ? customMaxWidth : presetObj.maxWidth,
        scale: selectedPreset === 'custom' ? customScale : presetObj.scale
      };

      setFilesQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', progress: 10, progressText: 'Memulai kompresi...' } : q));

      try {
        const result = await compressFile(item.originalFile, options, (prog) => {
          setFilesQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              return {
                ...q,
                progress: prog.percent || 50,
                progressText: prog.total ? `Halaman ${prog.current} dari ${prog.total}` : 'Mengompres...'
              };
            }
            return q;
          }));
        });

        setFilesQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return {
              ...q,
              status: 'done',
              progress: 100,
              progressText: 'Selesai',
              compressedFile: result.file,
              compressedSize: result.compressedSize,
              percentSaved: result.percentSaved,
              previewUrl: result.previewUrl || q.previewUrl
            };
          }
          return q;
        }));
      } catch (err) {
        console.error('Compression failed for', item.name, err);
        setFilesQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', progressText: 'Gagal kompresi' } : q));
      }
    }
    setIsProcessing(false);
  }, [selectedPreset, customQuality, customMaxWidth, customScale, showAlert]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files) {
      handleFilesAdded(e.target.files);
    }
    e.target.value = '';
  };

  const removeItem = (id) => {
    setFilesQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearAll = () => {
    setFilesQueue([]);
  };

  const downloadAll = () => {
    const doneItems = filesQueue.filter(q => q.status === 'done' && q.compressedFile);
    if (doneItems.length === 0) {
      showAlert('Belum ada file yang selesai dikompresi.', 'warning');
      return;
    }

    doneItems.forEach((item, idx) => {
      setTimeout(() => {
        triggerDownload(item.compressedFile, item.compressedFile.name);
      }, idx * 300);
    });
    showAlert(`Mengunduh ${doneItems.length} file...`, 'success');
  };

  // Re-compress all files when preset changes
  const handlePresetChange = async (newPresetId) => {
    setSelectedPreset(newPresetId);
    if (filesQueue.length === 0) return;

    const presetObj = PRESETS.find(p => p.id === newPresetId) || PRESETS[0];
    const options = {
      mode: newPresetId === 'custom' ? 'balanced' : newPresetId,
      quality: newPresetId === 'custom' ? customQuality / 100 : presetObj.quality,
      maxWidth: newPresetId === 'custom' ? customMaxWidth : presetObj.maxWidth,
      maxHeight: newPresetId === 'custom' ? customMaxWidth : presetObj.maxWidth,
      scale: newPresetId === 'custom' ? customScale : presetObj.scale
    };

    setIsProcessing(true);
    for (const item of filesQueue) {
      setFilesQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', progress: 10, progressText: 'Mengompresi ulang...' } : q));

      try {
        const result = await compressFile(item.originalFile, options, (prog) => {
          setFilesQueue(prev => prev.map(q => {
            if (q.id === item.id) {
              return {
                ...q,
                progress: prog.percent || 50,
                progressText: prog.total ? `Halaman ${prog.current} dari ${prog.total}` : 'Mengompres...'
              };
            }
            return q;
          }));
        });

        setFilesQueue(prev => prev.map(q => {
          if (q.id === item.id) {
            return {
              ...q,
              status: 'done',
              progress: 100,
              progressText: 'Selesai',
              compressedFile: result.file,
              compressedSize: result.compressedSize,
              percentSaved: result.percentSaved,
              previewUrl: result.previewUrl || q.previewUrl
            };
          }
          return q;
        }));
      } catch (err) {
        setFilesQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', progressText: 'Gagal' } : q));
      }
    }
    setIsProcessing(false);
  };

  // Overall Statistics
  const totalOriginal = filesQueue.reduce((acc, cur) => acc + (cur.originalSize || 0), 0);
  const totalCompressed = filesQueue.reduce((acc, cur) => acc + (cur.compressedSize || cur.originalSize || 0), 0);
  const totalSavedBytes = Math.max(0, totalOriginal - totalCompressed);
  const totalPercentSaved = totalOriginal > 0 ? Math.round((totalSavedBytes / totalOriginal) * 100) : 0;
  const completedCount = filesQueue.filter(q => q.status === 'done').length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.headerIcon}>
            <FileArchive size={24} />
          </span>
          <div>
            <h1 className={styles.title}>Kompres Gambar & Dokumen PDF</h1>
            <p className={styles.subtitle}>
              Perkecil ukuran dokumen laporan, berkas bukti dukung, dan foto tanpa merusak keterbacaan teks. 100% diproses langsung di peramban Anda (privat & aman).
            </p>
          </div>
        </div>
      </div>

      {/* Preset Section */}
      <div className={styles.presetSection}>
        <div className={styles.presetLabel}>
          <Sliders size={15} /> Pilihan Tingkat Kompresi:
        </div>
        <div className={styles.presetGrid}>
          {PRESETS.map((preset) => (
            <div
              key={preset.id}
              className={`${styles.presetCard} ${selectedPreset === preset.id ? styles.presetCardActive : ''}`}
              onClick={() => handlePresetChange(preset.id)}
            >
              <div className={styles.presetTitle}>
                <span>{preset.title}</span>
                {preset.icon}
              </div>
              <div className={styles.presetDesc}>{preset.desc}</div>
            </div>
          ))}
        </div>

        {/* Custom Controls */}
        {selectedPreset === 'custom' && (
          <div className={styles.customSettings}>
            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Kualitas Kompresi (Gambar & Scan)</span>
                <span className={styles.sliderValue}>{customQuality}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="95"
                step="5"
                value={customQuality}
                onChange={(e) => setCustomQuality(Number(e.target.value))}
                className={styles.sliderInput}
              />
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>Lebar Maksimal Gambar</span>
                <span className={styles.sliderValue}>{customMaxWidth} px</span>
              </div>
              <input
                type="range"
                min="800"
                max="2400"
                step="100"
                value={customMaxWidth}
                onChange={(e) => setCustomMaxWidth(Number(e.target.value))}
                className={styles.sliderInput}
              />
            </div>

            <div className={styles.sliderGroup}>
              <div className={styles.sliderHeader}>
                <span>DPI / Ketajaman Render PDF</span>
                <span className={styles.sliderValue}>{Math.round(customScale * 100)} DPI</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.1"
                value={customScale}
                onChange={(e) => setCustomScale(Number(e.target.value))}
                className={styles.sliderInput}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
          style={{ display: 'none' }}
        />
        <div className={styles.dropzoneIconWrapper}>
          <UploadCloud size={32} />
        </div>
        <div className={styles.dropzoneTitle}>Tarik & Lepaskan File di Sini</div>
        <div className={styles.dropzoneSubtitle}>atau klik untuk memilih file dari komputer Anda</div>
        <button type="button" className={styles.browseBtn}>
          <UploadCloud size={16} /> Pilih Berkas Gambar / PDF
        </button>
        <div className={styles.formatBadges}>
          <span className={styles.formatBadge}>PDF (.pdf)</span>
          <span className={styles.formatBadge}>JPEG (.jpg, .jpeg)</span>
          <span className={styles.formatBadge}>PNG (.png)</span>
          <span className={styles.formatBadge}>WebP (.webp)</span>
        </div>
      </div>

      {/* Summary Bar */}
      {filesQueue.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryMetrics}>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Total File</span>
              <span className={styles.metricValue}>{completedCount} / {filesQueue.length}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Ukuran Awal</span>
              <span className={styles.metricValue}>{formatBytes(totalOriginal)}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Ukuran Akhir</span>
              <span className={styles.metricValue}>{formatBytes(totalCompressed)}</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricLabel}>Kapasitas Dihemat</span>
              <span className={`${styles.metricValue} ${styles.metricSaved}`}>
                {formatBytes(totalSavedBytes)} ({totalPercentSaved}%)
              </span>
            </div>
          </div>

          <div className={styles.actionButtonGroup}>
            <button
              type="button"
              className={styles.downloadAllBtn}
              onClick={downloadAll}
              disabled={completedCount === 0}
            >
              <Download size={15} /> Unduh Semua ({completedCount})
            </button>
            <button
              type="button"
              className={styles.clearAllBtn}
              onClick={clearAll}
            >
              <Trash2 size={15} /> Bersihkan
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {filesQueue.length > 0 && (
        <div className={styles.fileList}>
          {filesQueue.map((item) => (
            <div key={item.id} className={styles.fileCard}>
              <div className={styles.fileThumbnail}>
                {item.type === 'image' && item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} />
                ) : item.type === 'pdf' ? (
                  <FileText size={26} className={styles.filePdfIcon} />
                ) : (
                  <ImageIcon size={26} className={styles.fileImageIcon} />
                )}
              </div>

              <div className={styles.fileDetails}>
                <div className={styles.fileNameRow}>
                  <span className={styles.fileName} title={item.name}>{item.name}</span>
                  {item.status === 'done' && item.percentSaved > 0 && (
                    <span className={styles.saveBadge}>Hemat {item.percentSaved}%</span>
                  )}
                </div>

                <div className={styles.fileMeta}>
                  <div className={styles.sizeComparison}>
                    <span className={styles.originalSize}>{formatBytes(item.originalSize)}</span>
                    <ArrowRight size={13} color="#94a3b8" />
                    <span className={styles.newSize}>
                      {item.status === 'done' ? formatBytes(item.compressedSize) : 'Memproses...'}
                    </span>
                  </div>
                  {item.status === 'done' && (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Berhasil
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span style={{ color: '#ef4444' }}>Gagal mengompres</span>
                  )}
                </div>

                {item.status === 'processing' && (
                  <div className={styles.progressWrapper}>
                    <div className={styles.progressBarTrack}>
                      <div className={styles.progressBarFill} style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className={styles.progressText}>
                      <span>{item.progressText}</span>
                      <span>{item.progress}%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.fileActions}>
                {item.status === 'done' && item.compressedFile && (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDownload}`}
                    onClick={() => triggerDownload(item.compressedFile, item.compressedFile.name)}
                    title="Unduh File"
                  >
                    <Download size={16} />
                  </button>
                )}

                {item.status === 'done' && item.previewUrl && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setPreviewItem(item)}
                    title="Lihat Pratinjau"
                  >
                    <Eye size={16} />
                  </button>
                )}

                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                  onClick={() => removeItem(item.id)}
                  title="Hapus dari daftar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info / Tips Card for BPS Portals */}
      <div className={styles.infoBox}>
        <HelpCircle size={20} className={styles.infoIcon} />
        <div className={styles.infoContent}>
          <strong>Tips Ukuran Berkas untuk Portal ASN / BPS:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
            <li><strong>KipApp & e-Kinerja:</strong> Rekomendasi berkas bukti dukung PDF di bawah <strong>1 MB</strong> agar cepat dimuat oleh atasan penilai.</li>
            <li><strong>SSCASN / Portal Seleksi:</strong> Umumnya membatasi scan dokumen PDF maksimal <strong>500 KB</strong> — gunakan preset <em>Kompresi Maksimal</em>.</li>
            <li><strong>Formulir CKP Harian:</strong> File yang Anda unggah langsung di tab CKP Harian kini otomatis dikompres sebelum disimpan ke Google Drive. <Link href="/ckp" style={{ color: '#818cf8', textDecoration: 'underline' }}>Buka CKP Harian ↗</Link></li>
          </ul>
        </div>
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className={styles.modalOverlay} onClick={() => setPreviewItem(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Pratinjau: {previewItem.name}</span>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setPreviewItem(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {previewItem.type === 'image' ? (
                <img
                  src={previewItem.previewUrl}
                  alt={previewItem.name}
                  className={styles.previewImage}
                />
              ) : (
                <iframe
                  src={previewItem.previewUrl}
                  title={previewItem.name}
                  className={styles.previewPdfFrame}
                />
              )}
            </div>
            <div className={styles.modalFooter}>
              <span style={{ marginRight: 'auto', fontSize: '13px', color: '#94a3b8' }}>
                Ukuran: {formatBytes(previewItem.compressedSize || previewItem.originalSize)}
              </span>
              <button
                type="button"
                className={styles.downloadAllBtn}
                onClick={() => {
                  triggerDownload(previewItem.compressedFile || previewItem.originalFile, previewItem.name);
                }}
              >
                <Download size={15} /> Unduh File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
