import fs from 'fs';
import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';
import { skpData } from '../src/data/skpData.js';

const skpMap = {};
skpData.forEach(s => skpMap[s.id] = s);

// BerAKHLAK mappings by team/activity
function getBerakhlak(e, skp) {
  const text = (e.rincian + ' ' + (e.buktiDukungKet || '')).toLowerCase();
  if (text.includes('dinas lapangan') || text.includes('pengawasan') || text.includes('supervisi') || text.includes('wawancara')) {
    return 'Berorientasi Pelayanan & Kolaboratif';
  }
  if (text.includes('keamanan') || text.includes('audit') || text.includes('rekapitulasi') || text.includes('verifikasi')) {
    return 'Akuntabel & Loyal';
  }
  if (text.includes('algoritma') || text.includes('otomasi') || text.includes('skrip') || text.includes('sistem') || text.includes('ekstensi')) {
    return 'Kompeten & Adaptif';
  }
  if (text.includes('sosialisasi') || text.includes('latsar') || text.includes('pelatihan')) {
    return 'Kompeten & Harmonis';
  }
  return 'Akuntabel & Kompeten';
}

console.log('Enriching entries...');
const enriched = ckpOktoberEntries.map(e => {
  const skp = skpMap[e.skpId] || {};
  const rkNama = skp.nama || 'Rencana Kinerja Kedinasan BPS';
  const berakhlak = e.nilaiBerakhlak || getBerakhlak(e, skp);
  const capaian = `${e.kuantitas} ${e.satuan}`;
  const ikiKuantitas = `Tingkat kuantitas ${rkNama.toLowerCase()}`;
  const ikiKualitas = `Tingkat kualitas ${rkNama.toLowerCase()}`;

  return {
    ...e,
    rkId: e.skpId,
    rkNama: rkNama,
    ikiKuantitas: ikiKuantitas,
    ikiKualitas: ikiKualitas,
    targetKuantitas: 100,
    targetKualitas: 100,
    capaian: capaian,
    progres: 100,
    nilaiBerakhlak: berakhlak
  };
});

console.log('Total enriched entries:', enriched.length);
console.log('Sample enriched #1:', enriched[0]);
console.log('Sample enriched #40 (OSS 11K):', enriched[39]);
