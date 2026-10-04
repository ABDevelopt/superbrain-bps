import { openDB } from 'idb';

const DB_NAME = 'superbrain-db';
const STORE_NAME = 'pending_uploads';
const DRAFTS_STORE = 'draft_activities';

const dbPromise = (typeof window !== 'undefined') ? openDB(DB_NAME, 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
      db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
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

// ===== Offline-First Draft Activities Support =====
export async function saveDraftActivity(activity) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const item = {
    ...activity,
    id: activity.id || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    updatedAt: Date.now(),
    isDraft: true
  };
  await db.put(DRAFTS_STORE, item);
  return item;
}

export async function getDraftActivities() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return await db.getAll(DRAFTS_STORE);
}

export async function removeDraftActivity(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(DRAFTS_STORE, id);
}

export async function clearDraftActivities() {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.clear(DRAFTS_STORE);
}

