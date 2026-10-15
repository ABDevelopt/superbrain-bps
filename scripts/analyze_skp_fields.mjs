import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const refreshToken = fs.readFileSync('scripts/refreshToken.txt', 'utf8').trim();

async function getIdToken() {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const data = await res.json();
  return data.id_token;
}

async function main() {
  const token = await getIdToken();
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'ckp' }]
      }
    })
  });
  const data = await res.json();
  const septDocs = data.filter(d => d.document?.fields?.tanggal?.stringValue?.startsWith('2026-09'));
  console.log("Analyzing SKP fields in September docs:");
  septDocs.forEach(d => {
    const f = d.document.fields;
    console.log({
      tanggal: f.tanggal?.stringValue,
      rincian: f.rincian?.stringValue?.substring(0, 35),
      skpId: f.skpId,
      skpIds: f.skpIds,
      timKerja: f.timKerja?.stringValue
    });
  });
}

main().catch(console.error);
