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
  let mountRetryTimer;
  let mountRetryTicks;
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

    const first = focusableCache[0];
    const last = focusableCache[focusableCache.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openMenu(forceState) {
    toggleMenu(typeof forceState === 'boolean' ? forceState : true);
  }

  function updateFocusableCache() {
    if (!menu) return;
    focusableCache = menu.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
  }

  function toggleMenu(forceState) {
    const isOpen = menu.classList.contains('open');
    const shouldOpen = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (isOpen === shouldOpen) return;

    menu.classList.toggle('open', shouldOpen);
    toggle.setAttribute('aria-expanded', String(shouldOpen));
    overlay.classList.toggle('show', shouldOpen);
    toggle.style.display = shouldOpen ? 'none' : '';
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
      mainEl.addEventListener('click', (e) => {
        if (item.onClick) item.onClick(e);
        closeMenu();
      });
      li.append(mainEl);
    } else {
      mainEl = createEl('span', { text: item.text || '—' });
      if (item.onClick) mainEl.addEventListener('click', item.onClick);
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

      const toggle = () => {
        const isOpen = li.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        updateFocusableCache();
      };

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });

      if (!item.href) {
        mainEl.addEventListener('click', (e) => {
          e.stopPropagation();
          toggle();
        });
      }

      li.append(toggleBtn, subList);
    }

    return li;
  }

  function scheduleMountRetry() {
    if (mountRetryTimer) return;
    mountRetryTicks = 0;
    mountRetryTimer = setInterval(() => {
      mountRetryTicks++;
      const keys = Object.keys(pendingMounts);
      if (!keys.length) {
        clearInterval(mountRetryTimer);
        mountRetryTimer = null;
        return;
      }
      for (const ns of keys) {
        const ctx =
          window[ns] ||
          (window.scripts && window.scripts[ns]) ||
          undefined;
        if (!ctx) continue;
        const tasks = pendingMounts[ns];
        delete pendingMounts[ns];
        tasks.forEach(({ method, sectionEl }) => {
          const fn = ctx && ctx[method];
          if (typeof fn === 'function') fn(sectionEl, api);
        });
      }
      if (mountRetryTicks > 50) {
        clearInterval(mountRetryTimer);
        mountRetryTimer = null;
      }
    }, 200);
  }

  function mountSection(sectionEl, cfg) {
    const { mount } = cfg;
    if (mount === undefined) return;

    if (typeof mount === 'function') {
      mount(sectionEl, api);
      return;
    }

    if (typeof mount === 'string') {
      const [ns, method = 'initSection'] = mount.split(':');

      const tryInvoke = () => {
        const ctx =
          (ns && window[ns]) ||
          (ns && window.scripts && window.scripts[ns]) ||
          undefined;
        const fn = ctx && ctx[method];
        if (typeof fn === 'function') {
          fn(sectionEl, api);
          return true;
        }
        return false;
      };

      if (!tryInvoke()) {
        if (!pendingMounts[ns]) pendingMounts[ns] = [];
        pendingMounts[ns].push({ method, sectionEl });
        scheduleMountRetry();
      }
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
    if (cfg.title) {
      const heading = createEl('h3', { text: cfg.title });
      heading.addEventListener('click', () => {
        secEl.classList.toggle('open');
        updateFocusableCache();
      });
      secEl.append(heading);
    }

    const list = createEl('ul');
    (cfg.items || []).forEach((item) => list.append(renderItem(item)));
    secEl.append(list);

    mountSection(secEl, cfg);

    return { section: secEl, list };
  }

  function buildMenu() {
    menu = createEl('nav', { id: 'settings-menu', className: 'settings-menu' });
    sectionsById = Object.create(null);
    sectionCallbacks = Object.create(null);
    pendingMounts = Object.create(null);

    const sections = parseSections(config.sections);

    const frag = document.createDocumentFragment();

    sections.forEach((section, idx) => {
      const { section: sectionEl, list } = createSection(section);
      if (idx === 0) sectionEl.classList.add('open');
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
    const list = getSection(id);
    if (!list) return;
    (items || []).forEach((item) => list.append(renderItem(item)));
    updateFocusableCache();
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
    const ctx =
      window[name] ||
      (window.scripts && window.scripts[name]) ||
      undefined;
    const tasks = pendingMounts?.[name];
    if (tasks && ctx) {
      tasks.forEach(({ method, sectionEl }) => {
        const fn = ctx && ctx[method];
        if (typeof fn === 'function') fn(sectionEl, api);
      });
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
