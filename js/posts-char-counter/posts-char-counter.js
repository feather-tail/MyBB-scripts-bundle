(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl, countGraphemes } = helpers;
  const config = helpers.getConfig('postsCharCounter', {});

  const ALLOWED_FORUM_IDS = config.allowedForumIds || [2, 3];
  const SELECTORS = {
    posts: '.post:not(.topicpost)',
    insertAfter: '',
    defaultAfter: '.post-content',
    maskSelectors: ['.post-mask', '.mask', '.pl-mask', '[data-mask]'],
    ...(config.selectors || {}),
  };
  const FLAGS = { stripMaskBBCode: true, ...(config.flags || {}) };
  const ALLOWED_GROUP_IDS = new Set(config.allowedGroupIds || [1, 2, 4]);

  const STORAGE_KEY = config.storageKey || 'postsCharCounterToggle';
  const TOGGLE_LABEL = config.toggleLabel || 'Счётчик символов в постах';
  const SETTINGS_SECTION = config.settingsMenuSection || '';

  let mo;

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

  const inAllowedGroup = () => {
    if (typeof GroupID !== 'undefined') return ALLOWED_GROUP_IDS.has(+GroupID);
    return true;
  };

  const getForumId = () => helpers.getForumId?.() ?? null;

  const inAllowedForum = () => {
    const fid = getForumId();
    if (fid === null) return false;
    return ALLOWED_FORUM_IDS.includes(Number(fid));
  };

  const removeCounters = () => {
    $$('.posts-char-count-wrapper').forEach((n) => n.remove());
  };

  const applyCounters = () => {
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
  };

  const tick = () => {
    if (!inAllowedGroup()) return removeCounters();
    if (!inAllowedForum()) return removeCounters();
    if (isEnabled()) applyCounters();
    else removeCounters();
  };

  function initObserver() {
    if (mo) return;
    try {
      mo = new MutationObserver((ml) => {
        if (!isEnabled()) return;
  
        for (const m of ml) {
          if (m.addedNodes && m.addedNodes.length) {
            tick();
            break;
          }
        }
      });
  
      mo.observe(document.body, { childList: true, subtree: true });
    } catch {}
  }

  function init() {
    tick();
    initObserver();
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) tick();
    });
  }

  function renderToggle(container) {
    const label = createEl('label');
    const cb = createEl('input', { type: 'checkbox' });
    cb.checked = isEnabled();
    label.append(cb, document.createTextNode(' ' + TOGGLE_LABEL));
    cb.addEventListener('change', () => {
      const on = cb.checked;
      saveState(on);
      tick();
    });
    if (container) container.append(label);
    return label;
  }

  function initSection(list) {
    if (!list) return;
    const li = createEl('li');
    renderToggle(li);
    list.insertBefore(li, list.children[2] || null);
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
  helpers.register('postsCharCounter', { init, initToggle, initSection });
})();
