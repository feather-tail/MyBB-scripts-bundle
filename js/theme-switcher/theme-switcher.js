(() => {
  'use strict';

  const helpers = window.helpers || {};
  const $  = helpers.$  || ((sel, root=document) => root.querySelector(sel));
  const $$ = helpers.$$ || ((sel, root=document) => Array.from(root.querySelectorAll(sel)));
  const getConfig = helpers.getConfig || ((key, fallback={}) => {
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
    storageKey: (cfg?.storage?.key || 'mybb.display.v1') + (cfg?.storage?.instance ? (':' + cfg.storage.instance) : ''),
    stylePrefix:  cfg?.classes?.stylePrefix  ?? 'ds-style-',
    schemeLight:  cfg?.classes?.schemeLight  || 'ds-scheme-light',
    schemeDark:   cfg?.classes?.schemeDark   || 'ds-scheme-dark',
    forceMobile:  cfg?.classes?.forceMobile  || 'force-mobile',
    activeCtl:    cfg?.classes?.activeControl|| 'is-active',
    styleMountCls: cfg?.classes?.styleMount || 'ts-style-mount',
    styleBtnCls:   cfg?.classes?.styleButton || 'ts-style-btn',
    styleBtnPref:  cfg?.classes?.styleButtonPrefix || 'ts-style-',
    schemeBtnCls:  cfg?.classes?.schemeButton || 'ts-scheme-btn',
    sel: {
      style:  cfg?.selectors?.controls?.style  || '[data-display-style]',
      scheme: cfg?.selectors?.controls?.scheme || '[data-display-scheme]',
      view:   cfg?.selectors?.controls?.view   || '[data-display-view]',
      chkFM:  cfg?.selectors?.controls?.forceMobileCheckbox || '#forceMobileToggle'
    },
    ui: {
      schemeMount: cfg?.selectors?.ui?.schemeMount || null,
      styleMountSel: cfg?.selectors?.ui?.styleMount  || null,
      styleMountId:  cfg?.selectors?.ui?.styleMountId || 'ts-style-mount'
    },
    targets: {
      style:  pick(cfg?.selectors?.targets?.style,  root),
      scheme: pick(cfg?.selectors?.targets?.scheme, root),
      view:   pick(cfg?.selectors?.targets?.view,   root)
    },
    defaults: {
      style:  cfg?.defaults?.style  || 'classic',
      scheme: cfg?.defaults?.scheme || 'light',
      view:   cfg?.defaults?.view   || 'desktop'
    },
    styleWhitelist: Array.isArray(cfg?.styles) ? cfg.styles.map(s => s.id) : []
  };

  const doc = document;
  let state = loadState();

  window.DisplaySettings = {
    getState: () => ({ ...state }),
    setStyle, setScheme, setView,
    on: (t,f) => doc.addEventListener(t,f),
    off: (t,f) => doc.removeEventListener(t,f),
    refreshControls: () => { bindAll(true); updateControlsUI(); }
  };

  window.themeSwitcher = window.themeSwitcher || {};
  window.themeSwitcher.initSection = function(sectionEl) {
    if (!sectionEl) return;
    const list = sectionEl.querySelector('ul') || sectionEl;

    let liHost =
      list.querySelector('li[data-ts-theme-mount]') ||
      (() => {
        const li = doc.createElement('li');
        li.setAttribute('data-ts-theme-mount','');
        list.appendChild(li);
        return li;
      })();

    let styleMount =
      (C.ui.styleMountSel && $(C.ui.styleMountSel, liHost)) ||
      liHost.querySelector(`#${CSS.escape(C.ui.styleMountId)}`) ||
      (() => {
        const div = doc.createElement('div');
        div.setAttribute('data-style-mount','');
        div.id = C.ui.styleMountId;
        if (C.styleMountCls) div.classList.add(C.styleMountCls);
        liHost.appendChild(div);
        return div;
      })();

    let schemeList =
      (C.ui.schemeMount && $(C.ui.schemeMount, liHost)) ||
      liHost.querySelector('#stylelist') ||
      (() => {
        const ul = doc.createElement('ul');
        ul.id = 'stylelist';
        liHost.appendChild(ul);
        return ul;
      })();

    autoRenderUI(sectionEl);
    bindAll(true);
  };

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

  function saveState(s) { try { localStorage.setItem(C.storageKey, JSON.stringify(s)); } catch {} }

  function validState(s) {
    if (!s || typeof s !== 'object') return false;
    if (!s.style || !s.scheme || !s.view) return false;
    if (C.styleWhitelist.length && !C.styleWhitelist.includes(s.style)) return false;
    if (s.scheme !== 'light' && s.scheme !== 'dark') return false;
    if (s.view !== 'mobile' && s.view !== 'desktop') return false;
    return true;
  }

  function normalize(s) {
    let style  = s.style;
    let scheme = s.scheme === 'dark' ? 'dark' : 'light';
    let view   = s.view === 'mobile' ? 'mobile' : 'desktop';
    if (C.styleWhitelist.length && !C.styleWhitelist.includes(style)) style = C.defaults.style;
    return { style, scheme, view };
  }

  function same(a,b) { return a.style===b.style && a.scheme===b.scheme && a.view===b.view; }

  function applyState(s, silent=false) {
    if (!root) return;

    const prevStyleId = root.getAttribute('data-style') || '';

    root.setAttribute('data-style',  s.style);
    root.setAttribute('data-scheme', s.scheme);
    root.setAttribute('data-view',   s.view);

    const TG = C.targets;

    TG.scheme.classList.remove(C.schemeLight, C.schemeDark);
    TG.scheme.classList.add(s.scheme === 'dark' ? C.schemeDark : C.schemeLight);

    if (C.stylePrefix) {
      removeByPrefix(TG.style, C.stylePrefix);
      TG.style.classList.add(C.stylePrefix + s.style);
    } else {
      if (prevStyleId) TG.style.classList.remove(prevStyleId);
      if (C.styleWhitelist.length) {
        for (const id of C.styleWhitelist) if (id !== s.style) TG.style.classList.remove(id);
      }
      TG.style.classList.add(s.style);
    }

    TG.view.classList.toggle(C.forceMobile, s.view === 'mobile');

    if (!silent) {
      dispatch('displaystylechange',   { value: s.style });
      dispatch('displayschemechange',  { value: s.scheme });
      dispatch('displayviewchange',    { value: s.view });
      dispatch('displaysettingschange',{ next: { ...s } });
    }
  }

  function autoRenderUI(targetRoot = doc) {
    const schemeMount =
      (C.ui.schemeMount && $(C.ui.schemeMount, targetRoot)) ||
      $('#stylelist', targetRoot);
    if (schemeMount && !schemeMount.querySelector('[data-display-scheme]')) {
      schemeMount.innerHTML = '';
      const mk = (mode, text) => {
        const li = doc.createElement('li');
        li.setAttribute('data-scheme', mode);
        const b = doc.createElement('button');
        b.type = 'button';
        b.setAttribute('data-display-scheme', mode);
        b.textContent = text;
        if (C.schemeBtnCls) b.classList.add(C.schemeBtnCls);
        li.appendChild(b);
        return li;
      };
      schemeMount.appendChild(mk('light', '1'));
      schemeMount.appendChild(mk('dark',  '2'));
      updateSchemeListActive(schemeMount);
    }

    const styleMount =
      (C.ui.styleMountSel && $(C.ui.styleMountSel, targetRoot)) ||
      doc.getElementById(C.ui.styleMountId) ||
      $('[data-style-mount]', targetRoot);
    if (styleMount && !styleMount.querySelector('[data-display-style]')) {
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
      const items = (cfg.styles || []).map(s => mk(s.id, s.label));
      if (!items.length) items.push(mk(C.defaults.style, C.defaults.style));
      if (isList) {
        for (const b of items) { const li = doc.createElement('li'); li.appendChild(b); styleMount.appendChild(li); }
      } else {
        for (const b of items) styleMount.appendChild(b);
      }
    }
  }

  function updateSchemeListActive(ul = document.getElementById('stylelist')) {
    if (!ul) return;
    ul.querySelectorAll('li').forEach(li => {
      const mode = (li.getAttribute('data-scheme') || '').toLowerCase();
      li.classList.toggle('active', mode === state.scheme);
    });
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
    dispatch('displayschemechange', { prev: prev.scheme, value: state.scheme });
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
    el.classList.forEach(c => { if (c.startsWith(prefix)) toRemove.push(c); });
    toRemove.forEach(c => el.classList.remove(c));
  }

  function bindAll(rebind=false) {
    bindGroup(C.sel.style,  handleStyle,  rebind);
    bindGroup(C.sel.scheme, handleScheme, rebind);
    bindGroup(C.sel.view,   handleView,   rebind);
    const cb = document.querySelector(C.sel.chkFM);
    if (cb) bindForceMobileCheckbox(cb, rebind);
    updateControlsUI();
  }

  function bindGroup(selector, handler, rebind) {
    const nodes = $$(selector);
    for (const el of nodes) {
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
        if (!el.hasAttribute('role')) el.setAttribute('role','button');
      }
    }
  }

  function handleStyle(el)  { const id = el.getAttribute('data-display-style');  if (id) setStyle(id); }
  function handleScheme(el) { const m  = el.getAttribute('data-display-scheme'); if (m)  setScheme(m); }
  function handleView(el)   { const v  = el.getAttribute('data-display-view');   if (v)  setView(v); }

  function bindForceMobileCheckbox(cb, rebind) {
    if (rebind && cb.__ds_cb) cb.removeEventListener('change', cb.__ds_cb);
    const fn = () => setView(cb.checked ? 'mobile' : 'desktop');
    cb.addEventListener('change', fn);
    cb.__ds_cb = fn;
    cb.checked = (state.view === 'mobile');
    const label = cb.closest('label.fm-toggle');
    if (label) { label.hidden = false; label.style.display = ''; }
  }

  function updateControlsUI() {
    for (const el of $$(C.sel.style))  reflect(el, el.getAttribute('data-display-style')  === state.style);
    for (const el of $$(C.sel.scheme)) reflect(el, el.getAttribute('data-display-scheme') === state.scheme);
    for (const el of $$(C.sel.view))   reflect(el, el.getAttribute('data-display-view')   === state.view);
    const cb = document.querySelector(C.sel.chkFM);
    if (cb) cb.checked = (state.view === 'mobile');
    updateSchemeListActive();
  }

  function reflect(el, active) {
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') el.checked = !!active;
      el.setAttribute('aria-checked', active ? 'true' : 'false');
    } else {
      el.classList.toggle(C.activeCtl, !!active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
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
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function dispatch(type, detail) {
    try { doc.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
  }

  function init() {
    applyState(state, true);
    autoRenderUI();
    bindAll();
    observeDom();
    const cb = document.querySelector(C.sel.chkFM);
    const label = cb && cb.closest('label.fm-toggle');
    if (label) { label.hidden = false; label.style.display = ''; }
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
})();
