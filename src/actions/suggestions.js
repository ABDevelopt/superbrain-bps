'use server';

export async function getSmartSuggestionsAction(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di server.');
  }

  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 429) {
          lastError = new Error('Batas penggunaan AI tercapai (429). Silakan tunggu beberapa saat.');
        } else {
          lastError = new Error(`Gagal menghubungi model ${model}: ${response.status}`);
        }
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

      return JSON.parse(cleanText);
    } catch (error) {
      lastError = error;
    }
  }

  console.error('AI Suggestion Error:', lastError);
  throw lastError || new Error('Gagal mendapatkan saran dari seluruh model AI.');
}
