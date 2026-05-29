import { skpData } from '@/data/skpData';

/**
 * Parses invitation file buffer using Gemini 1.5 Flash multimodal API.
 * @param {Buffer} fileBuffer - The binary buffer of the file.
 * @param {string} mimeType - The file's MIME type (e.g. application/pdf, image/jpeg).
 * @returns {Promise<object>} The structured event object.
 */
export async function parseInvitation(fileBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Kunci API Gemini tidak dikonfigurasi di server. Silakan tambahkan GEMINI_API_KEY di file .env.local Anda.');
  }

  // Convert buffer to base64
  const base64Data = fileBuffer.toString('base64');

  // Build BPS SKP list context
  const skpContext = skpData
    .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
    .join('\n');

  const prompt = `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membaca dan menganalisis berkas surat undangan atau dokumen kegiatan yang terlampir, lalu mengekstrak detail informasi acara.

Berikut adalah daftar 29 Sasaran Kinerja Pegawai (SKP) BPS sebagai referensi pencocokan kegiatan:
${skpContext}

Silakan analisis berkas tersebut dan ekstrak informasi berikut ke dalam format JSON sesuai schema:
- judul: Nama atau judul rapat/kegiatan utama (string, ringkas dan formal).
- tanggal: Tanggal pelaksanaan kegiatan dalam format YYYY-MM-DD (string). Jika terdapat rentang tanggal pelaksanaan, ambil tanggal hari pertama kegiatan dimulai.
- waktu: Waktu mulai kegiatan dalam format HH:MM (24 jam) (string). Jika tidak tertulis waktu mulainya secara spesifik, berikan nilai default "09:00".
- waktuSelesai: Waktu selesai kegiatan dalam format HH:MM (24 jam) (string, opsional). Jika tidak tertulis waktu selesai, berikan string kosong "".
- lokasi: Tempat pelaksanaan kegiatan secara fisik (misal: Aula BPS PPU, Ruang Rapat) atau tautan pertemuan online (misal: Zoom/Google Meet) jika tersedia (string).
- deskripsi: Ringkasan singkat mengenai tujuan kegiatan, agenda pembahasan, dan instansi/panitia pengundang (string).
- skpId: ID SKP yang paling cocok secara semantik dari daftar 29 SKP di atas (integer, 1-29). Silakan pilih ID yang paling sesuai. Jika tidak ada butir SKP yang cocok sama sekali dengan jenis kegiatan tersebut, kosongkan (null).
- kategori: Kategori kegiatan. Harus berupa salah satu dari opsi berikut: "Deadline", "Rapat", "Survei", "Pelatihan", "Lainnya".
- urgensi: Tingkat urgensi atau prioritas kegiatan. Harus berupa salah satu dari opsi berikut: "Rendah", "Sedang", "Tinggi", "Kritis". Secara default gunakan "Sedang" jika tidak ada urgensi khusus.

PENTING:
- Pastikan respon HANYA berupa JSON valid sesuai schema. Jangan menambahkan pembungkus markdown seperti \`\`\`json atau kalimat pengantar lainnya.
- Jangan gunakan emoji atau emoticon apa pun dalam teks hasil ekstraksi (judul, lokasi, deskripsi, dll).
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            judul: { type: 'STRING' },
            tanggal: { type: 'STRING', description: 'Format YYYY-MM-DD' },
            waktu: { type: 'STRING', description: 'Format HH:MM' },
            waktuSelesai: { type: 'STRING', description: 'Format HH:MM, default empty string' },
            lokasi: { type: 'STRING' },
            deskripsi: { type: 'STRING' },
            skpId: { type: 'INTEGER', description: 'Matching SKP ID 1-29, or null' },
            kategori: { type: 'STRING', enum: ['Deadline', 'Rapat', 'Survei', 'Pelatihan', 'Lainnya'] },
            urgensi: { type: 'STRING', enum: ['Rendah', 'Sedang', 'Tinggi', 'Kritis'] },
          },
          required: ['judul', 'tanggal', 'waktu', 'kategori', 'urgensi'],
        },
      },
    }),
  });

  // Retry once on 503 (overloaded) after a brief delay
  if (response.status === 503) {
    console.warn('Gemini API returned 503 (overloaded). Retrying in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              judul: { type: 'STRING' },
              tanggal: { type: 'STRING' },
              waktu: { type: 'STRING' },
              waktuSelesai: { type: 'STRING' },
              lokasi: { type: 'STRING' },
              deskripsi: { type: 'STRING' },
              skpId: { type: 'INTEGER' },
              kategori: { type: 'STRING', enum: ['Deadline', 'Rapat', 'Survei', 'Pelatihan', 'Lainnya'] },
              urgensi: { type: 'STRING', enum: ['Rendah', 'Sedang', 'Tinggi', 'Kritis'] },
            },
            required: ['judul', 'tanggal', 'waktu', 'kategori', 'urgensi'],
          },
        },
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error status:', response.status, 'Response:', errorText);
    if (response.status === 503) {
      throw new Error('Server AI Gemini sedang sibuk (overloaded). Silakan coba lagi dalam beberapa saat.');
    }
    throw new Error(`Gagal menghubungi Gemini API: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Respon Gemini API kosong.');
  }

  let cleanText = rawText.trim();
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to parse Gemini response text:', rawText, err);
    throw new Error('Gagal memproses keluaran AI menjadi JSON yang valid.');
  }
}
