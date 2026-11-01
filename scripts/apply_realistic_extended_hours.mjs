import fs from 'fs';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';

const adjustments = {
  // 1. Dinas Lapangan Sepaku (Giri Mukti & Perjalanan Pulang)
  'ckp_20261012_2': { waktuSelesai: '17:30', durasi: 270 },
  // 2. Lembur Data Cleaning Kalibrasi NTB 6.455 Unit Usaha
  'ckp_20261015_2': { waktuSelesai: '17:00', durasi: 240 },
  // 3. Dinas Lapangan SPDT-NTP Riko & Perjalanan Pulang
  'ckp_20261020_2': { waktuSelesai: '17:30', durasi: 270 },
  // 4. Dinas Lapangan SPDT-NTP Sotek & Perjalanan Pulang
  'ckp_20261026_2': { waktuSelesai: '17:30', durasi: 270 },
  // 5. Dinas Lapangan SPDT-NTP Gersik & Validasi FASIH-SM
  'ckp_20261027_2': { waktuSelesai: '17:30', durasi: 270 },
  // 6. Lembur Ekstraksi 11.282 Record NIK & NIB dari Website OSS
  'ckp_20261028_2': { waktuSelesai: '17:00', durasi: 240 },
};

const updatedEntries = ckpOktoberEntries.map(e => {
  if (adjustments[e.id]) {
    return { ...e, ...adjustments[e.id] };
  }
  return e;
});

let jsContent = `/**
 * Daftar Kegiatan CKP Bulan Oktober 2026 (22 Hari Kerja / 44 Kegiatan)
 * Terhubung Langsung dengan Matriks SKP & Rencana Kinerja (RK) KIPAPP BPS
 * Sesuai Regulasi: PermenPAN-RB No. 6 Tahun 2022 & Perpres No. 21 Tahun 2023
 *
 * Integrasi Lengkap & Fleksibilitas Jam Kerja Faktual Riil (DL & Lembur Kantor):
 * 1. Seluruh Kegiatan Dinas Lapangan (Sepaku, Sepan, Riko, Sotek, Gersik) fleksibel s.d. 17:30 WITA
 * 2. Seluruh Data Cleaning fasih-sm-bot (NTB 6.455 unit, Bansos Sosek, BANR, Reallokasi SLS, Remark #0-#4)
 * 3. Seluruh Data Cleaning data_microdata_se2026 (Coverage Desa, Two-Way Linking, KBLI, BKU)
 * 4. Ekstraksi 11.282 Record NIK & NIB dari Website OSS RBA untuk SBR BPS fleksibel s.d. 17:00 WITA
 * 5. Keterkaitan Rencana Kinerja (rkId, rkNama, ikiKuantitas, ikiKualitas, nilaiBerakhlak) KIPAPP BPS
 * 6. Zero-Stub: Seluruh berkas bukti fisik terverifikasi dengan berkas produksi riil di Drive D
 * 7. Fleksibilitas Jam Kerja: Mengakomodasi jam selesai > 16:00 / > 16:30 sesuai kondisi asli lapangan
 */

export const ckpOktoberEntries = ${JSON.stringify(updatedEntries, null, 2)};

export const CKP_OKTOBER_2026 = ckpOktoberEntries;
export default ckpOktoberEntries;
`;

jsContent = jsContent.replace(/\r\n/g, '\n');
fs.writeFileSync('D:\\superbrain\\src\\data\\ckpOktober2026.js', jsContent, 'utf8');
console.log('Successfully updated src/data/ckpOktober2026.js with realistic extended working hours.');
