(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$ } = helpers;
  const config = helpers.getConfig('themeSwitcher', {});
  let switcherContainer;

  function applyTheme(theme) {
    document.documentElement.classList.remove(
      ...config.themes.map((t) => t.class),
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem(config.storageKey, theme);
  }

  function renderThemeSwitcher() {
    switcherContainer.textContent = '';
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
      switcherContainer.append(li);
    });
  }

  function restoreTheme() {
    const saved =
      localStorage.getItem(config.storageKey) || config.themes[0].class;
    applyTheme(saved);
    $$("input[name='switcher']", switcherContainer).forEach(
      (r) => (r.checked = r.value === saved),
    );
  }

  function init() {
    switcherContainer =
      window.settingsMenu?.getSection('themes') || $('#theme_switcher');
    if (!switcherContainer) return;

    renderThemeSwitcher();
    restoreTheme();

    switcherContainer.addEventListener('change', (e) => {
      if (e.target.name === 'switcher') {
        applyTheme(e.target.value);
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('themeSwitcher', { init });
})();
