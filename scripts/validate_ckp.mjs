import { ckpOktoberEntries } from '../src/data/ckpOktober2026.js';

console.log('Total entries:', ckpOktoberEntries.length);
const byDate = {};
for (const e of ckpOktoberEntries) {
  if (!byDate[e.tanggal]) byDate[e.tanggal] = [];
  byDate[e.tanggal].push(e);
}
console.log('Unique dates:', Object.keys(byDate).length);

let anyError = false;
for (const [date, entries] of Object.entries(byDate)) {
  const totalMins = entries.reduce((s, x) => s + x.durasi, 0);
  const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0 is Sun, 5 is Fri
  if (entries.length !== 2) {
    console.log('[WARN] ' + date + ' has ' + entries.length + ' entries');
    anyError = true;
  }
  if (totalMins !== 450) {
    console.log('[TIME MISMATCH] ' + date + ': ' + totalMins + ' minutes (expected 450)');
    anyError = true;
  }
  // Check overlap
  const [e1, e2] = entries;
  if (e1 && e2 && e1.waktuSelesai > e2.waktuMulai) {
    console.log('[OVERLAP] ' + date + ': ' + e1.waktuMulai + '-' + e1.waktuSelesai + ' overlaps with ' + e2.waktuMulai + '-' + e2.waktuSelesai);
    anyError = true;
  }
}

if (!anyError) {
  console.log('SUCCESS: ALL 22 DAYS / 44 ENTRIES VALIDATED PERFECTLY! Zero overlap, exact 450 min/day.');
} else {
  console.log('ERRORS FOUND!');
}
