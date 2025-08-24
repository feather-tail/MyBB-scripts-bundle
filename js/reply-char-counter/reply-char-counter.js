(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$, countGraphemes } = helpers;
  const config = helpers.getConfig('replyCharCounter', {});
  const { selectors: SELECTORS, options: OPTIONS } = config;

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
    const box = document.createElement('div');
    box.className = 'reply-char-counter';
    const label = document.createElement('span');
    label.className = 'reply-char-counter-label';
    label.textContent = 'Символов напечатано: ';

    const value = document.createElement('span');
    value.className = 'reply-char-counter-value';
    value.textContent = '0';

    box.append(label, value);

    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(box, afterEl.nextSibling);
    } else if (beforeEl && beforeEl.parentNode) {
      beforeEl.parentNode.insertBefore(box, beforeEl);
    }
    return value;
  };

  function init() {
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

    ta.addEventListener('input', update, { passive: true });
    ta.addEventListener('keyup', update, { passive: true });
    ta.addEventListener('paste', () => setTimeout(update, 0), {
      passive: true,
    });
    ta.addEventListener('cut', () => setTimeout(update, 0), { passive: true });

    const form = ta.closest('form');
    if (form)
      form.addEventListener(
        'reset',
        () => {
          setTimeout(update, 0);
        },
        { passive: true },
      );

    if (OPTIONS.watchProgrammaticChanges) {
      const loop = () => {
        if (ta.value !== lastValue) update();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    update();
  }

  helpers.runOnceOnReady(init);
  helpers.register('replyCharCounter', { init });
})();
