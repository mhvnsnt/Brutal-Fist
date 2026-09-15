import express from 'express';
import path from 'path';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'drive.usercontent.google.com',
  'docs.google.com',
  'docs.googleusercontent.com',
]);

function publicDriveDownloadUrl(raw: string) {
  const url = new URL(raw);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('Only public Google Drive URLs are supported');

  if (url.hostname === 'drive.google.com') {
    const match = url.pathname.match(/^\/file\/d\/([^/]+)/);
    const id = match?.[1] || url.searchParams.get('id');
    if (id) return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  }

  return url.toString();
}

async function startServer() {
  const app = express();

  // Same-origin proxy: the browser never needs a Drive OAuth token and never
  // has to solve Drive's cross-origin download headers itself.
  app.get('/api/public-model', async (req, res) => {
    try {
      const raw = String(req.query.url || '');
      if (!raw) return res.status(400).send('Missing public model URL');
      const target = publicDriveDownloadUrl(raw);
      const upstream = await fetch(target, { redirect: 'follow' });
      if (!upstream.ok) return res.status(upstream.status).send(`Public asset download failed: ${upstream.status}`);
      if (!upstream.body) return res.status(502).send('Public asset had no response body');

      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      Readable.fromWeb(upstream.body as any).pipe(res);
      return undefined;
    } catch (error) {
      console.error('Public model proxy error:', error);
      return res.status(400).send(error instanceof Error ? error.message : 'Invalid public model URL');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Brutal Fist running on port ${PORT}`));
}

startServer();
