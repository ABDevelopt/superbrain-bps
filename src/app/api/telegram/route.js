import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { parseInvitation, parseInvitationText } from '@/lib/invitationParser';
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
      `Chat ID Anda adalah: *${chatId}*\n\n` +
      `Silakan salin Chat ID di atas, lalu daftarkan di menu *Pengaturan* aplikasi SuperBrain BPS Anda.\n\n` +
      `Setelah terdaftar, Anda dapat mengirim atau memforward berkas surat undangan (*PDF* atau *Gambar/Foto*) ke saya untuk disimpan otomatis ke kalender jadwal Anda!`;
    await sendTelegramMessage(token, chatId, welcomeMessage);
    return NextResponse.json({ success: true });
  }

  // 2. Resolve userId from telegram_mappings
  let userId;
  try {
    const mappingRef = doc(db, 'telegram_mappings', String(chatId));
    const mappingSnap = await getDoc(mappingRef);
    if (!mappingSnap.exists()) {
      const registerMsg = 
        `Halo! Chat ID Anda (*${chatId}*) belum terdaftar di aplikasi SuperBrain BPS.\n\n` +
        `Silakan buka aplikasi SuperBrain BPS, masuk ke menu *Pengaturan*, lalu masukkan dan simpan Chat ID Anda di sana agar saya dapat memproses pesan Anda.`;
      await sendTelegramMessage(token, chatId, registerMsg);
      return NextResponse.json({ success: true });
    }
    userId = mappingSnap.data().userId;
  } catch (err) {
    console.error("Gagal melakukan pencarian mapping Telegram:", err);
    await sendTelegramMessage(token, chatId, `Terjadi kesalahan saat memeriksa akun Anda di database: _${err.message}_`);
    return NextResponse.json({ success: false, error: err.message });
  }

  // 3. Detect Document, Photo, or Text
  const document = tgMessage.document;
  const photo = tgMessage.photo;

  if (document || photo || messageText) {
    await sendTelegramMessage(token, chatId, `Pesan diterima. Sedang menganalisis kegiatan dengan AI...`);

    try {
      let parsedData;
      let fileId = null;

      if (document || photo) {
        let mimeType;

        if (document) {
          fileId = document.file_id;
          mimeType = document.mime_type;
        } else {
          const largestPhoto = photo[photo.length - 1];
          fileId = largestPhoto.file_id;
          mimeType = 'image/jpeg';
        }

        const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
        const getFileRes = await fetch(getFileUrl);
        if (!getFileRes.ok) throw new Error('Gagal mendapatkan lokasi berkas dari Telegram.');
        
        const getFileData = await getFileRes.json();
        if (!getFileData.ok || !getFileData.result?.file_path) {
          throw new Error('Gagal memproses detail berkas dari Telegram.');
        }
        
        const filePath = getFileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
        const downloadRes = await fetch(downloadUrl);
        if (!downloadRes.ok) throw new Error('Gagal mengunduh berkas dari server Telegram.');

        const fileBuffer = Buffer.from(await downloadRes.arrayBuffer());

        // Fetch context
        const contextData = await fetchAllContextData(userId);
        parsedData = await parseInvitation(fileBuffer, mimeType, contextData);
      } else {
        const contextData = await fetchAllContextData(userId);
        parsedData = await parseInvitationText(messageText, contextData);
      }

      let docRef;
      let successMsg = '';
      
      const payloadType = parsedData.type;
      const payloadData = parsedData.data;

      // Find SKP info for response
      const skpInfo = payloadData.skpId
        ? `\n*Butir SKP Terkait:* SKP #${payloadData.skpId} - ${skpData.find(s => s.id === payloadData.skpId)?.nama || ''}`
        : '\n*Butir SKP Terkait:* Tidak ada SKP BPS yang cocok';

      if (payloadType === 'CREATE_JADWAL' || payloadType === 'JADWAL') {
        const scheduleDoc = {
          userId: userId,
          judul: payloadData.judul || '',
          tanggal: payloadData.tanggal || '',
          waktu: payloadData.waktu || '09:00',
          waktuSelesai: payloadData.waktuSelesai || '',
          lokasi: payloadData.lokasi || '',
          deskripsi: payloadData.deskripsi || '',
          kategori: payloadData.kategori || 'Lainnya',
          urgensi: payloadData.urgensi || 'Sedang',
          skpId: payloadData.skpId ? Number(payloadData.skpId) : null,
          reminders: ['1 Jam Sebelum', '5 Menit Sebelum'],
          sentReminders: [],
          isSelesai: false,
          createdAt: serverTimestamp(),
        };
        if (fileId) scheduleDoc.telegramFileId = fileId;
        docRef = await addDoc(collection(db, 'schedule'), scheduleDoc);

        successMsg = `📅 *Agenda Berhasil Ditambahkan!*\n` +
                     `*Acara:* ${payloadData.judul}\n` +
                     `*Tanggal:* ${payloadData.tanggal}\n` +
                     `*Waktu:* ${payloadData.waktu || '09:00'}` +
                     (payloadData.lokasi ? `\n*Tempat:* ${payloadData.lokasi}` : '') +
                     `\n${skpInfo}`;
        if (fileId) {
          successMsg += `\n📎 _Berkas lampiran terdeteksi dan akan disinkronisasikan ke Google Drive Anda._`;
        }
      } 
      else if (payloadType === 'UPDATE_JADWAL') {
        if (!payloadData.id) throw new Error("ID Jadwal tidak ditemukan untuk diupdate.");
        const targetRef = doc(db, 'schedule', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("Jadwal tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik jadwal ini.");
        
        await updateDoc(targetRef, payloadData);
        successMsg = `✅ *Jadwal Diperbarui!*\nJadwal "${payloadData.judul || payloadData.id}" berhasil disesuaikan.`;
      }
      else if (payloadType === 'DELETE_JADWAL') {
        if (!payloadData.id) throw new Error("ID Jadwal tidak ditemukan untuk dihapus.");
        const targetRef = doc(db, 'schedule', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("Jadwal tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik jadwal ini.");

        await deleteDoc(targetRef);
        successMsg = `🗑️ *Jadwal Dihapus!*\nJadwal dengan ID tersebut berhasil dihapus.`;
      }
      else if (payloadType === 'CREATE_CKP' || payloadType === 'CKP') {
        const ckpDoc = {
          userId: userId,
          tanggal: payloadData.tanggal || '',
          waktuMulai: payloadData.waktuMulai || '08:00',
          waktuSelesai: payloadData.waktuSelesai || '16:00',
          rincian: payloadData.rincian || '',
          kuantitas: payloadData.kuantitas || 1,
          satuan: payloadData.satuan || 'Kegiatan',
          timKerja: payloadData.timKerja || 'Subbagian Umum',
          skpId: payloadData.skpId ? String(payloadData.skpId) : '',
          createdAt: serverTimestamp(),
        };
        if (fileId) ckpDoc.telegramFileId = fileId;
        docRef = await addDoc(collection(db, 'ckp'), ckpDoc);

        successMsg = `✅ *Laporan CKP Ditambahkan!*\n` +
                     `*Kegiatan:* ${payloadData.rincian}\n` +
                     `*Output:* ${payloadData.kuantitas} ${payloadData.satuan}` +
                     `\n${skpInfo}`;
      }
      else if (payloadType === 'UPDATE_CKP') {
        if (!payloadData.id) throw new Error("ID CKP tidak ditemukan untuk diupdate.");
        const targetRef = doc(db, 'ckp', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("CKP tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik catatan CKP ini.");

        await updateDoc(targetRef, payloadData);
        successMsg = `✅ *CKP Diperbarui!*\nCatatan CKP berhasil disesuaikan.`;
      }
      else if (payloadType === 'DELETE_CKP') {
        if (!payloadData.id) throw new Error("ID CKP tidak ditemukan untuk dihapus.");
        const targetRef = doc(db, 'ckp', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("CKP tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik catatan CKP ini.");

        await deleteDoc(targetRef);
        successMsg = `🗑️ *CKP Dihapus!*\nCatatan CKP berhasil dihapus.`;
      }
      else if (payloadType === 'CREATE_TASK') {
        const taskDoc = {
          userId: userId,
          judul: payloadData.judul || '',
          deskripsi: payloadData.deskripsi || '',
          peran: payloadData.peran || 'admin',
          skpId: payloadData.skpId || 1,
          urgensi: payloadData.urgensi || 'Sedang',
          status: 'todo',
          checklist: [],
          createdAt: serverTimestamp()
        };
        if (fileId) taskDoc.telegramFileId = fileId;
        docRef = await addDoc(collection(db, 'tasks'), taskDoc);
        
        successMsg = `📌 *Tugas Baru Kanban*\n` +
                     `*Judul:* ${payloadData.judul}` +
                     `\n${skpInfo}`;
        if (fileId) {
          successMsg += `\n📎 _Berkas lampiran terdeteksi dan akan disinkronisasikan ke Google Drive Anda._`;
        }
      }
      else if (payloadType === 'UPDATE_TASK') {
        if (!payloadData.id) throw new Error("ID Tugas tidak ditemukan.");
        const targetRef = doc(db, 'tasks', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("Tugas tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik tugas ini.");

        await updateDoc(targetRef, payloadData);
        successMsg = `✅ *Tugas Diperbarui!*\nPerubahan tugas berhasil disimpan.`;
      }
      else if (payloadType === 'DELETE_TASK') {
        if (!payloadData.id) throw new Error("ID Tugas tidak ditemukan.");
        const targetRef = doc(db, 'tasks', payloadData.id);
        const snap = await getDoc(targetRef);
        if (!snap.exists()) throw new Error("Tugas tidak ditemukan.");
        if (snap.data().userId !== userId) throw new Error("Akses ditolak: Anda bukan pemilik tugas ini.");

        await deleteDoc(targetRef);
        successMsg = `🗑️ *Tugas Dihapus!*\nTugas berhasil dihapus dari Papan Kanban.`;
      }
      else if (payloadType === 'REPLY_TEXT') {
        successMsg = payloadData.replyMessage || "Pesan diterima.";
      }
      else {
        throw new Error('Tipe instruksi tidak dikenali oleh AI.');
      }

      await sendTelegramMessage(token, chatId, successMsg);
      return NextResponse.json({ success: true });

    } catch (error) {
      console.error('Error handling Telegram message:', error);
      await sendTelegramMessage(
        token, 
        chatId, 
        `Gagal menganalisis informasi kegiatan. Terjadi kesalahan:\n_${error.message}_`
      );
      return NextResponse.json({ success: false, error: error.message });
    }
  }

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

// Fetch all existing data to provide as context to AI
async function fetchAllContextData(userId) {
  try {
    const contextData = {
      tasks: [],
      schedules: [],
      ckp: []
    };
    
    const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('userId', '==', userId)));
    tasksSnap.forEach(doc => contextData.tasks.push({ id: doc.id, ...doc.data() }));

    const schedSnap = await getDocs(query(collection(db, 'schedule'), where('userId', '==', userId)));
    schedSnap.forEach(doc => contextData.schedules.push({ id: doc.id, ...doc.data() }));

    const ckpSnap = await getDocs(query(collection(db, 'ckp'), where('userId', '==', userId)));
    ckpSnap.forEach(doc => contextData.ckp.push({ id: doc.id, ...doc.data() }));

    return contextData;
  } catch(e) {
    console.error("Failed fetching context data for Telegram:", e);
    return null;
  }
}
