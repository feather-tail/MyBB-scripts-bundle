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
  let sectionCallbacks;
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
    sectionCallbacks = Object.create(null);

    let sections = config.sections || [];
    if (!Array.isArray(sections)) {
      sections = Object.entries(sections).map(([key, cfg]) => {
        let sec;
        if (typeof cfg === 'string') {
          sec = { title: cfg };
        } else {
          sec = { ...(cfg || {}) };
        }
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

      if (section.script !== undefined) {
        if (typeof section.script === 'string') {
          window.scripts?.[section.script]?.init?.(list);
        } else if (typeof section.script === 'function') {
          section.script(list, api);
        }
      } else if (section.mount !== undefined) {
        if (typeof section.mount === 'string') {
          window.scripts?.[section.mount]?.init?.(list);
        } else if (typeof section.mount === 'function') {
          section.mount(list, api);
        }
      }

      menu.append(secEl);
      if (section.id) {
        sectionsById[section.id] = list;
        if (sectionCallbacks[section.id]) {
          sectionCallbacks[section.id].forEach((cb) => cb(list));
          delete sectionCallbacks[section.id];
        }
      }
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

    if (cfg.script !== undefined) {
      if (typeof cfg.script === 'string') {
        window.scripts?.[cfg.script]?.init?.(list);
      } else if (typeof cfg.script === 'function') {
        cfg.script(list, api);
      }
    } else if (cfg.mount !== undefined) {
      if (typeof cfg.mount === 'string') {
        window.scripts?.[cfg.mount]?.init?.(list);
      } else if (typeof cfg.mount === 'function') {
        cfg.mount(list, api);
      }
    }

    menu.append(secEl);
    if (cfg.id) {
      sectionsById[cfg.id] = list;
      if (sectionCallbacks[cfg.id]) {
        sectionCallbacks[cfg.id].forEach((cb) => cb(list));
        delete sectionCallbacks[cfg.id];
      }
    }
    return list;
  }

  function addItems(id, items) {
    const list = getSection(id);
    if (!list) return;
    (items || []).forEach((item) => list.append(renderItem(item)));
    return list;
  }

  function registerSection(id, cb) {
    const list = getSection(id);
    if (list) {
      cb(list);
    } else {
      if (!sectionCallbacks[id]) sectionCallbacks[id] = [];
      sectionCallbacks[id].push(cb);
    }
  }

  function init() {
    if (initialized) return;
    helpers = window.helpers;
    ({ createEl } = helpers);
    config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню' },
      sections: {},
    });

    api = {
      init,
      open: openMenu,
      close: closeMenu,
      getSection,
      addSection,
      addItems,
      registerSection,
    };

    buildMenu();
    initialized = true;

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
