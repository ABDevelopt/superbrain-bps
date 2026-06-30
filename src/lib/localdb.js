import { openDB } from 'idb';

const DB_NAME = 'superbrain-db';
const STORE_NAME = 'pending_uploads';

const dbPromise = (typeof window !== 'undefined') ? openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
}) : null;

export async function savePendingUpload(id, file, customFileName, type = 'ckp', files = null, presensiFile = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put(STORE_NAME, {
    id, // this will be the entry id
    file, // the Blob/File object
    customFileName,
    files, // array of { file, customFileName } for multifile
    presensiFile, // { file, customFileName } for attendance proof
    type,
    timestamp: Date.now()
  });
}

export async function getPendingUploads() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
}

export async function removePendingUpload(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

export async function getPendingUploadCount() {
  if (!dbPromise) return 0;
  const db = await dbPromise;
  return await db.count(STORE_NAME);
}
