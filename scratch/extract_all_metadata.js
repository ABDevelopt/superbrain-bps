const fs = require('fs');
const path = require('path');

const filePath = path.join(
  'C:\\Users\\ajian\\.gemini\\antigravity\\brain\\708adf5a-3943-41a5-a7e5-e7cf6420c437\\.system_generated\\steps\\7912\\content.md'
);

const html = fs.readFileSync(filePath, 'utf8');

// We want to extract text blocks and their links.
// In Canva's bootstrap JSON, text content is stored in arrays inside elements, e.g.:
// "a": [{"A?":"A","A":"some text"}]
// And links are defined in the formatting options or linked nearby, or in a "link" field.
// Let's search the file for URLs like drive.google.com, docs.google.com, s.bps.go.id, etc.
// and capture some characters around them to see their context/label.

const matches = [];
// Match google drive / docs / s.bps.go.id URLs
const regex = /(https?:\/\/(?:drive\.google\.com|docs\.google\.com|s\.bps\.go\.id)[^\s"'}]+)/g;
let match;
while ((match = regex.exec(html)) !== null) {
  const url = match[1];
  
  // Clean url (remove trailing characters, JSON escaped slashes)
  const cleanUrl = url.replace(/\\/g, '');
  
  // Look back and forward in the html to find the label
  const index = match.index;
  const start = Math.max(0, index - 200);
  const end = Math.min(html.length, index + 300);
  const context = html.substring(start, end).replace(/\\/g, '');
  
  matches.push({ url: cleanUrl, context });
}

// Let's analyze contexts to find descriptive labels
console.log('=== PORTALS & DOCS MAPPING ===');
const seenUrls = new Set();
matches.forEach(({ url, context }) => {
  if (seenUrls.has(url)) return;
  seenUrls.add(url);
  
  // Look for text fragments in context
  // Canva JSON texts look like: "A":"LABEL"
  const labelMatches = [];
  const labelRegex = /"A":"([^"]+)"/g;
  let lblMatch;
  while ((lblMatch = labelRegex.exec(context)) !== null) {
    if (!lblMatch[1].includes('{') && !lblMatch[1].includes('}')) {
      labelMatches.push(lblMatch[1].replace(/\\n/g, ' ').trim());
    }
  }
  
  // Also look for simple text before the URL
  console.log(`URL: ${url}`);
  console.log(`Labels found nearby:`, labelMatches.filter((v, i, a) => a.indexOf(v) === i));
  console.log('--------------------------------------------------');
});
