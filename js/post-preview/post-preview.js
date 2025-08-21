(() => {
  const SETTINGS = {
    debounceDelay: 600,
    toggleCookie: '_PreviewToggle',
    allowedForums: [2, 5, 10],
    toggleInsertAfter: '#form-buttons',
    checkInterval: 800,
  };

  const fid = Number(window.FORUM?.get('topic.forum_id'));
  if (!SETTINGS.allowedForums.includes(fid)) return;

  const setCookie = (n, v, days) => {
    let e = '';
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 864e5);
      e = '; expires=' + d.toUTCString();
    }
    document.cookie = `${n}=${v || ''}${e}; path=/`;
  };
  const getCookie = (n) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? m[1] : null;
  };

  const form = document.querySelector('#post-form form#post');
  if (!form) return;
  const ta = form.querySelector('#main-reply, textarea[name="req_message"]');
  const previewBtn = form.querySelector('input.button.preview');
  if (!ta || !previewBtn) return;

  const getPreviewBox = () =>
    form.querySelector('#post-preview') ||
    document.querySelector('#post-preview');
  const getPostContent = () =>
    getPreviewBox()?.querySelector('.post-content') || null;
  const previewBoxInit = getPreviewBox();
  if (!previewBoxInit) return;

  const wrap = document.createElement('label');
  wrap.style.marginLeft = '8px';
  wrap.innerHTML = `<input type="checkbox" id="autoPreviewToggle"> Автопревью`;
  const checkbox = wrap.querySelector('input');

  if (getCookie(SETTINGS.toggleCookie) === 'OFF') {
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
      setCookie(SETTINGS.toggleCookie, '', -1);
      if (ta.value.trim()) {
        previewBtn.click();
      } else {
        if (box) box.style.display = 'none';
        if (pc) pc.innerHTML = '';
      }
    } else {
      setCookie(SETTINGS.toggleCookie, 'OFF', 30);
      if (box) box.style.display = 'none';
      if (pc) pc.innerHTML = '';
    }
  });

  const insertInto = (el) => el?.append(wrap);
  const desiredSel = SETTINGS.toggleInsertAfter || '#form-buttons';
  const desiredNow =
    document.querySelector(desiredSel) || form.querySelector('#form-buttons');

  if (desiredNow) {
    insertInto(desiredNow);
  } else {
    const obs = new MutationObserver((_m, o) => {
      const el = document.querySelector(desiredSel);
      if (el) {
        insertInto(el);
        o.disconnect();
        clearTimeout(fallbackTimer);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const fallbackTimer = setTimeout(() => {
      if (!wrap.isConnected) insertInto(form.querySelector('#form-buttons'));
    }, SETTINGS.checkInterval);
  }

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

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

  ta.addEventListener('input', debounce(firePreview, SETTINGS.debounceDelay));
})();
