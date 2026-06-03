import { NextResponse } from 'next/server';
import { skpData } from '@/data/skpData';

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Kunci API Gemini tidak dikonfigurasi di server. Silakan periksa Environment Variables di Vercel Dashboard.' }, { status: 500 });
  }

  try {
    const { rincian } = await request.json();

    if (!rincian || rincian.trim() === '') {
      return NextResponse.json({ error: 'Rincian kegiatan kosong.' }, { status: 400 });
    }

    const skpContext = skpData
      .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
      .join('\n');

    const systemPrompt = `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membantu pengguna merekomendasikan/mencocokkan rincian kegiatan kerja harian mereka ke salah satu dari 29 Sasaran Kinerja Pegawai (SKP) BPS yang paling sesuai.

Berikut adalah daftar 29 Sasaran Kinerja Pegawai (SKP) BPS:
${skpContext}

Tugas:
Analisis rincian kegiatan berikut: "${rincian}"
Pilih butir SKP BPS yang paling cocok (ID dari 1 sampai 29). Jika tidak ada butir SKP yang cocok sama sekali, kembalikan skpId: null.
Berikan tingkat kepercayaan (confidence) dari 0.0 hingga 1.0, serta alasan singkat (reason) dalam Bahasa Indonesia mengapa SKP ini dipilih.
`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        skpId: { type: 'INTEGER' },
        confidence: { type: 'NUMBER' },
        reason: { type: 'STRING' }
      },
      required: ['skpId', 'confidence', 'reason']
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Respon Gemini API kosong.');

    const parsedData = JSON.parse(rawText.trim());

    return NextResponse.json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('API SKP Suggestion Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
