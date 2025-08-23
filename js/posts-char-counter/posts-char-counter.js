(() => {
  'use strict';

  const { $, $$, createEl, countGraphemes } = window.helpers;

  const CFG = helpers.getConfig('postsCharCounter', {});
  const ALLOWED_FORUM_IDS = CFG.allowedForumIds || [2, 3];
  const SELECTORS = {
    posts: '.post:not(.topicpost)',
    insertAfter: '',
    defaultAfter: '.post-content',
    maskSelectors: ['.post-mask', '.mask', '.pl-mask', '[data-mask]'],
    ...(CFG.selectors || {}),
  };
  const FLAGS = { stripMaskBBCode: true, ...(CFG.flags || {}) };
  const ALLOWED_GROUP_IDS = new Set(CFG.allowedGroupIds || [1, 2, 4]);

  const extractVisibleText = (postEl) => {
    const src = $(SELECTORS.defaultAfter, postEl);
    if (!src) return '';

    const clone = src.cloneNode(true);

    $$('.post-sig', clone).forEach((n) => n.remove());

    SELECTORS.maskSelectors.forEach((sel) =>
      $$(sel, clone).forEach((n) => n.remove()),
    );

    let text = clone.textContent || '';

    if (FLAGS.stripMaskBBCode) {
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

    $$(SELECTORS.posts).forEach((post) => {
      if ($('.posts-char-count-wrapper', post)) return;

      const anchor =
        (SELECTORS.insertAfter && $(SELECTORS.insertAfter, post)) ||
        $(SELECTORS.defaultAfter, post);
      if (!anchor) return;

      const text = extractVisibleText(post);
      if (!text) return;

      const count = countGraphemes(text);

      const wrap = createEl('div', {
        className: 'posts-char-count-wrapper',
      });

      const box = createEl('div', {
        className: 'posts-char-count',
        text: String(count),
      });

      wrap.append(box);
      anchor.after(wrap);
    });
  }

  helpers.ready(init);
})();
