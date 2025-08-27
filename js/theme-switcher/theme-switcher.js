(() => {
  'use strict';

  function bootstrap() {
    const helpers = window.helpers;
    if (!helpers) {
      setTimeout(bootstrap, 25);
      return;
    }

    const { $$ } = helpers;
    const config = helpers.getConfig('themeSwitcher', {
      themes: [],
      storageKey: 'theme',
      insertAfterSelector: '#pun-crumbs1',
    });

    const themeClasses = [
      ...new Set(config.themes.flatMap((t) => t.class.split(/\s+/))),
    ];

    let currentTheme;

    function applyTheme(theme) {
      if (!theme || theme === currentTheme) return;
      if (themeClasses.length) {
        document.documentElement.classList.remove(...themeClasses);
      }
      theme
        .split(/\s+/)
        .forEach((c) => document.documentElement.classList.add(c));
      document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
      try {
        localStorage.setItem(config.storageKey, theme);
      } catch (_) {}
      currentTheme = theme;
    }

    function renderThemeSwitcher(container) {
      container.textContent = '';
      const fragment = document.createDocumentFragment();

      config.themes.forEach((t) => {
        const li = document.createElement('li');
        li.title = t.title;

        const span = document.createElement('span');
        span.className = 'radio';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'switcher';
        const safeClass = t.class.replace(/[^\w-]/g, '_');
        input.id = `theme-${safeClass}`;
        input.value = t.class;

        const label = document.createElement('label');
        label.htmlFor = `theme-${safeClass}`;
        label.textContent = t.title;

        span.append(input, label);
        li.append(span);
        fragment.appendChild(li);
      });

      container.appendChild(fragment);
    }

    function restoreTheme(container) {
      if (!config.themes.length) return;
      let saved = null;
      try {
        saved = localStorage.getItem(config.storageKey);
      } catch (_) {}
      const exists = config.themes.some((t) => t.class === saved);
      const theme = exists ? saved : config.themes[0].class;
      applyTheme(theme);
      $$("input[name='switcher']", container).forEach(
        (r) => (r.checked = r.value === theme),
      );
    }

    function initSection(ul) {
      if (!config.themes.length) return;
      renderThemeSwitcher(ul);
      restoreTheme(ul);

      if (!ul.dataset.bound) {
        ul.addEventListener('change', (e) => {
          if (e.target && e.target.name === 'switcher') {
            applyTheme(e.target.value);
          }
        });
        ul.dataset.bound = '1';
      }
    }

    function init() {
      if (!config.themes.length) return;

      let saved = null;
      try {
        saved = localStorage.getItem(config.storageKey);
      } catch (_) {}
      const exists = config.themes.some((t) => t.class === saved);
      const theme = exists ? saved : config.themes[0].class;
      applyTheme(theme);

      const smCfg = helpers.getConfig('settingsMenu', {});
      if (smCfg?.sections?.themes?.mount !== undefined) return;

      const ul = document.createElement('ul');
      ul.id = 'theme_switcher';

      const target = document.querySelector(config.insertAfterSelector);
      if (target) {
        target.insertAdjacentElement('afterend', ul);
      } else {
        document.body.appendChild(ul);
      }

      initSection(ul);
    }

    if (helpers.runOnceOnReady) {
      helpers.runOnceOnReady(init);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    helpers.register &&
      helpers.register('themeSwitcher', { init, initSection });
  }

  bootstrap();
})();
