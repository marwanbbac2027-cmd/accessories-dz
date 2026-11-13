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
const MAX_ORDERS_PER_PHONE_PER_DAY = 3;

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

function discountFor(coupon, subtotal) {
  if (coupon.kind === 'percent') return Math.floor((subtotal * coupon.value) / 100);
  return Math.min(coupon.value, subtotal);
}

// Returns the coupon row if it can be used now, otherwise throws.
function usableCoupon(db, code) {
  const c = db.prepare('SELECT id, code, kind, value, max_uses, uses, is_active FROM coupons WHERE code = ?').get(code);
  if (!c || !c.is_active || (c.max_uses != null && c.uses >= c.max_uses)) {
    throw new ValidationError('كود الخصم غير صالح أو منتهي.', 'couponCode');
  }
  return c;
}

// Validates input, recomputes every price on the server, and stores the order
// atomically. Client-supplied prices, totals and discounts are never trusted.
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
  const couponInput = cleanText(input.couponCode, 40).toUpperCase();

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

  // Limits orders from one phone number per 24 hours (protects against fake cash-on-delivery orders).
  const recent = db.prepare(`SELECT COUNT(*) AS n FROM orders
    WHERE phone = ? AND status NOT IN ('cancelled','rejected')
      AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`).get(phone).n;
  if (recent >= MAX_ORDERS_PER_PHONE_PER_DAY) {
    throw new ValidationError('تم بلوغ الحد المسموح من الطلبات لهذا الرقم اليوم. تواصل معنا مباشرة.', 'phone');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const getProduct = db.prepare(`SELECT id, name_ar, name_fr, price, discount_price, stock, is_active, status
      FROM products WHERE id = ?`);
    const lines = [];
    let subtotal = 0;
    for (const [pid, qty] of qtyByProduct) {
      const p = getProduct.get(pid);
      if (!p || !p.is_active || p.status !== 'approved') {
        throw new ValidationError('أحد المنتجات لم يعد متوفرا.', 'items');
      }
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

    let coupon = null;
    let discount = 0;
    if (couponInput) {
      coupon = usableCoupon(db, couponInput);
      discount = discountFor(coupon, subtotal);
    }
    const total = subtotal - discount + deliveryFee;

    const reference = newReference();
    const info = db.prepare(`INSERT INTO orders
      (reference, idempotency_key, customer_name, phone, phone2, wilaya_code, commune, address,
       delivery_method, delivery_fee, subtotal, total, notes, coupon_code, discount_total)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(reference, idempotencyKey, name, phone, phone2, wilayaCode, commune, address,
        method, deliveryFee, subtotal, total, notes || null, coupon ? coupon.code : null, discount);
    const orderId = Number(info.lastInsertRowid);

    const insItem = db.prepare(`INSERT INTO order_items
      (order_id, product_id, name_ar, name_fr, unit_price, quantity, line_total)
      VALUES (?,?,?,?,?,?,?)`);
    const dec = db.prepare(`UPDATE products SET stock = stock - ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`);
    for (const l of lines) {
      insItem.run(orderId, l.p.id, l.p.name_ar, l.p.name_fr, l.unit, l.qty, l.lineTotal);
      dec.run(l.qty, l.p.id);
    }
    if (coupon) db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').run(coupon.id);
    db.exec('COMMIT');
    return { reference, status: 'pending', total, discount, duplicate: false, customer: name, wilaya: wilayaCode, method };
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

// Public coupon preview. Returns only whether it works and how much it gives.
function checkCoupon(db, code) {
  const c = db.prepare('SELECT kind, value, max_uses, uses, is_active FROM coupons WHERE code = ?')
    .get(cleanText(code, 40).toUpperCase());
  if (!c || !c.is_active || (c.max_uses != null && c.uses >= c.max_uses)) return { valid: false };
  return { valid: true, kind: c.kind, value: c.value };
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
  checkCoupon,
  getActiveDeliveryOptions,
  saveContactMessage,
  normalizePhone,
  cleanText,
  discountFor,
};
