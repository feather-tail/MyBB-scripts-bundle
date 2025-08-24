(() => {
  'use strict';

  const helpers = window.helpers;
  const { $ } = helpers;
  const config = helpers.getConfig('scrollRails', {});

  let upScrollButton;
  let downScrollButton;
  let rootDocument;
  let ticking = false;

  const smoothScrollTo = (position) =>
    window.scrollTo({ top: position, behavior: 'smooth' });

  function updateScrollButtons() {
    const scrollY = window.scrollY;
    const maxScroll = rootDocument.scrollHeight - window.innerHeight;

    upScrollButton.classList.toggle('hidden', scrollY <= config.edgeOffset);
    downScrollButton.classList.toggle(
      'hidden',
      scrollY >= maxScroll - config.edgeOffset,
    );

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollButtons);
    }
  }

  function init() {
    upScrollButton = $(config.classes.up);
    downScrollButton = $(config.classes.down);
    rootDocument = document.documentElement;
    if (!upScrollButton || !downScrollButton) return;

    upScrollButton.addEventListener('click', (event) => {
      event.preventDefault();
      smoothScrollTo(0);
    });

    downScrollButton.addEventListener('click', (event) => {
      event.preventDefault();
      smoothScrollTo(rootDocument.scrollHeight);
    });

    updateScrollButtons();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  helpers.runOnceOnReady(init);
  helpers.register('scrollRails', { init });
})();
