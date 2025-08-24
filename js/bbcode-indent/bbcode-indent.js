(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeIndent', {});
  const state = helpers.register('bbcodeIndent', {});


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
    if (!container.innerHTML.includes(config.bbcode)) return;

    const tag = config.bbcode.toLowerCase();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeValue.toLowerCase().includes(tag)) {
        nodes.push(n);
      }
    }

    nodes.forEach((node) => {
      let cur = node;

      while (cur) {
        const idx = cur.nodeValue.toLowerCase().indexOf(tag);
        if (idx === -1) break;

        const range = document.createRange();
        range.setStart(container, 0);
        range.setEnd(cur, idx);
        const needBr = /\S/.test(range.toString().replace(/\u00a0/g, ''));

        const after = cur.splitText(idx);
        after.nodeValue = after.nodeValue.slice(config.bbcode.length);
        let target;
        if (after.nodeValue) {
          target = after;
        } else {
          target = after.nextSibling;
          after.remove();
        }

        if (needBr) {
          cur.parentNode.insertBefore(createEl('br'), target);
        }

        applyIndent(target);

        cur =
          target && target.nodeType === Node.TEXT_NODE
            ? target
            : target
            ? target.nextSibling
            : null;
      }
    });

    function applyIndent(node) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const span = createEl('span', {
          style: `display:inline-block;margin-left:${config.marginLeft};`,
        });
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const display = window.getComputedStyle(node).display;
        if (['block', 'flex', 'grid', 'table', 'list-item'].includes(display)) {
          node.style.marginLeft = config.marginLeft;
        } else {
          const span = createEl('span', {
            style: `display:inline-block;margin-left:${config.marginLeft};`,
          });
          node.parentNode.insertBefore(span, node);
          span.appendChild(node);
        }
      }
    }
  }

  function init() {
    injectButton();

    $$(config.selectors).forEach(processIndent);

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
