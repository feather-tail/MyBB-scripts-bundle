(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeIndent', {});
  const state = helpers.register('bbcodeIndent', {});
  const IND_CLASS = 'bbindent-line';
  const INVIS_RE = /[\u00a0\u200b\u200c\u200d\u200e\u200f\ufeff]/g;

  function normText(s) {
    return (s || '').replace(INVIS_RE, '');
  }

  function isBlankTextNode(n) {
    return n && n.nodeType === Node.TEXT_NODE && !/\S/.test(normText(n.nodeValue));
  }

  function isBr(n) {
    return n && n.nodeType === Node.ELEMENT_NODE && n.tagName === 'BR';
  }

  function prevMeaningfulSibling(node) {
    let p = node ? node.previousSibling : null;
    while (p && isBlankTextNode(p)) p = p.previousSibling;
    return p;
  }

  function nextInDom(node, root) {
    if (!node) return null;
    if (node.firstChild) return node.firstChild;

    let n = node;
    while (n && n !== root) {
      if (n.nextSibling) return n.nextSibling;
      n = n.parentNode;
    }
    return null;
  }

  function findNextMeaningful(start, root) {
    let n = start;
    while (n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        if (!isBr(n)) return n;
      } else if (n.nodeType === Node.TEXT_NODE) {
        if (!isBlankTextNode(n)) return n;
      }
      n = nextInDom(n, root);
    }
    return null;
  }

  function needLineBreakBefore(curTextNode, idxInNode) {
    const beforeInNode = normText(curTextNode.nodeValue.slice(0, idxInNode));
    if (/\S/.test(beforeInNode)) return true;

    let n = curTextNode.previousSibling;
    while (n) {
      if (isBr(n)) return false;
      if (n.nodeType === Node.TEXT_NODE) {
        if (/\S/.test(normText(n.nodeValue))) return true;
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        if (!isBr(n) && /\S/.test(normText(n.textContent))) return true;
        if (n.tagName === 'IMG') return true;
      }
      n = n.previousSibling;
    }
    return false;
  }

  function ensureBrBefore(node) {
    if (!node || !node.parentNode) return;
    const prev = prevMeaningfulSibling(node);
    if (isBr(prev)) return;
    node.parentNode.insertBefore(createEl('br'), node);
  }

  function injectButton() {
    const ref = $(config.buttonAfterSelector);
    if (!ref || document.getElementById(config.buttonId)) return;

    const td = createEl('td', {
      id: config.buttonId,
      title: config.buttonTitle,
      html: `<img src="${config.buttonIcon}" style="cursor:pointer">`,
    });

    td.addEventListener('click', () => {
      const ta = $('#main-reply, textarea[name="req_message"]');
      if (!ta) return;

      const pos = ta.selectionStart;
      ta.setRangeText(config.bbcode, pos, pos, 'end');
      ta.focus();

      document.dispatchEvent(new Event('pun_preview'));
    });

    ref.after(td);
  }

  function applyIndent(node) {
    const indentVal = config.textIndent || config.marginLeft || '2em';
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE && isBlankTextNode(node)) return;

    const host = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
    if (host && host.closest?.('.code-box, .blockcode, pre, code')) return;

    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains(IND_CLASS)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const span = createEl('span', {
        class: IND_CLASS,
        style: `display:block;text-indent:${indentVal};`,
      });
      node.parentNode.insertBefore(span, node);
      span.appendChild(node);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const display = window.getComputedStyle(node).display;

      if (['block', 'list-item', 'table-caption'].includes(display)) {
        node.style.textIndent = indentVal;
        node.classList.add(IND_CLASS);
        return;
      }

      const wrap = createEl('span', {
        class: IND_CLASS,
        style: `display:block;text-indent:${indentVal};`,
      });
      node.parentNode.insertBefore(wrap, node);
      wrap.appendChild(node);
    }
  }

  function processIndent(container) {
    if (!container) return;
    const tagRaw = String(config.bbcode || '[indent]');
    const tag = tagRaw.toLowerCase();
    if (!container.textContent.toLowerCase().includes(tag)) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeValue && n.nodeValue.toLowerCase().includes(tag)) nodes.push(n);
    }

    nodes.forEach((startNode) => {
      let cur = startNode;

      while (cur && cur.nodeType === Node.TEXT_NODE) {
        const low = (cur.nodeValue || '').toLowerCase();
        const idx = low.indexOf(tag);
        if (idx === -1) break;

        try {
          const needBr = needLineBreakBefore(cur, idx);
          const after = cur.splitText(idx);
          after.nodeValue = after.nodeValue.slice(tagRaw.length);
          const indentTarget = findNextMeaningful(after, container);
          if (needBr && after.parentNode) {
            ensureBrBefore(after);
          }
          applyIndent(indentTarget);
          if (after.parentNode && isBlankTextNode(after)) after.remove();
          cur = after && after.parentNode && after.nodeType === Node.TEXT_NODE ? after : null;
        } catch (e) {
          if (config.debug) console.error('[bbcodeIndent] error:', e);
          break;
        }
      }
    });
  }

  function init() {
    injectButton();

    $$(config.selectors).forEach((el) => processIndent(el));

    const prevBox = $('#post-preview .post-content');
    if (prevBox && !state.bbcodeIndentObserver) {
      const obs = new MutationObserver(() => {
        obs.disconnect();
        processIndent(prevBox);
        obs.observe(prevBox, { childList: true, subtree: true });
      });
      obs.observe(prevBox, { childList: true, subtree: true });
      state.bbcodeIndentObserver = obs;
    }
  }

  const run = helpers.once(init);
  helpers.ready(run);
  document.addEventListener('pun_main_ready', run);
  document.addEventListener('pun_preview', run);
})();
