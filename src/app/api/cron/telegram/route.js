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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
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
          type: 'schedule',
          docId: d.id,
          reminderLabel: triggeredReminder,
          chatIds: destChatIds,
          msg: `⏰ *Pengingat Jadwal: ${triggeredReminder}*\n\n*Judul:* ${data.judul}\n*Kategori:* ${data.kategori}\n*Waktu:* ${data.tanggal} ${data.waktu}`
        });
      }
    }

    // --- TASK REMINDERS ---
    const tasksRef = collection(db, 'tasks');
    const tasksSnapshot = await getDocs(tasksRef);

    for (const d of tasksSnapshot.docs) {
      const data = d.data();
      if (data.status === 'done') continue; // Skip completed tasks
      if (!data.dueDate) continue; // Skip tasks without due date
      if (!Array.isArray(data.reminders) || data.reminders.length === 0) continue;

      // Determine destination chatIds
      let destChatIds = [];
      if (data.userId && userIdToChatIds[data.userId]) {
        destChatIds = [...userIdToChatIds[data.userId]];
      }
      if (queryChatId) {
        if (!data.userId || destChatIds.includes(queryChatId)) {
          if (!destChatIds.includes(queryChatId)) {
            destChatIds.push(queryChatId);
          }
        }
      }
      if (destChatIds.length === 0) continue;

      const sentReminders = Array.isArray(data.sentReminders) ? data.sentReminders : [];
      
      const parts = data.dueDate.split('-');
      const dueStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

      // We only process future or today's deadlines
      if (diffDays < 0) continue;

      let triggeredReminder = null;
      data.reminders.forEach(r => {
        if (sentReminders.includes(r)) return; // Already sent

        if (r === 'Hari H' && diffDays === 0) triggeredReminder = r;
        else if (r === 'H-1' && diffDays === 1) triggeredReminder = r;
        else if (r === 'H-3' && diffDays === 3) triggeredReminder = r;
      });

      if (triggeredReminder) {
        messagesToSend.push({
          type: 'task',
          docId: d.id,
          reminderLabel: triggeredReminder,
          chatIds: destChatIds,
          msg: `⏰ *Pengingat Tugas: ${triggeredReminder}*\n\n*Tugas:* ${data.judul}\n*Deskripsi:* ${data.deskripsi || '-'}\n*Tenggat:* ${data.dueDate}`
        });
      }
    }

    // --- TRAINING PROGRAM PHASE REMINDERS ---
    const trainingRef = collection(db, 'training_programs');
    const trainingSnapshot = await getDocs(trainingRef);
    const trainingPhasesUpdates = [];

    for (const d of trainingSnapshot.docs) {
      const data = d.data();
      if (!Array.isArray(data.phases) || data.phases.length === 0) continue;

      // Determine destination chatIds
      let destChatIds = [];
      if (data.userId && userIdToChatIds[data.userId]) {
        destChatIds = [...userIdToChatIds[data.userId]];
      }
      if (queryChatId) {
        if (!data.userId || destChatIds.includes(queryChatId)) {
          if (!destChatIds.includes(queryChatId)) {
            destChatIds.push(queryChatId);
          }
        }
      }
      if (destChatIds.length === 0) continue;

      let updatedPhases = [...data.phases];
      let docNeedsUpdate = false;

      updatedPhases = updatedPhases.map(phase => {
        if (!phase.startDate || !phase.endDate) return phase;

        const sentReminders = Array.isArray(phase.sentReminders) ? phase.sentReminders : [];
        
        const startParts = phase.startDate.split('-');
        const startStart = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
        const diffDaysStart = Math.round((startStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

        const endParts = phase.endDate.split('-');
        const endStart = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
        const diffDaysEnd = Math.round((endStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

        let triggerType = null;
        let triggerLabel = null;

        // Check if start is near: H-1 or H-3
        if (diffDaysStart === 1 && !sentReminders.includes('start-H-1')) {
          triggerType = 'start';
          triggerLabel = 'start-H-1';
        } else if (diffDaysStart === 3 && !sentReminders.includes('start-H-3')) {
          triggerType = 'start';
          triggerLabel = 'start-H-3';
        }
        // Check if end is near: H-1 or H-3
        else if (diffDaysEnd === 1 && !sentReminders.includes('end-H-1')) {
          triggerType = 'end';
          triggerLabel = 'end-H-1';
        } else if (diffDaysEnd === 3 && !sentReminders.includes('end-H-3')) {
          triggerType = 'end';
          triggerLabel = 'end-H-3';
        }

        if (triggerLabel) {
          docNeedsUpdate = true;
          const labelClean = triggerLabel.replace('start-', 'Mulai ').replace('end-', 'Selesai ');
          const msg = triggerType === 'start' 
            ? `⏰ *Pengingat Pelatihan: Fase Baru Dimulai (${labelClean.replace('Mulai ', '')})*\n\n*Fase:* ${phase.name}\n*Mulai:* ${phase.startDate}\n*Platform:* ${phase.platform || '-'}\n*Keterangan:* ${phase.notes || '-'}`
            : `⏰ *Pengingat Pelatihan: Fase Berakhir (${labelClean.replace('Selesai ', '')})*\n\n*Fase:* ${phase.name}\n*Tenggat Selesai:* ${phase.endDate}\n*Aplikasi:* ${phase.platform || '-'}\n\n⚠️ Jangan lupa menyelesaikan seluruh checklist kegiatan dan laporan!`;

          messagesToSend.push({
            type: 'training_phase',
            docId: d.id,
            phaseId: phase.id,
            reminderLabel: triggerLabel,
            chatIds: destChatIds,
            msg: msg
          });

          return {
            ...phase,
            sentReminders: [...sentReminders, triggerLabel]
          };
        }

        return phase;
      });

      if (docNeedsUpdate) {
        trainingPhasesUpdates.push({
          docId: d.id,
          phases: updatedPhases
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
          results.push(`Sent ${m.reminderLabel} (${m.type}) to ${targetChatId} for doc ${m.docId}`);
        } else {
          results.push(`Failed to send to ${targetChatId} for doc ${m.docId}`);
        }
      }

      if (sentAny) {
        // Mark as sent in Firestore
        if (m.type === 'schedule') {
          const docRef = doc(db, 'schedule', m.docId);
          await updateDoc(docRef, {
            sentReminders: arrayUnion(m.reminderLabel)
          });
        } else if (m.type === 'task') {
          const docRef = doc(db, 'tasks', m.docId);
          await updateDoc(docRef, {
            sentReminders: arrayUnion(m.reminderLabel)
          });
        }
      }
    }

    // Now update training programs
    for (const updateItem of trainingPhasesUpdates) {
      const hasSentAnyForThisDoc = messagesToSend.some(m => m.type === 'training_phase' && m.docId === updateItem.docId);
      if (hasSentAnyForThisDoc) {
        const docRef = doc(db, 'training_programs', updateItem.docId);
        await updateDoc(docRef, {
          phases: updateItem.phases
        });
        results.push(`Updated phases reminders for training program ${updateItem.docId}`);
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
