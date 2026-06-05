const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'C:\\Users\\ajian\\.gemini\\antigravity\\brain\\708adf5a-3943-41a5-a7e5-e7cf6420c437\\.system_generated\\steps\\7912\\content.md'
);

const html = fs.readFileSync(filePath, 'utf8');

// Canva text is inside JSON. Let's find all text blocks and print them in order.
// In Canva JSON, strings are typically values of keys, e.g. "A":"text content"
// Let's parse the file and find all occurrences of "A":"text content"
const matches = [];
const canvaTextRegex = /"A":"([^"]+)"/g;
let match;
while ((match = canvaTextRegex.exec(html)) !== null) {
  const txt = match[1].replace(/\\n/g, '\n').replace(/\\/g, '').trim();
  if (txt.length > 1 && !txt.includes('http') && !txt.includes('//')) {
    matches.push(txt);
  }
}

// Let's filter out duplicate lines and write to a clean markdown file
const cleanTexts = [];
const seen = new Set();
matches.forEach(m => {
  if (seen.has(m)) return;
  seen.add(m);
  cleanTexts.push(m);
});

fs.writeFileSync('scratch/extracted_latsar_content.txt', cleanTexts.join('\n\n'));
console.log(`Extracted ${cleanTexts.length} unique text blocks.`);
console.log('Sample blocks:');
console.log(cleanTexts.slice(0, 15).join('\n---\n'));
