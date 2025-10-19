(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('fontResizer', {});

  const getStoredSize = () => {
    const v = parseInt(localStorage.getItem(config.storageKey), 10);
    return !isNaN(v) && v >= config.minSize && v <= config.maxSize
      ? v
      : config.defaultSize;
  };
  const storeSize = (size) => localStorage.setItem(config.storageKey, size);
  const applySize = (size) => {
    const fontSize = size + 'px';
    $$(config.fontSelector).forEach((el) => {
      el.style.fontSize = fontSize;
      if (!el.matches('p')) {
        $$('p', el).forEach((p) => {
          p.style.fontSize = fontSize;
        });
      }
    });
  };

  const createControl = (currentSize) => {
    const wrapper = createEl('div');
    wrapper.className = 'font-resizer';
    const btnDecrease = createEl('button');
    btnDecrease.type = 'button';
    btnDecrease.className = 'decrease';
    btnDecrease.setAttribute('aria-label', 'Уменьшить шрифт');
    btnDecrease.textContent = 'A−';

    const btnReset = createEl('button');
    btnReset.type = 'button';
    btnReset.className = 'reset';
    btnReset.setAttribute('aria-label', 'Сбросить размер');
    btnReset.textContent = 'A';

    const btnIncrease = createEl('button');
    btnIncrease.type = 'button';
    btnIncrease.className = 'increase';
    btnIncrease.setAttribute('aria-label', 'Увеличить шрифт');
    btnIncrease.textContent = 'A+';

    const slider = createEl('input');
    slider.type = 'range';
    slider.className = 'slider';
    slider.min = config.minSize;
    slider.max = config.maxSize;
    slider.value = currentSize;
    slider.setAttribute('aria-label', 'Размер шрифта');

    wrapper.append(btnDecrease, btnReset, btnIncrease, slider);
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

  helpers.runOnceOnReady(init);
  helpers.register('fontResizer', { init });
})();
