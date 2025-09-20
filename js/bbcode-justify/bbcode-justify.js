(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl } = helpers;
  const config = helpers.getConfig('bbcodeJustify', {});

  function init() {
    const refTd = document.querySelector(config.insertAfterSelector);
    if (!refTd || refTd.tagName !== 'TD') return;

    const td = createEl('td', { id: config.buttonId, title: config.title });
    const iconSrc = config.buttonIcon ?? config.iconSrc;
    const img = createEl('img', { src: iconSrc, alt: config.title });
    td.appendChild(img);

    td.addEventListener('click', () => {
      if (typeof bbcode === 'function') {
        bbcode(config.bbcodeOpen, config.bbcodeClose);
      } else {
        td.classList.add('inactive');
        td.title = 'Функция bbcode не найдена';
      }
    });

    refTd.parentNode.insertBefore(td, refTd.nextSibling);
  }

  helpers.runOnceOnReady(init);
  helpers.register('bbcodeJustify', { init });
})();
