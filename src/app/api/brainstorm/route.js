import { NextResponse } from 'next/server';
import { skpData } from '@/data/skpData';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request) {
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages, currentPath, pageData, globalStats } = body;

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

Berikut adalah ringkasan lintas-modul (Global Stats) pengguna saat ini:
${globalStats ? JSON.stringify(globalStats, null, 2) : 'Data global tidak tersedia.'}
Gunakan informasi di atas jika pengguna bertanya tentang ringkasan atau status pekerjaannya secara keseluruhan.

Berikut adalah daftar 29 Sasaran Kinerja Pegawai (SKP) BPS sebagai referensi pencocokan kegiatan:
${skpContext}

Berikut adalah data (records) yang saat ini ada di halaman pengguna:
${pageData ? JSON.stringify(pageData, null, 2) : 'Tidak ada data spesifik di halaman ini.'}

Anda memiliki beberapa FUNGSI (TOOLS) utama. Panggil fungsi yang paling tepat sesuai dengan intensi pengguna:

1. 'create_task', 'update_task', 'delete_task': Untuk manipulasi tugas (Papan Kanban).
2. 'create_schedule', 'update_schedule', 'delete_schedule': Untuk manipulasi agenda/kalender.
3. 'create_ckp', 'update_ckp', 'delete_ckp': Untuk manipulasi laporan harian (CKP).

Ketika mengedit (update) atau menghapus (delete) sesuatu, WAJIB merujuk pada 'id' record yang sesuai dengan "data yang saat ini ada di halaman pengguna" (jika tersedia).
Jika pengguna melampirkan file (gambar/PDF), bacalah isi file tersebut untuk mengekstrak detail (misal: baca undangan rapat dari gambar PDF lalu buat jadwalnya). Selalu ekstrak detail seperti judul, waktu (jam & tanggal), deskripsi, dan tingkat urgensi (Tinggi/Sedang/Rendah) dengan saksama.
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

    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.5-flash',
      'gemini-1.0-pro'
    ];

    let lastError = null;
    let lastStatus = 500;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
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
                    urgensi: { type: "STRING", enum: ["Tinggi", "Sedang", "Rendah"], description: "Tingkat urgensi atau prioritas tugas." },
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
                name: "update_task",
                description: "Mengedit tugas yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID tugas yang akan diedit." },
                    judul: { type: "STRING", description: "Judul tugas baru." },
                    deskripsi: { type: "STRING", description: "Deskripsi baru." },
                    status: { type: "STRING", enum: ["todo", "in_progress", "done"], description: "Status tugas" },
                    urgensi: { type: "STRING", enum: ["Tinggi", "Sedang", "Rendah"] }
                  },
                  required: ["id"]
                }
              },
              {
                name: "delete_task",
                description: "Menghapus tugas yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID tugas yang akan dihapus." }
                  },
                  required: ["id"]
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
                    kategori: { type: "STRING", enum: ["Deadline", "Rapat", "Survei", "Pelatihan", "Lainnya"] },
                    skpId: { type: "INTEGER", description: "ID SKP yang relevan (1-29)." },
                    reminder: { type: "STRING", enum: ["H-1", "H-3", "H-7", "1 Jam Sebelum", "5 Menit Sebelum", "Tidak ada"] }
                  },
                  required: ["judul", "tanggal", "waktu", "kategori", "skpId"]
                }
              },
              {
                name: "update_schedule",
                description: "Mengedit jadwal atau agenda yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID jadwal yang akan diedit." },
                    judul: { type: "STRING" },
                    tanggal: { type: "STRING" },
                    waktu: { type: "STRING" },
                    kategori: { type: "STRING" },
                    reminder: { type: "STRING" }
                  },
                  required: ["id"]
                }
              },
              {
                name: "delete_schedule",
                description: "Menghapus jadwal yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID jadwal yang akan dihapus." }
                  },
                  required: ["id"]
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
              },
              {
                name: "update_ckp",
                description: "Mengedit data CKP yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID CKP yang akan diedit." },
                    rincian: { type: "STRING" },
                    outputKuantitas: { type: "INTEGER" }
                  },
                  required: ["id"]
                }
              },
              {
                name: "delete_ckp",
                description: "Menghapus laporan CKP yang sudah ada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "ID CKP yang akan dihapus." }
                  },
                  required: ["id"]
                }
              }
            ]
          }
        ]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          lastError = await response.text();
          lastStatus = response.status;
          console.warn(`[Gemini] Model ${model} failed with ${lastStatus}:`, lastError);
          if (lastStatus === 400) break; // Bad request means payload is invalid, no point trying other models
          continue; // Try next model
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate) {
          console.warn(`[Gemini] Model ${model} returned empty candidates.`);
          lastError = 'No response candidates';
          continue;
        }

        // Check if the model decided to call a function
        const parts = candidate.content?.parts || [];
        const functionCallPart = parts.find(p => p.functionCall);

        if (functionCallPart) {
          const functionCall = functionCallPart.functionCall;
          
          let messageSuffix = '';
          if (functionCall.name === 'create_task') messageSuffix = 'Saya telah membuatkan tugas tersebut.';
          else if (functionCall.name === 'update_task') messageSuffix = 'Saya telah mengupdate tugas tersebut.';
          else if (functionCall.name === 'delete_task') messageSuffix = 'Tugas telah dihapus.';
          else if (functionCall.name === 'create_schedule') messageSuffix = 'Jadwal telah ditambahkan ke Kalender Anda.';
          else if (functionCall.name === 'update_schedule') messageSuffix = 'Jadwal telah diperbarui.';
          else if (functionCall.name === 'delete_schedule') messageSuffix = 'Jadwal telah dihapus.';
          else if (functionCall.name === 'create_ckp') messageSuffix = 'Laporan kegiatan telah dicatat.';
          else if (functionCall.name === 'update_ckp') messageSuffix = 'Laporan CKP telah diperbarui.';
          else if (functionCall.name === 'delete_ckp') messageSuffix = 'Laporan CKP telah dihapus.';

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
      } catch (err) {
        console.error(`[Gemini] Fetch error for model ${model}:`, err);
        lastError = err.message;
        lastStatus = 500;
        continue;
      }
    }

    // If all models failed
    let errMsg = 'Gagal menghubungi Gemini API setelah mencoba berbagai model cadangan.';
    if (lastStatus === 429) {
      errMsg = 'Batas limit (kuota) penggunaan AI telah tercapai di semua model. Silakan tunggu beberapa saat lagi.';
    } else if (lastStatus === 400) {
      errMsg = 'Format pesan ditolak oleh AI.';
    }
    return NextResponse.json({ error: errMsg }, { status: lastStatus });

  } catch (error) {
    console.error('Brainstorm API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
