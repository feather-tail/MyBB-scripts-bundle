(() => {
  'use strict';

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function applySize(px) {
    const size = clamp(Number(px) || 0, 10, 38);

    try {
      const body = document.body || document.documentElement;
      if (body) {
        body.style.setProperty('font-size', size + 'px', 'important');
      }
    } catch (e) {}
    try {
      if (typeof window.setHeight === 'function') {
        window.setHeight();
      } else {
        window.dispatchEvent(new Event('resize'));
      }
    } catch (e) {}
  }

  window.addEventListener(
    'message',
    (e) => {
      const d = e && e.data;
      if (!d || d.type !== 'FONT_RESIZER_SET') return;
      if (typeof d.size !== 'number') return;
      applySize(d.size);
    },
    false,
  );
  applySize(14);
})();
