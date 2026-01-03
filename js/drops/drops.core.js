(() => {
  'use strict';
  if (window.KS_DROPS_CORE) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const domReady = () => {
    if (document.readyState === 'loading') {
      return new Promise((resolve) =>
        document.addEventListener('DOMContentLoaded', resolve, { once: true }),
      );
    }
    return Promise.resolve();
  };
  const waitForHelpers = async (maxMs = 15000, stepMs = 50) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const H = window.helpers;
      if (H && typeof H.request === 'function') return H;
      await sleep(stepMs);
    }
    return null;
  };
  const toInt = (v) => {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const normalizeIntArray = (arr) =>
    (Array.isArray(arr) ? arr : []).map(toInt).filter((n) => n > 0);
  const deepMerge = (base, patch) => {
    const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
    if (!patch) return out;
    if (Array.isArray(patch)) return patch.slice();
    for (const [k, v] of Object.entries(patch)) {
      if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
      else out[k] = v;
    }
    return out;
  };
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
      requestTimeoutMs: 12000,
      retries: 0,
      onlinePollIntervalMs: 30000,
    },
    inventory: {
      mountId: 'ks-drops-inventory-root',
      allowAllUsers: true,
      allowDepositToBank: true,
      showOnlineBox: true,
      showBankBox: true,
    },
    admin: { mountId: 'ks-drops-admin-root' },
  };
  const getUserId = (H) => toInt(H?.getUserId?.() ?? window.UserID ?? 0);
  const getGroupId = (H) => toInt(H?.getGroupId?.() ?? window.GroupID ?? 0);
  const getForumId = (H) => toInt(H?.getForumId?.() ?? window.BoardID ?? 0);
  const getCfg = () => {
    const base = deepMerge(DEFAULTS, window.ScriptConfig?.drops || {});
    const H = window.helpers;
    if (H && typeof H.getConfig === 'function') {
      try {
        const fromHelpers = H.getConfig(
          'drops',
          window.ScriptConfig?.drops || {},
        );
        return deepMerge(DEFAULTS, fromHelpers || {});
      } catch {
        return base;
      }
    }
    return base;
  };
  const buildQuery = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      sp.set(k, String(v));
    });
    return sp.toString();
  };
  const apiUrl = (cfg, action, params) => {
    const base = String((cfg?.apiBase || DEFAULTS.apiBase) ?? '').trim();
    const q = buildQuery({ action, ...(params || {}) });
    return base + (base.includes('?') ? '&' : '?') + q;
  };
  const el = (_H, tag, props) => {
    const node = document.createElement(tag);
    const p = props || {};
    if (p.className) node.className = String(p.className);
    if (p.text !== undefined && p.text !== null)
      node.textContent = String(p.text);
    if (p.html !== undefined && p.html !== null)
      node.innerHTML = String(p.html);
    if (p.dataset && typeof p.dataset === 'object') {
      for (const [k, v] of Object.entries(p.dataset)) {
        if (v === undefined || v === null) continue;
        node.dataset[k] = String(v);
      }
    }
    if (p.style && typeof p.style === 'object') {
      for (const [k, v] of Object.entries(p.style)) {
        if (v === undefined || v === null) continue;
        try {
          node.style[k] = String(v);
        } catch {}
      }
    }
    for (const [k, v] of Object.entries(p)) {
      if (
        k === 'className' ||
        k === 'text' ||
        k === 'html' ||
        k === 'dataset' ||
        k === 'style'
      ) {
        continue;
      }
      if (v === undefined || v === null) continue;
      try {
        if (k in node) node[k] = v;
        else node.setAttribute(k, String(v));
      } catch {
        try {
          node.setAttribute(k, String(v));
        } catch {}
      }
    }
    return node;
  };
  const toast = (H, msg, type = 'info') => {
    if (H && typeof H.showToast === 'function') {
      H.showToast(String(msg), type);
      return;
    }
    try {
      alert(String(msg));
    } catch {}
  };
  const dispatch = (name, detail) => {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch {}
  };
  const isEligibleByAccess = (H, access) => {
    const a = access || {};
    const uid = getUserId(H);
    const gid = getGroupId(H);
    if (a.hideForGuests && uid <= 0) return false;
    if (a.allowAllUsers !== false) return uid > 0;
    const wl = normalizeIntArray(a.whitelistGroups || []);
    if (!wl.length) return uid > 0;
    return uid > 0 && wl.includes(gid);
  };
  window.KS_DROPS_CORE = {
    sleep,
    domReady,
    waitForHelpers,
    toInt,
    normalizeIntArray,
    deepMerge,
    getCfg,
    apiUrl,
    el,
    toast,
    dispatch,
    getUserId,
    getGroupId,
    getForumId,
    isEligibleByAccess,
  };
})();
