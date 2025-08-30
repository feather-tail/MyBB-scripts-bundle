(() => {
  'use strict';

  function bootstrap() {
    const helpers = window.helpers;
    if (!helpers) {
      setTimeout(bootstrap, 25);
      return;
    }

    const { createEl } = helpers;
    const config = helpers.getConfig('settingsMenu', {
      texts: { open: 'Меню', close: 'Закрыть меню' },
      sections: {},
    });

    let menu;
    let overlay;
    let toggleBtn;
    const sectionMap = new Map();
    const pendingMounts = new Map();

    const api = {
      open,
      close,
      registerSection,
      notifyScriptLoaded,
    };

    function open() {
      menu.classList.add('open');
      overlay.classList.add('show');
      toggleBtn.classList.add('settings-menu__toggle--hidden');
    }

    function close() {
      menu.classList.remove('open');
      overlay.classList.remove('show');
      toggleBtn.classList.remove('settings-menu__toggle--hidden');
    }

    function registerSection(id, fn) {
      const ul = sectionMap.get(id);
      if (ul && typeof fn === 'function') fn(ul);
    }

    function notifyScriptLoaded(name) {
      const list = pendingMounts.get(name);
      if (!list) return;
      list.forEach(({ ul, method }) => {
        const fn = window.scripts?.[name]?.[method];
        if (typeof fn === 'function') fn(ul, api);
      });
      pendingMounts.delete(name);
    }

    function renderItem(item) {
      const li = createEl('li');

      let mainEl;
      if (item.href) {
        mainEl = createEl('a', {
          href: item.href,
          text: item.text || item.href,
          target: item.target || undefined,
          rel: item.rel || undefined,
        });
        mainEl.addEventListener('click', close);
      } else {
        mainEl = createEl('button', {
          type: 'button',
          text: item.text || '—',
        });
        if (typeof item.onClick === 'function') {
          mainEl.addEventListener('click', (e) => {
            if (item.onClick(e) !== false) close();
          });
        }
      }
      li.append(mainEl);

      if (item.children && item.children.length) {
        li.classList.add('settings-menu__item--has-children');
        const expand = createEl('button', {
          className: 'settings-menu__expand',
          type: 'button',
          'aria-label': 'Раскрыть подменю',
        });
        expand.innerHTML =
          '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

        const sub = createEl('ul', { className: 'settings-menu__submenu' });
        item.children.forEach((child) => sub.append(renderItem(child)));
        expand.addEventListener('click', (e) => {
          e.stopPropagation();
          li.classList.toggle('open');
        });
        li.append(expand, sub);
      }

      return li;
    }

    function mountSection(ul, mount) {
      if (!mount) return;
      if (typeof mount === 'function') {
        mount(ul, api);
        return;
      }
      if (typeof mount === 'string') {
        const [script, method = 'initSection'] = mount.split(':');
        const fn = window.scripts?.[script]?.[method];
        if (typeof fn === 'function') fn(ul, api);
        else {
          const arr = pendingMounts.get(script) || [];
          arr.push({ ul, method });
          pendingMounts.set(script, arr);
        }
      }
    }

    function buildMenu() {
      menu = createEl('nav', {
        id: 'settings-menu',
        className: 'settings-menu',
      });
      overlay = createEl('div', { className: 'settings-menu__overlay' });
      toggleBtn = createEl('button', {
        className: 'settings-menu__toggle',
        type: 'button',
        'aria-label': config.texts.open,
      });
      toggleBtn.innerHTML =
        '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
      const closeBtn = createEl('button', {
        className: 'settings-menu__close',
        type: 'button',
        'aria-label': config.texts.close,
      });
      closeBtn.innerHTML =
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

      toggleBtn.addEventListener('click', open);
      closeBtn.addEventListener('click', close);
      overlay.addEventListener('click', close);

      const frag = document.createDocumentFragment();
      Object.entries(config.sections || {}).forEach(([id, cfg], idx) => {
        const section = createEl('div', {
          className: 'settings-menu__section',
        });
        if (cfg.title) {
          const h = createEl('h3', { text: cfg.title });
          h.addEventListener('click', () => section.classList.toggle('open'));
          section.append(h);
        }
        const ul = createEl('ul');
        (cfg.items || []).forEach((it) => ul.append(renderItem(it)));
        section.append(ul);
        if (idx === 0) section.classList.add('open');
        frag.append(section);
        sectionMap.set(id, ul);
        mountSection(ul, cfg.mount);
      });

      menu.append(frag, closeBtn);
      document.body.append(toggleBtn, menu, overlay);
    }

    buildMenu();

    window.settingsMenu = api;
    helpers.register && helpers.register('settingsMenu', api);
  }

  bootstrap();
})();
