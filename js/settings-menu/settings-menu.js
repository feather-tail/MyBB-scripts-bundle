(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl } = helpers;
  const config = helpers.getConfig('settingsMenu', {
    texts: { open: 'Меню' },
    sections: [],
  });

  let menu;
  let overlay;
  let toggle;

  function closeMenu() {
    menu.classList.remove('open');
    overlay.classList.remove('show');
  }

  function openMenu() {
    menu.classList.add('open');
    overlay.classList.add('show');
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });

    (config.sections || []).forEach((section) => {
      const secEl = createEl('div', { className: 'settings-menu__section' });
      if (section.title) {
        secEl.append(createEl('h3', { text: section.title }));
      }
      const list = createEl('ul');
      (section.items || []).forEach((item) => {
        list.append(createEl('li', { text: item }));
      });
      secEl.append(list);
      menu.append(secEl);
    });

    overlay = createEl('div', { className: 'settings-menu__overlay' });
    toggle = createEl('button', {
      className: 'settings-menu__toggle',
      type: 'button',
      'aria-label': config.texts.open,
    });
    for (let i = 0; i < 3; i++) {
      toggle.append(createEl('span'));
    }

    document.body.append(toggle, menu, overlay);

    toggle.addEventListener('click', openMenu);
    overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function init() {
    buildMenu();
  }

  helpers.runOnceOnReady(init);
  helpers.register('settingsMenu', { init, open: openMenu, close: closeMenu });
})();
