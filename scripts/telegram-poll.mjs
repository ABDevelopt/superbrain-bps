/**
 * Telegram Bot Local Polling Script
 * 
 * Polls for new messages from the Telegram Bot API using getUpdates,
 * then forwards each update to the local Next.js webhook handler
 * at http://localhost:3000/api/telegram.
 * 
 * Usage: node scripts/telegram-poll.mjs
 */

const BOT_TOKEN = '8979507746:AAGD2b4u7r40S657bS8FK_HoNhXJt9OgRVM';
const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/telegram';
const POLL_INTERVAL_MS = 2000;

let lastUpdateId = 0;

async function getUpdates() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
      console.error('[Poll] Telegram getUpdates error:', data.description);
      return [];
    }
    return data.result || [];
  } catch (err) {
    console.error('[Poll] Network error:', err.message);
    return [];
  }
}

async function forwardToLocal(update) {
  try {
    console.log(`[Forward] Sending update ${update.update_id} to local webhook...`);
    const res = await fetch(LOCAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    const result = await res.text();
    console.log(`[Forward] Response (${res.status}):`, result.substring(0, 200));
  } catch (err) {
    console.error('[Forward] Error forwarding to local:', err.message);
  }
}

async function main() {
  // First, delete any existing webhook so getUpdates works
  console.log('[Init] Removing any existing webhook...');
  const delRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  const delData = await delRes.json();
  console.log('[Init] deleteWebhook:', delData.description || delData.result);

  console.log('');
  console.log('==============================================');
  console.log('  Telegram Bot Local Polling Active');
  console.log('  Kirim dokumen/foto ke bot Telegram Anda');
  console.log('  Tekan Ctrl+C untuk berhenti');
  console.log('==============================================');
  console.log('');

  while (true) {
    const updates = await getUpdates();
    
    for (const update of updates) {
      lastUpdateId = update.update_id;

      const msg = update.message;
      if (!msg) continue;

      const from = msg.from?.first_name || 'Unknown';
      const chatId = msg.chat?.id;

      if (msg.document) {
        console.log(`[Received] Dokumen dari ${from} (chat ${chatId}): ${msg.document.file_name}`);
      } else if (msg.photo) {
        console.log(`[Received] Foto dari ${from} (chat ${chatId})`);
      } else if (msg.text) {
        console.log(`[Received] Teks dari ${from} (chat ${chatId}): ${msg.text}`);
      } else {
        console.log(`[Received] Pesan lain dari ${from} (chat ${chatId})`);
      }

      await forwardToLocal(update);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch(console.error);
