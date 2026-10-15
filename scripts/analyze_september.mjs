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

async function getCollection(idToken, colName) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(d => {
    const fields = d.fields || {};
    const obj = { id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(fields)) {
      if (v.stringValue !== undefined) obj[k] = v.stringValue;
      else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
      else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
      else if (v.arrayValue !== undefined) {
        obj[k] = (v.arrayValue.values || []).map(x => x.stringValue || x.integerValue);
      }
    }
    return obj;
  });
}

async function runQuery(idToken, colName) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colName }]
      }
    })
  });
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => {
    const doc = d.document;
    const fields = doc.fields || {};
    const obj = { id: doc.name.split('/').pop() };
    for (const [k, v] of Object.entries(fields)) {
      if (v.stringValue !== undefined) obj[k] = v.stringValue;
      else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
      else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
      else if (v.arrayValue !== undefined) {
        obj[k] = (v.arrayValue.values || []).map(x => x.stringValue || x.integerValue);
      }
    }
    return obj;
  });
}

async function main() {
  const token = await getIdToken();
  const holidays = await getCollection(token, 'holidays');
  const dls = await getCollection(token, 'dinas_lapangan');
  const ckp = await runQuery(token, 'ckp');

  console.log('--- HOLIDAYS ---');
  holidays.filter(h => h.tanggal && h.tanggal.startsWith('2026-09')).forEach(h => console.log(h));

  console.log('--- DINAS LAPANGAN ---');
  dls.filter(d => d.tanggal && d.tanggal.startsWith('2026-09')).forEach(d => console.log(d));

  console.log('--- CKP SEPTEMBER 2026 ---');
  const sept = ckp.filter(c => c.tanggal && c.tanggal.startsWith('2026-09'));
  sept.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.waktuMulai || '').localeCompare(b.waktuMulai || ''));
  
  // Group by date
  const byDate = {};
  for (let day = 1; day <= 30; day++) {
    const dStr = `2026-09-${String(day).padStart(2, '0')}`;
    byDate[dStr] = [];
  }
  for (const item of sept) {
    if (byDate[item.tanggal]) {
      byDate[item.tanggal].push(item);
    }
  }

  for (const [date, items] of Object.entries(byDate)) {
    const d = new Date(date);
    const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
    console.log(`\n=== ${date} (${dayName}) === [${items.length} items]`);
    if (items.length === 0) {
      console.log('  KOSONG');
    } else {
      items.forEach(it => {
        console.log(`  [${it.waktuMulai} - ${it.waktuSelesai}] ${it.rincian} (Durasi: ${it.durasi || '-'}, Kuantitas: ${it.kuantitas} ${it.satuan})`);
      });
    }
  }
}

main().catch(console.error);
