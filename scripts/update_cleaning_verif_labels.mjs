import fs from 'fs';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';

const updated = JSON.parse(JSON.stringify(ckpOktoberEntries));

let count = 0;
updated.forEach(item => {
  if (item.id === 'ckp_20261013_2') {
    item.rincian = '[Data Cleaning Verifikasi 8] Penyusunan diagram alir (Flowchart) komprehensif penanganan Verifikasi 8 (Ketidakwajaran Nilai Tambah Bruto/NTB) SE2026';
    count++;
  } else if (item.id === 'ckp_20261014_1') {
    item.rincian = '[Data Cleaning Verifikasi 8] Audit ketidakwajaran data verifikasi 8 per petugas lapangan sensus di BPS Kabupaten Penajam Paser Utara';
    count++;
  } else if (item.id === 'ckp_20261014_2') {
    item.rincian = '[Data Cleaning Verifikasi 8] Penanganan kasus penugasan kosong dan penyesuaian rasio NTB wajar 0,28 - 0,81 pada 14 kuesioner usaha keluarga';
    count++;
  } else if (item.id === 'ckp_20261015_1') {
    item.rincian = '[Data Cleaning Verifikasi 8] Eksekusi kalibrasi rasio NTB terhadap output pada 6.455 unit usaha se-Kabupaten Penajam Paser Utara secara terotomasi';
    count++;
  } else if (item.id === 'ckp_20261015_2') {
    item.rincian = '[Data Cleaning Verifikasi 8] Verifikasi hasil perbaikan variabel omzet, biaya antara, dan pelabelan kode remark cleaning data Deputi NAS (#1 s.d. #4)';
    count++;
  } else if (item.id === 'ckp_20261019_2') {
    item.rincian = '[Data Cleaning Verifikasi 3] Penautan dua arah (Two-Way Linking Tier 1) batch 100 unit penugasan prelist OSS Perorangan ke kuesioner keluarga';
    count++;
  } else if (item.id === 'ckp_20261023_1') {
    item.rincian = '[Data Cleaning Verifikasi 2 & KBLI] Remediasi anomali klasifikasi KBLI dan verifikasi 2 profesi nelayan/petani false negatif pada basis data microdata SE2026 Kab. PPU';
    count++;
  } else if (item.id === 'ckp_20261028_1') {
    item.rincian = '[Data Cleaning BKU] Audit dan remediasi anomali Bangunan Khusus Usaha (BKU) dalam keluarga pada microdata SE2026 Kab. PPU';
    count++;
  }
});

console.log(`Updated ${count} entries with official Cleaning & Verifikasi tags.`);

const fileHeader = `/**
 * Data Rekapitulasi Capaian Kinerja Pegawai (CKP) Bulan Oktober 2026
 * Satuan Kerja: BPS Kabupaten Penajam Paser Utara (Kab. 6409)
 * Periode: 1 Oktober 2026 - 31 Oktober 2026
 * Standar Satuan Terpadu per SKP (PermenPAN-RB No. 6/2022 & Perpres No. 21/2023)
 *
 * FITUR SUBSTANTIF:
 * 1. Butir Khusus SKP #30: Survei Penyusunan Diagram Timbang Nilai Tukar Petani (SPDT-NTP) 2026 (10 Kegiatan)
 * 2. Pelatihan Petugas SPDT-NTP 2026 (7 & 8 Oktober 2026) dan Lapangan (20, 26, 27 Oktober 2026)
 * 3. Penyusunan RKBMN TA 2028 (9 Oktober 2026) SKP Pengelolaan BMN
 * 4. Ekstraksi 11.282 Record NIK & NIB dari Website OSS RBA untuk SBR BPS
 * 5. Data Cleaning Terpadu: Verifikasi 2 (KBLI/Profesi), Verifikasi 3 (Two-Way Linking), Verifikasi 8 (NTB), BKU, Sosek Kematian, BANR
 * 6. Pemeriksaan Peta Wilkerstat SLS PPU (29 Oktober 2026)
 * 7. Beban kerja harian fleksibel dan realistis (>= 450 menit / 7,5 jam per hari kerja)
 */

export const ckpOktoberEntries = `;

const fileContent = fileHeader + JSON.stringify(updated, null, 2) + ';\n\nexport const CKP_OKTOBER_2026 = ckpOktoberEntries;\nexport default ckpOktoberEntries;\n';

fs.writeFileSync('src/data/ckpOktober2026.js', fileContent, 'utf8');
console.log('Successfully written src/data/ckpOktober2026.js');
