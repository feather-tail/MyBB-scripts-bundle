(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const CFG = helpers.getConfig('fontResizer', {});

  const getStoredSize = () => {
    const v = parseInt(localStorage.getItem(CFG.storageKey), 10);
    return !isNaN(v) && v >= CFG.minSize && v <= CFG.maxSize
      ? v
      : CFG.defaultSize;
  };
  const storeSize = (size) => localStorage.setItem(CFG.storageKey, size);
  const applySize = (size) => {
    $$(CFG.fontSelector).forEach((el) => {
      el.style.fontSize = size + 'px';
    });
  };

  const createControl = (currentSize) => {
    const wrapper = createEl('div');
    wrapper.className = 'font-resizer';
    wrapper.innerHTML = `
      <button type="button" class="decrease" aria-label="Уменьшить шрифт">A−</button>
      <button type="button" class="reset"    aria-label="Сбросить размер">A</button>
      <button type="button" class="increase" aria-label="Увеличить шрифт">A+</button>
      <input type="range" class="slider"
             min="${CFG.minSize}" max="${CFG.maxSize}"
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

    let anchor = CFG.insertAfterSelector ? $(CFG.insertAfterSelector) : null;
    if (!anchor) anchor = $(CFG.defaultAnchorSelector);
    if (!anchor) return;

    const control = createControl(initialSize);
    anchor.after(control);

    const slider = $('.slider', control);
    const btnDecrease = $('.decrease', control);
    const btnIncrease = $('.increase', control);
    const btnReset = $('.reset', control);

    btnDecrease.addEventListener('click', () => {
      let s = Math.max(CFG.minSize, +slider.value - 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnIncrease.addEventListener('click', () => {
      let s = Math.min(CFG.maxSize, +slider.value + 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnReset.addEventListener('click', () => {
      slider.value = CFG.defaultSize;
      applySize(CFG.defaultSize);
      storeSize(CFG.defaultSize);
    });
    slider.addEventListener('input', () => {
      const s = +slider.value;
      applySize(s);
      storeSize(s);
    });
  }

  helpers.ready(init);
})();
