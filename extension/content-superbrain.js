// SuperBrain KIPAPP Companion - Bridge for SuperBrain Web App
// Matches: https://superbrain-bps.vercel.app/*, http://localhost:3000/*, http://localhost:3001/*

(function() {
  console.log('[SuperBrain Companion] Bridge active on SuperBrain App.');

  // Notify Web App that extension is installed
  function announceExtensionReady() {
    window.postMessage({
      source: 'SUPERBRAIN_EXTENSION',
      action: 'EXTENSION_READY',
      version: '1.0.0'
    }, '*');
  }

  // Listen for requests from SuperBrain Web App
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'SUPERBRAIN_WEB') return;

    const { action, payload, requestId } = event.data;

    if (action === 'PING') {
      chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
        window.postMessage({
          source: 'SUPERBRAIN_EXTENSION',
          action: 'PONG',
          requestId,
          data: res?.data || { connected: false }
        }, '*');
      });
    }

    if (action === 'SYNC_KEGIATAN') {
      chrome.runtime.sendMessage({
        action: 'SYNC_KEGIATAN_BATCH',
        payload
      }, (res) => {
        window.postMessage({
          source: 'SUPERBRAIN_EXTENSION',
          action: 'SYNC_KEGIATAN_RESPONSE',
          requestId,
          success: res?.success || false,
          results: res?.results || null,
          error: res?.error || null
        }, '*');
      });
    }

    if (action === 'FETCH_SKP') {
      chrome.runtime.sendMessage({
        action: 'FETCH_SKP_DATA'
      }, (res) => {
        window.postMessage({
          source: 'SUPERBRAIN_EXTENSION',
          action: 'FETCH_SKP_RESPONSE',
          requestId,
          success: res?.success || false,
          data: res?.data || null,
          error: res?.error || null
        }, '*');
      });
    }
  });

  // Announce immediately and again on load
  announceExtensionReady();
  window.addEventListener('load', announceExtensionReady);
})();
