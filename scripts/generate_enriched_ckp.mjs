import fs from 'fs';
import path from 'path';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

const skpMap = {};
skpData.forEach(s => skpMap[s.id] = s);

function getBerakhlak(e, skp) {
  const text = (e.rincian + ' ' + (e.buktiDukungKet || '')).toLowerCase();
  if (text.includes('dinas lapangan') || text.includes('pengawasan') || text.includes('supervisi') || text.includes('wawancara')) {
    return 'Berorientasi Pelayanan & Kolaboratif';
  }
  if (text.includes('keamanan') || text.includes('audit') || text.includes('rekapitulasi') || text.includes('verifikasi')) {
    return 'Akuntabel & Loyal';
  }
  if (text.includes('algoritma') || text.includes('otomasi') || text.includes('skrip') || text.includes('sistem') || text.includes('ekstensi') || text.includes('ekstraksi')) {
    return 'Kompeten & Adaptif';
  }
  if (text.includes('sosialisasi') || text.includes('latsar') || text.includes('pelatihan') || text.includes('bahan ajar')) {
    return 'Kompeten & Harmonis';
  }
  return 'Akuntabel & Kompeten';
}

const enrichedEntries = ckpOktoberEntries.map(e => {
  const skp = skpMap[e.skpId] || {};
  const rkNama = skp.nama || 'Rencana Kinerja Kedinasan BPS';
  const berakhlak = e.nilaiBerakhlak || getBerakhlak(e, skp);
  const capaian = `${e.kuantitas} ${e.satuan}`;
  const ikiKuantitas = `Tingkat kuantitas pemenuhan ${rkNama.toLowerCase()}`;
  const ikiKualitas = `Tingkat kualitas pemenuhan ${rkNama.toLowerCase()}`;

  return {
    id: e.id,
    tanggal: e.tanggal,
    waktuMulai: e.waktuMulai,
    waktuSelesai: e.waktuSelesai,
    durasi: e.durasi,
    skpId: e.skpId,
    skpIds: e.skpIds || [e.skpId],
    rkId: e.skpId,
    rkNama: rkNama,
    ikiKuantitas: ikiKuantitas,
    ikiKualitas: ikiKualitas,
    targetKuantitas: 100,
    targetKualitas: 100,
    capaian: capaian,
    progres: 100,
    rincian: e.rincian,
    kuantitas: e.kuantitas,
    satuan: e.satuan,
    timKerja: e.timKerja,
    isFullday: e.isFullday || false,
    nilaiBerakhlak: berakhlak,
    buktiDukung: e.buktiDukung,
    buktiDukungKet: e.buktiDukungKet,
    buktiDukungStatus: e.buktiDukungStatus || 'file'
  };
});

// Format JS source
let jsContent = `/**
 * Daftar Kegiatan CKP Bulan Oktober 2026 (22 Hari Kerja / 44 Kegiatan)
 * Terhubung Langsung dengan Matriks SKP & Rencana Kinerja (RK) KIPAPP BPS
 * Sesuai Regulasi: PermenPAN-RB No. 6 Tahun 2022 & Perpres No. 21 Tahun 2023
 *
 * Integrasi Lengkap:
 * 1. Seluruh Kegiatan Dinas Lapangan (Sepaku, Sepan, Riko, Sotek, Gersik)
 * 2. Seluruh Data Cleaning fasih-sm-bot (NTB 6.455 unit, Bansos Sosek, BANR, Reallokasi SLS, Remark #0-#4)
 * 3. Seluruh Data Cleaning data_microdata_se2026 (Coverage Desa, Two-Way Linking, KBLI, BKU)
 * 4. Ekstraksi 11.282 Record NIK & NIB dari Website OSS RBA untuk SBR BPS
 * 5. Keterkaitan Rencana Kinerja (rkId, rkNama, ikiKuantitas, ikiKualitas, nilaiBerakhlak) KIPAPP BPS
 */

export const ckpOktoberEntries = ${JSON.stringify(enrichedEntries, null, 2)};

export const CKP_OKTOBER_2026 = ckpOktoberEntries;
export default ckpOktoberEntries;
`;

// Normalize to LF
jsContent = jsContent.replace(/\r\n/g, '\n');

fs.writeFileSync('D:\\superbrain\\src\\data\\ckpOktober2026.js', jsContent, 'utf8');
console.log('Successfully updated D:\\superbrain\\src\\data\\ckpOktober2026.js');
