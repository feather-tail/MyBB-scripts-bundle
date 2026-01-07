(() => {
  'use strict';

  const helpers = window.helpers || null;

  const getCfg = helpers?.getConfig
    ? (k, d) => helpers.getConfig(k, d)
    : (k, d) => (window.ScriptConfig?.[k] ?? d);

  const config = getCfg('replaceQuotes', {});

  const ROOT_SELECTOR = config.rootSelector || '.post-content, #post-preview';
  const BLOCK_SELECTOR = config.blockSelector || 'p, li, blockquote, td, th, div';
  const BLOCKED_SELECTOR =
    config.blockedSelector || 'pre, code, textarea, script, style, .code-box';

  const QUOTE_CHARS = Array.isArray(config.quoteChars)
    ? config.quoteChars
    : [
        '"',
        '«',
        '»',
        '“',
        '”',
        '„',
        '‟',
        '‹',
        '›',
        '‚',
      ];

  const quoteSet = new Set(QUOTE_CHARS);

  const isWordChar = (ch) => !!ch && /[0-9A-Za-zА-Яа-яЁё\u00C0-\u024F]/.test(ch);

  function replaceQuotesInText(text, state) {
    let has = false;
    for (let i = 0; i < text.length; i++) {
      if (quoteSet.has(text[i])) {
        has = true;
        break;
      }
    }
    if (!has) return text;

    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (!quoteSet.has(ch)) {
        out += ch;
        continue;
      }

      const prev = text[i - 1] || '';
      const next = text[i + 1] || '';

      if ((ch === "'" || ch === '’') && isWordChar(prev) && isWordChar(next)) {
        out += ch;
        continue;
      }

      out += state.open ? '«' : '»';
      state.open = !state.open;
    }

    return out;
  }

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
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
  }

  function processRoot(root) {
    if (!root || !(root instanceof Element)) return;

    const blocks = root.querySelectorAll(BLOCK_SELECTOR);
    const list = blocks.length ? [...blocks] : [root];

    for (const block of list) {
      if (block.closest(BLOCKED_SELECTOR)) continue;

      const state = { open: true };
      const walker = makeWalker(block);

      let node;
      while ((node = walker.nextNode())) {
        const oldText = node.nodeValue;
        const newText = replaceQuotesInText(oldText, state);
        if (newText !== oldText) node.nodeValue = newText;
      }
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

  helpers?.register?.('replaceQuotes', { init, flush });
})();

