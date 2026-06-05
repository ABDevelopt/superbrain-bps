const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'C:\\Users\\ajian\\.gemini\\antigravity\\brain\\708adf5a-3943-41a5-a7e5-e7cf6420c437\\.system_generated\\steps\\7912\\content.md'
);

const html = fs.readFileSync(filePath, 'utf8');

// Find all URLs and their names. Canva uses JSON data to define links.
// Let's search for "G":"url" and find nearby text or metadata.
// In the previous text extraction, we saw G:"http..."
const regex = /"G":"(https?:\/\/[^"]+)"/g;
const urls = new Set();
let match;
while ((match = regex.exec(html)) !== null) {
  urls.add(match[1]);
}

// Also find any standard hrefs
const hrefRegex = /href="(https?:\/\/[^"]+)"/g;
while ((match = hrefRegex.exec(html)) !== null) {
  urls.add(match[1]);
}

// Let's print all unique URLs
console.log('=== EXTRACTED URLS ===');
Array.from(urls).forEach(url => console.log('-', url));
