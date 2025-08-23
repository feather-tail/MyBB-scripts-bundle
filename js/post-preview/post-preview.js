(() => {
  'use strict';

  const { $, $$, setCookie, getCookie, debounce } = window.helpers;
  const CFG = helpers.getConfig('postPreview', {});

  const fid = Number(window.FORUM?.get('topic.forum_id'));
  if (!CFG.allowedForums.includes(fid)) return;

  const form = $('#post-form form#post');
  if (!form) return;
  const ta = $('#main-reply, textarea[name="req_message"]', form);
  const previewBtn = $('input.button.preview', form);
  if (!ta || !previewBtn) return;

  const getPreviewBox = () => $('#post-preview', form) || $('#post-preview');
  const getPostContent = () => $('.post-content', getPreviewBox()) || null;
  const previewBoxInit = getPreviewBox();
  if (!previewBoxInit) return;

  const wrap = document.createElement('label');
  wrap.style.marginLeft = '8px';
  wrap.innerHTML = `<input type="checkbox" id="autoPreviewToggle"> Автопревью`;
  const checkbox = $('input', wrap);

  if (getCookie(CFG.toggleCookie) === 'OFF') {
    checkbox.checked = false;
    const pc = getPostContent();
    if (pc) pc.innerHTML = '';
    getPreviewBox().style.display = 'none';
  } else {
    checkbox.checked = true;
  }

  checkbox.addEventListener('change', () => {
    const box = getPreviewBox();
    const pc = getPostContent();

    if (checkbox.checked) {
      setCookie(CFG.toggleCookie, '', -1);
      if (ta.value.trim()) {
        previewBtn.click();
      } else {
        if (box) box.style.display = 'none';
        if (pc) pc.innerHTML = '';
      }
    } else {
      setCookie(CFG.toggleCookie, 'OFF', 30);
      if (box) box.style.display = 'none';
      if (pc) pc.innerHTML = '';
    }
  });

  const insertInto = (el) => el?.append(wrap);
  const desiredSel = CFG.toggleInsertAfter || '#form-buttons';
  const desiredNow = $(desiredSel) || $('#form-buttons', form);

  if (desiredNow) {
    insertInto(desiredNow);
  } else {
    const obs = new MutationObserver((_m, o) => {
      const el = $(desiredSel);
      if (el) {
        insertInto(el);
        o.disconnect();
        clearTimeout(fallbackTimer);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const fallbackTimer = setTimeout(() => {
      if (!wrap.isConnected) insertInto($('#form-buttons', form));
    }, CFG.checkInterval);
  }

  const firePreview = () => {
    if (!checkbox.checked) return;
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

  ta.addEventListener('input', debounce(firePreview, CFG.debounceDelay));
})();
