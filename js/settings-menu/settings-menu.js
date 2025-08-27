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
  let pendingMounts;
  let api;

  function closeMenu() {
    toggleMenu(false);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeMenu();
  }

  function openMenu(forceState) {
    toggleMenu(typeof forceState === 'boolean' ? forceState : true);
  }

  function toggleMenu(forceState) {
    const isOpen = menu.classList.contains('open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (isOpen === shouldOpen) return;

    menu.classList.toggle('open', shouldOpen);
    toggle.setAttribute('aria-expanded', shouldOpen);
    overlay.classList.toggle('show', shouldOpen);
    if (shouldOpen) {
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
    }
  }

  function renderItem(item) {
    const li = createEl('li');
    if (item.href) {
      const target =
        item.target || (item.href.startsWith('http') ? '_blank' : null);
      const a = createEl('a', {
        href: item.href,
        text: item.text || item.href,
        target: target,
        rel: item.rel || (target === '_blank' ? 'noopener noreferrer' : null),
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

  function mountSection(list, cfg) {
    const { mount } = cfg;
    if (mount === undefined) return;
    if (typeof mount === 'string') {
      const [script, method = 'initSection'] = mount.split(':');
      if (window.scripts?.[script]?.[method]) {
        window.scripts[script][method](list, api);
      } else {
        if (!pendingMounts[script]) pendingMounts[script] = [];
        pendingMounts[script].push(() =>
          window.scripts?.[script]?.[method]?.(list, api),
        );
      }
    } else if (typeof mount === 'function') {
      mount(list, api);
    }
  }

  function parseSections(sectionsConfig) {
    if (!sectionsConfig) return [];

    const norm = (cfg, id) => {
      let sec;
      if (typeof cfg === 'string') {
        sec = { title: cfg };
      } else {
        sec = { ...(cfg || {}) };
      }
      if (id && !sec.id) sec.id = id;
      return sec;
    };

    if (Array.isArray(sectionsConfig)) {
      return sectionsConfig.map((cfg) => norm(cfg));
    }

    if (
      sectionsConfig.id ||
      sectionsConfig.title ||
      sectionsConfig.items ||
      sectionsConfig.mount
    ) {
      return [norm(sectionsConfig)];
    }

    return Object.entries(sectionsConfig).map(([id, cfg]) => norm(cfg, id));
  }

  function createSection(cfg) {
    const secEl = createEl('div', { className: 'settings-menu__section' });
    if (cfg.id) secEl.id = cfg.id;
    if (cfg.title) secEl.append(createEl('h3', { text: cfg.title }));

    const list = createEl('ul');
    (cfg.items || []).forEach((item) => list.append(renderItem(item)));
    secEl.append(list);

    mountSection(list, cfg);

    return { section: secEl, list };
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });
    sectionsById = Object.create(null);
    sectionCallbacks = Object.create(null);
    pendingMounts = Object.create(null);

    const sections = parseSections(config.sections);

    const frag = document.createDocumentFragment();

    sections.forEach((section) => {
      const { section: sectionEl, list } = createSection(section);
      frag.append(sectionEl);
      if (section.id) {
        sectionsById[section.id] = list;
        if (sectionCallbacks[section.id]) {
          sectionCallbacks[section.id].forEach((cb) => cb(list));
          delete sectionCallbacks[section.id];
        }
      }
    });

    menu.append(frag);

    overlay = createEl('div', { className: 'settings-menu__overlay' });
    toggle = createEl('button', {
      className: 'settings-menu__toggle',
      type: 'button',
      'aria-label': config.texts.open,
      'aria-expanded': 'false',
    });
    toggle.append(
      createEl('i', {
        className: 'fa-solid fa-bars',
        'aria-hidden': 'true',
      }),
    );

    document.body.append(toggle, menu, overlay);
    toggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);
  }

  function getSection(id) {
    return sectionsById ? sectionsById[id] : undefined;
  }

  function addSection(cfg) {
    const sections = parseSections(cfg);
    let firstList;
    const frag = document.createDocumentFragment();
    sections.forEach((section) => {
      const { section: sectionEl, list } = createSection(section);
      frag.append(sectionEl);
      if (section.id) {
        sectionsById[section.id] = list;
        if (sectionCallbacks[section.id]) {
          sectionCallbacks[section.id].forEach((cb) => cb(list));
          delete sectionCallbacks[section.id];
        }
      }
      if (!firstList) firstList = list;
    });
    menu.append(frag);
    return firstList;
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

  function notifyScriptLoaded(name) {
    const cbs = pendingMounts?.[name];
    if (cbs) {
      cbs.forEach((cb) => cb());
      delete pendingMounts[name];
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
      notifyScriptLoaded,
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
