(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.fieldTitleHints;
  if (!cfg || !Array.isArray(cfg.rules) || !cfg.rules.length) return;

  const applyRule = (rule) => {
    if (!rule || !rule.selector || !rule.title) return;

    const nodes = document.querySelectorAll(rule.selector);
    if (!nodes.length) return;

    for (const el of nodes) {
      el.title = rule.title;
    }
  };

  const init = () => {
    for (const rule of cfg.rules) {
      applyRule(rule);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
