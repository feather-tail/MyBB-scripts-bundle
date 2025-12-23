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
  const storageKey =
    (cfg?.storage?.key || 'mybb.display.v1') +
    (cfg?.storage?.instance ? ':' + cfg.storage.instance : '');

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
  });

  window.addEventListener('message', (event) => {
    const origin = String(event.origin || '');

    if (!/^https:\/\/forumscripts\.ru$/i.test(origin)) return;

    const d = event.data || {};
    if (d.eventName === 'displayRequest') {
      try {
        event.source?.postMessage(makePayload(), '*');
      } catch {}
      return;
    }

    if (d.eventName === 'displayAck') {
      console.log('[iframe displayAck]', d);
    }
  });
})();
