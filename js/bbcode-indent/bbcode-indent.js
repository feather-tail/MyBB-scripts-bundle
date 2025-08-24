(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeIndent', {});
  const state = helpers.register('bbcodeIndent', {});

  const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

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
    const rxTag = new RegExp(escapeRegExp(config.bbcode), 'gi');
    const spanHTML = `<span style="display:inline-block;margin-left:${config.marginLeft};"></span>`;

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
