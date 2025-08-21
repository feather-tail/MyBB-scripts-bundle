(() => {
  'use strict';

  const CFG = window.ScriptConfig || {};
  const SETTINGS = {
    allowedForumIds: Array.isArray(CFG.allowedForumIds)
      ? CFG.allowedForumIds.map(String)
      : [],
    singleInsertAfterSelector:
      typeof CFG.singleInsertAfterSelector === 'string'
        ? CFG.singleInsertAfterSelector
        : 'h3 strong',
    allInsertAfterSelector:
      typeof CFG.allInsertAfterSelector === 'string'
        ? CFG.allInsertAfterSelector
        : '#pun-main h1 span',
    singleBtnLabel: '\uD83D\uDCCB',
    allBtnLabel: '\uD83D\uDCC4',
    clipboardSoftLimitBytes: 1_000_000,
    joinSeparator: '\n\n---\n\n',
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
    el.innerHTML = `<div class="toast__content">${message}</div><button class="toast__close" type="button" aria-label="Закрыть">\u00D7</button>`;
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
      <button class="toast__close" type="button" aria-label="Закрыть">\u00D7</button>`;
    const actionsWrap = el.querySelector('.toast__actions');
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
    let resolve;
    const p = new Promise((r) => (resolve = r));
    const cleanup = () => el.isConnected && el.remove();
    const resolveAndRemove = (val) => {
      resolve(val);
      cleanup();
    };
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

  const downloadTxt = (text, filename = 'topic.txt') => {
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
    const id = TOPIC_ID || 'topic';
    const title = (document.querySelector('#pun-main h1')?.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim();
    return title ? `topic-${id} — ${title}.txt` : `topic-${id}.txt`;
  };

  const fetchAllPosts = async (topicId) => {
    const all = [];
    const limit = 100;
    const maxPages = 200;
    for (let skip = 0, page = 0; page < maxPages; skip += limit, page++) {
      const url = `/api.php?method=post.get&topic_id=${encodeURIComponent(
        topicId,
      )}&limit=${limit}&skip=${skip}&fields=id,username,message,posted`;
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

  document.querySelectorAll('div.post').forEach((post) => {
    if (!SETTINGS.singleInsertAfterSelector) return;
    if (post.querySelector('.copy-post-btn')) return;
    const anchor = post.querySelector(SETTINGS.singleInsertAfterSelector);
    if (!anchor) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-post-btn';
    btn.textContent = SETTINGS.singleBtnLabel;
    btn.title = 'Скопировать этот пост';
    btn.addEventListener('click', async () => {
      const author =
        post.querySelector('.pa-author a')?.textContent?.trim() ||
        'Неизвестный автор';
      const src = post.querySelector('.post-content');
      let html = '';
      if (src) {
        const clone = src.cloneNode(true);
        clone.querySelector('.post-sig')?.remove();
        html = clone.innerHTML;
      }
      const payload = `${author}:\n${htmlToPlain(html)}`;
      const bytes = enc.encode(payload).length;
      if (bytes > SETTINGS.clipboardSoftLimitBytes) {
        const choice = await showActionToast(
          'Текст поста очень большой.',
          [
            { label: 'Скачать .txt', value: 'download', variant: 'primary' },
            { label: 'Копировать всё равно', value: 'copy' },
          ],
          { type: 'warning' },
        );
        if (choice === 'download')
          return downloadTxt(payload, makeTopicFilename());
      }
      const ok = await copyToClipboard(payload);
      if (ok) {
        showToast('Пост скопирован в буфер обмена.', { type: 'success' });
      } else {
        const choice = await showActionToast(
          'Не удалось скопировать в буфер обмена.',
          [{ label: 'Скачать .txt', value: 'download', variant: 'primary' }],
          { type: 'error' },
        );
        if (choice === 'download') downloadTxt(payload, makeTopicFilename());
      }
    });
    anchor.insertAdjacentElement('afterend', btn);
  });

  const allAnchor = SETTINGS.allInsertAfterSelector
    ? document.querySelector(SETTINGS.allInsertAfterSelector)
    : null;
  if (allAnchor && !document.querySelector('.copy-all-btn')) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'copy-all-btn';
    allBtn.textContent = SETTINGS.allBtnLabel;
    allBtn.title = 'Скопировать все посты в теме';
    allBtn.addEventListener('click', async () => {
      const topicId = TOPIC_ID;
      if (!topicId)
        return showToast('Не удалось определить ID темы.', { type: 'error' });
      try {
        const list = await fetchAllPosts(topicId);
        const plain = list
          .map(
            (p) =>
              `${p.username || 'Неизвестный автор'}:\n${htmlToPlain(
                p.message || '',
              )}`,
          )
          .join(SETTINGS.joinSeparator);
        const bytes = enc.encode(plain).length;
        if (bytes > SETTINGS.clipboardSoftLimitBytes) {
          const choice = await showActionToast(
            'Текст всей темы очень большой.',
            [
              { label: 'Скачать .txt', value: 'download', variant: 'primary' },
              { label: 'Копировать всё равно', value: 'copy' },
            ],
            { type: 'warning' },
          );
          if (choice === 'download')
            return downloadTxt(plain, makeTopicFilename());
        }
        const ok = await copyToClipboard(plain);
        if (ok) {
          showToast('Весь текст темы скопирован.', { type: 'success' });
        } else {
          const choice = await showActionToast(
            'Не удалось скопировать в буфер обмена.',
            [{ label: 'Скачать .txt', value: 'download', variant: 'primary' }],
            { type: 'error' },
          );
          if (choice === 'download') downloadTxt(plain, makeTopicFilename());
        }
      } catch {
        showToast('Не удалось получить данные о постах.', { type: 'error' });
      }
    });
    allAnchor.insertAdjacentElement('afterend', allBtn);
  }
})();
