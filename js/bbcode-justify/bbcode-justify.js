(() => {
  'use strict';

  const { createEl } = window.helpers;
  const CFG = window.ScriptConfig.bbcodeJustify;

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const refTd = document.querySelector(CFG.insertAfterSelector);
    if (!refTd || refTd.tagName !== 'TD') return;

    const td = createEl('td', { id: CFG.buttonId, title: CFG.title });
    const img = createEl('img', { src: CFG.iconSrc, alt: CFG.title });
    td.appendChild(img);

    td.addEventListener('click', () => {
      if (typeof bbcode === 'function') {
        bbcode(CFG.bbcodeOpen, CFG.bbcodeClose);
      } else {
        td.classList.add('inactive');
        td.title = 'Функция bbcode не найдена';
      }
    });

    refTd.parentNode.insertBefore(td, refTd.nextSibling);
  }

  helpers.ready(init);
})();
