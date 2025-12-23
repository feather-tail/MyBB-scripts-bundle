(() => {
  'use strict';

  const helpers = window.helpers || {};
  const getConfig =
    helpers.getConfig ||
    ((key, fallback = {}) => {
      const sc = (window.ScriptConfig && window.ScriptConfig[key]) || null;
      return sc ? sc : fallback;
    });

  const cfg = getConfig('themeSwitcher', {});
  const htmlFrameSelector =
    cfg?.htmlFrameSelector ||
    'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame';

  const parentOrigin = cfg?.parentOrigin || window.location.origin;

  const getState = () => {
    try {
      if (window.DisplaySettings && typeof window.DisplaySettings.getState === 'function') {
        const s = window.DisplaySettings.getState();
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    try {
      const key =
        (cfg?.storage?.key || 'mybb.display.v1') +
        (cfg?.storage?.instance ? ':' + cfg.storage.instance : '');
      const raw = localStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    return { style: 'classic', scheme: 'light', view: 'desktop' };
  };

  const postToAllFrames = (state) => {
    const s = state || getState();
    const msg = {
      eventName: 'displayChange',
      state: { style: s.style, scheme: s.scheme, view: s.view },
      iframeCss: Array.isArray(cfg?.iframeCss) ? cfg.iframeCss : []
    };

    document.querySelectorAll(htmlFrameSelector).forEach((fr) => {
      try {
        fr.contentWindow?.postMessage(msg, '*');
      } catch (e) {}
    });
  };

  const wireFrameLoads = () => {
    document.querySelectorAll(htmlFrameSelector).forEach((fr) => {
      fr.addEventListener('load', () => postToAllFrames(getState()));
    });
  };

  const observeNewFrames = () => {
    const mo = new MutationObserver((mutations) => {
      let touched = false;
      for (const m of mutations) {
        if (!m.addedNodes) continue;
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches(htmlFrameSelector)) touched = true;
          if (node.querySelector && node.querySelector(htmlFrameSelector)) touched = true;
          if (touched) break;
        }
        if (touched) break;
      }
      if (touched) {
        wireFrameLoads();
        postToAllFrames(getState());
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const init = () => {
    setTimeout(() => postToAllFrames(getState()), 250);
    setTimeout(() => postToAllFrames(getState()), 1200);

    document.addEventListener('displaysettingschange', (e) => {
      const next = e && e.detail && e.detail.next ? e.detail.next : getState();
      postToAllFrames(next);
    });

    window.addEventListener('storage', (e) => {
      const key =
        (cfg?.storage?.key || 'mybb.display.v1') +
        (cfg?.storage?.instance ? ':' + cfg.storage.instance : '');
      if (e.key !== key) return;
      postToAllFrames(getState());
    });

    wireFrameLoads();
    observeNewFrames();

    document.addEventListener('DOMContentLoaded', () => postToAllFrames(getState()), { once: true });
  };

  if (helpers && typeof helpers.runOnceOnReady === 'function') helpers.runOnceOnReady(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
