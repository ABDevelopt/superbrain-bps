// SuperBrain KIPAPP Companion - Background Service Worker (Manifest V3)
const KIPAPP_BASE_URL = 'https://kipapp.bps.go.id';

// Initialize storage defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['kipappToken', 'nip', 'lastSync'], (result) => {
    if (!result.kipappToken) {
      chrome.storage.local.set({
        kipappToken: null,
        nip: null,
        pegawaiName: null,
        lastSync: null,
        logs: []
      });
    }
  });
  console.log('[SuperBrain Companion] Extension installed successfully.');
});

// Helper for logger
function addLog(message, type = 'info') {
  const timestamp = new Date().toISOString();
  chrome.storage.local.get(['logs'], (data) => {
    const logs = data.logs || [];
    logs.unshift({ timestamp, message, type });
    if (logs.length > 50) logs.pop();
    chrome.storage.local.set({ logs });
  });
}

// Message Dispatcher
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  if (action === 'GET_STATUS') {
    chrome.storage.local.get(['kipappToken', 'nip', 'pegawaiName', 'lastSync', 'logs'], (data) => {
      sendResponse({
        success: true,
        data: {
          connected: Boolean(data.kipappToken),
          token: data.kipappToken ? `${data.kipappToken.substring(0, 12)}...` : null,
          nip: data.nip,
          pegawaiName: data.pegawaiName,
          lastSync: data.lastSync,
          logs: data.logs || []
        }
      });
    });
    return true; // Keep message channel open for async response
  }

  if (action === 'SET_KIPAPP_TOKEN') {
    const { token, nip, pegawaiName } = payload || {};
    if (token) {
      chrome.storage.local.set({
        kipappToken: token,
        nip: nip || null,
        pegawaiName: pegawaiName || null,
        lastTokenUpdate: new Date().toISOString()
      }, () => {
        addLog(`Token KIPAPP berhasil disimpan untuk ${pegawaiName || nip || 'Pengguna'}`, 'success');
        sendResponse({ success: true, message: 'Token berhasil disimpan' });
      });
    } else {
      sendResponse({ success: false, message: 'Token tidak valid' });
    }
    return true;
  }

  if (action === 'DISCONNECT') {
    chrome.storage.local.set({
      kipappToken: null,
      nip: null,
      pegawaiName: null
    }, () => {
      addLog('Koneksi KIPAPP diputus manual', 'warn');
      sendResponse({ success: true });
    });
    return true;
  }

  if (action === 'FETCH_SKP_DATA') {
    handleFetchSkpData().then(sendResponse).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (action === 'SYNC_KEGIATAN_BATCH') {
    handleSyncKegiatanBatch(payload).then(sendResponse).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

// Fetch active SKP & Rencana Kinerja (RK) from KIPAPP
async function handleFetchSkpData() {
  const storage = await chrome.storage.local.get(['kipappToken']);
  const token = storage.kipappToken;
  if (!token) throw new Error('Token KIPAPP belum tersedia. Silakan buka kipapp.bps.go.id dan login terlebih dahulu.');

  const headers = {
    'x-auth': `Bearer ${token}`,
    'Accept': 'application/json'
  };

  // 1. Get current active period / SKP
  const skpRes = await fetch(`${KIPAPP_BASE_URL}/api/v1/skp?jenis=2`, { headers });
  if (!skpRes.ok) {
    if (skpRes.status === 401) {
      await chrome.storage.local.set({ kipappToken: null });
      throw new Error('Sesi KIPAPP kedaluwarsa (401). Silakan login ulang di kipapp.bps.go.id.');
    }
    throw new Error(`Gagal mengambil data SKP: ${skpRes.status} ${skpRes.statusText}`);
  }
  const skpData = await skpRes.json();

  addLog(`Berhasil mengunduh struktur SKP dari KIPAPP (${skpData?.data?.length || 0} butir)`, 'success');
  return { success: true, data: skpData };
}

// Synchronize activities batch to KIPAPP POST /api/v1/kegiatan
async function handleSyncKegiatanBatch(payload) {
  const { activities, autoKirim = false } = payload || {};
  if (!Array.isArray(activities) || activities.length === 0) {
    throw new Error('Tidak ada kegiatan yang dipilih untuk disinkronkan.');
  }

  const storage = await chrome.storage.local.get(['kipappToken']);
  const token = storage.kipappToken;
  if (!token) throw new Error('Token KIPAPP belum tersedia. Silakan buka kipapp.bps.go.id.');

  const headers = {
    'x-auth': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const results = {
    total: activities.length,
    successCount: 0,
    failedCount: 0,
    createdIds: [],
    errors: []
  };

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    try {
      const payloadKegiatan = {
        skpid: act.skpId || act.skpid,
        rkid: act.rkId || act.rkid || act.skpId || act.skpid,
        kegiatan: act.rincian || act.kegiatan,
        tanggal: act.tanggal,
        tanggalselesai: act.tanggalselesai || act.tanggal,
        progres: Number(act.progres) || 100,
        capaian: act.capaian || `${act.kuantitas || 1} ${act.satuan || 'Kegiatan'}`,
        datadukung: act.driveUrl || act.buktiDukungUrl || act.datadukung || '-',
        iscapaianskp: true
      };

      const res = await fetch(`${KIPAPP_BASE_URL}/api/v1/kegiatan`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadKegiatan)
      });

      if (res.ok) {
        const json = await res.json();
        results.successCount++;
        if (json?.data?.id) results.createdIds.push(json.data.id);
      } else {
        const errorText = await res.text();
        results.failedCount++;
        results.errors.push({ id: act.id, date: act.tanggal, title: act.rincian, status: res.status, error: errorText });
      }

      // Small pause between requests to prevent rate-limit throttling
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      results.failedCount++;
      results.errors.push({ id: act.id, date: act.tanggal, title: act.rincian, error: e.message });
    }
  }

  // Auto-kirim to evaluators if requested
  if (autoKirim && results.createdIds.length > 0) {
    try {
      await fetch(`${KIPAPP_BASE_URL}/api/v1/kegiatan/kirim`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ kegiatanids: results.createdIds })
      });
      addLog(`Berhasil mengirimkan ${results.createdIds.length} kegiatan ke penilai di KIPAPP`, 'success');
    } catch (err) {
      console.error('[KIPAPP Kirim Error]', err);
    }
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({ lastSync: now });
  addLog(`Sinkronisasi selesai: ${results.successCount} berhasil, ${results.failedCount} gagal`, results.failedCount > 0 ? 'warn' : 'success');

  return { success: true, results };
}
