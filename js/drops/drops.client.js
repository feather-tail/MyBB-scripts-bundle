(() => {
  'use strict';

  const C = window.KS_DROPS_CORE;
  if (!C) return;

  const VERSION = '1.1.0';
  const TOGGLE_KEY = 'ks_drops_enabled';

  window.KS_DROPS = window.KS_DROPS || {};
  const API = window.KS_DROPS;

  if (API.__client_loaded) return;
  API.__client_loaded = true;

  const loadEnabled = (fallback = false) => {
    const raw = C.safeLsGet(TOGGLE_KEY);
    if (raw === null) return !!fallback;
    return raw === '1';
  };
  const saveEnabled = (v) => C.safeLsSet(TOGGLE_KEY, v ? '1' : '0');

  const state = {
    initialized: false,
    initPromise: null,
    lastInitError: null,

    H: null,
    cfg: null,
    debug: false,

    desiredEnabled: loadEnabled(false),
    running: false,

    auth: null,
    scopeKey: null,
    drops: new Map(),

    timers: { poll: null, tick: null, online: null },

    lastInv: null,
    lastOnline: null,

    clock: { offsetMs: 0, hasServerClock: false },

    toggleBtn: null,
  };

  const log = (...a) => state.debug && console.log('[drops]', ...a);
  const warn = (...a) => state.debug && console.warn('[drops]', ...a);

  API.version = VERSION;

  API.debugState = () => ({
    version: VERSION,
    core: C.version,
    initialized: state.initialized,
    lastInitError: state.lastInitError
      ? String(state.lastInitError?.message || state.lastInitError)
      : null,
    desiredEnabled: state.desiredEnabled,
    running: state.running,
    hasHelpers: !!state.H,
    userId: C.getUserId(state.H),
    groupId: C.getGroupId(state.H),
    dropsCount: state.drops.size,
    scopeKey: state.scopeKey,
  });

  const getRndCfg = () => state.cfg?.ui?.randomPosition || { enabled: false };

  const getNowMs = () =>
    state.clock.hasServerClock ? Date.now() - state.clock.offsetMs : Date.now();

  const isEligible = () => C.isEligibleByAccess(state.H, state.cfg?.access);

  const ensureToggleEarly = () => {
    try {
      const cfg = C.getCfgNoHelpers();
      const t = cfg.ui?.toggle || C.DEFAULTS.ui.toggle;

      const mount =
        document.querySelector(t.mountSelector || '#work-button') ||
        (t.mountSelector?.startsWith('#')
          ? (() => {
              const id = t.mountSelector.slice(1);
              if (!id) return document.body;
              let d = document.getElementById(id);
              if (!d) {
                d = document.createElement('div');
                d.id = id;
                document.body.appendChild(d);
              }
              return d;
            })()
          : document.body);

      const existing = mount.querySelector(
        '.' + (t.btnClass || 'ks-drops-toggle'),
      );
      if (existing) {
        state.toggleBtn = existing;
        updateToggleUI();
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = t.wrapClass || 'ks-drops-toggle-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = t.btnClass || 'ks-drops-toggle';
      btn.setAttribute('aria-label', t.label || 'Переключить сбор ресурсов');
      btn.addEventListener('click', () => API.toggle());

      const iconClass = t.iconClass || 'fa-solid fa-cubes';
      btn.innerHTML = `
        <span class="ks-drops-toggle__icon" aria-hidden="true">
          <i class="${iconClass}"></i>
          <span class="ks-drops-toggle__fallback">◆</span>
        </span>
      `;

      wrap.appendChild(btn);
      mount.appendChild(wrap);

      state.toggleBtn = btn;
      updateToggleUI();
    } catch (e) {
      warn('ensureToggleEarly failed', e);
    }
  };

  const updateToggleUI = () => {
    const btn = state.toggleBtn;
    if (!btn) return;

    const cfg = state.cfg || C.getCfgNoHelpers();
    const t = cfg.ui?.toggle || C.DEFAULTS.ui.toggle;

    const canRun = (() => {
      if (!state.H) return true;
      return C.isEligibleByAccess(state.H, cfg.access);
    })();

    btn.disabled = !canRun;
    btn.setAttribute('aria-pressed', state.running ? 'true' : 'false');
    btn.title = !canRun
      ? t.titleDisabled || 'Недоступно'
      : state.running
      ? t.titleOn || 'Выключить'
      : t.titleOff || 'Включить';
  };

  const ensureRoot = () => {
    const cfg = state.cfg || C.DEFAULTS;
    const id = cfg.ui?.widgetId || 'ks-drops-root';

    let root = document.getElementById(id);
    if (root) return root;

    root = document.createElement('div');
    root.id = id;
    root.className = 'ks-drops';
    root.style.zIndex = String(cfg.ui?.zIndex ?? 99999);

    const mountTo = cfg.ui?.mountTo || 'body';
    const mount =
      mountTo === 'body'
        ? document.body
        : document.querySelector(mountTo) || document.body;
    mount.appendChild(root);

    const rnd = getRndCfg();
    if (rnd?.enabled) {
      root.dataset.pos = 'free';
      root.style.position = 'fixed';
      root.style.left = '0';
      root.style.top = '0';
      root.style.right = '0';
      root.style.bottom = '0';
      root.style.pointerEvents = 'none';
    } else {
      root.dataset.pos = cfg.ui?.position || 'bottom-right';
    }

    return root;
  };

  const removeRoot = () => {
    const cfg = state.cfg || C.DEFAULTS;
    const id = cfg.ui?.widgetId || 'ks-drops-root';
    const el = document.getElementById(id);
    if (el) {
      try {
        el.remove();
      } catch {}
    }
  };

  const removeDrop = (dropId) => {
    const rec = state.drops.get(dropId);
    if (!rec) return;
    try {
      rec.el.remove();
    } catch {}
    state.drops.delete(dropId);
  };

  const placeRandom = (el) => {
    const rnd = getRndCfg();
    if (!rnd?.enabled) return;

    el.style.opacity = '0';
    requestAnimationFrame(() => {
      const pad = C.toInt(rnd.padding ?? 16);
      const rect = el.getBoundingClientRect();
      const w = Math.max(
        16,
        rect.width || C.toInt(state.cfg?.ui?.dropSizePx || 34),
      );
      const h = Math.max(
        16,
        rect.height || C.toInt(state.cfg?.ui?.dropSizePx || 34),
      );
      const maxX = Math.max(pad, window.innerWidth - pad - w);
      const maxY = Math.max(pad, window.innerHeight - pad - h);
      const x = Math.floor(pad + Math.random() * Math.max(1, maxX - pad));
      const y = Math.floor(pad + Math.random() * Math.max(1, maxY - pad));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.opacity = '1';
    });
  };

  const upsertDropEl = (root, d) => {
    const cfg = state.cfg || C.DEFAULTS;

    const dropId = String(d.drop_id);
    let rec = state.drops.get(dropId);

    const createdMs =
      d.created_at_ms ||
      C.parseServerDateMs(d.created_at_iso) ||
      C.parseServerDateMs(d.created_at);
    const expiresMs =
      d.expires_at_ms ||
      C.parseServerDateMs(d.expires_at_iso) ||
      C.parseServerDateMs(d.expires_at);

    if (!rec) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ks-drops__drop';
      el.title = d.title || 'drop';
      el.dataset.dropId = dropId;

      const img = document.createElement('img');
      img.className = 'ks-drops__img';
      img.alt = d.title || '';
      img.src = d.image_url || '';
      el.appendChild(img);

      if (cfg.ui?.showTimer) {
        const t = document.createElement('span');
        t.className = 'ks-drops__timer';
        t.textContent = '';
        el.appendChild(t);
      }

      const size = C.toInt(cfg.ui?.dropSizePx || 0);
      if (size > 0) {
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.padding = '0';
      }

      el.addEventListener('click', () => claimDrop(dropId));

      const rnd = getRndCfg();
      if (rnd?.enabled) {
        el.style.position = 'absolute';
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.pointerEvents = 'auto';
      }

      root.appendChild(el);

      if (rnd?.enabled) placeRandom(el);

      rec = { ...d, drop_id: dropId, el, createdMs, expiresMs };
      state.drops.set(dropId, rec);
    } else {
      rec.title = d.title;
      rec.image_url = d.image_url;
      rec.createdMs = createdMs || rec.createdMs;
      rec.expiresMs = expiresMs || rec.expiresMs;

      const img = rec.el.querySelector('img');
      if (img && img.src !== d.image_url) img.src = d.image_url || '';
    }
  };

  const renderTick = () => {
    if (!state.running) return;

    const cfg = state.cfg || C.DEFAULTS;
    const now = getNowMs();
    const maxVisible = cfg.ui?.maxVisible ?? 2;

    const list = Array.from(state.drops.values()).sort(
      (a, b) => (a.createdMs || 0) - (b.createdMs || 0),
    );

    list.forEach((rec, idx) => {
      const expires = rec.expiresMs || 0;
      const left = expires ? Math.max(0, expires - now) : 0;

      if (expires && left <= 0) {
        removeDrop(rec.drop_id);
        return;
      }

      const t = rec.el.querySelector('.ks-drops__timer');
      if (t) t.textContent = expires ? Math.ceil(left / 1000) + 's' : '';

      if (cfg.ui?.compactStack)
        rec.el.classList.toggle('is-hidden', idx >= maxVisible);
    });
  };

  const fetchState = async () => {
    if (!state.running || !state.auth?.eligible) return;

    const cfg = state.cfg || C.DEFAULTS;
    const H = state.H;
    if (!H || typeof H.request !== 'function') return;

    const url = C.apiUrl(cfg, 'state', {
      user_id: state.auth.userId,
      group_id: state.auth.groupId,
      forum_id: C.getForumId(H) || '',
      page_url: location.pathname + location.search,
    });

    let resp;
    try {
      resp = await H.request(url, {
        method: 'GET',
        timeout: cfg.polling?.requestTimeoutMs || 12000,
        responseType: 'json',
        retries: cfg.polling?.retries || 0,
      });
    } catch {
      return;
    }

    if (!resp || resp.ok !== true) return;

    const serverNowMs = C.toInt(resp.data?.server_time_ms);
    if (serverNowMs > 0) {
      state.clock.offsetMs = Date.now() - serverNowMs;
      state.clock.hasServerClock = true;
    }

    const root = ensureRoot();
    const drops = resp.data?.drops || [];

    const seen = new Set();
    for (const d of drops) {
      if (!d || !d.drop_id) continue;
      const id = String(d.drop_id);
      const existed = state.drops.has(id);
      seen.add(id);

      upsertDropEl(root, d);

      const rnd = getRndCfg();
      if (rnd?.enabled && rnd.reRollOnSpawn && !existed) {
        const rec = state.drops.get(id);
        if (rec?.el) placeRandom(rec.el);
      }
    }

    for (const id of Array.from(state.drops.keys())) {
      if (!seen.has(id)) removeDrop(id);
    }

    state.scopeKey = resp.data?.scope_key || state.scopeKey;
  };

  const claimDrop = async (dropId) => {
    const cfg = state.cfg || C.DEFAULTS;
    const H = state.H;

    if (!state.running || !state.auth?.eligible) {
      C.toast(H, cfg.ui?.texts?.forbidden || 'Нет прав для сбора', 'error');
      return;
    }
    if (!H || typeof H.request !== 'function') {
      C.toast(H, cfg.ui?.texts?.error || 'Ошибка дропов', 'error');
      return;
    }

    const url = C.apiUrl(cfg, 'claim', {});
    const payload = {
      drop_id: C.toInt(dropId),
      user_id: state.auth.userId,
      group_id: state.auth.groupId,
    };

    const rec = state.drops.get(dropId);
    if (rec) rec.el.classList.add('is-busy');

    let resp;
    try {
      resp = await H.request(url, {
        method: 'POST',
        timeout: cfg.polling?.requestTimeoutMs || 12000,
        responseType: 'json',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(payload),
        retries: cfg.polling?.retries || 0,
      });
    } catch {
      if (rec) rec.el.classList.remove('is-busy');
      C.toast(H, cfg.ui?.texts?.error || 'Ошибка дропов', 'error');
      return;
    }

    if (!resp || resp.ok !== true) {
      if (rec) rec.el.classList.remove('is-busy');
      C.toast(H, cfg.ui?.texts?.error || 'Ошибка дропов', 'error');
      return;
    }

    const d = resp.data || {};
    if (d.claimed) {
      const title = d.item?.title || 'предмет';
      const qty = Math.max(1, C.toInt(d.qty ?? 1));

      const tpl = cfg.ui?.texts?.collected || 'Собрано: {{title}} x{{qty}}';
      const msg = tpl
        .replaceAll('{{title}}', String(title))
        .replaceAll('{{qty}}', String(qty));

      C.toast(H, msg, 'success');
      removeDrop(dropId);

      state.lastInv = d.inventory || null;
      C.dispatch('ks:drops:inventoryUpdated', { inventory: state.lastInv });
    } else {
      const code = d.code || '';
      C.toast(
        H,
        code === 'EXPIRED'
          ? cfg.ui?.texts?.expired || 'Дроп исчез'
          : cfg.ui?.texts?.already || 'Не успели',
        'info',
      );
      removeDrop(dropId);
    }
  };

  const fetchOnline = async () => {
    if (!state.running || !state.auth?.eligible) return;

    const cfg = state.cfg || C.DEFAULTS;
    const H = state.H;
    if (!H || typeof H.request !== 'function') return;

    const url = C.apiUrl(cfg, 'online', {
      user_id: state.auth.userId,
      group_id: state.auth.groupId,
    });

    let resp;
    try {
      resp = await H.request(url, {
        method: 'GET',
        timeout: cfg.polling?.requestTimeoutMs || 12000,
        responseType: 'json',
        retries: cfg.polling?.retries || 0,
      });
    } catch {
      return;
    }

    if (resp?.ok !== true) return;

    state.lastOnline = resp.data?.online || null;
    C.dispatch('ks:drops:onlineUpdated', { online: state.lastOnline });
  };

  const clearTimers = () => {
    if (state.timers.poll) clearInterval(state.timers.poll);
    if (state.timers.tick) clearInterval(state.timers.tick);
    if (state.timers.online) clearInterval(state.timers.online);
    state.timers.poll = state.timers.tick = state.timers.online = null;
  };

  const stop = () => {
    if (!state.running) return;

    state.running = false;
    clearTimers();

    for (const id of Array.from(state.drops.keys())) removeDrop(id);
    state.drops.clear();

    removeRoot();
    updateToggleUI();
  };

  const start = () => {
    const cfg = state.cfg || C.DEFAULTS;

    if (state.running) return;

    if (!C.pageMatches(cfg)) {
      stop();
      updateToggleUI();
      return;
    }

    state.auth = {
      userId: C.getUserId(state.H),
      groupId: C.getGroupId(state.H),
      eligible: isEligible(),
    };

    if (!state.auth.eligible) {
      stop();
      updateToggleUI();
      return;
    }

    state.running = true;

    ensureRoot();
    fetchState();
    renderTick();
    fetchOnline();

    state.timers.poll = setInterval(
      fetchState,
      cfg.polling?.pollIntervalMs || 3500,
    );
    state.timers.tick = setInterval(
      renderTick,
      cfg.polling?.renderTickMs || 250,
    );
    state.timers.online = setInterval(
      fetchOnline,
      cfg.polling?.onlinePollIntervalMs || 30000,
    );

    updateToggleUI();
  };

  const applyEnabled = (v) => {
    if (v) start();
    else stop();
    updateToggleUI();
  };

  const setEnabled = (v) => {
    const nv = !!v;
    state.desiredEnabled = nv;
    saveEnabled(nv);
    applyEnabled(nv);
    C.dispatch('ks:drops:toggle', { enabled: nv, source: 'drops.client' });
  };

  const ensureInit = () => {
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async () => {
      await C.domReady();

      ensureToggleEarly();

      while (true) {
        const H = await C.waitForHelpers(60000, 50);
        if (H) {
          state.H = H;
          break;
        }
        await C.sleep(2000);
      }

      state.cfg = C.getCfg();
      state.debug = !!state.cfg.debug;

      window.addEventListener('ks:drops:toggle', (ev) => {
        if (ev?.detail?.source === 'drops.client') return;
        const en = !!ev.detail?.enabled;
        state.desiredEnabled = en;
        saveEnabled(en);
        applyEnabled(en);
      });

      window.addEventListener('storage', (e) => {
        if (e.key !== TOGGLE_KEY) return;
        const en = e.newValue === '1';
        state.desiredEnabled = en;
        applyEnabled(en);
      });

      window.addEventListener(
        'resize',
        () => {
          const rnd = getRndCfg();
          if (!rnd?.enabled) return;
          for (const rec of state.drops.values()) placeRandom(rec.el);
        },
        { passive: true },
      );

      state.initialized = true;
      updateToggleUI();
      applyEnabled(state.desiredEnabled);
    })().catch((e) => {
      state.lastInitError = e;
      state.initPromise = null;
      warn('init failed', e);
      throw e;
    });

    return state.initPromise;
  };

  API.start = () =>
    ensureInit()
      .then(() => setEnabled(true))
      .catch(() => {});
  API.stop = () =>
    ensureInit()
      .then(() => setEnabled(false))
      .catch(() => {});
  API.toggle = () =>
    ensureInit()
      .then(() => setEnabled(!loadEnabled(false)))
      .catch(() => {});
  API.setEnabled = (v) =>
    ensureInit()
      .then(() => setEnabled(!!v))
      .catch(() => {});

  C.domReady().then(() => {
    ensureToggleEarly();
    ensureInit().catch(() => {});
  });
})();
