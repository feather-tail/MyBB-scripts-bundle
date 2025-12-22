(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, parseHTML, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
    showAwards: true,
    awardsErrorText: 'Ошибка загрузки подарков.',
    awardsEmptyText: 'Подарков нет.',
    awardsApi: 'https://core.rusff.me/rusff.php',
    ajaxFolder: '',
    charset: 'utf-8',
    classes: {
      tab: 'modal__tab',
      tabContent: 'modal__content',
      active: 'active',
    },
    cacheTtlMs: 15 * 60 * 1000,
    searchDebounceMs: 110,
    slots: {
      inventory: 24,
      gifts: 24,
      playerAch: 12,
      charAch: 12,
    },
  });

  // ================== UTILS ==================

  const stableStringify = (v) => {
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
        .join(',')}}`;
    }
    return JSON.stringify(v);
  };

  const now = () => Date.now();

  const ttlCache = (() => {
    const m = new Map();
    return {
      get(key) {
        const row = m.get(key);
        if (!row) return null;
        if (row.exp && row.exp < now()) {
          m.delete(key);
          return null;
        }
        return row.val;
      },
      set(key, val, ttlMs) {
        m.set(key, { val, exp: ttlMs ? now() + ttlMs : 0 });
        return val;
      },
      del(key) {
        m.delete(key);
      },
      clear() {
        m.clear();
      },
    };
  })();

  const rpcInflight = new Map();

  const rpc = (method, params, { signal } = {}) => {
    const body = { jsonrpc: '2.0', id: 1, method, params };
    const key = `${method}|${stableStringify(params)}`;

    const cached = ttlCache.get(key);
    if (cached !== null) return Promise.resolve(cached);

    if (rpcInflight.has(key)) return rpcInflight.get(key);

    const p = fetch(config.awardsApi, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/javascript, */*; q=0.01',
        'x-requested-with': 'XMLHttpRequest',
      },
      body: JSON.stringify(body),
      signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error('network');
        return r.json();
      })
      .then((j) => j?.result ?? null)
      .then((res) => ttlCache.set(key, res, config.cacheTtlMs))
      .finally(() => rpcInflight.delete(key));

    rpcInflight.set(key, p);
    return p;
  };

  const numFrom = (x) => {
    const n = parseInt(String(x ?? '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeText = (s) => String(s ?? '').trim();

  const normalizeItem = (raw) => {
    const name = normalizeText(raw?.name || raw?.title || raw?.label || '');
    const cat = normalizeText(raw?.cat || raw?.category || '');
    const desc = normalizeText(raw?.desc || raw?.description || raw?.text || '');
    const img = normalizeText(raw?.img || raw?.image || raw?.href || '');
    const qty = Number.isFinite(+raw?.qty) ? +raw.qty : numFrom(raw?.qty);
    return {
      name: name || '—',
      cat,
      desc,
      img,
      qty: qty > 0 ? qty : 0,
    };
  };

  const normalizeAward = (a) => {
    const name = normalizeText(a?.name || a?.item?.name || '');
    const desc = normalizeText(a?.desc || a?.description || a?.text || '');
    const img = normalizeText(a?.img || a?.item?.href || a?.href || '');
    return {
      id: normalizeText(a?.id || a?.award_id || ''),
      name: name || 'Подарок',
      desc,
      img,
    };
  };

  const resetSelection = (slotsEl) => {
    if (!slotsEl) return;
    slotsEl
      .querySelectorAll('.cm-slot--item.is-selected')
      .forEach((n) => n.classList.remove('is-selected'));
    slotsEl
      .querySelectorAll(".cm-slot--item[aria-pressed='true']")
      .forEach((n) => n.setAttribute('aria-pressed', 'false'));
  };

  const clearInfoBox = (infoBox) => {
    if (!infoBox) return;

    const img = infoBox.querySelector('[data-info-img]');
    const name = infoBox.querySelector('[data-info-name]');
    const cat = infoBox.querySelector('[data-info-cat]');
    const desc = infoBox.querySelector('[data-info-desc]');

    if (img) {
      img.removeAttribute('src');
      img.alt = '';
    }
    if (name) name.textContent = '';
    if (cat) cat.textContent = '';
    if (desc) desc.textContent = '';

    infoBox.classList.add('is-empty');
  };

  const ensureEmptySlots = (slotsEl, targetCount) => {
    if (!slotsEl) return;
    const items = slotsEl.querySelectorAll('.cm-slot--item').length;
    const emptiesNeeded = Math.max(0, targetCount - items);
    slotsEl.querySelectorAll('.cm-slot--empty').forEach((n) => n.remove());
    slotsEl.querySelectorAll('.cm-slot--skeleton').forEach((n) => n.remove());
    for (let i = 0; i < emptiesNeeded; i++) {
      const empty = document.createElement('div');
      empty.className = 'cm-slot cm-slot--empty';
      empty.setAttribute('aria-hidden', 'true');
      slotsEl.append(empty);
    }
  };

  const renderSkeletonSlots = (slotsEl, targetCount) => {
    if (!slotsEl) return;
    slotsEl.textContent = '';
    for (let i = 0; i < targetCount; i++) {
      const sk = document.createElement('div');
      sk.className = 'cm-slot cm-slot--skeleton';
      sk.setAttribute('aria-hidden', 'true');
      slotsEl.append(sk);
    }
  };

  const renderState = (slotsEl, kind, targetCount) => {
    if (!slotsEl) return;
    if (kind === 'skeleton') {
      renderSkeletonSlots(slotsEl, targetCount);
      return;
    }
    slotsEl.textContent = '';
    ensureEmptySlots(slotsEl, targetCount);
    resetSelection(slotsEl);
  };

  const prefetchImage = (url) => {
    const u = normalizeText(url);
    if (!u) return;
    const key = `prefetch:${u}`;
    if (ttlCache.get(key) !== null) return;
    ttlCache.set(key, 1, config.cacheTtlMs);
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = u;
  };

  const isGiftInfoBox = (infoBox) => {
    if (!infoBox) return false;
    return (
      infoBox.classList.contains('cm-infobox--gift') ||
      infoBox.getAttribute('data-kind') === 'gift'
    );
  };

  const setInfoBox = (infoBox, data) => {
    if (!infoBox) return;

    if (!data) {
      clearInfoBox(infoBox);
      return;
    }

    infoBox.classList.remove('is-empty');

    const d = normalizeItem(data || {});
    const giftMode = isGiftInfoBox(infoBox);

    const img = infoBox.querySelector('[data-info-img]');
    const name = infoBox.querySelector('[data-info-name]');
    const cat = infoBox.querySelector('[data-info-cat]');
    const desc = infoBox.querySelector('[data-info-desc]');

    infoBox.classList.add('is-updating');
    window.setTimeout(() => infoBox.classList.remove('is-updating'), 140);

    if (img) {
      const src = d.img || '';
      if (src) img.src = src;
      else img.removeAttribute('src');
      img.alt = d.name || '';
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    }

    if (giftMode) {
      if (cat) cat.textContent = '';
      if (name)
        name.textContent = normalizeText(data?.desc || '') || d.name || '';
      if (desc) desc.textContent = '';
      return;
    }

    if (name) name.textContent = d.name && d.name !== '—' ? d.name : '';
    if (cat) cat.textContent = d.cat ? `Категория: ${d.cat}` : '';
    if (desc) desc.textContent = d.desc || '';
  };

  // ================== METERS + IMAGES ==================

  const colorLink = (t01) => {
    const t = Math.min(1, Math.max(0, t01));
    const hue = 8 + 36 * t;
    const sat = 75;
    const light = 40 + 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const colorTaint = (t01) => {
    const t = Math.min(1, Math.max(0, t01));
    const hue = 120;
    const sat = 45 + 35 * t;
    const light = 44 - 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const applyMeter = (root) => {
    const linkRow = root.querySelector('.cm-barrow[data-meter="link"]');
    const taintRow = root.querySelector('.cm-barrow[data-meter="taint"]');
    const linkFill = linkRow?.querySelector('.cm-bar__fill');
    const taintFill = taintRow?.querySelector('.cm-bar__fill');

    const linkLevel = numFrom(root.getAttribute('data-link-level'));
    const linkMax = Math.max(1, numFrom(root.getAttribute('data-link-max')) || 10);

    const taintLevel = numFrom(root.getAttribute('data-taint-level'));
    const taintMax = Math.max(1, numFrom(root.getAttribute('data-taint-max')) || 10);

    const linkT = linkLevel / linkMax;
    const taintT = taintLevel / taintMax;

    if (linkFill) {
      linkFill.style.width = `${Math.round(linkT * 100)}%`;
      linkFill.style.background = colorLink(linkT);
      const v = linkRow.querySelector('[data-meter-value]');
      if (v) v.textContent = `${linkLevel} ур.`;
    }
    if (taintFill) {
      taintFill.style.width = `${Math.round(taintT * 100)}%`;
      taintFill.style.background = colorTaint(taintT);
      const v = taintRow.querySelector('[data-meter-value]');
      if (v) v.textContent = `${taintLevel} ур.`;
    }
  };

  const applyLazyImages = (root) => {
    if (!root) return;
    root.querySelectorAll('img').forEach((img) => {
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
  };

  // ================== SLOTS BINDING ==================

  const bindSlotSelection = (slotsEl, infoBox, getDataFromBtn) => {
    if (!slotsEl || !infoBox) return () => {};

    const select = (btn) => {
      if (!btn) return;
      resetSelection(slotsEl);
      btn.classList.add('is-selected');
      btn.setAttribute('aria-pressed', 'true');
      const data = getDataFromBtn(btn);
      setInfoBox(infoBox, data);
      prefetchImage(data?.img);
    };

    const onClick = (e) => {
      const btn = e.target.closest('.cm-slot--item');
      if (!btn || !slotsEl.contains(btn)) return;
      select(btn);
    };

    slotsEl.addEventListener('click', onClick);

    return () => {
      slotsEl.removeEventListener('click', onClick);
    };
  };

  const debounce = (fn, ms) => {
    let t = 0;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), ms);
    };
  };

  const setupInventorySearchAndFilters = (invRoot) => {
    const input = invRoot.querySelector('[data-inv-search]');
    const slots = invRoot.querySelector('[data-slots="inventory"]');
    const toggle = invRoot.querySelector('[data-filters-toggle]');
    const panel = invRoot.querySelector('[data-filters-panel]');
    const clearBtn = invRoot.querySelector('[data-filters-clear]');
    const closeBtn = invRoot.querySelector('[data-filters-close]');
    const checks = Array.from(invRoot.querySelectorAll('[data-filter]'));

    let isOpen = false;

    const getActiveCats = () =>
      checks.filter((c) => c.checked).map((c) => c.value);

    const applyFilterRaw = () => {
      const q = (input?.value || '').trim().toLowerCase();
      const cats = getActiveCats();
      const items = Array.from(slots?.querySelectorAll('.cm-slot--item') || []);
      for (const btn of items) {
        const name = (btn.getAttribute('data-item-name') || '').toLowerCase();
        const cat = btn.getAttribute('data-item-cat') || '';
        const okQ = !q || name.includes(q);
        const okC = !cats.length || cats.includes(cat);
        btn.style.display = okQ && okC ? '' : 'none';
      }
    };

    const applyFilter = debounce(applyFilterRaw, config.searchDebounceMs);

    const setOpen = (open) => {
      if (!panel || !toggle) return;
      isOpen = open;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const onDocClick = (e) => {
      if (!isOpen) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (input) input.addEventListener('input', applyFilter);

    if (toggle && panel) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        setOpen(!isOpen);
      });

      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey, true);

      if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));
      if (clearBtn)
        clearBtn.addEventListener('click', () => {
          checks.forEach((c) => (c.checked = false));
          applyFilterRaw();
        });

      checks.forEach((c) => c.addEventListener('change', applyFilter));
    }

    applyFilterRaw();

    return () => {
      if (input) input.removeEventListener('input', applyFilter);
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  };

  const renderGiftsIntoSlots = (slotsEl, awards) => {
    if (!slotsEl) return;
    slotsEl.textContent = '';

    const makeBtn = (a) => {
      const x = normalizeAward(a);
      const btn = document.createElement('button');
      btn.className = 'cm-slot cm-slot--item';
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('data-item-name', x.name || 'Подарок');
      btn.setAttribute('data-item-cat', '');
      btn.setAttribute('data-item-desc', x.desc || '');
      btn.setAttribute('data-item-img', x.img || '');
      const img = document.createElement('img');
      img.src = x.img || 'https://placehold.co/96x96';
      img.alt = '';
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      btn.append(img);
      return btn;
    };

    awards.forEach((a) => {
      const btn = makeBtn(a);
      // без автоселекта
      slotsEl.append(btn);
    });

    ensureEmptySlots(slotsEl, config.slots.gifts);
    resetSelection(slotsEl);
  };

  // ================== APPEARANCE PICKERS ==================

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        document.body.removeChild(ta);
        return false;
      }
    }
  };

  const getBgUrl = (el) => {
    const bg = getComputedStyle(el).backgroundImage || '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : '';
  };

  const setupAppearancePickers = (root) => {
    const icons = Array.from(root.querySelectorAll('.cm-icon'));
    const bgs = Array.from(root.querySelectorAll('.cm-plate'));

    const setActive = (list, el) => {
      list.forEach((x) => x.classList.remove('is-active'));
      el.classList.add('is-active');
    };

    const pickAndCopy = async (btn, group) => {
      if (group === 'icon') setActive(icons, btn);
      if (group === 'bg') setActive(bgs, btn);

      const url =
        btn.dataset.url ||
        btn.getAttribute('data-url') ||
        (btn.querySelector('img') &&
          (btn.querySelector('img').currentSrc || btn.querySelector('img').src)) ||
        getBgUrl(btn.querySelector('.cm-plate__thumb') || btn);

      if (!url) return;

      prefetchImage(url);

      const ok = await copyText(url);

      btn.classList.add('is-copied');
      const prevTitle = btn.getAttribute('title') || '';
      btn.setAttribute('title', ok ? 'Ссылка скопирована' : 'Не удалось скопировать');
      window.setTimeout(() => {
        btn.classList.remove('is-copied');
        if (prevTitle) btn.setAttribute('title', prevTitle);
        else btn.removeAttribute('title');
      }, 900);
    };

    const onIcon = (btn) => (e) => {
      e.preventDefault();
      pickAndCopy(btn, 'icon');
    };
    const onBg = (btn) => (e) => {
      e.preventDefault();
      pickAndCopy(btn, 'bg');
    };

    icons.forEach((btn) => btn.addEventListener('click', onIcon(btn)));
    bgs.forEach((btn) => btn.addEventListener('click', onBg(btn)));

    return () => {
      // простой cleanup без хранения коллбеков
      icons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
      bgs.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
    };
  };

  // ================== MODAL infra ==================

  const findBackdropCandidate = (node) => {
    let el = node;
    for (let i = 0; i < 10 && el; i++) {
      if (el.nodeType !== 1) {
        el = el.parentElement;
        continue;
      }
      const cs = window.getComputedStyle(el);
      const pos = cs.position;
      if (pos === 'fixed' || pos === 'absolute') {
        const r = el.getBoundingClientRect();
        const covers =
          r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
        if (covers) return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  const setupFocusTrap = (dialogEl, { onClose }) => {
    const focusablesSelector =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [contenteditable], [tabindex]:not([tabindex="-1"])';

    const getFocusables = () =>
      Array.from(dialogEl.querySelectorAll(focusablesSelector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    const focusFirst = () => {
      const list = getFocusables();
      const target =
        dialogEl.querySelector('[data-modal-close]') ||
        dialogEl.querySelector(`.${config.classes.tab}.${config.classes.active}`) ||
        list[0] ||
        dialogEl;
      if (target && typeof target.focus === 'function')
        target.focus({ preventScroll: true });
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof onClose === 'function') onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const list = getFocusables();
      if (!list.length) {
        e.preventDefault();
        dialogEl.focus({ preventScroll: true });
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialogEl.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    focusFirst();

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  };

  const setupTabs = (root) => {
    const tabs = Array.from(root.querySelectorAll(`.${config.classes.tab}[data-cm-tab]`));
    const panes = Array.from(
      root.querySelectorAll(`.${config.classes.tabContent}[data-cm-content]`),
    );
    if (!tabs.length || !panes.length) return () => {};

    const activate = (key, { focusPanel } = {}) => {
      tabs.forEach((t) => {
        const isActive = (t.dataset.cmTab || '') === key;
        t.classList.toggle(config.classes.active, isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        t.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      panes.forEach((p) => {
        const isActive = (p.dataset.cmContent || '') === key;
        p.classList.toggle(config.classes.active, isActive);
        p.hidden = !isActive;
      });

      root.dispatchEvent(
        new CustomEvent('cm:tabchange', {
          bubbles: true,
          detail: { tab: key },
        }),
      );

      if (focusPanel) {
        const activePane = panes.find((p) => (p.dataset.cmContent || '') === key);
        if (activePane) activePane.focus({ preventScroll: true });
      }
    };

    const onClick = (e) => {
      const btn = e.target.closest(`.${config.classes.tab}[data-cm-tab]`);
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      activate(btn.dataset.cmTab, { focusPanel: false });
    };

    const onKey = (e) => {
      const btn = e.target.closest(`.${config.classes.tab}[data-cm-tab]`);
      if (!btn || !root.contains(btn)) return;

      const idx = tabs.indexOf(btn);
      if (idx < 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(idx + dir + tabs.length) % tabs.length];
        next.focus({ preventScroll: true });
        activate(next.dataset.cmTab, { focusPanel: false });
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(btn.dataset.cmTab, { focusPanel: true });
      }
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);

    const active = tabs.find((t) => t.classList.contains(config.classes.active)) || tabs[0];
    activate(active.dataset.cmTab, { focusPanel: false });

    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
    };
  };

  // ================== DATA ==================

  const fetchAwards = (uid, { signal } = {}) => {
    const cacheKey = `awards:${String(uid)}`;
    const cached = ttlCache.get(cacheKey);
    if (cached !== null) return Promise.resolve(cached);

    const params = {
      board_id: Number(window.BoardID) || 0,
      user_id: getUserId(),
      sort: 'user',
      users_ids: [String(uid)],
      check: {
        board_id: Number(window.BoardID) || 0,
        user_id: getUserId(),
        partner_id: Number(window.PartnerID) || 0,
        group_id: getGroupId(),
        user_login: String(window.UserLogin || ''),
        user_avatar: '',
        user_lastvisit: Number(window.UserLastVisit) || 0,
        user_unique_id: String(window.UserUniqueID || ''),
        host: location.host,
        sign: String(window.ForumAPITicket || ''),
      },
    };

    return rpc('awards/index', params, { signal }).then((rows = []) => {
      const u = (rows || []).find((r) => r.user_id === String(uid));
      const res = [];
      if (u && Array.isArray(u.awards)) {
        for (const a of u.awards) {
          res.push(
            normalizeAward({
              id: a.award_id,
              name: a.item?.name || '',
              desc: a.desc || '',
              img: a.item?.href || '',
            }),
          );
        }
      }
      ttlCache.set(cacheKey, res, config.cacheTtlMs);
      return res;
    });
  };

  // ================== ENHANCE ==================

  const enhanceCharacter = (character, { uid, close }) => {
    if (!character || character.getAttribute('data-cm-initialized') === '1') return () => {};
    character.setAttribute('data-cm-initialized', '1');

    applyMeter(character);
    applyLazyImages(character);

    const cleanup = [];
    const aborters = [];
    let giftsLoaded = false;

    const backdrop = findBackdropCandidate(character);
    if (backdrop) backdrop.classList.add('cm-no-backdrop');

    cleanup.push(setupTabs(character));

    // ---- INVENTORY ----
    const invRoot = character.querySelector('[data-inventory]');
    if (invRoot) {
      const slots = invRoot.querySelector('[data-slots="inventory"]');
      const info = invRoot.querySelector('[data-info="inventory"]');

      ensureEmptySlots(slots, config.slots.inventory);
      resetSelection(slots);
      clearInfoBox(info);

      cleanup.push(
        bindSlotSelection(slots, info, (btn) =>
          normalizeItem({
            name: btn.getAttribute('data-item-name'),
            cat: btn.getAttribute('data-item-cat'),
            desc: btn.getAttribute('data-item-desc'),
            img: btn.getAttribute('data-item-img'),
            qty: btn.getAttribute('data-item-qty'),
          }),
        ),
      );

      cleanup.push(setupInventorySearchAndFilters(invRoot));
    }

    // ---- ACHIEVEMENTS ----
    const achRoot = character.querySelector('[data-ach]');
    if (achRoot) {
      const info = achRoot.querySelector('[data-info="ach"]');
      clearInfoBox(info);

      const p = achRoot.querySelector('[data-slots="player-ach"]');
      ensureEmptySlots(p, config.slots.playerAch);
      resetSelection(p);

      cleanup.push(
        bindSlotSelection(p, info, (btn) =>
          normalizeItem({
            name: btn.getAttribute('data-item-name'),
            cat: btn.getAttribute('data-item-cat'),
            desc: btn.getAttribute('data-item-desc'),
            img: btn.getAttribute('data-item-img'),
          }),
        ),
      );

      const c = achRoot.querySelector('[data-slots="char-ach"]');
      ensureEmptySlots(c, config.slots.charAch);
      resetSelection(c);

      cleanup.push(
        bindSlotSelection(c, info, (btn) =>
          normalizeItem({
            name: btn.getAttribute('data-item-name'),
            cat: btn.getAttribute('data-item-cat'),
            desc: btn.getAttribute('data-item-desc'),
            img: btn.getAttribute('data-item-img'),
          }),
        ),
      );
    }

    cleanup.push(setupAppearancePickers(character));

    // ---- GIFTS ----
    const giftsRoot = character.querySelector('[data-gifts]');
    const giftsStatusEl = giftsRoot?.querySelector('[data-gifts-status]');
    const setGiftsStatus = (t) => {
      if (giftsStatusEl) giftsStatusEl.textContent = t || '';
    };

    const giftsSlots = character.querySelector('[data-gifts-root]');
    const giftsInfo = character.querySelector('[data-info="gifts"]');

    if (giftsSlots) {
      ensureEmptySlots(giftsSlots, config.slots.gifts);
      resetSelection(giftsSlots);
    }
    clearInfoBox(giftsInfo);
    setGiftsStatus('');

    const loadGifts = async () => {
      if (!config.showAwards) return;
      if (giftsLoaded) return;
      giftsLoaded = true;

      const ac = new AbortController();
      aborters.push(ac);

      try {
        renderState(giftsSlots, 'skeleton', config.slots.gifts);
        if (giftsInfo) clearInfoBox(giftsInfo);
        setGiftsStatus('Загрузка…');

        const awards = uid ? await fetchAwards(uid, { signal: ac.signal }) : [];

        if (!awards.length) {
          renderState(giftsSlots, 'empty', config.slots.gifts);
          if (giftsInfo) clearInfoBox(giftsInfo);
          setGiftsStatus(config.awardsEmptyText);
          return;
        }

        renderGiftsIntoSlots(giftsSlots, awards);
        if (giftsInfo) clearInfoBox(giftsInfo);
        setGiftsStatus('');

        cleanup.push(
          bindSlotSelection(giftsSlots, giftsInfo, (btn) => ({
            name: btn.getAttribute('data-item-name') || '',
            desc: btn.getAttribute('data-item-desc') || '',
            img: btn.getAttribute('data-item-img') || '',
          })),
        );
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        renderState(giftsSlots, 'error', config.slots.gifts);
        if (giftsInfo) clearInfoBox(giftsInfo);
        setGiftsStatus(config.awardsErrorText);
      }
    };

    const onTabChange = (e) => {
      const key = e?.detail?.tab || '';
      if (key === 'gifts') loadGifts();
    };
    character.addEventListener('cm:tabchange', onTabChange);
    cleanup.push(() => character.removeEventListener('cm:tabchange', onTabChange));

    // ---- CLOSE ----
    const btnClose = character.querySelector('[data-modal-close]');
    const closeWrapped = () => {
      aborters.forEach((a) => {
        try {
          a.abort();
        } catch (_) {}
      });

      cleanup
        .splice(0)
        .reverse()
        .forEach((fn) => {
          try {
            fn();
          } catch (_) {}
        });

      if (backdrop) backdrop.classList.remove('cm-no-backdrop');
      if (typeof close === 'function') close();
    };

    if (btnClose) {
      const onCloseClick = (e) => {
        e.preventDefault();
        closeWrapped();
      };
      btnClose.addEventListener('click', onCloseClick);
      cleanup.push(() => btnClose.removeEventListener('click', onCloseClick));
    }

    return { closeWrapped };
  };

  // ================== INIT ==================

  function init() {
    document.body.addEventListener('click', async (e) => {
      const link = e.target.closest('.modal-link');
      if (!link) return;

      e.preventDefault();
      const pageId = link.id;
      if (!pageId) return;

      const lastFocus = document.activeElement;

      const box = createEl('div', { className: 'character-modal' });
      box.append(
        createEl('div', {
          style: 'padding:2em; text-align:center;',
          text: config.loadingText,
        }),
      );

      const modal = window.helpers.modal.openModal(box);
      const closeOrig = modal?.close;

      let pageAbort = new AbortController();

      let focusCleanup = null;
      let enhanced = null;

      const closeAll = () => {
        try {
          pageAbort.abort();
        } catch (_) {}
        if (enhanced?.closeWrapped) enhanced.closeWrapped();
        else if (typeof closeOrig === 'function') closeOrig();
        if (focusCleanup) focusCleanup();
        if (lastFocus && typeof lastFocus.focus === 'function')
          lastFocus.focus({ preventScroll: true });
      };

      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`, {
          signal: pageAbort.signal,
        });
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);
        const doc = parseHTML(html);

        const character = doc.querySelector('.character');
        const targetUid =
          link.dataset.userId ||
          link.dataset.uid ||
          character?.dataset.userId ||
          doc.querySelector('[data-user-id]')?.dataset.userId;

        box.textContent = '';

        if (character) box.append(character);
        else box.append(...Array.from(doc.body.childNodes));

        const root = box.querySelector('.character');
        if (!root) {
          box.textContent = '';
          box.append(
            createEl('div', {
              style: 'padding:2em; color:red;',
              text: config.errorText,
            }),
          );
          return;
        }

        enhanced = enhanceCharacter(root, { uid: targetUid, close: closeOrig });

        const dialogEl = root.querySelector('.cm-shell') || root;
        focusCleanup = setupFocusTrap(dialogEl, { onClose: closeAll });

        const btnClose = root.querySelector('[data-modal-close]');
        if (btnClose) btnClose.addEventListener('click', (ev) => ev.preventDefault());
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        box.textContent = '';
        box.append(
          createEl('div', {
            style: 'padding:2em; color:red;',
            text: config.errorText,
          }),
        );
        const fallback = box.querySelector('.character-modal') || box;
        focusCleanup = setupFocusTrap(fallback, { onClose: closeAll });
      }

      box.addEventListener('cm:request-close', closeAll);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('characterModal', { init });
})();
