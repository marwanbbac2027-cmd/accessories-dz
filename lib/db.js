'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { WILAYAS, DEFAULT_DELIVERY, SEED_CATEGORIES, SEED_PRODUCTS } = require('./data');

// Migrations are applied in order; the version is tracked in PRAGMA user_version.
const MIGRATIONS = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL
  );
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    desc_ar TEXT NOT NULL DEFAULT '',
    desc_fr TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 0),
    discount_price INTEGER CHECK (discount_price IS NULL OR discount_price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    tone TEXT NOT NULL DEFAULT '#1f2a36',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_products_category ON products(category_id);
  CREATE TABLE wilayas (
    code INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE delivery_settings (
    id INTEGER PRIMARY KEY,
    wilaya_code INTEGER NOT NULL REFERENCES wilayas(code),
    method TEXT NOT NULL CHECK (method IN ('home','pickup')),
    fee INTEGER NOT NULL CHECK (fee >= 0),
    is_available INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (wilaya_code, method)
  );
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','confirmed','preparing','shipped','out_for_delivery','delivered','cancelled','rejected')),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone2 TEXT,
    wilaya_code INTEGER NOT NULL REFERENCES wilayas(code),
    commune TEXT NOT NULL,
    address TEXT NOT NULL,
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('home','pickup')),
    delivery_fee INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_orders_phone ON orders(phone);
  CREATE INDEX idx_orders_created ON orders(created_at);
  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total INTEGER NOT NULL
  );
  CREATE INDEX idx_order_items_order ON order_items(order_id);
  CREATE TABLE contact_messages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
];

function openDatabase(file) {
  if (file !== ':memory:') {
    const fs = require('node:fs');
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  seedIfEmpty(db);
}

// Seeds reference data only once. Products are sample data the owner replaces.
function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;

  db.exec('BEGIN');
  try {
    const insCat = db.prepare('INSERT INTO categories (slug, name_ar, name_fr) VALUES (?,?,?)');
    for (const c of SEED_CATEGORIES) insCat.run(c.slug, c.name_ar, c.name_fr);

    const insWil = db.prepare('INSERT INTO wilayas (code, name_ar, name_fr) VALUES (?,?,?)');
    const insDel = db.prepare('INSERT INTO delivery_settings (wilaya_code, method, fee) VALUES (?,?,?)');
    for (const w of WILAYAS) {
      insWil.run(w.code, w.name_ar, w.name_fr);
      insDel.run(w.code, 'home', DEFAULT_DELIVERY.home);
      insDel.run(w.code, 'pickup', DEFAULT_DELIVERY.pickup);
    }

    const catId = db.prepare('SELECT id FROM categories WHERE slug = ?');
    const insProd = db.prepare(`INSERT INTO products
      (sku, category_id, name_ar, name_fr, desc_ar, desc_fr, price, discount_price, stock, tone)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const p of SEED_PRODUCTS) {
      const cid = catId.get(p.category).id;
      insProd.run(p.sku, cid, p.name_ar, p.name_fr, p.desc_ar, p.desc_fr,
        p.price, p.discount_price, p.stock, p.tone);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDatabase };
