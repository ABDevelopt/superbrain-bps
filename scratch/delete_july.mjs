import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Mencari data CKP untuk bulan Juli 2026...");
  const q = query(
    collection(db, "ckp"),
    where("tanggal", ">=", "2026-07-01"),
    where("tanggal", "<=", "2026-07-31")
  );

  const snapshot = await getDocs(q);
  console.log(`Menemukan ${snapshot.size} entri CKP untuk bulan Juli 2026.`);
  
  let count = 0;
  for (const document of snapshot.docs) {
    console.log(`Menghapus document ID: ${document.id} (${document.data().tanggal} - ${document.data().rincian})`);
    await deleteDoc(doc(db, "ckp", document.id));
    count++;
  }
  
  console.log(`Sukses menghapus ${count} entri CKP bulan Juli 2026.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
