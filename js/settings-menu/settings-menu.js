(() => {
  'use strict';

  let initialized = false;
  let helpers;
  let createEl;
  let config;
  let menu;
  let overlay;
  let toggle;
  let cursorSection;

  function closeMenu() {
    if (menu.classList.contains('open')) {
      toggleMenu();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeMenu();
  }

  function openMenu() {
    if (!menu.classList.contains('open')) {
      toggleMenu();
    }
  }

  function toggleMenu() {
    const isOpen = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
    overlay.classList.toggle('show', isOpen);
    if (isOpen) {
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
    }
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });

    const renderItem = (item) => {
      const li = createEl('li');
      if (item.href) {
        const a = createEl('a', {
          href: item.href,
          text: item.text || item.href,
          target:
            item.target || (item.href.startsWith('http') ? '_blank' : null),
          rel:
            item.rel ||
            (item.target === '_blank' ? 'noopener noreferrer' : null),
          'aria-label': item.ariaLabel || item.text || 'Ссылка',
        });
        a.addEventListener('click', (e) => {
          if (item.onClick) item.onClick(e);
          closeMenu();
        });
        li.append(a);
      } else {
        li.textContent = item.text || '—';
        if (item.onClick) li.addEventListener('click', item.onClick);
      }
      return li;
    };

    (config.sections || []).forEach((section) => {
      const secEl = createEl('div', { className: 'settings-menu__section' });
      if (section.title) secEl.append(createEl('h3', { text: section.title }));

      const list = createEl('ul');
      (section.items || []).forEach((item) => list.append(renderItem(item)));
      secEl.append(list);
      menu.append(secEl);
    });

    overlay = createEl('div', { className: 'settings-menu__overlay' });
    toggle = createEl('button', {
      className: 'settings-menu__toggle',
      type: 'button',
      'aria-label': config.texts.open,
      'aria-expanded': 'false',
    });
    for (let i = 0; i < 3; i++) toggle.append(createEl('span'));

    document.body.append(toggle, menu, overlay);
    toggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);
  }

  function init() {
    if (initialized) return;
    helpers = window.helpers;
    ({ createEl } = helpers);
    config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню' },
      sections: [],
    });

    buildMenu();
    cursorSection = menu.querySelector(
      '.settings-menu__section h3:textContent("Курсоры") + ul',
    );
    initialized = true;

    if (helpers.register) {
      helpers.register('settingsMenu', {
        init,
        open: openMenu,
        close: closeMenu,
        getCursorSection: () => cursorSection,
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
