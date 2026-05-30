const http = require('http');

const payload = JSON.stringify({
  messages: [
    { role: 'user', content: 'Halo, tolong buatkan jadwal rapat besok jam 10 pagi.' }
  ],
  currentPath: '/schedule'
});

const req = http.request('http://localhost:3000/api/brainstorm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(payload);
req.end();
