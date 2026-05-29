import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { parseInvitation } from '@/lib/invitationParser';
import { skpData } from '@/data/skpData';

// Helper to send message back to Telegram
async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
  return response.ok;
}

// Handler for Telegram Webhook
async function handleTelegramWebhook(token, body) {
  const tgMessage = body.message;
  if (!tgMessage) {
    return NextResponse.json({ success: true });
  }

  const chatId = tgMessage.chat.id;
  const messageText = tgMessage.text;

  // 1. Handle commands: /start or /help
  if (messageText && (messageText.startsWith('/start') || messageText.startsWith('/help'))) {
    const welcomeMessage = 
      `Halo! Saya adalah bot asisten SuperBrain BPS.\n\n` +
      `Anda dapat mengirim atau memforward berkas surat undangan (*PDF* atau *Gambar/Foto*) ke saya.\n\n` +
      `Saya akan membaca dan menganalisis berkas tersebut dengan AI, mengelompokkannya ke Butir SKP BPS yang cocok secara semantik, dan langsung menyimpannya ke kalender jadwal Anda.\n\n` +
      `Silakan kirimkan dokumen atau foto surat undangan Anda sekarang!`;
    await sendTelegramMessage(token, chatId, welcomeMessage);
    return NextResponse.json({ success: true });
  }

  // 2. Detect Document or Photo
  const document = tgMessage.document;
  const photo = tgMessage.photo;

  if (document || photo) {
    await sendTelegramMessage(token, chatId, `Surat undangan diterima. Sedang menganalisis dengan AI...`);

    let fileId;
    let mimeType;

    if (document) {
      fileId = document.file_id;
      mimeType = document.mime_type;
    } else {
      // Pick the largest photo size
      const largestPhoto = photo[photo.length - 1];
      fileId = largestPhoto.file_id;
      mimeType = 'image/jpeg'; // Default for Telegram photos
    }

    try {
      // Get file path from Telegram
      const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
      const getFileRes = await fetch(getFileUrl);
      if (!getFileRes.ok) {
        throw new Error('Gagal mendapatkan lokasi berkas dari Telegram.');
      }
      
      const getFileData = await getFileRes.json();
      if (!getFileData.ok || !getFileData.result?.file_path) {
        throw new Error('Gagal memproses detail berkas dari Telegram.');
      }
      
      const filePath = getFileData.result.file_path;

      // Download file content
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) {
        throw new Error('Gagal mengunduh berkas dari server Telegram.');
      }

      const fileBuffer = Buffer.from(await downloadRes.arrayBuffer());

      // Parse using Gemini AI
      const parsedData = await parseInvitation(fileBuffer, mimeType);

      // Save directly to Firestore
      const docRef = await addDoc(collection(db, 'schedule'), {
        judul: parsedData.judul,
        tanggal: parsedData.tanggal,
        waktu: parsedData.waktu,
        waktuSelesai: parsedData.waktuSelesai || '',
        lokasi: parsedData.lokasi || '',
        deskripsi: parsedData.deskripsi || '',
        kategori: parsedData.kategori,
        urgensi: parsedData.urgensi,
        skpId: parsedData.skpId ? Number(parsedData.skpId) : null,
        reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
        sentReminders: [],
        isSelesai: false,
        createdAt: serverTimestamp(),
      });

      // Find SKP info
      const skpInfo = parsedData.skpId
        ? `\n*Butir SKP Terkait:* SKP #${parsedData.skpId} - ${skpData.find(s => s.id === parsedData.skpId)?.nama || ''}`
        : '\n*Butir SKP Terkait:* Tidak ada SKP BPS yang cocok';

      // Send Success response to user
      const successMsg = 
        `📅 *Agenda Berhasil Ditambahkan!*\n\n` +
        `*Acara:* ${parsedData.judul}\n` +
        `*Tanggal:* ${parsedData.tanggal}\n` +
        `*Waktu:* ${parsedData.waktu}${parsedData.waktuSelesai ? ` - ${parsedData.waktuSelesai}` : ''} WIB\n` +
        `*Tempat:* ${parsedData.lokasi || 'Tidak disebutkan'}\n` +
        `*Kategori:* ${parsedData.kategori}\n` +
        `*Urgensi:* ${parsedData.urgensi}${skpInfo}\n\n` +
        `_Silakan buka aplikasi web SuperBrain untuk melakukan penyesuaian detail._`;

      await sendTelegramMessage(token, chatId, successMsg);
      return NextResponse.json({ success: true, docId: docRef.id });

    } catch (error) {
      console.error('Error handling Telegram file upload:', error);
      await sendTelegramMessage(
        token, 
        chatId, 
        `Gagal menganalisis dokumen undangan. Terjadi kesalahan:\n_${error.message}_`
      );
      return NextResponse.json({ success: false, error: error.message });
    }
  }

  // Fallback for non-media text messages
  const helpMsg = `Kirimkan dokumen surat undangan (.pdf) atau gambar/foto surat fisik undangan untuk dikonversi menjadi jadwal otomatis.`;
  await sendTelegramMessage(token, chatId, helpMsg);
  return NextResponse.json({ success: true });
}

// GET method to set webhook URL dynamically
export async function GET(request) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Telegram Bot Token is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const webhookUrl = searchParams.get('setWebhook');

    if (!webhookUrl) {
      return NextResponse.json({ 
        message: 'Telegram API Route is running. Pass ?setWebhook=YOUR_URL to configure the Telegram webhook.' 
      });
    }

    const tgUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
    const res = await fetch(tgUrl);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.description || 'Failed to set webhook' }, { status: res.status });
    }

    return NextResponse.json({ success: true, message: `Webhook set to ${webhookUrl}`, data });
  } catch (error) {
    console.error('Error setting webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST method for webhook updates and sending custom notifications
export async function POST(request) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Telegram Bot Token is not configured on the server' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // 1. Detect if this is an incoming webhook from Telegram
    if (body.update_id) {
      return await handleTelegramWebhook(token, body);
    }

    // 2. Otherwise, treat as sending message request (Backward Compatibility)
    const { chatId, message } = body;

    if (!chatId || !message) {
      return NextResponse.json(
        { error: 'chatId and message are required' },
        { status: 400 }
      );
    }

    const ok = await sendTelegramMessage(token, chatId, message);

    if (!ok) {
      return NextResponse.json(
        { error: 'Failed to send message to Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
