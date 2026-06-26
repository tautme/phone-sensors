'use strict';

/*
 * Image Share "XO" Annotate — backend.
 *
 * Dependency-free Node HTTP server. Run with: node server.js
 *
 * Responsibilities:
 *   - serve the static frontend (public/)
 *   - store each uploaded image in its own organized folder, alongside the
 *     annotations placed on it
 *   - let the frontend re-load and re-save annotations so accidental marks can
 *     be corrected later, not just during the first session
 *
 * Storage layout (created on demand under ./storage):
 *
 *   storage/
 *     images/
 *       <id>/
 *         original.<ext>     the uploaded image bytes
 *         annotations.json   the list of X/O marks (normalized coordinates)
 *         meta.json          id, filename, mime type, sizes, timestamps
 *
 * Each image gets its own folder keyed by a short id, so images and their
 * annotations never collide and are easy to inspect or back up by hand.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const STORAGE_DIR = path.join(ROOT, 'storage');
const IMAGES_DIR = path.join(STORAGE_DIR, 'images');

// Limit upload size so a single request can't exhaust memory/disk.
const MAX_BODY_BYTES = 12 * 1024 * 1024; // ~12 MB of JSON (image is base64)

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

fs.mkdirSync(IMAGES_DIR, { recursive: true });

// --- small helpers ---------------------------------------------------------

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Annotations come from the client; never trust them blindly. Keep only
// well-formed marks with the shape the frontend actually uses.
function sanitizeAnnotations(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') continue;
    const type = m.type === 'O' ? 'O' : m.type === 'X' ? 'X' : null;
    const x = Number(m.x);
    const y = Number(m.y);
    if (!type || !isFinite(x) || !isFinite(y)) continue;
    // x/y are stored normalized (0..1) so they survive any later resize.
    out.push({
      type,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    });
  }
  return out;
}

// A folder name we are willing to look up: short hex ids only.
function isValidId(id) {
  return typeof id === 'string' && /^[a-f0-9]{8,32}$/.test(id);
}

function readMeta(id) {
  const p = path.join(IMAGES_DIR, id, 'meta.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readAnnotations(id) {
  const p = path.join(IMAGES_DIR, id, 'annotations.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

// --- route handlers --------------------------------------------------------

// POST /api/images  { filename, imageData (data URL), annotations }
async function createImage(req, res) {
  const raw = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return sendJSON(res, 400, { error: 'invalid JSON body' });
  }

  const dataUrl = payload.imageData;
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return sendJSON(res, 400, { error: 'imageData must be a base64 data URL' });

  const mime = m[1].toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) return sendJSON(res, 400, { error: 'unsupported image type: ' + mime });

  let bytes;
  try {
    bytes = Buffer.from(m[2], 'base64');
  } catch {
    return sendJSON(res, 400, { error: 'could not decode image data' });
  }
  if (!bytes.length) return sendJSON(res, 400, { error: 'empty image' });

  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(IMAGES_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const annotations = sanitizeAnnotations(payload.annotations);
  const now = new Date().toISOString();
  const meta = {
    id,
    filename: typeof payload.filename === 'string' ? payload.filename.slice(0, 200) : 'image',
    mime,
    ext,
    bytes: bytes.length,
    createdAt: now,
    updatedAt: now,
  };

  fs.writeFileSync(path.join(dir, 'original.' + ext), bytes);
  fs.writeFileSync(path.join(dir, 'annotations.json'), JSON.stringify(annotations, null, 2));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

  sendJSON(res, 201, { id, meta, annotations });
}

// PUT /api/images/:id/annotations  { annotations }
// Lets the frontend persist corrections (undo, erase, re-mark) after the fact.
async function updateAnnotations(req, res, id) {
  const dir = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(dir)) return sendJSON(res, 404, { error: 'not found' });

  const raw = await readBody(req);
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return sendJSON(res, 400, { error: 'invalid JSON body' });
  }

  const annotations = sanitizeAnnotations(payload.annotations);
  fs.writeFileSync(path.join(dir, 'annotations.json'), JSON.stringify(annotations, null, 2));

  const meta = readMeta(id);
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));

  sendJSON(res, 200, { id, meta, annotations });
}

// GET /api/images  -> list of stored images (most recent first)
function listImages(req, res) {
  let ids = [];
  try {
    ids = fs.readdirSync(IMAGES_DIR).filter(isValidId);
  } catch {
    /* no images yet */
  }
  const items = [];
  for (const id of ids) {
    try {
      const meta = readMeta(id);
      meta.annotationCount = readAnnotations(id).length;
      items.push(meta);
    } catch {
      /* skip half-written or corrupt folders */
    }
  }
  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  sendJSON(res, 200, { images: items });
}

// GET /api/images/:id  -> meta + annotations
function getImage(req, res, id) {
  const dir = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(dir)) return sendJSON(res, 404, { error: 'not found' });
  sendJSON(res, 200, { meta: readMeta(id), annotations: readAnnotations(id) });
}

// GET /api/images/:id/file  -> raw image bytes
function getImageFile(req, res, id) {
  const dir = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(dir)) return sendJSON(res, 404, { error: 'not found' });
  let meta;
  try {
    meta = readMeta(id);
  } catch {
    return sendJSON(res, 404, { error: 'not found' });
  }
  const file = path.join(dir, 'original.' + meta.ext);
  fs.readFile(file, (err, data) => {
    if (err) return sendJSON(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': meta.mime, 'Content-Length': data.length });
    res.end(data);
  });
}

// DELETE /api/images/:id  -> remove the whole folder
function deleteImage(req, res, id) {
  const dir = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(dir)) return sendJSON(res, 404, { error: 'not found' });
  fs.rmSync(dir, { recursive: true, force: true });
  sendJSON(res, 200, { ok: true });
}

// --- static file serving ---------------------------------------------------

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  // Resolve and confine to PUBLIC_DIR to block path traversal.
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJSON(res, 403, { error: 'forbidden' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJSON(res, 404, { error: 'not found' });
    const type = STATIC_TYPES[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    res.end(data);
  });
}

// --- router ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','images','<id>']

    if (parts[0] === 'api') {
      // /api/images
      if (parts[1] === 'images' && parts.length === 2) {
        if (req.method === 'GET') return listImages(req, res);
        if (req.method === 'POST') return createImage(req, res);
        return sendJSON(res, 405, { error: 'method not allowed' });
      }
      // /api/images/:id ...
      if (parts[1] === 'images' && parts.length >= 3) {
        const id = parts[2];
        if (!isValidId(id)) return sendJSON(res, 400, { error: 'bad id' });

        if (parts.length === 3) {
          if (req.method === 'GET') return getImage(req, res, id);
          if (req.method === 'DELETE') return deleteImage(req, res, id);
          return sendJSON(res, 405, { error: 'method not allowed' });
        }
        if (parts.length === 4 && parts[3] === 'file' && req.method === 'GET') {
          return getImageFile(req, res, id);
        }
        if (parts.length === 4 && parts[3] === 'annotations' && req.method === 'PUT') {
          return updateAnnotations(req, res, id);
        }
      }
      return sendJSON(res, 404, { error: 'unknown endpoint' });
    }

    // Anything else is a static asset.
    if (req.method === 'GET') return serveStatic(req, res, req.url);
    return sendJSON(res, 405, { error: 'method not allowed' });
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    sendJSON(res, status, { error: err.message || 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`XO Annotate running at http://localhost:${PORT}`);
  console.log(`Storing images under ${IMAGES_DIR}`);
});
