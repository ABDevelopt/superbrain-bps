// Data Awal Tugas (Tasks) dengan Peran BPS dan Subtask Checklist

export const BPS_ROLES = [
  { id: 'admin', name: 'Admin', iconName: 'Briefcase', color: '#38bdf8' },
  { id: 'manajer_kelas', name: 'Manajer Kelas', iconName: 'GraduationCap', color: '#a78bfa' },
  { id: 'panitia', name: 'Panitia Acara', iconName: 'Award', color: '#f472b6' },
  { id: 'pemeriksa', name: 'Pemeriksa / Pengawas', iconName: 'Search', color: '#fb923c' },
  { id: 'petugas_lapangan', name: 'Petugas Lapangan', iconName: 'MapPin', color: '#4ade80' },
];

export const ROLE_TEMPLATES = {
  admin: [
    { text: 'Menerima dan memeriksa kelengkapan berkas fisik', completed: false },
    { text: 'Menginput data ke aplikasi internal BPS', completed: false },
    { text: 'Mengarsipkan berkas ke lemari arsip / folder cloud', completed: false },
    { text: 'Membuat laporan rekapan bulanan', completed: false }
  ],
  manajer_kelas: [
    { text: 'Membuat WhatsApp group koordinasi peserta', completed: false },
    { text: 'Konfirmasi kehadiran pengajar/instruktur daerah', completed: false },
    { text: 'Menyiapkan tautan Zoom / ruang kelas fisik', completed: false },
    { text: 'Membagikan materi ajar dan link presensi', completed: false },
    { text: 'Merekap absensi harian dan nilai tugas', completed: false }
  ],
  panitia: [
    { text: 'Memesan konsumsi dan sewa ruangan', completed: false },
    { text: 'Mencetak name tag, kartu petugas, dan surat tugas', completed: false },
    { text: 'Menyusun daftar hadir fisik peserta rapat/kegiatan', completed: false },
    { text: 'Mengatur dokumentasi acara dan membuat backlink arsip', completed: false }
  ],
  pemeriksa: [
    { text: 'Menerima bundle kuesioner dari petugas lapangan', completed: false },
    { text: 'Memeriksa konsistensi isian blok demi blok', completed: false },
    { text: 'Melakukan coding kode wilayah dan komoditas', completed: false },
    { text: 'Menandai bagian error/anomali untuk dikonfirmasi', completed: false }
  ],
  petugas_lapangan: [
    { text: 'Koordinasi dengan Ketua RT / Kepala Desa setempat', completed: false },
    { text: 'Melakukan kunjungan ke rumah responden / lokasi target', completed: false },
    { text: 'Wawancara langsung menggunakan CAPI (gadget) atau kuesioner kertas', completed: false },
    { text: 'Meminta tanda tangan responden dan tagging koordinat GPS', completed: false }
  ]
};

export const initialTasks = [
  {
    id: 'task-1',
    judul: 'Input inventaris laptop dinas baru',
    deskripsi: 'Mencatat nomor seri dan spesifikasi 5 laptop dinas baru di aplikasi BMN BPS.',
    status: 'todo', // 'todo', 'in_progress', 'done'
    peran: 'admin',
    skpId: 18, // Terlaksananya Administrasi BMN sesuai SOP
    tanggalDibuat: '2026-05-28',
    checklist: [
      { text: 'Unboxing laptop dan cek kelengkapan fisik', completed: true },
      { text: 'Catat nomor seri laptop', completed: false },
      { text: 'Upload foto bukti terima ke aplikasi BMN', completed: false }
    ]
  },
  {
    id: 'task-2',
    judul: 'Persiapan Kelas Pelatihan Susenas 2026',
    deskripsi: 'Mengkoordinasikan calon petugas pencacah di kelas Kabupaten PPU.',
    status: 'in_progress',
    peran: 'manajer_kelas',
    skpId: 16, // Pelatihan petugas Susenas
    tanggalDibuat: '2026-05-28',
    checklist: [
      { text: 'Membuat WhatsApp group koordinasi peserta', completed: true },
      { text: 'Konfirmasi kehadiran pengajar/instruktur daerah', completed: true },
      { text: 'Menyiapkan tautan Zoom / ruang kelas fisik', completed: false },
      { text: 'Membagikan materi ajar dan link presensi', completed: false }
    ]
  },
  {
    id: 'task-3',
    judul: 'Cetak Surat Tugas & Kartu PLN',
    deskripsi: 'Mencetak dokumen resmi untuk kegiatan Ground Check PLN mitra statistik.',
    status: 'todo',
    peran: 'panitia',
    skpId: 28, // Pencetakan Surat Pemberitahuan Ground Check PLN
    tanggalDibuat: '2026-05-29',
    checklist: [
      { text: 'Desain format kartu petugas', completed: false },
      { text: 'Cetak surat tugas tanda tangan KPA', completed: false },
      { text: 'Bagikan kartu ke petugas lapangan', completed: false }
    ]
  },
  {
    id: 'task-4',
    judul: 'Ground Check Penerima PBI Desa Girimukti',
    deskripsi: 'Melakukan kunjungan lapangan untuk verifikasi PBI Jaminan Kesehatan.',
    status: 'in_progress',
    peran: 'petugas_lapangan',
    skpId: 23, // Pelatihan Ground Check Data PBI
    tanggalDibuat: '2026-05-27',
    checklist: [
      { text: 'Koordinasi dengan Ketua RT / Kepala Desa setempat', completed: true },
      { text: 'Melakukan kunjungan ke rumah responden / lokasi target', completed: false },
      { text: 'Wawancara langsung menggunakan CAPI (gadget)', completed: false }
    ]
  },
  {
    id: 'task-5',
    judul: 'Coding Kuesioner Sakernas PPU',
    deskripsi: 'Melakukan pemeriksaan anomali dan coding isian Sakernas.',
    status: 'done',
    peran: 'pemeriksa',
    skpId: 14, // Pemeriksaan, Editing, dan Validasi SAKERNAS
    tanggalDibuat: '2026-05-26',
    checklist: [
      { text: 'Menerima bundle kuesioner dari petugas lapangan', completed: true },
      { text: 'Memeriksa konsistensi isian blok demi blok', completed: true },
      { text: 'Melakukan coding kode wilayah dan komoditas', completed: true }
    ]
  }
];
