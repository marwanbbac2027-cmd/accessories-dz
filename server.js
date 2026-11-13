'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./lib/db');
const orders = require('./lib/orders');
const { WILAYAS } = require('./lib/data');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'accessories-dz.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

// Simple fixed-window rate limiter keyed by client IP (in-memory, per process).
function createLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 10;
const orderLimiter = createLimiter(RATE_MAX, 10 * 60 * 1000);
const trackLimiter = createLimiter(RATE_MAX * 2, 10 * 60 * 1000);
const contactLimiter = createLimiter(RATE_MAX, 10 * 60 * 1000);

function clientIp(req) {
  // Behind a proxy (Vercel/Render), trust the first forwarded address.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function send(res, status, body, extraHeaders = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  const type = typeof body === 'string' || Buffer.isBuffer(body) ? extraHeaders['Content-Type'] || 'text/plain; charset=utf-8'
    : 'application/json; charset=utf-8';
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    if (!ct.startsWith('application/json')) {
      const e = new Error('unsupported content type'); e.status = 415; return reject(e);
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        const e = new Error('body too large'); e.status = 413; reject(e); req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        const e = new Error('invalid json'); e.status = 400; reject(e);
      }
    });
    req.on('error', reject);
  });
}

function createServer(db) {
  const getCategories = db.prepare('SELECT id, slug, name_ar, name_fr FROM categories ORDER BY id');
  const getProducts = db.prepare(`SELECT p.id, p.sku, p.name_ar, p.name_fr, p.desc_ar, p.desc_fr,
      p.price, p.discount_price, p.stock, p.tone, c.slug AS category
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 ORDER BY p.id`);
  const getWilayas = db.prepare('SELECT code, name_ar, name_fr FROM wilayas WHERE is_active = 1 ORDER BY code');

  const cachedWilayas = getWilayas.all();

  async function handleApi(req, res, url) {
    const ip = clientIp(req);

    if (req.method === 'GET' && url.pathname === '/api/categories') {
      return send(res, 200, { categories: getCategories.all() });
    }
    if (req.method === 'GET' && url.pathname === '/api/products') {
      return send(res, 200, { products: getProducts.all() });
    }
    if (req.method === 'GET' && url.pathname === '/api/store') {
      // Contact details come from environment variables, so they can change without code edits.
      return send(res, 200, {
        whatsapp: process.env.STORE_WHATSAPP || '',
        phone: process.env.STORE_PHONE || '',
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/wilayas') {
      return send(res, 200, { wilayas: cachedWilayas });
    }
    if (req.method === 'GET' && url.pathname === '/api/delivery') {
      const code = Number(url.searchParams.get('wilaya'));
      if (!Number.isInteger(code) || code < 1 || code > 58) {
        return send(res, 400, { error: 'الولاية غير صالحة.' });
      }
      return send(res, 200, { options: orders.getActiveDeliveryOptions(db, code) });
    }

    if (req.method === 'POST' && url.pathname === '/api/orders') {
      if (!orderLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      const key = req.headers['idempotency-key'];
      const result = orders.placeOrder(db, body, typeof key === 'string' ? key : '');
      return send(res, result.duplicate ? 200 : 201, {
        reference: result.reference,
        status: result.status,
        total: result.total,
        duplicate: result.duplicate,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/track') {
      if (!trackLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      const row = orders.trackOrder(db, body.reference, body.phone);
      // Same response shape whether or not the order exists (prevents enumeration).
      return send(res, 200, { found: Boolean(row), status: row ? row.status : null, reference: row ? row.reference : null });
    }

    if (req.method === 'POST' && url.pathname === '/api/contact') {
      if (!contactLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      orders.saveContactMessage(db, body);
      return send(res, 201, { ok: true });
    }

    return send(res, 404, { error: 'غير موجود.' });
  }

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof orders.ValidationError) {
        return send(res, 400, { error: err.message, field: err.field });
      }
      if (err && err.status) return send(res, err.status, { error: 'طلب غير صالح.' });
      // Log server-side; never leak internals to the client.
      console.error('[server]', err);
      return send(res, 500, { error: 'حدث خطأ. حاول مرة أخرى.' });
    }
  });
}

if (require.main === module) {
  const db = openDatabase(DB_FILE);
  createServer(db).listen(PORT, () => {
    console.log(`ACCESSORIES DZ running on http://localhost:${PORT}`);
  });
}

module.exports = { createServer, openDatabase };
