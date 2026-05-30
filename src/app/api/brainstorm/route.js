import { NextResponse } from 'next/server';
import { skpData } from '@/data/skpData';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request) {
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages, currentPath } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array.' }, { status: 400 });
    }

    const skpContext = skpData
      .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
      .join('\n');

    const systemInstruction = `
Anda adalah SuperBrain AI, asisten produktivitas cerdas untuk pegawai Badan Pusat Statistik (BPS).
Tugas Anda adalah berdiskusi, menganalisis lampiran file (jika ada), dan membantu pengguna merencanakan pekerjaan, mencatat agenda, atau melaporkan capaian.

Pengguna saat ini berada di halaman: ${currentPath || 'Dashboard'}

Berikut adalah daftar 29 Sasaran Kinerja Pegawai (SKP) BPS sebagai referensi pencocokan kegiatan:
${skpContext}

Anda memiliki 3 FUNGSI (TOOLS) utama. Panggil fungsi yang paling tepat sesuai dengan intensi pengguna:

1. 'create_task': Gunakan fungsi ini jika pengguna merencanakan proyek, memecah langkah kerja menjadi checklist, atau meminta dibuatkan kartu tugas di Papan Kanban.
2. 'create_schedule': Gunakan fungsi ini jika pengguna menyebutkan suatu acara, pertemuan, batas waktu (deadline), atau kegiatan di masa depan yang perlu diingat (misalnya "rapat besok jam 10", "batas pengumpulan jumat").
3. 'create_ckp': Gunakan fungsi ini jika pengguna melaporkan kegiatan yang SUDAH SELESAI hari ini atau di masa lalu, dan menyebutkan kuantitas/hasil (misalnya "hari ini saya mengentri 5 dokumen", "saya telah selesai merekap data").

Jika pengguna melampirkan file (gambar/PDF), bacalah isi file tersebut untuk mengekstrak detail (misal: baca undangan rapat dari gambar PDF lalu buat jadwalnya).
`;

    // Filter out any leading assistant messages (Gemini API requires conversation to start with user)
    const firstUserIndex = messages.findIndex(m => m.role === 'user');
    const validMessages = firstUserIndex !== -1 ? messages.slice(firstUserIndex) : messages;

    // Map messages to Gemini format
    const geminiMessages = validMessages.map(msg => {
      const parts = [{ text: msg.content }];
      
      // If user uploaded a file, attach it as inlineData
      if (msg.inlineData) {
        parts.push({
          inlineData: {
            mimeType: msg.inlineData.mimeType,
            data: msg.inlineData.data
          }
        });
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: parts,
      };
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: geminiMessages,
      tools: [
        {
          functionDeclarations: [
            {
              name: "create_task",
              description: "Membuat tugas atau papan kerja baru ke dalam sistem Papan Kanban.",
              parameters: {
                type: "OBJECT",
                properties: {
                  judul: { type: "STRING", description: "Judul tugas yang singkat dan jelas." },
                  deskripsi: { type: "STRING", description: "Deskripsi rinci mengenai tujuan tugas." },
                  peran: { type: "STRING", enum: ["admin", "sosial", "ipjkd", "harga"] },
                  skpId: { type: "INTEGER", description: "ID SKP yang paling relevan (1-29)." },
                  checklist: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Daftar langkah-langkah konkret atau sub-tugas."
                  }
                },
                required: ["judul", "deskripsi", "peran", "skpId", "checklist"]
              }
            },
            {
              name: "create_schedule",
              description: "Membuat entri jadwal, agenda, rapat, atau tenggat waktu ke dalam sistem Kalender.",
              parameters: {
                type: "OBJECT",
                properties: {
                  judul: { type: "STRING", description: "Nama agenda/rapat/tenggat waktu." },
                  tanggal: { type: "STRING", description: "Tanggal agenda dalam format YYYY-MM-DD." },
                  waktu: { type: "STRING", description: "Waktu mulai dalam format HH:MM (contoh: 09:00)." },
                  kategori: { type: "STRING", enum: ["Deadline", "Rapat", "Survei", "Lainnya"] },
                  skpId: { type: "INTEGER", description: "ID SKP yang relevan (1-29)." },
                  reminder: { type: "STRING", enum: ["H-1", "H-3", "H-7", "Tidak ada"] }
                },
                required: ["judul", "tanggal", "waktu", "kategori", "skpId"]
              }
            },
            {
              name: "create_ckp",
              description: "Mencatat laporan Capaian Kinerja Pegawai (CKP) Harian untuk pekerjaan yang sudah selesai.",
              parameters: {
                type: "OBJECT",
                properties: {
                  tanggal: { type: "STRING", description: "Tanggal kegiatan dilakukan (YYYY-MM-DD)." },
                  waktuMulai: { type: "STRING", description: "Waktu mulai (HH:MM)." },
                  waktuSelesai: { type: "STRING", description: "Waktu selesai (HH:MM)." },
                  skpId: { type: "INTEGER", description: "ID SKP yang relevan (1-29)." },
                  rincian: { type: "STRING", description: "Penjelasan lengkap kegiatan yang dilakukan." },
                  outputKuantitas: { type: "INTEGER", description: "Jumlah output yang dihasilkan." },
                  satuan: { type: "STRING", enum: ["Kegiatan", "Lembar", "File", "Dokumen", "Orang", "Lainnya"] },
                  tim: { type: "STRING", enum: ["Subbagian Umum", "Tim IPJKD & DLS", "Tim Statistik Sosial", "Tim Statistik Harga & Sensus Ekonomi"] }
                },
                required: ["tanggal", "waktuMulai", "waktuSelesai", "skpId", "rincian", "outputKuantitas", "satuan", "tim"]
              }
            }
          ]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', errorText);
      return NextResponse.json({ error: 'Gagal menghubungi Gemini API' }, { status: response.status });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Check if the model decided to call a function
    const parts = candidate.content?.parts || [];
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart) {
      const functionCall = functionCallPart.functionCall;
      
      let messageSuffix = '';
      if (functionCall.name === 'create_task') messageSuffix = 'Saya telah membuatkan papan tugas tersebut.';
      else if (functionCall.name === 'create_schedule') messageSuffix = 'Jadwal telah ditambahkan ke Kalender Anda.';
      else if (functionCall.name === 'create_ckp') messageSuffix = 'Laporan kegiatan telah dicatat di CKP Harian.';

      return NextResponse.json({
        type: 'function_call',
        functionName: functionCall.name,
        arguments: functionCall.args,
        message: messageSuffix
      });
    }

    // Otherwise, return normal text response
    const textPart = parts.find(p => p.text);
    return NextResponse.json({
      type: 'text',
      message: textPart ? textPart.text : "..."
    });

  } catch (error) {
    console.error('Brainstorm API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
