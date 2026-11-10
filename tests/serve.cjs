const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const assets = new Map([
  ['index.html', 'text/html; charset=utf-8'], ['offline.html', 'text/html; charset=utf-8'],
  ['manifest.webmanifest', 'application/manifest+json'], ['pwa.js', 'application/javascript'],
  ['sw.js', 'application/javascript'], ['icons/app-192.png', 'image/png'],
  ['icons/app-512.png', 'image/png'], ['icons/app-maskable-512.png', 'image/png']
]);
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const asset = (pathname.startsWith('/-/') ? pathname.slice(3) : pathname.slice(1)) || 'index.html';
  if (!assets.has(asset)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': assets.get(asset), 'Cache-Control': 'no-store' });
  response.end(fs.readFileSync(path.join(root, asset)));
}).listen(8876, '127.0.0.1', () => console.log('App QA: http://127.0.0.1:8876/-/'));
