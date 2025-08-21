(() => {
  'use strict';
  const JUSTIFY_CONFIG = {
    insertAfterSelector: '#button-right',
    buttonId: 'button-justify',
    iconSrc: '/i/blank.gif',
    title: 'Выравнивание по ширине',
    bbcodeOpen: '[align=justify]',
    bbcodeClose: '[/align]',
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const refTd = document.querySelector(JUSTIFY_CONFIG.insertAfterSelector);
    if (!refTd || refTd.tagName !== 'TD') return;

    const td = document.createElement('td');
    td.id = JUSTIFY_CONFIG.buttonId;
    td.title = JUSTIFY_CONFIG.title;

    const img = document.createElement('img');
    img.src = JUSTIFY_CONFIG.iconSrc;
    img.alt = JUSTIFY_CONFIG.title;
    td.appendChild(img);

    td.addEventListener('click', () => {
      if (typeof bbcode === 'function') {
        bbcode(JUSTIFY_CONFIG.bbcodeOpen, JUSTIFY_CONFIG.bbcodeClose);
      } else {
        td.classList.add('inactive');
        td.title = 'Функция bbcode не найдена';
      }
    });

    refTd.parentNode.insertBefore(td, refTd.nextSibling);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
