(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.stickyNav;
  if (
    !cfg ||
    cfg.enabled === false ||
    !Array.isArray(cfg.targets) ||
    !cfg.targets.length
  )
    return;

  const resolvedTargets = [];

  const initTargets = () => {
    for (const t of cfg.targets) {
      if (!t || !t.selector || !t.scrolledClass) continue;
      const el = document.querySelector(t.selector);
      if (!el) continue;

      resolvedTargets.push({
        el,
        className: t.scrolledClass,
        threshold: typeof t.threshold === 'number' ? t.threshold : 0,
      });
    }
  };

  const updateClasses = () => {
    if (!resolvedTargets.length) return;
    const y = window.scrollY || window.pageYOffset || 0;

    for (const t of resolvedTargets) {
      const shouldBeScrolled = y > t.threshold;
      t.el.classList.toggle(t.className, shouldBeScrolled);
    }
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateClasses();
      ticking = false;
    });
  };

  const start = () => {
    initTargets();
    if (!resolvedTargets.length) return;

    updateClasses();

    window.addEventListener('scroll', onScroll, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
