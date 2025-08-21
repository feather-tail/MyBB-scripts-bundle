(() => {
  const SETTINGS = {
    buttonSelector: '#button-strike',
    buttonId: 'button-indent',
    buttonTitle: 'Отступы',
    iconSrc: '/i/blank.gif',
    bbcode: '',
    marginLeft: '2em',
    contentSel: '.post-content, #post-preview .post-content',
  };

  const escapeRegExp = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  function injectButton() {
    const ref = document.querySelector(SETTINGS.buttonSelector);
    if (!ref || document.getElementById(SETTINGS.buttonId)) return;

    const td = document.createElement('td');
    td.id = SETTINGS.buttonId;
    td.title = SETTINGS.buttonTitle;
    td.innerHTML = `<img src="${SETTINGS.iconSrc}" style="cursor:pointer">`;

    td.addEventListener('click', () => {
      const ta = document.querySelector(
        '#main-reply, textarea[name="req_message"]',
      );
      if (!ta) return;

      const pos = ta.selectionStart;
      ta.setRangeText(SETTINGS.bbcode, pos, pos, 'end');
      ta.focus();

      document.dispatchEvent(new Event('pun_preview'));
    });

    ref.after(td);
  }

  function processIndent(container) {
    const rxTag = new RegExp(escapeRegExp(SETTINGS.bbcode), 'gi');
    const spanHTML = `<span style="display:inline-block;margin-left:${SETTINGS.marginLeft};"></span>`;

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

    document.querySelectorAll(SETTINGS.contentSel).forEach(processIndent);

    const prevBox = document.querySelector('#post-preview .post-content');
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

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pun_main_ready', init);
  document.addEventListener('pun_preview', init);
})();
