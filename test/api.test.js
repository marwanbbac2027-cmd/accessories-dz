'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
process.env.RATE_LIMIT_MAX = '1000'; // tests send many requests from one IP
const { createServer, openDatabase } = require('../server');

let server;
let base;
let db;
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adz-test-')), 'test.db');

const validCustomer = {
  name: 'Test Client',
  phone: '0551234567',
  wilaya: 16,
  commune: 'Bab Ezzouar',
  address: 'Rue 1, Cité test, bloc 3',
};

async function post(p, body, headers = {}) {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

function productStock(id) {
  return db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
}

before(async () => {
  db = openDatabase(dbFile);
  server = createServer(db);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

test('catalog is served from the database with 8+ products and 58 wilayas', async () => {
  const prods = await (await fetch(base + '/api/products')).json();
  assert.ok(prods.products.length >= 8);
  const wil = await (await fetch(base + '/api/wilayas')).json();
  assert.equal(wil.wilayas.length, 58);
});

test('order uses server prices, ignores client-supplied totals', async () => {
  const prods = (await (await fetch(base + '/api/products')).json()).products;
  const p = prods.find((x) => x.stock >= 2);
  const expectedUnit = p.discount_price ?? p.price;
  const { status, data } = await post('/api/orders', {
    customer: validCustomer,
    deliveryMethod: 'home',
    items: [{ productId: p.id, quantity: 2 }],
    total: 1, // attacker-supplied values must be ignored
    subtotal: 1,
    deliveryFee: 0,
    unitPrice: 1,
  }, { 'Idempotency-Key': 'key-server-price-001' });
  assert.equal(status, 201);
  const fee = db.prepare("SELECT fee FROM delivery_settings WHERE wilaya_code = 16 AND method = 'home'").get().fee;
  assert.equal(data.total, expectedUnit * 2 + fee);
  assert.match(data.reference, /^ADZ-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('duplicate submissions with the same key create one order', async () => {
  const p = db.prepare('SELECT id, stock FROM products WHERE stock >= 1 LIMIT 1').get();
  const before = productStock(p.id);
  const body = { customer: validCustomer, deliveryMethod: 'pickup', items: [{ productId: p.id, quantity: 1 }] };
  const first = await post('/api/orders', body, { 'Idempotency-Key': 'dup-key-abcdef' });
  const second = await post('/api/orders', body, { 'Idempotency-Key': 'dup-key-abcdef' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.reference, first.data.reference);
  assert.equal(productStock(p.id), before - 1, 'stock decremented once only');
  const count = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?').get('dup-key-abcdef').n;
  assert.equal(count, 1);
});

test('stock is enforced and a failed order changes nothing', async () => {
  const p = db.prepare('SELECT id, stock FROM products ORDER BY stock ASC LIMIT 1').get();
  const before = productStock(p.id);
  const ordersBefore = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const res = await post('/api/orders', {
    customer: validCustomer, deliveryMethod: 'home', items: [{ productId: p.id, quantity: p.stock + 5 }],
  }, { 'Idempotency-Key': 'too-many-items-1' });
  assert.equal(res.status, 400);
  assert.equal(productStock(p.id), before);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, ordersBefore);
});

test('validation rejects bad phone, wilaya and empty cart', async () => {
  const p = db.prepare('SELECT id FROM products WHERE stock > 0 LIMIT 1').get();
  const badPhone = await post('/api/orders', {
    customer: { ...validCustomer, phone: '12345' }, deliveryMethod: 'home', items: [{ productId: p.id, quantity: 1 }],
  }, { 'Idempotency-Key': 'bad-phone-key-1' });
  assert.equal(badPhone.status, 400);
  assert.equal(badPhone.data.field, 'phone');

  const badWilaya = await post('/api/orders', {
    customer: { ...validCustomer, wilaya: 99 }, deliveryMethod: 'home', items: [{ productId: p.id, quantity: 1 }],
  }, { 'Idempotency-Key': 'bad-wilaya-key-1' });
  assert.equal(badWilaya.status, 400);
  assert.equal(badWilaya.data.field, 'wilaya');

  const empty = await post('/api/orders', { customer: validCustomer, deliveryMethod: 'home', items: [] },
    { 'Idempotency-Key': 'empty-cart-key-1' });
  assert.equal(empty.status, 400);
});

test('order persists in SQLite with items and status pending', async () => {
  const p = db.prepare('SELECT id FROM products WHERE stock > 0 LIMIT 1').get();
  const res = await post('/api/orders', {
    customer: validCustomer, deliveryMethod: 'home', items: [{ productId: p.id, quantity: 1 }], notes: '<b>x</b>',
  }, { 'Idempotency-Key': 'persist-key-0001' });
  assert.equal(res.status, 201);
  const row = db.prepare('SELECT status, notes, phone FROM orders WHERE reference = ?').get(res.data.reference);
  assert.equal(row.status, 'pending');
  assert.equal(row.phone, '0551234567');
  assert.equal(row.notes, '<b>x</b>', 'stored as text, escaped on render');
  const items = db.prepare('SELECT COUNT(*) AS n FROM order_items o JOIN orders r ON r.id = o.order_id WHERE r.reference = ?')
    .get(res.data.reference).n;
  assert.equal(items, 1);
});

test('tracking requires both reference and matching phone, and reveals only status', async () => {
  const p = db.prepare('SELECT id FROM products WHERE stock > 0 LIMIT 1').get();
  const res = await post('/api/orders', {
    customer: { ...validCustomer, phone: '0661112233' }, deliveryMethod: 'home', items: [{ productId: p.id, quantity: 1 }],
  }, { 'Idempotency-Key': 'track-key-000001' });

  const ok = await post('/api/track', { reference: res.data.reference, phone: '0661112233' });
  assert.equal(ok.data.found, true);
  assert.equal(ok.data.status, 'pending');
  assert.deepEqual(Object.keys(ok.data).sort(), ['found', 'reference', 'status']);

  const wrongPhone = await post('/api/track', { reference: res.data.reference, phone: '0770000000' });
  assert.equal(wrongPhone.data.found, false);
  assert.equal(wrongPhone.data.status, null);
});

test('contact message is saved', async () => {
  const res = await post('/api/contact', { name: 'Yacine', phone: '0770123456', message: 'Bonjour, une question.' });
  assert.equal(res.status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get().n, 1);
});

test('delivery options by wilaya and unknown wilaya is rejected', async () => {
  const ok = await (await fetch(base + '/api/delivery?wilaya=31')).json();
  assert.equal(ok.options.length, 2);
  const bad = await fetch(base + '/api/delivery?wilaya=0');
  assert.equal(bad.status, 400);
});

test('security headers and static path traversal protection', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  const trav = await fetch(base + '/..%2F..%2Fpackage.json');
  assert.notEqual(trav.status, 200);
});

test('unsupported content type and malformed JSON are rejected safely', async () => {
  const bad = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(bad.status, 415);
  const malformed = await fetch(base + '/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops',
  });
  assert.equal(malformed.status, 400);
});
