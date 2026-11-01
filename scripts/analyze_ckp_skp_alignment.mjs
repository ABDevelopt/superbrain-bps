import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

const skpMap = {};
skpData.forEach(s => skpMap[s.id] = s);

console.log('=== PEMETAAN LENGKAP 44 KEGIATAN CKP OKTOBER 2026 KE SKP & KIPAPP BPS ===\n');

ckpOktoberEntries.forEach((e, idx) => {
  const skp = skpMap[e.skpId];
  console.log((idx + 1) + '. ' + e.tanggal + ' [' + e.waktuMulai + '-' + e.waktuSelesai + ' WITA]');
  console.log('   Rincian  : ' + e.rincian);
  console.log('   SKP/RK   : #' + e.skpId + ' - ' + (skp ? skp.nama : 'TIDAK DITEMUKAN'));
  console.log('   Tim Kerja: ' + e.timKerja + ' (SKP Tim: ' + (skp ? skp.tim : '-') + ')');
  console.log('   Output   : ' + e.kuantitas + ' ' + e.satuan);
  console.log('   Bukti    : ' + e.buktiDukung);
  console.log('--------------------------------------------------------------------------------');
});
