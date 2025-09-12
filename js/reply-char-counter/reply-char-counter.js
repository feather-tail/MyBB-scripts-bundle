(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$, countGraphemes, createEl } = helpers;
  const config = helpers.getConfig('replyCharCounter', {});
  const { selectors: SELECTORS, options: OPTIONS } = config;
  const STORAGE_KEY = config.storageKey || 'replyCharCounterToggle';
  const TOGGLE_LABEL = config.toggleLabel || 'Счётчик символов в ответе';
  const SETTINGS_SECTION = config.settingsMenuSection || '';

  const stripMaskBlocks = (s) => s.replace(/\[mask\b[\s\S]*?\[\/mask\]/gi, '');

  const stripBBCodeTags = (s) =>
    s.replace(/\[(\/?)[^\]\s=]+(?:=[^\]]+)?\]/g, '');

  const normalizeSpaces = (s) => s.replace(/\s+/g, ' ').trim();

  const sanitize = (raw) => {
    let t = String(raw || '');
    if (OPTIONS.stripMaskBBCode) t = stripMaskBlocks(t);
    t = stripBBCodeTags(t);
    return normalizeSpaces(t);
  };

  const insertCounter = (afterEl, beforeEl) => {
    const box = createEl('div', { className: 'reply-char-counter' });
    const label = createEl('span', {
      className: 'reply-char-counter-label',
      text: 'Символов напечатано: ',
    });
    const value = createEl('span', {
      className: 'reply-char-counter-value',
      text: '0',
    });
    box.append(label, value);

    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(box, afterEl.nextSibling);
    } else if (beforeEl && beforeEl.parentNode) {
      beforeEl.parentNode.insertBefore(box, beforeEl);
    }
    return value;
  };

  const isEnabled = () => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v !== '0';
    } catch {
      return true;
    }
  };

  const saveState = (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {}
  };

  let teardown = null;

  const removeCounter = () => {
    if (teardown) {
      teardown();
    } else {
      $$('.reply-char-counter').forEach((n) => n.remove());
    }
  };

  const applyCounter = () => {
    if (teardown) return; // already applied

    const [ta] = $$(SELECTORS.textarea);
    const [defaultBefore] = $$(SELECTORS.defaultBefore);
    const after = SELECTORS.insertAfter ? $$(SELECTORS.insertAfter)[0] : null;
    if (!ta || !defaultBefore) return;

    const valueEl = insertCounter(after, defaultBefore);
    if (!valueEl) return;

    let lastValue = ta.value;

    const update = () => {
      const clean = sanitize(ta.value);
      const length = OPTIONS.useGraphemeCounter
        ? countGraphemes(clean)
        : clean.length;
      valueEl.textContent = length;
      lastValue = ta.value;
    };

    const offs = [];
    const on = (el, evt, fn) => {
      el.addEventListener(evt, fn, { passive: true });
      offs.push(() => el.removeEventListener(evt, fn));
    };

    on(ta, 'input', update);
    on(ta, 'keyup', update);
    on(ta, 'paste', () => setTimeout(update, 0));
    on(ta, 'cut', () => setTimeout(update, 0));

    const form = ta.closest('form');
    if (form) on(form, 'reset', () => setTimeout(update, 0));

    let loopId = null;
    if (OPTIONS.watchProgrammaticChanges) {
      const loop = () => {
        if (ta.value !== lastValue) update();
        loopId = requestAnimationFrame(loop);
      };
      loopId = requestAnimationFrame(loop);
    }

    update();

    teardown = () => {
      offs.forEach((fn) => fn());
      if (loopId !== null) cancelAnimationFrame(loopId);
      valueEl.parentElement?.remove();
      teardown = null;
    };
  };

  function init() {
    if (isEnabled()) applyCounter();
    else removeCounter();
  }

  function renderToggle(container) {
    const label = createEl('label');
    const cb = createEl('input', { type: 'checkbox' });
    cb.checked = isEnabled();
    label.append(cb, document.createTextNode(' ' + TOGGLE_LABEL));
    cb.addEventListener('change', () => {
      const on = cb.checked;
      saveState(on);
      if (on) applyCounter();
      else removeCounter();
    });
    if (container) container.append(label);
    return label;
  }

  function initSection(list) {
    if (!list) return;
    const li = createEl('li');
    renderToggle(li);
    list.insertBefore(li, list.children[3] || null);
  }

  function initToggle() {
    if (SETTINGS_SECTION) {
      const tryRegister = () => {
        if (window.settingsMenu?.registerSection) {
          window.settingsMenu.registerSection(SETTINGS_SECTION, initSection);
          clearInterval(timer);
        }
      };
      const timer = window.settingsMenu?.registerSection
        ? null
        : setInterval(tryRegister, 100);
      tryRegister();
    }
    if (config.toggleInsertAfter) {
      const anchor = document.querySelector(config.toggleInsertAfter);
      if (anchor) anchor.insertAdjacentElement('afterend', renderToggle());
    }
  }

  helpers.runOnceOnReady(init);
  helpers.runOnceOnReady(initToggle);
  helpers.register('replyCharCounter', { init, initToggle, initSection });
})();
