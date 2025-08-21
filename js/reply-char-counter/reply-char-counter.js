(() => {
  'use strict';

  const SELECTORS = {
    textarea: '#main-reply',
    insertAfter: '',
    defaultBefore: '.formsubmit',
  };

  const OPTIONS = {
    stripMaskBBCode: true,
    useGraphemeCounter: true,
    watchProgrammaticChanges: true,
  };

  const countGraphemes = (str) => {
    if (OPTIONS.useGraphemeCounter && window.Intl?.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      let n = 0;
      for (const _ of seg.segment(str)) n++;
      return n;
    }
    return Array.from(str).length;
  };

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
    return box.querySelector('.reply-char-counter-value');
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const ta = document.querySelector(SELECTORS.textarea);
    const defaultBefore = document.querySelector(SELECTORS.defaultBefore);
    const after = SELECTORS.insertAfter
      ? document.querySelector(SELECTORS.insertAfter)
      : null;
    if (!ta || !defaultBefore) return;

    const valueEl = insertCounter(after, defaultBefore);
    if (!valueEl) return;

    let lastValue = ta.value;

    const update = () => {
      const clean = sanitize(ta.value);
      valueEl.textContent = countGraphemes(clean);
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

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
