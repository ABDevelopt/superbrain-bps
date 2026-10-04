// SuperBrain KIPAPP Companion - Content Script for KIPAPP BPS
// Matches: https://kipapp.bps.go.id/*

(function() {
  console.log('[SuperBrain Companion] Injecting into KIPAPP BPS...');

  function findToken() {
    // 1. Check common localStorage keys in KIPAPP / Keycloak
    const potentialKeys = ['token', 'access_token', 'id_token', 'x-auth', 'auth_token', 'user', 'profile', 'keycloak-token'];
    
    for (const key of potentialKeys) {
      const val = localStorage.getItem(key);
      if (val) {
        if (typeof val === 'string' && (val.startsWith('ey') || val.length > 50)) {
          return val.replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
        }
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            const token = parsed.token || parsed.access_token || parsed.id_token;
            if (token && typeof token === 'string') return token.replace(/^Bearer\s+/i, '');
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }

    // 2. Iterate all localStorage keys to find JWT pattern (ey...)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (typeof v === 'string') {
        if (v.startsWith('ey') && v.split('.').length === 3) {
          return v;
        }
        if (v.includes('"token":"ey')) {
          try {
            const p = JSON.parse(v);
            if (p.token) return p.token;
          } catch (e) {}
        }
      }
    }

    return null;
  }

  function extractUserInfo(token) {
    if (!token) return { nip: null, name: null };
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const claims = JSON.parse(decodedJson);
      return {
        nip: claims.niplama || claims.preferred_username || claims.nip || null,
        name: claims.name || claims.nama || null
      };
    } catch (e) {
      return { nip: null, name: null };
    }
  }

  function syncTokenToExtension() {
    const token = findToken();
    if (token) {
      const userInfo = extractUserInfo(token);
      chrome.runtime.sendMessage({
        action: 'SET_KIPAPP_TOKEN',
        payload: {
          token,
          nip: userInfo.nip,
          pegawaiName: userInfo.name
        }
      }, (res) => {
        if (res?.success) {
          renderFloatingBadge(userInfo.name || userInfo.nip || 'ASN BPS');
        }
      });
    }
  }

  function renderFloatingBadge(userName) {
    if (document.getElementById('superbrain-kipapp-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'superbrain-kipapp-badge';
    badge.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    badge.innerHTML = `
      <span style="font-size: 14px;">🧠</span>
      <span>SuperBrain: <strong>Terhubung</strong> (${userName})</span>
    `;

    badge.onmouseenter = () => {
      badge.style.transform = 'translateY(-2px) scale(1.02)';
      badge.style.boxShadow = '0 15px 30px -5px rgba(79, 70, 229, 0.5)';
    };
    badge.onmouseleave = () => {
      badge.style.transform = 'translateY(0) scale(1)';
      badge.style.boxShadow = '0 10px 25px -5px rgba(79, 70, 229, 0.4)';
    };

    badge.onclick = () => {
      window.open('https://superbrain-bps.vercel.app/ckp', '_blank');
    };

    document.body.appendChild(badge);
  }

  // Initial check and periodic poll for token when user logs in via SSO
  syncTokenToExtension();
  const interval = setInterval(() => {
    syncTokenToExtension();
  }, 5000);

  // Clear interval after 2 minutes
  setTimeout(() => clearInterval(interval), 120000);
})();
