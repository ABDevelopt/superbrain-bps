const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');

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
  const q = query(collection(db, 'schedule'), orderBy('createdAt', 'desc'), limit(5));
  const snap = await getDocs(q);
  const events = [];
  snap.forEach(doc => {
    events.push({ id: doc.id, ...doc.data() });
  });
  console.log('Last 5 events detail:', JSON.stringify(events, null, 2));
}

run().catch(console.error);
