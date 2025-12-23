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
  const C = {
    storageKey:
      (cfg?.storage?.key || 'mybb.display.v1') +
      (cfg?.storage?.instance ? ':' + cfg.storage.instance : ''),
    stylePrefix: cfg?.classes?.stylePrefix ?? 'ds-style-',
    schemeLight: cfg?.classes?.schemeLight || 'ds-scheme-light',
    schemeDark: cfg?.classes?.schemeDark || 'ds-scheme-dark',
    forceMobile: cfg?.classes?.forceMobile || 'force-mobile',
  };

  const htmlFrameSelector =
    cfg?.htmlFrameSelector ||
    getConfig('fontResizer', {})?.htmlFrameSelector ||
    'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame';

  const getState = () => {
    try {
      if (
        window.DisplaySettings &&
        typeof window.DisplaySettings.getState === 'function'
      ) {
        const s = window.DisplaySettings.getState();
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    try {
      const raw = localStorage.getItem(C.storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    return { style: 'classic', scheme: 'light', view: 'desktop' };
  };

  const getFrames = () =>
    Array.from(document.querySelectorAll(htmlFrameSelector)).filter(
      (f) => f && f.tagName === 'IFRAME',
    );

  const removeByPrefix = (el, prefix) => {
    if (!el || !prefix) return;
    const toRemove = [];
    el.classList.forEach((c) => {
      if (c.startsWith(prefix)) toRemove.push(c);
    });
    toRemove.forEach((c) => el.classList.remove(c));
  };

  const applyStateToDoc = (doc, s) => {
    if (!doc) return;
    const html = doc.documentElement;
    const body = doc.body;

    if (!html) return;

    html.setAttribute('data-style', s.style);
    html.setAttribute('data-scheme', s.scheme);
    html.setAttribute('data-view', s.view);

    if (body) {
      body.classList.remove(C.schemeLight, C.schemeDark);
      body.classList.add(s.scheme === 'dark' ? C.schemeDark : C.schemeLight);
    }

    if (C.stylePrefix) {
      removeByPrefix(html, C.stylePrefix);
      html.classList.add(C.stylePrefix + s.style);
    } else {
      if (Array.isArray(cfg?.styles)) {
        cfg.styles.forEach((st) => {
          if (st?.id && st.id !== s.style) html.classList.remove(st.id);
        });
      }
      html.classList.add(s.style);
    }

    html.classList.toggle(C.forceMobile, s.view === 'mobile');
  };

  const applyToFrame = (frame, s) => {
    try {
      const doc =
        frame.contentDocument ||
        (frame.contentWindow && frame.contentWindow.document);
      if (!doc) return;

      applyStateToDoc(doc, s);

      const win = frame.contentWindow;
      if (win) {
        if (typeof win.setHeight === 'function') win.setHeight();
        else win.dispatchEvent(new win.Event('resize'));
      }
    } catch (e) {}
  };

  const applyToAllFrames = (s) => {
    getFrames().forEach((f) => applyToFrame(f, s));
  };

  const wireFrameLoads = () => {
    getFrames().forEach((f) => {
      applyToFrame(f, getState());

      f.addEventListener('load', () => applyToFrame(f, getState()));
    });
  };

  const observeNewFrames = () => {
    const mo = new MutationObserver((mutations) => {
      const s = getState();
      for (const m of mutations) {
        if (!m.addedNodes) continue;
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;

          if (node.tagName === 'IFRAME' && node.matches(htmlFrameSelector)) {
            applyToFrame(node, s);
            node.addEventListener('load', () => applyToFrame(node, getState()));
          }

          if (node.querySelectorAll) {
            node.querySelectorAll(htmlFrameSelector).forEach((fr) => {
              applyToFrame(fr, s);
              fr.addEventListener('load', () => applyToFrame(fr, getState()));
            });
          }
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const init = () => {
    applyToAllFrames(getState());

    document.addEventListener('displaysettingschange', (e) => {
      const next = e && e.detail && e.detail.next ? e.detail.next : getState();
      applyToAllFrames(next);
    });

    window.addEventListener('storage', (e) => {
      if (e.key !== C.storageKey) return;
      applyToAllFrames(getState());
    });

    wireFrameLoads();
    observeNewFrames();

    setTimeout(() => applyToAllFrames(getState()), 250);
    setTimeout(() => applyToAllFrames(getState()), 1200);
  };

  if (helpers && typeof helpers.runOnceOnReady === 'function')
    helpers.runOnceOnReady(init);
  else if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
