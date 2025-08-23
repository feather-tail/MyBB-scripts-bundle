(() => {
  'use strict';

  const { $, $$ } = window.helpers;
  const CFG = window.ScriptConfig.themeSwitcher;
  let switcherContainer;
  let initialized = false;

  function applyTheme(theme) {
    document.documentElement.classList.remove(
      ...CFG.themes.map((t) => t.class),
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem(CFG.storageKey, theme);
  }

  function renderThemeSwitcher() {
    switcherContainer.innerHTML = CFG.themes
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
    const saved = localStorage.getItem(CFG.storageKey) || CFG.themes[0].class;
    applyTheme(saved);
    $$("input[name='switcher']", switcherContainer).forEach(
      (r) => (r.checked = r.value === saved),
    );
  }

  function init() {
    if (initialized) return;
    initialized = true;

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

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
