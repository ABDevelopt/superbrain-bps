const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDMm70dX21HSUm7UsKbU1V0txXcaP1Mfn4",
  authDomain: "supersecondbrain.firebaseapp.com",
  projectId: "supersecondbrain",
  storageBucket: "supersecondbrain.firebasestorage.app",
  messagingSenderId: "599864947018",
  appId: "1:599864947018:web:1aae673b423dc59c4951b3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log('Searching for corrupted schedule entry...');
  const q = query(collection(db, 'schedule'));
  const snap = await getDocs(q);
  
  let found = false;
  for (const document of snap.docs) {
    const data = document.data();
    if (data.judul && data.judul.includes('Undangan Rapat Koordinasi Persiapan SE2026')) {
      console.log('Found matching schedule document:', document.id);
      console.log('Current waktuSelesai:', data.waktuSelesai);
      
      const cleanedTime = 'selesai';
      await updateDoc(doc(db, 'schedule', document.id), {
        waktuSelesai: cleanedTime
      });
      console.log('Successfully updated waktuSelesai to:', cleanedTime);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log('No matching schedule entry found.');
  }
}

run().catch(console.error);
