(() => {
  'use strict';

  const FONT_SELECTOR = '.post-content, #main-reply';
  const STORAGE_KEY = 'postFontSize';
  const MIN_SIZE = 10;
  const MAX_SIZE = 38;
  const DEFAULT_SIZE = 14;
  const INSERT_AFTER_SELECTOR = '';
  const DEFAULT_ANCHOR_SELECTOR = '.post h3 strong';

  const getStoredSize = () => {
    const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return !isNaN(v) && v >= MIN_SIZE && v <= MAX_SIZE ? v : DEFAULT_SIZE;
  };
  const storeSize = (size) => localStorage.setItem(STORAGE_KEY, size);
  const applySize = (size) => {
    document.querySelectorAll(FONT_SELECTOR).forEach((el) => {
      el.style.fontSize = size + 'px';
    });
  };

  const createControl = (currentSize) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'font-resizer';
    wrapper.innerHTML = `
      <button type="button" class="decrease" aria-label="Уменьшить шрифт">A−</button>
      <button type="button" class="reset"    aria-label="Сбросить размер">A</button>
      <button type="button" class="increase" aria-label="Увеличить шрифт">A+</button>
      <input type="range" class="slider"
             min="${MIN_SIZE}" max="${MAX_SIZE}"
             value="${currentSize}"
             aria-label="Размер шрифта">
    `;
    return wrapper;
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const initialSize = getStoredSize();
    applySize(initialSize);

    let anchor = INSERT_AFTER_SELECTOR
      ? document.querySelector(INSERT_AFTER_SELECTOR)
      : null;
    if (!anchor) anchor = document.querySelector(DEFAULT_ANCHOR_SELECTOR);
    if (!anchor) return;

    const control = createControl(initialSize);
    anchor.after(control);

    const slider = control.querySelector('.slider');
    const btnDecrease = control.querySelector('.decrease');
    const btnIncrease = control.querySelector('.increase');
    const btnReset = control.querySelector('.reset');

    btnDecrease.addEventListener('click', () => {
      let s = Math.max(MIN_SIZE, +slider.value - 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnIncrease.addEventListener('click', () => {
      let s = Math.min(MAX_SIZE, +slider.value + 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnReset.addEventListener('click', () => {
      slider.value = DEFAULT_SIZE;
      applySize(DEFAULT_SIZE);
      storeSize(DEFAULT_SIZE);
    });
    slider.addEventListener('input', () => {
      const s = +slider.value;
      applySize(s);
      storeSize(s);
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
