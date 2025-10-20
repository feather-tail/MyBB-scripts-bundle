(() => {
  'use strict';

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function applySize(px) {
    const size = clamp(Number(px) || 0, 10, 38);
    try {
      document.body.style.fontSize = size + 'px';
    } catch {}
    try {
      if (typeof window.setHeight === 'function') window.setHeight();
      else window.dispatchEvent(new Event('resize'));
    } catch {}
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
})();
