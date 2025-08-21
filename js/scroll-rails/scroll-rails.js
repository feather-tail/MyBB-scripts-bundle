(() => {
  'use strict';

  let upScrollButton;
  let downScrollButton;
  let rootDocument;
  let ticking = false;
  let initialized = false;

  const smoothScrollTo = (position) =>
    window.scrollTo({ top: position, behavior: 'smooth' });

  function updateScrollButtons() {
    const scrollY = window.scrollY;
    const maxScroll = rootDocument.scrollHeight - window.innerHeight;
    const edgeOffset = 80;

    upScrollButton.classList.toggle('hidden', scrollY <= edgeOffset);
    downScrollButton.classList.toggle(
      'hidden',
      scrollY >= maxScroll - edgeOffset,
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
    if (initialized) return;
    initialized = true;

    upScrollButton = document.querySelector('.scroll-rail.rail-up');
    downScrollButton = document.querySelector('.scroll-rail.rail-down');
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

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
