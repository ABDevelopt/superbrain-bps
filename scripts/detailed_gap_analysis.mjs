import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const refreshToken = fs.readFileSync('scripts/refreshToken.txt', 'utf8').trim();

async function getIdToken() {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const data = await res.json();
  return data.id_token;
}

function timeStrToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function main() {
  const token = await getIdToken();
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'ckp' }]
      }
    })
  });
  const data = await res.json();
  const ckp = data.filter(d => d.document).map(d => {
    const doc = d.document;
    const f = doc.fields || {};
    return {
      id: doc.name.split('/').pop(),
      tanggal: f.tanggal?.stringValue,
      waktuMulai: f.waktuMulai?.stringValue,
      waktuSelesai: f.waktuSelesai?.stringValue,
      rincian: f.rincian?.stringValue,
      durasi: f.durasi?.integerValue ? Number(f.durasi.integerValue) : 0,
      kuantitas: f.kuantitas?.integerValue ? Number(f.kuantitas.integerValue) : 1,
      satuan: f.satuan?.stringValue || 'Kegiatan'
    };
  });

  const sept = ckp.filter(c => c.tanggal && c.tanggal.startsWith('2026-09'));

  console.log('=== ANALISIS WAKTU KOSONG BULAN SEPTEMBER 2026 ===\n');

  for (let day = 1; day <= 30; day++) {
    const dStr = `2026-09-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dStr + 'T00:00:00');
    const dow = dateObj.getDay();
    const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dow];
    const isWeekend = dow === 0 || dow === 6;

    const dayEntries = sept.filter(c => c.tanggal === dStr);
    dayEntries.sort((a, b) => (a.waktuMulai || '').localeCompare(b.waktuMulai || ''));

    const coreStart = 7 * 60 + 30; // 07:30
    const coreEnd = dow === 5 ? 16 * 60 + 30 : 16 * 60; // Fri: 16:30, Mon-Thu: 16:00

    // Calculate free intervals within [coreStart, coreEnd]
    // Note: if weekend, standard core hours don't apply unless user has tasks
    let freeSlots = [];
    if (!isWeekend) {
      let cur = coreStart;
      for (const e of dayEntries) {
        const s = timeStrToMinutes(e.waktuMulai);
        const en = timeStrToMinutes(e.waktuSelesai);
        if (s > cur) {
          freeSlots.push({ start: cur, end: Math.min(s, coreEnd) });
        }
        cur = Math.max(cur, en);
      }
      if (cur < coreEnd) {
        freeSlots.push({ start: cur, end: coreEnd });
      }
    }

    let group = '';
    if (day < 12) group = 'Sebelum 12 Sep (Kelompok 1)';
    else if (day > 21) group = 'Sesudah 21 Sep (Kelompok 2)';
    else group = '12 - 21 Sep (Periode Tengah/Latsar)';

    console.log(`[${dStr}] ${dayName} | ${group} | ${isWeekend ? 'WEEKEND' : 'HARI KERJA'}`);
    if (dayEntries.length > 0) {
      console.log('  Kegiatan ada:');
      dayEntries.forEach(e => {
        console.log(`    - ${e.waktuMulai} - ${e.waktuSelesai} (${e.durasi}m) : ${e.rincian}`);
      });
    } else {
      console.log('  Kegiatan ada: (TIDAK ADA KEGIATAN)');
    }

    if (!isWeekend) {
      if (freeSlots.length > 0) {
        console.log('  >> WAKTU KOSONG (GAP):');
        freeSlots.forEach(s => {
          const dur = s.end - s.start;
          console.log(`     * ${minutesToTimeStr(s.start)} - ${minutesToTimeStr(s.end)} (${dur} menit)`);
        });
      } else {
        console.log('  >> TERISI PENUH');
      }
    }
    console.log('');
  }
}

main().catch(console.error);
