const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3300;
const ROOT = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/mock') {
    reqPath = '/dev/mock-gemini.html';
  } else if (reqPath === '/options') {
    reqPath = '/options/options.html';
  }

  const filePath = path.join(ROOT, reqPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🧪 Gemini Temporary Chat Add-on Test Server Running!`);
  console.log(`------------------------------------------------------`);
  console.log(`👉 Mock Gemini Testbed:  http://localhost:${PORT}/`);
  console.log(`👉 Add-on Options Page:  http://localhost:${PORT}/options`);
  console.log(`======================================================\n`);
});
