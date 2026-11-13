'use strict';

const { ValidationError, cleanText, discountFor } = require('./orders');

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'];
const CLOSED = ['cancelled', 'rejected'];

function notFound() {
  const e = new Error('not found');
  e.status = 404;
  return e;
}

function listOrders(db, { status, q } = {}) {
  const where = [];
  const params = [];
  if (status && ORDER_STATUSES.includes(status)) { where.push('o.status = ?'); params.push(status); }
  const term = cleanText(q || '', 60);
  if (term) {
    where.push('(o.reference LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ?)');
    const like = `%${term}%`;
    params.push(like, like, like);
  }
  const sql = `SELECT o.id, o.reference, o.status, o.customer_name, o.phone, o.phone2, o.wilaya_code,
      w.name_ar AS wilaya, o.delivery_method, o.total, o.discount_total, o.coupon_code, o.created_at
    FROM orders o JOIN wilayas w ON w.code = o.wilaya_code
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY o.id DESC LIMIT 200`;
  return db.prepare(sql).all(...params);
}

function orderDetail(db, id) {
  const o = db.prepare(`SELECT o.*, w.name_ar AS wilaya_name_ar, w.name_fr AS wilaya_name_fr
    FROM orders o JOIN wilayas w ON w.code = o.wilaya_code WHERE o.id = ?`).get(id);
  if (!o) throw notFound();
  const items = db.prepare(`SELECT product_id, name_ar, name_fr, unit_price, quantity, line_total
    FROM order_items WHERE order_id = ? ORDER BY id`).all(id);
  return { ...o, items };
}

// Changing status. Cancelling or rejecting returns stock and coupon use; a closed order cannot be reopened.
function setOrderStatus(db, id, status) {
  if (!ORDER_STATUSES.includes(status)) throw new ValidationError('حالة غير صالحة.', 'status');
  db.exec('BEGIN IMMEDIATE');
  try {
    const o = db.prepare('SELECT id, status, coupon_code FROM orders WHERE id = ?').get(id);
    if (!o) throw notFound();
    if (o.status !== status) {
      if (CLOSED.includes(status) && !CLOSED.includes(o.status)) {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
        const restore = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const it of items) restore.run(it.quantity, it.product_id);
        if (o.coupon_code) {
          db.prepare('UPDATE coupons SET uses = MAX(uses - 1, 0) WHERE code = ?').run(o.coupon_code);
        }
      }
      if (!CLOSED.includes(status) && CLOSED.includes(o.status)) {
        throw new ValidationError('لا يمكن إعادة فتح طلب ملغى أو مرفوض.', 'status');
      }
      db.prepare(`UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
        .run(status, id);
    }
    db.exec('COMMIT');
    return { id, status };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function setOrderNotes(db, id, notes) {
  const clean = cleanText(notes, 1000);
  const res = db.prepare(`UPDATE orders SET admin_notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(clean || null, id);
  if (res.changes === 0) throw notFound();
  return { id, ok: true };
}

function listCoupons(db) {
  return db.prepare('SELECT id, code, kind, value, max_uses, uses, is_active, created_at FROM coupons ORDER BY id DESC').all();
}

function createCoupon(db, input) {
  const code = cleanText(input.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 3) throw new ValidationError('الكود يجب أن يكون 3 أحرف على الأقل (أحرف وأرقام إنجليزية).', 'code');
  const kind = input.kind;
  if (kind !== 'percent' && kind !== 'amount') throw new ValidationError('نوع الخصم غير صالح.', 'kind');
  const value = Number(input.value);
  if (!Number.isInteger(value) || value <= 0 || (kind === 'percent' && value > 100)) {
    throw new ValidationError('قيمة الخصم غير صالحة.', 'value');
  }
  let maxUses = null;
  if (input.max_uses !== '' && input.max_uses != null) {
    maxUses = Number(input.max_uses);
    if (!Number.isInteger(maxUses) || maxUses < 1) throw new ValidationError('عدد الاستعمالات غير صالح.', 'max_uses');
  }
  try {
    const info = db.prepare('INSERT INTO coupons (code, kind, value, max_uses) VALUES (?,?,?,?)')
      .run(code, kind, value, maxUses);
    return { id: Number(info.lastInsertRowid), code };
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new ValidationError('هذا الكود موجود مسبقًا.', 'code');
    throw err;
  }
}

function setCouponActive(db, id, active) {
  const res = db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (res.changes === 0) throw notFound();
  return { id, is_active: Boolean(active) };
}

function stats(db) {
  const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const totals = db.prepare(`SELECT COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) AS revenue_delivered,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','rejected') THEN total ELSE 0 END), 0) AS revenue_open
    FROM orders`).get();
  const daily = db.prepare(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS orders, SUM(total) AS total
    FROM orders WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 day')
    GROUP BY day ORDER BY day`).all();
  const byWilaya = db.prepare(`SELECT w.name_ar AS wilaya, COUNT(*) AS orders
    FROM orders o JOIN wilayas w ON w.code = o.wilaya_code
    GROUP BY o.wilaya_code ORDER BY orders DESC LIMIT 10`).all();
  const visits = db.prepare('SELECT day, count FROM visits WHERE day >= date(\'now\', \'-30 day\') ORDER BY day').all();
  return { totals, byStatus, daily, byWilaya, visits };
}

function recordVisit(db) {
  const day = new Date().toISOString().slice(0, 10);
  db.prepare(`INSERT INTO visits (day, count) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET count = count + 1`).run(day);
  return { ok: true };
}

// Optional Telegram alerts. Enabled only when both env variables are set. Never blocks a request.
function notify(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 3500) }),
  }).catch((err) => console.error('[notify]', err.message));
}

module.exports = {
  ORDER_STATUSES,
  listOrders,
  orderDetail,
  setOrderStatus,
  setOrderNotes,
  listCoupons,
  createCoupon,
  setCouponActive,
  stats,
  recordVisit,
  notify,
  discountFor,
};
