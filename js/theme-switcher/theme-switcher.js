(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$ } = helpers;
  const config = helpers.getConfig('themeSwitcher', {
    themes: [],
    storageKey: 'theme',
  });
  const themeClasses = config.themes.length
    ? config.themes.map((t) => t.class)
    : [];

  function applyTheme(theme) {
    document.documentElement.classList.remove(...themeClasses);
    document.documentElement.classList.add(theme);
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
    localStorage.setItem(config.storageKey, theme);
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
      input.id = `theme-${t.class}`;
      input.value = t.class;

      const label = document.createElement('label');
      label.htmlFor = `theme-${t.class}`;
      label.textContent = t.title;

      span.append(input, label);
      li.append(span);
      fragment.appendChild(li);
    });
    container.appendChild(fragment);
  }

  function restoreTheme(container) {
    if (!config.themes.length) return;
    const saved = localStorage.getItem(config.storageKey);
    const exists = config.themes.some((t) => t.class === saved);
    const theme = exists ? saved : config.themes[0].class;
    if (!exists) {
      localStorage.setItem(config.storageKey, theme);
    }
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
        if (e.target.name === 'switcher') {
          applyTheme(e.target.value);
        }
      });
      ul.dataset.bound = '1';
    }
  }

  helpers.runOnceOnReady(() => {
    if (!config.themes.length) return;
    const saved =
      localStorage.getItem(config.storageKey) || config.themes[0].class;
    applyTheme(saved);
  });

  helpers.register('themeSwitcher', { initSection });
})();
