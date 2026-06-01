'use server';

export async function getSmartSuggestionsAction(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
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
        throw new Error('Batas penggunaan AI tercapai (Terlalu banyak permintaan). Silakan tunggu beberapa menit dan coba lagi.');
      }
      throw new Error(`Gagal menghubungi Gemini API: ${response.status}`);
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

    return JSON.parse(cleanText);
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    throw error;
  }
}
