import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log('Fetching skps...');
  const skpSnap = await getDocs(collection(db, 'skps'));
  const skps = [];
  skpSnap.forEach(d => skps.push({ id: d.id, ...d.data() }));
  console.log(`Found ${skps.length} SKPs`);
  skps.sort((a,b) => Number(a.id || 0) - Number(b.id || 0)).forEach(s => {
    console.log(`[SKP #${s.id}] ${s.nama} | Tim: ${s.timKerja || s.tim || '-'} | Kat: ${s.kategori || '-'}`);
  });

  console.log('\nFetching holidays & dinas_lapangan...');
  const holSnap = await getDocs(collection(db, 'holidays'));
  const holidays = [];
  holSnap.forEach(d => holidays.push({ id: d.id, ...d.data() }));

  const dlSnap = await getDocs(collection(db, 'dinas_lapangan'));
  const dls = [];
  dlSnap.forEach(d => dls.push({ id: d.id, ...d.data() }));

  console.log('Holidays:', holidays.map(h => h.tanggal));
  console.log('DL:', dls.map(d => d.tanggal));

  console.log('\nFetching CKP entries for September 2026...');
  const ckpSnap = await getDocs(collection(db, 'ckp'));
  const entries = [];
  let userIds = new Set();
  ckpSnap.forEach(d => {
    const data = d.data();
    if (data.userId) userIds.add(data.userId);
    if (data.tanggal && data.tanggal.startsWith('2026-09')) {
      entries.push({ id: d.id, ...data });
    }
  });

  console.log('User IDs in ckp collection:', Array.from(userIds));

  entries.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.waktuMulai || '').localeCompare(b.waktuMulai || ''));
  console.log(`Found ${entries.length} CKP entries in September 2026:`);
  entries.forEach(e => {
    console.log(`- ${e.tanggal} [${e.waktuMulai} - ${e.waktuSelesai}] (SKP: ${e.skpIds ? e.skpIds.join(',') : e.skpId}) ${e.rincian} (${e.kuantitas} ${e.satuan}) [id: ${e.id}]`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
