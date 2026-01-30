(() => {
  'use strict';

  const CFG = window.ScriptConfig?.copyPosts || {};
  const SETTINGS = {
    allowedForumIds: Array.isArray(CFG.allowedForumIds)
      ? CFG.allowedForumIds.map(String)
      : [],

    selectors: {
      singleInsertAfter:
        typeof CFG.selectors?.singleInsertAfter === 'string'
          ? CFG.selectors.singleInsertAfter
          : 'h3 strong',
      allInsertAfter:
        typeof CFG.selectors?.allInsertAfter === 'string'
          ? CFG.selectors.allInsertAfter
          : '#pun-main h1 span',
      postRoot:
        typeof CFG.selectors?.postRoot === 'string'
          ? CFG.selectors.postRoot
          : 'div.post',
      postAuthor:
        typeof CFG.selectors?.postAuthor === 'string'
          ? CFG.selectors.postAuthor
          : '.pa-author a',
      postContent:
        typeof CFG.selectors?.postContent === 'string'
          ? CFG.selectors.postContent
          : '.post-content',
      postSig:
        typeof CFG.selectors?.postSig === 'string'
          ? CFG.selectors.postSig
          : '.post-sig',
    },

    ui: {
      singleBtnLabel:
        typeof CFG.ui?.singleBtnLabel === 'string'
          ? CFG.ui.singleBtnLabel
          : '📋',
      allBtnLabel:
        typeof CFG.ui?.allBtnLabel === 'string' ? CFG.ui.allBtnLabel : '📄',
      singleBtnTitle:
        typeof CFG.ui?.singleBtnTitle === 'string'
          ? CFG.ui.singleBtnTitle
          : 'Скопировать этот пост',
      allBtnTitle:
        typeof CFG.ui?.allBtnTitle === 'string'
          ? CFG.ui.allBtnTitle
          : 'Скопировать все посты в теме',
      toastCloseLabel:
        typeof CFG.ui?.toastCloseLabel === 'string'
          ? CFG.ui.toastCloseLabel
          : 'Закрыть',

      warnHugeOne:
        typeof CFG.ui?.warnHugeOne === 'string'
          ? CFG.ui.warnHugeOne
          : 'Текст поста очень большой.',
      warnHugeAll:
        typeof CFG.ui?.warnHugeAll === 'string'
          ? CFG.ui.warnHugeAll
          : 'Текст всей темы очень большой.',
      copyFail:
        typeof CFG.ui?.copyFail === 'string'
          ? CFG.ui.copyFail
          : 'Не удалось скопировать в буфер обмена.',
      topicIdFail:
        typeof CFG.ui?.topicIdFail === 'string'
          ? CFG.ui.topicIdFail
          : 'Не удалось определить ID темы.',
      fetchFail:
        typeof CFG.ui?.fetchFail === 'string'
          ? CFG.ui.fetchFail
          : 'Не удалось получить данные о постах.',
      copiedOne:
        typeof CFG.ui?.copiedOne === 'string'
          ? CFG.ui.copiedOne
          : 'Пост скопирован в буфер обмена.',
      copiedAll:
        typeof CFG.ui?.copiedAll === 'string'
          ? CFG.ui.copiedAll
          : 'Весь текст темы скопирован.',
      actionDownload:
        typeof CFG.ui?.actionDownload === 'string'
          ? CFG.ui.actionDownload
          : 'Скачать .txt',
      actionCopyAnyway:
        typeof CFG.ui?.actionCopyAnyway === 'string'
          ? CFG.ui.actionCopyAnyway
          : 'Копировать всё равно',
    },

    limits: {
      clipboardSoftLimitBytes: Number.isFinite(
        CFG.limits?.clipboardSoftLimitBytes,
      )
        ? Number(CFG.limits.clipboardSoftLimitBytes)
        : 1_000_000,
      maxPages: Number.isFinite(CFG.limits?.maxPages)
        ? Number(CFG.limits.maxPages)
        : 200,
      pageLimit: Number.isFinite(CFG.limits?.pageLimit)
        ? Number(CFG.limits.pageLimit)
        : 100,
    },

    format: {
      joinSeparator:
        typeof CFG.format?.joinSeparator === 'string'
          ? CFG.format.joinSeparator
          : '\n\n---\n\n',
      fileNamePrefix:
        typeof CFG.format?.fileNamePrefix === 'string'
          ? CFG.format.fileNamePrefix
          : 'topic',
      titleMaxLen: Number.isFinite(CFG.format?.titleMaxLen)
        ? Number(CFG.format.titleMaxLen)
        : 80,
    },
  };

  const ALLOWED_FORUMS = new Set(SETTINGS.allowedForumIds);
  const TOPIC_ID = new URLSearchParams(location.search).get('id') || '';

  if (!window.FORUM || !ALLOWED_FORUMS.has(String(FORUM?.topic?.forum_id)))
    return;

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

  const showToast = (message, { type = 'info', duration = 3000 } = {}) => {
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<div class="toast__content">${message}</div><button class="toast__close" type="button" aria-label="${SETTINGS.ui.toastCloseLabel}">×</button>`;
    root.appendChild(el);
    const remove = () => el.isConnected && el.remove();
    el.querySelector('.toast__close')?.addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  };

  const showActionToast = (
    message,
    actions = [],
    { type = 'info', duration = 0 } = {},
  ) => {
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
      btn.className = `toast__btn ${
        a.variant ? `toast__btn--${a.variant}` : ''
      }`.trim();
      btn.textContent = a.label;
      btn.addEventListener('click', () => resolveAndRemove(a.value));
      actionsWrap.appendChild(btn);
    });

    root.appendChild(el);
    el.querySelector('.toast__close')?.addEventListener('click', () =>
      resolveAndRemove(null),
    );
    if (duration > 0) setTimeout(() => resolveAndRemove(null), duration);
    return p;
  };

  const enc = new TextEncoder();

  const htmlToPlain = (html) => {
    let raw = String(html)
      .replace(
        /\s*\[(?:block=hvmask|mask)][\s\S]*?\[\/(?:block|mask)]\s*/gi,
        '',
      )
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
    wrap
      .querySelectorAll('p')
      .forEach((p) => p.insertAdjacentText('afterend', '[[PARA]]'));
    wrap
      .querySelectorAll('li,blockquote,tr,td,th,h1,h2,h3,h4,h5,h6')
      .forEach((el) => el.insertAdjacentText('afterend', '[[BR]]'));

    let text = wrap.textContent || '';

    text = text
      .replace(
        /\s*\[(?:block=hvmask|mask)][\s\S]*?\[\/(?:block|mask)]\s*/gi,
        '',
      )
      .replace(/\[quote(?:=[^\]]+)?\][\s\S]*?\[\/quote\]/gi, '')
      .replace(/\[[a-z0-9]+(?:=[^\]]+)?\][\s\S]*?\[\/[a-z0-9]+\]/gi, '')
      .replace(/\[\[PARA\]\]/g, '\n')
      .replace(/\[\[BR\]\]/g, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/\[(?=[ \t\u00A0]*$)/gm, '')
      .replace(/(^|[ \t])\](?=[ \t]*$)/gm, '$1')
      .replace(/^[\[\]\s]+$/gm, '')
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

  const makeTopicFilename = () => {
    const id = TOPIC_ID || SETTINGS.format.fileNamePrefix;
    const title = (document.querySelector('#pun-main h1')?.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, SETTINGS.format.titleMaxLen)
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim();

    return title
      ? `${SETTINGS.format.fileNamePrefix}-${id} — ${title}.txt`
      : `${SETTINGS.format.fileNamePrefix}-${id}.txt`;
  };

  const fetchAllPosts = async (topicId) => {
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
    return all;
  };

  document.querySelectorAll(SETTINGS.selectors.postRoot).forEach((post) => {
    const anchor = SETTINGS.selectors.singleInsertAfter
      ? post.querySelector(SETTINGS.selectors.singleInsertAfter)
      : null;
    if (!anchor) return;
    if (post.querySelector('.copy-post-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-post-btn';
    btn.textContent = SETTINGS.ui.singleBtnLabel;
    btn.title = SETTINGS.ui.singleBtnTitle;

    btn.addEventListener('click', async () => {
      const author =
        post
          .querySelector(SETTINGS.selectors.postAuthor)
          ?.textContent?.trim() || 'Неизвестный автор';

      const src = post.querySelector(SETTINGS.selectors.postContent);
      let html = '';
      if (src) {
        const clone = src.cloneNode(true);
        clone.querySelector(SETTINGS.selectors.postSig)?.remove();
        html = clone.innerHTML;
      }

      const payload = `${author}:\n${htmlToPlain(html)}`;
      const bytes = enc.encode(payload).length;

      if (bytes > SETTINGS.limits.clipboardSoftLimitBytes) {
        const choice = await showActionToast(
          SETTINGS.ui.warnHugeOne,
          [
            {
              label: SETTINGS.ui.actionDownload,
              value: 'download',
              variant: 'primary',
            },
            { label: SETTINGS.ui.actionCopyAnyway, value: 'copy' },
          ],
          { type: 'warning' },
        );
        if (choice === 'download')
          return downloadTxt(payload, makeTopicFilename());
      }

      const ok = await copyToClipboard(payload);
      if (ok) {
        showToast(SETTINGS.ui.copiedOne, { type: 'success' });
      } else {
        const choice = await showActionToast(
          SETTINGS.ui.copyFail,
          [
            {
              label: SETTINGS.ui.actionDownload,
              value: 'download',
              variant: 'primary',
            },
          ],
          { type: 'error' },
        );
        if (choice === 'download') downloadTxt(payload, makeTopicFilename());
      }
    });

    anchor.insertAdjacentElement('afterend', btn);
  });

  const allAnchor = SETTINGS.selectors.allInsertAfter
    ? document.querySelector(SETTINGS.selectors.allInsertAfter)
    : null;
  if (allAnchor && !document.querySelector('.copy-all-btn')) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'copy-all-btn';
    allBtn.textContent = SETTINGS.ui.allBtnLabel;
    allBtn.title = SETTINGS.ui.allBtnTitle;

    allBtn.addEventListener('click', async () => {
      if (!TOPIC_ID)
        return showToast(SETTINGS.ui.topicIdFail, { type: 'error' });

      try {
        const list = await fetchAllPosts(TOPIC_ID);
        const plain = list
          .map(
            (p) =>
              `${p.username || 'Неизвестный автор'}:\n${htmlToPlain(
                p.message || '',
              )}`,
          )
          .join(SETTINGS.format.joinSeparator);

        const bytes = enc.encode(plain).length;

        if (bytes > SETTINGS.limits.clipboardSoftLimitBytes) {
          const choice = await showActionToast(
            SETTINGS.ui.warnHugeAll,
            [
              {
                label: SETTINGS.ui.actionDownload,
                value: 'download',
                variant: 'primary',
              },
              { label: SETTINGS.ui.actionCopyAnyway, value: 'copy' },
            ],
            { type: 'warning' },
          );
          if (choice === 'download')
            return downloadTxt(plain, makeTopicFilename());
        }

        const ok = await copyToClipboard(plain);
        if (ok) {
          showToast(SETTINGS.ui.copiedAll, { type: 'success' });
        } else {
          const choice = await showActionToast(
            SETTINGS.ui.copyFail,
            [
              {
                label: SETTINGS.ui.actionDownload,
                value: 'download',
                variant: 'primary',
              },
            ],
            { type: 'error' },
          );
          if (choice === 'download') downloadTxt(plain, makeTopicFilename());
        }
      } catch {
        showToast(SETTINGS.ui.fetchFail, { type: 'error' });
      }
    });

    allAnchor.insertAdjacentElement('afterend', allBtn);
  }
})();
