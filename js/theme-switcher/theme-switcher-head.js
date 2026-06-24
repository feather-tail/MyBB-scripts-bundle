(() => {
  'use strict';

  const helpers = window.helpers || {};
  const getConfig =
    helpers.getConfig ||
    ((key, fallback = {}) =>
      (window.ScriptConfig && window.ScriptConfig[key]) || fallback);

  const cfg = getConfig('themeSwitcher', {});
  const storageCfg = cfg?.storage || {};
  const baseKey = storageCfg.key || 'mybb.display.v1';
  const instance = storageCfg.instance || 'summer2026';
  const storageKey = `${baseKey}:${instance}`;
  const oldStorageKey = baseKey;

  const frameSelector =
    cfg?.htmlFrameSelector ||
    'iframe.html_frame, iframe[id^="html_frame"], iframe[name^="html_frame"], .html-post-box iframe, .html-content iframe, .html-inner iframe';

  const defaultIframeVars = [
    '--base-bg',
    '--base-bg2',
    '--podform',
    '--bord',
    '--bord2',
    '--text',
    '--sec-text',
    '--accent',
    '--accent2',
    '--dark-bord',
    '--navi-link',
    '--navi-link-hov',
    '--main-font',
    '--sec-font',
    '--head',
    '--kahead',
    '--quote',
    '--tab-text',
    '--profile-bg',
    '--ftr-im',
    '--pf-bg',
    '--sts-bg',
    '--pers-pl',
    '--htm-bg',
    '--htm-clr',
    '--kndr-img',
    '--plash',
    '--text-tab-accent',
    '--cat-branch',
    '--prof-text',
    '--prof-bord',
    '--prof-link',
    '--mob-head',
    '--bt-bg',
    '--navi-bg',
    '--profile',
    '--familiar',
    '--witcher',
    '--human',
    '--tainted',
    '--race-shadow',
    '--activees-overlay',
    '--activees-overlay-hover',
    '--activees-border',
    '--radius',
    '--shadow',
    '--shadow2',
    '--transp-bg',
    '--summer-body-tint',
    '--summer-card-bg',
    '--summer-card-bg-soft',
    '--summer-card-border',
    '--summer-card-shadow',
    '--summer-category-branch-opacity',
    '--summer-category-title',
    '--summer-footer-fade',
    '--summer-footer-top-glow',
    '--summer-forum-name-bg',
    '--summer-forum-name-color',
    '--summer-forum-name-font',
    '--summer-forum-name-glow',
    '--summer-head-edge',
    '--summer-head-fade',
    '--summer-knews-bg',
    '--summer-knews-border',
    '--summer-post-font',
    '--summer-profile-fade',
    '--summer-shell-outline',
    '--summer-shell-outline-soft',
    '--summer-shell-shadow',
    '--summer-shell-surface',
    '--summer-status-bg',
    '--summer-status-border',
    '--summer-status-fill',
    '--summer-status-line',
    '--summer-status-link',
    '--summer-status-link-hover',
    '--summer-status-strong',
    '--summer-status-text',
    '--summer-title-color',
    '--summer-title-glow',
    '--summer-topic-border-soft',
    '--summer-topic-panel',
    '--ks-copy-btn-bg',
    '--ks-copy-btn-fg',
    '--ks-copy-btn-border',
    '--ks-copy-btn-hover-bg',
    '--ks-copy-btn-hover-fg',
    '--ks-copy-btn-active-bg',
    '--ks-copy-btn-active-fg',
    '--ks-copy-btn-focus',
    '--ks-copy-btn-shadow',
    '--ks-copy-btn-radius',
    '--ks-copy-btn-size',
    '--ks-copy-btn-icon-size',
    '--ks-copy-btn-gap',
  ];

  const getState = () => {
    try {
      const s = window.DisplaySettings?.getState?.();
      if (s && s.style && s.scheme && s.view) return s;
    } catch {}

    try {
      const raw = localStorage.getItem(storageKey) || localStorage.getItem(oldStorageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.style && s.scheme && s.view) return s;
      }
    } catch {}

    try {
      const s = window.__DisplayPrebootState;
      if (s && s.style && s.scheme && s.view) return s;
    } catch {}

    return { style: 'summer', scheme: 'light', view: 'desktop' };
  };

  const getIframeCss = () => {
    const list = Array.isArray(cfg?.iframeCss) ? cfg.iframeCss : [];
    return [...new Set(list.filter((href) => typeof href === 'string' && href.trim()).map((href) => href.trim()))];
  };

  const getIframeVars = () => {
    const list = Array.isArray(cfg?.iframeVars) && cfg.iframeVars.length ? cfg.iframeVars : defaultIframeVars;
    return [...new Set(list.filter((name) => typeof name === 'string' && name.startsWith('--')))];
  };

  const getComputedSources = () => {
    const sources = [];

    try {
      sources.push(getComputedStyle(document.documentElement));
    } catch {}

    try {
      if (document.body) sources.push(getComputedStyle(document.body));
    } catch {}

    return sources;
  };

  const getThemeVars = () => {
    const sources = getComputedSources();
    const vars = {};

    getIframeVars().forEach((name) => {
      let value = '';

      for (const source of sources) {
        value = source.getPropertyValue(name).trim();
        if (value) break;
      }

      if (value) vars[name] = value;
    });

    return vars;
  };

  const makePayload = () => ({
    eventName: 'displayChange',
    state: getState(),
    vars: getThemeVars(),
    iframeCss: getIframeCss(),
  });

  const getFrames = () => Array.from(document.querySelectorAll(frameSelector));

  const isKnownFrameSource = (srcWin) => {
    if (!srcWin) return false;

    return getFrames().some((fr) => {
      try {
        return fr.contentWindow === srcWin;
      } catch {
        return false;
      }
    });
  };

  const postToFrame = (frame) => {
    try {
      frame.contentWindow?.postMessage(makePayload(), '*');
    } catch {}
  };

  const postToAllFrames = () => {
    getFrames().forEach(postToFrame);
  };

  let postTimer = 0;

  const schedulePost = (delay = 0) => {
    clearTimeout(postTimer);
    postTimer = setTimeout(postToAllFrames, delay);
  };

  const burstPost = () => {
    [0, 100, 300, 700, 1200, 2500, 5000].forEach((delay) => {
      setTimeout(postToAllFrames, delay);
    });
  };

  const startObservers = () => {
    try {
      const observer = new MutationObserver(() => schedulePost(30));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-style', 'data-scheme', 'data-view', 'style'],
      });

      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'style'],
        });
      }
    } catch {}
  };

  window.addEventListener('message', (event) => {
    const d = event.data || {};
    if (d.eventName !== 'displayRequest') return;
    if (!isKnownFrameSource(event.source)) return;

    try {
      event.source?.postMessage(makePayload(), '*');
    } catch {}
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === storageKey || event.key === oldStorageKey) {
      burstPost();
    }
  });

  window.addEventListener('pageshow', burstPost);
  window.addEventListener('resize', () => schedulePost(100));

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!target?.closest) return;

      if (
        target.closest('#stylelist, [data-display-scheme], [data-style], [data-scheme], [data-view], .theme-switcher, .style-switcher, .display-switcher')
      ) {
        burstPost();
      }
    },
    true,
  );

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        startObservers();
        burstPost();
      },
      { once: true },
    );
  } else {
    startObservers();
    burstPost();
  }
})();
