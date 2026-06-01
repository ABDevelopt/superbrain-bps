'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAlert } from '@/contexts/AlertContext';
import { Check, Save, ClipboardList, BarChart2, Download, Edit3, Calendar, Paperclip, Camera, MapPin, X, Trash2, PieChart, Zap, ZapOff, RefreshCw, ZoomIn, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { skpData } from '@/data/skpData';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useFirestore } from '@/hooks/useFirestore';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadFileToDrive } from '@/lib/drive';
import { useChatAction } from '@/contexts/ChatActionContext';
import { useAIContext } from '@/contexts/AIContext';
import * as XLSX from 'xlsx';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SATUAN_OPTIONS = ['Kegiatan', 'Lembar', 'File', 'Dokumen', 'Orang', 'Lainnya'];

const getColorForSkp = (skpId) => {
  if (!skpId || isNaN(Number(skpId)) || Number(skpId) === 0) return 'rgba(148, 163, 184, 0.8)'; // slate-400
  const hue = (Number(skpId) * 137.5) % 360;
  return `hsla(${hue}, 75%, 55%, 0.85)`;
};

const TIM_KERJA_OPTIONS = [
  'Subbagian Umum',
  'Tim IPJKD & DLS',
  'Tim Statistik Sosial',
  'Tim Statistik Harga & Sensus Ekonomi',
  'Tim Distribusi',
  'Tim PST dan Medsos PPU',
  'Tim Pelaksana & TPB EPSS',
  'Tim ZI',
  'Tim Desa Cantik'
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
function TabInputKegiatan({ onSubmit, onUpdate, initialData = null, onCancelEdit, entries, sharedDate, setSharedDate }) {
  const { accessToken } = useAuth();
  const { showAlert } = useAlert();
  const [mounted, setMounted] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [skpSearch, setSkpSearch] = useState('');
  const [showSkpDropdown, setShowSkpDropdown] = useState(false);
  const skpDropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (skpDropdownRef.current && !skpDropdownRef.current.contains(event.target)) {
        setShowSkpDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);useEffect(() => setMounted(true), []);
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [coordsCache, setCoordsCache] = useState(null);
  const [cameraLens, setCameraLens] = useState('1x');
  const videoRef = useRef(null);
  const [form, setForm] = useState({
    tanggal: sharedDate || getTodayStr(),
    isFullday: false,
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
        tanggal: initialData.tanggal || sharedDate || getTodayStr(),
        waktuMulai: initialData.waktuMulai || '',
        waktuSelesai: initialData.waktuSelesai || '',
        skpId: initialData.skpId ? String(initialData.skpId) : '',
        rincian: initialData.rincian || '',
        kuantitas: initialData.kuantitas || '',
        satuan: initialData.satuan || 'Kegiatan',
        timKerja: initialData.timKerja || TIM_KERJA_OPTIONS[0],
        _fromScheduleEventId: initialData.fromScheduleEventId || null,
        _sumber: initialData.sumber || 'manual',
        _sourceScheduleId: initialData.sourceScheduleId || null,
        _sourceTaskId: initialData.sourceTaskId || null,
      });
      setSkpSearch(initialData.skpId ? (skpData.find(s => s.id === initialData.skpId)?.nama || '') : '');
      setPreviewImage(null);
      setFile(null);
    } else {
      setForm(prev => ({ ...prev, tanggal: sharedDate }));
    }
  }, [initialData, sharedDate]);

  const { docs: scheduleEvents = [] } = useFirestore('schedule');

  const todayScheduleEvents = useMemo(() => {
    return scheduleEvents
      .filter(ev => ev.tanggal === form.tanggal)
      .sort((a, b) => (a.waktu || '').localeCompare(b.waktu || ''));
  }, [scheduleEvents, form.tanggal]);

  const handleAmbilDariJadwal = (event) => {
    setForm(prev => ({
      ...prev,
      waktuMulai: event.waktu || prev.waktuMulai,
      waktuSelesai: event.waktuSelesai || prev.waktuSelesai,
      skpId: event.skpId ? String(event.skpId) : prev.skpId,
      rincian: event.judul + (event.deskripsi ? '\n' + event.deskripsi : ''),
      _sumber: 'jadwal',
      _sourceScheduleId: event.id,
      _fromScheduleEventId: event.id,
    }));
    if (event.skpId) {
        setSkpSearch(skpData.find(s => s.id === event.skpId)?.nama || '');
    }
    setShowSchedulePicker(false);
  };

  const duration = useMemo(
    () => calcDurationMinutes(form.waktuMulai, form.waktuSelesai),
    [form.waktuMulai, form.waktuSelesai]
  );

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (field === 'tanggal') {
      setSharedDate(e.target.value);
    }
  };

  const filteredSkp = useMemo(() => {
      return skpData.filter(s => s.nama.toLowerCase().includes(skpSearch.toLowerCase()));
  }, [skpSearch]);

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

        const barHeight = Math.max(120, height * 0.15);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - barHeight, width, barHeight);

        ctx.fillStyle = 'white';
        const fontSize = Math.max(16, Math.round(width * 0.025));
        ctx.font = `${fontSize}px sans-serif`;
        
        let textY = height - barHeight + fontSize + 10;
        const paddingX = 20;

        const now = new Date();
        const timeStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        ctx.fillText(`Waktu: ${timeStr}`, paddingX, textY);
        textY += fontSize * 1.5;

        if (coords) {
          ctx.fillText(`Lokasi: Lat ${coords.lat.toFixed(6)}, Lon ${coords.lon.toFixed(6)}`, paddingX, textY);
          textY += fontSize * 1.5;
        }

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

  const initCamera = async (isFront, lens) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showAlert("Browser Anda tidak mendukung akses kamera langsung.");
        return;
      }

      let constraints = {
        video: {
          facingMode: isFront ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      };

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        if (videoDevices.length > 1) {
          if (isFront) {
            const frontCameras = videoDevices.filter(d => {
              const label = d.label.toLowerCase();
              return label.includes('front') || label.includes('depan') || label.includes('user') || label.includes('1');
            });
            
            let mainFront = frontCameras.find(d => d.label.toLowerCase().includes('0') || d.label.toLowerCase().includes('primary'));
            if (!mainFront && frontCameras.length > 0) mainFront = frontCameras[0];
            
            if (mainFront && mainFront.deviceId) {
              constraints = {
                video: {
                  deviceId: { exact: mainFront.deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                }
              };
            }
          } else {
            const backCameras = videoDevices.filter(d => {
              const label = d.label.toLowerCase();
              if (label.includes('back') || label.includes('rear') || label.includes('belakang') || label.includes('environment')) {
                return true;
              }
              if (label.includes('camera') || label.includes('kamera')) {
                return !label.includes('front') && !label.includes('depan') && !label.includes('user') && !label.includes('1');
              }
              return false;
            });

            if (backCameras.length > 0) {
              let targetDevice = null;
              
              if (lens === '0.5x') {
                targetDevice = backCameras.find(d => {
                  const label = d.label.toLowerCase();
                  return label.includes('ultra') || label.includes('wide-angle') || label.includes('0.5') || label.includes('0.6') || label.includes('2') || label.includes('3') || label.includes('aux');
                });
                
                if (!targetDevice && backCameras.length > 1) {
                  targetDevice = backCameras[1];
                }
              } else {
                targetDevice = backCameras.find(d => {
                  const label = d.label.toLowerCase();
                  return (label.includes('main') || label.includes('utama') || label.includes('primary') || label.includes('0')) &&
                         !label.includes('ultra') && !label.includes('tele') && !label.includes('macro') && !label.includes('0.5') && !label.includes('wide-angle');
                });
                
                if (!targetDevice) {
                  targetDevice = backCameras.find(d => {
                    const label = d.label.toLowerCase();
                    return !label.includes('ultra') && !label.includes('tele') && !label.includes('macro') && !label.includes('0.5');
                  });
                }
              }

              if (!targetDevice) {
                targetDevice = backCameras[0];
              }

              if (targetDevice && targetDevice.deviceId) {
                constraints = {
                  video: {
                    deviceId: { exact: targetDevice.deviceId },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                  }
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to select specific camera, using default facingMode constraint.", err);
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("Failed to open specific camera device, falling back to environment/user constraint...", err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: isFront ? 'user' : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        });
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom) setZoomCapabilities(caps.zoom);
        if (caps.torch) setFlashSupported(true);

        if (!caps.zoom) setZoomCapabilities(null);
        if (!caps.torch) setFlashSupported(false);

        if (track.applyConstraints) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }]
            });
          } catch (_) {}
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

  const openCamera = async () => {
    setUseFrontCamera(false);
    setCameraLens('1x');
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setCoordsCache(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
          setCoordsCache(coords);
        },
        (error) => {
          console.warn("Location pre-fetch failed:", error);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    await initCamera(false, '1x');
  };

  const handleCameraSwitch = async () => {
    const nextFacing = !useFrontCamera;
    setUseFrontCamera(nextFacing);
    setCameraLens('1x');
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    await initCamera(nextFacing, '1x');
  };

  const handleLensSwitch = async (lens) => {
    if (lens === cameraLens) return;
    setCameraLens(lens);
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    await initCamera(false, lens);
  };

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream && !capturedPhotoUrl) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error("Video play error", e));
    }
  }, [showCamera, cameraStream, capturedPhotoUrl]);

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setShowCamera(false);
    setZoomCapabilities(null);
    setFlashOn(false);
    setFlashSupported(false);
    setUseFrontCamera(false);
    setCameraLens('1x');
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setCoordsCache(null);
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
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedPhotoUrl(url);
    }, 'image/jpeg', 0.95);
  };

  const handleRetakePhoto = () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
  };

  const handleConfirmPhoto = () => {
    if (!capturedBlob) return;
    
    const snapFile = new File([capturedBlob], `snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    if (coordsCache) {
      closeCamera();
      processImage(snapFile, coordsCache);
    } else {
      showAlert("Mendapatkan lokasi gps...");
      if (!navigator.geolocation) {
        closeCamera();
        processImage(snapFile, null);
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
            closeCamera();
            processImage(snapFile, coords);
          },
          (error) => {
            showAlert("Gagal mendapatkan lokasi. Foto disimpan tanpa koordinat.");
            closeCamera();
            processImage(snapFile, null);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.isFullday && (!form.waktuMulai || !form.waktuSelesai)) return;
    if (!form.rincian) return;
    
    setIsUploading(true);
    let buktiDukungLink = null;

    try {
      if (file && accessToken) {
        try {
          buktiDukungLink = await uploadFileToDrive(file, accessToken);
        } catch (err) {
          console.error("Upload error:", err);
          showAlert('Gagal mengunggah file ke Google Drive, namun data CKP tetap akan disimpan.');
        }
      } else if (file && !accessToken) {
        showAlert('Info: Foto/file tidak diunggah karena Anda belum memberi izin akses Google Drive. Data CKP tetap disimpan.');
      }

      const dataToSave = {
        ...form,
        skpId: form.skpId ? Number(form.skpId) : null,
        kuantitas: Number(form.kuantitas) || 1,
        durasi: duration,
        buktiDukung: buktiDukungLink || (initialData ? initialData.buktiDukung : null) || null,
        fromScheduleEventId: form._fromScheduleEventId || (initialData ? initialData.fromScheduleEventId : null) || null,
        sumber: form._sumber || (initialData ? initialData.sumber : 'manual') || 'manual',
        sourceScheduleId: form._sourceScheduleId || (initialData ? initialData.sourceScheduleId : null) || null,
        sourceTaskId: form._sourceTaskId || (initialData ? initialData.sourceTaskId : null) || null,
      };

      delete dataToSave._fromScheduleEventId;
      delete dataToSave._sumber;
      delete dataToSave._sourceScheduleId;
      delete dataToSave._sourceTaskId;

      if (form.isFullday) {
        // Find all gaps
        const dow = new Date(form.tanggal + 'T00:00:00').getDay();
        if (dow === 0 || dow === 6) {
          setIsUploading(false);
          return showAlert("Fitur Fullday tidak tersedia untuk hari libur (Sabtu/Minggu).");
        }

        const START_MIN = 7 * 60 + 30;
        const END_MIN = dow === 5 ? 16 * 60 + 30 : 16 * 60;
        const dayEntries = entries
          .filter(en => en.tanggal === form.tanggal)
          .sort((a, b) => (a.waktuMulai || '').localeCompare(b.waktuMulai || ''));
        
        const gaps = [];
        let currentPos = START_MIN;
        for (const en of dayEntries) {
          if (!en.waktuMulai || !en.waktuSelesai) continue;
          const [h1, m1] = en.waktuMulai.split(':').map(Number);
          const [h2, m2] = en.waktuSelesai.split(':').map(Number);
          const start = h1 * 60 + m1;
          const end = h2 * 60 + m2;
          
          if (start > currentPos) {
            gaps.push({ start: currentPos, end: start });
          }
          currentPos = Math.max(currentPos, end);
        }
        if (currentPos < END_MIN) {
          gaps.push({ start: currentPos, end: END_MIN });
        }

        if (gaps.length === 0) {
          setIsUploading(false);
          return showAlert("Hari ini sudah penuh, tidak ada waktu tersisa untuk diisi.");
        }

        const formatTimeStr = (totalMins) => {
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        };

        for (const gap of gaps) {
          const d = gap.end - gap.start;
          const gapData = { 
            ...dataToSave, 
            waktuMulai: formatTimeStr(gap.start), 
            waktuSelesai: formatTimeStr(gap.end), 
            durasi: d 
          };
          delete gapData.isFullday;
          await onSubmit(gapData);
        }
      } else {
        delete dataToSave.isFullday;
        if (initialData && initialData.id && onUpdate) {
          await onUpdate(initialData.id, dataToSave);
        } else {
          await onSubmit(dataToSave);
        }
      }

      setForm({
        tanggal: sharedDate || getTodayStr(),
        isFullday: false,
        waktuMulai: '',
        waktuSelesai: '',
        skpId: '',
        rincian: '',
        kuantitas: '',
        satuan: 'Kegiatan',
        timKerja: TIM_KERJA_OPTIONS[0],
        _sumber: 'manual',
        _sourceScheduleId: null,
        _sourceTaskId: null,
        _fromScheduleEventId: null,
      });
      setSkpSearch('');
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
      <div className={styles.cameraTopBar}>
        <div className={styles.cameraTitle}>
          <div className={styles.cameraTitleIcon}>
            <Camera size={16} color="#fff" />
          </div>
          Kamera Geotag
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!capturedPhotoUrl && flashSupported && (
            <button
              type="button"
              onClick={handleFlashToggle}
              className={styles.cameraCloseBtn}
              title={flashOn ? 'Matikan Flash' : 'Nyalakan Flash'}
              style={{ background: flashOn ? 'rgba(251, 191, 36, 0.3)' : undefined }}
            >
              {flashOn ? <Zap size={18} color="#fbbf24" fill="#fbbf24" /> : <ZapOff size={18} />}
            </button>
          )}
          {!capturedPhotoUrl && (
            <button
              type="button"
              onClick={handleCameraSwitch}
              className={styles.cameraCloseBtn}
              title="Ganti Kamera"
            >
              <RefreshCw size={18} />
            </button>
          )}
          <button type="button" onClick={closeCamera} className={styles.cameraCloseBtn}>
            <X size={20} />
          </button>
        </div>
      </div>

      {capturedPhotoUrl ? (
        <img
          src={capturedPhotoUrl}
          alt="Preview Jepretan"
          className={styles.cameraViewfinder}
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={styles.cameraViewfinder}
        />
      )}

      <div className={styles.cameraGuide}>
        <div className={styles.cameraGuideInner}>
          <div className={styles.cameraGuideCornerBR} />
          <div className={styles.cameraGuideCornerBL} />
        </div>
      </div>

      {!useFrontCamera && !capturedPhotoUrl && (
        <div className={styles.lensPill}>
          <button
            type="button"
            className={`${styles.lensBtn} ${cameraLens === '0.5x' ? styles.lensBtnActive : ''}`}
            onClick={() => handleLensSwitch('0.5x')}
          >
            0.5
          </button>
          <button
            type="button"
            className={`${styles.lensBtn} ${cameraLens === '1x' ? styles.lensBtnActive : ''}`}
            onClick={() => handleLensSwitch('1x')}
          >
            1.0
          </button>
        </div>
      )}

      {!capturedPhotoUrl && zoomCapabilities && (
        <div className={styles.cameraZoomBar}>
          <span className={styles.cameraZoomLabel}>
            <ZoomIn size={14} style={{ marginRight: '4px' }} /> {zoomLevel.toFixed(1)}×
          </span>
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

      <div className={styles.cameraHint}>
        {capturedPhotoUrl ? 'Tinjau foto sebelum disimpan' : 'Tekan tombol bulat untuk mengambil foto'}
      </div>

      <div className={styles.cameraBottomBar}>
        {capturedPhotoUrl ? (
          <div className={styles.cameraPreviewActions}>
            <button
              type="button"
              onClick={handleRetakePhoto}
              className={`${styles.cameraActionBtn} ${styles.cameraActionCancel}`}
            >
              <X size={18} /> Ambil Ulang
            </button>
            <button
              type="button"
              onClick={handleConfirmPhoto}
              className={`${styles.cameraActionBtn} ${styles.cameraActionConfirm}`}
            >
              <Check size={18} /> Gunakan Foto
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSnap}
            className={styles.cameraShutterOuter}
            title="Ambil Foto"
          >
            <div className={styles.cameraShutterInner} />
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {todayScheduleEvents.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setShowSchedulePicker(!showSchedulePicker)}
            className={styles.ambilJadwalBtn}
          >
            <CalendarClock size={16} />
            Ambil dari Jadwal ({todayScheduleEvents.length} agenda)
            <ChevronDown size={14} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: showSchedulePicker ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>
          {showSchedulePicker && (
            <div className={styles.schedulePicker}>
              {todayScheduleEvents.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  className={styles.schedulePickerItem}
                  onClick={() => handleAmbilDariJadwal(ev)}
                >
                  <div className={styles.schedulePickerTime}>{ev.waktu}{ev.waktuSelesai ? ` - ${ev.waktuSelesai}` : ''}</div>
                  <div className={styles.schedulePickerTitle}>{ev.judul}</div>
                  {ev.skpId && (
                    <div className={styles.schedulePickerSkp}>SKP #{ev.skpId}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <DailyTimeVisualizer 
        entries={entries.filter(e => e.tanggal === form.tanggal)} 
        date={form.tanggal} 
      />

      <div className={styles.formRow}>
        <div className={styles.formGroup} style={{ flex: 'none', width: 'auto' }}>
          <label className={styles.label}>Tanggal Kegiatan</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button" 
              className={styles.dateNavBtn}
              onClick={() => {
                const d = new Date(form.tanggal);
                d.setDate(d.getDate() - 1);
                handleChange('tanggal')({ target: { value: d.toISOString().split('T')[0] } });
              }}
              title="Hari Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className={styles.input}
              value={form.tanggal}
              onChange={handleChange('tanggal')}
              required
              style={{ width: 'auto' }}
            />
            <button 
              type="button" 
              className={styles.dateNavBtn}
              onClick={() => {
                const d = new Date(form.tanggal);
                d.setDate(d.getDate() + 1);
                handleChange('tanggal')({ target: { value: d.toISOString().split('T')[0] } });
              }}
              title="Hari Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className={styles.formGroup} style={{ flex: 'none', width: 'auto' }}>
          <label className={styles.label}>&nbsp;</label>
          <label className={styles.checkboxLabel} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox"
              checked={form.isFullday || false}
              onChange={(e) => setForm(prev => ({...prev, isFullday: e.target.checked}))}
            />
            <span>Isi sisa waktu hari ini (Fullday)</span>
          </label>
        </div>
      </div>

      {!form.isFullday && (
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
        </div>
      )}

      {duration > 0 && !form.isFullday && (
        <div className={styles.durationBadge}>
          <Clock size={14} /> Durasi: {formatDuration(duration)}
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>Butir SKP</label>
        <div className={styles.customSelectWrapper} ref={skpDropdownRef}>
          <div 
            className={`${styles.input} ${styles.customSelectInput}`}
            onClick={() => {
              setShowSkpDropdown(true);
              setSkpSearch('');
            }}
          >
            {form.skpId === 'none' 
              ? 'Tidak terkait SKP' 
              : form.skpId 
                ? `${form.skpId}. ${skpData.find(s => s.id == form.skpId)?.nama}` 
                : '— Pilih Butir SKP —'}
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
                    setForm(prev => ({...prev, skpId: 'none'}));
                    setShowSkpDropdown(false);
                  }}
                >
                  <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Tidak terkait SKP</span>
                </div>
                {skpData
                  .filter(s => s.nama.toLowerCase().includes(skpSearch.toLowerCase()) || String(s.id).includes(skpSearch))
                  .map((item) => (
                    <div 
                      key={item.id} 
                      className={styles.customDropdownItem}
                      onClick={() => {
                        setForm(prev => ({...prev, skpId: item.id}));
                        setShowSkpDropdown(false);
                      }}
                    >
                      <span className={styles.customDropdownItemId}>{item.id}.</span> {item.nama}
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
          {isUploading ? 'Menyimpan...' : ((initialData && initialData.id) ? 'Perbarui Kegiatan' : 'Simpan Kegiatan')}
        </button>
        {initialData && initialData.id && (
          <button type="button" onClick={onCancelEdit} style={{ padding: '0 24px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontWeight: '500' }}>
            Batal Edit
          </button>
        )}
      </div>

      {cameraModal}
    </form>
  );
}

// Komponen Visualisasi Waktu
function DailyTimeVisualizer({ entries, date }) {
  const START_HOUR = 6;
  const END_HOUR = 18;
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

  const getMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const targetDate = date ? new Date(date + 'T00:00:00') : new Date();
  const dow = targetDate.getDay();
  let coreStart = null;
  let coreEnd = null;
  
  if (dow >= 1 && dow <= 4) {
    coreStart = 7 * 60 + 30;
    coreEnd = 16 * 60;
  } else if (dow === 5) {
    coreStart = 7 * 60 + 30;
    coreEnd = 16 * 60 + 30;
  }

  const coreLeft = coreStart ? ((coreStart - START_HOUR * 60) / TOTAL_MINUTES) * 100 : null;
  const coreWidth = coreStart && coreEnd ? ((coreEnd - coreStart) / TOTAL_MINUTES) * 100 : null;

  const getColorForSkp = (skpId) => {
    if (!skpId || isNaN(Number(skpId)) || Number(skpId) === 0) return 'rgba(148, 163, 184, 0.8)'; // slate-400
    const hue = (Number(skpId) * 137.5) % 360;
    return `hsla(${hue}, 75%, 55%, 0.85)`;
  };

  const blocks = entries.map(e => {
    const startMin = getMinutes(e.waktuMulai);
    const endMin = getMinutes(e.waktuSelesai);
    let clampedStart = Math.max(START_HOUR * 60, startMin);
    let clampedEnd = Math.min(END_HOUR * 60, endMin);
    
    if (clampedStart >= clampedEnd) return null;

    const leftPerc = ((clampedStart - START_HOUR * 60) / TOTAL_MINUTES) * 100;
    const widthPerc = ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100;

    return {
      id: e.id,
      left: `${leftPerc}%`,
      width: `${widthPerc}%`,
      title: `${e.waktuMulai} - ${e.waktuSelesai}: ${e.rincian}`,
      color: getColorForSkp(e.skpId)
    };
  }).filter(Boolean);

  return (
    <div className={styles.timeVizContainer}>
      <h4 className={styles.timeVizTitle}>Peta Jam Kerja (06:00 - 18:00)</h4>
      <div className={styles.timeVizBar}>
        {coreLeft !== null && (
          <div 
            style={{ position: 'absolute', left: `${coreLeft}%`, width: `${coreWidth}%`, top: '-2px', bottom: '-2px', border: '2px dashed rgba(16, 185, 129, 0.6)', borderRadius: '6px', zIndex: 0 }}
            title="Jam Wajib Kerja"
          />
        )}
        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
          <div key={i} className={styles.timeVizMarker} style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }}>
            <span className={styles.timeVizLabel}>{String(START_HOUR + i).padStart(2, '0')}:00</span>
          </div>
        ))}
        {blocks.map(b => (
          <div 
            key={b.id} 
            className={styles.timeVizBlock} 
            style={{ left: b.left, width: b.width, backgroundColor: b.color }}
            title={b.title}
          />
        ))}
      </div>
      <div className={styles.timeVizLegend}>
        <div className={styles.timeVizLegendItem}>
          <div className={styles.timeVizLegendColor} style={{ background: 'rgba(255,255,255,0.08)' }} /> Kosong
        </div>
        <div className={styles.timeVizLegendItem}>
          <div className={styles.timeVizLegendColor} style={{ background: 'rgba(99, 102, 241, 0.7)' }} /> Terisi
        </div>
        <div className={styles.timeVizLegendItem}>
          <div className={styles.timeVizLegendColor} style={{ border: '1.5px dashed rgba(16, 185, 129, 0.6)', background: 'transparent' }} /> Jam Wajib
        </div>
      </div>
    </div>
  );
}

// Komponen Visualisasi Waktu Bulanan
function MonthlyTimeVisualizer({ entries, year, month }) {
  const START_HOUR = 6;
  const END_HOUR = 18;
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  
  const getMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dow = dateObj.getDay();
    if (dow === 0 || dow === 6) continue;
    
    let coreStart = 7 * 60 + 30;
    let coreEnd = dow === 5 ? 16 * 60 + 30 : 16 * 60;
    
    const dayEntries = entries.filter(e => e.tanggal === dateStr);
    const blocks = dayEntries.map(e => {
      const startMin = getMinutes(e.waktuMulai);
      const endMin = getMinutes(e.waktuSelesai);
      let clampedStart = Math.max(START_HOUR * 60, startMin);
      let clampedEnd = Math.min(END_HOUR * 60, endMin);
      if (clampedStart >= clampedEnd) return null;
      return {
        id: e.id,
        left: `${((clampedStart - START_HOUR * 60) / TOTAL_MINUTES) * 100}%`,
        width: `${((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100}%`,
        title: `${e.waktuMulai} - ${e.waktuSelesai}`,
        color: getColorForSkp(e.skpId)
      };
    }).filter(Boolean);
    
    days.push({
      dateStr,
      dayName: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dow],
      day,
      blocks,
      coreLeft: `${((coreStart - START_HOUR * 60) / TOTAL_MINUTES) * 100}%`,
      coreWidth: `${((coreEnd - coreStart) / TOTAL_MINUTES) * 100}%`,
      totalJamStr: formatDuration(dayEntries.reduce((sum, e) => sum + (getMinutes(e.waktuSelesai) - getMinutes(e.waktuMulai)), 0))
    });
  }

  const monthEntries = entries.filter(e => {
    if (!e.tanggal) return false;
    const [y, m] = e.tanggal.split('-').map(Number);
    return y === year && m === month;
  });
  const uniqueSkps = Array.from(new Set(monthEntries.map(e => e.skpId)));

  return (
    <div className={styles.monthlyVizContainer}>
      <h4 className={styles.timeVizTitle} style={{ marginBottom: '8px' }}>Peta Kekosongan CKP Bulan Ini</h4>
      
      {uniqueSkps.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {uniqueSkps.map(skpId => (
            <span key={skpId || 'non-skp'} className={styles.skpBadge} style={{ backgroundColor: getColorForSkp(skpId), color: '#fff', border: 'none', fontSize: '11px', padding: '2px 8px' }}>
              {skpId ? `SKP #${skpId}` : 'Non-SKP'}
            </span>
          ))}
        </div>
      )}

      <div className={styles.monthlyVizList}>
        {days.map(d => (
          <div key={d.dateStr} className={styles.monthlyVizRow}>
            <div className={styles.monthlyVizLabel}>{d.dayName}, {d.day}</div>
            <div className={styles.monthlyVizBar}>
              <div 
                style={{ position: 'absolute', left: d.coreLeft, width: d.coreWidth, top: '0', bottom: '0', border: '1px dashed rgba(16, 185, 129, 0.4)', borderRadius: '4px', zIndex: 0 }}
              />
              {d.blocks.map(b => (
                <div key={b.id} className={styles.monthlyVizBlock} style={{ left: b.left, width: b.width, backgroundColor: b.color }} title={b.title} />
              ))}
            </div>
            <div className={styles.monthlyVizDurasi}>{d.totalJamStr}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// TAB 2: Rekap Harian
function TabRekapHarian({ entries, onEdit, onDelete, selectedDate, setSelectedDate }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            type="button" 
            className={styles.dateNavBtn}
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            title="Hari Sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            className={styles.input}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button 
            type="button" 
            className={styles.dateNavBtn}
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            title="Hari Berikutnya"
          >
            <ChevronRight size={16} />
          </button>
        </div>
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

          <DailyTimeVisualizer entries={dayEntries} date={selectedDate} />

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

const formatTimeStr = (totalMins) => {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

const getMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

function stretchMonthEntries(originalEntries) {
  let hasGaps = false;
  let hasApelOnly = false;
  const newEntries = [...originalEntries];
  
  const dateMap = {};
  for (const e of originalEntries) {
    if (!dateMap[e.tanggal]) dateMap[e.tanggal] = [];
    dateMap[e.tanggal].push(e);
  }
  
  for (const [dateStr, dayEvents] of Object.entries(dateMap)) {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    if (dow === 0 || dow === 6) continue;
    
    const START_MIN = 7 * 60 + 30;
    const END_MIN = dow === 5 ? 16 * 60 + 30 : 16 * 60;
    
    const sorted = dayEvents.sort((a,b) => a.waktuMulai.localeCompare(b.waktuMulai));
    
    const isApelOnly = sorted.every(e => e.rincian && (e.rincian.toLowerCase().includes('apel') || e.rincian.toLowerCase().includes('upacara')));
    
    let currentPos = START_MIN;
    let totalGaps = 0;
    for (const e of sorted) {
       const s = getMinutes(e.waktuMulai);
       const en = getMinutes(e.waktuSelesai);
       if (s > currentPos) totalGaps += (s - currentPos);
       currentPos = Math.max(currentPos, en);
    }
    if (currentPos < END_MIN) totalGaps += (END_MIN - currentPos);
    
    if (totalGaps > 0) {
       hasGaps = true;
       if (isApelOnly) {
         hasApelOnly = true;
       } else {
         let prevEnd = START_MIN;
         for (let i = 0; i < sorted.length; i++) {
            const e = sorted[i];
            let s = getMinutes(e.waktuMulai);
            let en = getMinutes(e.waktuSelesai);
            
            if (i === 0 && s > START_MIN) {
               s = START_MIN;
            } else if (s > prevEnd) {
               const prevE = sorted[i-1];
               const prevIndex = newEntries.findIndex(ne => ne.id === prevE.id);
               if (prevIndex !== -1) {
                  newEntries[prevIndex] = { ...newEntries[prevIndex], waktuSelesai: formatTimeStr(s), durasi: s - getMinutes(prevE.waktuMulai) };
               }
            }
            
            if (i === sorted.length - 1 && en < END_MIN) {
               en = END_MIN;
            }
            
            const newIndex = newEntries.findIndex(ne => ne.id === e.id);
            if (newIndex !== -1) {
               newEntries[newIndex] = { ...newEntries[newIndex], waktuMulai: formatTimeStr(s), waktuSelesai: formatTimeStr(en), durasi: en - s };
            }
            prevEnd = Math.max(prevEnd, en);
         }
       }
    }
  }
  
  return { hasGaps, hasApelOnly, newEntries };
}

// TAB 3: Rekap Bulanan
function TabRekapBulanan({ entries, sharedDate, setSharedDate }) {
  const { showAlert } = useAlert();
  const [selectedMonth, setSelectedMonth] = useState(sharedDate ? sharedDate.substring(0, 7) : getCurrentMonthStr());

  useEffect(() => {
    if (sharedDate) {
      const monthFromShared = sharedDate.substring(0, 7);
      if (selectedMonth !== monthFromShared) {
        setSelectedMonth(monthFromShared);
      }
    }
  }, [sharedDate]);

  const [showStretchDialog, setShowStretchDialog] = useState(false);
  const [pendingExportType, setPendingExportType] = useState(null);
  const [stretchedEntriesData, setStretchedEntriesData] = useState(null);
  const [hasApelWarning, setHasApelWarning] = useState(false);

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

  const triggerExport = async (templateName, startRow, rows, cellUpdates = {}, exportFileName = 'Export.xlsx') => {
    try {
      showAlert('Sedang memproses dokumen Excel...');
      const response = await fetch('/api/export/ckp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          startRow,
          rows,
          cellUpdates
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showAlert('Gagal mengekspor: ' + e.message);
    }
  };

  const getMonthEntries = () => {
    return entries.filter(e => e.tanggal && e.tanggal.startsWith(`${yearVal}-${String(monthVal).padStart(2,'0')}-`));
  };

  const execExport = (type, dataToExport) => {
    const sortedData = [...dataToExport].sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
    });
    if (type === 'daily') {
      const rows = sortedData.map((e, idx) => {
        const skpItem = skpData.find(s => s.id === e.skpId);
        return [
          '',
          idx + 1,
          e.tanggal,
          `${e.waktuMulai} - ${e.waktuSelesai}`,
          e.rincian || '',
          e.kuantitas || 1,
          e.satuan || 'kegiatan',
          skpItem ? (skpItem.kategori === 'utama' ? 'Utama' : 'Tambahan') : '',
          e.buktiDukung || '',
          ''
        ];
      });
      const fileName = `CKP-Daily_${getMonthName(monthVal - 1)}_${yearVal}_Yahya_Abdurrohman.xlsx`;
      triggerExport('template_ckp_daily.xlsx', 9, rows, { 'D6': `: ${getMonthName(monthVal - 1)} ${yearVal}` }, fileName);
    } else if (type === 'ckpt' || type === 'ckpr') {
      const aggregated = {};
      sortedData.forEach(e => {
        if (!aggregated[e.skpId]) aggregated[e.skpId] = { kuantitas: 0, satuan: e.satuan };
        aggregated[e.skpId].kuantitas += (e.kuantitas || 1);
      });
      const rows = Object.keys(aggregated).map((skpIdStr, idx) => {
        const skpId = Number(skpIdStr);
        const skpItem = skpData.find(s => s.id === skpId);
        if (type === 'ckpt') {
          return [
            idx + 1, skpItem ? skpItem.nama : `SKP #${skpId}`, aggregated[skpIdStr].satuan || 'kegiatan',
            aggregated[skpIdStr].kuantitas, '', '', ''
          ];
        } else {
          return [
            idx + 1, skpItem ? skpItem.nama : `SKP #${skpId}`, aggregated[skpIdStr].satuan || 'kegiatan',
            aggregated[skpIdStr].kuantitas, aggregated[skpIdStr].kuantitas, 100, 100, '', '', ''
          ];
        }
      });
      const fileName = type === 'ckpt' 
        ? `CKP-T_${getMonthName(monthVal - 1)}_${yearVal}_Yahya_Abdurrohman.xlsx`
        : `CKP-R_${getMonthName(monthVal - 1)}_${yearVal}_Yahya_Abdurrohman.xlsx`;
      triggerExport(type === 'ckpt' ? 'template_ckp_t.xlsx' : 'template_ckp_r.xlsx', 12, rows, { 'C7': `: ${getMonthName(monthVal - 1)} ${yearVal}` }, fileName);
    }
  };

  const handleExportDaily = () => initiateExport('daily');
  const handleExportCKPT = () => initiateExport('ckpt');
  const handleExportCKPR = () => initiateExport('ckpr');
  const handleExportAll = () => initiateExport('all');

  const initiateExport = (type) => {
    const monthEntries = getMonthEntries();
    if (monthEntries.length === 0) return showAlert('Tidak ada data bulan ini.');
    
    const stretchResult = stretchMonthEntries(monthEntries);
    if (stretchResult.hasGaps) {
      setStretchedEntriesData(stretchResult.newEntries);
      setHasApelWarning(stretchResult.hasApelOnly);
      setPendingExportType(type);
      setShowStretchDialog(true);
    } else {
      doExport(type, monthEntries);
    }
  };

  const doExport = (type, dataToExport) => {
    if (type === 'all') {
      execExport('daily', dataToExport);
      setTimeout(() => execExport('ckpt', dataToExport), 1500);
      setTimeout(() => execExport('ckpr', dataToExport), 3000);
    } else {
      execExport(type, dataToExport);
    }
  };

  return (
    <div className={styles.rekapContainer}>
      <div className={styles.headerRow}>
        <div className={styles.datePickerGroup}>
          <label className={styles.label}>Pilih Bulan:</label>
          <input
            type="month"
            className={styles.input}
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              if (setSharedDate) setSharedDate(e.target.value + '-01');
            }}
          />
        </div>
        <div className={styles.exportGroup}>
          <button className={styles.exportBtnMini} onClick={handleExportDaily} title="Export CKP Daily">Daily</button>
          <button className={styles.exportBtnMini} onClick={handleExportCKPT} title="Export CKP-T (Target)">CKP-T</button>
          <button className={styles.exportBtnMini} onClick={handleExportCKPR} title="Export CKP-R (Realisasi)">CKP-R</button>
          <button className={styles.exportBtnMiniPrimary} onClick={handleExportAll} title="Download 3 Laporan Sekaligus">
            <Download size={14} style={{ marginRight: '6px' }} /> 1 Paket
          </button>
        </div>
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

      <MonthlyTimeVisualizer entries={entries} year={yearVal} month={monthVal} />

      {monthData.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><BarChart2 size={48} /></span>
          <p>Belum ada rekapan untuk bulan ini.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Jumlah Kegiatan</th>
                <th>Total Jam</th>
                <th>SKP Dikerjakan</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.tanggal}</td>
                  <td>{row.hari}</td>
                  <td>{row.jumlahKegiatan}</td>
                  <td>{row.totalJamStr}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {row.skpIds.map(id => (
                        <span key={id} className={styles.skpBadge}>#{id}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showStretchDialog && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <h3 className={styles.confirmTitle}>Kekosongan Jam Kerja Ditemukan</h3>
            <p className={styles.confirmMessage}>
              Terdapat jam kerja yang masih kosong di bulan ini. Apakah Anda ingin SuperBrain secara cerdas meregangkan (Stretching) durasi kegiatan Anda agar jam kerja penuh secara otomatis pada file Excel?
            </p>
            {hasApelWarning && (
              <div style={{ padding: '12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '6px', color: '#fef08a', fontSize: '13px', marginBottom: '16px' }}>
                <strong style={{ color: '#eab308' }}>⚠️ Peringatan:</strong> Ada hari yang hanya berisi kegiatan "Apel" atau "Upacara". Sistem tidak akan meregangkan hari tersebut menjadi seharian penuh.
              </div>
            )}
            <div className={styles.confirmActions}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => {
                  setShowStretchDialog(false);
                  doExport(pendingExportType, getMonthEntries());
                }}
              >
                Tidak, Ekspor Apa Adanya
              </button>
              <button 
                className={styles.confirmBtn}
                style={{ background: '#10b981' }}
                onClick={() => {
                  setShowStretchDialog(false);
                  doExport(pendingExportType, stretchedEntriesData);
                }}
              >
                <Check size={16} /> Ya, Sesuaikan Otomatis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// TAB 4: Rekap Triwulanan
function TabRekapTriwulanan({ entries }) {
  const { showAlert } = useAlert();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);

  const quarterData = useMemo(() => {
    const startMonth = (selectedQuarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
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
                        <span key={sid} className={styles.skpBadge} style={{ backgroundColor: getColorForSkp(sid), color: '#fff', border: 'none' }}>#{sid || 'Non-SKP'}</span>
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

// Main Page (inner component - needs Suspense for useSearchParams)
function CKPPageInner() {
  const searchParams = useSearchParams();
  const { showAlert } = useAlert();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const { docs: entries, loading, addDocument, updateDocument, deleteDocument } = useFirestore('ckp');
  const { setPageData } = useAIContext();
  const [sharedSelectedDate, setSharedSelectedDate] = useState(getTodayStr());

  useEffect(() => {
    setPageData(entries);
  }, [entries, setPageData]);

  const [toastVisible, setToastVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleAICreateCKP = useCallback(async (data) => {
    try {
      await addDocument({
        ...data,
        createdAt: new Date(),
      });
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
    } catch (err) {
      console.error('AI Create CKP Error:', err);
      showAlert('Gagal mencatat CKP dari AI.');
    }
  }, [addDocument, showAlert]);

  const handleAIUpdateCKP = useCallback(async (data) => {
    if (!data.id) return;
    try {
      const updates = {};
      if (data.rincian) updates.rincian = data.rincian;
      if (data.outputKuantitas) updates.outputKuantitas = Number(data.outputKuantitas);
      await updateDocument(data.id, updates);
      showAlert('Laporan CKP berhasil diperbarui oleh AI!', 'success');
    } catch(e) { console.error(e); }
  }, [updateDocument, showAlert]);

  const handleAIDeleteCKP = useCallback(async (data) => {
    if (!data.id) return;
    try {
      await deleteDocument(data.id);
      showAlert('Laporan CKP berhasil dihapus oleh AI!', 'success');
    } catch(e) { console.error(e); }
  }, [deleteDocument, showAlert]);

  useChatAction('CREATE_CKP', handleAICreateCKP);
  useChatAction('UPDATE_CKP', handleAIUpdateCKP);
  useChatAction('DELETE_CKP', handleAIDeleteCKP);

  // Handle auto-sync of telegram files to Google Drive
  useEffect(() => {
    if (loading || !entries || !accessToken) return;

    const syncPendingFiles = async () => {
      const pendingEntries = entries.filter(e => e.telegramFileId);
      
      for (const entry of pendingEntries) {
        try {
          // 1. Download from proxy
          const res = await fetch(`/api/telegram-file?id=${entry.telegramFileId}`);
          if (!res.ok) throw new Error('Gagal mengunduh dari server Telegram via proxy.');
          
          const blob = await res.blob();
          const disp = res.headers.get('content-disposition');
          const filenameMatch = disp ? disp.match(/filename="([^"]+)"/) : null;
          const filename = filenameMatch ? filenameMatch[1] : `Dokumen_CKP_${entry.tanggal}.pdf`;
          
          const file = new File([blob], filename, { type: blob.type });

          // 2. Upload to Google Drive
          const driveUrl = await uploadFileToDrive(file, accessToken);

          // 3. Update Firestore
          await updateDocument(entry.id, {
            buktiDukung: driveUrl,
            telegramFileId: null // Clear the temporary ID
          });
          
          showAlert(`Bukti dukung CKP untuk kegiatan '${entry.rincian.substring(0, 20)}...' berhasil disinkronisasi ke Google Drive.`);
        } catch (err) {
          console.error('Failed to sync telegram file for entry', entry.id, err);
        }
      }
    };

    syncPendingFiles();
  }, [entries, loading, accessToken, updateDocument, showAlert]);

  // Handle prefill from schedule
  useEffect(() => {
    const fromSchedule = searchParams.get('fromSchedule');
    if (fromSchedule) {
      try {
        const raw = sessionStorage.getItem('ckp_prefill');
        if (raw) {
          const prefill = JSON.parse(raw);
          sessionStorage.removeItem('ckp_prefill');
          setEditingEntry(null); // clear any existing edit
          // Use a special "fromSchedule" prefill object
          setEditingEntry({
            _isPrefill: true,
            tanggal: prefill.tanggal || '',
            waktuMulai: prefill.waktuMulai || '',
            waktuSelesai: prefill.waktuSelesai || '',
            skpId: prefill.skpId || '',
            rincian: prefill.rincian || '',
            fromScheduleEventId: prefill.fromScheduleEventId || null,
            sumber: prefill.sumber || 'manual',
            sourceScheduleId: prefill.sourceScheduleId || null,
            sourceTaskId: prefill.sourceTaskId || null,
          });
          setActiveTab(0);
        }
      } catch (e) {
        console.error('Failed to read CKP prefill:', e);
      }
    }
  }, [searchParams]);

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setSharedSelectedDate(entry.tanggal);
    setActiveTab(0);
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

    const scheduleId = formData.sourceScheduleId || formData.fromScheduleEventId;
    if (scheduleId) {
      try {
        await updateDoc(doc(db, 'schedule', scheduleId), { isSelesai: true });
      } catch (err) {
        console.error("Gagal update status jadwal:", err);
      }
    }

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
                onCancelEdit={() => {
                  setEditingEntry(null);
                  setActiveTab(1);
                }}
                entries={entries}
                sharedDate={sharedSelectedDate}
                setSharedDate={setSharedSelectedDate}
              />
            )}
            {activeTab === 1 && (
              <TabRekapHarian 
                entries={entries} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
                selectedDate={sharedSelectedDate}
                setSelectedDate={setSharedSelectedDate}
              />
            )}
            {activeTab === 2 && <TabRekapBulanan entries={entries} sharedDate={sharedSelectedDate} setSharedDate={setSharedSelectedDate} />}
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

export default function CKPPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', color: '#94a3b8', textAlign: 'center' }}>Memuat...</div>}>
      <CKPPageInner />
    </Suspense>
  );
}
