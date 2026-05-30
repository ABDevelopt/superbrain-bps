import { NextResponse } from 'next/server';
import { skpData } from '@/data/skpData';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request) {
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array.' }, { status: 400 });
    }

    const skpContext = skpData
      .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
      .join('\n');

    const systemInstruction = `
Anda adalah SuperBrain AI, asisten produktivitas untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah berdiskusi, melakukan brainstorming, dan membantu pengguna merencanakan pekerjaan.

Berikut adalah daftar 29 Sasaran Kinerja Pegawai (SKP) BPS sebagai referensi pencocokan kegiatan:
${skpContext}

Jika pengguna meminta untuk membuat papan tugas, daftar pekerjaan, atau checklist pekerjaan, 
GUNAKAN fungsi (tool) 'create_task' untuk secara otomatis membuatkannya ke dalam sistem pengguna.
Saat memanggil 'create_task', berikan judul tugas, rincian, perkirakan 'peran' (admin, sosial, ipjkd, harga), pilih 'skpId' yang relevan (1-29), dan susun 'checklist' langkah-langkah detail secara komprehensif.
`;

    // Map messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

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
              description: "Membuat tugas atau papan kerja baru ke dalam sistem aplikasi secara otomatis berdasarkan hasil brainstorming.",
              parameters: {
                type: "OBJECT",
                properties: {
                  judul: {
                    type: "STRING",
                    description: "Judul tugas yang singkat dan jelas."
                  },
                  deskripsi: {
                    type: "STRING",
                    description: "Deskripsi rinci mengenai tujuan dan latar belakang tugas."
                  },
                  peran: {
                    type: "STRING",
                    description: "Pilih divisi/peran yang paling cocok.",
                    enum: ["admin", "sosial", "ipjkd", "harga"]
                  },
                  skpId: {
                    type: "INTEGER",
                    description: "Pilih ID SKP yang paling cocok secara semantik (1-29)."
                  },
                  checklist: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "Daftar langkah-langkah konkret atau sub-tugas yang perlu diselesaikan."
                  }
                },
                required: ["judul", "deskripsi", "peran", "skpId", "checklist"]
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
      return NextResponse.json({
        type: 'function_call',
        functionName: functionCall.name,
        arguments: functionCall.args,
        message: "Saya telah membuatkan papan tugas tersebut ke dalam sistem Anda."
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
