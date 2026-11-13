'use strict';

const crypto = require('node:crypto');

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

const MAX_ITEMS = 30;
const MAX_QTY = 20;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Strip control characters and trim; output is always escaped on render too.
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Algerian mobile numbers: 05/06/07 followed by 8 digits (also accepts +213).
function normalizePhone(value) {
  const digits = String(value || '').replace(/[\s.\-()]/g, '');
  let local = null;
  if (/^0[567]\d{8}$/.test(digits)) local = digits;
  else if (/^\+213[567]\d{8}$/.test(digits)) local = '0' + digits.slice(4);
  else if (/^00213[567]\d{8}$/.test(digits)) local = '0' + digits.slice(5);
  return local;
}

// Landline/mobile secondary number, optional.
function normalizeOptionalPhone(value) {
  if (!value) return null;
  return normalizePhone(value);
}

function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return `ADZ-${code.slice(0, 4)}-${code.slice(4)}`;
}

// Validates input, recomputes every price on the server, and stores the order
// atomically. The client's prices and totals are never read.
function placeOrder(db, input, idempotencyKey) {
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    throw new ValidationError('مفتاح الطلب غير صالح.', 'idempotencyKey');
  }

  // Duplicate submission: return the original order instead of creating another.
  const existing = db.prepare('SELECT reference, status, total FROM orders WHERE idempotency_key = ?')
    .get(idempotencyKey);
  if (existing) return { ...existing, duplicate: true };

  const c = input.customer || {};
  const name = cleanText(c.name, 100);
  const phone = normalizePhone(c.phone);
  const phone2Raw = cleanText(c.phone2, 30);
  const phone2 = normalizeOptionalPhone(phone2Raw);
  const wilayaCode = Number(c.wilaya);
  const commune = cleanText(c.commune, 100);
  const address = cleanText(c.address, 300);
  const notes = cleanText(input.notes, 500);
  const method = input.deliveryMethod;

  if (name.length < 3) throw new ValidationError('الرجاء إدخال الاسم واللقب.', 'name');
  if (!phone) throw new ValidationError('رقم الهاتف غير صحيح (مثال: 0551234567).', 'phone');
  if (phone2Raw && !phone2) throw new ValidationError('رقم الهاتف الثاني غير صحيح.', 'phone2');
  if (!Number.isInteger(wilayaCode) || wilayaCode < 1 || wilayaCode > 58) {
    throw new ValidationError('الرجاء اختيار الولاية.', 'wilaya');
  }
  if (commune.length < 2) throw new ValidationError('الرجاء إدخال البلدية.', 'commune');
  if (address.length < 5) throw new ValidationError('الرجاء إدخال العنوان الكامل.', 'address');
  if (method !== 'home' && method !== 'pickup') {
    throw new ValidationError('الرجاء اختيار مكان التوصيل.', 'deliveryMethod');
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) throw new ValidationError('السلة فارغة.', 'items');
  if (rawItems.length > MAX_ITEMS) throw new ValidationError('عدد المنتجات كبير جدا.', 'items');

  // Merge duplicate product lines and validate each one.
  const qtyByProduct = new Map();
  for (const it of rawItems) {
    const pid = Number(it && it.productId);
    const qty = Number(it && it.quantity);
    if (!Number.isInteger(pid) || pid < 1) throw new ValidationError('منتج غير صالح.', 'items');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new ValidationError('الكمية غير صالحة.', 'items');
    }
    qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + qty);
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const getProduct = db.prepare(`SELECT id, name_ar, name_fr, price, discount_price, stock, is_active
      FROM products WHERE id = ?`);
    const lines = [];
    let subtotal = 0;
    for (const [pid, qty] of qtyByProduct) {
      const p = getProduct.get(pid);
      if (!p || !p.is_active) throw new ValidationError('أحد المنتجات لم يعد متوفرا.', 'items');
      if (p.stock < qty) throw new ValidationError(`الكمية المتوفرة من "${p.name_ar}" غير كافية.`, 'items');
      const unit = p.discount_price != null ? p.discount_price : p.price;
      const lineTotal = unit * qty;
      subtotal += lineTotal;
      lines.push({ p, qty, unit, lineTotal });
    }

    const wil = db.prepare(`SELECT d.fee, d.is_available FROM delivery_settings d
      JOIN wilayas w ON w.code = d.wilaya_code
      WHERE d.wilaya_code = ? AND d.method = ? AND w.is_active = 1`).get(wilayaCode, method);
    if (!wil || !wil.is_available) {
      throw new ValidationError('التوصيل غير متاح لهذه الولاية بهذه الطريقة.', 'deliveryMethod');
    }
    const deliveryFee = wil.fee;
    const total = subtotal + deliveryFee;

    const reference = newReference();
    const ins = db.prepare(`INSERT INTO orders
      (reference, idempotency_key, customer_name, phone, phone2, wilaya_code, commune, address,
       delivery_method, delivery_fee, subtotal, total, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const info = ins.run(reference, idempotencyKey, name, phone, phone2, wilayaCode, commune, address,
      method, deliveryFee, subtotal, total, notes || null);
    const orderId = Number(info.lastInsertRowid);

    const insItem = db.prepare(`INSERT INTO order_items
      (order_id, product_id, name_ar, name_fr, unit_price, quantity, line_total)
      VALUES (?,?,?,?,?,?,?)`);
    const dec = db.prepare('UPDATE products SET stock = stock - ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE id = ?');
    for (const l of lines) {
      insItem.run(orderId, l.p.id, l.p.name_ar, l.p.name_fr, l.unit, l.qty, l.lineTotal);
      dec.run(l.qty, l.p.id);
    }
    db.exec('COMMIT');
    return { reference, status: 'pending', total, duplicate: false };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Public tracking: returns only the status, never customer details or items.
function trackOrder(db, reference, phone) {
  const ref = cleanText(reference, 30).toUpperCase();
  const normalized = normalizePhone(phone);
  if (!/^ADZ-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(ref) || !normalized) return null;
  const row = db.prepare('SELECT status, reference, created_at FROM orders WHERE reference = ? AND phone = ?')
    .get(ref, normalized);
  return row || null;
}

function getActiveDeliveryOptions(db, wilayaCode) {
  return db.prepare(`SELECT method, fee FROM delivery_settings
    WHERE wilaya_code = ? AND is_available = 1 ORDER BY method`).all(wilayaCode);
}

function saveContactMessage(db, input) {
  const name = cleanText(input.name, 100);
  const phone = normalizePhone(input.phone);
  const message = cleanText(input.message, 1000);
  if (name.length < 2) throw new ValidationError('الرجاء إدخال الاسم.', 'name');
  if (!phone) throw new ValidationError('رقم الهاتف غير صحيح.', 'phone');
  if (message.length < 5) throw new ValidationError('الرجاء كتابة رسالة.', 'message');
  db.prepare('INSERT INTO contact_messages (name, phone, message) VALUES (?,?,?)').run(name, phone, message);
  return { ok: true };
}

module.exports = {
  ValidationError,
  placeOrder,
  trackOrder,
  getActiveDeliveryOptions,
  saveContactMessage,
  normalizePhone,
};
