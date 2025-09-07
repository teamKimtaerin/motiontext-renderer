// Simple dev-only static server for plugins directory
// ESM-friendly Node http server with CORS and minimal MIME mapping
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3300;
const ROOT = path.join(__dirname, 'plugins');

const MIME = new Map([
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=0');
}

async function serve(req, res) {
  try {
    cors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (!url.pathname.startsWith('/plugins/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    // Normalize and prevent path traversal
    const rel = url.pathname.replace(/^\/plugins\//, '');
    const full = path.join(ROOT, rel);
    const normalized = path.normalize(full);
    if (!normalized.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }
    const stat = await fs.stat(normalized).catch(() => null);
    if (!stat) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    if (stat.isDirectory()) {
      // No directory listing
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Directory listing disabled');
    }
    const ext = path.extname(normalized).toLowerCase();
    const type = MIME.get(ext) || 'application/octet-stream';
    const data = await fs.readFile(normalized);
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
}

http.createServer(serve).listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[plugin-server] listening on http://localhost:${PORT}`);
});

