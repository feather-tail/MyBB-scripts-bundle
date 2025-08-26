(() => {
  'use strict';

  let initialized = false;
  let helpers;
  let createEl;
  let config;
  let menu;
  let overlay;
  let toggle;
  let sectionsById;
  let api;

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

  function renderItem(item) {
    const li = createEl('li');
    if (item.href) {
      const a = createEl('a', {
        href: item.href,
        text: item.text || item.href,
        target: item.target || (item.href.startsWith('http') ? '_blank' : null),
        rel:
          item.rel || (item.target === '_blank' ? 'noopener noreferrer' : null),
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
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });
    sectionsById = Object.create(null);

    let sections = config.sections || [];
    if (!Array.isArray(sections)) {
      sections = Object.entries(sections).map(([key, cfg]) => {
        const sec = { ...(cfg || {}) };
        if (!sec.id) sec.id = key;
        return sec;
      });
    }

    sections.forEach((section) => {
      const secEl = createEl('div', { className: 'settings-menu__section' });
      if (section.id) secEl.id = section.id;
      if (section.title) secEl.append(createEl('h3', { text: section.title }));

      const list = createEl('ul');
      (section.items || []).forEach((item) => list.append(renderItem(item)));
      secEl.append(list);
      menu.append(secEl);
      if (section.id) sectionsById[section.id] = list;
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

  function getSection(id) {
    return sectionsById ? sectionsById[id] : undefined;
  }

  function addSection(cfg) {
    const secEl = createEl('div', { className: 'settings-menu__section' });
    if (cfg.id) secEl.id = cfg.id;
    if (cfg.title) secEl.append(createEl('h3', { text: cfg.title }));

    const list = createEl('ul');
    (cfg.items || []).forEach((item) => list.append(renderItem(item)));
    secEl.append(list);
    menu.append(secEl);
    if (cfg.id) sectionsById[cfg.id] = list;
    return list;
  }

  function addItems(id, items) {
    const list = getSection(id);
    if (!list) return;
    (items || []).forEach((item) => list.append(renderItem(item)));
    return list;
  }

  function init() {
    if (initialized) return;
    helpers = window.helpers;
    ({ createEl } = helpers);
    config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню' },
      sections: {},
    });

    buildMenu();
    initialized = true;

    api = {
      init,
      open: openMenu,
      close: closeMenu,
      getSection,
      addSection,
      addItems,
    };

    if (helpers.register) {
      helpers.register('settingsMenu', api);
    }

    window.settingsMenu = api;
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
