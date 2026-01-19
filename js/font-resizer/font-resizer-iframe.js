(() => {
  'use strict';

  if (self === top) return;
  const frameName = String(window.name || '');
  if (!frameName.startsWith('html_frame')) return;

  const MIN = 10;
  const MAX = 38;

  const clamp = (n) => Math.max(MIN, Math.min(MAX, n));

  const apply = (size) => {
    const s = clamp(Number(size));
    if (!Number.isFinite(s)) return;

    document.documentElement.style.setProperty('--frame-font-size', s + 'px');

    try {
      window.setHeight?.();
    } catch {}
  };

  const request = () => {
    const msg = { eventName: 'fontSizeRequest' };
    try {
      window.parent?.postMessage(msg, '*');
    } catch {}
    try {
      window.top?.postMessage(msg, '*');
    } catch {}
  };

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.eventName !== 'fontSizeChange') return;
    apply(d.size);
  });

  const init = () => {
    request();
    setTimeout(request, 300);
    setTimeout(request, 1200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
