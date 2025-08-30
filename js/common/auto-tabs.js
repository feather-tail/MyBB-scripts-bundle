(() => {
  'use strict';
  let helpers;

  function init() {
    const { initTabs } = helpers;
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

  function bootstrap() {
    helpers = window.helpers;
    if (helpers) {
      if (helpers.runOnceOnReady) {
        helpers.runOnceOnReady(init);
      } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      if (helpers.register) {
        helpers.register('autoTabs', { init });
      }
    } else {
      setTimeout(bootstrap, 25);
    }
  }

  bootstrap();
})();
