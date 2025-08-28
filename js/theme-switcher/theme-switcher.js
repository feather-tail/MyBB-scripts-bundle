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
      storageKey: 'selectedTheme',
      insertAfterSelector: '#pun-crumbs1',
    });

    const themeClasses = [
      ...new Set(
        config.themes.flatMap((t) =>
          t.className.trim().split(/\s+/).filter(Boolean),
        ),
      ),
    ];

    let currentTheme;
    let switcherCounter = 0;

    const switchers = new Map();

    document.addEventListener('themechange', (e) => {
      const theme = e.detail;
      switchers.forEach((prefix, container) => {
        $$(`input[name='${prefix}']`, container).forEach(
          (r) => (r.checked = r.value === theme),
        );
      });
    });

    function applyTheme(theme) {
      if (!theme || theme === currentTheme) return;
      if (themeClasses.length) {
        document.documentElement.classList.remove(...themeClasses);
      }
      theme
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => document.documentElement.classList.add(c));
      document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
      currentTheme = theme;
      try {
        localStorage.setItem(config.storageKey, theme);
      } catch (_) {}
    }

    function renderThemeSwitcher(container, prefix) {
      container.textContent = '';
      const fragment = document.createDocumentFragment();
      const uniquePrefix = prefix || container?.id || `ts${switcherCounter++}`;

      config.themes.forEach((t) => {
        const li = document.createElement('li');
        li.title = t.title;

        const span = document.createElement('span');
        span.className = 'radio';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = uniquePrefix;
        const safeClass = t.className.replace(/[^\w-]/g, '_');
        const id = `${uniquePrefix}-theme-${safeClass}`;
        input.id = id;
        input.value = t.className;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = t.title;

        span.append(input, label);
        li.append(span);
        fragment.appendChild(li);
      });

      container.appendChild(fragment);
      return uniquePrefix;
    }

    function getSavedTheme() {
      let saved = null;
      try {
        saved = localStorage.getItem(config.storageKey);
      } catch (_) {}
      const exists = config.themes.some((t) => t.className === saved);
      return exists ? saved : config.themes[0].className;
    }

    function restoreTheme(container, prefix) {
      if (!config.themes.length) return;
      const uniquePrefix = prefix || container?.id;
      const theme = getSavedTheme();
      applyTheme(theme);
      $$(`input[name='${uniquePrefix}']`, container).forEach(
        (r) => (r.checked = r.value === theme),
      );
    }

    function initSection(ul) {
      if (!config.themes.length) return;
      const uniquePrefix = renderThemeSwitcher(ul, ul.id);
      restoreTheme(ul, uniquePrefix);
      switchers.set(ul, uniquePrefix);

      if (!ul.dataset.bound) {
        ul.addEventListener('change', (e) => {
          if (
            e.target &&
            e.target.name === uniquePrefix &&
            e.target.value !== currentTheme
          ) {
            applyTheme(e.target.value);
          }
        });
        ul.dataset.bound = '1';
      }
    }

    function init() {
      if (!config.themes.length) return;

      const theme = getSavedTheme();
      applyTheme(theme);

      const smCfg = helpers.getConfig('settingsMenu', {});
      if (smCfg?.sections?.themes?.mount !== undefined) return;

      let ul = document.getElementById('theme_switcher');
      if (!ul) {
        ul = document.createElement('ul');
        ul.id = 'theme_switcher';

        const target = document.querySelector(config.insertAfterSelector);
        if (target) {
          target.insertAdjacentElement('afterend', ul);
        } else {
          document.body.appendChild(ul);
        }
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
