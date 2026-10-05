import { openDB } from 'idb';

const DB_NAME = 'superbrain-db';
const STORE_NAME = 'pending_uploads';
const DRAFTS_STORE = 'draft_activities';
const CAMERA_MEDIA_STORE = 'camera_media';

const dbPromise = (typeof window !== 'undefined') ? openDB(DB_NAME, 4, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
      db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(CAMERA_MEDIA_STORE)) {
      db.createObjectStore(CAMERA_MEDIA_STORE, { keyPath: 'id' });
    }
  },
}) : null;

export async function savePendingUpload(id, file, customFileName, type = 'ckp', files = null, presensiFile = null, userId = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put(STORE_NAME, {
    id, // entry id
    file, // Blob/File object
    customFileName,
    files, // array of { file, customFileName } for multifile
    presensiFile, // { file, customFileName } for attendance proof
    type,
    userId: userId || null,
    timestamp: Date.now()
  });
}

export async function getPendingUploads(userId = null) {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const all = await db.getAll(STORE_NAME);
  if (!userId) return all;
  return all.filter(item => item.userId === userId);
}

export async function removePendingUpload(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

export async function getPendingUploadCount(userId = null) {
  if (!dbPromise) return 0;
  const items = await getPendingUploads(userId);
  return items.length;
}

// ===== Offline-First Draft Activities Support =====
export async function saveDraftActivity(activity, userId = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const item = {
    ...activity,
    id: activity.id || `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: userId || activity.userId || null,
    updatedAt: Date.now(),
    isDraft: true
  };
  await db.put(DRAFTS_STORE, item);
  return item;
}

export async function getDraftActivities(userId = null) {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const all = await db.getAll(DRAFTS_STORE);
  if (!userId) return all;
  return all.filter(item => item.userId === userId);
}

export async function removeDraftActivity(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(DRAFTS_STORE, id);
}

export async function clearDraftActivities(userId = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  if (!userId) {
    await db.clear(DRAFTS_STORE);
    return;
  }
  const all = await db.getAll(DRAFTS_STORE);
  for (const item of all) {
    if (item.userId === userId) {
      await db.delete(DRAFTS_STORE, item.id);
    }
  }
}

// ===== Persistent Camera Geotag Media (Photos & Videos) =====
export async function saveCameraMedia(item, userId = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  const entry = {
    ...item,
    id: item.id || `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: userId || item.userId || null,
    timestamp: item.timestamp || Date.now()
  };
  await db.put(CAMERA_MEDIA_STORE, entry);
  return entry;
}

export async function getCameraMedia(userId = null) {
  if (!dbPromise) return [];
  const db = await dbPromise;
  const all = await db.getAll(CAMERA_MEDIA_STORE);
  const sorted = all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (!userId) return sorted;
  return sorted.filter(item => !item.userId || item.userId === userId);
}

export async function removeCameraMedia(id) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete(CAMERA_MEDIA_STORE, id);
}

export async function clearCameraMedia(userId = null) {
  if (!dbPromise) return;
  const db = await dbPromise;
  if (!userId) {
    await db.clear(CAMERA_MEDIA_STORE);
    return;
  }
  const all = await db.getAll(CAMERA_MEDIA_STORE);
  for (const item of all) {
    if (item.userId === userId) {
      await db.delete(CAMERA_MEDIA_STORE, item.id);
    }
  }
}
