(() => {
  'use strict';

  const CFG = window.ScriptConfig?.copyPosts || {};

  const SETTINGS = {
    allowedForumIds: Array.isArray(CFG.allowedForumIds) ? CFG.allowedForumIds.map(String) : [],

    selectors: {
      topicRoot: typeof CFG.selectors?.topicRoot === 'string' ? CFG.selectors.topicRoot : '#pun-viewtopic, #pun-main',
      singleInsertAfter: typeof CFG.selectors?.singleInsertAfter === 'string' ? CFG.selectors.singleInsertAfter : 'h3 strong',
      allInsertAfter: typeof CFG.selectors?.allInsertAfter === 'string' ? CFG.selectors.allInsertAfter : '#pun-main h1 span',
      postRoot: typeof CFG.selectors?.postRoot === 'string' ? CFG.selectors.postRoot : 'div.post',
      postAuthor: typeof CFG.selectors?.postAuthor === 'string' ? CFG.selectors.postAuthor : '.pa-author a, .pa-author',
      postContent: typeof CFG.selectors?.postContent === 'string' ? CFG.selectors.postContent : '.post-content, .postmsg',
      postSig: typeof CFG.selectors?.postSig === 'string' ? CFG.selectors.postSig : '.post-sig',
      topicTitle: typeof CFG.selectors?.topicTitle === 'string' ? CFG.selectors.topicTitle : '#pun-main h1',
    },

    icons: {
      single: typeof CFG.icons?.single === 'string' ? CFG.icons.single : 'fa-solid fa-clipboard',
      all: typeof CFG.icons?.all === 'string' ? CFG.icons.all : 'fa-solid fa-file-lines',
    },

    ui: {
      singleBtnTitle: typeof CFG.ui?.singleBtnTitle === 'string' ? CFG.ui.singleBtnTitle : 'Скопировать этот пост',
      allBtnTitle: typeof CFG.ui?.allBtnTitle === 'string' ? CFG.ui.allBtnTitle : 'Скопировать все посты в теме',

      toastCloseLabel: typeof CFG.ui?.toastCloseLabel === 'string' ? CFG.ui.toastCloseLabel : 'Закрыть',
      copiedOne: typeof CFG.ui?.copiedOne === 'string' ? CFG.ui.copiedOne : 'Пост скопирован в буфер обмена.',
      done: typeof CFG.ui?.done === 'string' ? CFG.ui.done : 'Готово.',
      copyFail: typeof CFG.ui?.copyFail === 'string' ? CFG.ui.copyFail : 'Не удалось скопировать в буфер обмена.',
      topicIdFail: typeof CFG.ui?.topicIdFail === 'string' ? CFG.ui.topicIdFail : 'Не удалось определить ID темы.',
      fetchFail: typeof CFG.ui?.fetchFail === 'string' ? CFG.ui.fetchFail : 'Не удалось получить данные о постах.',

      modalTitle: typeof CFG.ui?.modalTitle === 'string' ? CFG.ui.modalTitle : 'Как скопировать тему?',
      modalCancel: typeof CFG.ui?.modalCancel === 'string' ? CFG.ui.modalCancel : 'Отмена',
      actionFileBB: typeof CFG.ui?.actionFileBB === 'string' ? CFG.ui.actionFileBB : 'В файл (BB-коды)',
      actionFilePlain: typeof CFG.ui?.actionFilePlain === 'string' ? CFG.ui.actionFilePlain : 'В файл (без BB-кодов)',
      actionClipBB: typeof CFG.ui?.actionClipBB === 'string' ? CFG.ui.actionClipBB : 'В буфер (BB-коды)',
      actionClipPlain: typeof CFG.ui?.actionClipPlain === 'string' ? CFG.ui.actionClipPlain : 'В буфер (без BB-кодов)',
    },

    limits: {
      maxPages: Number.isFinite(CFG.limits?.maxPages) ? Number(CFG.limits.maxPages) : 200,
      pageLimit: Number.isFinite(CFG.limits?.pageLimit) ? Number(CFG.limits.pageLimit) : 100,
      clipboardSoftLimitBytes: Number.isFinite(CFG.limits?.clipboardSoftLimitBytes) ? Number(CFG.limits.clipboardSoftLimitBytes) : 1_000_000,
    },

    format: {
      joinSeparator: typeof CFG.format?.joinSeparator === 'string' ? CFG.format.joinSeparator : '\n\n---\n\n',
      fileNamePrefix: typeof CFG.format?.fileNamePrefix === 'string' ? CFG.format.fileNamePrefix : 'topic',
      titleMaxLen: Number.isFinite(CFG.format?.titleMaxLen) ? Number(CFG.format.titleMaxLen) : 90,
    },

    cache: {
      ttlMs: Number.isFinite(CFG.cache?.ttlMs) ? Number(CFG.cache.ttlMs) : 120000,
    },
  };

  const ALLOWED_FORUMS = new Set(SETTINGS.allowedForumIds);
  const TOPIC_ID = new URLSearchParams(location.search).get('id') || '';

  if (!window.FORUM || !ALLOWED_FORUMS.has(String(FORUM?.topic?.forum_id))) return;

  const enc = new TextEncoder();
  const topicCache = new Map();

  const ensureToastRoot = () => {
    let root = document.querySelector('.toast-root');
    if (root) return root;
    root = document.createElement('div');
    root.className = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.appendChild(root);
    return root;
  };

  const showToast = (message, { type = 'info', duration = 2800 } = {}) => {
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<div class="toast__content">${message}</div><button class="toast__close" type="button" aria-label="${SETTINGS.ui.toastCloseLabel}">×</button>`;
    root.appendChild(el);
    const remove = () => el.isConnected && el.remove();
    el.querySelector('.toast__close')?.addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  };

  const showActionToast = (message, actions = [], { type = 'info', duration = 0 } = {}) => {
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = `toast toast--${type} toast--action`;
    el.innerHTML = `
      <div class="toast__content">${message}</div>
      <div class="toast__actions"></div>
      <button class="toast__close" type="button" aria-label="${SETTINGS.ui.toastCloseLabel}">×</button>`;
    const actionsWrap = el.querySelector('.toast__actions');
    let resolve;
    const p = new Promise((r) => (resolve = r));
    const cleanup = () => el.isConnected && el.remove();
    const resolveAndRemove = (val) => {
      resolve(val);
      cleanup();
    };

    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `toast__btn ${a.variant ? `toast__btn--${a.variant}` : ''}`.trim();
      btn.textContent = a.label;
      btn.addEventListener('click', () => resolveAndRemove(a.value));
      actionsWrap.appendChild(btn);
    });

    root.appendChild(el);
    el.querySelector('.toast__close')?.addEventListener('click', () => resolveAndRemove(null));
    if (duration > 0) setTimeout(() => resolveAndRemove(null), duration);
    return p;
  };

  const htmlToPlain = (html) => {
    let raw = String(html)
      .replace(/\s*\[(?:block=hvmask|mask)][\s\S]*?\[\/(?:block|mask)]\s*/gi, '')
      .replace(/\[quote(?:=[^\]]+)?\][\s\S]*?\[\/quote\]/gi, '');

    const wrap = document.createElement('div');
    wrap.innerHTML = raw;

    wrap.querySelectorAll('.quote-box, blockquote').forEach((q) => q.remove());
    wrap.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim() || href;
      a.textContent = `${text} (${href})`;
    });
    wrap.querySelectorAll('br').forEach((br) => br.replaceWith('[[BR]]'));
    wrap.querySelectorAll('p').forEach((p) => p.insertAdjacentText('afterend', '[[PARA]]'));
    wrap.querySelectorAll('li,blockquote,tr,td,th,h1,h2,h3,h4,h5,h6').forEach((el) => el.insertAdjacentText('afterend', '[[BR]]'));

    let text = wrap.textContent || '';
    text = text
      .replace(/\s*\[(?:block=hvmask|mask)][\s\S]*?\[\/(?:block|mask)]\s*/gi, '')
      .replace(/\[quote(?:=[^\]]+)?\][\s\S]*?\[\/quote\]/gi, '')
      .replace(/\[\[PARA\]\]/g, '\n')
      .replace(/\[\[BR\]\]/g, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00A0/g, '\uE000');

    const reEmpty = /^[ \t\uE000]*$/;
    const out = [];
    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/^[ \t]+/, '');
      if (reEmpty.test(line)) continue;
      out.push(line);
    }
    return out.join('\n').replace(/\uE000/g, ' ');
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  };

  const downloadTxt = (text, filename) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const cleanFileName = (name) => {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();
  };

  const getTopicTitle = () => {
    const domTitle = document.querySelector(SETTINGS.selectors.topicTitle)?.textContent?.trim() || '';
    const forumTitle = String(FORUM?.topic?.subject || '').trim();
    const title = domTitle || forumTitle || document.title || '';
    return cleanFileName(title).slice(0, SETTINGS.format.titleMaxLen);
  };

  const makeTopicFilename = ({ mode }) => {
    const id = TOPIC_ID || SETTINGS.format.fileNamePrefix;
    const title = getTopicTitle();
    const suffix = mode === 'bbcode' ? 'bbcode' : 'plain';
    const base = title ? `${SETTINGS.format.fileNamePrefix}-${id} — ${title}` : `${SETTINGS.format.fileNamePrefix}-${id}`;
    return `${base} (${suffix}).txt`;
  };

  const fetchAllPosts = async (topicId) => {
    const now = Date.now();
    const cached = topicCache.get(topicId);
    if (cached && now - cached.ts <= SETTINGS.cache.ttlMs && Array.isArray(cached.posts)) return cached.posts;

    const all = [];
    const limit = SETTINGS.limits.pageLimit;
    const maxPages = SETTINGS.limits.maxPages;

    for (let skip = 0, page = 0; page < maxPages; skip += limit, page++) {
      const url =
        `/api.php?method=post.get&topic_id=${encodeURIComponent(topicId)}` +
        `&limit=${limit}&skip=${skip}&fields=id,username,message,posted`;

      const res = await fetch(url);
      if (!res.ok) break;

      const data = await res.json().catch(() => ({}));
      const batch = Array.isArray(data?.response) ? data.response : [];
      if (!batch.length) break;

      all.push(...batch);
      if (batch.length < limit) break;
    }

    all.sort((a, b) => Number(a.posted || 0) - Number(b.posted || 0));
    topicCache.set(topicId, { ts: now, posts: all });
    return all;
  };

  const ensureModalStyles = () => {
    if (document.getElementById('ks-copy-modal-style')) return;
    const css = document.createElement('style');
    css.id = 'ks-copy-modal-style';
    css.textContent = `
      .ks-copy-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999}
      .ks-copy-modal[hidden]{display:none}
      .ks-copy-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
      .ks-copy-modal__panel{position:relative;max-width:520px;width:min(520px, calc(100vw - 32px));border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(20,20,20,.92);backdrop-filter: blur(10px);color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.55);padding:16px}
      .ks-copy-modal__title{margin:0 0 12px;font:700 16px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .ks-copy-modal__grid{display:grid;grid-template-columns:1fr;gap:10px}
      @media (min-width:520px){.ks-copy-modal__grid{grid-template-columns:1fr 1fr}}
      .ks-copy-modal__btn{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;transition:transform .12s ease,background-color .12s ease,border-color .12s ease}
      .ks-copy-modal__btn:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.28)}
      .ks-copy-modal__btn:active{transform:translateY(1px);background:rgba(255,255,255,.18)}
      .ks-copy-modal__footer{display:flex;justify-content:flex-end;margin-top:12px}
      .ks-copy-modal__cancel{appearance:none;-webkit-appearance:none;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;cursor:pointer;font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .ks-copy-modal__cancel:hover{background:rgba(255,255,255,.08)}
    `;
    document.head.appendChild(css);
  };

  const askAllCopyMode = () => {
    ensureModalStyles();

    let modal = document.getElementById('ks-copy-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ks-copy-modal';
      modal.className = 'ks-copy-modal';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="ks-copy-modal__backdrop" data-action="cancel"></div>
        <div class="ks-copy-modal__panel" role="dialog" aria-modal="true" aria-labelledby="ksCopyModalTitle">
          <h3 class="ks-copy-modal__title" id="ksCopyModalTitle"></h3>
          <div class="ks-copy-modal__grid">
            <button class="ks-copy-modal__btn" type="button" data-choice="file:bbcode"></button>
            <button class="ks-copy-modal__btn" type="button" data-choice="file:plain"></button>
            <button class="ks-copy-modal__btn" type="button" data-choice="clipboard:bbcode"></button>
            <button class="ks-copy-modal__btn" type="button" data-choice="clipboard:plain"></button>
          </div>
          <div class="ks-copy-modal__footer">
            <button class="ks-copy-modal__cancel" type="button" data-action="cancel"></button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const title = modal.querySelector('#ksCopyModalTitle');
    const btnFileBB = modal.querySelector('[data-choice="file:bbcode"]');
    const btnFilePlain = modal.querySelector('[data-choice="file:plain"]');
    const btnClipBB = modal.querySelector('[data-choice="clipboard:bbcode"]');
    const btnClipPlain = modal.querySelector('[data-choice="clipboard:plain"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const backdrop = modal.querySelector('.ks-copy-modal__backdrop');

    title.textContent = SETTINGS.ui.modalTitle;
    btnFileBB.textContent = SETTINGS.ui.actionFileBB;
    btnFilePlain.textContent = SETTINGS.ui.actionFilePlain;
    btnClipBB.textContent = SETTINGS.ui.actionClipBB;
    btnClipPlain.textContent = SETTINGS.ui.actionClipPlain;
    cancelBtn.textContent = SETTINGS.ui.modalCancel;

    modal.hidden = false;

    return new Promise((resolve) => {
      const finish = (val) => {
        modal.hidden = true;
        modal.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') finish(null);
      };

      const onClick = (e) => {
        const t = e.target;
        const choice = t?.getAttribute?.('data-choice');
        if (choice) {
          const [dest, mode] = choice.split(':');
          return finish({ dest, mode });
        }
        if (t === backdrop || t === cancelBtn) return finish(null);
      };

      modal.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
  };

  const setBtnIcon = (btn, iconClass) => {
    btn.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;
  };

  const ensureAllButton = () => {
    const allAnchor = SETTINGS.selectors.allInsertAfter ? document.querySelector(SETTINGS.selectors.allInsertAfter) : null;
    if (!allAnchor) return;
    if (document.querySelector('.copy-all-btn')) return;

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'copy-all-btn';
    allBtn.title = SETTINGS.ui.allBtnTitle;
    allBtn.setAttribute('aria-label', SETTINGS.ui.allBtnTitle);
    setBtnIcon(allBtn, SETTINGS.icons.all);

    allAnchor.insertAdjacentElement('afterend', allBtn);
  };

  const ensureSingleButton = (post) => {
    if (!post || !(post instanceof Element)) return;
    if (post.querySelector('.copy-post-btn')) return;

    const anchor = SETTINGS.selectors.singleInsertAfter ? post.querySelector(SETTINGS.selectors.singleInsertAfter) : null;
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-post-btn';
    btn.title = SETTINGS.ui.singleBtnTitle;
    btn.setAttribute('aria-label', SETTINGS.ui.singleBtnTitle);
    setBtnIcon(btn, SETTINGS.icons.single);

    anchor.insertAdjacentElement('afterend', btn);
  };

  const initPostsInRoot = (root) => {
    const posts = root.querySelectorAll ? root.querySelectorAll(SETTINGS.selectors.postRoot) : [];
    posts.forEach(ensureSingleButton);
    ensureAllButton();
  };

  const buildSinglePayload = (postEl) => {
    const author = postEl.querySelector(SETTINGS.selectors.postAuthor)?.textContent?.trim() || 'Неизвестный автор';
    const src = postEl.querySelector(SETTINGS.selectors.postContent);
    let html = '';
    if (src) {
      const clone = src.cloneNode(true);
      clone.querySelector(SETTINGS.selectors.postSig)?.remove();
      html = clone.innerHTML;
    }
    return `${author}:\n${htmlToPlain(html)}`;
  };

  const buildAllPayload = (posts, { mode }) => {
    if (mode === 'bbcode') {
      return posts
        .map((p) => `${p.username || 'Неизвестный автор'}:\n${String(p.message || '').trim()}`)
        .join(SETTINGS.format.joinSeparator);
    }
    return posts
      .map((p) => `${p.username || 'Неизвестный автор'}:\n${htmlToPlain(p.message || '')}`)
      .join(SETTINGS.format.joinSeparator);
  };

  const handleSingleCopy = async (btn) => {
    const post = btn.closest(SETTINGS.selectors.postRoot);
    if (!post) return;

    const payload = buildSinglePayload(post);
    const bytes = enc.encode(payload).length;

    if (bytes > SETTINGS.limits.clipboardSoftLimitBytes) {
      const choice = await showActionToast(
        'Текст поста очень большой.',
        [
          { label: 'Скачать .txt', value: 'download', variant: 'primary' },
          { label: 'Копировать всё равно', value: 'copy' },
        ],
        { type: 'warning' }
      );
      if (choice === 'download') return downloadTxt(payload, makeTopicFilename({ mode: 'plain' }));
    }

    const ok = await copyToClipboard(payload);
    if (ok) return showToast(SETTINGS.ui.copiedOne, { type: 'success' });

    const fallback = await showActionToast(
      SETTINGS.ui.copyFail,
      [{ label: 'Скачать .txt', value: 'download', variant: 'primary' }],
      { type: 'error' }
    );
    if (fallback === 'download') downloadTxt(payload, makeTopicFilename({ mode: 'plain' }));
  };

  const handleAllCopy = async () => {
    if (!TOPIC_ID) return showToast(SETTINGS.ui.topicIdFail, { type: 'error' });

    const choice = await askAllCopyMode();
    if (!choice) return;

    try {
      const posts = await fetchAllPosts(TOPIC_ID);
      const text = buildAllPayload(posts, { mode: choice.mode });

      if (choice.dest === 'clipboard') {
        const ok = await copyToClipboard(text);
        if (ok) return showToast(SETTINGS.ui.done, { type: 'success' });

        const fallback = await showActionToast(
          SETTINGS.ui.copyFail,
          [{ label: 'Скачать .txt', value: 'download', variant: 'primary' }],
          { type: 'error' }
        );
        if (fallback === 'download') downloadTxt(text, makeTopicFilename({ mode: choice.mode }));
        return;
      }

      downloadTxt(text, makeTopicFilename({ mode: choice.mode }));
      showToast(SETTINGS.ui.done, { type: 'success' });
    } catch {
      showToast(SETTINGS.ui.fetchFail, { type: 'error' });
    }
  };

  const onDelegatedClick = (e) => {
    const t = e.target;
    const singleBtn = t?.closest?.('.copy-post-btn');
    if (singleBtn) {
      e.preventDefault();
      e.stopPropagation();
      void handleSingleCopy(singleBtn);
      return;
    }
    const allBtn = t?.closest?.('.copy-all-btn');
    if (allBtn) {
      e.preventDefault();
      e.stopPropagation();
      void handleAllCopy();
    }
  };

  const mount = () => {
    const root = document.querySelector(SETTINGS.selectors.topicRoot) || document.body;
    initPostsInRoot(root);

    document.addEventListener('click', onDelegatedClick, true);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(SETTINGS.selectors.postRoot)) ensureSingleButton(node);
          node.querySelectorAll?.(SETTINGS.selectors.postRoot)?.forEach(ensureSingleButton);
          ensureAllButton();
        }
      }
    });

    mo.observe(root, { childList: true, subtree: true });
  };

  mount();
})();
