import { NextResponse } from 'next/server';
import { skpData } from '@/data/skpData';

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Kunci API Gemini tidak dikonfigurasi di server. Silakan periksa Environment Variables di Vercel Dashboard.' }, { status: 500 });
  }

  try {
    const { rincian, skpList } = await request.json();

    if (!rincian || rincian.trim() === '') {
      return NextResponse.json({ error: 'Rincian kegiatan kosong.' }, { status: 400 });
    }

    const activeSkpData = skpList && skpList.length > 0 ? skpList : skpData;

    const skpContext = activeSkpData
      .map((item) => `ID: ${item.id}, Nama: "${item.nama}"`)
      .join('\n');

    const systemPrompt = `
Anda adalah asisten kecerdasan buatan untuk Badan Pusat Statistik (BPS).
Tugas Anda adalah membantu pengguna merekomendasikan/mencocokkan rincian kegiatan kerja harian mereka ke salah satu dari ${activeSkpData.length} Sasaran Kinerja Pegawai (SKP) BPS yang paling sesuai.

Berikut adalah daftar ${activeSkpData.length} Sasaran Kinerja Pegawai (SKP) BPS:
${skpContext}

Tugas:
Analisis rincian kegiatan berikut: "${rincian}"
Pilih butir SKP BPS yang paling cocok (ID dari 1 sampai ${activeSkpData.length}). Jika tidak ada butir SKP yang cocok sama sekali, kembalikan skpId: null.
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

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-pro'
    ];

    const requestBody = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    };

    let lastError = null;
    let parsedData = null;

    for (const model of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        let response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (response.status === 503) {
          console.warn(`[Gemini] Model ${model} returned 503. Retrying once...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
        }

        if (!response.ok) {
          const extMsg = await response.text();
          console.warn(`[Gemini] Model ${model} failed: ${response.status}`, extMsg);
          lastError = new Error(`Model ${model} error: ${response.status}`);
          continue;
        }

        const responseData = await response.json();
        const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = new Error('Respon Gemini API kosong.');
          continue;
        }

        let cleanText = rawText.trim();
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        parsedData = JSON.parse(cleanText);
        break;
      } catch (err) {
        console.warn(`[Gemini] Exception on model ${model}:`, err.message);
        lastError = err;
      }
    }

    if (!parsedData) {
      throw lastError || new Error('Gagal mendapatkan rekomendasi SKP dari seluruh model AI.');
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('API SKP Suggestion Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
