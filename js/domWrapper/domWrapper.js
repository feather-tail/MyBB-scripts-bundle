(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.domWrappers;
  if (!cfg || !Array.isArray(cfg.groups) || !cfg.groups.length) return;

  const schedule = (() => {
    let queued = false;

    return (callback) => {
      if (queued) return;

      queued = true;

      requestAnimationFrame(() => {
        queued = false;
        callback();
      });
    };
  })();

  const getExistingWrapper = (parent, wrapperClass) =>
    Array.from(parent.children).find((child) =>
      child.classList.contains(wrapperClass),
    );

  const wrapParentNodes = (parent, nodes, wrapperClass) => {
    if (!parent || !nodes.length) return;

    let wrapper = getExistingWrapper(parent, wrapperClass);

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = wrapperClass;
      parent.insertBefore(wrapper, nodes[0]);
    }

    nodes.forEach((node) => {
      wrapper.appendChild(node);
    });
  };

  const wrapTargets = (root, targetSelector, wrapperClass) => {
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll(targetSelector)).filter(
      (node) => !node.parentElement.classList.contains(wrapperClass),
    );

    if (!nodes.length) return;

    const nodesByParent = new Map();

    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent) return;

      if (!nodesByParent.has(parent)) {
        nodesByParent.set(parent, []);
      }

      nodesByParent.get(parent).push(node);
    });

    nodesByParent.forEach((parentNodes, parent) => {
      wrapParentNodes(parent, parentNodes, wrapperClass);
    });
  };

  const applyGroup = (group) => {
    const { rootSelector, targetSelector, wrapperClass } = group;
    if (!rootSelector || !targetSelector || !wrapperClass) return;

    document.querySelectorAll(rootSelector).forEach((root) => {
      wrapTargets(root, targetSelector, wrapperClass);
    });
  };

  const applyAll = () => {
    cfg.groups.forEach(applyGroup);
  };

  const observer = new MutationObserver(() => {
    schedule(applyAll);
  });

  applyAll();

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll, { once: true });
  } else {
    applyAll();
  }
})();
