'use strict';

const crypto = require('node:crypto');
const { ValidationError, cleanText, normalizePhone } = require('./orders');

const CATEGORY_SLUGS = ['watches', 'bracelets', 'necklaces', 'rings', 'mens', 'womens', 'phone', 'bags', 'other'];
const STATUSES = ['pending', 'approved', 'rejected'];
const IMAGE_MAX_BYTES = 1024 * 1024;

// Checks the real file signature, not just the declared type.
function detectImageMime(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function decodeImage(dataUrl) {
  if (typeof dataUrl !== 'string') throw new ValidationError('الرجاء رفع صورة للمنتج.', 'image');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) throw new ValidationError('صيغة الصورة غير مدعومة (JPG أو PNG أو WEBP).', 'image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length === 0 || buf.length > IMAGE_MAX_BYTES) {
    throw new ValidationError('حجم الصورة يجب ألا يتجاوز 1 ميغابايت.', 'image');
  }
  const real = detectImageMime(buf);
  if (!real || real !== m[1]) throw new ValidationError('ملف الصورة غير صالح.', 'image');
  return { buf, mime: real };
}

// A seller submits a product. It stays hidden (status "pending") until the owner approves it.
function createListing(db, input) {
  const title = cleanText(input.title, 120);
  if (title.length < 3) throw new ValidationError('اسم المنتج قصير جدا.', 'title');

  const category = String(input.category || '');
  if (!CATEGORY_SLUGS.includes(category)) throw new ValidationError('الرجاء اختيار الفئة.', 'category');

  const price = Number(input.price);
  if (!Number.isInteger(price) || price < 100 || price > 10000000) {
    throw new ValidationError('السعر يجب أن يكون بين 100 و 10000000 دج.', 'price');
  }

  let discount = null;
  if (input.discount_price !== '' && input.discount_price != null) {
    discount = Number(input.discount_price);
    if (!Number.isInteger(discount) || discount <= 0 || discount >= price) {
      throw new ValidationError('سعر الخصم يجب أن يكون أقل من السعر الأصلي.', 'discount_price');
    }
  }

  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 1 || stock > 999) {
    throw new ValidationError('الكمية يجب أن تكون بين 1 و 999.', 'stock');
  }

  const description = cleanText(input.description, 1000);
  const sellerName = cleanText(input.seller_name, 100);
  if (sellerName.length < 2) throw new ValidationError('الرجاء إدخال اسم البائع.', 'seller_name');

  const sellerPhone = normalizePhone(input.seller_phone);
  if (!sellerPhone) throw new ValidationError('رقم هاتف البائع غير صحيح.', 'seller_phone');

  const { buf, mime } = decodeImage(input.image);
  const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(category);
  const sku = 'L-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const info = db.prepare(`INSERT INTO products
    (sku, category_id, name_ar, name_fr, desc_ar, desc_fr, price, discount_price, stock, is_active, tone,
     seller_name, seller_phone, status, image_data, image_mime)
    VALUES (?,?,?,?,?,?,?,?,?,0,'#2b2f36',?,?,'pending',?,?)`)
    .run(sku, cat.id, title, title, description, description, price, discount, stock,
      sellerName, sellerPhone, buf, mime);
  return { id: Number(info.lastInsertRowid), status: 'pending' };
}

function setListingStatus(db, id, status) {
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new ValidationError('حالة غير صالحة.', 'status');
  }
  const res = db.prepare(`UPDATE products SET status = ?, is_active = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(status, status === 'approved' ? 1 : 0, id);
  if (res.changes === 0) {
    const e = new Error('not found');
    e.status = 404;
    throw e;
  }
  return { id, status };
}

function adminListListings(db, status) {
  const st = STATUSES.includes(status) ? status : 'pending';
  return db.prepare(`SELECT p.id, p.name_ar AS title, p.price, p.discount_price, p.stock, p.status,
      p.seller_name, p.seller_phone, p.desc_ar AS description, c.slug AS category,
      (p.image_mime IS NOT NULL) AS has_image, p.created_at
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.status = ? ORDER BY p.id DESC LIMIT 200`).all(st)
    .map((r) => ({ ...r, has_image: Boolean(r.has_image) }));
}

// approvedOnly: public requests only see approved, active products.
function getImage(db, id, approvedOnly) {
  const row = approvedOnly
    ? db.prepare("SELECT image_data, image_mime FROM products WHERE id = ? AND status = 'approved' AND is_active = 1").get(id)
    : db.prepare('SELECT image_data, image_mime FROM products WHERE id = ?').get(id);
  if (!row || !row.image_data) return null;
  return { data: Buffer.from(row.image_data), mime: row.image_mime };
}

// A buyer's message to a seller. Stored for the owner to pass on; never shown publicly.
function createMessage(db, productId, input) {
  const product = db.prepare("SELECT id FROM products WHERE id = ? AND status = 'approved' AND is_active = 1").get(productId);
  if (!product) {
    const e = new Error('not found');
    e.status = 404;
    throw e;
  }
  const name = cleanText(input.name, 100);
  const phone = normalizePhone(input.phone);
  const message = cleanText(input.message, 1000);
  if (name.length < 2) throw new ValidationError('الرجاء إدخال الاسم.', 'name');
  if (!phone) throw new ValidationError('رقم الهاتف غير صحيح.', 'phone');
  if (message.length < 5) throw new ValidationError('الرجاء كتابة رسالة.', 'message');
  db.prepare('INSERT INTO product_messages (product_id, name, phone, message) VALUES (?,?,?,?)')
    .run(productId, name, phone, message);
  return { ok: true };
}

function listMessages(db) {
  return db.prepare(`SELECT m.id, m.product_id, p.name_ar AS product, m.name, m.phone, m.message, m.created_at
    FROM product_messages m JOIN products p ON p.id = m.product_id
    ORDER BY m.id DESC LIMIT 200`).all();
}

module.exports = {
  CATEGORY_SLUGS,
  createListing,
  setListingStatus,
  adminListListings,
  getImage,
  createMessage,
  listMessages,
};
