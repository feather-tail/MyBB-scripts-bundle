(() => {
  'use strict';

  const SPEED_PX_PER_SEC = 20;
  const PAUSE_MS = 1500;
  const SELECTOR = '.banners_bottom';

  function initVerticalBannerScroller(rootSelector = SELECTOR) {
    const root = document.querySelector(rootSelector);
    if (!root) return;

    let inner = root.querySelector('.banners_bottom-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'banners_bottom-inner';

      while (root.firstChild) {
        inner.appendChild(root.firstChild);
      }
      root.appendChild(inner);
    }

    let maxScroll = Math.max(0, inner.scrollHeight - root.clientHeight);
    if (!maxScroll) return;

    let pos = 0;
    let direction = 1;
    let lastTimestamp = performance.now();
    let isPaused = false;
    let pauseUntil = 0;
    let userPaused = false;

    root.addEventListener('mouseenter', () => {
      userPaused = true;
    });

    root.addEventListener('mouseleave', () => {
      userPaused = false;
      lastTimestamp = performance.now();
    });

    window.addEventListener('resize', () => {
      maxScroll = Math.max(0, inner.scrollHeight - root.clientHeight);
      if (pos > maxScroll) pos = maxScroll;
      inner.style.transform = `translateY(${-pos}px)`;
    });

    function update(timestamp) {
      if (userPaused) {
        lastTimestamp = timestamp;
        requestAnimationFrame(update);
        return;
      }

      if (isPaused) {
        if (timestamp >= pauseUntil) {
          isPaused = false;
          lastTimestamp = timestamp;
        }
      } else {
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        pos += direction * SPEED_PX_PER_SEC * dt;

        if (pos < 0) {
          pos = 0;
          direction = 1;
          isPaused = true;
          pauseUntil = timestamp + PAUSE_MS;
        }

        if (pos > maxScroll) {
          pos = maxScroll;
          direction = -1;
          isPaused = true;
          pauseUntil = timestamp + PAUSE_MS;
        }

        inner.style.transform = `translateY(${-pos}px)`;
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      initVerticalBannerScroller(),
    );
  } else {
    initVerticalBannerScroller();
  }
})();
