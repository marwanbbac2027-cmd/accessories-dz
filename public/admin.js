(() => {
  'use strict';

  // The admin token lives only in this page's memory. It is never written to storage.
  let token = '';

  const $ = (sel) => document.querySelector(sel);
  const fmt = (n) => `${Number(n || 0).toLocaleString('en-US')} دج`;

  // Builds elements with textContent only, so no database value is ever parsed as HTML.
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key === 'value') node.value = value;
      else if (key === 'on') for (const [ev, fn] of Object.entries(value)) node.addEventListener(ev, fn);
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child !== null && child !== undefined) node.append(child);
    return node;
  }

  const STATUS_LABELS = {
    pending: 'جديد', confirmed: 'مؤكد', preparing: 'قيد التحضير', shipped: 'تم الشحن',
    out_for_delivery: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغى', rejected: 'مرفوض',
  };
  const LISTING_LABELS = { pending: 'قيد المراجعة', approved: 'منشور', rejected: 'مرفوض' };

  function flash(text, ok = false) {
    const m = $('#adminMsg');
    m.className = ok ? 'form-msg ok' : 'form-msg error';
    m.textContent = text;
    if (ok) setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, 2500);
  }

  async function api(path, opts = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'خطأ غير متوقع.');
      err.status = res.status;
      err.field = data.field;
      throw err;
    }
    return data;
  }

  // Loads an image with the token and shows it through a local blob URL.
  async function loadImage(imgEl, id) {
    try {
      const res = await fetch(`/api/admin/listings/${id}/image`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      imgEl.src = URL.createObjectURL(await res.blob());
    } catch { /* image is optional */ }
  }

  const waLink = (phone) => `https://wa.me/213${String(phone || '').slice(1)}`;
  const telLink = (phone) => `tel:+213${String(phone || '').slice(1)}`;

  // ---------- Tabs ----------
  const loaders = {
    orders: () => loadOrders(),
    review: () => loadListings('review'),
    products: () => loadListings('products'),
    messages: () => loadMessages(),
    coupons: () => loadCoupons(),
    stats: () => loadStats(),
    backup: () => {},
  };

  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('[data-section]').forEach((s) => { s.hidden = s.dataset.section !== name; });
    loaders[name]();
  }

  // ---------- Orders ----------
  function fillOrderStatusFilter() {
    const sel = $('#orderStatus');
    sel.replaceChildren(el('option', { value: '', text: 'كل الطلبات' }));
    for (const [key, label] of Object.entries(STATUS_LABELS)) sel.append(el('option', { value: key, text: label }));
  }

  async function loadOrders() {
    const status = $('#orderStatus').value;
    const q = $('#orderQ').value.trim();
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    const { orders } = await api(`/api/admin/orders?${qs}`);
    const list = $('#orderList');
    list.replaceChildren();
    if (!orders.length) list.append(el('p', { class: 'muted', text: 'لا توجد طلبات.' }));
    for (const o of orders) {
      list.append(el('article', { class: 'acard' }, [
        el('h3', { text: `${o.reference} — ${o.customer_name}` }),
        el('p', { class: 'small', text: `${o.phone} · ${o.wilaya} · ${o.delivery_method === 'home' ? 'توصيل للمنزل' : 'نقطة استلام'}` }),
        el('p', { class: 'small', text: `${fmt(o.total)}${o.coupon_code ? ` · كوبون ${o.coupon_code}` : ''} · ${STATUS_LABELS[o.status] || o.status}` }),
        el('div', { class: 'actions' }, [
          el('button', { type: 'button', text: 'تفاصيل', on: { click: () => showOrder(o.id) } }),
        ]),
      ]));
    }
  }

  async function showOrder(id) {
    const { order } = await api(`/api/admin/orders/${id}`);
    const box = $('#orderDetail');
    box.hidden = false;
    box.replaceChildren();

    const statusSel = el('select', { 'aria-label': 'الحالة' });
    for (const [key, label] of Object.entries(STATUS_LABELS)) {
      statusSel.append(el('option', { value: key, text: label, ...(key === order.status ? { selected: 'selected' } : {}) }));
    }
    const notes = el('textarea', { rows: '3', maxlength: '1000', 'aria-label': 'ملاحظات داخلية' });
    notes.value = order.admin_notes || '';

    const items = el('ul', {}, order.items.map((it) =>
      el('li', { text: `${it.name_ar} × ${it.quantity} = ${fmt(it.line_total)}` })));

    box.append(
      el('h3', { text: `الطلب ${order.reference}` }),
      el('p', { text: `${order.customer_name} · ${order.phone}${order.phone2 ? ' / ' + order.phone2 : ''}` }),
      el('p', { class: 'small', text: `${order.wilaya_name_ar} · ${order.commune} · ${order.address}` }),
      order.notes ? el('p', { class: 'small', text: `ملاحظة الزبون: ${order.notes}` }) : null,
      items,
      el('p', { text: `المنتجات ${fmt(order.subtotal)} · الخصم ${fmt(order.discount_total)} · التوصيل ${fmt(order.delivery_fee)} · المجموع ${fmt(order.total)}` }),
      el('div', { class: 'actions' }, [
        el('a', { href: telLink(order.phone), text: 'اتصال' }),
        el('a', { href: waLink(order.phone), target: '_blank', rel: 'noopener', text: 'واتساب' }),
        el('button', { type: 'button', text: 'نسخ الرقم', on: { click: () => navigator.clipboard?.writeText(order.phone) } }),
      ]),
      el('label', {}, [el('span', { text: 'حالة الطلب' }), statusSel]),
      el('button', {
        type: 'button', class: 'primary', text: 'حفظ الحالة',
        on: { click: async () => {
          try {
            await api(`/api/admin/orders/${id}/status`, { method: 'POST', body: { status: statusSel.value } });
            flash('تم حفظ الحالة.', true);
            await showOrder(id);
            loadOrders();
          } catch (err) { flash(err.message); }
        } },
      }),
      el('label', {}, [el('span', { text: 'ملاحظات داخلية (لا تظهر للزبون)' }), notes]),
      el('button', {
        type: 'button', text: 'حفظ الملاحظة',
        on: { click: async () => {
          try {
            await api(`/api/admin/orders/${id}/notes`, { method: 'POST', body: { notes: notes.value } });
            flash('تم حفظ الملاحظة.', true);
          } catch (err) { flash(err.message); }
        } },
      }),
    );
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Listings: review (pending/rejected) and products (approved) ----------
  async function loadListings(mode) {
    const status = mode === 'review' ? $('#reviewStatus').value : 'approved';
    const { listings } = await api(`/api/admin/listings?status=${status}`);
    const box = $(mode === 'review' ? '#reviewList' : '#productList');
    box.replaceChildren();
    if (!listings.length) box.append(el('p', { class: 'muted', text: 'لا توجد منتجات في هذا القسم.' }));
    for (const p of listings) box.append(mode === 'review' ? reviewCard(p) : productCard(p));
  }

  function reviewCard(p) {
    const img = el('img', { alt: p.title, loading: 'lazy' });
    if (p.has_image) loadImage(img, p.id);
    return el('article', { class: 'acard' }, [
      img,
      el('h3', { text: p.title }),
      el('p', { class: 'small', text: `${p.category} · ${fmt(p.price)}${p.discount_price ? ` (خصم ${fmt(p.discount_price)})` : ''} · الكمية ${p.stock}` }),
      el('p', { class: 'small', text: `البائع: ${p.seller_name} · ${p.seller_phone}` }),
      el('p', { class: 'small', text: p.description }),
      el('p', { class: 'small muted', text: `${LISTING_LABELS[p.status]} · رقم ${p.id}` }),
      el('div', { class: 'actions' }, [
        p.status !== 'approved' ? el('button', { type: 'button', class: 'primary', text: 'نشر', on: { click: () => setListingStatus(p.id, 'approved') } }) : null,
        p.status !== 'rejected' ? el('button', { type: 'button', class: 'danger', text: 'رفض', on: { click: () => setListingStatus(p.id, 'rejected') } }) : null,
        el('a', { href: waLink(p.seller_phone), target: '_blank', rel: 'noopener', text: 'واتساب البائع' }),
      ]),
    ]);
  }

  function productCard(p) {
    const img = el('img', { alt: p.title, loading: 'lazy' });
    if (p.has_image) loadImage(img, p.id);
    const price = el('input', { type: 'number', min: '100', step: '1', value: String(p.price), 'aria-label': 'السعر', dir: 'ltr' });
    const discount = el('input', { type: 'number', min: '1', step: '1', value: p.discount_price ?? '', placeholder: 'بدون خصم', 'aria-label': 'سعر الخصم', dir: 'ltr' });
    const stock = el('input', { type: 'number', min: '0', step: '1', value: String(p.stock), 'aria-label': 'الكمية', dir: 'ltr' });
    return el('article', { class: 'acard' }, [
      img,
      el('h3', { text: p.title }),
      el('p', { class: 'small', text: `البائع: ${p.seller_name} · ${p.seller_phone}` }),
      el('label', {}, [el('span', { text: 'السعر' }), price]),
      el('label', {}, [el('span', { text: 'سعر الخصم' }), discount]),
      el('label', {}, [el('span', { text: 'الكمية' }), stock]),
      el('div', { class: 'actions' }, [
        el('button', {
          type: 'button', class: 'primary', text: 'حفظ',
          on: { click: async () => {
            try {
              await api(`/api/admin/products/${p.id}`, { method: 'PATCH', body: {
                price: price.value,
                discount_price: discount.value === '' ? null : discount.value,
                stock: stock.value,
              } });
              flash('تم حفظ المنتج.', true);
            } catch (err) { flash(err.message); }
          } },
        }),
        el('button', { type: 'button', text: 'إيقاف مؤقت', on: { click: () => toggleActive(p.id, false) } }),
        el('button', { type: 'button', text: 'إعادة التفعيل', on: { click: () => toggleActive(p.id, true) } }),
        el('button', { type: 'button', class: 'danger', text: 'حذف', on: { click: () => removeProduct(p.id, p.title) } }),
      ]),
    ]);
  }

  async function setListingStatus(id, status) {
    try {
      await api(`/api/admin/listings/${id}/status`, { method: 'POST', body: { status } });
      flash(status === 'approved' ? 'تم نشر المنتج.' : 'تم رفض المنتج.', true);
      loadListings('review');
    } catch (err) { flash(err.message); }
  }

  async function toggleActive(id, active) {
    try {
      await api(`/api/admin/products/${id}`, { method: 'PATCH', body: { is_active: active } });
      flash(active ? 'تم تفعيل المنتج.' : 'تم إيقاف المنتج مؤقتًا.', true);
    } catch (err) { flash(err.message); }
  }

  async function removeProduct(id, title) {
    if (!confirm(`حذف "${title}" نهائيًا؟ لا يمكن التراجع.`)) return;
    try {
      await api(`/api/admin/products/${id}`, { method: 'DELETE' });
      flash('تم حذف المنتج.', true);
      loadListings('products');
    } catch (err) { flash(err.message); }
  }

  // ---------- Messages ----------
  async function loadMessages() {
    const { messages } = await api('/api/admin/messages');
    const box = $('#messageList');
    box.replaceChildren();
    if (!messages.length) box.append(el('p', { class: 'muted', text: 'لا توجد رسائل.' }));
    for (const m of messages) {
      box.append(el('article', { class: 'acard' }, [
        el('h3', { text: `${m.name} — ${m.product}` }),
        el('p', { class: 'small', text: `${m.phone} · ${m.created_at.slice(0, 16).replace('T', ' ')}` }),
        el('p', { text: m.message }),
        el('div', { class: 'actions' }, [el('a', { href: waLink(m.phone), target: '_blank', rel: 'noopener', text: 'واتساب' })]),
      ]));
    }
  }

  // ---------- Coupons ----------
  async function loadCoupons() {
    const { coupons } = await api('/api/admin/coupons');
    const box = $('#couponList');
    box.replaceChildren();
    if (!coupons.length) box.append(el('p', { class: 'muted', text: 'لا توجد كوبونات بعد.' }));
    for (const c of coupons) {
      const value = c.kind === 'percent' ? `${c.value}%` : fmt(c.value);
      const uses = c.max_uses == null ? `${c.uses} استعمال` : `${c.uses} / ${c.max_uses}`;
      box.append(el('article', { class: 'acard' }, [
        el('h3', { text: `${c.code} — ${value}` }),
        el('p', { class: 'small', text: `${uses} · ${c.is_active ? 'فعّال' : 'موقوف'}` }),
        el('div', { class: 'actions' }, [
          el('button', {
            type: 'button', text: c.is_active ? 'إيقاف' : 'تفعيل',
            on: { click: async () => {
              try {
                await api(`/api/admin/coupons/${c.id}/active`, { method: 'POST', body: { active: !c.is_active } });
                loadCoupons();
              } catch (err) { flash(err.message); }
            } },
          }),
        ]),
      ]));
    }
  }

  function bindCouponForm() {
    $('#couponForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      try {
        await api('/api/admin/coupons', { method: 'POST', body: {
          code: fd.get('code'),
          kind: fd.get('kind'),
          value: fd.get('value'),
          max_uses: fd.get('max_uses'),
        } });
        form.reset();
        flash('تم إنشاء الكوبون.', true);
        loadCoupons();
      } catch (err) { flash(err.message); }
    });
  }

  // ---------- Stats ----------
  function table(headers, rows) {
    return el('table', { class: 'admin-table' }, [
      el('thead', {}, [el('tr', {}, headers.map((h) => el('th', { text: h })))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: String(c) }))))),
    ]);
  }

  async function loadStats() {
    const s = await api('/api/admin/stats');
    const box = $('#statsBox');
    box.replaceChildren(
      el('div', { class: 'acard' }, [
        el('h2', { class: 'section-title', text: 'الملخص' }),
        el('p', { text: `عدد الطلبات: ${s.totals.orders}` }),
        el('p', { text: `إيرادات مسلّمة: ${fmt(s.totals.revenue_delivered)}` }),
        el('p', { text: `إيرادات الطلبات المفتوحة: ${fmt(s.totals.revenue_open)}` }),
      ]),
      el('div', { class: 'acard' }, [
        el('h2', { class: 'section-title', text: 'حسب الحالة' }),
        table(['الحالة', 'العدد'], s.byStatus.map((r) => [STATUS_LABELS[r.status] || r.status, r.n])),
      ]),
      el('div', { class: 'acard' }, [
        el('h2', { class: 'section-title', text: 'آخر 30 يومًا' }),
        table(['اليوم', 'الطلبات', 'المجموع'], s.daily.map((r) => [r.day, r.orders, fmt(r.total)])),
      ]),
      el('div', { class: 'acard' }, [
        el('h2', { class: 'section-title', text: 'أعلى الولايات طلبًا' }),
        table(['الولاية', 'الطلبات'], s.byWilaya.map((r) => [r.wilaya, r.orders])),
      ]),
      el('div', { class: 'acard' }, [
        el('h2', { class: 'section-title', text: 'الزيارات (آخر 30 يومًا)' }),
        table(['اليوم', 'الزيارات'], s.visits.map((r) => [r.day, r.count])),
      ]),
    );
  }

  // ---------- Backup ----------
  function bindBackup() {
    $('#backupBtn').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/backup', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('تعذّر تنزيل النسخة.');
        const url = URL.createObjectURL(await res.blob());
        const a = el('a', { href: url, download: `accessories-dz-${new Date().toISOString().slice(0, 10)}.db` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) { flash(err.message); }
    });
  }

  // ---------- Login ----------
  async function login() {
    const input = $('#tokenInput');
    const msg = $('#loginMsg');
    token = input.value.trim();
    msg.textContent = '';
    try {
      await api('/api/admin/stats');
      input.value = '';
      $('#loginView').hidden = true;
      $('#panel').hidden = false;
      showTab('orders');
    } catch (err) {
      token = '';
      msg.className = 'form-msg error';
      msg.textContent = err.status === 401 ? 'رمز الإدارة غير صحيح.' : 'تعذّر الاتصال. حاول مرة أخرى.';
    }
  }

  function init() {
    fillOrderStatusFilter();
    $('#loginBtn').addEventListener('click', login);
    $('#tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
    document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#orderSearch').addEventListener('click', () => loadOrders().catch((e) => flash(e.message)));
    $('#orderStatus').addEventListener('change', () => loadOrders().catch((e) => flash(e.message)));
    $('#orderQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadOrders().catch((err) => flash(err.message)); });
    $('#reviewStatus').addEventListener('change', () => loadListings('review').catch((e) => flash(e.message)));
    $('#reviewRefresh').addEventListener('click', () => loadListings('review').catch((e) => flash(e.message)));
    bindCouponForm();
    bindBackup();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
