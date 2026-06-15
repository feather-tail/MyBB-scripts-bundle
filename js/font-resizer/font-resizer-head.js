(() => {
  'use strict';

  const config = {
    htmlFrameSelector:
      'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame',
    fontSelector: '.post-content, #main-reply',
    extraSelectors: [
      '.post-box .custom_tag_katexttext',
      '.post-box .custom_tag_katext',
      '.post-box .custom_tag_kindredaca',
    ],
    minSize: 10,
    maxSize: 38,
    defaultSize: 14,
    storageKey: 'postFontSize',
    insertAfterSelector: '',
    defaultAnchorSelector: '.post h3 strong',
    deepApply: true,
    ...(window.ScriptConfig?.fontResizer || {}),
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const createEl = (tag, props = {}) => {
    const el = document.createElement(tag);

    Object.entries(props).forEach(([key, value]) => {
      if (key === 'text') {
        el.textContent = value;
      } else if (key === 'className') {
        el.className = value;
      } else {
        el.setAttribute(key, value);
      }
    });

    return el;
  };

  const toArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const clamp = (size) => {
    const n = Number(size);
    if (!Number.isFinite(n)) return config.defaultSize;
    return Math.max(config.minSize, Math.min(config.maxSize, n));
  };

  const splitSelectorList = (value) => {
    const items = Array.isArray(value) ? value : [value];
  
    return items
      .filter(Boolean)
      .flatMap((item) =>
        String(item)
          .split(',')
          .map((selector) => selector.trim())
          .filter(Boolean),
      );
  };
  
  const getAllFontSelectors = () => [
    ...splitSelectorList(config.fontSelector),
    ...splitSelectorList(config.extraSelectors),
  ];

  const getStoredSize = () => {
    let v = NaN;

    try {
      v = parseInt(localStorage.getItem(config.storageKey), 10);
    } catch {}

    return !Number.isNaN(v) && v >= config.minSize && v <= config.maxSize
      ? v
      : config.defaultSize;
  };

  const storeSize = (size) => {
    try {
      localStorage.setItem(config.storageKey, String(size));
    } catch {}
  };

  const injectEarlyStyle = (size) => {
    const selectors = getAllFontSelectors();
    if (!selectors.length) return;
  
    const rootSelectors = selectors.join(',');
  
    const deepSelectors = config.deepApply
      ? selectors.map((selector) => `${selector} *`).join(',')
      : '';
  
    const cssSelectors = [rootSelectors, deepSelectors].filter(Boolean).join(',');
  
    const css = `${cssSelectors}{font-size:${size}px!important;}`;
  
    let style = document.getElementById('font-resizer-initial-style');
  
    if (!style) {
      style = document.createElement('style');
      style.id = 'font-resizer-initial-style';
      style.type = 'text/css';
  
      const target = document.head || document.documentElement;
      target.appendChild(style);
    }
  
    style.textContent = css;
  };

  const applySizeToMain = (size) => {
    const selectors = getAllFontSelectors();
    if (!selectors.length) return;
  
    injectEarlyStyle(size);
  
    const els = new Set();
  
    selectors.forEach((selector) => {
      $$(selector).forEach((el) => els.add(el));
  
      if (config.deepApply) {
        $$(`${selector} *`).forEach((el) => els.add(el));
      }
    });
  
    els.forEach((el) => {
      el.style.setProperty('font-size', `${size}px`, 'important');
    });
  };

  const getHtmlFrames = () =>
    Array.from(document.querySelectorAll(config.htmlFrameSelector)).filter(
      (frame) => frame && frame.tagName === 'IFRAME',
    );

  const postSizeToFrame = (frame, size) => {
    try {
      frame.contentWindow?.postMessage(
        { eventName: 'fontSizeChange', size },
        '*',
      );
    } catch {}
  };

  const postSizeToAllFrames = (size) => {
    getHtmlFrames().forEach((frame) => {
      postSizeToFrame(frame, size);
    });
  };

  const isKnownFrameSource = (srcWin) => {
    if (!srcWin) return false;

    return getHtmlFrames().some((frame) => frame.contentWindow === srcWin);
  };

  window.addEventListener('message', (e) => {
    const d = e.data || {};

    if (d.eventName !== 'fontSizeRequest') return;
    if (!isKnownFrameSource(e.source)) return;

    try {
      e.source?.postMessage(
        { eventName: 'fontSizeChange', size: getStoredSize() },
        '*',
      );
    } catch {}
  });

  const applySizeToFrame = (frame, size) => {
    let applied = false;

    try {
      const doc =
        frame.contentDocument ||
        frame.contentWindow?.document;

      if (doc) {
        const target = doc.body || doc.documentElement;

        if (target) {
          target.style.setProperty('font-size', `${size}px`, 'important');
          applied = true;
        }

        const win = frame.contentWindow;

        if (win) {
          if (typeof win.setHeight === 'function') {
            win.setHeight();
          } else {
            win.dispatchEvent(new win.Event('resize'));
          }
        }
      }
    } catch {}

    if (!applied) {
      postSizeToFrame(frame, size);
    }
  };

  const applySizeToAllFrames = (size) => {
    getHtmlFrames().forEach((frame) => {
      applySizeToFrame(frame, size);
      postSizeToFrame(frame, size);
    });
  };

  const wiredFrames = new WeakSet();

  const wireFrame = (frame) => {
    if (!frame || wiredFrames.has(frame)) return;

    wiredFrames.add(frame);

    const currentSize = getStoredSize();

    applySizeToFrame(frame, currentSize);
    postSizeToFrame(frame, currentSize);

    frame.addEventListener('load', () => {
      const size = getStoredSize();

      applySizeToFrame(frame, size);
      postSizeToFrame(frame, size);
    });
  };

  const observeNewFrames = () => {
    getHtmlFrames().forEach(wireFrame);

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!node || node.nodeType !== 1) return;

          if (
            node.tagName === 'IFRAME' &&
            node.matches(config.htmlFrameSelector)
          ) {
            wireFrame(node);
          }

          if (node.querySelectorAll) {
            node.querySelectorAll(config.htmlFrameSelector).forEach(wireFrame);
          }
        });
      });
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const createControl = (currentSize) => {
    const wrapper = createEl('div');
    wrapper.className = 'font-resizer';

    const btnDecrease = createEl('button', {
      type: 'button',
      className: 'decrease',
      'aria-label': 'Уменьшить шрифт',
      text: 'A-',
    });

    const btnReset = createEl('button', {
      type: 'button',
      className: 'reset',
      'aria-label': 'Сбросить размер',
      text: 'A',
    });

    const btnIncrease = createEl('button', {
      type: 'button',
      className: 'increase',
      'aria-label': 'Увеличить шрифт',
      text: 'A+',
    });

    const slider = createEl('input', {
      type: 'range',
      className: 'slider',
      min: config.minSize,
      max: config.maxSize,
      value: currentSize,
      'aria-label': 'Размер шрифта',
    });

    wrapper.append(btnDecrease, btnReset, btnIncrease, slider);

    return wrapper;
  };

  const applyStoreBroadcast = (size) => {
    const s = clamp(size);

    applySizeToMain(s);
    storeSize(s);
    applySizeToAllFrames(s);
  };

  const wireControl = (control) => {
    const slider = $('.slider', control);
    const btnDecrease = $('.decrease', control);
    const btnIncrease = $('.increase', control);
    const btnReset = $('.reset', control);

    btnDecrease.addEventListener('click', () => {
      const size = Math.max(config.minSize, Number(slider.value) - 1);

      slider.value = size;
      applyStoreBroadcast(size);
    });

    btnIncrease.addEventListener('click', () => {
      const size = Math.min(config.maxSize, Number(slider.value) + 1);

      slider.value = size;
      applyStoreBroadcast(size);
    });

    btnReset.addEventListener('click', () => {
      slider.value = config.defaultSize;
      applyStoreBroadcast(config.defaultSize);
    });

    slider.addEventListener('input', () => {
      applyStoreBroadcast(Number(slider.value));
    });
  };

  const insertControl = () => {
    if ($('.font-resizer')) return true;

    let anchor = config.insertAfterSelector ? $(config.insertAfterSelector) : null;

    if (!anchor) {
      anchor = $(config.defaultAnchorSelector);
    }

    if (!anchor) return false;

    const control = createControl(getStoredSize());

    anchor.after(control);
    wireControl(control);

    return true;
  };

  const observeControlAnchor = () => {
    if (insertControl()) return;

    const mo = new MutationObserver(() => {
      if (insertControl()) {
        mo.disconnect();
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const init = () => {
    const initialSize = getStoredSize();

    injectEarlyStyle(initialSize);
    applySizeToMain(initialSize);
    observeNewFrames();
    observeControlAnchor();

    setTimeout(() => {
      applySizeToAllFrames(getStoredSize());
    }, 250);

    setTimeout(() => {
      postSizeToAllFrames(getStoredSize());
    }, 300);

    setTimeout(() => {
      postSizeToAllFrames(getStoredSize());
    }, 1200);
  };

  init();
})();
