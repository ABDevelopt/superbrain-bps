const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'C:\\Users\\ajian\\.gemini\\antigravity\\brain\\708adf5a-3943-41a5-a7e5-e7cf6420c437\\.system_generated\\steps\\7912\\content.md'
);

const html = fs.readFileSync(filePath, 'utf8');

// Canva website embeds text inside a JSON bootstrap block. Let's find all text values.
// We can find strings matching the pattern "A":"..." or "text":"..." or just regular strings.
// Let's write a regex to find all Indonesian words or sentences.
const textMatches = new Set();
const regex = /"[^"]*?(?:latsar|pelatihan|jadwal|cpns|maret|gojags|sibangkom|warkop|pusdiklat|lan|tahap|registrasi)[^"]*?"/gi;

let match;
while ((match = regex.exec(html)) !== null) {
  textMatches.add(match[0]);
}

// Let's also do a general extraction of all text objects inside Canva's JSON structure.
// Canva JSON has structures like {"A?":"A", "A":"text content"} or similar.
// Let's search for "A":"text"
const canvaTextRegex = /"A":"([^"]{3,200})"/g;
while ((match = canvaTextRegex.exec(html)) !== null) {
  const txt = match[1].replace(/\\n/g, '\n').trim();
  if (txt.length > 2) {
    textMatches.add(txt);
  }
}

console.log('=== EXTRACTED TEXTS ===');
const list = Array.from(textMatches);
list.forEach(t => {
  // Only print strings that have some letters and are not purely code/hex
  if (/[a-zA-Z]/.test(t) && !t.includes('http') && !t.includes('//') && t.length < 500) {
    console.log('-', t.replace(/\\/g, ''));
  }
});
