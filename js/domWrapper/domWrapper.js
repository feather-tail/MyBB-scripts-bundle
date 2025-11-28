(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.domWrappers;
  if (!cfg || !Array.isArray(cfg.groups) || !cfg.groups.length) return;

  const wrapTargets = (root, targetSelector, wrapperClass) => {
    if (!root) return;

    const nodes = root.querySelectorAll(targetSelector);
    if (!nodes.length) return;

    const first = nodes[0];
    const parent = first.parentElement;
    if (!parent) return;

    if (parent.classList.contains(wrapperClass)) return;

    const wrapper = document.createElement('div');
    wrapper.className = wrapperClass;

    parent.insertBefore(wrapper, first);

    for (const node of nodes) {
      wrapper.appendChild(node);
    }
  };

  const applyGroup = (group) => {
    const { rootSelector, targetSelector, wrapperClass } = group;
    if (!rootSelector || !targetSelector || !wrapperClass) return;

    const roots = document.querySelectorAll(rootSelector);
    if (!roots.length) return;

    for (const root of roots) {
      wrapTargets(root, targetSelector, wrapperClass);
    }
  };

  for (const group of cfg.groups) {
    applyGroup(group);
  }
})();
