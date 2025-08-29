(() => {
  'use strict';

  let initialized = false;
  let helpers;
  let createEl;
  let config;
  let menu;
  let overlay;
  let toggle;
  let closeBtn;
  let lastFocused;
  let focusableCache;
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

  function handleTabKeydown(e) {
    if (e.key !== 'Tab' || !menu.contains(e.target)) return;
    if (!focusableCache?.length) return;

    const idx = focusableCache.indexOf(document.activeElement);
    if (idx === -1) return;
    const lastIdx = focusableCache.length - 1;

    if (e.shiftKey) {
      if (idx === 0) {
        e.preventDefault();
        focusableCache[lastIdx].focus();
      }
    } else if (idx === lastIdx) {
      e.preventDefault();
      focusableCache[0].focus();
    }
  }

  function setMenuState(forceState) {
    if (!initialized) init();
    toggleMenu(typeof forceState === 'boolean' ? forceState : true);
  }

  function updateFocusableCache() {
    if (!menu) return;
    focusableCache = Array.from(
      menu.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      if (el.disabled) return false;
      const style = getComputedStyle(el);
      return (
        style.visibility !== 'hidden' &&
        (el.offsetParent !== null ||
          style.position === 'fixed' ||
          el.getClientRects().length > 0)
      );
    });
  }

  function toggleMenu(forceState) {
    const isOpen = menu.classList.contains('open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (isOpen === shouldOpen) return;

    menu.classList.toggle('open', shouldOpen);
    toggle.setAttribute(
      'aria-label',
      shouldOpen ? config.texts.close : config.texts.open,
    );
    toggle.setAttribute('aria-expanded', String(shouldOpen));
    overlay.classList.toggle('show', shouldOpen);
    toggle.classList.toggle('hidden', shouldOpen);
    if (shouldOpen) {
      lastFocused = document.activeElement;
      document.addEventListener('keydown', handleKeydown);
      document.addEventListener('keydown', handleTabKeydown);
      updateFocusableCache();
      if (focusableCache.length) focusableCache[0].focus();
    } else {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('keydown', handleTabKeydown);
      focusableCache = undefined;
      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      } else {
        toggle.focus();
      }
    }
  }

  function renderItem(item) {
    const li = createEl('li');
    let mainEl;
    let toggleSubmenu;

    const handleMainClick = (e) => {
      if (item.children?.length) {
        if (
          item.onClick === false ||
          (item.onClick && item.onClick(e) === false)
        ) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        toggleSubmenu();
      } else {
        if (
          item.onClick === false ||
          (item.onClick && item.onClick(e) === false)
        ) {
          e.preventDefault();
          return;
        }
        if (item.href) closeMenu();
      }
    };

    if (item.href) {
      const isExternal = (() => {
        try {
          return new URL(item.href, location.href).origin !== location.origin;
        } catch {
          return /^https?:\/\//i.test(item.href);
        }
      })();
      const target = item.target || (isExternal ? '_blank' : null);
      const rel =
        item.rel || (target === '_blank' ? 'noopener noreferrer' : null);
      const attrs = {
        href: item.href,
        text: item.text || item.href,
        'aria-label': item.ariaLabel || item.text || 'Ссылка',
      };
      if (target) attrs.target = target;
      if (rel) attrs.rel = rel;
      mainEl = createEl('a', attrs);
      mainEl.addEventListener('click', handleMainClick);
      li.append(mainEl);
    } else {
      mainEl = createEl('button', {
        type: 'button',
        text: item.text || '—',
      });
      mainEl.addEventListener('click', handleMainClick);
      li.append(mainEl);
    }

    if (item.children?.length) {
      li.classList.add('settings-menu__item--has-children');

      const toggleBtn = createEl('button', {
        className: 'settings-menu__expand',
        type: 'button',
        'aria-label': 'Раскрыть подменю',
        'aria-expanded': 'false',
      });
      toggleBtn.append(
        createEl('i', {
          className: 'fa-solid fa-chevron-right',
          'aria-hidden': 'true',
        }),
      );

      const subList = createEl('ul', { className: 'settings-menu__submenu' });
      item.children.forEach((child) => subList.append(renderItem(child)));

      toggleSubmenu = () => {
        const isOpen = li.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        toggleBtn.setAttribute(
          'aria-label',
          isOpen ? 'Свернуть подменю' : 'Раскрыть подменю',
        );
        updateFocusableCache();
      };

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSubmenu();
      });

      li.append(toggleBtn, subList);
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
    let heading;
    if (cfg.title) {
      heading = createEl('h3', {
        text: cfg.title,
        role: 'button',
        tabindex: '0',
        'aria-expanded': 'false',
      });

      const toggleSection = () => {
        const isOpen = secEl.classList.toggle('open');
        heading.setAttribute('aria-expanded', String(isOpen));
        updateFocusableCache();
      };

      heading.addEventListener('click', toggleSection);
      heading.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleSection();
        }
      });
      secEl.append(heading);
    }

    const list = createEl('ul');
    (cfg.items || []).forEach((item) => list.append(renderItem(item)));
    secEl.append(list);

    mountSection(list, cfg);

    return { section: secEl, list, header: heading };
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });
    sectionsById = Object.create(null);
    sectionCallbacks = Object.create(null);
    pendingMounts = Object.create(null);

    const sections = parseSections(config.sections);

    const frag = document.createDocumentFragment();

    sections.forEach((section, idx) => {
      const { section: sectionEl, list, header } = createSection(section);
      if (idx === 0) {
        sectionEl.classList.add('open');
        if (header) header.setAttribute('aria-expanded', 'true');
      }
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

    closeBtn = createEl('button', {
      className: 'settings-menu__close',
      type: 'button',
      'aria-label': 'Закрыть меню',
    });
    closeBtn.append(
      createEl('i', {
        className: 'fa-solid fa-xmark',
        'aria-hidden': 'true',
      }),
    );
    closeBtn.addEventListener('click', closeMenu);
    menu.append(closeBtn);

    overlay = createEl('div', { className: 'settings-menu__overlay' });
    toggle = createEl('button', {
      className: 'settings-menu__toggle',
      type: 'button',
      'aria-label': config.texts.open,
      'aria-expanded': 'false',
    });
    toggle.setAttribute('aria-controls', 'settings-menu');
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
    if (!initialized) init();
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
    updateFocusableCache();
    return firstList;
  }

  function addItems(id, items) {
    if (!initialized) init();
    const list = getSection(id);
    if (!list) return;
    (items || []).forEach((item) => list.append(renderItem(item)));
    updateFocusableCache();
    return list;
  }

  function registerSection(id, cb) {
    if (!initialized) init();
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
    if (initialized) return api;
    helpers = window.helpers;
    ({ createEl } = helpers);
    config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню', close: 'Закрыть меню' },
      sections: {},
    });

    api = {
      init,
      setMenuState,
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
    return api;
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
