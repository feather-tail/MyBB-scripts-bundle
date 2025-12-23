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

  const frameSelector =
    cfg?.htmlFrameSelector ||
    'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame';

  const getState = () => {
    try {
      const s = window.DisplaySettings?.getState?.();
      if (s && s.style && s.scheme && s.view) return s;
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

  const isKnownFrameSource = (srcWin) => {
    if (!srcWin) return false;
    const frames = document.querySelectorAll(frameSelector);
    for (const fr of frames) {
      try {
        if (fr.contentWindow === srcWin) return true;
      } catch {}
    }
    return false;
  };

  window.addEventListener('message', (event) => {
    const d = event.data || {};
    if (d.eventName !== 'displayRequest') return;
    if (!isKnownFrameSource(event.source)) return;

    try {
      event.source?.postMessage(makePayload(), '*');
    } catch {}
  });
})();
