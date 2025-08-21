(() => {
  'use strict';

  const ALLOWED_FORUM_IDS = [2, 3];
  const ALLOWED_GROUP_IDS = new Set([1, 2, 4]);
  const INSERT_AFTER_SELECTOR = '';
  const DEFAULT_AFTER_SELECTOR = '.post-content';
  const MASK_SELECTORS = ['.post-mask', '.mask', '.pl-mask', '[data-mask]'];

  const STRIP_MASK_BBCODE = true;

  const countGraphemes = (str) => {
    if (window.Intl?.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      let n = 0;
      for (const _ of seg.segment(str)) n++;
      return n;
    }
    return Array.from(str).length;
  };

  const extractVisibleText = (postEl) => {
    const src = postEl.querySelector('.post-content');
    if (!src) return '';

    const clone = src.cloneNode(true);

    clone.querySelectorAll('.post-sig').forEach((n) => n.remove());

    MASK_SELECTORS.forEach((sel) =>
      clone.querySelectorAll(sel).forEach((n) => n.remove()),
    );

    let text = clone.textContent || '';

    if (STRIP_MASK_BBCODE) {
      text = text.replace(/\[mask\b[\s\S]*?\[\/mask\]/gi, '');
    }

    return text.replace(/\s+/g, ' ').trim();
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    if (typeof GroupID !== 'undefined' && !ALLOWED_GROUP_IDS.has(+GroupID))
      return;
    if (typeof FORUM === 'object' && typeof FORUM.get === 'function') {
      const fid = +FORUM.get('topic.forum_id');
      if (!ALLOWED_FORUM_IDS.includes(fid)) return;
    }

    document.querySelectorAll('.post:not(.topicpost)').forEach((post) => {
      if (post.querySelector('.posts-char-count-wrapper')) return;

      const anchor =
        (INSERT_AFTER_SELECTOR && post.querySelector(INSERT_AFTER_SELECTOR)) ||
        post.querySelector(DEFAULT_AFTER_SELECTOR);
      if (!anchor) return;

      const text = extractVisibleText(post);
      if (!text) return;

      const count = countGraphemes(text);

      const wrap = document.createElement('div');
      wrap.className = 'posts-char-count-wrapper';

      const box = document.createElement('div');
      box.className = 'posts-char-count';
      box.textContent = String(count);

      wrap.append(box);
      anchor.after(wrap);
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
