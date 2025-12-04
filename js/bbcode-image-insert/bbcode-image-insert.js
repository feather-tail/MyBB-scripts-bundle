(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, createEl } = helpers;
  const config = helpers.getConfig('bbcodeImageInsert', {});
  const state = helpers.register('bbcodeImageInsert', {});

  function injectButton() {
    const ref = $(config.buttonAfterSelector || '#button-image');
    if (!ref) return;

    if (document.getElementById(config.buttonId || 'button-image-insert')) {
      return;
    }

    const buttonId = config.buttonId || 'button-image-insert';
    const title = config.buttonTitle || 'Изображение';
    const icon = config.buttonIcon || '/i/blank.gif';

    const td = createEl('td', {
      id: buttonId,
      title,
      html: `<img src="${icon}" style="cursor:pointer">`,
    });

    td.addEventListener('click', () => {
      const open = config.bbcodeOpen || '[img]';
      const close = config.bbcodeClose || '[/img]';

      if (typeof window.bbcode === 'function') {
        window.bbcode(open, close);
      } else {
        const ta =
          document.querySelector('#main-reply') ||
          document.querySelector('textarea[name="req_message"]') ||
          document.querySelector('textarea[name="message"]');

        if (!ta) return;

        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? start;
        const before = ta.value.slice(0, start);
        const selected = ta.value.slice(start, end);
        const after = ta.value.slice(end);

        ta.value = before + open + selected + close + after;

        const cursorStart = start + open.length;
        const cursorEnd = cursorStart + selected.length;
        ta.selectionStart = cursorStart;
        ta.selectionEnd = cursorEnd;
        ta.focus();
      }

      document.dispatchEvent(new Event('pun_preview'));
    });

    ref.after(td);
  }

  function init() {
    if (state.inited) return;
    state.inited = true;
    injectButton();
  }

  const run = helpers.once(init);
  helpers.ready(run);
  document.addEventListener('pun_main_ready', run);
})();
