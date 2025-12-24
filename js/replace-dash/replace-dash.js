(() => {
  'use strict';

  const helpers = window.helpers || null;

  const getCfg = helpers?.getConfig
    ? (k, d) => helpers.getConfig(k, d)
    : (k, d) => (window.ScriptConfig?.[k] ?? d);

  const config = getCfg('replaceDash', {});

  const ROOT_SELECTOR = config.rootSelector || '.post-content, #post-preview';
  const BLOCKED_SELECTOR =
    config.blockedSelector || 'pre, code, textarea, script, style, .code-box';

  const dashRe =
    config.dashRegex instanceof RegExp
      ? config.dashRegex
      : /(^|[\s\u00A0])-(?=[\s\u00A0])/g;

  function makeWalker(rootEl) {
    return document.createTreeWalker(
      rootEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node?.nodeValue) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest(BLOCKED_SELECTOR)) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue.indexOf('-') === -1) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
  }

  function processRoot(root) {
    if (!root || !(root instanceof Element)) return;
    if (root.closest(BLOCKED_SELECTOR)) return;

    const walker = makeWalker(root);
    let node;
    while ((node = walker.nextNode())) {
      const oldText = node.nodeValue;
      const newText = oldText.replace(dashRe, '$1\u2014');
      if (newText !== oldText) node.nodeValue = newText;
    }
  }

  let selfMutating = false;
  let scheduled = false;
  const pendingRoots = new Set();

  function addPendingFromNode(node) {
    const el =
      node instanceof Element ? node : node?.parentElement || null;
    if (!el) return;

    const root = el.closest(ROOT_SELECTOR);
    if (root) pendingRoots.add(root);
  }

  function flush() {
    scheduled = false;
    if (selfMutating) return;

    selfMutating = true;
    try {
      const roots = pendingRoots.size
        ? [...pendingRoots]
        : [...document.querySelectorAll(ROOT_SELECTOR)];
      pendingRoots.clear();
      roots.forEach(processRoot);
    } finally {
      selfMutating = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, 60);
  }

  function init() {
    flush();

    document.addEventListener('ks_content_updated', (e) => {
      const roots = e?.detail?.roots;
      if (Array.isArray(roots)) {
        roots.forEach((r) => r && pendingRoots.add(r));
      }
      schedule();
    });

    const obs = new MutationObserver((mutations) => {
      if (selfMutating) return;
      for (const m of mutations) {
        if (m.type === 'characterData') {
          addPendingFromNode(m.target);
          continue;
        }
        addPendingFromNode(m.target);
        m.addedNodes?.forEach(addPendingFromNode);
      }
      schedule();
    });

    obs.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  if (helpers?.runOnceOnReady) helpers.runOnceOnReady(init);
  else if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();

  helpers?.register?.('replaceDash', { init, flush });
})();
