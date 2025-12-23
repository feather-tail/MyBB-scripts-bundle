(() => {
  'use strict';

  if (self === top) return;
  const frameName = String(window.name || '');
  if (!frameName.startsWith('html_frame')) return;

  const apply = (s) => {
    if (!s) return;

    const style  = String(s.style || 'classic');
    const scheme = (s.scheme === 'dark') ? 'dark' : 'light';
    const view   = (s.view === 'mobile') ? 'mobile' : 'desktop';

    const html = document.documentElement;
    html.setAttribute('data-style', style);
    html.setAttribute('data-scheme', scheme);
    html.setAttribute('data-view', view);

    if (document.body) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(scheme);
    }

    html.classList.toggle('force-mobile', view === 'mobile');

    try { window.setHeight?.(); } catch {}
  };

  const request = () => {
    const msg = { eventName: 'displayRequest' };
    try { window.parent?.postMessage(msg, '*'); } catch {}
    try { window.top?.postMessage(msg, '*'); } catch {}
  };

  window.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.eventName !== 'displayChange') return;
    apply(d.state);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      request();
      setTimeout(request, 300);
      setTimeout(request, 1200);
    }, { once: true });
  } else {
    request();
    setTimeout(request, 300);
    setTimeout(request, 1200);
  }
})();
