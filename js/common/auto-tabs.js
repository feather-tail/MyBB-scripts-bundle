(() => {
  'use strict';
  const helpers = window.helpers;
  const { initTabs, runOnceOnReady } = helpers;
  function init() {
    const containers = new Set();
    document.querySelectorAll('.modal__tabs').forEach((tabs) => {
      const container = tabs.parentElement;
      if (
        container &&
        container.querySelector('.modal__tab') &&
        container.querySelector('.modal__content')
      ) {
        containers.add(container);
      }
    });
    containers.forEach((c) =>
      initTabs(c, {
        tabSelector: '.modal__tab',
        contentSelector: '.modal__content',
        activeClass: 'active',
      }),
    );
  }
  runOnceOnReady(init);
  helpers.register('autoTabs', { init });
})();
