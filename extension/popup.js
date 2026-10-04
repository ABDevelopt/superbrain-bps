// SuperBrain KIPAPP Companion - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('status-badge');
  const userSection = document.getElementById('user-info-section');
  const userNameEl = document.getElementById('user-name');
  const userNipEl = document.getElementById('user-nip');
  const userInitialEl = document.getElementById('user-initial');
  const lastSyncEl = document.getElementById('last-sync-time');
  const btnKipapp = document.getElementById('btn-open-kipapp');
  const btnSuperbrain = document.getElementById('btn-open-superbrain');

  function updateUI() {
    chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
      const data = response?.data;
      if (data && data.connected) {
        statusBadge.textContent = 'Terhubung';
        statusBadge.className = 'badge badge-connected';

        if (data.pegawaiName || data.nip) {
          userSection.style.display = 'flex';
          userNameEl.textContent = data.pegawaiName || 'Pegawai BPS';
          userNipEl.textContent = data.nip ? `NIP: ${data.nip}` : '';
          const initials = (data.pegawaiName || 'YA')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          userInitialEl.textContent = initials;
        }

        if (data.lastSync) {
          const d = new Date(data.lastSync);
          lastSyncEl.textContent = `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } else {
        statusBadge.textContent = 'Belum Terhubung';
        statusBadge.className = 'badge badge-disconnected';
        userSection.style.display = 'none';
      }
    });
  }

  btnKipapp.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://kipapp.bps.go.id/#/home' });
  });

  btnSuperbrain.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://superbrain-bps.vercel.app/ckp' });
  });

  updateUI();
});
