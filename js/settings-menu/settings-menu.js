(() => {
  'use strict';

  let helpers;
  let createEl;
  let config;

  let menu;
  let overlay;
  let toggle;

  function closeMenu() {
    menu.classList.remove('open');
    overlay.classList.remove('show');
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeMenu();
  }

  function openMenu() {
    menu.classList.add('open');
    overlay.classList.add('show');
    document.addEventListener('keydown', handleKeydown);
  }

  function toggleMenu() {
    if (menu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
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

    toggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function init() {
    helpers = window.helpers;
    ({ createEl } = helpers);
    config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню' },
      sections: [],
    });

    buildMenu();

    if (helpers.register) {
      helpers.register('settingsMenu', {
        init,
        open: openMenu,
        close: closeMenu,
      });
    }
  }

  function bootstrap() {
    const helpers = window.helpers;
    if (helpers) {
      if (helpers.runOnceOnReady) {
        helpers.runOnceOnReady(init);
      } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    } else {
      setTimeout(bootstrap, 25);
    }
  }

  bootstrap();
})();
