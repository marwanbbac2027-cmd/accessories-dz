(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const STATUS = { pending: 'قيد المراجعة', approved: 'منشور', rejected: 'مرفوض' };

  // The token is read from the URL fragment, which browsers never send to the server.
  function tokenFromHash() {
    const t = decodeURIComponent(location.hash.replace(/^#/, ''));
    return /^[A-Za-z0-9_-]{20,80}$/.test(t) ? t : '';
  }

  function show(name) {
    ['noToken', 'notFound', 'manageForm'].forEach((id) => { $('#' + id).hidden = id !== name; });
  }

  function msg(text, ok) {
    const m = $('#mMsg');
    m.className = ok ? 'form-msg ok' : 'form-msg error';
    m.textContent = text;
  }

  function fill(listing) {
    const f = $('#manageForm');
    $('#mTitle').textContent = listing.title;
    $('#mStatus').textContent = `الحالة: ${STATUS[listing.status] || listing.status}`;
    f.price.value = listing.price;
    f.discount_price.value = listing.discount_price ?? '';
    f.stock.value = listing.stock;
    f.description.value = listing.description || '';
    // A pending listing's image is not public yet, so hide the preview if it cannot load.
    const preview = $('#preview');
    preview.onerror = () => { preview.hidden = true; };
    if (listing.image_url) { preview.hidden = false; preview.src = listing.image_url; } else { preview.hidden = true; }
  }

  async function load(token) {
    const res = await fetch(`/api/manage/${token}`);
    if (res.status === 404) return show('notFound');
    if (!res.ok) { msg('تعذّر تحميل المنتج. حاول لاحقًا.', false); return; }
    const { listing } = await res.json();
    fill(listing);
    show('manageForm');
  }

  async function save(e) {
    e.preventDefault();
    const token = tokenFromHash();
    const f = e.currentTarget;
    msg('', true);
    const body = {
      price: f.price.value,
      discount_price: f.discount_price.value === '' ? null : f.discount_price.value,
      stock: f.stock.value,
      description: f.description.value,
    };
    try {
      const res = await fetch(`/api/manage/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { msg(data.error || 'تعذّر الحفظ.', false); return; }
      fill(data.listing);
      msg('تم حفظ التعديلات.', true);
    } catch {
      msg('تعذّر الاتصال. حاول مرة أخرى.', false);
    }
  }

  function init() {
    const token = tokenFromHash();
    if (!token) return show('noToken');
    $('#manageForm').addEventListener('submit', save);
    load(token).catch(() => msg('تعذّر الاتصال. حاول مرة أخرى.', false));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
