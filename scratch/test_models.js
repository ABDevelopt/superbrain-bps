const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/GEMINI_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : '';

const models = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

async function testModel(model) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Halo, katakan ok' }] }]
    });

    const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ model, status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => {
      resolve({ model, status: 'ERROR', error: err.message });
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  for (const model of models) {
    console.log(`Testing model: ${model}...`);
    const res = await testModel(model);
    console.log(`Model ${model} Status:`, res.status);
    console.log(`Model ${model} Body:`, res.body ? res.body.substring(0, 200) : res.error);
    console.log('--------------------------------------------------');
  }
}

run();
