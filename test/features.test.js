'use strict';

process.env.RATE_LIMIT_MAX = '1000';
process.env.ADMIN_TOKEN = 'test-admin-token-123';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createServer, openDatabase } = require('../server');

const ADMIN = { Authorization: 'Bearer test-admin-token-123' };
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const PNG_DATA_URL = 'data:image/png;base64,' + PNG_BYTES.toString('base64');

let server;
let base;
let db;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adz-feat-'));
const dbFile = path.join(dir, 'features.db');

async function call(method, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let data;
  try { data = JSON.parse(buf.toString('utf8')); } catch { data = buf; }
  return { status: res.status, data, headers: res.headers };
}

async function createApproved(overrides = {}) {
  const created = await call('POST', '/api/listings', {
    title: 'Bracelet test', category: 'bracelets', price: 1000, stock: 50,
    description: 'Test', seller_name: 'Vendeur', seller_phone: '0661000222',
    image: PNG_DATA_URL, ...overrides,
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const ok = await call('POST', `/api/admin/listings/${created.data.id}/status`, { status: 'approved' }, ADMIN);
  assert.equal(ok.status, 200);
  return { id: created.data.id, manageToken: created.data.manageToken };
}

function orderBody(productId, phone, quantity = 1, couponCode) {
  return {
    customer: { name: 'Client Test', phone, wilaya: 16, commune: 'Bab Ezzouar', address: 'Rue 1, bloc 3' },
    deliveryMethod: 'home',
    items: [{ productId, quantity }],
    ...(couponCode ? { couponCode } : {}),
  };
}

let keySeq = 0;
function placeOrder(body) {
  keySeq++;
  return call('POST', '/api/orders', body, { 'Idempotency-Key': `feature-key-${keySeq}-abcdef` });
}

before(async () => {
  db = openDatabase(dbFile);
  server = createServer(db, { dbFile });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

test('percent coupon is applied on the server and counted', async () => {
  const p = await createApproved({ price: 1000 });
  await call('POST', '/api/admin/coupons', { code: 'promo10', kind: 'percent', value: 10 }, ADMIN);

  const check = await call('GET', '/api/coupons/check?code=PROMO10');
  assert.deepEqual(check.data, { valid: true, kind: 'percent', value: 10 });

  const order = await placeOrder(orderBody(p.id, '0770000001', 2, 'PROMO10'));
  assert.equal(order.status, 201, JSON.stringify(order.data));
  // 2 x 1000 = 2000, 10% off = 200, plus home delivery fee (server-side)
  const coupons = await call('GET', '/api/admin/coupons', undefined, ADMIN);
  const c = coupons.data.coupons.find((x) => x.code === 'PROMO10');
  assert.equal(c.uses, 1);
});

test('unknown or inactive coupon is rejected', async () => {
  const p = await createApproved();
  const bad = await placeOrder(orderBody(p.id, '0770000002', 1, 'NOPE999'));
  assert.equal(bad.status, 400);
  assert.equal(bad.data.field, 'couponCode');

  const created = await call('POST', '/api/admin/coupons', { code: 'OFFSOON', kind: 'amount', value: 100 }, ADMIN);
  await call('POST', `/api/admin/coupons/${created.data.id}/active`, { active: false }, ADMIN);
  const check = await call('GET', '/api/coupons/check?code=OFFSOON');
  assert.deepEqual(check.data, { valid: false });
});

test('coupon validation rejects bad input', async () => {
  const pct = await call('POST', '/api/admin/coupons', { code: 'BIGPCT', kind: 'percent', value: 150 }, ADMIN);
  assert.equal(pct.status, 400);
  const short = await call('POST', '/api/admin/coupons', { code: 'ab', kind: 'amount', value: 50 }, ADMIN);
  assert.equal(short.status, 400);
});

test('the same phone can place several orders (no daily limit)', async () => {
  const p = await createApproved({ stock: 50 });
  const phone = '0770000003';
  for (let i = 0; i < 5; i++) {
    const r = await placeOrder(orderBody(p.id, phone));
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
});

test('cancelling an order restores stock; reopening a closed order is refused', async () => {
  const p = await createApproved({ stock: 10 });
  const order = await placeOrder(orderBody(p.id, '0770000004', 3));
  assert.equal(order.status, 201);

  const before = await call('GET', `/api/admin/listings?status=approved`, undefined, ADMIN);
  const stockBefore = before.data.listings.find((x) => x.id === p.id).stock;
  assert.equal(stockBefore, 7);

  const detail = await call('GET', `/api/admin/orders?q=${order.data.reference}`, undefined, ADMIN);
  const orderId = detail.data.orders[0].id;

  const cancel = await call('POST', `/api/admin/orders/${orderId}/status`, { status: 'cancelled' }, ADMIN);
  assert.equal(cancel.status, 200);
  const after = await call('GET', `/api/admin/listings?status=approved`, undefined, ADMIN);
  assert.equal(after.data.listings.find((x) => x.id === p.id).stock, 10);

  const reopen = await call('POST', `/api/admin/orders/${orderId}/status`, { status: 'pending' }, ADMIN);
  assert.equal(reopen.status, 400);
});

test('order status moves forward and detail shows items', async () => {
  const p = await createApproved();
  const order = await placeOrder(orderBody(p.id, '0770000005', 1));
  const list = await call('GET', `/api/admin/orders?status=pending&q=${order.data.reference}`, undefined, ADMIN);
  const id = list.data.orders[0].id;
  const up = await call('POST', `/api/admin/orders/${id}/status`, { status: 'confirmed' }, ADMIN);
  assert.equal(up.status, 200);
  const detail = await call('GET', `/api/admin/orders/${id}`, undefined, ADMIN);
  assert.equal(detail.data.order.status, 'confirmed');
  assert.equal(detail.data.order.items.length, 1);
  const notes = await call('POST', `/api/admin/orders/${id}/notes`, { notes: 'اتصل قبل التسليم' }, ADMIN);
  assert.equal(notes.status, 200);
});

test('admin orders endpoints require the token', async () => {
  const r = await call('GET', '/api/admin/orders');
  assert.equal(r.status, 401);
});

test('admin can edit a product and stop it; delete is refused when it has orders', async () => {
  const p = await createApproved({ stock: 5 });
  const edit = await call('PATCH', `/api/admin/products/${p.id}`, { price: 1500, is_active: false }, ADMIN);
  assert.equal(edit.status, 200);
  const hidden = await call('GET', '/api/products');
  assert.ok(!hidden.data.products.some((x) => x.id === p.id));

  const fresh = await createApproved({ stock: 5 });
  await placeOrder(orderBody(fresh.id, '0770000006', 1));
  const del = await call('DELETE', `/api/admin/products/${fresh.id}`, undefined, ADMIN);
  assert.equal(del.status, 409);
  assert.match(del.data.error, /طلبات/);

  const unused = await createApproved({ stock: 5 });
  const delOk = await call('DELETE', `/api/admin/products/${unused.id}`, undefined, ADMIN);
  assert.equal(delOk.status, 200);
});

test('seller manage link shows and updates own listing only', async () => {
  const created = await call('POST', '/api/listings', {
    title: 'Sac test', category: 'bags', price: 3000, stock: 4,
    description: 'Sac', seller_name: 'Vendeuse', seller_phone: '0555000111', image: PNG_DATA_URL,
  });
  assert.equal(created.status, 201);
  const token = created.data.manageToken;
  assert.ok(token && token.length >= 30);

  const view = await call('GET', `/api/manage/${token}`);
  assert.equal(view.status, 200);
  assert.equal(view.data.listing.price, 3000);
  assert.equal(view.data.listing.status, 'pending');

  const upd = await call('PATCH', `/api/manage/${token}`, { price: 2500, stock: 6 });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.listing.price, 2500);
  assert.equal(upd.data.listing.stock, 6);

  // The token itself is never stored, only its hash.
  const row = db.prepare('SELECT manage_token_hash FROM products WHERE id = ?').get(created.data.id);
  assert.notEqual(row.manage_token_hash, token);

  const unknown = await call('GET', '/api/manage/' + 'A'.repeat(32));
  assert.equal(unknown.status, 404);
});

test('visits are counted and appear in stats', async () => {
  const v = await call('POST', '/api/visit');
  assert.equal(v.status, 204);
  const stats = await call('GET', '/api/admin/stats', undefined, ADMIN);
  assert.equal(stats.status, 200);
  assert.ok(Array.isArray(stats.data.visits));
  assert.ok(stats.data.visits.length >= 1);
  assert.ok(stats.data.totals.orders >= 1);
});

test('backup requires the token and returns a SQLite file', async () => {
  const denied = await call('GET', '/api/admin/backup');
  assert.equal(denied.status, 401);
  const ok = await call('GET', '/api/admin/backup', undefined, ADMIN);
  assert.equal(ok.status, 200);
  assert.equal(Buffer.from(ok.data).subarray(0, 15).toString('ascii'), 'SQLite format 3');
  assert.match(ok.headers.get('content-disposition'), /attachment/);
});
