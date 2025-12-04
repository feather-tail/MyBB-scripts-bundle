(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.quicktip;
  if (!cfg || cfg.enabled === false) return;

  const selectors =
    Array.isArray(cfg.selectors) && cfg.selectors.length
      ? cfg.selectors
      : ['a[title]', 'img[title]', 'abbr[title]', 'div[title]', 'span[title]'];

  const delayMs = typeof cfg.delayMs === 'number' ? cfg.delayMs : 1200;
  const speedMs = typeof cfg.speedMs === 'number' ? cfg.speedMs : 300;
  const xOffset = typeof cfg.xOffset === 'number' ? cfg.xOffset : 26;
  const yOffset = typeof cfg.yOffset === 'number' ? cfg.yOffset : -5;
  const defaultTitle = cfg.defaultTitle || 'Quick tip';
  const reuseTooltip = cfg.reuseTooltip !== false;
  const useDelegation = cfg.useDelegation !== false;
  const tooltipId = cfg.tooltipId || 'tooltip';
  const targetElements = new Set();
  let tooltipEl = null;
  let activeEl = null;

  const ensureTooltip = () => {
    if (tooltipEl && reuseTooltip) return tooltipEl;

    const el = document.createElement('div');
    el.id = tooltipId;
    el.style.position = 'absolute';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
    document.body.appendChild(el);

    tooltipEl = el;
    return el;
  };

  const getTipText = (el) => {
    const data = el.getAttribute('data-quicktip');
    if (data && data.trim()) return data.trim();
    return defaultTitle;
  };

  const setTooltipPos = (el, pageX, pageY) => {
    el.style.left = pageX + yOffset + 'px';
    el.style.top = pageY + xOffset + 'px';
  };

  const showTooltipFor = (el, pageX, pageY) => {
    const tip = ensureTooltip();
    const text = getTipText(el);

    tip.textContent = text || defaultTitle;
    tip.style.display = 'block';
    setTooltipPos(tip, pageX, pageY);

    if (speedMs > 0) {
      tip.style.transition = `opacity ${speedMs}ms`;
      tip.style.opacity = '0';
      requestAnimationFrame(() => {
        tip.style.opacity = '1';
      });
    } else {
      tip.style.opacity = '1';
    }

    el.style.cursor = 'pointer';
    activeEl = el;
  };

  const moveTooltip = (pageX, pageY) => {
    if (!tooltipEl || !activeEl) return;
    setTooltipPos(tooltipEl, pageX, pageY);
  };

  const hideTooltip = () => {
    if (!tooltipEl) return;
    tooltipEl.style.display = 'none';
    tooltipEl.style.opacity = '0';
    activeEl = null;
  };

  const findTargetElement = (startNode) => {
    let node = startNode;
    while (node && node !== document && node !== document.documentElement) {
      if (targetElements.has(node)) return node;
      node = node.parentElement;
    }
    return null;
  };

  const attachListenersDelegated = () => {
    document.addEventListener('mouseover', (e) => {
      const el = findTargetElement(e.target);
      if (!el) return;

      if (activeEl === el) return;

      showTooltipFor(el, e.pageX, e.pageY);
    });

    document.addEventListener('mousemove', (e) => {
      if (!activeEl) return;
      moveTooltip(e.pageX, e.pageY);
    });

    document.addEventListener('mouseout', (e) => {
      if (!activeEl) return;

      const related = e.relatedTarget;
      if (!related) {
        hideTooltip();
        return;
      }

      let node = related;
      let stillInside = false;
      while (node && node !== document && node !== document.documentElement) {
        if (node === activeEl) {
          stillInside = true;
          break;
        }
        node = node.parentElement;
      }

      if (!stillInside) {
        hideTooltip();
      }
    });
  };

  const attachListenersPerElement = () => {
    for (const el of targetElements) {
      let localActive = false;

      el.addEventListener('mouseenter', (e) => {
        showTooltipFor(el, e.pageX, e.pageY);
        localActive = true;
      });

      el.addEventListener('mousemove', (e) => {
        if (!localActive) return;
        moveTooltip(e.pageX, e.pageY);
      });

      el.addEventListener('mouseleave', () => {
        localActive = false;
        hideTooltip();
      });
    }
  };

  const init = () => {
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      for (const el of found) {
        if (targetElements.has(el)) continue;

        const rawTitle = el.getAttribute('title');
        const tipTitle =
          rawTitle && rawTitle.trim() ? rawTitle.trim() : defaultTitle;

        el.setAttribute('data-quicktip', tipTitle);
        el.removeAttribute('title');

        targetElements.add(el);
      }
    }

    if (!targetElements.size) return;

    if (useDelegation) {
      attachListenersDelegated();
    } else {
      attachListenersPerElement();
    }
  };

  const start = () => {
    if (delayMs > 0) {
      setTimeout(init, delayMs);
    } else {
      init();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
