import { skpData } from '@/data/skpData';

const skpContext = skpData
  .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
  .join('\n');

const systemPrompt = `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membaca dan menganalisis berkas/teks yang diberikan, lalu mengekstrak informasinya.

Pertama, tentukan APAKAH dokumen/teks ini adalah:
1. "JADWAL": Kegiatan/Acara yang AKAN DATANG (misal: Surat Undangan, Pemberitahuan Rapat).
2. "CKP": Bukti kegiatan yang SUDAH SELESAI/LAPORAN (misal: Sertifikat, Notula, Laporan Hasil, Dokumentasi, atau pesan yang menyatakan pekerjaan telah diselesaikan).

Kedua, ekstrak data ke dalam format JSON berikut:
{
  "type": "JADWAL" atau "CKP",
  "data": { ... } // bergantung pada type
}

Jika type "JADWAL", field dalam "data":
- judul: Nama kegiatan (string)
- tanggal: Tanggal pelaksanaan YYYY-MM-DD (string)
- waktu: Waktu mulai HH:MM (string, default "09:00")
- waktuSelesai: Waktu selesai HH:MM (string, default "")
- lokasi: Tempat/tautan (string)
- deskripsi: Ringkasan tujuan/pengundang (string)
- skpId: ID SKP yang cocok (integer 1-29 atau null)
- kategori: "Deadline", "Rapat", "Survei", "Pelatihan", "Lainnya"
- urgensi: "Rendah", "Sedang", "Tinggi", "Kritis"

Jika type "CKP", field dalam "data":
- tanggal: Tanggal pelaksanaan/selesai YYYY-MM-DD (string)
- waktuMulai: Waktu mulai HH:MM (string, default "08:00")
- waktuSelesai: Waktu selesai HH:MM (string, default "16:00")
- skpId: ID SKP yang cocok (integer 1-29 atau null)
- rincian: Rincian kegiatan/pekerjaan yang dilakukan (string)
- kuantitas: Jumlah output/hasil (integer, default 1)
- satuan: "Kegiatan", "Lembar", "File", "Dokumen", "Orang", "Lainnya"
- timKerja: "Subbagian Umum", "Tim IPJKD & DLS", "Tim Statistik Sosial", "Tim Statistik Harga & Sensus Ekonomi"

Berikut adalah daftar 29 SKP BPS sebagai referensi pencocokan kegiatan:
${skpContext}

PENTING:
- Pastikan respon HANYA berupa JSON valid sesuai schema bersarang di atas.
- Jangan tambahkan markdown \`\`\`json.
- Jangan gunakan emoji.
`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['JADWAL', 'CKP'] },
    data: {
      type: 'OBJECT',
      properties: {
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

export async function parseInvitation(fileBuffer, mimeType) {
  const base64Data = fileBuffer.toString('base64');
  return callGemini([
    {
      parts: [
        { text: systemPrompt },
        { inlineData: { mimeType, data: base64Data } },
      ],
    },
  ]);
}

export async function parseInvitationText(textContent) {
  return callGemini([
    {
      parts: [
        { text: systemPrompt + '\n\nBerikut teksnya:\n"' + textContent + '"' }
      ],
    },
  ]);
}
