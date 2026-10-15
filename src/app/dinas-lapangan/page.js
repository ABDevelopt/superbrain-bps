'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Calendar,
  FileText,
  Printer,
  Plus,
  Search,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Building2,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  Check,
  Sparkles,
  Link as LinkIcon,
  Car,
  ClipboardList
} from 'lucide-react';

import styles from './page.module.css';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSkps } from '@/hooks/useSkps';
import { useFirestore } from '@/hooks/useFirestore';
import { useAlert } from '@/contexts/AlertContext';
import { uploadFileToDrive, getOrCreateFolder, makeFileOrFolderPublic } from '@/lib/drive';
import { savePendingUpload, getPendingUploads } from '@/lib/localdb';

import PrintLaporanView from './PrintLaporanView';
import PrintDokumentasiView from './PrintDokumentasiView';

function getLocalDateStr(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y}`;
  } catch (e) {
    return dateStr;
  }
}

export default function DinasLapanganPage() {
  const router = useRouter();
  const { user, accessToken, loginWithGoogle } = useAuth();
  const { profile: userProfile } = useUserProfile();
  const { skpData } = useSkps();
  const { showAlert } = useAlert();

  // Firestore collections
  const {
    docs: trips = [],
    loading: tripsLoading,
    addDocument: addTrip,
    updateDocument: updateTrip,
    deleteDocument: deleteTrip
  } = useFirestore('perjalanan_dinas');

  const { docs: dlDates = [], addDocument: addDlDate } = useFirestore('dinas_lapangan');
  const { docs: ckpDocs = [] } = useFirestore('ckp');
  const { addDocument: addScheduleDoc } = useFirestore('schedule');

  // Navigation state: 0 = Daftar & Jadwal, 1 = Form Input ST, 2 = Form Laporan, 3 = Pratinjau Cetak
  const [activeTab, setActiveTab] = useState(0);
  const [printSubView, setPrintSubView] = useState('laporan'); // 'laporan' | 'dokumentasi'

  // Selected Trip for Editing / Report / Print
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'rencana' | 'berjalan' | 'selesai'

  // Form State: Perjalanan Dinas / ST
  const [formST, setFormST] = useState({
    nomorSuratTugas: '',
    tanggalSuratTugas: getLocalDateStr(),
    pejabatPemberiTugas: 'Kepala BPS Kabupaten Penajam Paser Utara',
    namaPejabat: 'Ir. Muhammad Arsyad, M.Si',
    nipPejabat: '197505122000031001',
    jabatanPejabat: 'Kepala BPS Kab. Penajam Paser Utara',
    maksudTujuan: '',
    skpId: '',
    daerahTujuan: '',
    lokasiSpesifik: '',
    tanggalMulai: getLocalDateStr(),
    tanggalSelesai: getLocalDateStr(),
    lamaHari: 1,
    kendaraan: 'Kendaraan Operasional / Dinas',
    bebanAnggaran: 'DIPA BPS Kabupaten Penajam Paser Utara TA 2026',
    status: 'rencana',
    pelaksana: []
  });

  const [stFiles, setStFiles] = useState([]);
  const [existingStFiles, setExistingStFiles] = useState([]);
  const [isUploadingST, setIsUploadingST] = useState(false);

  // Form State: Laporan Hasil DL
  const [formLaporan, setFormLaporan] = useState({
    hasilKegiatan: '',
    kendalaMasalah: '',
    solusiTindakLanjut: '',
    kesimpulan: '',
    tanggalLaporan: getLocalDateStr(),
    tempatLaporan: 'Penajam',
    statusLaporan: 'draft',
    dokumentasi: []
  });

  // State for photo adding in report
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoLokasi, setNewPhotoLokasi] = useState('');

  // Initial populate pelaksana from user profile
  useEffect(() => {
    if (userProfile && formST.pelaksana.length === 0) {
      setFormST(prev => ({
        ...prev,
        pejabatPemberiTugas: userProfile.satker ? `Kepala ${userProfile.satker}` : prev.pejabatPemberiTugas,
        pelaksana: [
          {
            nama: userProfile.displayName || 'Pegawai Pelaksana',
            nip: userProfile.nip || '-',
            jabatan: userProfile.jabatan || 'Pegawai BPS',
            pangkatGol: userProfile.pangkatGol || 'Penata Muda (III/a)',
            peran: 'Utama'
          }
        ]
      }));
    }
  }, [userProfile]);

  // Auto calculate duration in days
  const calculateDays = (start, end) => {
    if (!start || !end) return 1;
    const d1 = new Date(start + 'T00:00:00');
    const d2 = new Date(end + 'T00:00:00');
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleStartDateChange = (val) => {
    const end = formST.tanggalSelesai < val ? val : formST.tanggalSelesai;
    setFormST(prev => ({
      ...prev,
      tanggalMulai: val,
      tanggalSelesai: end,
      lamaHari: calculateDays(val, end)
    }));
  };

  const handleEndDateChange = (val) => {
    const start = formST.tanggalMulai > val ? val : formST.tanggalMulai;
    setFormST(prev => ({
      ...prev,
      tanggalMulai: start,
      tanggalSelesai: val,
      lamaHari: calculateDays(start, val)
    }));
  };

  // Add / Remove Pelaksana
  const handleAddPelaksana = () => {
    setFormST(prev => ({
      ...prev,
      pelaksana: [
        ...prev.pelaksana,
        { nama: '', nip: '', jabatan: 'Pegawai BPS', pangkatGol: '', peran: 'Pendamping' }
      ]
    }));
  };

  const handleUpdatePelaksana = (index, field, value) => {
    setFormST(prev => {
      const updated = [...prev.pelaksana];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, pelaksana: updated };
    });
  };

  const handleRemovePelaksana = (index) => {
    setFormST(prev => ({
      ...prev,
      pelaksana: prev.pelaksana.filter((_, i) => i !== index)
    }));
  };

  // Filtered trips list
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      const matchesSearch = 
        (trip.nomorSuratTugas || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trip.maksudTujuan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trip.daerahTujuan || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || trip.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [trips, searchQuery, filterStatus]);

  // KPI Statistics
  const kpis = useMemo(() => {
    const total = trips.length;
    const active = trips.filter(t => t.status === 'berjalan').length;
    const completed = trips.filter(t => t.status === 'selesai').length;
    const needsReport = trips.filter(t => t.status === 'selesai' && (!t.laporan || !t.laporan.hasilKegiatan)).length;
    return { total, active, completed, needsReport };
  }, [trips]);

  // Open Edit Mode for Trip
  const handleOpenEditTrip = (trip) => {
    setSelectedTrip(trip);
    setFormST({
      nomorSuratTugas: trip.nomorSuratTugas || '',
      tanggalSuratTugas: trip.tanggalSuratTugas || getLocalDateStr(),
      pejabatPemberiTugas: trip.pejabatPemberiTugas || 'Kepala BPS Kabupaten Penajam Paser Utara',
      namaPejabat: trip.namaPejabat || '',
      nipPejabat: trip.nipPejabat || '',
      jabatanPejabat: trip.jabatanPejabat || '',
      maksudTujuan: trip.maksudTujuan || '',
      skpId: trip.skpId || '',
      daerahTujuan: trip.daerahTujuan || '',
      lokasiSpesifik: trip.lokasiSpesifik || '',
      tanggalMulai: trip.tanggalMulai || getLocalDateStr(),
      tanggalSelesai: trip.tanggalSelesai || getLocalDateStr(),
      lamaHari: trip.lamaHari || 1,
      kendaraan: trip.kendaraan || 'Kendaraan Operasional / Dinas',
      bebanAnggaran: trip.bebanAnggaran || 'DIPA BPS Kabupaten Penajam Paser Utara TA 2026',
      status: trip.status || 'rencana',
      pelaksana: trip.pelaksana || []
    });
    setExistingStFiles(trip.suratTugasFiles || []);
    setStFiles([]);
    setActiveTab(1);
  };

  // Open Report Editor
  const handleOpenReportEditor = (trip) => {
    setSelectedTrip(trip);
    const existing = trip.laporan || {};
    
    // Parse or initialize jadwalKegiatan slots
    let initialJadwal = existing.jadwalKegiatan;
    if (!initialJadwal || initialJadwal.length === 0) {
      if (existing.hasilKegiatan) {
        const lines = existing.hasilKegiatan.split('\n');
        const slots = [];
        let currSlot = null;
        const timeRegex = /^(\d{2}[.:]\d{2}\s*[-–—]\s*\d{2}[.:]\d{2})\s*(.*)$/;
        lines.forEach(line => {
          const match = line.match(timeRegex);
          if (match) {
            if (currSlot) slots.push(currSlot);
            currSlot = { waktu: match[1].replace(':', '.'), uraian: match[2].trim() };
          } else if (currSlot) {
            currSlot.uraian += '\n' + line;
          } else if (line.trim()) {
            currSlot = { waktu: '08.00 – 16.00', uraian: line };
          }
        });
        if (currSlot) slots.push(currSlot);
        initialJadwal = slots;
      } else {
        initialJadwal = [];
      }
    }

    setFormLaporan({
      tujuan: existing.tujuan || trip.daerahTujuan || '',
      namaPetugas: existing.namaPetugas || trip.pelaksana?.[0]?.nama || userProfile?.displayName || 'Yahya Abdurrohman, S.Tr.Stat.',
      tanggalTugas: existing.tanggalTugas || trip.tanggalMulai || getLocalDateStr(),
      perihal: existing.perihal || trip.maksudTujuan || '',
      jadwalKegiatan: initialJadwal,
      hasilKegiatan: existing.hasilKegiatan || '',
      kendalaMasalah: existing.kendalaMasalah || '',
      solusiTindakLanjut: existing.solusiTindakLanjut || '',
      kesimpulan: existing.kesimpulan || 'Demikian laporan hasil perjalanan dinas ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.',
      tanggalLaporan: existing.tanggalLaporan || trip.tanggalSelesai || getLocalDateStr(),
      tempatLaporan: existing.tempatLaporan || 'Penajam',
      statusLaporan: existing.statusLaporan || 'draft',
      dokumentasi: trip.dokumentasi || []
    });
    setActiveTab(2);
  };

  // Timeline slots management helpers
  const handleAddTimelineSlot = () => {
    setFormLaporan(prev => ({
      ...prev,
      jadwalKegiatan: [
        ...(prev.jadwalKegiatan || []),
        { waktu: '09.00 – 12.00', uraian: '' }
      ]
    }));
  };

  const handleUpdateTimelineSlot = (index, field, value) => {
    setFormLaporan(prev => {
      const updated = [...(prev.jadwalKegiatan || [])];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        jadwalKegiatan: updated,
        hasilKegiatan: updated.map(s => `${s.waktu}\t${s.uraian}`).join('\n\n')
      };
    });
  };

  const handleRemoveTimelineSlot = (index) => {
    setFormLaporan(prev => {
      const updated = prev.jadwalKegiatan.filter((_, i) => i !== index);
      return {
        ...prev,
        jadwalKegiatan: updated,
        hasilKegiatan: updated.map(s => `${s.waktu}\t${s.uraian}`).join('\n\n')
      };
    });
  };

  // Apply Standard BPS Field Trip Template (matches user sample docx from Nipah-nipah)
  const handleApplyBPSTemplate = () => {
    const dest = formLaporan.tujuan || selectedTrip?.daerahTujuan || 'lokasi tugas';
    const subj = formLaporan.perihal || selectedTrip?.maksudTujuan || 'pendataan survei/sensus';

    const defaultSlots = [
      {
        waktu: '07.30 – 07.45',
        uraian: 'Mengisi bahan bakar (BBM) kendaraan di SPBU sebelum berangkat menuju lokasi tugas.'
      },
      {
        waktu: '07.45 – 09.30',
        uraian: `Berangkat dari tempat tinggal di Nipah-nipah menuju wilayah ${dest} menggunakan kendaraan bermotor. Perjalanan ditempuh dengan kecepatan relatif normal. Tiba di lokasi ${dest} pada pukul 09.30 WITA.`
      },
      {
        waktu: '09.30 – 12.00',
        uraian: `Melaksanakan kegiatan ${subj} di wilayah ${dest}. Kegiatan meliputi:\na.  Mengunjungi kantor/aparat setempat dan penelusuran wilayah penugasan;\nb.  Pemeriksaan kesesuaian dan kelengkapan isian kuesioner dengan kondisi riil lapangan;\nc.  Wawancara dengan responden dan validasi silang data temuan;\nd.  Penempelan stiker pada bangunan/usaha yang telah selesai didata;\ne.  Penyelarasan nomor bangunan fisik dengan pencatatan pada sistem Fasih BPS.`
      },
      {
        waktu: '12.00 – 13.30',
        uraian: 'Istirahat, sholat Dzuhur, dan makan siang di sekitar lokasi penugasan.'
      },
      {
        waktu: '13.30 – 15.30',
        uraian: `Melanjutkan kegiatan ${subj} di wilayah ${dest}. Kegiatan meliputi:\na.  Melanjutkan kunjungan ke bangunan dan responden yang belum terjangkau pada sesi pagi;\nb.  Penyelesaian isian kuesioner dan konfirmasi data anomali;\nc.  Pencatatan seluruh hasil penugasan dan temuan untuk ditindaklanjuti melalui sistem Fasih.`
      },
      {
        waktu: '15.30 – 15.45',
        uraian: 'Mengisi bahan bakar (BBM) kendaraan di SPBU sebelum perjalanan pulang.'
      },
      {
        waktu: '15.45 – 17.30',
        uraian: `Melakukan perjalanan pulang dari wilayah ${dest} menuju tempat tinggal di Nipah-nipah. Perjalanan berjalan lancar dan tiba di tempat tinggal pada pukul 17.30 WITA.`
      }
    ];

    setFormLaporan(prev => ({
      ...prev,
      jadwalKegiatan: defaultSlots,
      hasilKegiatan: defaultSlots.map(s => `${s.waktu}\t${s.uraian}`).join('\n\n')
    }));

    showAlert('Template standar perjalanan dinas BPS (Nipah-nipah) berhasil diterapkan!', 'success');
  };

  // Pull CKP Activities into Report as Chronological Timeline Slots
  const handlePullFromCKP = () => {
    if (!selectedTrip) return;
    const tripDates = [];
    const curr = new Date(selectedTrip.tanggalMulai + 'T00:00:00');
    const end = new Date(selectedTrip.tanggalSelesai + 'T00:00:00');
    while (curr <= end) {
      tripDates.push(getLocalDateStr(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const matchedActivities = ckpDocs.filter(c => tripDates.includes(c.tanggal));
    if (matchedActivities.length === 0) {
      showAlert('Tidak ditemukan catatan kegiatan CKP harian pada tanggal perjalanan dinas ini.', 'info');
      return;
    }

    // Sort chronologically by date and start time
    matchedActivities.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      return (a.waktuMulai || '').localeCompare(b.waktuMulai || '');
    });

    const newSlots = matchedActivities.map(act => {
      const timeStr = (act.waktuMulai && act.waktuSelesai)
        ? `${act.waktuMulai.replace(':', '.')} – ${act.waktuSelesai.replace(':', '.')}`
        : '08.00 – 16.00';
      const rincian = `${act.rincian || 'Pelaksanaan kegiatan lapangan BPS'} (Output: ${act.kuantitas || 1} ${act.satuan || 'kegiatan'})`;
      return { waktu: timeStr, uraian: rincian };
    });

    setFormLaporan(prev => {
      const combined = [...(prev.jadwalKegiatan || []), ...newSlots];
      return {
        ...prev,
        jadwalKegiatan: combined,
        hasilKegiatan: combined.map(s => `${s.waktu}\t${s.uraian}`).join('\n\n')
      };
    });

    showAlert(`Berhasil mengonversi ${matchedActivities.length} aktivitas CKP ke dalam slot waktu laporan!`, 'success');
  };

  // Save Trip (Create or Update)
  const handleSaveTrip = async (e) => {
    e.preventDefault();
    if (!formST.nomorSuratTugas || !formST.maksudTujuan || !formST.daerahTujuan) {
      showAlert('Harap lengkapi Nomor Surat Tugas, Maksud/Tujuan, dan Daerah Tujuan!', 'error');
      return;
    }

    setIsUploadingST(true);
    try {
      let uploadedFiles = [...existingStFiles];

      // Upload ST files to GDrive if any
      if (stFiles.length > 0) {
        if (accessToken) {
          const cleanNomor = formST.nomorSuratTugas.replace(/[^a-zA-Z0-9 -]/g, '_');
          const parentFolderId = await getOrCreateFolder(accessToken, 'SuperBrain BPS');
          const dlFolderId = await getOrCreateFolder(accessToken, 'Surat Tugas & Perjalanan Dinas', parentFolderId);
          const subfolderName = `${formST.tanggalMulai} - ${cleanNomor}`;
          const subfolderId = await getOrCreateFolder(accessToken, subfolderName, dlFolderId);
          await makeFileOrFolderPublic(subfolderId, accessToken);

          for (let i = 0; i < stFiles.length; i++) {
            const file = stFiles[i];
            const fileName = `ST_${formST.tanggalMulai}_${cleanNomor}_${file.name}`;
            const fileUrl = await uploadFileToDrive(file, accessToken, subfolderId, fileName);
            uploadedFiles.push({
              name: file.name,
              url: fileUrl,
              uploadDate: getLocalDateStr(),
              size: file.size
            });
          }
        } else {
          // Offline save warning
          for (let i = 0; i < stFiles.length; i++) {
            const file = stFiles[i];
            await savePendingUpload(`st_${Date.now()}_${i}`, file, file.name, 'dinas_lapangan', null, null, user?.uid);
          }
          showAlert('Koneksi Google Drive belum aktif. Berkas disimpan sementara secara lokal di perangkat.', 'info');
        }
      }

      const tripPayload = {
        ...formST,
        skpId: formST.skpId ? Number(formST.skpId) : null,
        lamaHari: Number(formST.lamaHari) || 1,
        suratTugasFiles: uploadedFiles,
        userId: user?.uid || null
      };

      let tripId = selectedTrip?.id;
      if (selectedTrip?.id) {
        await updateTrip(selectedTrip.id, tripPayload);
        showAlert('Perjalanan Dinas berhasil diperbarui!', 'success');
      } else {
        const ref = await addTrip(tripPayload);
        tripId = ref?.id;
        showAlert('Perjalanan Dinas baru berhasil ditambahkan!', 'success');

        // Automatically sync to Calendar Schedule
        try {
          await addScheduleDoc({
            judul: `[DL] ${formST.maksudTujuan}`,
            tanggal: formST.tanggalMulai,
            tanggalSelesai: formST.tanggalSelesai,
            waktu: '08:00',
            kategori: 'Survei',
            lokasi: formST.daerahTujuan,
            keterangan: `Surat Tugas No. ${formST.nomorSuratTugas}. Pelaksana: ${formST.pelaksana.map(p => p.nama).join(', ')}`,
            skpId: formST.skpId ? Number(formST.skpId) : null,
            isSelesai: formST.status === 'selesai'
          });
        } catch (e) {
          console.error('Failed to auto-add schedule:', e);
        }
      }

      // Automatically sync DL dates to CKP dinas_lapangan collection
      try {
        const curr = new Date(formST.tanggalMulai + 'T00:00:00');
        const end = new Date(formST.tanggalSelesai + 'T00:00:00');
        while (curr <= end) {
          const dStr = getLocalDateStr(curr);
          const exists = dlDates.some(d => d.tanggal === dStr);
          if (!exists) {
            await addDlDate({ tanggal: dStr, tripId: tripId || null, nomorST: formST.nomorSuratTugas });
          }
          curr.setDate(curr.getDate() + 1);
        }
      } catch (e) {
        console.error('Failed to sync dates to CKP dinas_lapangan:', e);
      }

      setActiveTab(0);
      setSelectedTrip(null);
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan perjalanan dinas: ' + err.message, 'error');
    } finally {
      setIsUploadingST(false);
    }
  };

  // Save Report & Documentation
  const handleSaveReport = async () => {
    if (!selectedTrip) return;
    try {
      await updateTrip(selectedTrip.id, {
        laporan: {
          ...formLaporan,
          statusLaporan: 'final'
        },
        dokumentasi: formLaporan.dokumentasi,
        status: 'selesai'
      });
      showAlert('Laporan hasil kegiatan & dokumentasi berhasil disimpan!', 'success');
      setActiveTab(0);
    } catch (e) {
      showAlert('Gagal menyimpan laporan: ' + e.message, 'error');
    }
  };

  // Add Photo to Report Documentation
  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      showAlert('Harap masukkan URL foto terlebih dahulu!', 'error');
      return;
    }
    const newEntry = {
      id: 'doc_' + Date.now(),
      url: newPhotoUrl.trim(),
      caption: newPhotoCaption.trim() || 'Dokumentasi kegiatan lapangan',
      lokasi: newPhotoLokasi.trim() || selectedTrip?.daerahTujuan || '',
      tanggal: selectedTrip?.tanggalMulai || getLocalDateStr()
    };
    setFormLaporan(prev => ({
      ...prev,
      dokumentasi: [...prev.dokumentasi, newEntry]
    }));
    setNewPhotoUrl('');
    setNewPhotoCaption('');
    setNewPhotoLokasi('');
  };

  // Remove Photo
  const handleRemovePhoto = (id) => {
    setFormLaporan(prev => ({
      ...prev,
      dokumentasi: prev.dokumentasi.filter(p => p.id !== id)
    }));
  };

  // Delete Trip
  const handleDeleteTrip = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus data perjalanan dinas ini?')) {
      try {
        await deleteTrip(id);
        showAlert('Perjalanan dinas berhasil dihapus.', 'success');
      } catch (e) {
        showAlert('Gagal menghapus: ' + e.message, 'error');
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* View 3: Print Preview Mode */}
      {activeTab === 3 && (
        printSubView === 'laporan' ? (
          <PrintLaporanView 
            trip={selectedTrip} 
            onBack={() => setActiveTab(0)} 
            userProfile={userProfile} 
          />
        ) : (
          <PrintDokumentasiView 
            trip={selectedTrip} 
            onBack={() => setActiveTab(0)} 
            userProfile={userProfile} 
          />
        )
      )}

      {/* Main App Layout (Tabs 0, 1, 2) */}
      {activeTab !== 3 && (
        <>
          {/* Header Banner */}
          <div className={styles.pageHeader}>
            <div className={styles.headerTitleArea}>
              <div className={styles.headerIconWrap}>
                <MapPin size={26} />
              </div>
              <div>
                <h1 className={styles.pageTitle}>Dinas Lapangan & Perjalanan Dinas</h1>
                <p className={styles.pageSubtitle}>
                  Manajemen Surat Tugas, sinkronisasi jadwal & CKP, penyusunan laporan kegiatan, dan cetak dokumentasi SPJ BPS.
                </p>
              </div>
            </div>

            <button 
              className={styles.primaryBtn} 
              onClick={() => {
                setSelectedTrip(null);
                setFormST({
                  nomorSuratTugas: '',
                  tanggalSuratTugas: getLocalDateStr(),
                  pejabatPemberiTugas: userProfile?.satker ? `Kepala ${userProfile.satker}` : 'Kepala BPS Kabupaten Penajam Paser Utara',
                  namaPejabat: 'Ir. Muhammad Arsyad, M.Si',
                  nipPejabat: '197505122000031001',
                  jabatanPejabat: 'Kepala BPS Kab. Penajam Paser Utara',
                  maksudTujuan: '',
                  skpId: '',
                  daerahTujuan: '',
                  lokasiSpesifik: '',
                  tanggalMulai: getLocalDateStr(),
                  tanggalSelesai: getLocalDateStr(),
                  lamaHari: 1,
                  kendaraan: 'Kendaraan Operasional / Dinas',
                  bebanAnggaran: 'DIPA BPS Kabupaten Penajam Paser Utara TA 2026',
                  status: 'rencana',
                  pelaksana: [
                    {
                      nama: userProfile?.displayName || 'Pegawai Pelaksana',
                      nip: userProfile?.nip || '-',
                      jabatan: userProfile?.jabatan || 'Pegawai BPS',
                      pangkatGol: userProfile?.pangkatGol || 'Penata Muda (III/a)',
                      peran: 'Utama'
                    }
                  ]
                });
                setExistingStFiles([]);
                setStFiles([]);
                setActiveTab(1);
              }}
            >
              <Plus size={16} /> Tambah Perjalanan Dinas
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Car size={20} />
              </div>
              <div>
                <div className={styles.kpiValue}>{kpis.total}</div>
                <div className={styles.kpiLabel}>Total Perjalanan Dinas</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Clock size={20} />
              </div>
              <div>
                <div className={styles.kpiValue}>{kpis.active}</div>
                <div className={styles.kpiLabel}>Sedang Berjalan</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className={styles.kpiValue}>{kpis.completed}</div>
                <div className={styles.kpiLabel}>Telah Selesai</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconBox} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                <FileText size={20} />
              </div>
              <div>
                <div className={styles.kpiValue}>{kpis.needsReport}</div>
                <div className={styles.kpiLabel}>Menunggu Laporan</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className={styles.tabNav}>
            <button 
              className={`${styles.tabBtn} ${activeTab === 0 ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(0)}
            >
              <ClipboardList size={16} /> Daftar & Agenda Perjalanan Dinas
            </button>
            <button 
              className={`${styles.tabBtn} ${activeTab === 1 ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(1)}
            >
              <FileCheck size={16} /> {selectedTrip ? 'Edit Surat Tugas' : 'Form Surat Tugas (ST)'}
            </button>
            {selectedTrip && (
              <button 
                className={`${styles.tabBtn} ${activeTab === 2 ? styles.tabBtnActive : ''}`}
                onClick={() => handleOpenReportEditor(selectedTrip)}
              >
                <FileText size={16} /> Laporan & Dokumentasi ({selectedTrip.nomorSuratTugas || 'DL'})
              </button>
            )}
          </div>

          {/* TAB 0: DAFTAR & AGENDA */}
          {activeTab === 0 && (
            <>
              {/* Toolbar */}
              <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                  <Search size={16} color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="Cari nomor ST, kegiatan, atau tujuan..."
                    className={styles.searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className={styles.filterPills}>
                  <button 
                    className={`${styles.filterPill} ${filterStatus === 'all' ? styles.filterPillActive : ''}`}
                    onClick={() => setFilterStatus('all')}
                  >
                    Semua
                  </button>
                  <button 
                    className={`${styles.filterPill} ${filterStatus === 'rencana' ? styles.filterPillActive : ''}`}
                    onClick={() => setFilterStatus('rencana')}
                  >
                    Rencana
                  </button>
                  <button 
                    className={`${styles.filterPill} ${filterStatus === 'berjalan' ? styles.filterPillActive : ''}`}
                    onClick={() => setFilterStatus('berjalan')}
                  >
                    Sedang Berjalan
                  </button>
                  <button 
                    className={`${styles.filterPill} ${filterStatus === 'selesai' ? styles.filterPillActive : ''}`}
                    onClick={() => setFilterStatus('selesai')}
                  >
                    Selesai
                  </button>
                </div>
              </div>

              {/* Trip Cards Grid */}
              {filteredTrips.length === 0 ? (
                <div className={styles.formCard} style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Car size={42} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ margin: '0 0 6px 0', color: '#f8fafc' }}>Belum Ada Perjalanan Dinas</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>
                    Mulai dengan menambahkan Surat Tugas perjalanan dinas pertama Anda.
                  </p>
                  <button className={styles.primaryBtn} onClick={() => setActiveTab(1)} style={{ margin: '0 auto' }}>
                    <Plus size={16} /> Buat Surat Tugas Baru
                  </button>
                </div>
              ) : (
                <div className={styles.tripGrid}>
                  {filteredTrips.map(trip => (
                    <div key={trip.id} className={styles.tripCard}>
                      <div className={styles.tripCardHeader}>
                        <span className={styles.tripNumberBadge}>{trip.nomorSuratTugas || 'ST/BPS'}</span>
                        <span className={`${styles.statusBadge} ${
                          trip.status === 'selesai' 
                            ? styles.statusSelesai 
                            : trip.status === 'berjalan' 
                              ? styles.statusBerjalan 
                              : styles.statusRencana
                        }`}>
                          {trip.status === 'selesai' ? 'Selesai' : trip.status === 'berjalan' ? 'Sedang Berjalan' : 'Rencana'}
                        </span>
                      </div>

                      <h3 className={styles.tripMaksud}>{trip.maksudTujuan}</h3>

                      <div className={styles.tripMetaList}>
                        <div className={styles.tripMetaItem}>
                          <Calendar size={14} color="#38bdf8" />
                          <span>
                            {formatDateIndo(trip.tanggalMulai)}
                            {trip.tanggalMulai !== trip.tanggalSelesai ? ` s.d. ${formatDateIndo(trip.tanggalSelesai)}` : ''}
                            {' '}({trip.lamaHari || 1} hari)
                          </span>
                        </div>

                        <div className={styles.tripMetaItem}>
                          <MapPin size={14} color="#f472b6" />
                          <span><strong>{trip.daerahTujuan}</strong> {trip.lokasiSpesifik ? `(${trip.lokasiSpesifik})` : ''}</span>
                        </div>

                        <div className={styles.tripMetaItem}>
                          <Users size={14} color="#a78bfa" />
                          <span>Pelaksana: {trip.pelaksana && trip.pelaksana.length > 0 ? trip.pelaksana.map(p => p.nama).join(', ') : 'Pegawai'}</span>
                        </div>

                        {trip.suratTugasFiles && trip.suratTugasFiles.length > 0 && (
                          <div className={styles.tripMetaItem}>
                            <FileCheck size={14} color="#34d399" />
                            <span>Scan ST Tersimpan ({trip.suratTugasFiles.length} berkas)</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className={styles.tripActionsBar}>
                        <div className={styles.actionBtnGroup}>
                          <button 
                            className={styles.secondaryBtn}
                            onClick={() => handleOpenReportEditor(trip)}
                            title="Tulis Laporan & Dokumentasi"
                          >
                            <Edit3 size={13} /> Laporan
                          </button>

                          <button 
                            className={styles.secondaryBtn}
                            onClick={() => handleOpenPrint(trip, 'laporan')}
                            title="Cetak Laporan Resmi A4"
                          >
                            <Printer size={13} /> Cetak Lap.
                          </button>

                          <button 
                            className={styles.secondaryBtn}
                            onClick={() => handleOpenPrint(trip, 'dokumentasi')}
                            title="Cetak Lembar Dokumentasi Foto"
                          >
                            <ImageIcon size={13} /> Foto
                          </button>
                        </div>

                        <div className={styles.actionBtnGroup}>
                          <button 
                            className={styles.iconBtn}
                            onClick={() => handleOpenEditTrip(trip)}
                            title="Edit Data ST"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            className={styles.iconBtn}
                            onClick={() => handleDeleteTrip(trip.id)}
                            title="Hapus"
                            style={{ color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 1: FORM INPUT / EDIT SURAT TUGAS */}
          {activeTab === 1 && (
            <div className={styles.formCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
                  {selectedTrip ? 'Perbarui Surat Tugas Perjalanan Dinas' : 'Input Surat Tugas Perjalanan Dinas Baru'}
                </h2>
                <button className={styles.secondaryBtn} onClick={() => setActiveTab(0)}>
                  <ArrowLeft size={14} /> Batal & Kembali
                </button>
              </div>

              <form onSubmit={handleSaveTrip}>
                {/* 1. Administrasi Surat Tugas */}
                <div className={styles.formSectionTitle}>
                  <FileText size={16} /> 1. Informasi Administrasi Surat Tugas
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nomor Surat Tugas *</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="Contoh: B-412/64090/VS.100/10/2026"
                      value={formST.nomorSuratTugas}
                      onChange={(e) => setFormST(prev => ({ ...prev, nomorSuratTugas: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Surat Tugas *</label>
                    <input 
                      type="date" 
                      className={styles.formInput} 
                      value={formST.tanggalSuratTugas}
                      onChange={(e) => setFormST(prev => ({ ...prev, tanggalSuratTugas: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Pejabat Pemberi Tugas</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      value={formST.pejabatPemberiTugas}
                      onChange={(e) => setFormST(prev => ({ ...prev, pejabatPemberiTugas: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nama & Gelar Pejabat</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      value={formST.namaPejabat}
                      onChange={(e) => setFormST(prev => ({ ...prev, namaPejabat: e.target.value }))}
                      placeholder="Nama Kepala BPS / PPK"
                    />
                  </div>
                </div>

                {/* 2. Maksud & Wilayah Penugasan */}
                <div className={styles.formSectionTitle}>
                  <MapPin size={16} /> 2. Maksud, Lokasi, dan Waktu Penugasan
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Maksud & Tujuan Perjalanan Dinas *</label>
                  <textarea 
                    rows={2}
                    className={styles.formTextarea} 
                    placeholder="Contoh: Pengawasan dan pemeriksaan lapangan pencacahan Survei Biaya Hidup (SBH) 2026"
                    value={formST.maksudTujuan}
                    onChange={(e) => setFormST(prev => ({ ...prev, maksudTujuan: e.target.value }))}
                    required
                  />
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Daerah / Wilayah Tujuan *</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="Contoh: Kecamatan Penajam & Sepaku"
                      value={formST.daerahTujuan}
                      onChange={(e) => setFormST(prev => ({ ...prev, daerahTujuan: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Lokasi / Desa / SLS Spesifik</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="Contoh: Kel. Nipah-Nipah & Desa Bumi Harapan"
                      value={formST.lokasiSpesifik}
                      onChange={(e) => setFormST(prev => ({ ...prev, lokasiSpesifik: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Mulai *</label>
                    <input 
                      type="date" 
                      className={styles.formInput} 
                      value={formST.tanggalMulai}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Selesai *</label>
                    <input 
                      type="date" 
                      className={styles.formInput} 
                      value={formST.tanggalSelesai}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Moda Transportasi</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      value={formST.kendaraan}
                      onChange={(e) => setFormST(prev => ({ ...prev, kendaraan: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Beban Anggaran</label>
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      value={formST.bebanAnggaran}
                      onChange={(e) => setFormST(prev => ({ ...prev, bebanAnggaran: e.target.value }))}
                    />
                  </div>
                </div>

                {/* 3. Petugas Pelaksana */}
                <div className={styles.formSectionTitle}>
                  <Users size={16} /> 3. Petugas Pelaksana ({formST.pelaksana.length} Orang)
                </div>

                {formST.pelaksana.map((p, idx) => (
                  <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' }}>Petugas #{idx + 1} ({p.peran})</span>
                      {formST.pelaksana.length > 1 && (
                        <button type="button" onClick={() => handleRemovePelaksana(idx)} style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                          Hapus
                        </button>
                      )}
                    </div>
                    <div className={styles.formGrid2}>
                      <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="Nama Lengkap & Gelar"
                        value={p.nama}
                        onChange={(e) => handleUpdatePelaksana(idx, 'nama', e.target.value)}
                      />
                      <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="NIP Pegawai"
                        value={p.nip}
                        onChange={(e) => handleUpdatePelaksana(idx, 'nip', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGrid2} style={{ marginTop: '8px' }}>
                      <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="Jabatan (misal: Statistisi Ahli Pertama)"
                        value={p.jabatan}
                        onChange={(e) => handleUpdatePelaksana(idx, 'jabatan', e.target.value)}
                      />
                      <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="Pangkat / Golongan (misal: Penata Muda / III.a)"
                        value={p.pangkatGol}
                        onChange={(e) => handleUpdatePelaksana(idx, 'pangkatGol', e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                <button type="button" className={styles.secondaryBtn} onClick={handleAddPelaksana} style={{ marginBottom: '16px' }}>
                  <Plus size={14} /> Tambah Petugas Pendamping
                </button>

                {/* 4. Upload Scan Surat Tugas */}
                <div className={styles.formSectionTitle}>
                  <UploadCloud size={16} /> 4. Unggah Scan Surat Tugas (PDF / Gambar)
                </div>

                <div 
                  className={styles.dropzone}
                  onClick={() => document.getElementById('stFileInput').click()}
                >
                  <UploadCloud size={32} color="#38bdf8" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#f8fafc' }}>
                    Klik atau Seret Berkas Scan Surat Tugas / SPD ke sini
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                    Mendukung PDF, JPG, PNG (Otomatis diunggah ke Google Drive & tersinkron offline)
                  </p>
                  <input 
                    id="stFileInput"
                    type="file" 
                    multiple 
                    accept=".pdf,image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) {
                        setStFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                </div>

                {/* File list preview */}
                {(stFiles.length > 0 || existingStFiles.length > 0) && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {existingStFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56, 189, 248, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}>
                        <span style={{ color: '#38bdf8' }}>📄 {f.name} (Tersimpan di Cloud)</span>
                        <a href={f.url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', fontSize: '11px', textDecoration: 'underline' }}>
                          Buka ↗
                        </a>
                      </div>
                    ))}
                    {stFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}>
                        <span style={{ color: '#34d399' }}>⏳ {f.name} (Akan diunggah saat simpan)</span>
                        <button type="button" onClick={() => setStFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          Batal
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setActiveTab(0)}>
                    Batal
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={isUploadingST}>
                    {isUploadingST ? 'Menyimpan & Mengunggah...' : 'Simpan Surat Tugas'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: FORM PENYUSUNAN LAPORAN HASIL KEGIATAN & DOKUMENTASI */}
          {activeTab === 2 && selectedTrip && (
            <div className={styles.formCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
                    Laporan Perjalanan Dinas: {selectedTrip.nomorSuratTugas}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    {selectedTrip.daerahTujuan} — Format Standar BPS (Tabel Waktu & Dokumentasi)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={styles.secondaryBtn} onClick={() => handleOpenPrint(selectedTrip, 'laporan')}>
                    <Printer size={14} /> Pratinjau & Cetak
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => setActiveTab(0)}>
                    <ArrowLeft size={14} /> Kembali
                  </button>
                </div>
              </div>

              {/* Quick Action Bar: 1-Click Template & CKP Pull */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={22} color="#38bdf8" />
                  <div>
                    <strong style={{ fontSize: '13px', color: '#38bdf8' }}>Otomasi Penyusunan Laporan BPS</strong>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                      Gunakan template standar perjalanan dinas atau tarik data dari CKP Harian secara instan.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className={styles.secondaryBtn} 
                    onClick={handleApplyBPSTemplate}
                    style={{ fontSize: '12px', padding: '6px 12px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                    title="Muat alur perjalanan standar: BBM SPBU, Berangkat Nipah-nipah, Sesi Pagi, Istirahat, Sesi Siang, dan Pulang"
                  >
                    ⚡ Template Standar BPS
                  </button>
                  <button 
                    type="button" 
                    className={styles.primaryBtn} 
                    onClick={handlePullFromCKP}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    title="Tarik kegiatan CKP harian pada tanggal ini menjadi slot waktu"
                  >
                    ✨ Tarik Kegiatan CKP
                  </button>
                </div>
              </div>

              {/* 1. Header Metadata Laporan (Sesuai Tabel Word) */}
              <div className={styles.formSectionTitle}>
                <FileText size={16} /> 1. Informasi Header Laporan (Format Word BPS)
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tujuan (Wilayah / Desa) *</label>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    value={formLaporan.tujuan}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, tujuan: e.target.value }))}
                    placeholder="Contoh: Bukit Raya / Giri Mukti / Pemaluan"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nama Pelaksana & Gelar *</label>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    value={formLaporan.namaPetugas}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, namaPetugas: e.target.value }))}
                    placeholder="Contoh: Yahya Abdurrohman, S.Tr.Stat."
                  />
                </div>
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tanggal Tugas *</label>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    value={formLaporan.tanggalTugas}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, tanggalTugas: e.target.value }))}
                    placeholder="Contoh: 07 September 2026 atau rentang tanggal"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Perihal Tugas *</label>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    value={formLaporan.perihal}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, perihal: e.target.value }))}
                    placeholder="Contoh: Melaksanakan Pengawasan Sensus Ekonomi Tahun 2026 (SE2026) di Bukit Raya"
                  />
                </div>
              </div>

              {/* 2. Jadwal & Rincian Kegiatan Lapangan (Timeline Slots) */}
              <div className={styles.formSectionTitle} style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} /> 2. Laporan Kegiatan (Kronologis Waktu)
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>
                  {formLaporan.jadwalKegiatan?.length || 0} Slot Waktu
                </span>
              </div>

              <div className={styles.timelineEditorBox}>
                {(formLaporan.jadwalKegiatan && formLaporan.jadwalKegiatan.length > 0) ? (
                  formLaporan.jadwalKegiatan.map((slot, sIdx) => (
                    <div key={sIdx} className={styles.timelineSlotCard}>
                      <div className={styles.timelineSlotHeader}>
                        <div className={styles.timelineSlotTime}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8' }}>#{sIdx + 1}</span>
                          <input 
                            type="text" 
                            className={styles.timelineSlotInput}
                            value={slot.waktu}
                            onChange={(e) => handleUpdateTimelineSlot(sIdx, 'waktu', e.target.value)}
                            placeholder="07.00 – 09.00"
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>WITA</span>
                        </div>

                        <button 
                          type="button" 
                          onClick={() => handleRemoveTimelineSlot(sIdx)}
                          style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      </div>

                      <textarea 
                        rows={3}
                        className={styles.formTextarea}
                        value={slot.uraian}
                        onChange={(e) => handleUpdateTimelineSlot(sIdx, 'uraian', e.target.value)}
                        placeholder="Uraian kegiatan pada rentang waktu ini (bisa poin a, b, c...)"
                      />
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8' }}>
                      Belum ada slot waktu kegiatan yang dibuat.
                    </p>
                    <button 
                      type="button" 
                      className={styles.primaryBtn} 
                      onClick={handleApplyBPSTemplate}
                      style={{ margin: '0 auto', fontSize: '12px' }}
                    >
                      ⚡ Gunakan Template Standar BPS Lapangan
                    </button>
                  </div>
                )}

                <button 
                  type="button" 
                  className={styles.secondaryBtn} 
                  onClick={handleAddTimelineSlot}
                  style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                >
                  <Plus size={14} /> Tambah Slot Waktu Baru
                </button>
              </div>

              {/* 3. Permasalahan & Tindak Lanjut (Opsional) */}
              <div className={styles.formGrid2} style={{ marginTop: '20px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Permasalahan / Kendala di Lapangan (Opsional)</label>
                  <textarea 
                    rows={3}
                    className={styles.formTextarea}
                    placeholder="Contoh: Responden sulit ditemui di pagi hari, akses jalan licin..."
                    value={formLaporan.kendalaMasalah}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, kendalaMasalah: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Saran & Tindak Lanjut (Opsional)</label>
                  <textarea 
                    rows={3}
                    className={styles.formTextarea}
                    placeholder="Contoh: Kunjungan ulang dijadwalkan kembali, koordinasi dengan aparat desa..."
                    value={formLaporan.solusiTindakLanjut}
                    onChange={(e) => setFormLaporan(prev => ({ ...prev, solusiTindakLanjut: e.target.value }))}
                  />
                </div>
              </div>

              {/* Dokumentasi Foto Section */}
              <div className={styles.formSectionTitle} style={{ marginTop: '24px' }}>
                <ImageIcon size={16} /> Dokumentasi Foto Lapangan ({formLaporan.dokumentasi.length} Foto)
              </div>

              {/* Add Photo Inputs */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#cbd5e1', marginBottom: '8px' }}>
                  Tambah Foto Dokumentasi:
                </div>
                <div className={styles.formGrid2}>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    placeholder="Tautan Gambar (URL Google Drive / Web / Cloud)..."
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                  />
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    placeholder="Keterangan Kegiatan (Caption)"
                    value={newPhotoCaption}
                    onChange={(e) => setNewPhotoCaption(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    placeholder="Lokasi / Wilayah Kegiatan (opsional)"
                    value={newPhotoLokasi}
                    onChange={(e) => setNewPhotoLokasi(e.target.value)}
                    style={{ flexGrow: 1 }}
                  />
                  <button type="button" className={styles.secondaryBtn} onClick={handleAddPhoto}>
                    <Plus size={14} /> Tambahkan Foto
                  </button>
                </div>
              </div>

              {/* Photo Thumbnails List */}
              {formLaporan.dokumentasi.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {formLaporan.dokumentasi.map((photo, pIdx) => (
                    <div key={photo.id || pIdx} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                      <img src={photo.url} alt={photo.caption} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                      <div style={{ padding: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                        <strong>#{pIdx + 1}:</strong> {photo.caption}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemovePhoto(photo.id)}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '4px', color: '#fff', padding: '3px 6px', cursor: 'pointer', fontSize: '10px' }}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setActiveTab(0)}>
                  Batal
                </button>
                <button type="button" className={styles.primaryBtn} onClick={handleSaveReport}>
                  <Check size={16} /> Simpan Laporan & Selesaikan Tugas
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
