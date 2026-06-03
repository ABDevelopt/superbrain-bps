import { db, auth } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc, writeBatch, query, where } from 'firebase/firestore';
import { skpData } from '@/data/skpData';

const COLLECTIONS = ['tasks', 'schedule', 'ckp'];

/**
 * Fetches all dynamic data from Firestore and includes static SKP data.
 */
export async function getBackupData() {
  const user = auth.currentUser;
  if (!user) throw new Error('User tidak terautentikasi.');

  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {
      skp: skpData, // Include static SKP data as requested
    }
  };

  for (const col of COLLECTIONS) {
    const q = query(collection(db, col), where('userId', '==', user.uid));
    const snapshot = await getDocs(q);
    const docs = [];
    snapshot.forEach(doc => {
      docs.push({ id: doc.id, ...doc.data() });
    });
    backup.data[col] = docs;
  }

  return backup;
}

/**
 * Restores data to Firestore. (Note: SKP is static and cannot be overwritten here)
 */
export async function restoreFromBackupData(backup) {
  if (!backup || !backup.data) throw new Error('Data backup tidak valid.');
  const user = auth.currentUser;
  if (!user) throw new Error('User tidak terautentikasi.');

  const batch = writeBatch(db);
  let operationCount = 0;

  for (const col of COLLECTIONS) {
    if (backup.data[col] && Array.isArray(backup.data[col])) {
      for (const item of backup.data[col]) {
        const docRef = doc(db, col, item.id);
        const dataToSave = { 
          ...item,
          userId: user.uid // Ensure restored documents are owned by the current user
        };
        delete dataToSave.id; // Don't save id inside the document
        
        batch.set(docRef, dataToSave);
        operationCount++;

        // Firestore batch has a limit of 500 operations.
        if (operationCount === 490) {
          await batch.commit();
          operationCount = 0;
        }
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
}

/**
 * Exports data to a downloadable JSON file.
 */
export async function exportToJSON() {
  const data = await getBackupData();
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `superbrain-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Creates a cloud snapshot in the "backups" collection.
 */
export async function createCloudSnapshot() {
  const user = auth.currentUser;
  if (!user) throw new Error('User tidak terautentikasi.');
  
  const data = await getBackupData();
  const backupDocRef = doc(db, 'backups', user.uid);
  
  // We can just store it as a JSON string to easily bypass nested array limits
  await setDoc(backupDocRef, {
    timestamp: new Date().toISOString(),
    payload: JSON.stringify(data)
  });
  
  localStorage.setItem('last_cloud_backup', new Date().toISOString());
}

/**
 * Restores from the cloud snapshot in the "backups" collection.
 */
export async function restoreFromCloudSnapshot() {
  const user = auth.currentUser;
  if (!user) throw new Error('User tidak terautentikasi.');
  
  const backupDocRef = doc(db, 'backups', user.uid);
  const docSnap = await getDoc(backupDocRef);
  
  if (docSnap.exists()) {
    const backupData = JSON.parse(docSnap.data().payload);
    await restoreFromBackupData(backupData);
  } else {
    throw new Error('Tidak ada snapshot cloud yang ditemukan.');
  }
}
