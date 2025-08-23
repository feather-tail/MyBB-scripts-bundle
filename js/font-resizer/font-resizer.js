(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const config = helpers.getConfig('fontResizer', {});

  const getStoredSize = () => {
    const v = parseInt(localStorage.getItem(config.storageKey), 10);
    return !isNaN(v) && v >= config.minSize && v <= config.maxSize
      ? v
      : config.defaultSize;
  };
  const storeSize = (size) => localStorage.setItem(config.storageKey, size);
  const applySize = (size) => {
    $$(config.fontSelector).forEach((el) => {
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
             min="${config.minSize}" max="${config.maxSize}"
             value="${currentSize}"
             aria-label="Размер шрифта">
    `;
    return wrapper;
  };

  function init() {
    const initialSize = getStoredSize();
    applySize(initialSize);

    let anchor = config.insertAfterSelector
      ? $(config.insertAfterSelector)
      : null;
    if (!anchor) anchor = $(config.defaultAnchorSelector);
    if (!anchor) return;

    const control = createControl(initialSize);
    anchor.after(control);

    const slider = $('.slider', control);
    const btnDecrease = $('.decrease', control);
    const btnIncrease = $('.increase', control);
    const btnReset = $('.reset', control);

    btnDecrease.addEventListener('click', () => {
      let s = Math.max(config.minSize, +slider.value - 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnIncrease.addEventListener('click', () => {
      let s = Math.min(config.maxSize, +slider.value + 1);
      slider.value = s;
      applySize(s);
      storeSize(s);
    });
    btnReset.addEventListener('click', () => {
      slider.value = config.defaultSize;
      applySize(config.defaultSize);
      storeSize(config.defaultSize);
    });
    slider.addEventListener('input', () => {
      const s = +slider.value;
      applySize(s);
      storeSize(s);
    });
  }

  helpers.ready(helpers.once(init));
})();
