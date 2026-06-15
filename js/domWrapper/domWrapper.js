(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.domWrappers;
  if (!cfg || !Array.isArray(cfg.groups) || !cfg.groups.length) return;

  const rootElement = document.documentElement;
  const loadingClass = cfg.loadingClass || 'dom-wrappers-loading';
  const readyClass = cfg.readyClass || 'dom-wrappers-ready';
  const enqueue = window.queueMicrotask || ((callback) => Promise.resolve().then(callback));

  rootElement.classList.add(loadingClass);

  const schedule = (() => {
    let queued = false;

    return (callback) => {
      if (queued) return;

      queued = true;

      enqueue(() => {
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

    const nodes = Array.from(root.querySelectorAll(targetSelector)).filter((node) => {
      const parent = node.parentElement;
      return parent && !parent.classList.contains(wrapperClass);
    });

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

  const markReady = () => {
    applyAll();
    rootElement.classList.remove(loadingClass);
    rootElement.classList.add(readyClass);
  };

  const observer = new MutationObserver(() => {
    schedule(applyAll);
  });

  observer.observe(rootElement, {
    childList: true,
    subtree: true,
  });

  applyAll();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }

  window.addEventListener('load', markReady, { once: true });

  setTimeout(markReady, 1500);
})();
