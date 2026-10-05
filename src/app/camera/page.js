'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Copy,
  Settings,
  SlidersHorizontal,
  Timer as TimerIcon,
  Video as VideoIcon,
  Play,
  Square,
  Trash2,
  Map as MapIcon
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSkps } from '@/hooks/useSkps';
import { useFirestore } from '@/hooks/useFirestore';
import { useAlert } from '@/contexts/AlertContext';
import { uploadFileToDrive, getOrCreateFolder } from '@/lib/drive';
import {
  savePendingUpload,
  saveDraftActivity,
  saveCameraMedia,
  getCameraMedia,
  removeCameraMedia
} from '@/lib/localdb';
import { compressImage, formatBytes } from '@/lib/compressor';

const CAPTURE_MODES = [
  { id: 'ckp', label: 'BUKTI CKP', desc: 'Tautkan ke butir SKP & kegiatan harian' },
  { id: 'field', label: 'DINAS LAPANGAN', desc: 'Survei, sensus, supervisi lapangan' },
  { id: 'schedule', label: 'JADWAL', desc: 'Presensi & dokumentasi agenda' },
  { id: 'video', label: 'VIDEO', desc: 'Rekam video tugas lapangan ber-geotag' },
  { id: 'quick', label: 'QUICK SNAP', desc: 'Jepret cepat ber-watermark' },
];

export default function CameraPage() {
  const router = useRouter();
  const { user, accessToken, loginWithGoogle } = useAuth();
  const { profile } = useUserProfile();
  const { skpData } = useSkps();
  const { addDocument: addCkpDoc } = useFirestore('ckp');
  const { docs: scheduleDocs } = useFirestore('schedule');
  const { addDocument: addScheduleDoc } = useFirestore('schedule');
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
  const [timerSeconds, setTimerSeconds] = useState(0); // 0 (off), 3, 10
  const [countdownVal, setCountdownVal] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const [focusRing, setFocusRing] = useState(null); // { x, y }

  // Video recording states
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoAnimRef = useRef(null);
  const recordingCanvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // in seconds
  const [videoReviewBlob, setVideoReviewBlob] = useState(null);
  const [videoReviewUrl, setVideoReviewUrl] = useState(null);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(null);

  // GPS Geotag states
  const [coords, setCoords] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('searching'); // searching, locked, error
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Mode & Form states
  const [activeMode, setActiveMode] = useState('ckp');
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    // Quick & Video Mode
    catatanRingkas: ''
  });

  // Photo Review & Processing states
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [watermarkedBlob, setWatermarkedBlob] = useState(null);
  const [watermarkedUrl, setWatermarkedUrl] = useState(null);
  const [photoThumbnailUrl, setPhotoThumbnailUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressedInfo, setCompressedInfo] = useState(null);

  // Geotag Media Gallery states
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState([]);
  const [galleryFilter, setGalleryFilter] = useState('all'); // all, photo, video, ckp, field, schedule
  const [selectedMediaDetail, setSelectedMediaDetail] = useState(null);
  const [latestThumbnail, setLatestThumbnail] = useState(null);

  // Refresh persistent media from IndexedDB
  const refreshGalleryMedia = useCallback(async () => {
    try {
      const items = await getCameraMedia(user?.uid);
      const processed = items.map((item) => {
        let displayThumb = item.thumbnailUrl;
        if (!displayThumb || displayThumb.startsWith('blob:')) {
          if (item.blob) {
            try {
              displayThumb = URL.createObjectURL(item.blob);
            } catch (_) {}
          }
        }
        return {
          ...item,
          displayThumb: displayThumb || item.thumbnailUrl
        };
      });

      setGalleryMedia(processed);
      if (processed.length > 0 && processed[0].displayThumb) {
        setLatestThumbnail(processed[0].displayThumb);
      }
    } catch (e) {
      console.warn('Failed to load camera media from IndexedDB:', e);
    }
  }, [user?.uid]);

  // Load gallery on mount
  useEffect(() => {
    refreshGalleryMedia();
  }, [refreshGalleryMedia]);

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
        setPermissionError('Peramban Anda tidak mendukung Web Media API untuk kamera langsung.');
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
        'Izin akses kamera ditolak atau sedang digunakan oleh aplikasi lain. Anda tetap dapat menggunakan tombol Pilih Foto dari Galeri.'
      );
      setCameraActive(false);
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    initCamera(isFrontCamera, cameraLens);

    return () => {
      if (videoAnimRef.current) {
        cancelAnimationFrame(videoAnimRef.current);
        videoAnimRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [initCamera, isFrontCamera, cameraLens]);

  // Flip Camera (Front / Rear)
  const handleFlipCamera = () => {
    if (isRecording) return;
    const nextFront = !isFrontCamera;
    setIsFrontCamera(nextFront);
    setCameraLens('1x');
  };

  // Switch Lens (1x / 0.5x)
  const handleLensSelect = (lens) => {
    if (isRecording) return;
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

  // Toggle Timer (Off -> 3s -> 10s)
  const handleToggleTimer = () => {
    if (timerSeconds === 0) setTimerSeconds(3);
    else if (timerSeconds === 3) setTimerSeconds(10);
    else setTimerSeconds(0);
  };

  // Tap-to-Focus handler
  const handleViewfinderTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusRing({ x, y });
    setTimeout(() => {
      setFocusRing(null);
    }, 1200);
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

  // Helper to draw a rounded rectangle with corner radius on Canvas
  const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  // Render Official BPS Geotag Watermark Matching CKP Bukti Dukung Design
  const drawLiquidGlassWatermark = (ctx, width, height, options = {}) => {
    const {
      profile: userProfile = profile,
      user: currentUser = user,
      coords: currentCoords = coords,
      activeMode: mode = activeMode,
      form: currentForm = form,
      scheduleDocs: schedules = scheduleDocs,
      customTime = null
    } = options;

    const namaPetugas = userProfile?.displayName || currentUser?.displayName || 'Petugas BPS';
    const nipPetugas = userProfile?.nip ? ` (NIP: ${userProfile.nip})` : '';
    const satkerPetugas = userProfile?.satker || 'BPS Republik Indonesia';
    const petugasLine = `Petugas: ${namaPetugas}${nipPetugas} | ${satkerPetugas}`;

    let detailLine = '';
    if (mode === 'ckp') {
      detailLine = `Kegiatan: ${currentForm.rincian || 'Dokumentasi Bukti Dukung CKP'}${currentForm.jumlah ? ` (${currentForm.jumlah} ${currentForm.satuan || 'Kegiatan'})` : ''}`;
    } else if (mode === 'field') {
      detailLine = `Kegiatan: ${currentForm.namaSurvei || 'Pemeriksaan Lapangan'}${currentForm.lokasiWilayah ? ` | Lokasi: ${currentForm.lokasiWilayah}` : ''}`;
    } else if (mode === 'schedule') {
      const sc = (schedules || []).find((s) => s.id === currentForm.selectedScheduleId);
      detailLine = `Kegiatan: ${sc ? sc.judul : currentForm.judulJadwal || 'Kegiatan Rapat / Dinas'}`;
    } else if (mode === 'video') {
      detailLine = `Kegiatan: ${currentForm.catatanRingkas || 'Perekaman Lapangan'}`;
    } else {
      detailLine = `Kegiatan: ${currentForm.catatanRingkas || 'Dokumentasi Lapangan'}`;
    }

    const now = customTime || new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const dateTimeLine = `Waktu: ${dateStr} ${timeStr} WIB`;

    let coordsLine = 'Lokasi: Menunggu Sinyal GPS...';
    if (currentCoords) {
      const acc = currentCoords.accuracy ? ` (±${Math.round(currentCoords.accuracy)}m)` : '';
      coordsLine = `Lokasi: Lat ${currentCoords.lat.toFixed(6)}, Lon ${currentCoords.lon.toFixed(6)}${acc}`;
    }

    // Proportional dimensions for CKP full-width geotag bottom banner
    const fontSize = Math.max(14, Math.round(width * 0.024));
    const lineGap = Math.round(fontSize * 1.48);
    const paddingX = Math.max(20, Math.round(width * 0.026));
    const paddingTop = Math.max(14, Math.round(fontSize * 0.9));
    const paddingBottom = Math.max(18, Math.round(fontSize * 1.15));

    // Calculate bar height covering 4 clean data lines: Waktu, Lokasi, Kegiatan, Petugas
    const barHeight = paddingTop + (lineGap * 3) + fontSize + paddingBottom;
    const barY = height - barHeight;

    ctx.save();

    // 1. Full-Width Dark Translucent Geotag Bar (CKP Geotag Signature Style)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.fillRect(0, barY, width, barHeight);

    // 2. Top Accent Line (Subtle white separator line)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, Math.round(width * 0.0015));
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(width, barY);
    ctx.stroke();

    // 3. Top Accent BPS Amber Stripe
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, barY, Math.min(120, Math.round(width * 0.12)), Math.max(2, Math.round(width * 0.003)));

    // Shadow for crisp legibility over light or dark backgrounds
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;

    let textY = barY + paddingTop + fontSize;
    const maxChars = Math.max(20, Math.floor((width - (paddingX * 2)) / (fontSize * 0.58)));

    // Line 1: Waktu
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(dateTimeLine, paddingX, textY);

    // Line 2: Lokasi (GPS)
    textY += lineGap;
    ctx.fillStyle = '#38bdf8';
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(coordsLine, paddingX, textY);

    // Line 3: Kegiatan
    textY += lineGap;
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const truncatedDetail = detailLine.length > maxChars ? `${detailLine.substring(0, maxChars - 3)}...` : detailLine;
    ctx.fillText(truncatedDetail, paddingX, textY);

    // Line 4: Petugas
    textY += lineGap;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 ${Math.max(12, Math.round(fontSize * 0.88))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const truncatedPetugas = petugasLine.length > maxChars ? `${petugasLine.substring(0, maxChars - 3)}...` : petugasLine;
    ctx.fillText(truncatedPetugas, paddingX, textY);

    ctx.restore();
  };

  // Render Official Geotag Watermark with Liquid Glass Design to Canvas
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

          // Render Liquid Glass Watermark Card
          drawLiquidGlassWatermark(ctx, width, height, {
            profile,
            user,
            coords,
            activeMode,
            form,
            scheduleDocs
          });

          // Output canvas as compressed JPEG and create persistent base64 thumbnail
          canvas.toBlob(
            (finalBlob) => {
              let thumbDataUrl = null;
              try {
                const thumbCanvas = document.createElement('canvas');
                const tMax = 320;
                let tw = width;
                let th = height;
                if (tw > th) {
                  if (tw > tMax) {
                    th = Math.round((th * tMax) / tw);
                    tw = tMax;
                  }
                } else {
                  if (th > tMax) {
                    tw = Math.round((tw * tMax) / th);
                    th = tMax;
                  }
                }
                thumbCanvas.width = tw;
                thumbCanvas.height = th;
                const tCtx = thumbCanvas.getContext('2d');
                tCtx.drawImage(canvas, 0, 0, tw, th);
                thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
              } catch (_) {}

              resolve({ watermarkedBlob: finalBlob, thumbnailDataUrl: thumbDataUrl });
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

      // Render official watermark with persistent thumbnail
      const { watermarkedBlob: watermarked, thumbnailDataUrl } = await generateWatermarkedImage(rawBlob);
      setWatermarkedBlob(watermarked);
      setPhotoThumbnailUrl(thumbnailDataUrl);
      if (thumbnailDataUrl) {
        setLatestThumbnail(thumbnailDataUrl);
      }

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

  // Trigger snapshot from video
  const triggerCapture = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setShowShutterFlash(true);
    setTimeout(() => setShowShutterFlash(false), 220);

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

  // ===== VIDEO RECORDING CONTROLS (With Embedded Liquid Glass Watermark) =====
  const startVideoRecording = async () => {
    if (!streamRef.current) return;
    try {
      recordedChunksRef.current = [];

      // Acquire audio track if possible to combine with video
      const audioTracks = [];
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTracks.push(audioTrack);
        }
      } catch (audioErr) {
        console.warn('Audio stream not available or denied, recording video muted:', audioErr);
      }

      // Burn liquid glass watermark into canvas stream if supported
      let recordingStream = null;
      if (videoRef.current && typeof HTMLCanvasElement.prototype.captureStream === 'function') {
        try {
          const vw = videoRef.current.videoWidth || 1280;
          const vh = videoRef.current.videoHeight || 720;
          const recCanvas = document.createElement('canvas');
          recCanvas.width = vw;
          recCanvas.height = vh;
          const vCtx = recCanvas.getContext('2d');
          recordingCanvasRef.current = recCanvas;

          const renderVideoFrame = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              vCtx.drawImage(videoRef.current, 0, 0, vw, vh);
              drawLiquidGlassWatermark(vCtx, vw, vh, {
                profile,
                user,
                coords,
                activeMode: 'video',
                form,
                scheduleDocs
              });
            }
            videoAnimRef.current = requestAnimationFrame(renderVideoFrame);
          };
          renderVideoFrame();

          const canvasStream = recCanvas.captureStream(30);
          recordingStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks
          ]);
        } catch (canvasErr) {
          console.warn('Canvas stream capture error, fallback to raw stream:', canvasErr);
        }
      }

      if (!recordingStream) {
        recordingStream = new MediaStream([
          ...streamRef.current.getVideoTracks(),
          ...audioTracks
        ]);
      }

      // Check supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      const selectedMime = mimeTypes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(recordingStream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (videoAnimRef.current) {
          cancelAnimationFrame(videoAnimRef.current);
          videoAnimRef.current = null;
        }

        const finalMime = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        setVideoReviewBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoReviewUrl(url);

        // Generate quick thumbnail with liquid glass watermark from current video frame
        if (videoRef.current) {
          try {
            const thumbCanvas = document.createElement('canvas');
            const tw = 480;
            const th = 360;
            thumbCanvas.width = tw;
            thumbCanvas.height = th;
            const tCtx = thumbCanvas.getContext('2d');
            tCtx.drawImage(videoRef.current, 0, 0, tw, th);
            drawLiquidGlassWatermark(tCtx, tw, th, {
              profile,
              user,
              coords,
              activeMode: 'video',
              form,
              scheduleDocs
            });
            const thumbData = thumbCanvas.toDataURL('image/jpeg', 0.8);
            setVideoThumbnailUrl(thumbData);
          } catch (_) {}
        }

        // Clean up audio track if any
        audioTracks.forEach((track) => track.stop());
      };

      recorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration ticker
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start video recording:', err);
      showAlert('Gagal memulai perekaman video: ' + err.message);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (videoAnimRef.current) {
        cancelAnimationFrame(videoAnimRef.current);
        videoAnimRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Format seconds to mm:ss
  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Handle Shutter click (honoring active timer & video mode)
  const handleShutterClick = () => {
    if (isProcessing) return;

    // In VIDEO mode: toggle recording
    if (activeMode === 'video') {
      if (isRecording) {
        stopVideoRecording();
      } else {
        startVideoRecording();
      }
      return;
    }

    // In PHOTO modes: honor timer
    if (timerSeconds > 0) {
      let count = timerSeconds;
      setCountdownVal(count);
      const timerInt = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(timerInt);
          setCountdownVal(null);
          triggerCapture();
        } else {
          setCountdownVal(count);
        }
      }, 1000);
    } else {
      triggerCapture();
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

    try {
      await processImageToPreview(file);
    } catch (err) {
      console.error('File pick error:', err);
      showAlert('Gagal memproses berkas galeri: ' + err.message);
    }
  };

  // Retake or discard photo preview
  const handleRetake = () => {
    if (watermarkedUrl) {
      URL.revokeObjectURL(watermarkedUrl);
    }
    setCapturedBlob(null);
    setWatermarkedBlob(null);
    setWatermarkedUrl(null);
    setPhotoThumbnailUrl(null);
    setCompressedInfo(null);
  };

  // Discard video preview
  const handleDiscardVideo = () => {
    if (videoReviewUrl) {
      URL.revokeObjectURL(videoReviewUrl);
    }
    setVideoReviewBlob(null);
    setVideoReviewUrl(null);
    setVideoThumbnailUrl(null);
    setRecordingDuration(0);
  };

  // Download photo directly to local storage
  const handleDownloadLocal = () => {
    if (!watermarkedBlob) return;
    const link = document.createElement('a');
    link.href = watermarkedUrl;
    link.download = `Dokumentasi_BPS_${activeMode.toUpperCase()}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert('Foto berhasil diunduh ke penyimpanan perangkat Anda!');
  };

  // Download video directly to local storage
  const handleDownloadVideo = () => {
    if (!videoReviewBlob) return;
    const link = document.createElement('a');
    link.href = videoReviewUrl;
    link.download = `Video_Dokumentasi_BPS_${Date.now()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert('Video berhasil diunduh ke penyimpanan perangkat Anda!');
  };

  // Save as Draft CKP (so user can fill details later)
  const handleSaveAsCkpDraft = async () => {
    if (!watermarkedBlob || !user) {
      showAlert('Silakan login terlebih dahulu untuk menyimpan draft.');
      return;
    }

    setIsUploading(true);
    try {
      const now = new Date();
      const todayYMD = now.toISOString().split('T')[0];
      const timestampId = Date.now();
      const fileName = `Draft_CKP_${todayYMD}_${timestampId}.jpg`;
      const finalFile = new File([watermarkedBlob], fileName, { type: 'image/jpeg' });

      let draftTitle = 'Foto Lapangan';
      if (activeMode === 'ckp') {
        draftTitle = form.rincian || 'Dokumentasi Bukti CKP';
      } else if (activeMode === 'field') {
        draftTitle = `${form.namaSurvei || 'Dinas Lapangan'} (${form.lokasiWilayah || 'SLS'})`;
      } else if (activeMode === 'schedule') {
        draftTitle = form.judulJadwal || 'Lampiran Jadwal';
      }

      const draftPayload = {
        id: timestampId,
        title: draftTitle,
        form: {
          tanggal: todayYMD,
          skpId: form.skpId || '',
          skpIds: form.skpId ? [Number(form.skpId)] : [],
          rincian: form.rincian || draftTitle,
          jumlah: Number(form.jumlah) || 1,
          satuan: form.satuan || 'Dokumen',
          kualitas: Number(form.kualitas) || 100,
          waktuMulai: form.waktuMulai || '08:00',
          waktuSelesai: form.waktuSelesai || '16:00',
          isFullday: form.isFullday,
          timKerja: 'Subbagian Umum',
        },
        files: [finalFile],
        previewImage: photoThumbnailUrl || (watermarkedBlob ? URL.createObjectURL(watermarkedBlob) : null),
        buktiDukung: null,
        geotag: coords ? { lat: coords.lat, lon: coords.lon, accuracy: coords.accuracy } : null,
        sumber: 'camera_geotag',
        updatedAt: timestampId
      };

      await saveDraftActivity(draftPayload, user.uid);

      // Save to Geotag Gallery IndexedDB with persistent thumbnail
      const persistentThumb = photoThumbnailUrl || (watermarkedBlob ? URL.createObjectURL(watermarkedBlob) : null);
      await saveCameraMedia({
        id: `photo_${timestampId}`,
        type: 'photo',
        blob: watermarkedBlob,
        thumbnailUrl: persistentThumb,
        title: draftTitle,
        fileName,
        mode: activeMode,
        coords: coords ? { lat: coords.lat, lon: coords.lon, accuracy: coords.accuracy } : null,
        timestamp: timestampId,
        timeFormatted: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        driveLink: null,
        isOffline: true,
        size: watermarkedBlob.size
      }, user.uid);

      refreshGalleryMedia();
      showAlert('Foto dan koordinat geotag berhasil disimpan sebagai Draft CKP! Anda dapat melengkapi rincian tugasnya nanti di menu CKP Harian.', 'success');
      handleRetake();
    } catch (err) {
      console.error('Save camera draft error:', err);
      showAlert('Gagal menyimpan draft: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit and Upload PHOTO to SuperBrain System (Drive & Firestore & Offline Queue & Gallery)
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

    // 1. Attempt upload to Google Drive if OAuth access token available and online
    if (accessToken && navigator.onLine) {
      try {
        const rootFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
        let targetFolder = 'Kamera Lapangan';
        if (activeMode === 'ckp') targetFolder = 'Bukti Dukung CKP';
        else if (activeMode === 'field') targetFolder = 'Dinas Lapangan';

        const subFolderId = await getOrCreateFolder(accessToken, targetFolder, rootFolderId);
        driveLink = await uploadFileToDrive(finalFile, accessToken, subFolderId, fileName);
      } catch (driveErr) {
        console.warn('Google Drive direct upload failed, saving to offline sync queue...', driveErr);
      }
    }

    // 2. Build system document payload according to selected mode
    const baseEntryId = `cam_${timestampId}`;
    let ckpRecord = null;
    let scheduleRecord = null;

    const mediaTitle =
      activeMode === 'ckp'
        ? form.rincian || 'Dokumentasi Bukti CKP'
        : activeMode === 'field'
        ? form.namaSurvei || 'Dinas Lapangan'
        : activeMode === 'schedule'
        ? form.judulJadwal || 'Lampiran Jadwal'
        : 'Quick Snap';

    if (activeMode === 'ckp') {
      const selectedSkp = skpData.find((s) => String(s.id) === String(form.skpId));
      ckpRecord = {
        userId: user.uid,
        tanggal: todayYMD,
        skpId: form.skpId || 'none',
        skpIds: form.skpId ? [Number(form.skpId)] : [],
        skpJudul: selectedSkp ? (selectedSkp.nama || selectedSkp.rencanaKinerja || '') : '',
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

    // 3. Save to Firestore, IndexedDB Pending Queue, and Geotag Gallery
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

      // Save to Geotag Media Gallery with persistent thumbnail
      const finalThumb = photoThumbnailUrl || (watermarkedBlob ? URL.createObjectURL(watermarkedBlob) : null);
      await saveCameraMedia({
        id: baseEntryId,
        type: 'photo',
        blob: watermarkedBlob,
        thumbnailUrl: finalThumb,
        title: mediaTitle,
        fileName,
        mode: activeMode,
        coords: coords ? { lat: coords.lat, lon: coords.lon, accuracy: coords.accuracy } : null,
        timestamp: timestampId,
        timeFormatted: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        driveLink,
        isOffline: isSavedOffline,
        size: watermarkedBlob.size
      }, user.uid);

      await refreshGalleryMedia();

      showAlert(
        isSavedOffline
          ? 'Foto berhasil disimpan di Galeri Geotagging & Antrean Lokal. Akan disinkronkan ke Google Drive saat online.'
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

  // Submit and Save VIDEO to SuperBrain System & Geotag Gallery
  const handleSubmitVideo = async () => {
    if (!videoReviewBlob || !user) {
      showAlert('Silakan login terlebih dahulu untuk menyimpan video.');
      return;
    }

    setIsUploading(true);
    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];
    const timestampId = Date.now();
    const fileName = `Video_BPS_${todayYMD}_${timestampId}.webm`;
    const finalFile = new File([videoReviewBlob], fileName, { type: 'video/webm' });

    let driveLink = null;
    let isSavedOffline = false;

    // Upload to Google Drive if OAuth token is present
    if (accessToken && navigator.onLine) {
      try {
        const rootFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
        const subFolderId = await getOrCreateFolder(accessToken, 'Video Lapangan', rootFolderId);
        driveLink = await uploadFileToDrive(finalFile, accessToken, subFolderId, fileName);
      } catch (driveErr) {
        console.warn('Google Drive direct video upload failed, saving locally:', driveErr);
      }
    }

    const baseEntryId = `vid_${timestampId}`;
    const videoTitle = form.catatanRingkas || form.rincian || 'Video Dokumentasi Lapangan';

    try {
      // If offline or Drive unavailable, queue file
      if (!driveLink) {
        await savePendingUpload(baseEntryId, finalFile, fileName, 'ckp', null, null, user.uid);
        isSavedOffline = true;
      }

      // Save to Geotag Media Gallery
      await saveCameraMedia({
        id: baseEntryId,
        type: 'video',
        blob: videoReviewBlob,
        thumbnailUrl: videoThumbnailUrl || null,
        title: videoTitle,
        fileName,
        mode: 'video',
        duration: recordingDuration,
        coords: coords ? { lat: coords.lat, lon: coords.lon, accuracy: coords.accuracy } : null,
        timestamp: timestampId,
        timeFormatted: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        driveLink,
        isOffline: isSavedOffline,
        size: videoReviewBlob.size
      }, user.uid);

      await refreshGalleryMedia();

      showAlert(
        isSavedOffline
          ? 'Video berhasil disimpan di Galeri Geotagging lokal.'
          : 'Video berhasil disimpan dan diunggah ke Google Drive!'
      );

      handleDiscardVideo();
    } catch (err) {
      console.error('Error saving video:', err);
      showAlert('Gagal menyimpan video: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete media item from Geotag Gallery
  const handleDeleteGalleryItem = async (mediaId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Apakah Anda yakin ingin menghapus media ini dari Galeri Geotagging?')) {
      try {
        await removeCameraMedia(mediaId);
        if (selectedMediaDetail && selectedMediaDetail.id === mediaId) {
          setSelectedMediaDetail(null);
        }
        await refreshGalleryMedia();
        showAlert('Media berhasil dihapus dari galeri.');
      } catch (err) {
        console.error('Delete media error:', err);
        showAlert('Gagal menghapus media: ' + err.message);
      }
    }
  };

  // Helper label for active task pill
  const getActiveTaskLabel = () => {
    if (activeMode === 'ckp') {
      const selectedSkp = skpData.find((s) => String(s.id) === String(form.skpId));
      if (form.rincian) return form.rincian;
      if (selectedSkp) return `SKP #${selectedSkp.id} - ${selectedSkp.nama || selectedSkp.rencanaKinerja}`;
      return 'Ketuk untuk atur Butir SKP & Rincian';
    }
    if (activeMode === 'field') {
      return form.namaSurvei ? `${form.namaSurvei} (${form.lokasiWilayah || 'SLS'})` : 'Ketuk untuk atur Nama Survei / Lokasi';
    }
    if (activeMode === 'schedule') {
      const sc = scheduleDocs.find((s) => s.id === form.selectedScheduleId);
      return sc ? sc.judul : form.judulJadwal || 'Ketuk untuk pilih Agenda Hari Ini';
    }
    if (activeMode === 'video') {
      return form.catatanRingkas ? `Video: ${form.catatanRingkas}` : 'Mode Perekaman Video Ber-Geotag';
    }
    return form.catatanRingkas || 'Ketuk untuk tambah Catatan Cepat';
  };

  // Filter gallery items
  const filteredGalleryMedia = galleryMedia.filter((item) => {
    if (galleryFilter === 'all') return true;
    if (galleryFilter === 'photo') return item.type === 'photo';
    if (galleryFilter === 'video') return item.type === 'video';
    if (galleryFilter === 'ckp') return item.mode === 'ckp';
    if (galleryFilter === 'field') return item.mode === 'field';
    if (galleryFilter === 'schedule') return item.mode === 'schedule';
    return true;
  });

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

      {/* Permission Error Fallback */}
      {permissionError && !cameraActive && (
        <div className={styles.permissionScreen}>
          <div className={styles.permissionIcon}>
            <Camera size={34} />
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
              style={{ background: '#334155', color: '#fff' }}
            >
              <ImageIcon size={18} />
              Pilih dari Galeri
            </button>
          </div>
          <button
            onClick={() => router.push('/')}
            className={styles.iconBtn}
            style={{ width: 'auto', padding: '8px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', marginTop: '8px', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            Kembali ke SuperBrain
          </button>
        </div>
      )}

      {/* Main Fullscreen Camera & In-Place Preview Viewport */}
      {(!permissionError || cameraActive) && (
        <>
          {/* Edge-to-Edge Fullscreen Viewfinder (Video Stream or Captured Preview) */}
          {watermarkedUrl ? (
            <img
              src={watermarkedUrl}
              alt="Pratinjau Foto"
              className={styles.cameraViewfinder}
              style={{ objectFit: 'contain', background: '#000' }}
            />
          ) : videoReviewUrl ? (
            <video
              src={videoReviewUrl}
              controls
              autoPlay
              playsInline
              className={styles.cameraViewfinder}
              style={{ objectFit: 'contain', background: '#000' }}
            />
          ) : (
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`${styles.cameraViewfinder} ${isFrontCamera ? styles.cameraViewfinderFlipped : ''}`}
              onClick={handleViewfinderTap}
            />
          )}

          {/* Live Camera Overlays */}
          {!watermarkedUrl && !videoReviewUrl && (
            <>
              {/* Framing Corner Guides (Signature CKP Geotag Viewfinder) */}
              <div className={styles.cameraGuide}>
                <div className={styles.cameraGuideInner}>
                  <div className={styles.cameraGuideCornerBR} />
                  <div className={styles.cameraGuideCornerBL} />
                </div>
              </div>

              {/* Shutter White Flash Effect */}
              {showShutterFlash && <div className={styles.shutterFlash} />}

              {/* Tap to Focus Ring (Yellow) */}
              {focusRing && (
                <div
                  className={styles.focusRing}
                  style={{ left: focusRing.x, top: focusRing.y }}
                />
              )}

              {/* 3x3 Grid Overlay */}
              {gridActive && (
                <div className={styles.gridOverlay}>
                  <div className={styles.gridH1} />
                  <div className={styles.gridH2} />
                  <div className={styles.gridV1} />
                  <div className={styles.gridV2} />
                </div>
              )}

              {/* Live Video Recording HUD */}
              {isRecording && (
                <div className={styles.recordingHud}>
                  <span className={styles.recordingDot} />
                  <span>REC</span>
                  <span>{formatSeconds(recordingDuration)}</span>
                </div>
              )}

              {/* Timer Countdown Big Number Overlay */}
              {countdownVal !== null && (
                <div className={styles.countdownOverlay}>
                  <div className={styles.countdownNumber}>{countdownVal}</div>
                </div>
              )}
            </>
          )}

          {/* Top Floating Control Bar */}
          <header className={styles.topBar}>
            <div className={styles.cameraTitle}>
              <div className={styles.cameraTitleIcon}>
                <Camera size={18} color="#fff" />
              </div>
              <span>
                {watermarkedUrl
                  ? 'Pratinjau Foto'
                  : videoReviewUrl
                  ? 'Pratinjau Video'
                  : 'Kamera Geotag'}
              </span>
            </div>

            <div className={styles.cameraTopActions}>
              {!watermarkedUrl && !videoReviewUrl && (
                <>
                  {/* Torch / Flash Toggle */}
                  {flashSupported && !isFrontCamera && (
                    <button
                      type="button"
                      onClick={handleToggleFlash}
                      className={`${styles.cameraCloseBtn} ${flashOn ? styles.flashBtnActive : ''}`}
                      title={flashOn ? 'Matikan Lampu Kilat' : 'Nyalakan Lampu Kilat'}
                    >
                      {flashOn ? <Zap size={18} color="#fbbf24" fill="#fbbf24" /> : <ZapOff size={18} />}
                    </button>
                  )}

                  {/* 3x3 Grid Toggle */}
                  <button
                    type="button"
                    onClick={() => setGridActive(!gridActive)}
                    className={`${styles.cameraCloseBtn} ${gridActive ? styles.btnActiveStyle : ''}`}
                    title="Garis Bantu Komposisi 3x3"
                  >
                    <Grid size={18} />
                  </button>

                  {/* Timer Toggle */}
                  {activeMode !== 'video' && (
                    <button
                      type="button"
                      onClick={handleToggleTimer}
                      className={`${styles.cameraCloseBtn} ${timerSeconds > 0 ? styles.btnActiveStyle : ''}`}
                      title="Timer Otomatis"
                    >
                      <TimerIcon size={18} />
                      {timerSeconds > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 800, marginLeft: '-4px' }}>
                          {timerSeconds}s
                        </span>
                      )}
                    </button>
                  )}

                  {/* Settings / Task Form Sheet */}
                  <button
                    type="button"
                    onClick={() => setFormSheetOpen(true)}
                    className={styles.cameraCloseBtn}
                    title="Rincian Kegiatan CKP & Parameter"
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </>
              )}

              {/* Close Button: Retakes in preview, or returns to /ckp in live mode */}
              <button
                type="button"
                onClick={() => {
                  if (watermarkedUrl) {
                    handleRetake();
                  } else if (videoReviewUrl) {
                    handleDiscardVideo();
                  } else {
                    router.push('/ckp');
                  }
                }}
                className={styles.cameraCloseBtn}
                title={watermarkedUrl || videoReviewUrl ? 'Batal & Ambil Ulang' : 'Tutup & Kembali ke Menu CKP'}
              >
                <X size={20} />
              </button>
            </div>
          </header>

          {/* Lens Quick Pills (0.5x / 1.0x / 2.0x) */}
          {!watermarkedUrl && !videoReviewUrl && !isFrontCamera && (
            <div className={styles.lensPill}>
              <button
                type="button"
                onClick={() => handleLensSelect('0.5x')}
                className={`${styles.lensBtn} ${cameraLens === '0.5x' ? styles.lensBtnActive : ''}`}
              >
                0.5
              </button>
              <button
                type="button"
                onClick={() => handleLensSelect('1x')}
                className={`${styles.lensBtn} ${cameraLens === '1x' && zoomLevel <= 1 ? styles.lensBtnActive : ''}`}
              >
                1.0
              </button>
              <button
                type="button"
                onClick={() => handleZoomChange(2)}
                className={`${styles.lensBtn} ${zoomLevel >= 2 ? styles.lensBtnActive : ''}`}
              >
                2.0
              </button>
            </div>
          )}

          {/* Camera Zoom Slider */}
          {!watermarkedUrl && !videoReviewUrl && zoomCaps && (
            <div className={styles.cameraZoomBar}>
              <span className={styles.cameraZoomLabel}>
                {zoomLevel.toFixed(1)}×
              </span>
              <input
                type="range"
                min={zoomCaps.min || 1}
                max={Math.min(zoomCaps.max || 5, 5)}
                step={zoomCaps.step || 0.1}
                value={zoomLevel}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className={styles.cameraZoomSlider}
              />
            </div>
          )}

          {/* Mode Carousel */}
          {!watermarkedUrl && !videoReviewUrl && !isRecording && (
            <nav className={styles.modeCarousel}>
              {CAPTURE_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveMode(mode.id)}
                  className={`${styles.modeItem} ${activeMode === mode.id ? styles.modeItemActive : ''}`}
                >
                  {mode.label}
                </button>
              ))}
            </nav>
          )}

          {/* Camera Hint (CKP Signature) */}
          <div className={styles.cameraHint}>
            {watermarkedUrl
              ? 'Tinjau foto sebelum disimpan'
              : videoReviewUrl
              ? 'Tinjau video sebelum disimpan'
              : activeMode === 'video'
              ? isRecording
                ? 'Sedang merekam video ber-geotag...'
                : 'Tekan tombol bulat merah untuk merekam video'
              : 'Tekan tombol bulat untuk mengambil foto'}
          </div>

          {/* Secondary Quick Action Bar (Download & Draft CKP) in Preview */}
          {watermarkedUrl && (
            <div className={styles.previewSecondaryBar}>
              <button
                type="button"
                onClick={handleDownloadLocal}
                className={styles.btnSecondaryCompact}
                disabled={isUploading}
                title="Unduh Langsung ke Galeri HP"
              >
                <Download size={14} /> Unduh
              </button>
              <button
                type="button"
                onClick={handleSaveAsCkpDraft}
                className={styles.btnSecondaryCompact}
                disabled={isUploading}
                title="Simpan sementara sebagai Draft CKP"
              >
                <FileText size={14} /> Draft CKP
              </button>
            </div>
          )}
          {videoReviewUrl && (
            <div className={styles.previewSecondaryBar}>
              <button
                type="button"
                onClick={handleDownloadVideo}
                className={styles.btnSecondaryCompact}
                disabled={isUploading}
                title="Unduh Video ke HP"
              >
                <Download size={14} /> Unduh Video
              </button>
            </div>
          )}

          {/* Bottom Controls Bar: Shutter Controls (Live) OR Preview Actions (Captured) */}
          <div className={styles.cameraBottomBar}>
            {watermarkedUrl || videoReviewUrl ? (
              <div className={styles.cameraPreviewActions}>
                <button
                  type="button"
                  onClick={watermarkedUrl ? handleRetake : handleDiscardVideo}
                  className={`${styles.cameraActionBtn} ${styles.cameraActionCancel}`}
                  disabled={isUploading}
                  title="Ambil Ulang"
                >
                  <RotateCcw size={18} />
                  Ambil Ulang
                </button>
                <button
                  type="button"
                  onClick={watermarkedUrl ? handleSubmitAndUpload : handleSubmitVideo}
                  className={`${styles.cameraActionBtn} ${styles.cameraActionConfirm}`}
                  disabled={isUploading}
                  title={watermarkedUrl ? 'Gunakan Foto' : 'Gunakan Video'}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      {watermarkedUrl ? 'Gunakan Foto' : 'Gunakan Video'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <>
                {/* Gallery Button */}
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className={styles.galleryBtn}
                  title="Buka Galeri Geotagging"
                >
                  {latestThumbnail ? (
                    <div className={styles.galleryThumbWrapper}>
                      <img
                        src={latestThumbnail}
                        alt="Thumbnail Terakhir"
                        className={styles.galleryThumbImg}
                        onError={() => setLatestThumbnail(null)}
                      />
                    </div>
                  ) : (
                    <div className={styles.galleryEmptyIcon}>
                      <ImageIcon size={20} color="#ffffff" />
                    </div>
                  )}
                </button>

                {/* Shutter Button (CKP Outer Ring + Inner White Circle) */}
                <button
                  type="button"
                  onClick={handleShutterClick}
                  disabled={isProcessing}
                  className={styles.cameraShutterOuter}
                  title={
                    activeMode === 'video'
                      ? isRecording
                        ? 'Hentikan Perekaman Video'
                        : 'Mulai Rekam Video'
                      : 'Ambil Foto Geotag'
                  }
                >
                  <div
                    className={`${styles.cameraShutterInner} ${
                      activeMode === 'video'
                        ? isRecording
                          ? styles.shutterVideoRecording
                          : styles.shutterVideoReady
                        : ''
                    }`}
                  />
                </button>

                {/* Flip Camera Button */}
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  disabled={isRecording}
                  className={styles.flipBtn}
                  title="Ganti Kamera Depan/Belakang"
                >
                  <RefreshCw size={20} />
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Samsung Bottom Sheet: Parameter Form (Slide-Up, Zero Main Scroll) */}
      {formSheetOpen && (
        <div className={styles.sheetOverlay} onClick={() => setFormSheetOpen(false)}>
          <div className={styles.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>
                <SlidersHorizontal size={18} color="#fbbf24" />
                Parameter {CAPTURE_MODES.find((m) => m.id === activeMode)?.label}
              </span>
              <button
                type="button"
                onClick={() => setFormSheetOpen(false)}
                className={styles.sheetCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.sheetBody}>
              {/* Mode: CKP */}
              {activeMode === 'ckp' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Butir SKP Terkait</label>
                    <select
                      value={form.skpId}
                      onChange={(e) => setForm({ ...form, skpId: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="">-- Tanpa Kaitan SKP Spesifik --</option>
                      {skpData.map((skp) => {
                        const skpTitle = skp.nama || skp.rencanaKinerja || `SKP #${skp.id}`;
                        return (
                          <option key={skp.id} value={skp.id}>
                            #{skp.id} - {skpTitle.length > 50 ? skpTitle.substring(0, 50) + '...' : skpTitle}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Rincian Kegiatan CKP</label>
                    <input
                      type="text"
                      placeholder="Contoh: Pencacahan lapangan survei..."
                      value={form.rincian}
                      onChange={(e) => setForm({ ...form, rincian: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Volume</label>
                      <input
                        type="number"
                        min="1"
                        value={form.jumlah}
                        onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Satuan</label>
                      <input
                        type="text"
                        placeholder="Dokumen / Kegiatan"
                        value={form.satuan}
                        onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Target Kualitas (%)</label>
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

              {/* Mode: Field Documentation */}
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

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Catatan Lapangan & Temuan</label>
                    <textarea
                      placeholder="Keterangan kondisi responden, batas wilayah, atau kendala lapangan..."
                      value={form.catatanLapangan}
                      onChange={(e) => setForm({ ...form, catatanLapangan: e.target.value })}
                      className={styles.formTextarea}
                    />
                  </div>
                </>
              )}

              {/* Mode: Schedule */}
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

              {/* Mode: Video / Quick Snap */}
              {(activeMode === 'quick' || activeMode === 'video') && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Catatan / Topik Rekaman</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pengecekan sampel batas SLS..."
                    value={form.catatanRingkas}
                    onChange={(e) => setForm({ ...form, catatanRingkas: e.target.value })}
                    className={styles.formInput}
                  />
                </div>
              )}
            </div>

            <div className={styles.sheetFooter}>
              <button
                type="button"
                onClick={() => setFormSheetOpen(false)}
                className={styles.sheetApplyBtn}
              >
                Terapkan Parameter & Siap Merekam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal (Samsung Quick Options) */}
      {showSettings && (
        <div className={styles.sheetOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.sheetCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>
                <Settings size={18} color="#fbbf24" />
                Pengaturan Kamera SuperBrain
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className={styles.sheetCloseBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.sheetBody}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Watermark Resmi BPS</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Sertakan logo BPS, geotag, nama petugas & waktu</div>
                </div>
                <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>Aktif Otomatis</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Identitas Petugas</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {profile?.displayName || user?.displayName || 'Petugas BPS'} (Satker: {profile?.satker || 'BPS'})
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Buka Galeri Geotagging</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Lihat semua foto dan video lapangan yang tersimpan</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    setGalleryOpen(true);
                  }}
                  className={styles.btnSecondary}
                  style={{ flex: 'none', padding: '8px 14px' }}
                >
                  <MapPin size={15} />
                  Buka Galeri
                </button>
              </div>
            </div>

            <div className={styles.sheetFooter}>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className={styles.sheetApplyBtn}
              >
                Tutup Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}


      {/* FULLSCREEN GEOTAGGING MEDIA GALLERY MODAL */}
      {galleryOpen && (
        <div className={styles.galleryModal}>
          <header className={styles.galleryHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className={styles.iconBtn}
                title="Kembali ke Kamera"
              >
                <ArrowLeft size={22} />
              </button>
              <span className={styles.galleryTitle}>
                <MapPin size={20} color="#fbbf24" />
                Galeri Geotagging Lapangan
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
              {filteredGalleryMedia.length} Media
            </span>
          </header>

          {/* Filter Bar */}
          <div className={styles.galleryFilterBar}>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'photo', label: 'Foto Geotag' },
              { id: 'video', label: 'Video' },
              { id: 'ckp', label: 'Bukti CKP' },
              { id: 'field', label: 'Dinas Lapangan' },
              { id: 'schedule', label: 'Jadwal' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGalleryFilter(tab.id)}
                className={`${styles.galleryFilterPill} ${galleryFilter === tab.id ? styles.galleryFilterPillActive : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Gallery Media Grid */}
          <div className={styles.galleryBody}>
            {filteredGalleryMedia.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                <Camera size={44} style={{ opacity: 0.35, marginBottom: '12px' }} />
                <p style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e2e8f0' }}>Belum ada media geotagging tersimpan.</p>
                <p style={{ fontSize: '0.78rem', maxWidth: '320px', margin: '8px auto' }}>
                  Ambil foto atau rekam video di lapangan untuk melihat dokumentasi ber-geotag di sini.
                </p>
              </div>
            ) : (
              <div className={styles.galleryGrid}>
                {filteredGalleryMedia.map((item) => {
                  const previewSrc = item.displayThumb || (item.thumbnailUrl && item.thumbnailUrl.startsWith('data:') ? item.thumbnailUrl : (item.blob ? URL.createObjectURL(item.blob) : item.thumbnailUrl));
                  return (
                    <div
                      key={item.id}
                      className={styles.galleryCard}
                      onClick={() => setSelectedMediaDetail(item)}
                      title={item.title}
                    >
                      <div className={styles.galleryCardImageWrapper}>
                        {previewSrc ? (
                          <img
                            src={previewSrc}
                            alt={item.title}
                            className={styles.galleryCardThumb}
                            loading="lazy"
                            onError={(e) => {
                              if (item.blob && !e.target.dataset.triedBlob) {
                                e.target.dataset.triedBlob = 'true';
                                e.target.src = URL.createObjectURL(item.blob);
                              }
                            }}
                          />
                        ) : (
                          <div className={styles.galleryCardEmptyThumb}>
                            {item.type === 'video' ? (
                              <VideoIcon size={24} color="#f43f5e" />
                            ) : (
                              <ImageIcon size={24} color="#94a3b8" />
                            )}
                          </div>
                        )}

                        {/* Liquid Glass Dark Scrim Overlay */}
                        <div className={styles.galleryCardScrim} />

                        {/* Top Bar: Mode & GPS */}
                        <div className={styles.galleryCardTopBar}>
                          <span className={styles.galleryCardModeBadge}>
                            {item.mode === 'ckp' ? 'CKP' : item.mode === 'field' ? 'DINAS' : item.mode === 'schedule' ? 'AGENDA' : item.type === 'video' ? 'VIDEO' : 'FOTO'}
                          </span>
                          {item.coords && (
                            <span className={styles.galleryCardGpsBadge} title="Memiliki Geotag GPS">
                              <MapPin size={10} />
                            </span>
                          )}
                        </div>

                        {/* Bottom Bar: Time or Video Duration & Sync */}
                        <div className={styles.galleryCardBottomBar}>
                          {item.type === 'video' ? (
                            <span className={styles.galleryCardVideoBadge}>
                              <Play size={9} fill="#ffffff" />
                              {item.duration ? formatSeconds(item.duration) : 'VID'}
                            </span>
                          ) : (
                            <span className={styles.galleryCardTimeBadge}>
                              {item.timeFormatted || 'Foto'}
                            </span>
                          )}

                          {item.driveLink && (
                            <span className={styles.galleryCardDriveBadge} title="Tersimpan di Google Drive">
                              <UploadCloud size={10} color="#34d399" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULL MEDIA DETAIL VIEWER MODAL */}
      {selectedMediaDetail && (
        <div className={styles.detailModal}>
          <header className={styles.detailHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSelectedMediaDetail(null)}
                className={styles.iconBtn}
                title="Kembali ke Galeri"
              >
                <ArrowLeft size={22} />
              </button>
              <span className={styles.detailTitle}>{selectedMediaDetail.title}</span>
            </div>
            <button
              type="button"
              onClick={(e) => handleDeleteGalleryItem(selectedMediaDetail.id, e)}
              className={styles.actionBtnDanger}
              title="Hapus media ini"
            >
              <Trash2 size={16} />
            </button>
          </header>

          <div className={styles.detailMediaWrapper}>
            {selectedMediaDetail.type === 'video' ? (
              <video
                src={selectedMediaDetail.blob ? URL.createObjectURL(selectedMediaDetail.blob) : ''}
                controls
                autoPlay
                playsInline
                className={styles.detailVideo}
              />
            ) : (
              <img
                src={selectedMediaDetail.thumbnailUrl || (selectedMediaDetail.blob ? URL.createObjectURL(selectedMediaDetail.blob) : '')}
                alt={selectedMediaDetail.title}
                className={styles.detailImage}
              />
            )}
          </div>

          {/* Sliding Metadata & Actions Sheet */}
          <div className={styles.detailInfoSheet}>
            <div className={styles.detailInfoRow}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#ffffff' }}>
                  {selectedMediaDetail.title}
                </div>
                <div className={styles.detailMeta}>
                  <span>Waktu: {selectedMediaDetail.timeFormatted || 'Hari Ini'}</span>
                  <span>•</span>
                  <span>Ukuran: {formatBytes(selectedMediaDetail.size || 0)}</span>
                </div>
              </div>

              {selectedMediaDetail.driveLink ? (
                <span className={styles.badgeSuccess}>Tersimpan di Drive</span>
              ) : selectedMediaDetail.isOffline ? (
                <span className={styles.badgeOffline}>Lokal Perangkat</span>
              ) : null}
            </div>

            {/* Geotag info */}
            {selectedMediaDetail.coords && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#38bdf8" />
                  <span>
                    Lat {selectedMediaDetail.coords.lat?.toFixed(5)}, Lon {selectedMediaDetail.coords.lon?.toFixed(5)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `${selectedMediaDetail.coords.lat?.toFixed(6)}, ${selectedMediaDetail.coords.lon?.toFixed(6)}`;
                      navigator.clipboard.writeText(text);
                      showAlert(`Koordinat disalin: ${text}`);
                    }}
                    className={styles.iconBtn}
                    style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.1)' }}
                    title="Salin Koordinat"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={`https://www.google.com/maps?q=${selectedMediaDetail.coords.lat},${selectedMediaDetail.coords.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.iconBtn}
                    style={{ width: '28px', height: '28px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}
                    title="Buka di Google Maps"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className={styles.detailActions}>
              <button
                type="button"
                onClick={() => {
                  if (!selectedMediaDetail.blob) return;
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(selectedMediaDetail.blob);
                  link.download = selectedMediaDetail.fileName || `Media_BPS_${Date.now()}.${selectedMediaDetail.type === 'video' ? 'webm' : 'jpg'}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  showAlert('Berkas berhasil diunduh ke perangkat.');
                }}
                className={styles.actionBtnOutline}
              >
                <Download size={14} />
                Unduh ke HP
              </button>

              {selectedMediaDetail.driveLink && (
                <a
                  href={selectedMediaDetail.driveLink}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.actionBtnOutline}
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={14} />
                  Buka Drive
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
