import { skpData } from '@/data/skpData';

const skpContext = skpData
  .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
  .join('\n');

export function getSystemPrompt(contextData = null) {
  let contextString = 'Tidak ada data konteks saat ini.';
  if (contextData) {
    contextString = JSON.stringify(contextData, null, 2);
  }

  return `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membaca dan menganalisis berkas/teks yang diberikan, mengekstrak informasinya, dan memetakannya ke aksi CRUD pada database pengguna, atau sekadar membalas percakapan.

Pertama, pahami data pengguna yang ada saat ini di sistem:
${contextString}

Berikut adalah daftar 29 SKP BPS sebagai referensi pencocokan kegiatan:
${skpContext}

Tentukan APAKAH instruksi/dokumen ini bertujuan untuk:
1. "CREATE_JADWAL", "UPDATE_JADWAL", "DELETE_JADWAL": Untuk menambah/mengedit/menghapus jadwal acara (misal: Surat Undangan, Rapat).
2. "CREATE_CKP", "UPDATE_CKP", "DELETE_CKP": Untuk menambah/mengedit/menghapus laporan hasil kerja harian (CKP).
3. "CREATE_TASK", "UPDATE_TASK", "DELETE_TASK": Untuk menambah/mengedit/menghapus tugas di Papan Kanban.
4. "REPLY_TEXT": Jika pengguna hanya bertanya atau mengobrol biasa tanpa instruksi modifikasi data.

Ekstrak data ke dalam format JSON berikut:
{
  "type": "<SALAHSATU DARI 10 AKSI DI ATAS>",
  "data": { ... } // bergantung pada type
}

Jika type berawalan "UPDATE_" atau "DELETE_", field dalam "data" WAJIB mencantumkan:
- id: ID unik record yang akan diedit/dihapus (string)

Jika type "REPLY_TEXT", field dalam "data" WAJIB mencantumkan:
- replyMessage: Teks balasan Anda untuk pengguna (string)

Field opsional/wajib lainnya dalam "data" (gunakan jika relevan):
Jadwal: judul, tanggal, waktu, waktuSelesai, lokasi, deskripsi, skpId, kategori, urgensi
CKP: tanggal, waktuMulai, waktuSelesai, skpId, rincian, kuantitas, satuan, timKerja
Tugas: judul, deskripsi, peran, skpId, urgensi, status

PENTING:
- Pastikan respon HANYA berupa JSON valid sesuai schema bersarang di atas.
- Jangan tambahkan markdown \`\`\`json.
- Jangan gunakan emoji.
`;
}

  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['CREATE_JADWAL', 'UPDATE_JADWAL', 'DELETE_JADWAL', 'CREATE_CKP', 'UPDATE_CKP', 'DELETE_CKP', 'CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'REPLY_TEXT'] },
    data: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING' },
        replyMessage: { type: 'STRING' },
        judul: { type: 'STRING' },
        tanggal: { type: 'STRING' },
        waktu: { type: 'STRING' },
        waktuSelesai: { type: 'STRING' },
        waktuMulai: { type: 'STRING' },
        lokasi: { type: 'STRING' },
        deskripsi: { type: 'STRING' },
        rincian: { type: 'STRING' },
        kuantitas: { type: 'INTEGER' },
        satuan: { type: 'STRING' },
        timKerja: { type: 'STRING' },
        skpId: { type: 'INTEGER' },
        kategori: { type: 'STRING' },
        urgensi: { type: 'STRING' },
        peran: { type: 'STRING' },
        status: { type: 'STRING' },
      }
    }
  },
  required: ['type', 'data']
};

async function callGemini(contents) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Kunci API Gemini tidak dikonfigurasi di server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const requestBody = {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  };

  let response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 503) {
    console.warn('Gemini API returned 503 (overloaded). Retrying in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Server AI Gemini sedang sibuk (overloaded). Silakan coba lagi dalam beberapa saat.');
    }
    throw new Error(`Gagal menghubungi Gemini API: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Respon Gemini API kosong.');

  let cleanText = rawText.trim();
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    throw new Error('Gagal memproses keluaran AI menjadi JSON yang valid.');
  }
}

export async function parseInvitation(fileBuffer, mimeType, contextData = null) {
  const base64Data = fileBuffer.toString('base64');
  return callGemini([
    {
      parts: [
        { text: getSystemPrompt(contextData) },
        { inlineData: { mimeType, data: base64Data } },
      ],
    },
  ]);
}

export async function parseInvitationText(textContent, contextData = null) {
  return callGemini([
    {
      parts: [
        { text: getSystemPrompt(contextData) + '\n\nBerikut teksnya:\n"' + textContent + '"' }
      ],
    },
  ]);
}
