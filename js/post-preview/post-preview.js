(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, debounce } = helpers;
  const config = helpers.getConfig('postPreview', {});

  const STORAGE_KEY =
    config.storageKey || config.toggleCookie || 'postPreviewToggle';
  const TOGGLE_LABEL = config.toggleLabel || 'Автопревью';
  const SETTINGS_SECTION = config.settingsMenuSection || '';

  let ta;
  let previewBtn;
  let getPreviewBox = () => null;
  let getPostContent = () => null;

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

  function renderToggle(container) {
    const label = createEl('label');
    const cb = createEl('input', { type: 'checkbox' });
    cb.checked = isEnabled();
    label.append(cb, document.createTextNode(' ' + TOGGLE_LABEL));
    cb.addEventListener('change', () => {
      const on = cb.checked;
      saveState(on);
      const box = getPreviewBox();
      const pc = getPostContent();
      if (on) {
        if (ta && previewBtn) {
          if (ta.value.trim()) {
            previewBtn.click();
          } else {
            if (box) box.style.display = 'none';
            if (pc) pc.innerHTML = '';
          }
        }
      } else {
        if (box) box.style.display = 'none';
        if (pc) pc.innerHTML = '';
      }
    });
    if (container) container.append(label);
    return label;
  }

  function initSection(list) {
    if (!list) return;
    const li = createEl('li');
    renderToggle(li);
    list.insertBefore(li, list.children[0] || null);
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
      return;
    }
    if (!config.toggleInsertAfter) return;
    const wrap = renderToggle();
    wrap.style.marginLeft = '8px';

    const insertInto = (el) => el?.append(wrap);
    const desiredSel = config.toggleInsertAfter || '#form-buttons';
    const desiredNow =
      document.querySelector(desiredSel) ||
      document.querySelector('#form-buttons');

    if (desiredNow) {
      insertInto(desiredNow);
    } else {
      const obs = new MutationObserver((_m, o) => {
        const el =
          document.querySelector(desiredSel) ||
          document.querySelector('#form-buttons');
        if (el) {
          insertInto(el);
          o.disconnect();
          clearTimeout(fallbackTimer);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      const fallbackTimer = setTimeout(() => {
        if (!wrap.isConnected)
          insertInto(document.querySelector('#form-buttons'));
      }, config.checkInterval);
    }
  }

  function init() {
    const fid = Number(window.FORUM?.get('topic.forum_id'));
    if (!config.allowedForums.includes(fid)) return;

    const form = $('#post-form form#post');
    if (!form) return;
    ta = $('#main-reply, textarea[name="req_message"]', form);
    previewBtn = $('input.button.preview', form);
    if (!ta || !previewBtn) return;

    getPreviewBox = () => $('#post-preview', form) || $('#post-preview');
    getPostContent = () => $('.post-content', getPreviewBox()) || null;
    const previewBoxInit = getPreviewBox();
    if (!previewBoxInit) return;

    const firePreview = () => {
      if (!isEnabled()) return;
      const txt = ta.value;
      const box = getPreviewBox();
      const pc = getPostContent();

      if (!txt.trim()) {
        if (box) box.style.display = 'none';
        if (pc) pc.innerHTML = '';
        return;
      }
      if (previewBtn.disabled) return;
      previewBtn.click();
    };

    if (isEnabled()) {
      firePreview();
    } else {
      const pc = getPostContent();
      if (pc) pc.innerHTML = '';
      previewBoxInit.style.display = 'none';
    }

    ta.addEventListener('input', debounce(firePreview, config.debounceDelay));
  }

  helpers.runOnceOnReady(init);
  helpers.runOnceOnReady(initToggle);
  helpers.register('postPreview', {
    init,
    initToggle,
    initSection,
    renderToggle,
  });
})();
