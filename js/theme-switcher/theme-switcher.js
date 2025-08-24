(() => {
  'use strict';

  const { $, $$ } = window.helpers;
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
    switcherContainer.innerHTML = config.themes
      .map(
        (t) =>
          `<li title="${t.title}">
        <span class="radio">
          <input type="radio" name="switcher" id="theme-${t.class}" value="${t.class}">
          <label for="theme-${t.class}">${t.title}</label>
        </span>
      </li>`,
      )
      .join('');
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
    switcherContainer = $('#theme_switcher');
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
