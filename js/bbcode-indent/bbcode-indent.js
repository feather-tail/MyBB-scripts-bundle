(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeIndent', {});
  const state = helpers.register('bbcodeIndent', {});
  const IND_CLASS = 'bbindent-line';

  function injectButton() {
    const ref = $(config.buttonAfterSelector);
    if (!ref || document.getElementById(config.buttonId)) return;

    const td = createEl('td', {
      id: config.buttonId,
      title: config.buttonTitle,
      html: `<img src="${config.iconSrc}" style="cursor:pointer">`,
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
    if (
      !container.textContent.toLowerCase().includes(config.bbcode.toLowerCase())
    )
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
        const needBr = /\S/.test(range.toString().replace(/\u00a0/g, ''));

        const after = cur.splitText(idx);
        after.nodeValue = after.nodeValue.slice(config.bbcode.length);

        let target = after.nodeValue ? after : after.nextSibling;
        if (!after.nodeValue) after.remove();

        while (
          target &&
          target.nodeType === Node.ELEMENT_NODE &&
          target.tagName === 'BR'
        ) {
          target = target.nextSibling;
        }

        if (needBr) {
          const ref = target || cur.nextSibling;
          let prev = ref ? ref.previousSibling : cur;

          while (
            prev &&
            prev.nodeType === Node.TEXT_NODE &&
            !/\S/.test(prev.nodeValue)
          ) {
            const tmp = prev;
            prev = prev.previousSibling;
            tmp.remove();
          }

          if (
            !(
              prev &&
              prev.nodeType === Node.ELEMENT_NODE &&
              prev.tagName === 'BR'
            )
          ) {
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

        applyIndent(target || cur.nextSibling);

        cur =
          target && target.nodeType === Node.TEXT_NODE
            ? target
            : target
            ? target.nextSibling
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
