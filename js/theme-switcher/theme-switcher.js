(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$ } = helpers;
  const config = helpers.getConfig('themeSwitcher', {});

  function applyTheme(theme) {
    document.documentElement.classList.remove(
      ...config.themes.map((t) => t.class),
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem(config.storageKey, theme);
  }

  function renderThemeSwitcher(container) {
    container.textContent = '';
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
      container.append(li);
    });
  }

  function restoreTheme(container) {
    const saved =
      localStorage.getItem(config.storageKey) || config.themes[0].class;
    applyTheme(saved);
    $$("input[name='switcher']", container).forEach(
      (r) => (r.checked = r.value === saved),
    );
  }

  function initSection(ul) {
    renderThemeSwitcher(ul);
    restoreTheme(ul);

    ul.addEventListener('change', (e) => {
      if (e.target.name === 'switcher') {
        applyTheme(e.target.value);
      }
    });
  }

  helpers.runOnceOnReady(() => {
    const saved =
      localStorage.getItem(config.storageKey) || config.themes[0].class;
    applyTheme(saved);
  });

  window.settingsMenu?.registerSection('themes', initSection);
  helpers.register('themeSwitcher', { initSection });
})();
