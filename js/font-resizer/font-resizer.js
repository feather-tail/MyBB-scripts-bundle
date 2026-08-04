(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, $$, createEl } = helpers;

  const config = helpers.getConfig('fontResizer', {
    htmlFrameSelector:
      'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame',
    minSize: 10,
    maxSize: 38,
    defaultSize: 14,
    storageKey: 'postFontSize',
    ignoreSelector:
      '#ks-fittingroom-post .post-author[data-ks="fitting-profile"], #ks-fittingroom-post .post-author[data-ks="fitting-profile"] *',
  });

  const getAllFontSelectors = () => {
    const base = config.fontSelector
      ? Array.isArray(config.fontSelector)
        ? config.fontSelector
        : [config.fontSelector]
      : [];
    const extra = config.extraSelectors
      ? Array.isArray(config.extraSelectors)
        ? config.extraSelectors
        : [config.extraSelectors]
      : [];
    return [...base, ...extra].filter(Boolean);
  };

  const getIgnoreSelectors = () => {
    const items = Array.isArray(config.ignoreSelector)
      ? config.ignoreSelector
      : [config.ignoreSelector];

    return items
      .filter(Boolean)
      .flatMap((item) =>
        String(item)
          .split(',')
          .map((selector) => selector.trim())
          .filter(Boolean),
      );
  };
  const ignoreSelectors = getIgnoreSelectors();

  const isIgnored = (el) => {
    if (!ignoreSelectors.length || !el?.matches) return false;

    return ignoreSelectors.some((selector) => {
      try {
        return el.matches(selector) || !!el.closest(selector);
      } catch {
        return false;
      }
    });
  };

  const getStoredSize = () => {
    let v = NaN;
    try {
      v = parseInt(localStorage.getItem(config.storageKey), 10);
    } catch {}
    return !isNaN(v) && v >= config.minSize && v <= config.maxSize
      ? v
      : config.defaultSize;
  };

  const storeSize = (size) => {
    try {
      localStorage.setItem(config.storageKey, String(size));
    } catch {}
  };

  const applySizeToMain = (size) => {
    const selectors = getAllFontSelectors();
    if (!selectors.length) return;
  
    const roots = new Set();
  
    selectors.forEach((selector) => {
      try {
        $$(selector).forEach((element) => roots.add(element));
      } catch {}
    });
  
    const isExcluded = (element) => {
      if (!element?.matches) return true;
      if (isIgnored(element)) return true;
  
      if (!config.excludeSelector) return false;
  
      try {
        return (
          element.matches(config.excludeSelector) ||
          Boolean(element.closest(config.excludeSelector))
        );
      } catch {
        return false;
      }
    };
  
    const applyToElement = (element) => {
      if (isExcluded(element)) return;
  
      const hasOwnFontSize = Boolean(element.style?.fontSize);
      const wasApplied = element.dataset.fontResizerApplied === 'true';
  
      if (
        config.preserveInlineFontSize &&
        hasOwnFontSize &&
        !wasApplied
      ) {
        return;
      }
  
      element.style.setProperty('font-size', size + 'px', 'important');
      element.dataset.fontResizerApplied = 'true';
    };
  
    roots.forEach((root) => {
      if (isExcluded(root)) return;
  
      applyToElement(root);
  
      if (config.contentSelector) {
        try {
          root
            .querySelectorAll(config.contentSelector)
            .forEach(applyToElement);
        } catch {}
      }
  
      try {
        root
          .querySelectorAll(
            [
              '.quote-box blockquote',
              '.quote-box blockquote p',
              '.quote-box blockquote li',
              '.quote-box blockquote td',
              '.quote-box blockquote th',
              '.quote-box blockquote pre',
            ].join(','),
          )
          .forEach(applyToElement);
      } catch {}
    });
  
    if (config.directSelector) {
      try {
        $$(config.directSelector).forEach(applyToElement);
      } catch {}
    }
  };

  const getHtmlFrames = () =>
    Array.from(document.querySelectorAll(config.htmlFrameSelector)).filter(
      (f) => f && f.tagName === 'IFRAME',
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
    const frames = getHtmlFrames();
    frames.forEach((f) => postSizeToFrame(f, size));
  };

  const isKnownFrameSource = (srcWin) => {
    if (!srcWin) return false;
    const frames = getHtmlFrames();
    for (const f of frames) {
      if (f.contentWindow === srcWin) return true;
    }
    return false;
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
        (frame.contentWindow && frame.contentWindow.document);

      if (doc) {
        const target = doc.body || doc.documentElement;
        if (target) {
          target.style.setProperty('font-size', size + 'px', 'important');
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
    const frames = getHtmlFrames();
    frames.forEach((f) => applySizeToFrame(f, size));
    postSizeToAllFrames(size);
  };

  const wireFrameLoads = () => {
    const currentSize = getStoredSize();
    const frames = getHtmlFrames();

    frames.forEach((f) => {
      applySizeToFrame(f, currentSize);

      f.addEventListener('load', () => {
        const s = getStoredSize();
        applySizeToFrame(f, s);
        postSizeToFrame(f, s);
      });
    });
  };

  const observeNewFrames = () => {
    const mo = new MutationObserver((mutations) => {
      const currentSize = getStoredSize();
      for (const m of mutations) {
        m.addedNodes &&
          m.addedNodes.forEach((node) => {
            if (!node || node.nodeType !== 1) return;

            if (node.tagName === 'IFRAME' && node.matches(config.htmlFrameSelector)) {
              applySizeToFrame(node, currentSize);
              postSizeToFrame(node, currentSize);
              node.addEventListener('load', () => {
                const s = getStoredSize();
                applySizeToFrame(node, s);
                postSizeToFrame(node, s);
              });
            }

            if (node.querySelectorAll) {
              node.querySelectorAll(config.htmlFrameSelector).forEach((fr) => {
                applySizeToFrame(fr, currentSize);
                postSizeToFrame(fr, currentSize);
                fr.addEventListener('load', () => {
                  const s = getStoredSize();
                  applySizeToFrame(fr, s);
                  postSizeToFrame(fr, s);
                });
              });
            }
          });
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  const observeContentChanges = () => {
  if (!config.observeContent) return;

  let timer = null;

  const selector = getAllFontSelectors().join(',');
  if (!selector) return;

  const isRelevantNode = (node) => {
    if (!node || node.nodeType !== 1) return false;

    try {
      if (node.matches(selector)) return true;
      if (node.closest(selector)) return true;
      if (node.querySelector(selector)) return true;
    } catch {}

    return false;
  };

  const observer = new MutationObserver((mutations) => {
    const shouldApply = mutations.some((mutation) => {
      if (isRelevantNode(mutation.target)) return true;

      return Array.from(mutation.addedNodes).some((node) =>
        isRelevantNode(node),
      );
    });

    if (!shouldApply) return;

    clearTimeout(timer);

    timer = setTimeout(() => {
      applySizeToMain(getStoredSize());
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
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

    applySizeToMain(s);
    storeSize(s);
    applySizeToAllFrames(s);
  }

  function init() {
    const initialSize = getStoredSize();

    applySizeToMain(initialSize);
    applySizeToAllFrames(initialSize);

    wireFrameLoads();
    observeNewFrames();
    observeContentChanges();

    setTimeout(() => {
      applySizeToAllFrames(getStoredSize());
    }, 250);

    setTimeout(() => {
      postSizeToAllFrames(getStoredSize());
    }, 300);

    setTimeout(() => {
      postSizeToAllFrames(getStoredSize());
    }, 1200);

    let anchor = config.insertAfterSelector ? $(config.insertAfterSelector) : null;
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
