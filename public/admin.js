(() => {
  'use strict';

  // The token lives only in memory: it is not written to storage.
  let token = '';
  const $ = (sel) => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  async function api(path, opts = {}) {
    const headers = { Authorization: 'Bearer ' + token };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) throw Object.assign(new Error('الرمز غير صحيح.'), { status: 401 });
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* ignore */ }
      throw Object.assign(new Error(data.error || 'حدث خطأ.'), { status: res.status });
    }
    return res.json();
  }

  async function loadImage(id, img) {
    try {
      const res = await fetch(`/api/admin/listings/${id}/image`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) img.src = URL.createObjectURL(await res.blob());
    } catch { /* leave blank */ }
  }

  function showMsg(text, isError) {
    const m = $('#adminMsg');
    m.className = 'form-msg ' + (isError ? 'error' : 'ok');
    m.textContent = text;
  }

  async function setStatus(id, status) {
    try {
      await api(`/api/admin/listings/${id}/status`, { method: 'POST', body: { status } });
      showMsg(status === 'approved' ? 'تم النشر.' : 'تم الرفض.', false);
      loadListings();
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function loadListings() {
    const status = $('#statusFilter').value;
    try {
      const { listings } = await api(`/api/admin/listings?status=${encodeURIComponent(status)}`);
      const box = $('#listings');
      box.replaceChildren();
      if (!listings.length) box.append(el('p', 'muted', 'لا توجد منتجات في هذه الحالة.'));
      for (const l of listings) {
        const card = el('article', 'acard');
        if (l.has_image) {
          const img = el('img');
          img.alt = l.title;
          loadImage(l.id, img);
          card.append(img);
        }
        card.append(
          el('h3', '', l.title),
          el('p', 'small', `${l.price} دج${l.discount_price ? ` (خصم: ${l.discount_price} دج)` : ''} · ${l.stock} قطعة · ${l.category}`),
          el('p', 'small', `البائع: ${l.seller_name} · ${l.seller_phone}`),
          el('p', 'small muted', l.description || ''),
        );
        const actions = el('div', 'actions');
        if (l.status !== 'approved') {
          const b = el('button', 'primary', 'نشر');
          b.type = 'button';
          b.addEventListener('click', () => setStatus(l.id, 'approved'));
          actions.append(b);
        }
        if (l.status !== 'rejected') {
          const b = el('button', 'danger', 'رفض');
          b.type = 'button';
          b.addEventListener('click', () => setStatus(l.id, 'rejected'));
          actions.append(b);
        }
        card.append(actions);
        box.append(card);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  async function loadMessages() {
    try {
      const { messages } = await api('/api/admin/messages');
      const box = $('#messages');
      box.replaceChildren();
      if (!messages.length) box.append(el('p', 'muted', 'لا توجد رسائل بعد.'));
      for (const m of messages) {
        const card = el('article', 'acard');
        card.append(
          el('h3', '', `${m.name} · ${m.phone}`),
          el('p', 'small', `المنتج: ${m.product}`),
          el('p', '', m.message),
          el('p', 'small muted', new Date(m.created_at).toLocaleString('ar-DZ')),
        );
        box.append(card);
      }
    } catch (err) {
      showMsg(err.message, true);
    }
  }

  function showTab(name) {
    const listings = name === 'listings';
    $('#listingsView').hidden = !listings;
    $('#messagesView').hidden = listings;
    $('#tabListings').setAttribute('aria-selected', String(listings));
    $('#tabMessages').setAttribute('aria-selected', String(!listings));
    if (listings) loadListings(); else loadMessages();
  }

  async function login() {
    token = $('#tokenInput').value.trim();
    const msg = $('#loginMsg');
    msg.textContent = '';
    if (!token) return;
    try {
      await api('/api/admin/listings?status=pending');
      $('#loginView').hidden = true;
      $('#panel').hidden = false;
      $('#tokenInput').value = '';
      showTab('listings');
    } catch (err) {
      token = '';
      msg.className = 'form-msg error';
      msg.textContent = err.status === 404 ? 'الإدارة غير مفعلة على الخادم.' : err.message;
    }
  }

  $('#loginBtn').addEventListener('click', login);
  $('#tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('#statusFilter').addEventListener('change', loadListings);
  $('#refreshBtn').addEventListener('click', () => showTab($('#listingsView').hidden ? 'messages' : 'listings'));
  $('#tabListings').addEventListener('click', () => showTab('listings'));
  $('#tabMessages').addEventListener('click', () => showTab('messages'));
})();
