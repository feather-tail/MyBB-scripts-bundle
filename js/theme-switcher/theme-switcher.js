(() => {
  'use strict';

  const helpers = window.helpers || {};
  const $ = helpers.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ =
    helpers.$$ ||
    ((sel, root = document) => Array.from(root.querySelectorAll(sel)));
  const getConfig =
    helpers.getConfig ||
    ((key, fallback = {}) => {
      const sc = (window.ScriptConfig && window.ScriptConfig[key]) || null;
      return sc ? sc : fallback;
    });

  const cfg = getConfig('themeSwitcher', {});
  const root = document.querySelector(cfg?.selectors?.root || 'html');

  const pick = (sel, fallback) => {
    if (typeof sel === 'string' && sel) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return fallback;
  };

  const C = {
    storageKey:
      (cfg?.storage?.key || 'mybb.display.v1') +
      (cfg?.storage?.instance ? ':' + cfg.storage.instance : ''),
    stylePrefix: cfg?.classes?.stylePrefix ?? 'ds-style-',
    schemeLight: cfg?.classes?.schemeLight || 'ds-scheme-light',
    schemeDark: cfg?.classes?.schemeDark || 'ds-scheme-dark',
    forceMobile: cfg?.classes?.forceMobile || 'force-mobile',
    activeCtl: cfg?.classes?.activeControl || 'is-active',
    styleMountCls: cfg?.classes?.styleMount || 'ts-style-mount',
    styleBtnCls: cfg?.classes?.styleButton || 'ts-style-btn',
    styleBtnPref: cfg?.classes?.styleButtonPrefix || 'ts-style-',
    sel: {
      style: cfg?.selectors?.controls?.style || '[data-display-style]',
      scheme: cfg?.selectors?.controls?.scheme || '[data-display-scheme]',
      view: cfg?.selectors?.controls?.view || '[data-display-view]',
      chkFM:
        cfg?.selectors?.controls?.forceMobileCheckbox || '#forceMobileToggle',
    },
    ui: {
      schemeMount: cfg?.selectors?.ui?.schemeMount || '#stylelist',
      styleMountSel: cfg?.selectors?.ui?.styleMount || '[data-style-mount]',
      styleMountId: cfg?.selectors?.ui?.styleMountId || 'ts-style-mount',
    },
    targets: {
      style: pick(cfg?.selectors?.targets?.style, root),
      scheme: pick(cfg?.selectors?.targets?.scheme, root),
      view: pick(cfg?.selectors?.targets?.view, root),
    },
    defaults: {
      style: cfg?.defaults?.style || 'classic',
      scheme: cfg?.defaults?.scheme || 'light',
      view: cfg?.defaults?.view || 'desktop',
    },
    styleWhitelist: Array.isArray(cfg?.styles)
      ? cfg.styles.map((s) => s.id)
      : [],
    htmlFrameSelector: cfg?.htmlFrameSelector || 'iframe.html_frame',
  };

  const doc = document;
  let state = loadState();

  applyState(state, true);

  window.DisplaySettings = {
    getState: () => ({ ...state }),
    setStyle,
    setScheme,
    setView,
    on: (t, f) => doc.addEventListener(t, f),
    off: (t, f) => doc.removeEventListener(t, f),
    refreshControls: () => {
      bindAll(true);
      updateControlsUI();
    },
  };

  window.themeSwitcher = window.themeSwitcher || {};
  window.themeSwitcher.initSection = function (sectionEl) {
    if (!sectionEl) return;

    const list = sectionEl.querySelector('ul') || sectionEl;

    removeMenuSchemeLists(sectionEl);
    ensureStyleMount(list);
    autoRenderUI(sectionEl, { scheme: false });
    bindAll(true);
  };

  if (helpers.register) {
    helpers.register('themeSwitcher', window.themeSwitcher);
  }

  window.addEventListener('storage', (e) => {
    if (e.key !== C.storageKey) return;

    try {
      const next = JSON.parse(e.newValue || '{}');
      if (!validState(next)) return;

      if (!same(next, state)) {
        const prev = state;
        state = normalize(next);
        applyState(state, true);
        updateControlsUI();
        dispatch('displaysettingschange', { prev, next: { ...state } });
      }
    } catch {}
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(C.storageKey);
      if (raw) {
        const obj = JSON.parse(raw);
        if (validState(obj)) return normalize(obj);
      }
    } catch {}

    return { ...C.defaults };
  }

  function saveState(s) {
    try {
      localStorage.setItem(C.storageKey, JSON.stringify(s));
    } catch {}
  }

  function validState(s) {
    if (!s || typeof s !== 'object') return false;
    if (!s.style || !s.scheme || !s.view) return false;
    if (C.styleWhitelist.length && !C.styleWhitelist.includes(s.style)) {
      return false;
    }
    if (s.scheme !== 'light' && s.scheme !== 'dark') return false;
    if (s.view !== 'mobile' && s.view !== 'desktop') return false;
    return true;
  }

  function normalize(s) {
    let style = s.style;
    const scheme = s.scheme === 'dark' ? 'dark' : 'light';
    const view = s.view === 'mobile' ? 'mobile' : 'desktop';

    if (C.styleWhitelist.length && !C.styleWhitelist.includes(style)) {
      style = C.defaults.style;
    }

    return { style, scheme, view };
  }

  function same(a, b) {
    return a.style === b.style && a.scheme === b.scheme && a.view === b.view;
  }

  function broadcastToHtmlFrames(s) {
    const msg = {
      eventName: 'displayChange',
      state: { style: s.style, scheme: s.scheme, view: s.view },
      iframeCss: Array.isArray(cfg?.iframeCss) ? cfg.iframeCss : [],
      styles: Array.isArray(cfg?.styles)
        ? cfg.styles.map((x) => x.id).filter(Boolean)
        : [],
    };

    document.querySelectorAll(C.htmlFrameSelector).forEach((fr) => {
      try {
        fr.contentWindow?.postMessage(msg, '*');
      } catch {}
    });
  }

  function applyState(s, silent = false) {
    if (!root) return;

    const prevStyleId = root.getAttribute('data-style') || '';

    root.setAttribute('data-style', s.style);
    root.setAttribute('data-scheme', s.scheme);
    root.setAttribute('data-view', s.view);

    const TG = C.targets;

    TG.scheme.classList.remove(C.schemeLight, C.schemeDark);
    TG.scheme.classList.add(
      s.scheme === 'dark' ? C.schemeDark : C.schemeLight,
    );

    if (C.stylePrefix) {
      removeByPrefix(TG.style, C.stylePrefix);
      TG.style.classList.add(C.stylePrefix + s.style);
    } else {
      if (prevStyleId) TG.style.classList.remove(prevStyleId);
      if (C.styleWhitelist.length) {
        for (const id of C.styleWhitelist) {
          if (id !== s.style) TG.style.classList.remove(id);
        }
      }
      TG.style.classList.add(s.style);
    }

    TG.view.classList.toggle(C.forceMobile, s.view === 'mobile');

    broadcastToHtmlFrames(s);

    if (!silent) {
      dispatch('displaystylechange', { value: s.style });
      dispatch('displayschemechange', { value: s.scheme });
      dispatch('displayviewchange', { value: s.view });
      dispatch('displaysettingschange', { next: { ...s } });
    }
  }

  function autoRenderUI(targetRoot = doc, opts = {}) {
    removeMenuSchemeLists();

    if (opts.scheme !== false) {
      autoRenderSchemeUI(targetRoot);
    }

    autoRenderStyleUI(targetRoot);
  }

  function autoRenderSchemeUI(targetRoot = doc) {
    const schemeLists = getSchemeLists(targetRoot);

    schemeLists.forEach((ul) => {
      if (isInsideSettingsMenu(ul)) return;
      if (!ul.querySelector('li')) renderLegacySchemeList(ul);
      normalizeLegacySchemeList(ul);
    });

    updateLegacySchemeActive();
  }

  function autoRenderStyleUI(targetRoot = doc) {
    const styleMount =
      (C.ui.styleMountSel && $(C.ui.styleMountSel, targetRoot)) ||
      $('[data-style-mount]', targetRoot);

    if (!styleMount || styleMount.querySelector('[data-display-style]')) {
      return;
    }

    const isList = /^(UL|OL)$/i.test(styleMount.tagName);

    const mk = (id, label) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.setAttribute('data-display-style', id);
      b.textContent = label || id;
      if (C.styleBtnCls) b.classList.add(C.styleBtnCls);
      if (C.styleBtnPref) b.classList.add(C.styleBtnPref + id);
      return b;
    };

    const items = (cfg.styles || []).map((s) => mk(s.id, s.label));
    if (!items.length) items.push(mk(C.defaults.style, C.defaults.style));

    if (isList) {
      for (const b of items) {
        const li = doc.createElement('li');
        li.appendChild(b);
        styleMount.appendChild(li);
      }
    } else {
      for (const b of items) styleMount.appendChild(b);
    }
  }

  function ensureStyleMount(list) {
    const existing =
      (C.ui.styleMountSel && $(C.ui.styleMountSel, list)) ||
      list.querySelector(`#${C.ui.styleMountId}`) ||
      list.querySelector('[data-style-mount]');

    if (existing) return existing;

    const li = doc.createElement('li');
    const div = doc.createElement('div');

    div.setAttribute('data-style-mount', '');
    div.id = C.ui.styleMountId;

    if (C.styleMountCls) div.classList.add(C.styleMountCls);

    li.appendChild(div);
    list.appendChild(li);

    return div;
  }

  function getSchemeLists(targetRoot = doc) {
    const selector = C.ui.schemeMount || '#stylelist';
    const result = new Set();

    try {
      if (
        targetRoot.nodeType === 1 &&
        targetRoot.matches &&
        targetRoot.matches(selector)
      ) {
        result.add(targetRoot);
      }

      targetRoot.querySelectorAll(selector).forEach((el) => result.add(el));
    } catch {
      if (selector !== '#stylelist') {
        targetRoot.querySelectorAll('#stylelist').forEach((el) => result.add(el));
      }
    }

    if (selector !== '#stylelist') {
      try {
        targetRoot.querySelectorAll('#stylelist').forEach((el) => result.add(el));
      } catch {}
    }

    return Array.from(result);
  }

  function renderLegacySchemeList(ul) {
    ul.innerHTML = '';

    const makeLi = (mode, text) => {
      const li = doc.createElement('li');
      const a = doc.createElement('a');

      li.setAttribute('data', mode);
      li.setAttribute('data-display-scheme', mode);

      a.href = '#';
      a.setAttribute('data-display-scheme', mode);
      a.textContent = text;

      li.appendChild(a);

      return li;
    };

    ul.appendChild(makeLi('light', '1'));
    ul.appendChild(makeLi('dark', '2'));
  }

  function normalizeLegacySchemeList(ul) {
    ul.querySelectorAll('li').forEach((li) => {
      const mode = getSchemeFromLegacyItem(li);
      if (!mode) return;

      li.setAttribute('data', mode);
      li.setAttribute('data-display-scheme', mode);

      const a = li.querySelector('a');
      if (a) {
        a.removeAttribute('onclick');
        a.setAttribute('data-display-scheme', mode);

        if (!a.getAttribute('href') || a.getAttribute('href') === '/') {
          a.setAttribute('href', '#');
        }
      }
    });
  }

  function getSchemeFromLegacyItem(el) {
    const raw =
      el?.getAttribute?.('data-display-scheme') ||
      el?.getAttribute?.('data') ||
      el?.dataset?.displayScheme ||
      '';

    const mode = String(raw).toLowerCase();

    if (mode === 'light' || mode === 'dark') return mode;

    return '';
  }

  function bindLegacySchemeLists(rebind = false) {
    getSchemeLists(doc).forEach((ul) => {
      if (isInsideSettingsMenu(ul)) return;

      normalizeLegacySchemeList(ul);

      if (rebind && ul.__ds_legacy_handler) {
        ul.removeEventListener('click', ul.__ds_legacy_handler, true);
      }

      const fn = (e) => {
        const li = e.target.closest('li');
        if (!li || !ul.contains(li)) return;

        const mode = getSchemeFromLegacyItem(li);
        if (!mode) return;

        e.preventDefault();
        e.stopPropagation();

        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }

        setScheme(mode);
      };

      ul.addEventListener('click', fn, true);
      ul.__ds_legacy_handler = fn;
    });
  }

  function updateLegacySchemeActive() {
    getSchemeLists(doc).forEach((ul) => {
      if (isInsideSettingsMenu(ul)) return;

      ul.querySelectorAll('li').forEach((li) => {
        const mode = getSchemeFromLegacyItem(li);
        const active = mode === state.scheme;

        li.classList.toggle('active', active);
        li.classList.toggle(C.activeCtl, active);

        if (mode) {
          li.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
      });

      ul.querySelectorAll('[data-display-scheme]').forEach((el) => {
        const mode = getSchemeFromLegacyItem(el);
        const active = mode === state.scheme;

        if (el.tagName !== 'LI') {
          el.classList.toggle(C.activeCtl, active);
          el.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
      });
    });
  }

  function removeMenuSchemeLists(rootEl = doc) {
    const roots = [];

    if (rootEl.nodeType === 1) {
      if (rootEl.id === 'settings-menu') roots.push(rootEl);

      const closestMenu = rootEl.closest?.('#settings-menu');
      if (closestMenu) roots.push(closestMenu);

      const nestedMenu = rootEl.querySelector?.('#settings-menu');
      if (nestedMenu) roots.push(nestedMenu);
    } else {
      const menu = doc.getElementById('settings-menu');
      if (menu) roots.push(menu);
    }

    Array.from(new Set(roots)).forEach((menuRoot) => {
      menuRoot.querySelectorAll('ul#stylelist').forEach((ul) => {
        const parent = ul.parentElement;
        ul.remove();

        if (
          parent &&
          parent.tagName === 'LI' &&
          !parent.children.length &&
          !parent.textContent.trim()
        ) {
          parent.remove();
        }
      });
    });
  }

  function isInsideSettingsMenu(el) {
    return !!el?.closest?.('#settings-menu');
  }

  function setStyle(id) {
    const next = normalize({ ...state, style: id });
    if (next.style === state.style) return;

    const prev = state;
    state = next;

    applyState(state);
    updateControlsUI();
    saveState(state);
    dispatch('displaystylechange', { prev: prev.style, value: state.style });
  }

  function setScheme(mode) {
    const next = normalize({ ...state, scheme: mode });
    if (next.scheme === state.scheme) return;

    const prev = state;
    state = next;

    applyState(state);
    updateControlsUI();
    saveState(state);
    dispatch('displayschemechange', {
      prev: prev.scheme,
      value: state.scheme,
    });
  }

  function setView(v) {
    const next = normalize({ ...state, view: v });
    if (next.view === state.view) return;

    const prev = state;
    state = next;

    applyState(state);
    updateControlsUI();
    saveState(state);
    dispatch('displayviewchange', { prev: prev.view, value: state.view });
  }

  function removeByPrefix(el, prefix) {
    const toRemove = [];

    el.classList.forEach((c) => {
      if (c.startsWith(prefix)) toRemove.push(c);
    });

    toRemove.forEach((c) => el.classList.remove(c));
  }

  function bindAll(rebind = false) {
    bindGroup(C.sel.style, handleStyle, rebind);
    bindGroup(C.sel.scheme, handleScheme, rebind);
    bindGroup(C.sel.view, handleView, rebind);
    bindLegacySchemeLists(rebind);

    const cb = document.querySelector(C.sel.chkFM);
    if (cb) bindForceMobileCheckbox(cb, rebind);

    updateControlsUI();
  }

  function bindGroup(selector, handler, rebind) {
    const nodes = $$(selector);

    for (const el of nodes) {
      if (isInsideSettingsMenu(el) && el.closest('#stylelist')) continue;

      if (rebind && el.__ds_handler) {
        el.removeEventListener('click', el.__ds_handler);
        el.removeEventListener('change', el.__ds_handler);
      }

      const fn = (e) => {
        if (e.type === 'click') {
          if (e.defaultPrevented) return;
          if (el.tagName === 'A') e.preventDefault();
        }

        handler(el);
      };

      el.addEventListener('click', fn);
      el.addEventListener('change', fn);
      el.__ds_handler = fn;

      if (el.tagName !== 'INPUT') {
        el.setAttribute('aria-pressed', 'false');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      }
    }
  }

  function handleStyle(el) {
    const id = el.getAttribute('data-display-style');
    if (id) setStyle(id);
  }

  function handleScheme(el) {
    const m = el.getAttribute('data-display-scheme');
    if (m) setScheme(m);
  }

  function handleView(el) {
    const v = el.getAttribute('data-display-view');
    if (v) setView(v);
  }

  function bindForceMobileCheckbox(cb, rebind) {
    if (rebind && cb.__ds_cb) cb.removeEventListener('change', cb.__ds_cb);

    const fn = () => setView(cb.checked ? 'mobile' : 'desktop');

    cb.addEventListener('change', fn);
    cb.__ds_cb = fn;
    cb.checked = state.view === 'mobile';

    const label = cb.closest('label.fm-toggle');
    if (label) {
      label.hidden = false;
      label.style.display = '';
    }
  }

  function updateControlsUI() {
    for (const el of $$(C.sel.style)) {
      reflect(el, el.getAttribute('data-display-style') === state.style);
    }

    for (const el of $$(C.sel.scheme)) {
      if (isInsideSettingsMenu(el) && el.closest('#stylelist')) continue;
      reflect(el, el.getAttribute('data-display-scheme') === state.scheme);
    }

    for (const el of $$(C.sel.view)) {
      reflect(el, el.getAttribute('data-display-view') === state.view);
    }

    const cb = document.querySelector(C.sel.chkFM);
    if (cb) cb.checked = state.view === 'mobile';

    updateLegacySchemeActive();
  }

  function reflect(el, active) {
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || '').toLowerCase();

      if (t === 'checkbox' || t === 'radio') {
        el.checked = !!active;
      }

      el.setAttribute('aria-checked', active ? 'true' : 'false');
    } else {
      el.classList.toggle(C.activeCtl, !!active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');

      if (!el.hasAttribute('role')) {
        el.setAttribute('role', 'button');
      }
    }
  }

  function observeDom() {
    const start = () => {
      if (!document.body) return;

      const mo = new MutationObserver((ml) => {
        for (const m of ml) {
          if (m.addedNodes && m.addedNodes.length) {
            autoRenderUI();
            bindAll(true);
            break;
          }
        }
      });

      mo.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) {
      start();
    } else {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    }
  }

  function dispatch(type, detail) {
    try {
      doc.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {}
  }

  function init() {
    applyState(state, true);
    autoRenderUI();
    bindAll();
    observeDom();

    setTimeout(() => broadcastToHtmlFrames(state), 300);
    setTimeout(() => broadcastToHtmlFrames(state), 1200);

    const cb = document.querySelector(C.sel.chkFM);
    const label = cb && cb.closest('label.fm-toggle');

    if (label) {
      label.hidden = false;
      label.style.display = '';
    }
  }

  function bootstrap() {
    const h = window.helpers;

    if (h && typeof h.runOnceOnReady === 'function') {
      h.runOnceOnReady(init);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }

  bootstrap();

  window.setStyle = function (id) {
    try {
      id = String(id).toLowerCase();
    } catch {}

    if (id === 'light' || id === 'dark') {
      setScheme(id);
    } else {
      setStyle(id);
    }

    return false;
  };
})();
