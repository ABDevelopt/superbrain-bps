import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';

export async function GET(request) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Token is missing' }, { status: 500 });
    }

    // Since this is a cron job, we need the chat ID to send to. 
    // Usually, we'd read it from a users collection, but we only have localStorage for the current user.
    // For a single-user app without a real user table, we'll use a hack:
    // We'll require the chat_id to be passed as a query param from the cron-job.org URL
    // e.g., /api/cron/telegram?chatId=123456789
    
    const url = new URL(request.url);
    const queryChatId = url.searchParams.get('chatId');

    // Retrieve all telegram mappings and map userId -> array of chatIds
    const mappingsSnap = await getDocs(collection(db, 'telegram_mappings'));
    const userIdToChatIds = {};
    mappingsSnap.forEach(d => {
      const data = d.data();
      if (data.userId) {
        if (!userIdToChatIds[data.userId]) {
          userIdToChatIds[data.userId] = [];
        }
        userIdToChatIds[data.userId].push(d.id);
      }
    });

    const now = new Date();
    
    // Fetch all schedules
    const scheduleRef = collection(db, 'schedule');
    const snapshot = await getDocs(scheduleRef);
    
    const messagesToSend = [];

    for (const d of snapshot.docs) {
      const data = d.data();
      if (!data.tanggal || !data.waktu) continue;
      if (!Array.isArray(data.reminders) || data.reminders.length === 0) continue;
      
      // Determine destination chatIds for this event
      let destChatIds = [];
      if (data.userId && userIdToChatIds[data.userId]) {
        destChatIds = [...userIdToChatIds[data.userId]];
      }
      
      // Fallback for query param (backward compatibility or testing)
      if (queryChatId) {
        if (!data.userId || destChatIds.includes(queryChatId)) {
          if (!destChatIds.includes(queryChatId)) {
            destChatIds.push(queryChatId);
          }
        }
      }

      if (destChatIds.length === 0) continue; // No chat IDs mapped for this event
      
      const sentReminders = Array.isArray(data.sentReminders) ? data.sentReminders : [];
      const eventTime = new Date(`${data.tanggal}T${data.waktu}:00`);
      
      // Calculate diff in milliseconds
      const diffMs = eventTime.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 1000 / 60);

      // We only process events in the future (or very recently started)
      if (diffMins < -60) continue; // Skip events that are > 1 hour in the past

      let triggeredReminder = null;

      data.reminders.forEach(r => {
        if (sentReminders.includes(r)) return; // Already sent

        let triggerMs = null;
        if (r === '5 Menit Sebelum') triggerMs = 5 * 60 * 1000;
        else if (r === '1 Jam Sebelum') triggerMs = 60 * 60 * 1000;
        else if (r === 'H-1') triggerMs = 24 * 60 * 60 * 1000;
        else if (r === 'H-3') triggerMs = 3 * 24 * 60 * 60 * 1000;

        // If the remaining time is less than or equal to the trigger time, AND we haven't missed it by too much (e.g. max 1 hour delay)
        if (triggerMs !== null) {
          if (diffMs <= triggerMs && diffMs > triggerMs - (60 * 60 * 1000)) {
            triggeredReminder = r;
          }
        }
      });

      if (triggeredReminder) {
        messagesToSend.push({
          docId: d.id,
          reminderLabel: triggeredReminder,
          chatIds: destChatIds,
          msg: `⏰ *Pengingat Jadwal: ${triggeredReminder}*\n\n*Judul:* ${data.judul}\n*Kategori:* ${data.kategori}\n*Waktu:* ${data.tanggal} ${data.waktu}`
        });
      }
    }

    // Send messages and update Firestore
    const results = [];
    for (const m of messagesToSend) {
      let sentAny = false;
      for (const targetChatId of m.chatIds) {
        const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const res = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: targetChatId, text: m.msg, parse_mode: 'Markdown' }),
        });
        
        if (res.ok) {
          sentAny = true;
          results.push(`Sent ${m.reminderLabel} to ${targetChatId} for doc ${m.docId}`);
        } else {
          results.push(`Failed to send to ${targetChatId} for doc ${m.docId}`);
        }
      }

      if (sentAny) {
        // Mark as sent in Firestore
        const docRef = doc(db, 'schedule', m.docId);
        await updateDoc(docRef, {
          sentReminders: arrayUnion(m.reminderLabel)
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: messagesToSend.length,
      results 
    });

  } catch (error) {
    console.error('Cron API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
