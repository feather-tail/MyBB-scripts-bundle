(() => {
  'use strict';

  const { $$, countGraphemes } = window.helpers;
  const CFG = window.ScriptConfig.replyCharCounter;
  const { selectors: SELECTORS, options: OPTIONS } = CFG;

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
    box.innerHTML = `
      <span class="reply-char-counter-label">Символов напечатано: </span>
      <span class="reply-char-counter-value">0</span>
    `;
    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(box, afterEl.nextSibling);
    } else if (beforeEl && beforeEl.parentNode) {
      beforeEl.parentNode.insertBefore(box, beforeEl);
    }
    return $$('.reply-char-counter-value', box)[0];
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

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

  helpers.ready(init);
})();
