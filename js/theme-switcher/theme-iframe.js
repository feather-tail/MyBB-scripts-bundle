(() => {
  'use strict';

  if (self === top) return;

  const knownStyles = ['classic', 'winter', 'spring', 'summer'];
  const knownSchemes = ['light', 'dark'];
  const knownViews = ['desktop', 'mobile'];

  const fallbackVars = {
    '--podform': '#c9c8c8',
    '--quote': '#d1cfcf',
    '--bord': '#b8b8b8',
    '--dark-bord': '#232323',
    '--text': '#000',
    '--sec-text': '#666',
    '--accent': '#915252',
    '--accent2': '#5b2a2a',
    '--tab-text': '#c9c8c8',
    '--main-font': 'Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '--sec-font': 'auge, Manrope, system-ui, sans-serif',
    '--radius': '6px',
    '--shadow': '0 10px 26px rgba(0, 0, 0, 0.1)',
    '--shadow2': '0 18px 45px rgba(0, 0, 0, 0.12)',
  };

  const normalize = (state) => {
    const s = state && typeof state === 'object' ? state : {};
    const style = knownStyles.includes(s.style) ? s.style : 'summer';
    const scheme = knownSchemes.includes(s.scheme) ? s.scheme : 'light';
    const view = knownViews.includes(s.view) ? s.view : 'desktop';

    return { style, scheme, view };
  };

  const removeKnownClasses = (element) => {
    if (!element) return;
    knownStyles.forEach((name) => element.classList.remove(name));
    knownSchemes.forEach((name) => element.classList.remove(name));
    element.classList.remove('force-mobile');
  };

  const refreshHeight = () => {
    try {
      window.setHeight?.();
    } catch {}
  };

  const applyState = (state) => {
    const s = normalize(state);
    const html = document.documentElement;

    html.setAttribute('data-style', s.style);
    html.setAttribute('data-scheme', s.scheme);
    html.setAttribute('data-view', s.view);
    html.style.colorScheme = s.scheme;

    removeKnownClasses(html);
    html.classList.add(s.style, s.scheme);
    html.classList.toggle('force-mobile', s.view === 'mobile');

    if (document.body) {
      removeKnownClasses(document.body);
      document.body.classList.add(s.scheme);
      document.body.classList.toggle('force-mobile', s.view === 'mobile');
    }

    refreshHeight();
  };

  const applyVars = (vars) => {
    if (!vars || typeof vars !== 'object') return;

    const html = document.documentElement;
    const body = document.body;

    Object.entries(vars).forEach(([name, value]) => {
      if (typeof name !== 'string' || !name.startsWith('--')) return;
      if (typeof value !== 'string' || !value.trim()) return;

      html.style.setProperty(name, value);
      if (body) body.style.setProperty(name, value);
    });

    refreshHeight();
  };

  const normalizeHref = (href) => {
    try {
      return new URL(href, document.baseURI).href;
    } catch {
      return '';
    }
  };

  const loadedCss = new Set();

  const applyCss = (list) => {
    if (!Array.isArray(list) || !list.length) return;

    const head = document.head || document.documentElement;

    list.forEach((href) => {
      if (typeof href !== 'string' || !href.trim()) return;

      const normalized = normalizeHref(href.trim());
      if (!normalized || loadedCss.has(normalized)) return;

      loadedCss.add(normalized);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = normalized;
      link.dataset.themeIframeCss = '1';
      link.addEventListener('load', refreshHeight, { once: true });
      link.addEventListener('error', refreshHeight, { once: true });
      head.appendChild(link);
    });
  };

  const request = () => {
    const msg = { eventName: 'displayRequest' };

    try {
      window.parent?.postMessage(msg, '*');
    } catch {}

    try {
      window.top?.postMessage(msg, '*');
    } catch {}
  };

  const burstRequest = () => {
    [0, 100, 300, 700, 1200, 2500, 5000, 9000].forEach((delay) => {
      setTimeout(request, delay);
    });
  };

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.eventName !== 'displayChange') return;

    applyCss(data.iframeCss);
    applyState(data.state);
    applyVars(data.vars);
  });

  window.addEventListener('pageshow', burstRequest);
  window.addEventListener('load', () => {
    burstRequest();
    refreshHeight();
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        applyVars(fallbackVars);
        burstRequest();
        refreshHeight();
      },
      { once: true },
    );
  } else {
    applyVars(fallbackVars);
    burstRequest();
    refreshHeight();
  }
})();
