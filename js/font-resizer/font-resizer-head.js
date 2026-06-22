(() => {
  'use strict';

  const defaults = {
    enabled: true,
    htmlFrameSelector:
      'iframe.html_frame, .html-post-box iframe.html_frame, .html-content iframe.html_frame',
    fontSelector: '.post-content, #main-reply',
    extraSelectors: [],
    contentSelector:
      ':scope > p, :scope > ul, :scope > ol, :scope > blockquote, :scope > table, :scope > pre, :scope > dl, :scope > div:not(.custom_tag):not(.post-sig):not(.rsp_wrap)',
    directSelector:
      '#main-reply, textarea[name="req_message"], textarea[name="message"], textarea:not([readonly]):not([disabled]), input[type="text"], [contenteditable="true"]',
    excludeSelector:
      '.custom_tag, .post-sig, .lastedit, .rsp_wrap, .post-rating, .post-vote, .quote-box cite, script, style, img, svg, canvas, iframe',
    disabledTopicIds: [],
    disabledPostIds: [],
    preserveInlineFontSize: true,
    minSize: 10,
    maxSize: 38,
    defaultSize: 14,
    storageKey: 'postFontSize',
    insertAfterSelector: '',
    defaultAnchorSelector: '.post h3 strong',
    observeContent: true,
  };

  const config = {
    ...defaults,
    ...(window.ScriptConfig?.fontResizer || {}),
  };

  const APPLIED_ATTR = 'data-font-resizer-applied';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

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

  const clamp = (size) => {
    const n = Number(size);
    if (!Number.isFinite(n)) return config.defaultSize;
    return Math.max(config.minSize, Math.min(config.maxSize, n));
  };

  const splitSelectorList = (value) => {
    const items = Array.isArray(value) ? value : [value];

    return items.filter(Boolean).flatMap((item) =>
      String(item)
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean),
    );
  };

  const getFontSelectors = () => [
    ...splitSelectorList(config.fontSelector),
    ...splitSelectorList(config.extraSelectors),
  ];

  const excludeSelectors = splitSelectorList(config.excludeSelector);
  const contentSelectors = splitSelectorList(config.contentSelector);
  const directSelectors = splitSelectorList(config.directSelector);

  const safeMatches = (el, selector) => {
    try {
      return !!el?.matches?.(selector);
    } catch {
      return false;
    }
  };

  const safeClosest = (el, selector) => {
    try {
      return el?.closest?.(selector) || null;
    } catch {
      return null;
    }
  };

  const isExcluded = (el) => {
    return excludeSelectors.some((selector) => {
      return safeMatches(el, selector) || !!safeClosest(el, selector);
    });
  };

  const hasInlineFontSize = (el) => {
    const style = el?.getAttribute?.('style') || '';
    return /(^|;)\s*font(?:-size)?\s*:/i.test(style);
  };

  const getTopicId = () => {
    try {
      return new URL(location.href).searchParams.get('id') || '';
    } catch {
      return '';
    }
  };

  const isDisabledTopic = () => {
    const topicId = getTopicId();
    if (!topicId) return false;
    return config.disabledTopicIds.map(String).includes(String(topicId));
  };

  const getPostId = (el) => {
    const post = safeClosest(el, '.post[id^="p"]');
    return post?.id?.replace(/^p/, '') || '';
  };

  const isDisabledPost = (el) => {
    const postId = getPostId(el);
    if (!postId) return false;
    return config.disabledPostIds.map(String).includes(String(postId));
  };

  const shouldSkip = (el) => {
    if (!config.enabled) return true;
    if (!el) return true;
    if (isExcluded(el)) return true;
    if (isDisabledPost(el)) return true;
    if (config.preserveInlineFontSize && hasInlineFontSize(el)) return true;
    return false;
  };

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

  const clearAppliedStyles = (root = document) => {
    $$(`[${APPLIED_ATTR}]`, root).forEach((el) => {
      el.style.removeProperty('font-size');
      el.removeAttribute(APPLIED_ATTR);
    });
  };

  const setOwnFontSize = (el, size) => {
    if (shouldSkip(el)) return;

    el.style.setProperty('font-size', `${size}px`, 'important');
    el.setAttribute(APPLIED_ATTR, 'true');
  };

  const isDirectTarget = (el) => {
    return directSelectors.some((selector) => safeMatches(el, selector));
  };

  const getTargetsFromRoot = (root) => {
    if (isDirectTarget(root)) return [root];

    const targets = new Set();

    contentSelectors.forEach((selector) => {
      try {
        root.querySelectorAll(selector).forEach((el) => targets.add(el));
      } catch {}
    });

    return Array.from(targets);
  };

  const applySizeToMain = (size) => {
    clearAppliedStyles();

    if (!config.enabled || isDisabledTopic()) return;

    const selectors = getFontSelectors();
    if (!selectors.length) return;

    const roots = new Set();

    selectors.forEach((selector) => {
      $$(selector).forEach((root) => {
        if (!shouldSkip(root)) roots.add(root);
      });
    });

    roots.forEach((root) => {
      getTargetsFromRoot(root).forEach((el) => setOwnFontSize(el, size));
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
      const doc = frame.contentDocument || frame.contentWindow?.document;

      if (doc) {
        const target = doc.body || doc.documentElement;

        if (target && !hasInlineFontSize(target)) {
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
    if (!config.enabled || isDisabledTopic()) return;

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

  const observeNewContent = () => {
    if (!config.enabled || !config.observeContent) return;

    let timer = null;

    const applyLater = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        applySizeToMain(getStoredSize());
      }, 50);
    };

    const mo = new MutationObserver((mutations) => {
      const selectors = getFontSelectors();
      const hasRelevantNodes = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => {
          if (!node || node.nodeType !== 1) return false;

          return selectors.some((selector) => {
            try {
              return node.matches(selector) || !!node.querySelector(selector);
            } catch {
              return false;
            }
          });
        }),
      );

      if (hasRelevantNodes) applyLater();
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
    if (!config.enabled || isDisabledTopic()) return true;
    if ($('.font-resizer')) return true;

    let anchor = config.insertAfterSelector
      ? $(config.insertAfterSelector)
      : null;

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
    if (!config.enabled) {
      clearAppliedStyles();
      return;
    }

    const initialSize = getStoredSize();

    applySizeToMain(initialSize);
    observeNewFrames();
    observeNewContent();
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
