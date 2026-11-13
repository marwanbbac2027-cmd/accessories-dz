'use strict';

process.env.RATE_LIMIT_MAX = '1000'; // tests send many requests from one IP
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
const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adz-test-')), 'test.db');

const validCustomer = {
  name: 'Test Client',
  phone: '0551234567',
  wilaya: 16,
  commune: 'Bab Ezzouar',
  address: 'Rue 1, Cité test, bloc 3',
};

async function call(method, p, body, headers = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

// Seller submits a listing, the owner approves it. Returns the product id.
async function createApprovedProduct(overrides = {}) {
  const listing = {
    title: 'Montre test',
    category: 'watches',
    price: 2000,
    discount_price: 1500,
    stock: 5,
    description: 'Produit de test',
    seller_name: 'Vendeur Test',
    seller_phone: '0661000111',
    image: PNG_DATA_URL,
    ...overrides,
  };
  const created = await call('POST', '/api/listings', listing);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const approved = await call('POST', `/api/admin/listings/${created.data.id}/status`, { status: 'approved' }, ADMIN);
  assert.equal(approved.status, 200);
  return created.data.id;
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

test('fresh store has no sample products and 58 wilayas', async () => {
  const prods = await call('GET', '/api/products');
  assert.deepEqual(prods.data.products, []);
  const wil = await call('GET', '/api/wilayas');
  assert.equal(wil.data.wilayas.length, 58);
  const cats = await call('GET', '/api/categories');
  assert.equal(cats.data.categories.length, 9);
});

test('a seller listing stays hidden until the owner approves it', async () => {
  const created = await call('POST', '/api/listings', {
    title: 'Bague en attente', category: 'rings', price: 1200, stock: 3,
    seller_name: 'Vendeur Attente', seller_phone: '0770000001', image: PNG_DATA_URL,
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, 'pending');

  const before = await call('GET', '/api/products');
  assert.equal(before.data.products.some((p) => p.id === created.data.id), false, 'pending not public');

  const pending = await call('GET', '/api/admin/listings?status=pending', undefined, ADMIN);
  assert.ok(pending.data.listings.some((l) => l.id === created.data.id));

  await call('POST', `/api/admin/listings/${created.data.id}/status`, { status: 'approved' }, ADMIN);
  const after = await call('GET', '/api/products');
  const found = after.data.products.find((p) => p.id === created.data.id);
  assert.ok(found, 'approved product is public');
  assert.equal(found.seller_phone, '0770000001');
  assert.equal(found.seller_wa, '213770000001');
  assert.equal(found.image_url, `/api/products/${created.data.id}/image`);
});

test('listing image is served with its real content type', async () => {
  const id = await createApprovedProduct({ title: 'Image test' });
  const res = await call('GET', `/api/products/${id}/image`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
});

test('listing rejects a file that is not really an image', async () => {
  const fake = 'data:image/png;base64,' + Buffer.from('this is not an image at all').toString('base64');
  const res = await call('POST', '/api/listings', {
    title: 'Faux image', category: 'bags', price: 1000, stock: 1,
    seller_name: 'Test Vendeur', seller_phone: '0550000002', image: fake,
  });
  assert.equal(res.status, 400);
  assert.equal(res.data.field, 'image');
});

test('listing validates price, discount, phone and category', async () => {
  const base = {
    title: 'Sac test', category: 'bags', price: 1000, stock: 1,
    seller_name: 'Test Vendeur', seller_phone: '0550000003', image: PNG_DATA_URL,
  };
  assert.equal((await call('POST', '/api/listings', { ...base, price: 5 })).data.field, 'price');
  assert.equal((await call('POST', '/api/listings', { ...base, discount_price: 1000 })).data.field, 'discount_price');
  assert.equal((await call('POST', '/api/listings', { ...base, seller_phone: '123' })).data.field, 'seller_phone');
  assert.equal((await call('POST', '/api/listings', { ...base, category: 'nope' })).data.field, 'category');
});

test('admin endpoints require the token', async () => {
  const none = await call('GET', '/api/admin/listings');
  assert.equal(none.status, 401);
  const wrong = await call('GET', '/api/admin/listings', undefined, { Authorization: 'Bearer nope' });
  assert.equal(wrong.status, 401);
  const ok = await call('GET', '/api/admin/listings?status=approved', undefined, ADMIN);
  assert.equal(ok.status, 200);
});

test('order uses server prices, ignores client-supplied totals', async () => {
  const id = await createApprovedProduct({ title: 'Prix test', price: 2000, discount_price: 1500 });
  const { status, data } = await call('POST', '/api/orders', {
    customer: validCustomer,
    deliveryMethod: 'home',
    items: [{ productId: id, quantity: 2 }],
    total: 1, subtotal: 1, deliveryFee: 0, unitPrice: 1,
  }, { 'Idempotency-Key': 'key-server-price-001' });
  assert.equal(status, 201);
  const fee = db.prepare("SELECT fee FROM delivery_settings WHERE wilaya_code = 16 AND method = 'home'").get().fee;
  assert.equal(data.total, 1500 * 2 + fee);
  assert.match(data.reference, /^ADZ-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('a pending product cannot be ordered', async () => {
  const created = await call('POST', '/api/listings', {
    title: 'Non publié', category: 'other', price: 900, stock: 2,
    seller_name: 'Test Vendeur', seller_phone: '0550000004', image: PNG_DATA_URL,
  });
  const res = await call('POST', '/api/orders', {
    customer: validCustomer, deliveryMethod: 'home', items: [{ productId: created.data.id, quantity: 1 }],
  }, { 'Idempotency-Key': 'pending-order-key-1' });
  assert.equal(res.status, 400);
});

test('duplicate submissions with the same key create one order', async () => {
  const id = await createApprovedProduct({ title: 'Doublon test', stock: 4 });
  const before = db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
  const body = { customer: validCustomer, deliveryMethod: 'pickup', items: [{ productId: id, quantity: 1 }] };
  const first = await call('POST', '/api/orders', body, { 'Idempotency-Key': 'dup-key-abcdef' });
  const second = await call('POST', '/api/orders', body, { 'Idempotency-Key': 'dup-key-abcdef' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.reference, first.data.reference);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock, before - 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?').get('dup-key-abcdef').n, 1);
});

test('stock is enforced and a failed order changes nothing', async () => {
  const id = await createApprovedProduct({ title: 'Stock test', stock: 2 });
  const before = db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
  const ordersBefore = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  const res = await call('POST', '/api/orders', {
    customer: validCustomer, deliveryMethod: 'home', items: [{ productId: id, quantity: 9 }],
  }, { 'Idempotency-Key': 'too-many-items-1' });
  assert.equal(res.status, 400);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock, before);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, ordersBefore);
});

test('order validation rejects bad phone, wilaya and empty cart', async () => {
  const id = await createApprovedProduct({ title: 'Validation test' });
  const bad = await call('POST', '/api/orders', {
    customer: { ...validCustomer, phone: '12345' }, deliveryMethod: 'home', items: [{ productId: id, quantity: 1 }],
  }, { 'Idempotency-Key': 'bad-phone-key-1' });
  assert.equal(bad.data.field, 'phone');
  const wil = await call('POST', '/api/orders', {
    customer: { ...validCustomer, wilaya: 99 }, deliveryMethod: 'home', items: [{ productId: id, quantity: 1 }],
  }, { 'Idempotency-Key': 'bad-wilaya-key-1' });
  assert.equal(wil.data.field, 'wilaya');
  const empty = await call('POST', '/api/orders', { customer: validCustomer, deliveryMethod: 'home', items: [] },
    { 'Idempotency-Key': 'empty-cart-key-1' });
  assert.equal(empty.status, 400);
});

test('order persists with items and status pending', async () => {
  const id = await createApprovedProduct({ title: 'Persist test' });
  const res = await call('POST', '/api/orders', {
    customer: validCustomer, deliveryMethod: 'home', items: [{ productId: id, quantity: 1 }], notes: '<b>x</b>',
  }, { 'Idempotency-Key': 'persist-key-0001' });
  assert.equal(res.status, 201);
  const row = db.prepare('SELECT status, notes FROM orders WHERE reference = ?').get(res.data.reference);
  assert.equal(row.status, 'pending');
  assert.equal(row.notes, '<b>x</b>', 'stored as text, escaped on render');
});

test('tracking requires reference and matching phone, reveals only status', async () => {
  const id = await createApprovedProduct({ title: 'Track test' });
  const res = await call('POST', '/api/orders', {
    customer: { ...validCustomer, phone: '0661112233' }, deliveryMethod: 'home', items: [{ productId: id, quantity: 1 }],
  }, { 'Idempotency-Key': 'track-key-000001' });
  const ok = await call('POST', '/api/track', { reference: res.data.reference, phone: '0661112233' });
  assert.equal(ok.data.found, true);
  assert.equal(ok.data.status, 'pending');
  assert.deepEqual(Object.keys(ok.data).sort(), ['found', 'reference', 'status']);
  const wrong = await call('POST', '/api/track', { reference: res.data.reference, phone: '0770000000' });
  assert.equal(wrong.data.found, false);
});

test('buyer can message a seller; it is stored and visible only to the owner', async () => {
  const id = await createApprovedProduct({ title: 'Message test' });
  const sent = await call('POST', `/api/products/${id}/messages`, {
    name: 'Acheteur Test', phone: '0550123456', message: 'Est-ce disponible en taille unique ?',
  });
  assert.equal(sent.status, 201);

  const publicView = await call('GET', '/api/products');
  assert.ok(!JSON.stringify(publicView.data).includes('Est-ce disponible'), 'message not public');

  const owner = await call('GET', '/api/admin/messages', undefined, ADMIN);
  assert.ok(owner.data.messages.some((m) => m.product_id === id && m.phone === '0550123456'));
  const denied = await call('GET', '/api/admin/messages');
  assert.equal(denied.status, 401);
});

test('messages to a pending or unknown product are refused', async () => {
  const created = await call('POST', '/api/listings', {
    title: 'Message pending', category: 'other', price: 900, stock: 2,
    seller_name: 'Test Vendeur', seller_phone: '0550000005', image: PNG_DATA_URL,
  });
  const pending = await call('POST', `/api/products/${created.data.id}/messages`, {
    name: 'Test Acheteur', phone: '0550123457', message: 'Bonjour, question test',
  });
  assert.equal(pending.status, 404);
  const unknown = await call('POST', '/api/products/999999/messages', {
    name: 'Test Acheteur', phone: '0550123457', message: 'Bonjour, question test',
  });
  assert.equal(unknown.status, 404);
});

test('contact message is saved', async () => {
  const res = await call('POST', '/api/contact', { name: 'Yacine', phone: '0770123456', message: 'Bonjour, une question.' });
  assert.equal(res.status, 201);
});

test('delivery options by wilaya; unknown wilaya is rejected', async () => {
  const ok = await call('GET', '/api/delivery?wilaya=31');
  assert.equal(ok.data.options.length, 2);
  const bad = await call('GET', '/api/delivery?wilaya=0');
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
