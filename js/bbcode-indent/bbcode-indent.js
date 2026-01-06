(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeIndent', {});
  const state = helpers.register('bbcodeIndent', {});
  const IND_CLASS = 'bbindent-line';

  const NBSP_RE = /\u00a0/g;

  function isBlankTextNode(n) {
    return (
      n &&
      n.nodeType === Node.TEXT_NODE &&
      !/\S/.test((n.nodeValue || '').replace(NBSP_RE, ''))
    );
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
        if (n.tagName !== 'BR') return n;
      } else if (n.nodeType === Node.TEXT_NODE) {
        if (!isBlankTextNode(n)) return n;
      }
      n = nextInDom(n, root);
    }
    return null;
  }

  function injectButton() {
    const ref = $(config.buttonAfterSelector);
    if (!ref || document.getElementById(config.buttonId)) return;

    const buttonIcon = config.buttonIcon;

    const td = createEl('td', {
      id: config.buttonId,
      title: config.buttonTitle,
      html: `<img src="${buttonIcon}" style="cursor:pointer">`,
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
    if (!container.textContent.toLowerCase().includes(config.bbcode.toLowerCase()))
      return;

    const tag = config.bbcode.toLowerCase();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeValue && n.nodeValue.toLowerCase().includes(tag)) {
        nodes.push(n);
      }
    }

    nodes.forEach((node) => {
      let cur = node;

      while (cur && cur.nodeType === Node.TEXT_NODE) {
        const idx = cur.nodeValue.toLowerCase().indexOf(tag);
        if (idx === -1) break;
        const range = document.createRange();
        range.setStart(container, 0);
        range.setEnd(cur, idx);
        const needBr = /\S/.test(range.toString().replace(NBSP_RE, ''));
        const after = cur.splitText(idx);
        after.nodeValue = after.nodeValue.slice(config.bbcode.length);

        let inlineTarget = after;
        while (
          inlineTarget &&
          (isBlankTextNode(inlineTarget) ||
            (inlineTarget.nodeType === Node.ELEMENT_NODE &&
              inlineTarget.tagName === 'BR'))
        ) {
          inlineTarget = inlineTarget.nextSibling;
        }

        const indentTarget = findNextMeaningful(after, container);

        if (needBr) {
          const ref =
            inlineTarget && inlineTarget.parentNode === cur.parentNode
              ? inlineTarget
              : cur.nextSibling;

          let prev = ref ? ref.previousSibling : cur;

          while (prev && prev.nodeType === Node.TEXT_NODE && !/\S/.test(prev.nodeValue)) {
            const tmp = prev;
            prev = prev.previousSibling;
            tmp.remove();
          }

          if (!(prev && prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR')) {
            prev = cur.parentNode.insertBefore(createEl('br'), ref || null);
          }

          while (
            prev.nextSibling &&
            prev.nextSibling.nodeType === Node.ELEMENT_NODE &&
            prev.nextSibling.tagName === 'BR'
          ) {
            prev.nextSibling.remove();
          }
        }

        applyIndent(indentTarget || inlineTarget || cur.nextSibling);

        if (after && after.nodeType === Node.TEXT_NODE && isBlankTextNode(after)) {
          after.remove();
        }

        cur =
          after && after.parentNode && after.nodeType === Node.TEXT_NODE
            ? after
            : null;
      }
    });

    function applyIndent(node) {
      const indentVal = config.textIndent || config.marginLeft || '2em';
      if (!node) return;

      const host = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
      if (host && host.closest?.('.code-box, .blockcode, pre, code')) return;

      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.classList?.contains(IND_CLASS)
      )
        return;

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
