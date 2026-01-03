(() => {
  'use strict';

  const KS = (window.KS_DROPS = window.KS_DROPS || {});
  KS.version = '2026-01-03';

  const DEFAULTS = {
    apiBase: 'https://feathertail.ru/ks/drops/api.php',
    pollMs: 8000,
    uiMountId: 'ks-drops-root',
    enabledKey: 'ks_drops_enabled',
    debugKey: 'ks_drops_debug',
    credentials: 'omit',
    itemLabels: {
      1: 'Ресурс #1',
      2: 'Ресурс #2',
      3: 'Ресурс #3',
      4: 'Ресурс #4',
      5: 'Ресурс #5',
      6: 'Ресурс #6',
      7: 'Ресурс #7',
      8: 'Ресурс #8',
      9: 'Ресурс #9',
      10: 'Ресурс #10',
      11: 'Ресурс #11',
      12: 'Ресурс #12',
    },
  };

  const state = {
    lastTick: null,
    lastState: null,
    lastError: null,
  };

  const cfg = () => {
    const c = (window.ScriptConfig && window.ScriptConfig.drops) ? window.ScriptConfig.drops : {};
    return { ...DEFAULTS, ...c };
  };

  const isDebug = () => {
    try {
      return String(localStorage.getItem(cfg().debugKey) || '') === '1';
    } catch (_) {
      return false;
    }
  };

  const log = (...a) => {
    if (isDebug()) console.log('[KS_DROPS]', ...a);
  };

  const waitFor = (check, maxMs = 10000, stepMs = 50) =>
    new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function tick() {
        try {
          if (check()) return resolve(true);
        } catch (_) {}
        if (Date.now() - t0 >= maxMs) return reject(new Error('waitFor timeout'));
        setTimeout(tick, stepMs);
      })();
    });

  const getUserId = () => {
    if (window.helpers && typeof window.helpers.getUserId === 'function') {
      const uid = window.helpers.getUserId();
      if (Number.isFinite(uid) && uid > 0) return uid;
    }
    const v = parseInt(String(window.UserID || ''), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  const requestJson = async (url, bodyObj) => {
    const c = cfg();

    if (window.helpers && typeof window.helpers.request === 'function') {
      const res = await window.helpers.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
        timeoutMs: 15000,
        retries: 1,
        retryDelayMs: 400,
      });
      return res;
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      credentials: c.credentials,
      cache: 'no-store',
    });

    const txt = await r.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch (_) {
      json = { ok: false, error: { code: 'BAD_JSON', message: txt.slice(0, 300) } };
    }
    if (!r.ok) {
      const msg = (json && json.error && json.error.message) ? json.error.message : ('HTTP ' + r.status);
      throw new Error(msg);
    }
    return json;
  };

  KS.core = {
    cfg,
    waitFor,
    getUserId,
    log,
    state,
    requestJson,
  };

  KS.debugState = () => ({
    version: KS.version,
    cfg: cfg(),
    internal: { ...state },
    userId: getUserId(),
    debug: isDebug(),
  });
})();
