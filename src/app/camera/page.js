'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  RotateCcw,
  RefreshCw,
  Zap,
  ZapOff,
  MapPin,
  Clock,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  Grid,
  FileText,
  Download,
  UploadCloud,
  Check,
  ExternalLink,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  Image as ImageIcon,
  Copy
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSkps } from '@/hooks/useSkps';
import { useFirestore } from '@/hooks/useFirestore';
import { useAlert } from '@/contexts/AlertContext';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/drive';
import { savePendingUpload, saveDraftActivity } from '@/lib/localdb';
import { compressImage, formatBytes } from '@/lib/compressor';

const CAPTURE_MODES = [
  { id: 'ckp', label: 'Bukti CKP', desc: 'Hubungkan langsung ke butir SKP dan kegiatan harian' },
  { id: 'field', label: 'Dinas Lapangan', desc: 'Survei, sensus, supervisi, atau ground check' },
  { id: 'schedule', label: 'Lampiran Jadwal', desc: 'Dokumentasi agenda dan presensi kegiatan hari ini' },
  { id: 'quick', label: 'Quick Snap', desc: 'Foto cepat dengan watermark resmi dan backup Drive' },
];

export default function CameraPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { skpData } = useSkps();
  const { addDoc: addCkpDoc } = useFirestore('ckp');
  const { docs: scheduleDocs } = useFirestore('schedule');
  const { addDoc: addScheduleDoc } = useFirestore('schedule');
  const { showAlert } = useAlert();

  // Camera stream states
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [cameraLens, setCameraLens] = useState('1x');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCaps, setZoomCaps] = useState(null);
  const [flashSupported, setFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [gridActive, setGridActive] = useState(true);
  const [permissionError, setPermissionError] = useState(null);

  // GPS Geotag states
  const [coords, setCoords] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('searching'); // searching, locked, error
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Mode & Form states
  const [activeMode, setActiveMode] = useState('ckp');
  const [formOpen, setFormOpen] = useState(true);
  const [form, setForm] = useState({
    // CKP Mode
    skpId: '',
    rincian: '',
    jumlah: 1,
    satuan: 'Dokumen',
    kualitas: 100,
    waktuMulai: '08:00',
    waktuSelesai: '16:00',
    isFullday: true,
    // Field Mode
    namaSurvei: '',
    lokasiWilayah: '',
    catatanLapangan: '',
    // Schedule Mode
    selectedScheduleId: '',
    judulJadwal: '',
    // Quick Mode
    catatanRingkas: ''
  });

  // Photo Review & Processing states
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [watermarkedBlob, setWatermarkedBlob] = useState(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressedInfo, setCompressedInfo] = useState(null);

  // Recent captures history (in current session and persistent in storage)
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load persistent history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('superbrain_recent_camera_photos');
      if (saved) {
        setRecentPhotos(JSON.parse(saved));
      }
    } catch (_) {}
  }, []);

  // Save persistent history helper
  const saveRecentPhotos = (photos) => {
    setRecentPhotos(photos);
    try {
      // Store metadata only (omit big preview URLs for storage efficiency)
      const persistent = photos.slice(0, 20).map((p) => ({
        id: p.id,
        title: p.title,
        fileName: p.fileName,
        driveLink: p.driveLink,
        isOffline: p.isOffline,
        time: p.time,
        coords: p.coords
      }));
      localStorage.setItem('superbrain_recent_camera_photos', JSON.stringify(persistent));
    } catch (_) {}
  };

  // Real-time clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setCurrentTimeStr(now.toLocaleDateString('id-ID', options));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time GPS Watcher
  useEffect(() => {
    let watchId = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsStatus('searching');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            altitude: pos.coords.altitude,
            accuracy: pos.coords.accuracy
          });
          setGpsAccuracy(Math.round(pos.coords.accuracy));
          setGpsStatus('locked');
        },
        (err) => {
          console.warn('Geolocation watch error:', err);
          setGpsStatus('error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } else {
      setGpsStatus('error');
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Initialize Camera Stream
  const initCamera = useCallback(async (isFront, lens) => {
    try {
      setPermissionError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError('Browser Anda tidak mendukung Web Media API untuk kamera langsung.');
        return;
      }

      // Stop existing stream if running
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let constraints = {
        video: {
          facingMode: isFront ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      // Multi-lens detection for rear camera (Ultra-wide 0.5x vs Primary 1x)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');

        if (videoDevices.length > 1 && !isFront) {
          const rearCameras = videoDevices.filter((d) => {
            const label = d.label.toLowerCase();
            return (
              label.includes('back') ||
              label.includes('rear') ||
              label.includes('belakang') ||
              label.includes('environment') ||
              (!label.includes('front') && !label.includes('depan') && !label.includes('user'))
            );
          });

          if (rearCameras.length > 0) {
            let selectedDev = null;
            if (lens === '0.5x') {
              selectedDev = rearCameras.find((d) => {
                const label = d.label.toLowerCase();
                return (
                  label.includes('ultra') ||
                  label.includes('wide') ||
                  label.includes('0.5') ||
                  label.includes('0.6') ||
                  label.includes('aux')
                );
              }) || rearCameras[1];
            } else {
              selectedDev = rearCameras.find((d) => {
                const label = d.label.toLowerCase();
                return (
                  (label.includes('main') || label.includes('utama') || label.includes('primary') || label.includes('0')) &&
                  !label.includes('ultra') &&
                  !label.includes('tele')
                );
              }) || rearCameras[0];
            }

            if (selectedDev && selectedDev.deviceId) {
              constraints = {
                video: {
                  deviceId: { exact: selectedDev.deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                }
              };
            }
          }
        }
      } catch (devErr) {
        console.warn('Enumerating devices warning:', devErr);
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (fallbackErr) {
        console.warn('Failed constraint, falling back to basic facingMode:', fallbackErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: isFront ? 'user' : 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom) {
          setZoomCaps(caps.zoom);
        } else {
          setZoomCaps(null);
        }

        if (caps.torch) {
          setFlashSupported(true);
        } else {
          setFlashSupported(false);
        }

        // Apply continuous autofocus if available
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
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.error('Video play error', e));
      }
    } catch (err) {
      console.error('Camera initialization error:', err);
      setPermissionError(
        'Izin akses kamera ditolak atau kamera sedang digunakan oleh aplikasi lain. Anda tetap dapat menggunakan tombol Pilih Foto dari Galeri di bagian atas.'
      );
      setCameraActive(false);
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    initCamera(isFrontCamera, cameraLens);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [initCamera, isFrontCamera, cameraLens]);

  // Flip Camera (Front / Rear)
  const handleFlipCamera = () => {
    const nextFront = !isFrontCamera;
    setIsFrontCamera(nextFront);
    setCameraLens('1x');
  };

  // Switch Lens (1x / 0.5x)
  const handleLensSelect = (lens) => {
    if (lens === cameraLens) return;
    setCameraLens(lens);
  };

  // Toggle Flash / Torch
  const handleToggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const nextState = !flashOn;
      if (track && track.applyConstraints) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: nextState }]
          });
          setFlashOn(nextState);
        } catch (e) {
          console.warn('Torch constraint error', e);
        }
      }
    }
  };

  // Zoom Handler
  const handleZoomChange = async (val) => {
    const num = parseFloat(val);
    setZoomLevel(num);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.applyConstraints) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: num }] });
        } catch (_) {}
      }
    }
  };

  // Copy Coordinates to Clipboard
  const handleCopyCoords = () => {
    if (!coords) {
      showAlert('Koordinat GPS belum terkunci.');
      return;
    }
    const text = `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
    showAlert(`Koordinat berhasil disalin: ${text}`);
  };

  // Render Official Geotag Watermark to Canvas
  const generateWatermarkedImage = async (rawBlob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // Draw the base photo
          ctx.drawImage(img, 0, 0, width, height);

          // Calculate watermark banner height based on image proportion
          const bannerHeight = Math.max(160, Math.round(height * 0.22));
          const startY = height - bannerHeight;

          // Gradient background for high legibility
          const gradient = ctx.createLinearGradient(0, startY, 0, height);
          gradient.addColorStop(0, 'rgba(10, 15, 30, 0.84)');
          gradient.addColorStop(1, 'rgba(5, 10, 20, 0.96)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, startY, width, bannerHeight);

          // Accent border line at top of banner
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(0, startY, width, Math.max(3, Math.round(width * 0.003)));

          // Watermark Typography
          const baseFontSize = Math.max(14, Math.round(width * 0.019));
          const headerFontSize = Math.round(baseFontSize * 1.25);
          const metaFontSize = Math.round(baseFontSize * 0.88);
          const paddingX = Math.round(width * 0.03);
          let currentY = startY + headerFontSize + Math.round(width * 0.015);

          // 1. Official Header Badge
          ctx.fillStyle = '#38bdf8';
          ctx.font = `bold ${headerFontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText('BADAN PUSAT STATISTIK | SUPERBRAIN FIELD CAMERA', paddingX, currentY);

          // 2. Petugas & Satuan Kerja
          currentY += baseFontSize * 1.5;
          ctx.fillStyle = '#ffffff';
          ctx.font = `600 ${baseFontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
          const namaPetugas = profile?.displayName || user?.displayName || 'Petugas Lapangan BPS';
          const nipPetugas = profile?.nip ? ` (NIP: ${profile.nip})` : '';
          const satkerPetugas = profile?.satker || 'BPS Republik Indonesia';
          ctx.fillText(`Petugas : ${namaPetugas}${nipPetugas} | ${satkerPetugas}`, paddingX, currentY);

          // 3. Waktu & Tanggal
          currentY += baseFontSize * 1.4;
          const now = new Date();
          const dateStr = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          const timeStr = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          ctx.fillStyle = '#e2e8f0';
          ctx.font = `normal ${baseFontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
          ctx.fillText(`Waktu   : ${dateStr}, ${timeStr} WIB`, paddingX, currentY);

          // 4. Koordinat Geotag & Akurasi
          currentY += baseFontSize * 1.4;
          let coordsStr = 'Koordinat: GPS Menunggu Kunci / Lokasi Manual';
          if (coords) {
            coordsStr = `Koordinat: Lat ${coords.lat.toFixed(6)}, Lon ${coords.lon.toFixed(6)} (Akurasi: ±${coords.accuracy ? Math.round(coords.accuracy) : 5}m)`;
          }
          ctx.fillStyle = '#a5b4fc';
          ctx.font = `500 ${baseFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
          ctx.fillText(coordsStr, paddingX, currentY);

          // 5. Kegiatan / Rincian Lapangan
          currentY += baseFontSize * 1.4;
          let detailLabel = '';
          if (activeMode === 'ckp') {
            detailLabel = `Kegiatan CKP: ${form.rincian || 'Dokumentasi Pelaksanaan Tugas Lapangan'}`;
          } else if (activeMode === 'field') {
            detailLabel = `Survei/Sensus: ${form.namaSurvei || 'Pemeriksaan Lapangan'} | Wilayah: ${form.lokasiWilayah || 'Wilayah Kerja'}`;
          } else if (activeMode === 'schedule') {
            const sc = scheduleDocs.find((s) => s.id === form.selectedScheduleId);
            detailLabel = `Agenda: ${sc ? sc.judul : form.judulJadwal || 'Dokumentasi Agenda Rapat/Dinas'}`;
          } else {
            detailLabel = `Catatan: ${form.catatanRingkas || 'Dokumentasi Cepat Lapangan'}`;
          }

          ctx.fillStyle = '#cbd5e1';
          ctx.font = `italic ${metaFontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
          const maxChar = Math.round(width * 0.07);
          const truncatedDetail = detailLabel.length > maxChar ? `${detailLabel.substring(0, maxChar)}...` : detailLabel;
          ctx.fillText(truncatedDetail, paddingX, currentY);

          // Output canvas as compressed JPEG
          canvas.toBlob(
            (finalBlob) => {
              resolve(finalBlob);
            },
            'image/jpeg',
            0.82
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(rawBlob);
    });
  };

  // Process any raw image blob into watermarked preview
  const processImageToPreview = async (rawBlob) => {
    setIsProcessing(true);
    try {
      setCapturedBlob(rawBlob);

      // Render official watermark
      const watermarked = await generateWatermarkedImage(rawBlob);
      setWatermarkedBlob(watermarked);

      // Compression estimation
      const compressed = await compressImage(
        new File([watermarked], `Kamera_SuperBrain_${Date.now()}.jpg`, { type: 'image/jpeg' }),
        { quality: 0.78, maxWidth: 1600 }
      );
      setCompressedInfo(compressed);

      const previewUrl = URL.createObjectURL(watermarked);
      setWatermarkedUrl(previewUrl);
    } catch (err) {
      console.error('Image processing error:', err);
      showAlert('Terjadi kendala saat memproses gambar: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Capture Shutter Action from live video
  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = videoRef.current.videoWidth || 1920;
      snapCanvas.height = videoRef.current.videoHeight || 1080;
      const snapCtx = snapCanvas.getContext('2d');

      // Mirror capture if using front camera
      if (isFrontCamera) {
        snapCtx.translate(snapCanvas.width, 0);
        snapCtx.scale(-1, 1);
      }

      snapCtx.drawImage(videoRef.current, 0, 0);

      snapCanvas.toBlob(
        async (rawBlob) => {
          await processImageToPreview(rawBlob);
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      console.error('Snap error:', err);
      showAlert('Terjadi kendala saat mengambil gambar: ' + err.message);
      setIsProcessing(false);
    }
  };

  // Handle Photo Pick from Local Device Gallery / Storage
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Berkas yang dipilih harus berupa gambar (JPG, PNG, WEBP).');
      return;
    }

    await processImageToPreview(file);
    e.target.value = '';
  };

  // Retake Photo
  const handleRetake = () => {
    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
    }
    setWatermarkedUrl(null);
    setWatermarkedBlob(null);
    setCapturedBlob(null);
    setCompressedInfo(null);
  };

  // Download directly to local storage / gallery
  const handleDownloadLocal = () => {
    if (!watermarkedBlob) return;
    const url = URL.createObjectURL(watermarkedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SuperBrain_BPS_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert('Foto berhasil diunduh ke galeri perangkat Anda.');
  };

  // Save photo and metadata as CKP Draft
  const handleSaveAsCkpDraft = async () => {
    if (!watermarkedBlob || !user) {
      showAlert('Silakan login terlebih dahulu untuk menyimpan draft kegiatan.');
      return;
    }

    setIsUploading(true);
    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];
    const timestampId = Date.now();
    const fileName = `Draft_Geotag_${todayYMD}_${timestampId}.jpg`;
    const finalFile = new File([watermarkedBlob], fileName, { type: 'image/jpeg' });

    try {
      const draftTitle = form.rincian?.trim() || form.namaSurvei?.trim() || `Foto Geotag Lapangan (${todayYMD})`;
      const draftPayload = {
        id: `draft_cam_${timestampId}`,
        title: draftTitle,
        userId: user.uid,
        form: {
          tanggal: todayYMD,
          isFullday: form.isFullday ?? true,
          waktuMulai: form.isFullday ? '08:00' : (form.waktuMulai || '08:00'),
          waktuSelesai: form.isFullday ? '16:00' : (form.waktuSelesai || '16:00'),
          skpId: form.skpId || '',
          skpIds: form.skpId ? [Number(form.skpId)] : [],
          rincian: draftTitle,
          kuantitas: form.jumlah || 1,
          satuan: form.satuan || 'Dokumen',
          timKerja: 'Subbagian Umum',
        },
        files: [finalFile],
        previewImage: watermarkedUrl,
        buktiDukung: null,
        geotag: coords ? { lat: coords.lat, lon: coords.lon, accuracy: coords.accuracy } : null,
        sumber: 'camera_geotag',
        updatedAt: timestampId
      };

      await saveDraftActivity(draftPayload, user.uid);
      showAlert('Foto dan koordinat geotag berhasil disimpan sebagai Draft CKP! Anda dapat melengkapi rincian tugasnya nanti di menu CKP Harian.', 'success');
      handleRetake();
    } catch (err) {
      console.error('Save camera draft error:', err);
      showAlert('Gagal menyimpan draft: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit and Upload to SuperBrain System (Drive & Firestore & Offline Queue)
  const handleSubmitAndUpload = async () => {
    if (!watermarkedBlob || !user) {
      showAlert('Silakan login terlebih dahulu untuk menyimpan data ke SuperBrain.');
      return;
    }

    setIsUploading(true);
    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];
    const timestampId = Date.now();
    const fileName = `Dokumentasi_BPS_${activeMode.toUpperCase()}_${todayYMD}_${timestampId}.jpg`;
    const finalFile = new File([watermarkedBlob], fileName, { type: 'image/jpeg' });

    let driveLink = null;
    let isSavedOffline = false;

    // 1. Attempt upload to Google Drive if access token available and online
    if (user?.accessToken && navigator.onLine) {
      try {
        const rootFolderId = await getOrCreateFolder(user.accessToken, 'SuperBrain BPS');
        let targetFolder = 'Kamera Lapangan';
        if (activeMode === 'ckp') targetFolder = 'Bukti Dukung CKP';
        else if (activeMode === 'field') targetFolder = 'Dinas Lapangan';

        const subFolderId = await getOrCreateFolder(user.accessToken, targetFolder, rootFolderId);
        driveLink = await uploadFileToDrive(finalFile, user.accessToken, subFolderId, fileName);
      } catch (driveErr) {
        console.warn('Google Drive direct upload failed, saving to offline sync queue...', driveErr);
      }
    }

    // 2. Build system document payload according to selected mode
    const baseEntryId = `cam_${timestampId}`;
    let ckpRecord = null;
    let scheduleRecord = null;

    if (activeMode === 'ckp') {
      const selectedSkp = skpData.find((s) => String(s.id) === String(form.skpId));
      ckpRecord = {
        userId: user.uid,
        tanggal: todayYMD,
        skpId: form.skpId || 'none',
        skpIds: form.skpId ? [Number(form.skpId)] : [],
        skpJudul: selectedSkp ? selectedSkp.rencanaKinerja : '',
        rincian: form.rincian || 'Dokumentasi Bukti Dukung Lapangan',
        jumlah: Number(form.jumlah) || 1,
        satuan: form.satuan || 'Dokumen',
        kualitas: Number(form.kualitas) || 100,
        isFullday: form.isFullday,
        waktuMulai: form.isFullday ? '08:00' : form.waktuMulai,
        waktuSelesai: form.isFullday ? '16:00' : form.waktuSelesai,
        buktiDukung: driveLink || null,
        buktiDukungFiles: driveLink ? [{ name: fileName, url: driveLink }] : [],
        geotag: coords
          ? {
              lat: coords.lat,
              lon: coords.lon,
              accuracy: coords.accuracy
            }
          : null,
        createdAt: now.toISOString()
      };
    } else if (activeMode === 'field') {
      ckpRecord = {
        userId: user.uid,
        tanggal: todayYMD,
        skpId: 'none',
        rincian: `[Dinas Lapangan] ${form.namaSurvei || 'Kegiatan Lapangan'}: ${form.catatanLapangan || ''} (Wilayah: ${form.lokasiWilayah || 'SLS/Desa'})`,
        jumlah: 1,
        satuan: 'Kegiatan',
        kualitas: 100,
        isFullday: true,
        waktuMulai: '08:00',
        waktuSelesai: '16:00',
        buktiDukung: driveLink || null,
        buktiDukungFiles: driveLink ? [{ name: fileName, url: driveLink }] : [],
        geotag: coords
          ? {
              lat: coords.lat,
              lon: coords.lon,
              accuracy: coords.accuracy
            }
          : null,
        kategori: 'Dinas Lapangan',
        createdAt: now.toISOString()
      };
    } else if (activeMode === 'schedule') {
      scheduleRecord = {
        userId: user.uid,
        tanggal: todayYMD,
        judul: form.judulJadwal || 'Dokumentasi Lapangan',
        kategori: 'Kegiatan',
        waktu: now.toTimeString().substring(0, 5),
        lampiranUrl: driveLink || null,
        createdAt: now.toISOString()
      };
    } else {
      // Quick Snap record
      ckpRecord = {
        userId: user.uid,
        tanggal: todayYMD,
        skpId: 'none',
        rincian: `[Quick Snap] ${form.catatanRingkas || 'Dokumentasi Foto Lapangan'}`,
        jumlah: 1,
        satuan: 'Foto',
        kualitas: 100,
        isFullday: true,
        buktiDukung: driveLink || null,
        buktiDukungFiles: driveLink ? [{ name: fileName, url: driveLink }] : [],
        geotag: coords
          ? {
              lat: coords.lat,
              lon: coords.lon,
              accuracy: coords.accuracy
            }
          : null,
        createdAt: now.toISOString()
      };
    }

    // 3. Save to Firestore and/or IndexedDB
    try {
      if (ckpRecord) {
        await addCkpDoc(ckpRecord);
      }
      if (scheduleRecord) {
        await addScheduleDoc(scheduleRecord);
      }

      // If no drive link (offline or unauthenticated drive), queue file locally
      if (!driveLink) {
        await savePendingUpload(baseEntryId, finalFile, fileName, 'ckp', null, null, user.uid);
        isSavedOffline = true;
      }

      // Add to session captures list and persist
      const newCapture = {
        id: baseEntryId,
        title:
          activeMode === 'ckp'
            ? form.rincian || 'Bukti CKP'
            : activeMode === 'field'
            ? form.namaSurvei || 'Dinas Lapangan'
            : activeMode === 'schedule'
            ? form.judulJadwal || 'Lampiran Jadwal'
            : 'Quick Snap',
        fileName,
        previewUrl: watermarkedUrl,
        driveLink,
        isOffline: isSavedOffline,
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        coords: coords ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : null
      };

      saveRecentPhotos([newCapture, ...recentPhotos]);

      showAlert(
        isSavedOffline
          ? 'Foto dan data berhasil disimpan di perangkat (Mode Offline). Akan disinkronkan ke Google Drive saat online.'
          : 'Foto ber-watermark berhasil disimpan ke sistem SuperBrain dan diunggah ke Google Drive!'
      );

      // Reset review screen to viewfinder
      handleRetake();
    } catch (saveErr) {
      console.error('Error saving document to system:', saveErr);
      showAlert('Gagal menyimpan ke sistem: ' + saveErr.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.cameraContainer}>
      {/* Hidden File Input for Gallery / Local File Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Fallback Permission Error Screen */}
      {permissionError && !cameraActive && (
        <div className={styles.permissionScreen}>
          <div className={styles.permissionIcon}>
            <Camera size={32} />
          </div>
          <h2 className={styles.permissionTitle}>Akses Kamera Diperlukan</h2>
          <p className={styles.permissionDesc}>{permissionError}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => initCamera(isFrontCamera, cameraLens)}
              className={styles.permissionBtn}
            >
              <RefreshCw size={18} />
              Coba Aktifkan Kembali
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.permissionBtn}
              style={{ background: '#334155' }}
            >
              <ImageIcon size={18} />
              Pilih dari Galeri
            </button>
          </div>
          <Link href="/" className={styles.backBtn} style={{ width: 'auto', padding: '8px 16px', gap: '8px', marginTop: '8px' }}>
            <ArrowLeft size={16} />
            Kembali ke Dashboard
          </Link>
        </div>
      )}

      {/* Main Camera App Screen */}
      {(!permissionError || cameraActive) && (
        <div className={styles.cameraApp}>
          {/* Top Bar Header */}
          <header className={styles.topBar}>
            <div className={styles.brandGroup}>
              <Link href="/" className={styles.backBtn} title="Kembali ke Dashboard">
                <ArrowLeft size={18} />
              </Link>
              <div className={styles.appTitleBlock}>
                <span className={styles.appTitle}>
                  <Camera size={18} color="#6366f1" />
                  Kamera Lapangan
                </span>
                <span className={styles.appSubtitle}>
                  {profile?.displayName || user?.displayName || 'Petugas BPS'}
                </span>
              </div>
            </div>

            <div className={styles.topActions}>
              {/* Pick Image from Gallery Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={styles.actionIconBtn}
                title="Pilih Foto dari Galeri / Berkas"
              >
                <ImageIcon size={18} />
              </button>

              {flashSupported && !isFrontCamera && (
                <button
                  type="button"
                  onClick={handleToggleFlash}
                  className={`${styles.actionIconBtn} ${flashOn ? styles.actionIconBtnActive : ''}`}
                  title={flashOn ? 'Matikan Lampu Kilat' : 'Nyalakan Lampu Kilat'}
                >
                  {flashOn ? <Zap size={18} /> : <ZapOff size={18} />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setGridActive(!gridActive)}
                className={`${styles.actionIconBtn} ${gridActive ? styles.actionIconBtnActive : ''}`}
                title="Bantuan Garis Grid 3x3"
              >
                <Grid size={18} />
              </button>

              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className={styles.actionIconBtn}
                title="Riwayat Jepretan Lapangan"
              >
                <Layers size={18} />
              </button>
            </div>
          </header>

          {/* Mode Selector Carousel */}
          <nav className={styles.modeSelector}>
            {CAPTURE_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className={`${styles.modeTab} ${activeMode === mode.id ? styles.modeTabActive : ''}`}
              >
                {mode.id === 'ckp' && <FileText size={14} />}
                {mode.id === 'field' && <Building2 size={14} />}
                {mode.id === 'schedule' && <Calendar size={14} />}
                {mode.id === 'quick' && <Sparkles size={14} />}
                {mode.label}
              </button>
            ))}
          </nav>

          {/* Viewfinder Main Viewport */}
          <div className={styles.viewfinderArea}>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`${styles.videoElement} ${isFrontCamera ? styles.videoElementFlipped : ''}`}
            />

            {/* Grid 3x3 overlay */}
            {gridActive && (
              <div className={styles.gridOverlay}>
                <div className={styles.gridLineHoriz1} />
                <div className={styles.gridLineHoriz2} />
                <div className={styles.gridLineVert1} />
                <div className={styles.gridLineVert2} />
              </div>
            )}

            {/* HUD Status Badge (Top-Left) */}
            <div className={styles.hudLiveBadge}>
              <span className={styles.pulseDot} />
              <span>LIVE HUD</span>
              <span>•</span>
              <span>{currentTimeStr || 'Memuat...'}</span>
            </div>

            {/* HUD GPS Box (Bottom-Left) */}
            <div className={styles.hudGpsBox}>
              <div className={styles.hudGpsHeader}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} />
                  GEOTAG REAL-TIME
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {gpsStatus === 'locked' ? (
                    <span style={{ color: '#4ade80' }}>TERKUNCI (±{gpsAccuracy}m)</span>
                  ) : gpsStatus === 'searching' ? (
                    <span style={{ color: '#facc15' }}>MENCARI GPS...</span>
                  ) : (
                    <span style={{ color: '#f87171' }}>GPS TIDAK TERSEDIA</span>
                  )}
                  {coords && (
                    <button
                      type="button"
                      onClick={handleCopyCoords}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedCoords ? '#4ade80' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Salin Koordinat"
                    >
                      {copiedCoords ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </span>
              </div>
              <div className={styles.hudGpsCoords}>
                {coords ? (
                  <>
                    <span>Lat: {coords.lat.toFixed(6)}</span>
                    <span>Lon: {coords.lon.toFixed(6)}</span>
                  </>
                ) : (
                  <span>Menunggu sinyal satelit GPS...</span>
                )}
              </div>
              <div className={styles.hudGpsMeta}>
                <span>{profile?.satker || 'BPS Republik Indonesia'}</span>
                <span>{CAPTURE_MODES.find((m) => m.id === activeMode)?.label}</span>
              </div>
            </div>

            {/* Controls Bar: Lens & Zoom Slider */}
            <div className={styles.controlsBar}>
              {!isFrontCamera && (
                <div className={styles.lensButtonGroup}>
                  <button
                    onClick={() => handleLensSelect('0.5x')}
                    className={`${styles.lensBtn} ${cameraLens === '0.5x' ? styles.lensBtnActive : ''}`}
                  >
                    0.5x
                  </button>
                  <button
                    onClick={() => handleLensSelect('1x')}
                    className={`${styles.lensBtn} ${cameraLens === '1x' ? styles.lensBtnActive : ''}`}
                  >
                    1x
                  </button>
                </div>
              )}

              {zoomCaps && (
                <div className={styles.zoomSliderContainer}>
                  <Sliders size={14} color="#94a3b8" />
                  <input
                    type="range"
                    min={zoomCaps.min || 1}
                    max={zoomCaps.max || 5}
                    step={zoomCaps.step || 0.1}
                    value={zoomLevel}
                    onChange={(e) => handleZoomChange(e.target.value)}
                    className={styles.zoomRange}
                  />
                  <span className={styles.zoomLabel}>{zoomLevel.toFixed(1)}x</span>
                </div>
              )}
            </div>
          </div>

          {/* Mode Contextual Form Drawer (Foldable) */}
          <div className={styles.formPanel}>
            <div className={styles.formHeader}>
              <span className={styles.formTitle}>
                {activeMode === 'ckp' && <FileText size={16} color="#6366f1" />}
                {activeMode === 'field' && <Building2 size={16} color="#38bdf8" />}
                {activeMode === 'schedule' && <Calendar size={16} color="#34d399" />}
                {activeMode === 'quick' && <Sparkles size={16} color="#f59e0b" />}
                Parameter Entri: {CAPTURE_MODES.find((m) => m.id === activeMode)?.label}
              </span>
              <button
                type="button"
                onClick={() => setFormOpen(!formOpen)}
                className={styles.collapseToggle}
              >
                {formOpen ? (
                  <>
                    <span>Tutup Form</span>
                    <ChevronDown size={14} />
                  </>
                ) : (
                  <>
                    <span>Buka Form</span>
                    <ChevronUp size={14} />
                  </>
                )}
              </button>
            </div>

            {formOpen && (
              <div className={styles.formGrid}>
                {/* CKP Form Mode */}
                {activeMode === 'ckp' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Pilih Butir SKP Terkait</label>
                      <select
                        value={form.skpId}
                        onChange={(e) => setForm({ ...form, skpId: e.target.value })}
                        className={styles.formSelect}
                      >
                        <option value="">-- Tanpa Kaitan SKP Spesifik --</option>
                        {skpData.map((skp) => (
                          <option key={skp.id} value={skp.id}>
                            #{skp.id} - {skp.rencanaKinerja.substring(0, 50)}...
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Rincian Kegiatan CKP</label>
                      <input
                        type="text"
                        placeholder="Contoh: Pencacahan survei lapangan..."
                        value={form.rincian}
                        onChange={(e) => setForm({ ...form, rincian: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Volume / Jumlah</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          min="1"
                          value={form.jumlah}
                          onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                          className={styles.formInput}
                          style={{ width: '80px' }}
                        />
                        <input
                          type="text"
                          placeholder="Satuan (Dokumen/Kegiatan)"
                          value={form.satuan}
                          onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                          className={styles.formInput}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Kualitas (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.kualitas}
                        onChange={(e) => setForm({ ...form, kualitas: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </>
                )}

                {/* Field Documentation Mode */}
                {activeMode === 'field' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Nama Survei / Sensus / Tugas</label>
                      <input
                        type="text"
                        placeholder="Contoh: Survei Biaya Hidup / Updating SLS"
                        value={form.namaSurvei}
                        onChange={(e) => setForm({ ...form, namaSurvei: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Lokasi / SLS / Desa / Responden</label>
                      <input
                        type="text"
                        placeholder="Contoh: RT 02 / RW 01 Kel. Sukamaju"
                        value={form.lokasiWilayah}
                        onChange={(e) => setForm({ ...form, lokasiWilayah: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                      <label className={styles.formLabel}>Catatan Lapangan & Temuan</label>
                      <textarea
                        placeholder="Keterangan kondisi responden, batas wilayah, atau verifikasi lapangan..."
                        value={form.catatanLapangan}
                        onChange={(e) => setForm({ ...form, catatanLapangan: e.target.value })}
                        className={styles.formTextarea}
                      />
                    </div>
                  </>
                )}

                {/* Schedule Attachment Mode */}
                {activeMode === 'schedule' && (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Pilih Agenda Hari Ini</label>
                      <select
                        value={form.selectedScheduleId}
                        onChange={(e) => setForm({ ...form, selectedScheduleId: e.target.value })}
                        className={styles.formSelect}
                      >
                        <option value="">-- Buat Agenda Baru / Tanpa Link --</option>
                        {scheduleDocs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.waktu || '00:00'} - {s.judul}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Judul Agenda Baru (Jika Belum Terdaftar)</label>
                      <input
                        type="text"
                        placeholder="Contoh: Rapat Koordinasi Tim Kerja"
                        value={form.judulJadwal}
                        onChange={(e) => setForm({ ...form, judulJadwal: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </>
                )}

                {/* Quick Snap Mode */}
                {activeMode === 'quick' && (
                  <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label className={styles.formLabel}>Catatan Cepat (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Ketik catatan singkat dokumentasi..."
                      value={form.catatanRingkas}
                      onChange={(e) => setForm({ ...form, catatanRingkas: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shutter Bar Bottom */}
          <footer className={styles.shutterSection}>
            {/* Recent Photo Thumbnail */}
            <button
              onClick={() => setShowHistory(true)}
              className={styles.thumbBtn}
              title="Lihat Galeri Foto Terkini"
            >
              {recentPhotos.length > 0 && recentPhotos[0].previewUrl ? (
                <img src={recentPhotos[0].previewUrl} alt="Last Snap" className={styles.thumbImage} />
              ) : (
                <Layers size={20} />
              )}
            </button>

            {/* Shutter Button */}
            <button
              onClick={handleCapture}
              disabled={isProcessing}
              className={styles.shutterBtnOuter}
              title="Ambil Foto Ber-Watermark"
            >
              <div className={styles.shutterBtnInner} />
            </button>

            {/* Flip Camera Button */}
            <button
              onClick={handleFlipCamera}
              className={styles.flipBtn}
              title="Balik Kamera Depan / Belakang"
            >
              <RotateCcw size={22} />
            </button>
          </footer>
        </div>
      )}

      {/* Review Screen Overlay */}
      {watermarkedUrl && (
        <div className={styles.reviewOverlay}>
          <header className={styles.reviewHeader}>
            <span className={styles.reviewTitle}>Pratinjau Foto Watermark Resmi</span>
            <button onClick={handleRetake} className={styles.actionIconBtn} title="Tutup">
              <X size={18} />
            </button>
          </header>

          <div className={styles.reviewImageWrapper}>
            <img src={watermarkedUrl} alt="Watermarked Preview" className={styles.reviewImage} />
          </div>

          <footer className={styles.reviewFooter}>
            <div className={styles.reviewMetaSummary}>
              <div className={styles.reviewMetaItem}>
                <MapPin size={14} color="#38bdf8" />
                <span>
                  {coords
                    ? `Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)}`
                    : 'Tanpa GPS'}
                </span>
                {coords && (
                  <button
                    type="button"
                    onClick={handleCopyCoords}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Salin Koordinat"
                  >
                    {copiedCoords ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div className={styles.reviewMetaItem}>
                <Clock size={14} color="#a5b4fc" />
                <span>{currentTimeStr}</span>
              </div>
              {compressedInfo && (
                <div className={styles.reviewMetaItem}>
                  <Sparkles size={14} color="#4ade80" />
                  <span>Ukuran: {formatBytes(compressedInfo.compressedSize)}</span>
                </div>
              )}
            </div>

            <div className={styles.reviewButtonGroup}>
              <button
                type="button"
                onClick={handleRetake}
                className={styles.btnSecondary}
                disabled={isUploading}
              >
                <RotateCcw size={16} />
                Ulangi Foto
              </button>

              <button
                type="button"
                onClick={handleDownloadLocal}
                className={styles.btnSecondary}
                disabled={isUploading}
                title="Simpan Langsung ke Galeri HP"
              >
                <Download size={16} />
                Unduh ke HP
              </button>

              <button
                type="button"
                onClick={handleSaveAsCkpDraft}
                className={styles.btnSecondary}
                disabled={isUploading}
                title="Simpan foto dan geotag sebagai Draft CKP untuk dilengkapi nanti"
                style={{ borderColor: 'rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
              >
                <FileText size={16} />
                Simpan Draft CKP
              </button>

              <button
                type="button"
                onClick={handleSubmitAndUpload}
                className={styles.btnPrimary}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Menyimpan ke SuperBrain...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    Simpan ke SuperBrain
                  </>
                )}
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* History Drawer Modal */}
      {showHistory && (
        <div className={styles.historyModal} onClick={() => setShowHistory(false)}>
          <div className={styles.historyCard} onClick={(e) => e.stopPropagation()}>
            <header className={styles.historyHeader}>
              <span className={styles.historyTitle}>
                <Layers size={18} color="#6366f1" />
                Riwayat Foto Sesi Lapangan
              </span>
              <button onClick={() => setShowHistory(false)} className={styles.actionIconBtn}>
                <X size={18} />
              </button>
            </header>

            <div className={styles.historyList}>
              {recentPhotos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', margin: '30px 0' }}>
                  Belum ada foto yang diambil pada sesi ini. Silakan jepret foto dokumentasi Anda.
                </p>
              ) : (
                recentPhotos.map((item) => (
                  <div key={item.id} className={styles.historyItem}>
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.title} className={styles.historyItemThumb} />
                    ) : (
                      <div className={styles.historyItemThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={24} color="#64748b" />
                      </div>
                    )}
                    <div className={styles.historyItemInfo}>
                      <div className={styles.historyItemTitle}>{item.title}</div>
                      <div className={styles.historyItemMeta}>
                        Pukul {item.time} {item.coords && `• ${item.coords}`}
                      </div>
                      <div>
                        {item.driveLink ? (
                          <span className={`${styles.historyItemBadge} ${styles.badgeSuccess}`}>
                            Tersimpan di Google Drive
                          </span>
                        ) : item.isOffline ? (
                          <span className={`${styles.historyItemBadge} ${styles.badgeOffline}`}>
                            Antrean Offline Lokal
                          </span>
                        ) : (
                          <span className={`${styles.historyItemBadge} ${styles.badgeSuccess}`}>
                            Tersimpan di Sistem
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.historyActions}>
                      {item.driveLink && (
                        <a
                          href={item.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.historyActionBtn}
                          title="Buka di Google Drive"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      {item.coords && (
                        <a
                          href={`https://www.google.com/maps?q=${item.coords.replace(/\s+/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.historyActionBtn}
                          title="Lihat Titik di Google Maps"
                        >
                          <MapPin size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
