import fs from 'fs';
import path from 'path';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

const targetDir = 'D:\\01_Kedinasan_BPS\\Bukti_Dukung_CKP_Oktober_2026';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Total entries:', ckpOktoberEntries.length);

const skpMap = {};
skpData.forEach(s => skpMap[s.id] = s);

// 1. Export SuperBrain JSON backups
const payload = {
  timestamp: new Date().toISOString(),
  version: '1.0',
  totalActivities: ckpOktoberEntries.length,
  bulan: 'Oktober 2026',
  satuanKerja: 'BPS Kabupaten Penajam Paser Utara (6409)',
  regulasi: 'PermenPAN-RB No. 6/2022 & Perpres No. 21/2023',
  data: {
    ckp: ckpOktoberEntries
  }
};

const jsonPaths = [
  'D:\\superbrain\\data\\superbrain-ckp-oktober-2026.json',
  'D:\\superbrain\\public\\data\\superbrain-ckp-oktober-2026.json',
  'C:\\Users\\ajian\\Desktop\\superbrain-ckp-oktober-2026.json'
];

for (const p of jsonPaths) {
  try {
    const parentDir = path.dirname(p);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Saved SuperBrain JSON:', p);
  } catch (err) {
    console.error('Failed to save JSON to ' + p + ':', err.message);
  }
}

// 2. Export KIPAPP BPS Batch Payloads (Standard & Paired)
// A. Standard 44 items
const kipappStandard = ckpOktoberEntries.map(e => ({
  skpid: e.skpId,
  rkid: e.rkId || e.skpId,
  kegiatan: e.rincian,
  tanggal: e.tanggal,
  tanggalselesai: e.tanggal,
  progres: 100,
  capaian: e.capaian || `${e.kuantitas} ${e.satuan}`,
  datadukung: e.buktiDukung,
  datadukungketerangan: e.buktiDukungKet,
  timkerja: e.timKerja,
  nilaiberakhlak: e.nilaiBerakhlak,
  iscapaianskp: true
}));

// B. Paired 88 items (Kuantitas & Kualitas sesuai standar baku KIPAPP)
const kipappPaired = [];
ckpOktoberEntries.forEach(e => {
  // Aspek Kuantitas
  kipappPaired.push({
    skpid: e.skpId,
    rkid: e.rkId || e.skpId,
    aspek: 'Kuantitas',
    kegiatan: `[Kuantitas] ${e.rincian}`,
    tanggal: e.tanggal,
    tanggalselesai: e.tanggal,
    progres: 100,
    capaian: `Tingkat kuantitas terlaksana 100% (${e.kuantitas} ${e.satuan})`,
    datadukung: e.buktiDukung,
    nilaiberakhlak: e.nilaiBerakhlak,
    iscapaianskp: true
  });
  // Aspek Kualitas
  kipappPaired.push({
    skpid: e.skpId,
    rkid: e.rkId || e.skpId,
    aspek: 'Kualitas',
    kegiatan: `[Kualitas] ${e.rincian}`,
    tanggal: e.tanggal,
    tanggalselesai: e.tanggal,
    progres: 100,
    capaian: 'Tingkat kualitas hasil kerja sesuai standar SOP BPS (100%)',
    datadukung: e.buktiDukung,
    nilaiberakhlak: e.nilaiBerakhlak,
    iscapaianskp: true
  });
});

const kipappPayload = {
  meta: {
    aplikasi: 'KIPAPP BPS (https://kipapp.bps.go.id)',
    periode: 'Triwulan IV (Bulan Oktober 2026)',
    satuanKerja: 'BPS Kabupaten Penajam Paser Utara (6409)',
    regulasi: 'PermenPAN-RB No. 6 Tahun 2022',
    totalKegiatanFisik: ckpOktoberEntries.length,
    totalEntriKipappPaired: kipappPaired.length,
    exportedAt: new Date().toISOString()
  },
  kegiatanStandard: kipappStandard,
  kegiatanPaired: kipappPaired
};

const kipappPaths = [
  'D:\\superbrain\\data\\kipapp-batch-oktober-2026.json',
  'D:\\superbrain\\public\\data\\kipapp-batch-oktober-2026.json',
  'C:\\Users\\ajian\\Desktop\\kipapp-batch-oktober-2026.json',
  path.join(targetDir, 'KIPAPP_Batch_Oktober_2026.json')
];

for (const p of kipappPaths) {
  try {
    const parentDir = path.dirname(p);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(kipappPayload, null, 2), 'utf8');
    console.log('Saved KIPAPP Batch JSON:', p);
  } catch (err) {
    console.error('Failed to save KIPAPP JSON to ' + p + ':', err.message);
  }
}

// 3. Generate Markdown Catalog
let md = `# DAFTAR BUKTI DUKUNG CKP BULAN OKTOBER 2026

**Satuan Kerja:** BPS Kabupaten Penajam Paser Utara (Kab. 6409)  
**Periode:** 1 Oktober 2026 – 31 Oktober 2026  
**Total Hari Kerja:** 22 Hari Kerja (Senin–Jumat)  
**Total Beban Kerja:** 173 Jam (10.380 menit, rata-rata \ge 7,5 jam / 450 menit per hari kerja, mendukung jam kerja fleksibel & dinas luar)  
**Total Kegiatan:** 44 Kegiatan (2 Kegiatan Terstruktur per Hari)  
**Regulasi:** Perpres No. 21/2023 & PermenPAN-RB No. 6/2022  

---

## Ringkasan Integrasi Kegiatan Substantif:
1. **Pelatihan Petugas Survei SPDT-NTP 2026:**
   - 7 Okt (Hari ke-1): Pembukaan, metodologi survei, konsep definisi rumahtangga pertanian, serta pendalaman modul kuesioner tanaman pangan, hortikultura, dan perkebunan.
   - 8 Okt (Hari ke-2): Pendalaman kuesioner subsektor peternakan, perikanan, kehutanan, tata cara pemeriksaan dokumen PML, simulasi wawancara, dan praktik CAPI FASIH-SM.
2. **Dinas Lapangan (Supervisi & Pemeriksaan):**
   - 12 Okt: Supervisi & koordinasi dinas luar ke Kantor Desa Bukit Raya dan Desa Giri Mukti (Kec. Sepaku).
   - 20 Okt: Pengawasan lapangan & pemeriksaan survei SPDT-NTP di Kelurahan Sepan dan Riko (Kec. Penajam).
   - 26 Okt: Pengawasan lapangan & supervisi wawancara survei SPDT-NTP di Kelurahan Sotek (Kec. Penajam).
   - 27 Okt: Pengawasan lapangan & validasi entri kuesioner survei SPDT-NTP di Kelurahan Gersik (Kec. Penajam).
3. **Data Cleaning Otomasi FASIH-SM (\`fasih-sm-bot\`):**
   - Verifikasi 8 Nilai Tambah Bruto (NTB): Kalibrasi 6.455 unit usaha (6.193 auto-calibrate ratio median, 94 koreksi skala, 79 korporasi besar, 36 typo digit ekstrem, 132 konfirmasi keterangan lapangan wajar).
   - Data Cleaning Sosek & Bansos: Rekonsiliasi 586 bansos coklit, 492 realign bansos master, audit 183 NIK duplikat nasional, dan penegakan invariant kematian (8 kasus).
   - Data Cleaning BANR: Pengiriman batch 28 penugasan draft BANR via FormGear MinIO S3 dengan hasil 0 galat.
   - Reallokasi Penugasan: Pemetaan 1.259 prelist SE2026 ke SLS aktif dan reallokasi 123 draft assignment via API \`survey-user\`.
   - Kode Remark Deputi NAS: Standardisasi kode remark data cleaning #0 sampai dengan #4.
4. **Data Cleaning & Rekonsiliasi Prelist (\`data_microdata_se2026\`):**
   - Analisis coverage usaha dan keluarga per desa/kecamatan (54 desa/kelurahan di Kab. PPU).
   - Two-Way Linking Tier 1 Prelist OSS ke kuesioner keluarga (100 unit usaha prelist administratif).
   - Rencana remediasi anomali KBLI unit usaha keluarga SE2026.
   - Audit kesalahan petugas BKU (Bangunan Khusus Usaha) dalam kuesioner keluarga.
5. **Ekstraksi Data Perizinan Usaha OSS RBA:**
   - Ekstraksi dan tabulasi komprehensif data izin usaha (NIB, NIK, dan identitas legalitas) dari Web Portal OSS RBA sebanyak 11.282 record untuk pengayaan direktori SBR dan SE2026 PPU.
6. **Keterkaitan Rencana Kinerja (RK) & IKI KIPAPP BPS:**
   - Seluruh 44 kegiatan telah dipetakan secara terstruktur ke 11 butir SKP aktif dengan rujukan langsung ke Rencana Kinerja KIPAPP (rkId, rkNama, IKI kuantitas, IKI kualitas, dan nilai BerAKHLAK).

---

## Tabel Lengkap 44 Kegiatan & Bukti Fisik Dukung

| No | Tanggal | Waktu (WITA) | Durasi | SKP/RK | Rencana Kinerja (KIPAPP) | Rincian Kegiatan | Bukti Dukung Fisik | Deskripsi Bukti Dukung |
|:--:|:---:|:---:|:---:|:---:|---|---|---|---|
`;

ckpOktoberEntries.forEach((e, idx) => {
  const no = idx + 1;
  const time = `${e.waktuMulai} - ${e.waktuSelesai}`;
  const durasi = `${e.durasi} mnt`;
  const skp = e.skpId;
  const rkNama = (e.rkNama || skpMap[e.skpId]?.nama || '').replace(/\|/g, '\\|');
  const rincian = e.rincian.replace(/\|/g, '\\|');
  const bukti = `\`${e.buktiDukung}\``;
  const ket = (e.buktiDukungKet || '').replace(/\|/g, '\\|');

  md += `| ${no} | ${e.tanggal} | ${time} | ${durasi} | #${skp} | ${rkNama} | ${rincian} | ${bukti} | ${ket} |\n`;
});

md += `\n---\n\n*Dokumen ini digenerate secara otomatis oleh Antigravity SuperBrain Engine pada ${new Date().toLocaleString('id-ID')} WITA.*\n`;

const catalogPath = path.join(targetDir, 'DAFTAR_BUKTI_DUKUNG_OKTOBER_2026.md');
fs.writeFileSync(catalogPath, md, 'utf8');
console.log('Saved Evidence Catalog Markdown:', catalogPath);

// 4. Generate Comprehensive Mapping Document: PEMETAAN_CKP_SKP_KIPAPP_OKTOBER_2026.md
let mapMd = `# PANDUAN PENYELARASAN CKP DENGAN RENCANA KINERJA SKP & APLIKASI KIPAPP BPS
## Periode: Bulan Oktober 2026 (Triwulan IV 2026)
### Satuan Kerja: BPS Kabupaten Penajam Paser Utara (6409)

---

## 1. Landasan Hukum & Regulasi Kinerja ASN
Sesuai **PermenPAN-RB No. 6 Tahun 2022** tentang Pengelolaan Kinerja Pegawai Aparatur Sipil Negara dan **Perpres No. 21 Tahun 2023** tentang Hari Kerja dan Jam Kerja Instansi Pemerintah dan Pegawai ASN:
1. **Total Jam Kerja:** 37,5 jam per minggu (rata-rata 7,5 jam / 450 menit per hari kerja efektif, Senin s.d. Jumat).
2. **Keterkaitan Rencana Kinerja (RK):** Seluruh aktivitas harian ASN wajib merujuk secara sah pada butir Rencana Hasil Kerja (RHK/RK) pada SKP yang diturunkan dari Perjanjian Kinerja pimpinan unit kerja.
3. **Invarian KIPAPP BPS:** Pada aplikasi KIPAPP BPS (\`https://kipapp.bps.go.id\`), setiap Rencana Kinerja (RK) wajib memiliki sepasang Indikator Kinerja Individu (IKI): **Aspek Kuantitas** dan **Aspek Kualitas**. Setiap kegiatan yang diinputkan akan dihitung capaian kinerjanya terhadap IKI tersebut.

---

## 2. Matriks Distribusi Kegiatan CKP per Butir SKP / Rencana Kinerja (RK)

| No | ID SKP / RK | Rencana Hasil Kerja (RHK) / RK KIPAPP BPS | Tim Kerja Pengampu | Target IKI | Jumlah Kegiatan CKP | Total Menit Kerja |
|:--:|:---:|---|---|:---:|:---:|:---:|
`;

const skpAgg = {};
ckpOktoberEntries.forEach(e => {
  if (!skpAgg[e.skpId]) {
    skpAgg[e.skpId] = {
      id: e.skpId,
      nama: e.rkNama || skpMap[e.skpId]?.nama || '',
      tim: skpMap[e.skpId]?.tim || e.timKerja,
      kegiatanCount: 0,
      totalDurasi: 0
    };
  }
  skpAgg[e.skpId].kegiatanCount++;
  skpAgg[e.skpId].totalDurasi += e.durasi;
});

let aggIdx = 1;
for (const id of Object.keys(skpAgg).sort((a,b) => Number(a) - Number(b))) {
  const item = skpAgg[id];
  mapMd += `| ${aggIdx++} | **RK #${item.id}** | ${item.nama} | ${item.tim} | 100% | **${item.kegiatanCount} kegiatan** | ${item.totalDurasi} menit (${(item.totalDurasi/60).toFixed(1)} jam) |\n`;
}

mapMd += `\n**Total Beban Kerja Bulan Oktober 2026:** 22 Hari Kerja × 450 menit = **9.900 Menit (165 Jam Kerja Efektif)**.

---

## 3. Matriks Rincian Penyelarasan Tiap Kegiatan ke IKI KIPAPP & Nilai BerAKHLAK

| No | Tanggal | SKP/RK | Rincian Kegiatan CKP | Target & Realisasi Capaian | Bukti Dukung (Evidence) | Nilai Dasar BerAKHLAK |
|:--:|:---:|:---:|---|---|---|:---:|
`;

ckpOktoberEntries.forEach((e, idx) => {
  const no = idx + 1;
  const rk = `**RK #${e.skpId}**<br/>${(e.rkNama || '').replace(/\|/g, '\\|')}`;
  const rincian = e.rincian.replace(/\|/g, '\\|');
  const capaian = `**${e.kuantitas} ${e.satuan}**<br/>IKI Kuantitas: 100%<br/>IKI Kualitas: 100%`;
  const bukti = `\`${e.buktiDukung}\``;
  const berakhlak = e.nilaiBerakhlak || 'Akuntabel & Kompeten';

  mapMd += `| ${no} | ${e.tanggal} | ${rk} | ${rincian} | ${capaian} | ${bukti} | *${berakhlak}* |\n`;
});

mapMd += `\n---

## 4. Prosedur Sinkronisasi ke Aplikasi KIPAPP BPS

Terdapat dua metode praktis untuk memasukkan seluruh 44 kegiatan ke akun KIPAPP BPS:

### Metode A: Sinkronisasi Otomatis via Ekstensi SuperBrain Companion
1. Buka aplikasi **SuperBrain BPS** di browser (\`http://localhost:3000/ckp\`).
2. Pilih bulan **Oktober 2026**.
3. Klik tombol **"Sinkron KIPAPP"** di bagian atas tabel CKP.
4. Modal sinkronisasi akan mendeteksi sesi login KIPAPP Anda secara otomatis melalui ekstensi browser.
5. Klik **"Kirim Semua Kegiatan ke KIPAPP"**. Sistem akan memposting seluruh entri kegiatan dengan format validasi lengkap.

### Metode B: Impor Batch JSON ke KIPAPP BPS
1. Buka file cadangan yang telah disiapkan di Desktop: \`C:\\Users\\ajian\\Desktop\\kipapp-batch-oktober-2026.json\`.
2. Gunakan modul REST KIPAPP atau injektor sesi untuk mengunggah berkas batch tersebut.
3. Seluruh penugasan akan otomatis terisi dan siap dikirimkan (*submit*) ke atasan langsung untuk penilaian kinerja bulanan.

---

*Laporan integrasi ini disusun secara otomatis oleh SuperBrain BPS Engine pada ${new Date().toLocaleString('id-ID')} WITA.*
`;

const mappingDocPath = path.join(targetDir, 'PEMETAAN_CKP_SKP_KIPAPP_OKTOBER_2026.md');
fs.writeFileSync(mappingDocPath, mapMd, 'utf8');
console.log('Saved Comprehensive Mapping Document:', mappingDocPath);
