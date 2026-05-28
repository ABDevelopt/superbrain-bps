'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAlert } from '@/contexts/AlertContext';
import { Check, Save, ClipboardList, BarChart2, Download, Edit3, Calendar, Paperclip, Camera, MapPin, X, Trash2, PieChart } from 'lucide-react';
import { skpData } from '@/data/skpData';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadFileToDrive } from '@/lib/drive';
import * as XLSX from 'xlsx';

const SATUAN_OPTIONS = ['Kegiatan', 'Lembar', 'File', 'Dokumen', 'Orang', 'Lainnya'];

const TIM_KERJA_OPTIONS = [
  'Subbagian Umum',
  'Tim IPJKD & DLS',
  'Tim Statistik Sosial',
  'Tim Statistik Harga & Sensus Ekonomi',
];

function getTodayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

function calcDurationMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatDate(dateStr) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthName(monthIdx) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[monthIdx];
}

// Generate rich mock data
function generateMockData() {
  const today = new Date();
  const entries = [];
  let id = 1;

  const mockActivities = [
    { skpId: 1, rincian: 'Entry dan cleaning data SAKERNAS triwulan II', kuantitas: 3, satuan: 'File', timKerja: 'Tim Statistik Sosial' },
    { skpId: 5, rincian: 'Pengolahan data SHK minggu ke-4 Mei', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Tim Statistik Harga & Sensus Ekonomi' },
    { skpId: 9, rincian: 'Review draft tabel publikasi KDA Bab 3', kuantitas: 5, satuan: 'Lembar', timKerja: 'Tim IPJKD & DLS' },
    { skpId: 17, rincian: 'Rapat koordinasi persiapan Sensus Ekonomi 2026', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Subbagian Umum' },
    { skpId: 12, rincian: 'Verifikasi dan validasi data PBI JKN batch 5', kuantitas: 120, satuan: 'Orang', timKerja: 'Tim Statistik Sosial' },
    { skpId: 6, rincian: 'Perhitungan IHK dan Inflasi bulan Mei', kuantitas: 1, satuan: 'Dokumen', timKerja: 'Tim Statistik Harga & Sensus Ekonomi' },
    { skpId: 16, rincian: 'Pelatihan teknis petugas pencacah SUSENAS', kuantitas: 15, satuan: 'Orang', timKerja: 'Tim Statistik Sosial' },
    { skpId: 19, rincian: 'Upload data dan infografis ke website BPS', kuantitas: 2, satuan: 'File', timKerja: 'Tim IPJKD & DLS' },
    { skpId: 22, rincian: 'Pengelolaan surat masuk dan disposisi', kuantitas: 8, satuan: 'Lembar', timKerja: 'Subbagian Umum' },
    { skpId: 7, rincian: 'Persiapan instrumen listing Sensus Ekonomi', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Tim Statistik Harga & Sensus Ekonomi' },
    { skpId: 29, rincian: 'Mengikuti e-learning modul Statistik Dasar', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Subbagian Umum' },
    { skpId: 3, rincian: 'Entry data SUSENAS modul konsumsi', kuantitas: 4, satuan: 'Dokumen', timKerja: 'Tim Statistik Sosial' },
    { skpId: 27, rincian: 'Supervisi lapangan pencacah Kecamatan Singaparna', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Tim Statistik Sosial' },
    { skpId: 15, rincian: 'Maintenance server dan backup database', kuantitas: 1, satuan: 'Kegiatan', timKerja: 'Tim IPJKD & DLS' },
    { skpId: 20, rincian: 'Pelayanan data pengunjung PST', kuantitas: 3, satuan: 'Orang', timKerja: 'Tim IPJKD & DLS' },
  ];

  const timeSlots = [
    { mulai: '07:30', selesai: '09:00' },
    { mulai: '09:15', selesai: '10:30' },
    { mulai: '10:30', selesai: '12:00' },
    { mulai: '13:00', selesai: '14:30' },
    { mulai: '14:30', selesai: '16:00' },
  ];

  // Generate entries for the past 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // Skip weekends

    const dateStr = date.toISOString().split('T')[0];
    const numActivities = 2 + Math.floor(Math.random() * 3); // 2-4 activities/day

    for (let i = 0; i < numActivities && i < timeSlots.length; i++) {
      const act = mockActivities[(dayOffset * 3 + i) % mockActivities.length];
      entries.push({
        id: id++,
        tanggal: dateStr,
        waktuMulai: timeSlots[i].mulai,
        waktuSelesai: timeSlots[i].selesai,
        skpId: act.skpId,
        rincian: act.rincian,
        kuantitas: act.kuantitas,
        satuan: act.satuan,
        timKerja: act.timKerja,
        durasi: calcDurationMinutes(timeSlots[i].mulai, timeSlots[i].selesai),
      });
    }
  }

  return entries;
}

// Toast Component
function Toast({ message, visible, onClose }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  return (
    <div className={`${styles.toast} ${visible ? styles.toastVisible : ''}`}>
      <span className={styles.toastIcon}><Check size={16} /></span>
      <span>{message}</span>
    </div>
  );
}

// TAB 1: Input Kegiatan
function TabInputKegiatan({ onSubmit, onUpdate, initialData, onCancelEdit }) {
  const { accessToken } = useAuth();
  const { showAlert } = useAlert();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const videoRef = useRef(null);
  const [form, setForm] = useState({
    tanggal: getTodayStr(),
    waktuMulai: '',
    waktuSelesai: '',
    skpId: '',
    rincian: '',
    kuantitas: '',
    satuan: 'Kegiatan',
    timKerja: TIM_KERJA_OPTIONS[0],
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        tanggal: initialData.tanggal || getTodayStr(),
        waktuMulai: initialData.waktuMulai || '',
        waktuSelesai: initialData.waktuSelesai || '',
        skpId: initialData.skpId ? String(initialData.skpId) : '',
        rincian: initialData.rincian || '',
        kuantitas: initialData.kuantitas || '',
        satuan: initialData.satuan || 'Kegiatan',
        timKerja: initialData.timKerja || TIM_KERJA_OPTIONS[0],
      });
      setPreviewImage(null);
      setFile(null);
    }
  }, [initialData]);

  const duration = useMemo(
    () => calcDurationMinutes(form.waktuMulai, form.waktuSelesai),
    [form.waktuMulai, form.waktuSelesai]
  );

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const processImage = (imageFile, coords) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Draw Watermark Overlay
        const barHeight = Math.max(120, height * 0.15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - barHeight, width, barHeight);

        // Draw Text
        ctx.fillStyle = 'white';
        const fontSize = Math.max(16, Math.round(width * 0.025));
        ctx.font = `${fontSize}px sans-serif`;
        
        let textY = height - barHeight + fontSize + 10;
        const paddingX = 20;

        // Tanggal & Waktu
        const now = new Date();
        const timeStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        ctx.fillText(`Waktu: ${timeStr}`, paddingX, textY);
        textY += fontSize * 1.5;

        // Koordinat
        if (coords) {
          ctx.fillText(`Lokasi: Lat ${coords.lat.toFixed(6)}, Lon ${coords.lon.toFixed(6)}`, paddingX, textY);
          textY += fontSize * 1.5;
        }

        // Nama Kegiatan
        if (form.rincian) {
          ctx.fillText(`Kegiatan: ${form.rincian.substring(0, 50)}${form.rincian.length > 50 ? '...' : ''}`, paddingX, textY);
        }

        canvas.toBlob((blob) => {
          const newFile = new File([blob], `Geotag_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFile(newFile);
          setPreviewImage(URL.createObjectURL(newFile));
        }, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
  };

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showAlert("Browser Anda tidak mendukung akses kamera langsung.");
        return;
      }

      let constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      };

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (videoDevices.length > 1) {
          // Filter for back-facing cameras
          const backCameras = videoDevices.filter(d => {
            const label = d.label.toLowerCase();
            // Match typical back camera terms
            if (label.includes('back') || label.includes('rear') || label.includes('belakang') || label.includes('environment')) {
              return true;
            }
            // For generic names like "camera 0" (which is back) vs "camera 1" (which is front)
            if (label.includes('camera') || label.includes('kamera')) {
              return !label.includes('front') && !label.includes('depan') && !label.includes('user') && !label.includes('1');
            }
            return false;
          });

          if (backCameras.length > 0) {
            // Attempt to find the primary/main camera (1x)
            // Exclude wide/ultra-wide/tele/macro/0.5/0.6 indicators if possible
            let mainCamera = backCameras.find(d => {
              const label = d.label.toLowerCase();
              return (label.includes('main') || label.includes('utama') || label.includes('primary') || label.includes('0')) &&
                     !label.includes('ultra') && !label.includes('tele') && !label.includes('macro') && !label.includes('0.5') && !label.includes('wide-angle');
            });

            // First Fallback: Avoid wide/macro/0.5/ultra but match general back camera
            if (!mainCamera) {
              mainCamera = backCameras.find(d => {
                const label = d.label.toLowerCase();
                return !label.includes('ultra') && !label.includes('tele') && !label.includes('macro') && !label.includes('0.5');
              });
            }

            // Second Fallback: Use the first back camera in the list
            if (!mainCamera) {
              mainCamera = backCameras[0];
            }

            if (mainCamera && mainCamera.deviceId) {
              constraints = {
                video: {
                  deviceId: { exact: mainCamera.deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                }
              };
            }
          }
        }
      } catch (err) {
        console.warn("Failed to select specific main camera, using default facingMode constraint.", err);
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("Failed to open specific camera device, falling back to environment constraint...", err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        });
      }

      // Check capabilities
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom) setZoomCapabilities(caps.zoom);
        if (caps.torch) setFlashSupported(true);

        // Try to enable continuous autofocus if supported on this browser/track
        if (track.applyConstraints) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
          } catch (_) {
            // Silently ignore if focusMode continuous constraint is not supported
          }
        }
      }

      setZoomLevel(1);
      setFlashOn(false);
      setCameraStream(stream);
      setShowCamera(true);
      document.body.classList.add('camera-open');
    } catch (err) {
      showAlert("Gagal mengakses kamera. " + err.message);
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play error", e));
    }
  }, [showCamera, cameraStream]);

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setShowCamera(false);
    setZoomCapabilities(null);
    setFlashOn(false);
    setFlashSupported(false);
    document.body.classList.remove('camera-open');
  };

  const handleZoomChange = async (val) => {
    setZoomLevel(val);
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0];
      if (track && track.applyConstraints) {
        try { await track.applyConstraints({ advanced: [{ zoom: val }] }); } catch (_) {}
      }
    }
  };

  const handleFlashToggle = async () => {
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0];
      const newState = !flashOn;
      if (track && track.applyConstraints) {
        try { await track.applyConstraints({ advanced: [{ torch: newState }] }); } catch (_) {}
      }
      setFlashOn(newState);
    }
  };

  const handleSnap = () => {
    if (!videoRef.current) return;
    
    const vCanvas = document.createElement('canvas');
    vCanvas.width = videoRef.current.videoWidth;
    vCanvas.height = videoRef.current.videoHeight;
    const vCtx = vCanvas.getContext('2d');
    vCtx.drawImage(videoRef.current, 0, 0);
    
    vCanvas.toBlob((blob) => {
      const snapFile = new File([blob], `snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      
      if (!navigator.geolocation) {
        processImage(snapFile, null);
      } else {
        showAlert("Foto diambil! Mendapatkan titik koordinat lokasi...");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            processImage(snapFile, { lat: latitude, lon: longitude });
          },
          (error) => {
            showAlert("Gagal mendapatkan lokasi. Foto akan disimpan tanpa koordinat.");
            processImage(snapFile, null);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    }, 'image/jpeg', 0.9);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.waktuMulai || !form.waktuSelesai || !form.skpId || !form.rincian) return;
    
    setIsUploading(true);
    let buktiDukungLink = null;

    try {
      if (file && accessToken) {
        buktiDukungLink = await uploadFileToDrive(file, accessToken);
      } else if (file && !accessToken) {
        showAlert('Anda belum memberikan izin akses Google Drive saat login.');
        setIsUploading(false);
        return;
      }

      const dataToSave = {
        ...form,
        skpId: Number(form.skpId),
        kuantitas: Number(form.kuantitas) || 1,
        durasi: duration,
        buktiDukung: buktiDukungLink || (initialData ? initialData.buktiDukung : null)
      };

      if (initialData && onUpdate) {
        await onUpdate(initialData.id, dataToSave);
      } else {
        await onSubmit(dataToSave);
      }

      // Reset form
      setForm({
        tanggal: getTodayStr(),
        waktuMulai: '',
        waktuSelesai: '',
        skpId: '',
        rincian: '',
        kuantitas: '',
        satuan: 'Kegiatan',
        timKerja: TIM_KERJA_OPTIONS[0],
      });
      setFile(null);
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
      if (initialData && onCancelEdit) onCancelEdit();
    } catch (err) {
      showAlert('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const cameraModal = (showCamera && mounted) ? createPortal(
    <div className={styles.cameraOverlay}>
      {/* Top bar */}
      <div className={styles.cameraTopBar}>
        <div className={styles.cameraTitle}>
          <div className={styles.cameraTitleIcon}>
            <Camera size={16} color="#fff" />
          </div>
          Kamera Geotag
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {flashSupported && (
            <button
              type="button"
              onClick={handleFlashToggle}
              className={styles.cameraCloseBtn}
              title={flashOn ? 'Matikan Flash' : 'Nyalakan Flash'}
              style={{ background: flashOn ? 'rgba(251, 191, 36, 0.3)' : undefined }}
            >
              <span style={{ fontSize: '18px' }}>{flashOn ? '⚡' : '🔦'}</span>
            </button>
          )}
          <button type="button" onClick={closeCamera} className={styles.cameraCloseBtn}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Live video stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={styles.cameraViewfinder}
      />

      {/* Corner guide brackets */}
      <div className={styles.cameraGuide}>
        <div className={styles.cameraGuideInner}>
          <div className={styles.cameraGuideCornerBR} />
          <div className={styles.cameraGuideCornerBL} />
        </div>
      </div>

      {/* Zoom slider */}
      {zoomCapabilities && (
        <div className={styles.cameraZoomBar}>
          <span className={styles.cameraZoomLabel}>🔍 {zoomLevel.toFixed(1)}×</span>
          <input
            type="range"
            min={zoomCapabilities.min || 1}
            max={Math.min(zoomCapabilities.max || 5, 5)}
            step={zoomCapabilities.step || 0.1}
            value={zoomLevel}
            onChange={e => handleZoomChange(parseFloat(e.target.value))}
            className={styles.cameraZoomSlider}
          />
        </div>
      )}

      {/* Hint text */}
      <div className={styles.cameraHint}>Tekan tombol bulat untuk mengambil foto</div>

      {/* Bottom shutter controls */}
      <div className={styles.cameraBottomBar}>
        <button
          type="button"
          onClick={handleSnap}
          className={styles.cameraShutterOuter}
          title="Ambil Foto"
        >
          <div className={styles.cameraShutterInner} />
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Tanggal Kegiatan</label>
          <input
            type="date"
            className={styles.input}
            value={form.tanggal}
            onChange={handleChange('tanggal')}
            required
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Waktu Mulai</label>
          <input
            type="time"
            className={styles.input}
            value={form.waktuMulai}
            onChange={handleChange('waktuMulai')}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Waktu Selesai</label>
          <input
            type="time"
            className={styles.input}
            value={form.waktuSelesai}
            onChange={handleChange('waktuSelesai')}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Durasi</label>
          <div className={styles.durationDisplay}>
            {duration > 0 ? formatDuration(duration) : '—'}
          </div>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Butir SKP</label>
        <select
          className={styles.select}
          value={form.skpId}
          onChange={handleChange('skpId')}
          required
        >
          <option value="">— Pilih Butir SKP —</option>
          {skpData.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}. {item.nama}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Rincian Kegiatan</label>
        <textarea
          className={styles.textarea}
          value={form.rincian}
          onChange={handleChange('rincian')}
          placeholder="Deskripsikan kegiatan yang dilakukan..."
          rows={3}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Bukti Dukung (Opsional)</label>
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
          <div className={styles.fileInputWrapper} style={{flex: 1}}>
            <input
              type="file"
              className={styles.fileInput}
              ref={fileInputRef}
              onChange={(e) => {
                setFile(e.target.files[0]);
                setPreviewImage(null);
              }}
              id="buktiDukung"
            />
            <label htmlFor="buktiDukung" className={styles.fileLabel} style={{height: '100%'}}>
              <Paperclip size={18} /> 
              {file && !previewImage ? file.name : 'Pilih File PDF/Doc...'}
            </label>
          </div>
          
          <div className={styles.fileInputWrapper} style={{flex: 1}}>
            <button type="button" onClick={openCamera} className={styles.fileLabel} style={{background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px dashed rgba(56, 189, 248, 0.4)', height: '100%', width: '100%'}}>
              <Camera size={18} /> 
              Ambil Foto Geotag
            </button>
          </div>
        </div>
        
        {previewImage && (
          <div className={styles.cameraPreviewContainer}>
            <img src={previewImage} alt="Preview Geotag" className={styles.cameraPreviewImg} />
            <button
              type="button"
              className={styles.cameraPreviewRetake}
              onClick={() => { setPreviewImage(null); setFile(null); }}
            >
              <Camera size={12} /> Ambil Ulang
            </button>
            <div className={styles.cameraPreviewLabel}>
              <Check size={14} /> Foto Geotag siap diunggah
            </div>
          </div>
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Kuantitas Hasil/Output</label>
          <input
            type="number"
            className={styles.input}
            value={form.kuantitas}
            onChange={handleChange('kuantitas')}
            placeholder="1"
            min="0"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Satuan Kuantitas</label>
          <select
            className={styles.select}
            value={form.satuan}
            onChange={handleChange('satuan')}
          >
            {SATUAN_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Tim Kerja</label>
        <div className={styles.radioGroup}>
          {TIM_KERJA_OPTIONS.map((tim) => (
            <label key={tim} className={styles.radioLabel}>
              <input
                type="radio"
                name="timKerja"
                value={tim}
                checked={form.timKerja === tim}
                onChange={handleChange('timKerja')}
                className={styles.radioInput}
              />
              <span className={styles.radioCustom} />
              <span className={styles.radioText}>{tim}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="submit" className={styles.submitBtn} disabled={isUploading}>
          {isUploading ? (
            <div className={styles.spinnerSmall} />
          ) : (
            <span className={styles.submitIcon}><Save size={18} /></span>
          )}
          {isUploading ? 'Menyimpan...' : (initialData ? 'Perbarui Kegiatan' : 'Simpan Kegiatan')}
        </button>
        {initialData && (
          <button type="button" onClick={onCancelEdit} style={{ padding: '0 24px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontWeight: '500' }}>
            Batal Edit
          </button>
        )}
      </div>

      {/* Camera Modal */}
      {cameraModal}
    </form>
  );
}

// TAB 2: Rekap Harian
function TabRekapHarian({ entries, onEdit, onDelete }) {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  const dayEntries = useMemo(
    () => entries
      .filter((e) => e.tanggal === selectedDate)
      .sort((a, b) => a.waktuMulai.localeCompare(b.waktuMulai)),
    [entries, selectedDate]
  );

  const totalDurasi = useMemo(
    () => dayEntries.reduce((sum, e) => sum + e.durasi, 0),
    [dayEntries]
  );

  const getSkpName = (skpId) => {
    const item = skpData.find((s) => s.id === skpId);
    return item ? item.nama : 'N/A';
  };

  return (
    <div className={styles.rekapContainer}>
      <div className={styles.datePickerRow}>
        <label className={styles.label}>Pilih Tanggal:</label>
        <input
          type="date"
          className={styles.input}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <h3 className={styles.rekapTitle}>{formatDate(selectedDate)}</h3>

      {dayEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><ClipboardList size={48} /></span>
          <p>Belum ada kegiatan tercatat pada tanggal ini.</p>
        </div>
      ) : (
        <>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{dayEntries.length}</span>
              <span className={styles.statLabel}>Jumlah Kegiatan</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValue}>{formatDuration(totalDurasi)}</span>
              <span className={styles.statLabel}>Total Jam Kerja</span>
            </div>
          </div>

          <div className={styles.timeline}>
            {dayEntries.map((entry) => (
              <div key={entry.id} className={styles.timelineItem}>
                <div className={styles.timelineDot} />
                <div className={styles.timelineCard}>
                  <div className={styles.timelineTime} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      {entry.waktuMulai} — {entry.waktuSelesai}
                      <span className={styles.timelineDuration}>{formatDuration(entry.durasi)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => onEdit(entry)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }} title="Edit"><Edit3 size={16} /></button>
                      <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Hapus"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className={styles.timelineSkp}>
                    SKP #{entry.skpId}: {getSkpName(entry.skpId)}
                  </div>
                  <div className={styles.timelineRincian}>{entry.rincian}</div>
                  {entry.buktiDukung && (
                    <a href={entry.buktiDukung} target="_blank" rel="noopener noreferrer" className={styles.buktiLink}>
                      <Paperclip size={14} /> Lihat Bukti Dukung
                    </a>
                  )}
                  <div className={styles.timelineOutput}>
                    Output: {entry.kuantitas} {entry.satuan}
                    <span className={styles.timelineTim}>{entry.timKerja}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// TAB 3: Rekap Bulanan
function TabRekapBulanan({ entries }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());

  const monthData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const data = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEntries = entries.filter((e) => e.tanggal === dateStr);
      const dow = new Date(dateStr + 'T00:00:00').getDay();

      if (dayEntries.length > 0) {
        const totalDurasi = dayEntries.reduce((sum, e) => sum + e.durasi, 0);
        const skpIds = [...new Set(dayEntries.map((e) => e.skpId))];
        data.push({
          tanggal: dateStr,
          hari: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dow],
          jumlahKegiatan: dayEntries.length,
          totalJam: totalDurasi,
          skpIds,
          isWeekend: dow === 0 || dow === 6,
        });
      }
    }
    return data;
  }, [entries, selectedMonth]);

  const totalKegiatan = monthData.reduce((s, d) => s + d.jumlahKegiatan, 0);
  const totalJam = monthData.reduce((s, d) => s + d.totalJam, 0);
  const hariKerja = monthData.filter((d) => !d.isWeekend).length;
  const rataRata = hariKerja > 0 ? Math.round(totalJam / hariKerja) : 0;

  const [yearVal, monthVal] = selectedMonth.split('-').map(Number);

  const handleExport = () => {
    const [year, month] = selectedMonth.split('-');
    const prefix = `${year}-${month}-`;
    
    const monthEntries = entries.filter(e => e.tanggal && e.tanggal.startsWith(prefix));
    
    if (monthEntries.length === 0) {
      showAlert('Tidak ada data untuk diekspor pada bulan ini.');
      return;
    }

    const dataRows = monthEntries.map(e => ({
      'Tanggal': e.tanggal,
      'Waktu Mulai': e.waktuMulai,
      'Waktu Selesai': e.waktuSelesai,
      'Durasi (Menit)': e.durasi,
      'ID SKP': e.skpId || '',
      'Tim Kerja': e.timKerja || '',
      'Rincian Kegiatan': e.rincian || '',
      'Kuantitas': e.kuantitas || 0,
      'Satuan': e.satuan || '',
      'Bukti Dukung': e.buktiDukung || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap CKP");

    XLSX.writeFile(workbook, `Rekap_CKP_${getMonthName(monthVal - 1)}_${yearVal}.xlsx`);
  };

  return (
    <div className={styles.rekapContainer}>
      <div className={styles.datePickerRow}>
        <label className={styles.label}>Pilih Bulan:</label>
        <input
          type="month"
          className={styles.input}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      <h3 className={styles.rekapTitle}>
        Rekap {getMonthName(monthVal - 1)} {yearVal}
      </h3>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalKegiatan}</span>
          <span className={styles.statLabel}>Total Kegiatan</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{formatDuration(totalJam)}</span>
          <span className={styles.statLabel}>Total Jam Kerja</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{hariKerja}</span>
          <span className={styles.statLabel}>Hari Kerja Aktif</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{formatDuration(rataRata)}</span>
          <span className={styles.statLabel}>Rata-rata/Hari</span>
        </div>
      </div>

      {monthData.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><BarChart2 size={48} /></span>
          <p>Belum ada data kegiatan bulan ini.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Kegiatan</th>
                <th>Total Jam</th>
                <th>Butir SKP yang Dikerjakan</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((row) => (
                <tr key={row.tanggal} className={row.isWeekend ? styles.weekendRow : ''}>
                  <td>{row.tanggal.split('-')[2]}</td>
                  <td>{row.hari}</td>
                  <td>{row.jumlahKegiatan}</td>
                  <td>{formatDuration(row.totalJam)}</td>
                  <td>
                    <div className={styles.skpBadges}>
                      {row.skpIds.map((sid) => (
                        <span key={sid} className={styles.skpBadge}>#{sid}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className={styles.exportBtn} onClick={handleExport}>
        <span><Download size={18} style={{marginRight: '8px'}} /></span> Export Rekap Bulanan
      </button>
    </div>
  );
}
// TAB 4: Rekap Triwulanan
function TabRekapTriwulanan({ entries }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);

  const quarterData = useMemo(() => {
    const startMonth = (selectedQuarter - 1) * 3 + 1; // 1, 4, 7, 10
    const endMonth = startMonth + 2; // 3, 6, 9, 12
    const data = [];

    for (let m = startMonth; m <= endMonth; m++) {
      const monthPrefix = `${selectedYear}-${String(m).padStart(2, '0')}-`;
      const monthEntries = entries.filter(e => e.tanggal && e.tanggal.startsWith(monthPrefix));
      
      const totalKegiatan = monthEntries.length;
      const totalJam = monthEntries.reduce((sum, e) => sum + e.durasi, 0);
      
      const activeDays = new Set(monthEntries.map(e => e.tanggal)).size;
      const rataRata = activeDays > 0 ? Math.round(totalJam / activeDays) : 0;
      const skpIds = [...new Set(monthEntries.map((e) => e.skpId))];

      data.push({
        bulan: getMonthName(m - 1),
        jumlahKegiatan: totalKegiatan,
        totalJam,
        hariKerja: activeDays,
        rataRata,
        skpIds
      });
    }
    return data;
  }, [entries, selectedYear, selectedQuarter]);

  const totalKegiatan = quarterData.reduce((s, d) => s + d.jumlahKegiatan, 0);
  const totalJam = quarterData.reduce((s, d) => s + d.totalJam, 0);
  const totalHariKerja = quarterData.reduce((s, d) => s + d.hariKerja, 0);
  const rataRataQ = totalHariKerja > 0 ? Math.round(totalJam / totalHariKerja) : 0;

  const handleExport = () => {
    const startMonth = (selectedQuarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const qEntries = entries.filter(e => {
      if(!e.tanggal) return false;
      const [y, m] = e.tanggal.split('-').map(Number);
      return y === selectedYear && m >= startMonth && m <= endMonth;
    });

    if (qEntries.length === 0) {
      showAlert('Tidak ada data untuk diekspor pada triwulan ini.');
      return;
    }

    const dataRows = qEntries.map(e => ({
      'Tanggal': e.tanggal,
      'Waktu Mulai': e.waktuMulai,
      'Waktu Selesai': e.waktuSelesai,
      'Durasi (Menit)': e.durasi,
      'ID SKP': e.skpId || '',
      'Tim Kerja': e.timKerja || '',
      'Rincian Kegiatan': e.rincian || '',
      'Kuantitas': e.kuantitas || 0,
      'Satuan': e.satuan || '',
      'Bukti Dukung': e.buktiDukung || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Triwulan");
    XLSX.writeFile(workbook, `Rekap_CKP_Triwulan_${selectedQuarter}_${selectedYear}.xlsx`);
  };

  return (
    <div className={styles.rekapContainer}>
      <div className={styles.datePickerRow} style={{ gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className={styles.label}>Tahun:</label>
          <select 
            className={styles.input} 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className={styles.label}>Triwulan:</label>
          <select 
            className={styles.input} 
            value={selectedQuarter} 
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
          >
            <option value={1}>Triwulan 1 (Jan - Mar)</option>
            <option value={2}>Triwulan 2 (Apr - Jun)</option>
            <option value={3}>Triwulan 3 (Jul - Sep)</option>
            <option value={4}>Triwulan 4 (Okt - Des)</option>
          </select>
        </div>
      </div>

      <h3 className={styles.rekapTitle}>
        Rekap Triwulan {selectedQuarter} Tahun {selectedYear}
      </h3>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalKegiatan}</span>
          <span className={styles.statLabel}>Total Kegiatan</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{formatDuration(totalJam)}</span>
          <span className={styles.statLabel}>Total Jam Kerja</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalHariKerja}</span>
          <span className={styles.statLabel}>Total Hari Aktif</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{formatDuration(rataRataQ)}</span>
          <span className={styles.statLabel}>Rata-rata/Hari</span>
        </div>
      </div>

      {totalKegiatan === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><PieChart size={48} /></span>
          <p>Belum ada data kegiatan triwulan ini.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Total Kegiatan</th>
                <th>Total Jam</th>
                <th>Hari Aktif</th>
                <th>Butir SKP yang Dikerjakan</th>
              </tr>
            </thead>
            <tbody>
              {quarterData.map((row) => (
                <tr key={row.bulan}>
                  <td><strong>{row.bulan}</strong></td>
                  <td>{row.jumlahKegiatan}</td>
                  <td>{formatDuration(row.totalJam)}</td>
                  <td>{row.hariKerja} hari</td>
                  <td>
                    <div className={styles.skpBadges}>
                      {row.skpIds.map((sid) => (
                        <span key={sid} className={styles.skpBadge}>#{sid}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className={styles.exportBtn} onClick={handleExport}>
        <span><Download size={18} style={{marginRight: '8px'}} /></span> Export Rekap Triwulanan
      </button>
    </div>
  );
}
// Main Page
export default function CKPPage() {
  const [activeTab, setActiveTab] = useState(0);
  const { docs: entries, loading, addDocument, updateDocument, deleteDocument } = useFirestore('ckp');
  const [toastVisible, setToastVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setActiveTab(0);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDocument(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (e) {
      showAlert('Gagal menghapus kegiatan: ' + e.message);
    }
  };

  const handleUpdate = async (id, formData) => {
    try {
      await updateDocument(id, formData);
      setToastVisible(true);
      setEditingEntry(null);
      setActiveTab(1); // switch to rekap tab
    } catch (e) {
      showAlert('Gagal memperbarui kegiatan: ' + e.message);
    }
  };

  const handleSubmit = useCallback(async (formData) => {
    await addDocument(formData);
    setToastVisible(true);

    // Telegram Notification
    const chatId = localStorage.getItem('telegramChatId');
    if (chatId) {
      try {
        const skpName = skpData.find(s => s.id === formData.skpId)?.nama || 'N/A';
        const msg = `*Kegiatan CKP Baru*\n\n*SKP:* ${skpName}\n*Rincian:* ${formData.rincian}\n*Waktu:* ${formData.waktuMulai} - ${formData.waktuSelesai}\n*Output:* ${formData.kuantitas} ${formData.satuan}`;
        
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: msg }),
        });
      } catch (e) {
        console.error('Failed to send telegram notification:', e);
      }
    }
  }, [addDocument]);

  const hideToast = useCallback(() => setToastVisible(false), []);

  const tabs = ['Input Kegiatan', 'Rekap Harian', 'Rekap Bulanan', 'Rekap Triwulanan'];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Capaian Kinerja Harian</h1>
        <p className={styles.pageSubtitle}>
          Pencatatan dan monitoring CKP harian pegawai BPS
        </p>
      </header>

      <div className={styles.tabBar}>
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === idx ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            <span className={styles.tabIcon}>
              {idx === 0 ? <Edit3 size={18} /> : idx === 1 ? <Calendar size={18} /> : idx === 2 ? <BarChart2 size={18} /> : <PieChart size={18} />}
            </span>
            {tab}
          </button>
        ))}
        <div
          className={styles.tabIndicator}
          style={{ transform: `translateX(${activeTab * 100}%)` }}
        />
      </div>

      <main className={styles.tabContent}>
        {loading && activeTab !== 0 ? (
          <div className={styles.loadingState}>Memuat data...</div>
        ) : (
          <>
            {activeTab === 0 && (
              <TabInputKegiatan 
                onSubmit={handleSubmit} 
                onUpdate={handleUpdate} 
                initialData={editingEntry}
                onCancelEdit={handleCancelEdit} 
              />
            )}
            {activeTab === 1 && <TabRekapHarian entries={entries} onEdit={handleEdit} onDelete={handleDelete} />}
            {activeTab === 2 && <TabRekapBulanan entries={entries} />}
            {activeTab === 3 && <TabRekapTriwulanan entries={entries} />}
          </>
        )}
      </main>

      <ConfirmDialog 
        isOpen={!!confirmDeleteId} 
        onConfirm={executeDelete} 
        onCancel={() => setConfirmDeleteId(null)} 
        title="Hapus Kegiatan" 
        message="Apakah Anda yakin ingin menghapus kegiatan CKP ini?" 
        confirmText="Hapus" 
        variant="danger" 
      />

      <Toast message="Kegiatan berhasil disimpan!" visible={toastVisible} onClose={hideToast} />
    </div>
  );
}
