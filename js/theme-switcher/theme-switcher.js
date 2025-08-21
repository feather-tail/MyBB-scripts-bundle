(() => {
  'use strict';

  const THEMES = [
    { class: 'CLASS_NAME_1', title: 'NAME_1' },
    { class: 'CLASS_NAME_2', title: 'NAME_2' },
    { class: 'CLASS_NAME_3', title: 'NAME_3' },
  ];

  const STORAGE_KEY = 'selectedTheme';
  const switcherContainer = document.getElementById('theme_switcher');

  function applyTheme(theme) {
    document.documentElement.classList.remove(...THEMES.map((t) => t.class));
    document.documentElement.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function renderThemeSwitcher() {
    switcherContainer.innerHTML = THEMES.map(
      (t) =>
        `<li title="${t.title}">
        <span class="radio">
          <input type="radio" name="switcher" id="theme-${t.class}" value="${t.class}">
          <label for="theme-${t.class}">${t.title}</label>
        </span>
      </li>`,
    ).join('');
  }

  function restoreTheme() {
    const saved = localStorage.getItem(STORAGE_KEY) || THEMES[0].class;
    applyTheme(saved);
    const radio = switcherContainer.querySelector(`[value="${saved}"]`);
    if (radio) radio.checked = true;
  }

  switcherContainer.addEventListener('change', (e) => {
    if (e.target.name === 'switcher') {
      applyTheme(e.target.value);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderThemeSwitcher();
    restoreTheme();
  });
})();
