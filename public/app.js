(() => {
  'use strict';

  // ---------- Translations ----------
  const T = {
    ar: {
      skip: 'انتقل إلى المنتجات', navProducts: 'المنتجات', navCategories: 'الفئات', navTrack: 'تتبع الطلب', navContact: 'اتصل بنا',
      heroEyebrow: 'تشكيلة مختارة بعناية', heroTitle: 'إكسسوارات تعبّر عنك',
      heroLead: 'ساعات وأساور وقلادات وحقائب بجودة ثابتة وتوصيل إلى جميع الولايات الـ58. ادفع عند الاستلام.',
      heroShop: 'تسوق الآن', heroTrack: 'تتبع طلبك', trust1: 'الدفع عند الاستلام', trust2: 'توصيل لـ58 ولاية', trust3: 'تأكيد الطلب بالهاتف',
      catTitle: 'الفئات', prodTitle: 'المنتجات', searchLabel: 'ابحث عن منتج', searchPlaceholder: 'ابحث عن منتج...',
      all: 'الكل', addToCart: 'أضف إلى السلة', soldOut: 'نفدت الكمية', off: 'خصم', noResults: 'لا توجد منتجات مطابقة.',
      loadError: 'تعذر تحميل المنتجات. تحقق من الاتصال وأعد المحاولة.',
      trackTitle: 'تتبع طلبك', trackLead: 'أدخل رقم الطلب ورقم الهاتف المستعمل عند الطلب.', refLabel: 'رقم الطلب', phoneLabel: 'رقم الهاتف',
      trackBtn: 'تتبع', trackNotFound: 'لم نجد طلبا بهذه المعلومات. تأكد من الرقم والهاتف.',
      trackStatusLabel: 'حالة الطلب:',
      contactTitle: 'اتصل بنا', waBtn: 'واتساب', callBtn: 'اتصال', nameLabel: 'الاسم', msgLabel: 'رسالتك', sendBtn: 'إرسال',
      contactOk: 'تم إرسال رسالتك. سنرد عليك قريبا.',
      footerTag: 'إكسسوارات جزائرية أنيقة', privacy: 'سياسة الخصوصية', terms: 'الشروط والأحكام',
      cartTitle: 'السلة', subtotal: 'المجموع الجزئي', checkout: 'متابعة الطلب', emptyCart: 'السلة فارغة.', remove: 'حذف',
      checkoutTitle: 'إتمام الطلب', backShop: 'رجوع للتسوق', deliveryInfo: 'معلومات التوصيل',
      phone2Label: 'رقم هاتف ثان (اختياري)', wilayaLabel: 'الولاية', chooseWilaya: 'اختر الولاية', communeLabel: 'البلدية',
      addressLabel: 'العنوان الكامل', methodLabel: 'مكان التوصيل', methodHome: 'للمنزل', methodPickup: 'نقطة استلام',
      notesLabel: 'ملاحظات (اختياري)', productsTotal: 'سعر المنتجات', deliveryTotal: 'سعر التوصيل', grandTotal: 'المجموع',
      codNote: 'الدفع نقدا عند استلام الطلب.', placeOrder: 'تأكيد الطلب', choosePlace: 'اختر الولاية أولا',
      unavailable: 'غير متاح', sending: 'جار الإرسال...',
      confirmTitle: 'تم استلام طلبك', confirmLead: 'احتفظ برقم الطلب. سنتصل بك لتأكيده.', yourRef: 'رقم الطلب:',
      copyRef: 'نسخ الرقم', copied: 'تم النسخ', backHome: 'العودة للمتجر',
      errGeneric: 'تعذر إرسال الطلب. حاول مرة أخرى.', errNetwork: 'مشكلة في الاتصال. حاول مرة أخرى.',
      errRate: 'محاولات كثيرة. حاول لاحقا.', required: 'هذا الحقل مطلوب.',
      status: { pending: 'قيد المراجعة', confirmed: 'مؤكد', preparing: 'قيد التحضير', shipped: 'تم الشحن',
        out_for_delivery: 'في الطريق إليك', delivered: 'تم التوصيل', cancelled: 'ملغى', rejected: 'مرفوض' },
      currency: 'DA',
    },
    fr: {
      skip: 'Aller aux produits', navProducts: 'Produits', navCategories: 'Catégories', navTrack: 'Suivi', navContact: 'Contact',
      heroEyebrow: 'Une sélection soignée', heroTitle: 'Des accessoires qui vous ressemblent',
      heroLead: 'Montres, bracelets, colliers et sacs, avec une qualité constante et livraison dans les 58 wilayas. Payez à la livraison.',
      heroShop: 'Découvrir', heroTrack: 'Suivre ma commande', trust1: 'Paiement à la livraison', trust2: 'Livraison dans 58 wilayas', trust3: 'Confirmation par téléphone',
      catTitle: 'Catégories', prodTitle: 'Produits', searchLabel: 'Rechercher un produit', searchPlaceholder: 'Rechercher un produit...',
      all: 'Tout', addToCart: 'Ajouter au panier', soldOut: 'Épuisé', off: 'Réduction', noResults: 'Aucun produit trouvé.',
      loadError: 'Impossible de charger les produits. Vérifiez la connexion.',
      trackTitle: 'Suivre ma commande', trackLead: 'Saisissez le numéro de commande et le téléphone utilisé lors de la commande.', refLabel: 'Numéro de commande', phoneLabel: 'Téléphone',
      trackBtn: 'Suivre', trackNotFound: 'Aucune commande trouvée avec ces informations.',
      trackStatusLabel: 'Statut :',
      contactTitle: 'Contact', waBtn: 'WhatsApp', callBtn: 'Appeler', nameLabel: 'Nom', msgLabel: 'Votre message', sendBtn: 'Envoyer',
      contactOk: 'Message envoyé. Nous vous répondrons bientôt.',
      footerTag: 'Accessoires algériens élégants', privacy: 'Confidentialité', terms: 'Conditions',
      cartTitle: 'Panier', subtotal: 'Sous-total', checkout: 'Commander', emptyCart: 'Votre panier est vide.', remove: 'Supprimer',
      checkoutTitle: 'Finaliser la commande', backShop: 'Retour à la boutique', deliveryInfo: 'Informations de livraison',
      phone2Label: 'Second téléphone (optionnel)', wilayaLabel: 'Wilaya', chooseWilaya: 'Choisir la wilaya', communeLabel: 'Commune',
      addressLabel: 'Adresse complète', methodLabel: 'Lieu de livraison', methodHome: 'Domicile', methodPickup: 'Point de retrait',
      notesLabel: 'Remarques (optionnel)', productsTotal: 'Produits', deliveryTotal: 'Livraison', grandTotal: 'Total',
      codNote: 'Paiement en espèces à la réception.', placeOrder: 'Confirmer la commande', choosePlace: 'Choisissez d’abord la wilaya',
      unavailable: 'Indisponible', sending: 'Envoi...',
      confirmTitle: 'Commande reçue', confirmLead: 'Gardez le numéro de commande. Nous vous appellerons pour confirmer.', yourRef: 'Numéro de commande :',
      copyRef: 'Copier', copied: 'Copié', backHome: 'Retour à la boutique',
      errGeneric: 'Impossible d’envoyer la commande. Réessayez.', errNetwork: 'Problème de connexion. Réessayez.',
      errRate: 'Trop de tentatives. Réessayez plus tard.', required: 'Champ obligatoire.',
      status: { pending: 'En cours de vérification', confirmed: 'Confirmée', preparing: 'En préparation', shipped: 'Expédiée',
        out_for_delivery: 'En route vers vous', delivered: 'Livrée', cancelled: 'Annulée', rejected: 'Refusée' },
      currency: 'DA',
    },
  };

  // ---------- State ----------
  const state = {
    lang: 'ar',
    products: [],
    categories: [],
    wilayas: [],
    category: 'all',
    query: '',
    cart: new Map(), // productId -> qty
    store: { whatsapp: '', phone: '' },
    idempotencyKey: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const t = (key) => T[state.lang][key] ?? key;

  // Safe storage helpers (private mode / blocked storage must not break the page).
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  // LTR isolate keeps digits in order inside RTL text.
  const fmt = (n) => `\u2066${Number(n).toLocaleString('en-US')} ${T[state.lang].currency}\u2069`;
  const catName = (slug) => {
    const c = state.categories.find((x) => x.slug === slug);
    return c ? (state.lang === 'ar' ? c.name_ar : c.name_fr) : '';
  };
  const prodName = (p) => (state.lang === 'ar' ? p.name_ar : p.name_fr);
  const prodDesc = (p) => (state.lang === 'ar' ? p.desc_ar : p.desc_fr);
  const wilayaLabel = (w) => `${String(w.code).padStart(2, '0')} - ${state.lang === 'ar' ? w.name_ar : w.name_fr}`;

  async function api(path, opts = {}) {
    const { headers: extraHeaders, body, ...rest } = opts;
    const res = await fetch(path, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON response */ }
    if (!res.ok) {
      const err = new Error(data.error || t('errGeneric'));
      err.status = res.status;
      err.field = data.field;
      throw err;
    }
    return data;
  }

  // ---------- i18n ----------
  function applyLang() {
    const html = document.documentElement;
    html.lang = state.lang;
    html.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const val = T[state.lang][el.dataset.i18n];
      if (typeof val === 'string') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    $('#langBtn').textContent = state.lang === 'ar' ? 'FR' : 'عربي';
    $('#search').setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    populateWilayaSelect();
    renderCategories();
    renderChips();
    renderProducts();
    renderCart();
    updateSummary();
    updateContactLinks();
  }

  // ---------- Catalog ----------
  const ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 40 20 24 42 8 20Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 20h32M18 20l6 22 6-22" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

  function renderCategories() {
    const grid = $('#catGrid');
    grid.replaceChildren();
    for (const c of state.categories) {
      const count = state.products.filter((p) => p.category === c.slug).length;
      const a = document.createElement('a');
      a.className = 'cat-tile';
      a.href = '#products';
      a.addEventListener('click', () => { setCategory(c.slug); });
      const name = document.createElement('span');
      name.textContent = state.lang === 'ar' ? c.name_ar : c.name_fr;
      const n = document.createElement('span');
      n.textContent = String(count);
      a.append(name, n);
      grid.append(a);
    }
  }

  function renderChips() {
    const wrap = $('#chips');
    wrap.replaceChildren();
    const all = [{ slug: 'all', label: t('all') }, ...state.categories.map((c) => ({
      slug: c.slug, label: state.lang === 'ar' ? c.name_ar : c.name_fr,
    }))];
    for (const c of all) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(state.category === c.slug));
      b.textContent = c.label;
      b.addEventListener('click', () => setCategory(c.slug));
      wrap.append(b);
    }
  }

  function setCategory(slug) {
    state.category = slug;
    renderChips();
    renderProducts();
  }

  function visibleProducts() {
    const q = state.query.trim().toLowerCase();
    return state.products.filter((p) => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (!q) return true;
      return [p.name_ar, p.name_fr, p.desc_ar, p.desc_fr, p.sku].some((s) => s.toLowerCase().includes(q));
    });
  }

  function renderProducts() {
    const grid = $('#productGrid');
    const status = $('#productsStatus');
    const list = visibleProducts();
    grid.replaceChildren();
    status.textContent = list.length ? '' : t('noResults');

    for (const p of list) {
      const card = document.createElement('article');
      card.className = 'product-card';

      const visual = document.createElement('div');
      visual.className = 'visual';
      visual.style.setProperty('--tone', p.tone || '#1f2a36');
      visual.innerHTML = ICON;
      if (p.discount_price != null && p.discount_price < p.price) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = t('off');
        visual.append(b);
      }
      if (p.stock <= 0) {
        const b = document.createElement('span');
        b.className = 'badge out';
        b.textContent = t('soldOut');
        visual.append(b);
      }

      const body = document.createElement('div');
      body.className = 'product-body';
      const name = document.createElement('h3');
      name.className = 'product-name';
      name.textContent = prodName(p);
      const price = document.createElement('div');
      price.className = 'price';
      const current = document.createElement('span');
      current.textContent = fmt(p.discount_price ?? p.price);
      price.append(current);
      if (p.discount_price != null && p.discount_price < p.price) {
        const old = document.createElement('span');
        old.className = 'old';
        old.textContent = fmt(p.price);
        price.append(old);
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-btn';
      add.textContent = p.stock <= 0 ? t('soldOut') : t('addToCart');
      add.disabled = p.stock <= 0;
      add.setAttribute('aria-label', `${t('addToCart')}: ${prodName(p)}`);
      add.addEventListener('click', () => addToCart(p.id, add));

      body.append(name, price, add);
      card.append(visual, body);
      card.dataset.desc = prodDesc(p);
      card.title = prodDesc(p);
      grid.append(card);
    }
  }

  // ---------- Cart ----------
  const productById = (id) => state.products.find((p) => p.id === id);

  function saveCart() {
    const obj = {};
    for (const [id, qty] of state.cart) obj[id] = qty;
    store.set('adz-cart', JSON.stringify(obj));
  }

  function loadCart() {
    try {
      const raw = store.get('adz-cart');
      const obj = raw ? JSON.parse(raw) : {};
      for (const [id, qty] of Object.entries(obj)) {
        const n = Number(id);
        const q = Number(qty);
        if (Number.isInteger(n) && Number.isInteger(q) && q > 0) state.cart.set(n, Math.min(q, 20));
      }
    } catch { /* ignore corrupt cart */ }
  }

  function addToCart(id, btn) {
    const p = productById(id);
    if (!p) return;
    const current = state.cart.get(id) || 0;
    if (current + 1 > p.stock) { toast(t('soldOut')); return; }
    state.cart.set(id, Math.min(current + 1, 20));
    saveCart();
    renderCart();
    bumpCount();
    if (btn) {
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = t('addToCart'); }, 900);
    }
  }

  function setQty(id, delta) {
    const p = productById(id);
    const current = state.cart.get(id) || 0;
    const next = current + delta;
    if (next <= 0) state.cart.delete(id);
    else if (p && next > p.stock) { toast(t('soldOut')); return; }
    else state.cart.set(id, Math.min(next, 20));
    saveCart();
    renderCart();
  }

  function cartCount() {
    let n = 0;
    for (const q of state.cart.values()) n += q;
    return n;
  }

  function cartSubtotal() {
    let sum = 0;
    for (const [id, qty] of state.cart) {
      const p = productById(id);
      if (p) sum += (p.discount_price ?? p.price) * qty;
    }
    return sum;
  }

  function bumpCount() {
    const el = $('#cartCount');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function renderCart() {
    const list = $('#cartItems');
    list.replaceChildren();
    const ids = [...state.cart.keys()].filter((id) => productById(id));
    if (ids.length === 0) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = t('emptyCart');
      list.append(e);
    }
    for (const id of ids) {
      const p = productById(id);
      const qty = state.cart.get(id);
      const line = document.createElement('div');
      line.className = 'cart-line';

      const thumb = document.createElement('div');
      thumb.className = 'cart-thumb';
      thumb.style.setProperty('--tone', p.tone || '#1f2a36');

      const meta = document.createElement('div');
      meta.className = 'cart-meta';
      const name = document.createElement('strong');
      name.textContent = prodName(p);
      const price = document.createElement('span');
      price.className = 'small muted';
      price.textContent = `${fmt(p.discount_price ?? p.price)} × ${qty}`;
      const qtyBox = document.createElement('div');
      qtyBox.className = 'qty';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', '−');
      minus.addEventListener('click', () => setQty(id, -1));
      const val = document.createElement('span');
      val.textContent = String(qty);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', '+');
      plus.addEventListener('click', () => setQty(id, 1));
      qtyBox.append(minus, val, plus);
      meta.append(name, price, qtyBox);

      const right = document.createElement('div');
      const total = document.createElement('strong');
      total.textContent = fmt((p.discount_price ?? p.price) * qty);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove';
      rm.textContent = t('remove');
      rm.addEventListener('click', () => { state.cart.delete(id); saveCart(); renderCart(); });
      right.append(total, document.createElement('br'), rm);

      line.append(thumb, meta, right);
      list.append(line);
    }
    $('#cartSubtotal').textContent = fmt(cartSubtotal());
    $('#cartCount').textContent = String(cartCount());
    $('#checkoutBtn').disabled = ids.length === 0;
  }

  function openCart() {
    $('#cartDrawer').hidden = false;
    $('#overlay').hidden = false;
    $('#closeCart').focus();
  }
  function closeCart() {
    $('#cartDrawer').hidden = true;
    $('#overlay').hidden = true;
  }

  // ---------- Checkout ----------
  function populateWilayaSelect() {
    const sel = $('#wilayaSelect');
    const current = sel.value;
    sel.replaceChildren();
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = t('chooseWilaya');
    sel.append(ph);
    for (const w of state.wilayas) {
      const o = document.createElement('option');
      o.value = String(w.code);
      o.textContent = wilayaLabel(w);
      sel.append(o);
    }
    if (current) sel.value = current;
  }

  // Fee display is informational; the server recalculates the real fee on submit.
  let deliveryOptions = null;
  async function loadDelivery(code) {
    deliveryOptions = null;
    const feeEls = document.querySelectorAll('.fee');
    feeEls.forEach((el) => { el.textContent = '…'; });
    if (!code) { feeEls.forEach((el) => { el.textContent = '—'; }); updateSummary(); return; }
    try {
      const { options } = await api(`/api/delivery?wilaya=${encodeURIComponent(code)}`);
      deliveryOptions = options;
      for (const radio of document.querySelectorAll('input[name="deliveryMethod"]')) {
        const opt = options.find((o) => o.method === radio.value);
        radio.disabled = !opt;
        const feeEl = radio.closest('label').querySelector('.fee');
        feeEl.textContent = opt ? fmt(opt.fee) : t('unavailable');
      }
      const chosen = document.querySelector('input[name="deliveryMethod"]:checked');
      if (chosen && chosen.disabled) {
        const other = [...document.querySelectorAll('input[name="deliveryMethod"]')].find((r) => !r.disabled);
        if (other) other.checked = true;
      }
      $('#deliveryMsg').textContent = options.length ? '' : t('unavailable');
    } catch {
      $('#deliveryMsg').textContent = t('errNetwork');
      $('#deliveryMsg').className = 'form-msg error';
    }
    updateSummary();
  }

  function selectedMethod() {
    const r = document.querySelector('input[name="deliveryMethod"]:checked');
    return r ? r.value : 'home';
  }

  function updateSummary() {
    const products = cartSubtotal();
    $('#tProducts').textContent = fmt(products);
    const method = selectedMethod();
    const opt = deliveryOptions ? deliveryOptions.find((o) => o.method === method) : null;
    const fee = opt ? opt.fee : null;
    $('#tDelivery').textContent = fee == null ? t('choosePlace') : fmt(fee);
    $('#tGrand').textContent = fee == null ? fmt(products) : fmt(products + fee);

    const sum = $('#summary');
    sum.replaceChildren();
    const h = document.createElement('h3');
    h.className = 'form-sub';
    h.textContent = t('checkoutTitle');
    sum.append(h);
    for (const [id, qty] of state.cart) {
      const p = productById(id);
      if (!p) continue;
      const row = document.createElement('div');
      row.className = 'summary-line';
      const a = document.createElement('span');
      a.textContent = `${prodName(p)} × ${qty}`;
      const b = document.createElement('span');
      b.textContent = fmt((p.discount_price ?? p.price) * qty);
      row.append(a, b);
      sum.append(row);
    }
  }

  function openCheckout() {
    if (state.cart.size === 0) return;
    closeCart();
    showView('checkout');
    updateSummary();
  }

  function showView(name) {
    const views = { checkout: '#checkout', confirm: '#confirm' };
    for (const sel of Object.values(views)) $(sel).hidden = true;
    if (name === 'home') {
      window.scrollTo({ top: 0 });
      location.hash = '#top';
      return;
    }
    $(views[name]).hidden = false;
    $(views[name]).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setFieldError(form, field) {
    const el = field ? form.querySelector(`[name="${field}"]`) : null;
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function validateOrderForm(form) {
    clearFieldErrors(form);
    const fd = new FormData(form);
    const required = ['name', 'phone', 'wilaya', 'commune', 'address'];
    for (const key of required) {
      if (!String(fd.get(key) || '').trim()) {
        setFieldError(form, key);
        return { error: t('required'), field: key };
      }
    }
    return null;
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#orderMsg');
    msg.className = 'form-msg';
    msg.textContent = '';

    const localErr = validateOrderForm(form);
    if (localErr) { msg.className = 'form-msg error'; msg.textContent = localErr.error; return; }
    if (state.cart.size === 0) { msg.className = 'form-msg error'; msg.textContent = t('emptyCart'); return; }

    const fd = new FormData(form);
    const items = [...state.cart].map(([productId, quantity]) => ({ productId, quantity }));

    // One key per checkout attempt: a double tap or retry reuses it, so the server returns the same order.
    if (!state.idempotencyKey) state.idempotencyKey = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const btn = $('#submitBtn');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = t('sending');
    try {
      const data = await api('/api/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': state.idempotencyKey },
        body: {
          customer: {
            name: fd.get('name'),
            phone: fd.get('phone'),
            phone2: fd.get('phone2'),
            wilaya: fd.get('wilaya'),
            commune: fd.get('commune'),
            address: fd.get('address'),
          },
          deliveryMethod: fd.get('deliveryMethod'),
          notes: fd.get('notes'),
          items,
        },
      });
      state.cart.clear();
      saveCart();
      renderCart();
      state.idempotencyKey = null;
      form.reset();
      deliveryOptions = null;
      document.querySelectorAll('.fee').forEach((el) => { el.textContent = '—'; });
      $('#confirmRef').textContent = data.reference;
      showView('confirm');
    } catch (err) {
      if (err.status === 429) msg.textContent = t('errRate');
      else if (err.status === 400 && err.message) { msg.textContent = err.message; setFieldError(form, err.field); }
      else if (!err.status) msg.textContent = t('errNetwork');
      else msg.textContent = t('errGeneric');
      msg.className = 'form-msg error';
      // Keep the key on network failures so a retry is safe; a validation error means a new attempt.
      if (err.status === 400) state.idempotencyKey = null;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      await refreshAfterCheckoutChange();
    }
  }

  async function refreshAfterCheckoutChange() {
    // Refresh stock numbers so a sold-out item is not offered again.
    try {
      const { products } = await api('/api/products');
      state.products = products;
      renderProducts();
      renderCategories();
    } catch { /* keep current view */ }
  }

  // ---------- Tracking & contact ----------
  const STATUS_KEYS = ['pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'];

  async function submitTrack(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#trackMsg');
    msg.className = 'form-msg';
    const fd = new FormData(form);
    try {
      const data = await api('/api/track', {
        method: 'POST',
        body: { reference: fd.get('reference'), phone: fd.get('phone') },
      });
      if (!data.found) {
        msg.className = 'form-msg error';
        msg.textContent = t('trackNotFound');
      } else {
        const key = STATUS_KEYS.includes(data.status) ? data.status : 'pending';
        msg.className = 'form-msg ok';
        msg.textContent = `${t('trackStatusLabel')} ${T[state.lang].status[key]}`;
      }
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.status === 429 ? t('errRate') : t('errNetwork');
    }
  }

  async function submitContact(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const msg = $('#contactMsg');
    msg.className = 'form-msg';
    const fd = new FormData(form);
    try {
      await api('/api/contact', {
        method: 'POST',
        body: { name: fd.get('name'), phone: fd.get('phone'), message: fd.get('message') },
      });
      form.reset();
      msg.className = 'form-msg ok';
      msg.textContent = t('contactOk');
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.status === 429 ? t('errRate') : (err.message || t('errGeneric'));
    }
  }

  function updateContactLinks() {
    const wa = $('#waLink');
    const call = $('#callLink');
    const digits = (state.store.whatsapp || '').replace(/\D/g, '');
    if (digits) { wa.href = `https://wa.me/${digits}`; wa.hidden = false; } else { wa.hidden = true; }
    const phone = (state.store.phone || '').replace(/[^\d+]/g, '');
    if (phone) { call.href = `tel:${phone}`; call.hidden = false; } else { call.hidden = true; }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- Wiring ----------
  async function init() {
    loadCart();
    state.lang = store.get('adz-lang') === 'fr' ? 'fr' : 'ar';
    $('#year').textContent = String(new Date().getFullYear());

    try {
      const [cats, prods, wils, storeInfo] = await Promise.all([
        api('/api/categories'), api('/api/products'), api('/api/wilayas'), api('/api/store').catch(() => ({})),
      ]);
      state.categories = cats.categories;
      state.products = prods.products;
      state.wilayas = wils.wilayas;
      state.store = { whatsapp: storeInfo.whatsapp || '', phone: storeInfo.phone || '' };
    } catch {
      $('#productsStatus').textContent = t('loadError');
    }

    applyLang();

    $('#langBtn').addEventListener('click', () => {
      state.lang = state.lang === 'ar' ? 'fr' : 'ar';
      store.set('adz-lang', state.lang);
      applyLang();
    });
    $('#search').addEventListener('input', (e) => { state.query = e.target.value; renderProducts(); });
    $('#cartBtn').addEventListener('click', openCart);
    $('#closeCart').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', closeCart);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#cartDrawer').hidden) closeCart(); });
    $('#checkoutBtn').addEventListener('click', openCheckout);
    $('#backToShop').addEventListener('click', () => showView('home'));
    $('#backHome').addEventListener('click', () => showView('home'));
    $('#copyRef').addEventListener('click', async () => {
      const ref = $('#confirmRef').textContent;
      try { await navigator.clipboard.writeText(ref); toast(t('copied')); } catch { toast(ref); }
    });
    $('#wilayaSelect').addEventListener('change', (e) => loadDelivery(e.target.value));
    document.querySelectorAll('input[name="deliveryMethod"]').forEach((r) => r.addEventListener('change', updateSummary));
    $('#orderForm').addEventListener('submit', submitOrder);
    $('#trackForm').addEventListener('submit', submitTrack);
    $('#contactForm').addEventListener('submit', submitContact);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
