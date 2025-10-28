(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;

  const config = helpers.getConfig('fontResizer', {
    htmlFrameSelector:
      'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame',
    minSize: 10,
    maxSize: 38,
  });

  const getAllFontSelectors = () => {
    const base = config.fontSelector
      ? (Array.isArray(config.fontSelector) ? config.fontSelector : [config.fontSelector])
      : [];
    const extra = config.extraSelectors
      ? (Array.isArray(config.extraSelectors) ? config.extraSelectors : [config.extraSelectors])
      : [];
    return [...base, ...extra].filter(Boolean);
  };

  const getStoredSize = () => {
    const v = parseInt(localStorage.getItem(config.storageKey), 10);
    return !isNaN(v) && v >= config.minSize && v <= config.maxSize
      ? v
      : config.defaultSize;
  };

  const storeSize = (size) => localStorage.setItem(config.storageKey, size);

  const applySize = (size) => {
    const selectors = getAllFontSelectors();
    if (!selectors.length) return;

    const els = new Set();
    selectors.forEach((sel) => $$(sel).forEach((el) => els.add(el)));
    els.forEach((el) => {
      el.style.fontSize = size + 'px';
    });
  };

  const getHtmlFrames = () =>
    Array.from(document.querySelectorAll(config.htmlFrameSelector)).filter(
      (f) => f && f.tagName === 'IFRAME',
    );

  const postFontSizeToFrame = (frame, size) => {
    try {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(
          { type: 'FONT_RESIZER_SET', size: Number(size) },
          '*',
        );
      }
    } catch (e) {}
  };

  const broadcastToHtmlFrames = (size) => {
    const frames = getHtmlFrames();
    frames.forEach((f) => postFontSizeToFrame(f, size));
  };

  const wireFrameLoads = () => {
    const currentSize = getStoredSize();
    const frames = getHtmlFrames();

    frames.forEach((f) => {
      postFontSizeToFrame(f, currentSize);

      f.addEventListener('load', () => {
        postFontSizeToFrame(f, getStoredSize());
      });
    });
  };

  const observeNewFrames = () => {
    const mo = new MutationObserver((mutations) => {
      const currentSize = getStoredSize();
      for (const m of mutations) {
        m.addedNodes &&
          m.addedNodes.forEach((node) => {
            if (node && node.nodeType === 1) {
              if (
                node.tagName === 'IFRAME' &&
                node.matches(config.htmlFrameSelector)
              ) {
                postFontSizeToFrame(node, currentSize);
                node.addEventListener('load', () =>
                  postFontSizeToFrame(node, getStoredSize()),
                );
              }

              node.querySelectorAll &&
                node
                  .querySelectorAll(config.htmlFrameSelector)
                  .forEach((fr) => {
                    postFontSizeToFrame(fr, currentSize);
                    fr.addEventListener('load', () =>
                      postFontSizeToFrame(fr, getStoredSize()),
                    );
                  });
            }
          });
      }
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

  function applyStoreBroadcast(size) {
    const s = Math.max(config.minSize, Math.min(config.maxSize, Number(size)));
    applySize(s);
    storeSize(s);
    broadcastToHtmlFrames(s);
  }

  function init() {
    const initialSize = getStoredSize();
    applySize(initialSize);
    broadcastToHtmlFrames(initialSize);
    wireFrameLoads();
    observeNewFrames();
    setTimeout(() => {
      broadcastToHtmlFrames(getStoredSize());
    }, 250);

    let anchor = config.insertAfterSelector
      ? $(config.insertAfterSelector)
      : null;
    if (!anchor) anchor = $(config.defaultAnchorSelector);
    if (!anchor) return;

    const control = createControl(initialSize);
    anchor.after(control);

    const slider = $('.slider', control);
    const btnDecrease = $('.decrease', control);
    const btnIncrease = $('.increase', control);
    const btnReset = $('.reset', control);

    btnDecrease.addEventListener('click', () => {
      const s = Math.max(config.minSize, Number(slider.value) - 1);
      slider.value = s;
      applyStoreBroadcast(s);
    });

    btnIncrease.addEventListener('click', () => {
      const s = Math.min(config.maxSize, Number(slider.value) + 1);
      slider.value = s;
      applyStoreBroadcast(s);
    });

    btnReset.addEventListener('click', () => {
      slider.value = config.defaultSize;
      applyStoreBroadcast(config.defaultSize);
    });

    slider.addEventListener('input', () => {
      const s = Number(slider.value);
      applyStoreBroadcast(s);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('fontResizer', { init });
})();
