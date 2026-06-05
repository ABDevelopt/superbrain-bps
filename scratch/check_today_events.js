const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

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
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  console.log('Searching for events created since:', oneDayAgo.toISOString());
  
  const q = query(collection(db, 'schedule'));
  const snap = await getDocs(q);
  const events = [];
  
  snap.forEach(doc => {
    const data = doc.data();
    const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
    if (createdAtDate && createdAtDate >= oneDayAgo) {
      events.push({ id: doc.id, createdAtDate, ...data });
    }
  });
  
  console.log(`Found ${events.length} events created in the last 24 hours.`);
  console.log('Events detail:', JSON.stringify(events, null, 2));
}

run().catch(console.error);
