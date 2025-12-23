(() => {
  'use strict';

  const helpers = window.helpers || {};
  const getConfig =
    helpers.getConfig ||
    ((key, fallback = {}) => (window.ScriptConfig && window.ScriptConfig[key]) || fallback);

  const cfg = getConfig('themeSwitcher', {});
  const storageKey =
    (cfg?.storage?.key || 'mybb.display.v1') +
    (cfg?.storage?.instance ? ':' + cfg.storage.instance : '');

  const FRAMES_HOST_RE = /(^|\.)forumscripts\.ru$/i;

  const getState = () => {
    try {
      if (window.DisplaySettings?.getState) {
        const s = window.DisplaySettings.getState();
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    return { style: 'classic', scheme: 'light', view: 'desktop' };
  };

  const makePayload = () => ({
    eventName: 'displayChange',
    state: getState(),
    iframeCss: Array.isArray(cfg?.iframeCss) ? cfg.iframeCss : [],
    styles: Array.isArray(cfg?.styles) ? cfg.styles.map(x => x.id).filter(Boolean) : []
  });

  window.addEventListener('message', (event) => {
    let host = '';
    try { host = new URL(event.origin).hostname; } catch {}
    if (!FRAMES_HOST_RE.test(host)) return;

    const d = event.data || {};
    if (d.eventName === 'displayRequest') {
      try {
        event.source?.postMessage(makePayload(), event.origin);
      } catch {}
    }
  });
})();
