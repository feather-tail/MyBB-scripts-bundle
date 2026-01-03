(() => {
  'use strict';

  const C = window.KS_DROPS_CORE;
  if (!C) return;

  window.KS_DROPS = window.KS_DROPS || {};
  const API = window.KS_DROPS;

  if (API.__client_loaded) return;
  API.__client_loaded = true;

  const TOGGLE_KEY = 'ks_drops_enabled';

  const safeLsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const safeLsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  const loadEnabled = (fallback = false) => {
    const raw = safeLsGet(TOGGLE_KEY);
    if (raw === null) return !!fallback;
    return raw === '1';
  };
  const saveEnabled = (v) => safeLsSet(TOGGLE_KEY, v ? '1' : '0');

  const DEFAULTS = {
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    debug: false,

    access: {
      allowAllUsers: true,
      hideForGuests: true,
      whitelistGroups: [],
      adminGroup: 1,
    },

    polling: {
      pollIntervalMs: 3500,
      renderTickMs: 250,
      onlinePollIntervalMs: 30000,
      requestTimeoutMs: 12000,
      retries: 0,
    },

    scope: { onlyWhenPageMatches: false, pageRules: [] },

    ui: {
      widgetId: 'ks-drops-root',
      mountTo: 'body',
      position: 'bottom-right',
      zIndex: 99999,

      showTimer: true,
      compactStack: true,
      maxVisible: 2,

      dropSizePx: 34,

      randomPosition: { enabled: false, padding: 16, reRollOnSpawn: true },

      toggle: {
        mountSelector: '#work-button',
        btnClass: 'ks-drops-toggle',
        wrapClass: 'ks-drops-toggle-wrap',
        iconClass: 'fa-solid fa-cubes',
        label: 'Переключить сбор ресурсов',
        titleOn: 'Выключить сбор ресурсов',
        titleOff: 'Включить сбор ресурсов',
        titleDisabled: 'Недоступно',
      },

      texts: {
        collected: 'Собрано: {{title}} x{{qty}}',
        already: 'Не успели: дроп уже забрали',
        expired: 'Дроп исчез',
        forbidden: 'Нет прав для сбора',
        error: 'Ошибка дропов',
      },
    },
  };

  const parseServerDateMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    if (!s) return 0;
    if (s.includes('T')) {
      const ms = Date.parse(s);
      return Number.isFinite(ms) ? ms : 0;
    }
    const iso = s.replace(' ', 'T') + 'Z';
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
  };

  const state = {
    initialized: false,
    initPromise: null,

    H: null,
    cfg: null,

    desiredEnabled: loadEnabled(false),

    running: false,
    pausedByVisibility: false,

    auth: null,
    drops: new Map(),

    toggleBtn: null,

    inflight: { state: false, online: false },

    timers: { state: null, online: null, tick: null },

    clock: { offsetMs: 0, hasServerClock: false },

    resizeRaf: 0,
  };

  const getCfgLike = () => C.deepMerge(DEFAULTS, C.getCfg() || {});

  const buildApi = (cfg) => (action, params) => C.apiUrl(cfg, action, params);

  const pageMatches = () => {
    const cfg = state.cfg || DEFAULTS;
    const rules = cfg.scope?.pageRules || [];
    const path = location.pathname + location.search;
    if (!rules.length) return true;

    for (const r of rules) {
      try {
        if (r?.match instanceof RegExp && r.match.test(path)) return true;
        if (typeof r?.match === 'string' && new RegExp(r.match).test(path))
          return true;
      } catch {}
    }
    return false;
  };

  const isEligible = () => {
    const cfg = state.cfg || DEFAULTS;
    return C.isEligibleByAccess(state.H, {
      ...(cfg.access || {}),
    });
  };

  const getRndCfg = () => {
    const cfg = state.cfg || DEFAULTS;
    return cfg.ui?.randomPosition || cfg.randomPosition || { enabled: false };
  };

  const getMountElLikeToggle = (selector) => {
    const el = selector ? document.querySelector(selector) : null;
    if (el) return el;

    if (selector && selector.startsWith('#')) {
      const id = selector.slice(1);
      if (id) {
        const fallback = document.createElement('div');
        fallback.id = id;
        document.body.appendChild(fallback);
        return fallback;
      }
    }
    return document.body;
  };

  const updateToggleUI = () => {
    const btn = state.toggleBtn;
    if (!btn) return;

    const cfg = state.cfg || getCfgLike();
    const t = cfg.ui?.toggle || DEFAULTS.ui.toggle;

    const canRun = (() => {
      const uid = C.getUserId(state.H);
      if (cfg.access?.hideForGuests && uid <= 0) return false;
      return isEligible();
    })();

    btn.disabled = !canRun;
    btn.setAttribute('aria-pressed', state.running ? 'true' : 'false');
    btn.title = !canRun
      ? t.titleDisabled || 'Недоступно'
      : state.running
      ? t.titleOn || 'Выключить'
      : t.titleOff || 'Включить';
  };

  const ensureToggleEarly = () => {
    try {
      const cfgLike = getCfgLike();
      const t = cfgLike.ui?.toggle || DEFAULTS.ui.toggle;

      const mount = getMountElLikeToggle(t.mountSelector || '#work-button');

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
      btn.addEventListener('click', () => API.toggle?.());

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
    } catch {}
  };

  const ensureRoot = () => {
    const cfg = state.cfg || DEFAULTS;
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
    const cfg = state.cfg || DEFAULTS;
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
    const cfg = state.cfg || DEFAULTS;
    if (!rnd?.enabled) return;

    el.style.opacity = '0';
    requestAnimationFrame(() => {
      const pad = C.toInt(rnd.padding ?? 16);
      const rect = el.getBoundingClientRect();
      const w = Math.max(16, rect.width || C.toInt(cfg.ui?.dropSizePx || 34));
      const h = Math.max(16, rect.height || C.toInt(cfg.ui?.dropSizePx || 34));
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
    const cfg = state.cfg || DEFAULTS;
    const dropId = String(d.drop_id);

    let rec = state.drops.get(dropId);

    const createdMs =
      d.created_at_ms ||
      parseServerDateMs(d.created_at_iso) ||
      parseServerDateMs(d.created_at);
    const expiresMs =
      d.expires_at_ms ||
      parseServerDateMs(d.expires_at_iso) ||
      parseServerDateMs(d.expires_at);

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

      rec = {
        drop_id: dropId,
        el,
        createdMs,
        expiresMs,
        title: d.title,
        image_url: d.image_url,
      };
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

  const getNowMs = () =>
    state.clock.hasServerClock ? Date.now() - state.clock.offsetMs : Date.now();

  const renderTick = () => {
    if (!state.running) return;

    const cfg = state.cfg || DEFAULTS;
    const showTimer = !!cfg.ui?.showTimer;
    const compact = !!cfg.ui?.compactStack;

    if (!showTimer && !compact) return;
    if (state.drops.size === 0) return;

    const now = getNowMs();
    const maxVisible = cfg.ui?.maxVisible ?? 2;

    let idx = 0;
    for (const rec of state.drops.values()) {
      const expires = rec.expiresMs || 0;
      const left = expires ? Math.max(0, expires - now) : 0;

      if (expires && left <= 0) {
        removeDrop(rec.drop_id);
        continue;
      }

      if (showTimer) {
        const t = rec.el.querySelector('.ks-drops__timer');
        if (t) {
          const s = expires ? Math.ceil(left / 1000) + 's' : '';
          if (t.textContent !== s) t.textContent = s;
        }
      }

      if (compact) rec.el.classList.toggle('is-hidden', idx >= maxVisible);
      idx++;
    }
  };

  const fetchState = async () => {
    if (!state.running || !state.auth?.eligible) return;
    if (state.inflight.state) return;

    const cfg = state.cfg || DEFAULTS;
    const H = state.H;
    if (!H || typeof H.request !== 'function') return;

    const api = buildApi(cfg);

    state.inflight.state = true;
    try {
      const url = api('state', {
        user_id: state.auth.userId,
        group_id: state.auth.groupId,
        forum_id: C.getForumId(H) ?? '',
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

      // если сервер вдруг отдаёт обновления (не обязательно)
      if (resp.data?.inventory) C.dispatch('ks:drops:inventoryUpdated', { inventory: resp.data.inventory });
      if (resp.data?.bank) C.dispatch('ks:drops:bankUpdated', { bank: resp.data.bank });
      if (resp.data?.online) C.dispatch('ks:drops:onlineUpdated', { online: resp.data.online });

      renderTick();
    } finally {
      state.inflight.state = false;
    }
  };

  const fetchOnline = async () => {
    if (!state.running || !state.auth?.eligible) return;
    if (state.inflight.online) return;

    const cfg = state.cfg || DEFAULTS;
    const H = state.H;
    if (!H || typeof H.request !== 'function') return;

    const api = buildApi(cfg);

    state.inflight.online = true;
    try {
      const url = api('online', {
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
      if (resp.data?.online) C.dispatch('ks:drops:onlineUpdated', { online: resp.data.online });
    } finally {
      state.inflight.online = false;
    }
  };

  const claimDrop = async (dropId) => {
    const cfg = state.cfg || DEFAULTS;
    const H = state.H;

    if (!state.running || !state.auth?.eligible || !H || typeof H.request !== 'function') {
      C.toast(H, cfg.ui?.texts?.forbidden || 'Нет прав для сбора', 'error');
      return;
    }

    const api = buildApi(cfg);
    const url = api('claim', {});
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
      const qty = C.toInt(d.qty ?? d.count ?? d.item_qty ?? 1) || 1;

      const tpl = cfg.ui?.texts?.collected || 'Собрано: {{title}} x{{qty}}';
      const msg = String(tpl)
        .replace(/{{title}}/g, String(title))
        .replace(/{{qty}}/g, String(qty));

      C.toast(H, msg, 'success');

      if (d.inventory) C.dispatch('ks:drops:inventoryUpdated', { inventory: d.inventory });
      if (d.bank) C.dispatch('ks:drops:bankUpdated', { bank: d.bank });

      removeDrop(dropId);
      renderTick();
    } else {
      const code = d.code || '';
      C.toast(
        H,
        code === 'EXPIRED'
          ? cfg.ui?.texts?.expired || 'Дроп исчез'
          : cfg.ui?.texts?.already || 'Уже забрали',
        'info',
      );
      removeDrop(dropId);
      renderTick();
    }

    if (rec) rec.el.classList.remove('is-busy');
  };

  const clearTimers = () => {
    if (state.timers.state) clearTimeout(state.timers.state);
    if (state.timers.online) clearTimeout(state.timers.online);
    if (state.timers.tick) clearTimeout(state.timers.tick);
    state.timers.state = state.timers.online = state.timers.tick = null;
  };

  const scheduleState = (delayMs) => {
    const cfg = state.cfg || DEFAULTS;
    const d = Math.max(250, C.toInt(delayMs ?? cfg.polling?.pollIntervalMs ?? 3500));
    state.timers.state = setTimeout(async () => {
      if (!state.running || state.pausedByVisibility) return;
      await fetchState();
      if (!state.running || state.pausedByVisibility) return;
      scheduleState(cfg.polling?.pollIntervalMs ?? 3500);
    }, d);
  };

  const scheduleOnline = (delayMs) => {
    const cfg = state.cfg || DEFAULTS;
    const d = Math.max(1000, C.toInt(delayMs ?? cfg.polling?.onlinePollIntervalMs ?? 30000));
    state.timers.online = setTimeout(async () => {
      if (!state.running || state.pausedByVisibility) return;
      await fetchOnline();
      if (!state.running || state.pausedByVisibility) return;
      scheduleOnline(cfg.polling?.onlinePollIntervalMs ?? 30000);
    }, d);
  };

  const scheduleTick = (delayMs) => {
    const cfg = state.cfg || DEFAULTS;
    const needTick = !!cfg.ui?.showTimer || !!cfg.ui?.compactStack;
    if (!needTick) return;

    const d = Math.max(250, C.toInt(delayMs ?? cfg.polling?.renderTickMs ?? 250));
    state.timers.tick = setTimeout(() => {
      if (!state.running || state.pausedByVisibility) return;
      renderTick();
      if (!state.running || state.pausedByVisibility) return;
      scheduleTick(cfg.polling?.renderTickMs ?? 250);
    }, d);
  };

  const startLoops = () => {
    clearTimers();
    scheduleState(0);
    scheduleOnline(0);
    scheduleTick(0);
  };

  const stop = () => {
    if (!state.running) return;

    state.running = false;
    state.pausedByVisibility = false;
    clearTimers();

    for (const id of Array.from(state.drops.keys())) removeDrop(id);
    state.drops.clear();

    removeRoot();
    updateToggleUI();
  };

  const start = () => {
    const cfg = state.cfg || DEFAULTS;

    if (state.running) return;

    if (cfg.scope?.onlyWhenPageMatches && !pageMatches()) {
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
    state.pausedByVisibility = false;

    ensureRoot();
    startLoops();
    fetchState();
    fetchOnline();
    renderTick();

    updateToggleUI();
  };

  const applyEnabled = (v) => {
    const nv = !!v;
    if (nv) start();
    else stop();
    updateToggleUI();
  };

  const setEnabled = (v) => {
    const nv = !!v;
    state.desiredEnabled = nv;
    saveEnabled(nv);
    applyEnabled(nv);
  };

  const toggle = () => setEnabled(!loadEnabled(false));

  const pauseForVisibility = () => {
    if (!state.running) return;
    state.pausedByVisibility = true;
    clearTimers();
  };

  const resumeFromVisibility = () => {
    if (!state.running) return;
    if (!state.pausedByVisibility) return;
    state.pausedByVisibility = false;
    startLoops();
    fetchState();
    fetchOnline();
    renderTick();
  };

  const ensureInit = () => {
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async () => {
      await C.domReady();

      ensureToggleEarly();

      const H = await C.waitForHelpers(15000, 50);
      state.H = H || null;

      state.cfg = getCfgLike();

      updateToggleUI();

      window.addEventListener('storage', (e) => {
        if (e.key !== TOGGLE_KEY) return;
        state.desiredEnabled = e.newValue === '1';
        if (state.initialized) applyEnabled(state.desiredEnabled);
      });

      document.addEventListener('visibilitychange', () => {
        if (!state.running) return;
        if (document.hidden) pauseForVisibility();
        else resumeFromVisibility();
      });

      window.addEventListener(
        'resize',
        () => {
          const rnd = getRndCfg();
          if (!rnd?.enabled) return;
          if (state.resizeRaf) cancelAnimationFrame(state.resizeRaf);
          state.resizeRaf = requestAnimationFrame(() => {
            state.resizeRaf = 0;
            for (const rec of state.drops.values()) placeRandom(rec.el);
          });
        },
        { passive: true },
      );

      state.initialized = true;

      applyEnabled(state.desiredEnabled);
    })().catch(() => {
      state.initPromise = null;
    });

    return state.initPromise;
  };

  API.start = () =>
    ensureInit().then(() => {
      state.desiredEnabled = true;
      saveEnabled(true);
      applyEnabled(true);
    });

  API.stop = () =>
    ensureInit().then(() => {
      state.desiredEnabled = false;
      saveEnabled(false);
      applyEnabled(false);
    });

  API.toggle = () => ensureInit().then(() => toggle());

  API.setEnabled = (v) => ensureInit().then(() => setEnabled(!!v));

  API.getState = () => ({
    running: state.running,
    pausedByVisibility: state.pausedByVisibility,
    desiredEnabled: state.desiredEnabled,
    eligible: !!state.auth?.eligible,
    drops: state.drops.size,
    hasHelpers: !!state.H,
    cfg: state.cfg,
  });

  C.domReady().then(() => {
    ensureToggleEarly();
    ensureInit();
  });
})();
