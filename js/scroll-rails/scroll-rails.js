(() => {
  'use strict';
  const upScrollButton = document.querySelector('.scroll-rail.rail-up');
  const downScrollButton = document.querySelector('.scroll-rail.rail-down');
  const rootDocument = document.documentElement;

  const smoothScrollTo = (position) =>
    window.scrollTo({ top: position, behavior: 'smooth' });

  upScrollButton.addEventListener('click', (event) => {
    event.preventDefault();
    smoothScrollTo(0);
  });

  downScrollButton.addEventListener('click', (event) => {
    event.preventDefault();
    smoothScrollTo(rootDocument.scrollHeight);
  });

  let ticking = false;

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

  document.addEventListener('DOMContentLoaded', () => {
    updateScrollButtons();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  });
})();
