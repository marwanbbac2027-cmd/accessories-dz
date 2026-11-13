'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDatabase } = require('./lib/db');
const orders = require('./lib/orders');
const listings = require('./lib/listings');
const admin = require('./lib/admin');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'accessories-dz.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;
const MAX_UPLOAD_BODY = 2 * 1024 * 1024; // a 1 MB image encoded as base64, plus the form fields
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
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
const TEN_MIN = 10 * 60 * 1000;
const orderLimiter = createLimiter(RATE_MAX, TEN_MIN);
const trackLimiter = createLimiter(RATE_MAX * 2, TEN_MIN);
const contactLimiter = createLimiter(RATE_MAX, TEN_MIN);
const messageLimiter = createLimiter(RATE_MAX, TEN_MIN);
const listingLimiter = createLimiter(Math.max(3, Math.floor(RATE_MAX / 3)), 60 * 60 * 1000);
const manageLimiter = createLimiter(RATE_MAX * 10, TEN_MIN);
const visitLimiter = createLimiter(RATE_MAX * 30, TEN_MIN);

function clientIp(req) {
  // Behind a proxy (Railway/Render), trust the first forwarded address.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function send(res, status, body, extraHeaders = {}) {
  const isRaw = typeof body === 'string' || Buffer.isBuffer(body);
  const payload = isRaw ? body : JSON.stringify(body);
  const type = isRaw ? extraHeaders['Content-Type'] || 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(payload);
}

function readJson(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    if (!ct.startsWith('application/json')) {
      const e = new Error('unsupported content type'); e.status = 415; return reject(e);
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) {
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

// Admin access: a bearer token set in the ADMIN_TOKEN environment variable. Disabled when unset.
function adminAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(ADMIN_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

// Phone number in WhatsApp format (country code 213, no leading 0).
function whatsappNumber(phone) {
  return phone ? '213' + phone.slice(1) : '';
}

function createServer(db, options = {}) {
  const dbFile = options.dbFile || DB_FILE;
  const getCategories = db.prepare('SELECT id, slug, name_ar, name_fr FROM categories ORDER BY id');
  const getProducts = db.prepare(`SELECT p.id, p.sku, p.name_ar, p.name_fr, p.desc_ar, p.desc_fr,
      p.price, p.discount_price, p.stock, p.tone, p.seller_name, p.seller_phone,
      (p.image_mime IS NOT NULL) AS has_image, c.slug AS category
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.status = 'approved' ORDER BY p.id DESC`);
  const cachedWilayas = db.prepare('SELECT code, name_ar, name_fr FROM wilayas WHERE is_active = 1 ORDER BY code').all();

  function publicProducts() {
    return getProducts.all().map(({ has_image, ...p }) => ({
      ...p,
      image_url: has_image ? `/api/products/${p.id}/image` : null,
      seller_wa: whatsappNumber(p.seller_phone),
    }));
  }

  function storeInfo() {
    // Contact details come from environment variables, so they can change without code edits.
    const httpsOnly = (v) => (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v : '');
    return {
      whatsapp: process.env.STORE_WHATSAPP || '',
      phone: process.env.STORE_PHONE || '',
      social: {
        facebook: httpsOnly(process.env.STORE_FACEBOOK),
        instagram: httpsOnly(process.env.STORE_INSTAGRAM),
        tiktok: httpsOnly(process.env.STORE_TIKTOK),
      },
    };
  }

  async function handleAdmin(req, res, url) {
    const { pathname } = url;
    if (!ADMIN_TOKEN) return send(res, 404, { error: 'غير موجود.' });
    if (!adminAuthorized(req)) return send(res, 401, { error: 'غير مصرح.' });

    if (req.method === 'GET' && pathname === '/api/admin/orders') {
      return send(res, 200, { orders: admin.listOrders(db, {
        status: url.searchParams.get('status') || '',
        q: url.searchParams.get('q') || '',
      }) });
    }
    const orderMatch = /^\/api\/admin\/orders\/(\d+)(\/status|\/notes)?$/.exec(pathname);
    if (orderMatch) {
      const id = Number(orderMatch[1]);
      const action = orderMatch[2];
      if (req.method === 'GET' && !action) return send(res, 200, { order: admin.orderDetail(db, id) });
      if (req.method === 'POST' && action === '/status') {
        const body = await readJson(req);
        return send(res, 200, admin.setOrderStatus(db, id, body.status));
      }
      if (req.method === 'POST' && action === '/notes') {
        const body = await readJson(req);
        return send(res, 200, admin.setOrderNotes(db, id, body.notes));
      }
    }

    if (req.method === 'GET' && pathname === '/api/admin/listings') {
      return send(res, 200, { listings: listings.adminListListings(db, url.searchParams.get('status')) });
    }
    const adminImg = /^\/api\/admin\/listings\/(\d+)\/image$/.exec(pathname);
    if (req.method === 'GET' && adminImg) {
      const img = listings.getImage(db, Number(adminImg[1]), false);
      if (!img) return send(res, 404, { error: 'غير موجود.' });
      return send(res, 200, img.data, { 'Content-Type': img.mime });
    }
    const adminStatus = /^\/api\/admin\/listings\/(\d+)\/status$/.exec(pathname);
    if (req.method === 'POST' && adminStatus) {
      const body = await readJson(req);
      return send(res, 200, listings.setListingStatus(db, Number(adminStatus[1]), body.status));
    }

    const productMatch = /^\/api\/admin\/products\/(\d+)$/.exec(pathname);
    if (productMatch) {
      const id = Number(productMatch[1]);
      if (req.method === 'PATCH') {
        const body = await readJson(req);
        return send(res, 200, listings.adminUpdateProduct(db, id, body));
      }
      if (req.method === 'DELETE') return send(res, 200, listings.adminDeleteProduct(db, id));
    }

    if (req.method === 'GET' && pathname === '/api/admin/coupons') {
      return send(res, 200, { coupons: admin.listCoupons(db) });
    }
    if (req.method === 'POST' && pathname === '/api/admin/coupons') {
      const body = await readJson(req);
      return send(res, 201, admin.createCoupon(db, body));
    }
    const couponMatch = /^\/api\/admin\/coupons\/(\d+)\/active$/.exec(pathname);
    if (req.method === 'POST' && couponMatch) {
      const body = await readJson(req);
      return send(res, 200, admin.setCouponActive(db, Number(couponMatch[1]), body.active));
    }

    if (req.method === 'GET' && pathname === '/api/admin/stats') {
      return send(res, 200, admin.stats(db));
    }
    if (req.method === 'GET' && pathname === '/api/admin/messages') {
      return send(res, 200, { messages: listings.listMessages(db) });
    }
    if (req.method === 'GET' && pathname === '/api/admin/backup') {
      if (!dbFile || dbFile === ':memory:' || !fs.existsSync(dbFile)) return send(res, 404, { error: 'غير موجود.' });
      // Fold the write-ahead log into the main file so the copy is complete.
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      const data = fs.readFileSync(dbFile);
      const stamp = new Date().toISOString().slice(0, 10);
      return send(res, 200, data, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="accessories-dz-${stamp}.db"`,
      });
    }

    return send(res, 404, { error: 'غير موجود.' });
  }

  async function handleApi(req, res, url) {
    const ip = clientIp(req);
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/api/categories') {
      return send(res, 200, { categories: getCategories.all() });
    }
    if (req.method === 'GET' && pathname === '/api/products') {
      return send(res, 200, { products: publicProducts() });
    }
    if (req.method === 'GET' && pathname === '/api/wilayas') {
      return send(res, 200, { wilayas: cachedWilayas });
    }
    if (req.method === 'GET' && pathname === '/api/store') {
      return send(res, 200, storeInfo());
    }
    if (req.method === 'GET' && pathname === '/api/delivery') {
      const code = Number(url.searchParams.get('wilaya'));
      if (!Number.isInteger(code) || code < 1 || code > 58) {
        return send(res, 400, { error: 'الولاية غير صالحة.' });
      }
      return send(res, 200, { options: orders.getActiveDeliveryOptions(db, code) });
    }
    if (req.method === 'GET' && pathname === '/api/coupons/check') {
      return send(res, 200, orders.checkCoupon(db, url.searchParams.get('code') || ''));
    }
    if (req.method === 'POST' && pathname === '/api/visit') {
      if (visitLimiter(ip)) admin.recordVisit(db);
      return send(res, 204, '');
    }

    const imgMatch = /^\/api\/products\/(\d+)\/image$/.exec(pathname);
    if (req.method === 'GET' && imgMatch) {
      const img = listings.getImage(db, Number(imgMatch[1]), true);
      if (!img) return send(res, 404, { error: 'غير موجود.' });
      return send(res, 200, img.data, { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=3600' });
    }

    const msgMatch = /^\/api\/products\/(\d+)\/messages$/.exec(pathname);
    if (req.method === 'POST' && msgMatch) {
      if (!messageLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      listings.createMessage(db, Number(msgMatch[1]), body);
      admin.notify(`رسالة جديدة لمنتج رقم ${msgMatch[1]}\nالاسم: ${body.name}\nالهاتف: ${body.phone}\n${body.message}`);
      return send(res, 201, { ok: true });
    }

    const manageMatch = /^\/api\/manage\/([A-Za-z0-9_-]{20,80})$/.exec(pathname);
    if (manageMatch) {
      if (!manageLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      if (req.method === 'GET') return send(res, 200, { listing: listings.getOwnListing(db, manageMatch[1]) });
      if (req.method === 'PATCH') {
        const body = await readJson(req);
        return send(res, 200, { listing: listings.updateOwnListing(db, manageMatch[1], body) });
      }
    }

    if (req.method === 'POST' && pathname === '/api/listings') {
      if (!listingLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req, MAX_UPLOAD_BODY);
      const result = listings.createListing(db, body);
      admin.notify(`منتج جديد بانتظار المراجعة\n${body.title || ''}\nالبائع: ${body.seller_name || ''} ${body.seller_phone || ''}`);
      return send(res, 201, result);
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      if (!orderLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      const key = req.headers['idempotency-key'];
      const result = orders.placeOrder(db, body, typeof key === 'string' ? key : '');
      if (!result.duplicate) {
        admin.notify(`طلب جديد ${result.reference}\n${result.customer} — ولاية ${result.wilaya}\nالمجموع: ${result.total} دج`);
      }
      return send(res, result.duplicate ? 200 : 201, {
        reference: result.reference,
        status: result.status,
        total: result.total,
        duplicate: result.duplicate,
      });
    }

    if (req.method === 'POST' && pathname === '/api/track') {
      if (!trackLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      const row = orders.trackOrder(db, body.reference, body.phone);
      // Same response shape whether or not the order exists (prevents enumeration).
      return send(res, 200, { found: Boolean(row), status: row ? row.status : null, reference: row ? row.reference : null });
    }

    if (req.method === 'POST' && pathname === '/api/contact') {
      if (!contactLimiter(ip)) return send(res, 429, { error: 'محاولات كثيرة. حاول لاحقا.' });
      const body = await readJson(req);
      orders.saveContactMessage(db, body);
      admin.notify(`رسالة من الموقع\n${body.name} ${body.phone}\n${body.message}`);
      return send(res, 201, { ok: true });
    }

    if (pathname.startsWith('/api/admin/')) return handleAdmin(req, res, url);

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
      if (err && err.publicMessage) return send(res, err.status || 400, { error: err.publicMessage });
      if (err && err.status === 404) return send(res, 404, { error: 'غير موجود.' });
      if (err && err.status) return send(res, err.status, { error: 'طلب غير صالح.' });
      // Log server-side; never leak internals to the client.
      console.error('[server]', err);
      return send(res, 500, { error: 'حدث خطأ. حاول مرة أخرى.' });
    }
  });
}

if (require.main === module) {
  const db = openDatabase(DB_FILE);
  createServer(db, { dbFile: DB_FILE }).listen(PORT, () => {
    console.log(`ACCESSORIES DZ running on http://localhost:${PORT}`);
    if (!ADMIN_TOKEN) console.log('Admin disabled: set ADMIN_TOKEN to enable /admin.html');
  });
}

module.exports = { createServer, openDatabase };
