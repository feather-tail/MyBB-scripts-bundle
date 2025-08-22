(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const CFG = window.ScriptConfig.bbcodeIndent;

  const BUTTON_AFTER = '#button-strike';
  const BUTTON_ID = 'button-indent';
  const BUTTON_TITLE = 'Отступы';
  const ICON_SRC = '/i/blank.gif';

  const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  function injectButton() {
    const ref = $(BUTTON_AFTER);
    if (!ref || document.getElementById(BUTTON_ID)) return;

    const td = createEl('td', {
      id: BUTTON_ID,
      title: BUTTON_TITLE,
      html: `<img src="${ICON_SRC}" style="cursor:pointer">`,
    });

    td.addEventListener('click', () => {
      const ta = $('#main-reply, textarea[name="req_message"]');
      if (!ta) return;

      const pos = ta.selectionStart;
      ta.setRangeText(CFG.bbcode, pos, pos, 'end');
      ta.focus();

      document.dispatchEvent(new Event('pun_preview'));
    });

    ref.after(td);
  }

  function processIndent(container) {
    const rxTag = new RegExp(escapeRegExp(CFG.bbcode), 'gi');
    const spanHTML = `<span style="display:inline-block;margin-left:${CFG.marginLeft};"></span>`;

    if (!rxTag.test(container.innerHTML)) return;

    container.innerHTML = container.innerHTML.replace(
      rxTag,
      (match, offset, full) => {
        const prefix = full
          .slice(0, offset)
          .replace(/<[^>]+>/g, '')
          .replace(/\s|&nbsp;/g, '');

        return (prefix ? '<br>' : '') + spanHTML;
      },
    );
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    injectButton();

    $$(CFG.selectors).forEach(processIndent);

    const prevBox = $('#post-preview .post-content');
    if (prevBox && !window._indentObserver) {
      const obs = new MutationObserver(() => {
        obs.disconnect();
        processIndent(prevBox);
        obs.observe(prevBox, { childList: true, subtree: true });
      });
      obs.observe(prevBox, { childList: true, subtree: true });
      window._indentObserver = obs;
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pun_main_ready', init);
  document.addEventListener('pun_preview', init);
})();
