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

  function isInsideCode(node) {
    const host = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentNode;
    return !!host?.closest?.('.code-box, .blockcode, pre, code');
  }

  function getDisplay(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return '';
    return window.getComputedStyle(node).display;
  }

  function isBlockLike(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    const display = getDisplay(node);

    return [
      'block',
      'list-item',
      'table',
      'table-caption',
      'table-cell',
      'table-row',
      'flex',
      'grid',
    ].includes(display);
  }

  function hasMeaningfulContent(node) {
    if (!node) return false;
    if (/\S/.test(normText(node.textContent))) return true;
    return !!node.querySelector?.('img, svg, canvas, video, iframe, object, embed');
  }

  function unwrap(node) {
    const parent = node?.parentNode;
    if (!parent) return;

    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }

    parent.removeChild(node);
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

  function findLineStart(node, root) {
    let start = findNextMeaningful(node, root);
    if (!start || isInsideCode(start)) return null;

    if (start.nodeType === Node.ELEMENT_NODE && start.classList?.contains(IND_CLASS)) {
      return null;
    }

    let lineStart = start;

    while (
      lineStart.parentNode &&
      lineStart.parentNode !== root &&
      lineStart.parentNode.nodeType === Node.ELEMENT_NODE &&
      !lineStart.parentNode.classList?.contains(IND_CLASS) &&
      !isInsideCode(lineStart.parentNode) &&
      !isBlockLike(lineStart.parentNode)
    ) {
      const prev = prevMeaningfulSibling(lineStart);
      if (prev && !isBr(prev)) break;

      lineStart = lineStart.parentNode;
    }

    return lineStart;
  }

  function shouldStopLineWrap(node, isFirstNode) {
    if (!node) return true;
    if (isBr(node)) return true;

    if (
      !isFirstNode &&
      node.nodeType === Node.ELEMENT_NODE &&
      isBlockLike(node)
    ) {
      return true;
    }

    return false;
  }

  function applyIndentLine(node, root) {
    const indentVal = config.textIndent || config.marginLeft || '2em';
    const lineStart = findLineStart(node, root);

    if (!lineStart || !lineStart.parentNode || isInsideCode(lineStart)) return;

    if (lineStart.nodeType === Node.ELEMENT_NODE && isBlockLike(lineStart)) {
      lineStart.style.textIndent = indentVal;
      lineStart.classList.add(IND_CLASS);
      return;
    }

    const parent = lineStart.parentNode;
    const wrap = createEl('span', {
      class: IND_CLASS,
      style: `display:block;text-indent:${indentVal};`,
    });

    parent.insertBefore(wrap, lineStart);

    let cur = lineStart;
    let isFirstNode = true;

    while (cur && !shouldStopLineWrap(cur, isFirstNode)) {
      const next = cur.nextSibling;
      wrap.appendChild(cur);
      cur = next;
      isFirstNode = false;
    }

    if (!hasMeaningfulContent(wrap)) {
      unwrap(wrap);
    }
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

  function processIndent(container) {
    if (!container) return;

    const tagRaw = String(config.bbcode || '[indent]');
    const tag = tagRaw.toLowerCase();

    if (!container.textContent.toLowerCase().includes(tag)) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const n = walker.currentNode;

      if (
        n.nodeValue &&
        n.nodeValue.toLowerCase().includes(tag) &&
        !isInsideCode(n)
      ) {
        nodes.push(n);
      }
    }

    nodes.forEach((startNode) => {
      let cur = startNode;

      while (cur && cur.nodeType === Node.TEXT_NODE && cur.parentNode) {
        const low = (cur.nodeValue || '').toLowerCase();
        const idx = low.indexOf(tag);

        if (idx === -1) break;

        try {
          const needBr = needLineBreakBefore(cur, idx);
          const after = cur.splitText(idx);

          after.nodeValue = after.nodeValue.slice(tagRaw.length);

          if (needBr && after.parentNode) {
            ensureBrBefore(after);
          }

          applyIndentLine(after, container);

          if (after.parentNode && isBlankTextNode(after)) {
            after.remove();
          }

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
