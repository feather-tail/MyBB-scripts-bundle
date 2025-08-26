(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, $$ } = helpers;
  const config = helpers.getConfig('cursorManager', {
    containerSelector: '#pun-crumbs1',
    storageKey: 'selectedCursor',
    cursors: [],
  });

  function applyCursor(value) {
    document.documentElement.style.cursor = value || '';
  }

  function init() {
    const saved = localStorage.getItem(config.storageKey);
    if (saved) applyCursor(saved);

    const container = document.querySelector(config.containerSelector);
    if (!container || !Array.isArray(config.cursors) || !config.cursors.length)
      return;

    const wrapper = createEl('div', { className: 'cursor-manager' });
    const list = createEl('ul');

    config.cursors.forEach((cur) => {
      const li = createEl('li', { title: cur.title, dataset: { id: cur.id } });
      li.style.cursor = cur.value;
      if (saved === cur.value) li.classList.add('active');
      li.addEventListener('click', () => {
        applyCursor(cur.value);
        localStorage.setItem(config.storageKey, cur.value);
        $$('.cursor-manager li', wrapper).forEach((el) =>
          el.classList.toggle('active', el === li),
        );
      });
      list.append(li);
    });

    wrapper.append(list);
    container.append(wrapper);
  }

  helpers.runOnceOnReady(init);
  helpers.register('cursorManager', { init });
})();
