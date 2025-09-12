(() => {
  'use strict';
  const helpers = window.helpers;
  const { $, $$, createEl, showToast } = helpers;

  const config = helpers.getConfig('copyPosts', {});
  const SETTINGS = {
    allowedForumIds: Array.isArray(config.allowedForumIds)
      ? config.allowedForumIds.map(String)
      : [],
    singleInsertAfterSelector:
      typeof config.singleInsertAfterSelector === 'string'
        ? config.singleInsertAfterSelector
        : 'h3 strong',
    allInsertAfterSelector:
      typeof config.allInsertAfterSelector === 'string'
        ? config.allInsertAfterSelector
        : '#pun-main h1 span',
    singleBtnLabel: '\uD83D\uDCCB',
    allBtnLabel: '\uD83D\uDCC4',
    clipboardSoftLimitBytes: 1_000_000,
    joinSeparator: '\n\n---\n\n',
  };

  const ALLOWED_FORUMS = new Set(SETTINGS.allowedForumIds);
  const TOPIC_ID = new URLSearchParams(location.search).get('id') || '';

  const htmlToPlain = (html) => {
    let raw = String(html)
      .replace(
        /\s*\[(?:block=hvmask|mask)][\s\S]*?\[\/(?:block|mask)]\s*/gi,
        '',
      )
      .replace(/\[quote(?:=[^\]]+)?\][\s\S]*?\[\/quote\]/gi, '');

    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const wrap = doc.body;
    $$('script', wrap).forEach((s) => s.remove());
    $$('*', wrap).forEach((el) => {
      for (const { name } of [...el.attributes])
        if (name.toLowerCase().startsWith('on')) el.removeAttribute(name);
    });

    $$('.quote-box, blockquote', wrap).forEach((q) => q.remove());
    $$('a[href]', wrap).forEach((a) => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent.trim() || href;
      a.textContent = `${text} (${href})`;
    });
    $$('br', wrap).forEach((br) => br.replaceWith('[[BR]]'));
    $$('p', wrap).forEach((p) => p.insertAdjacentText('afterend', '[[PARA]]'));
    $$('li,blockquote,tr,td,th,h1,h2,h3,h4,h5,h6', wrap).forEach((el) =>
      el.insertAdjacentText('afterend', '[[BR]]'),
    );

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

  const downloadTxt = (text, filename = 'topic.txt') => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = createEl('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const makeTopicFilename = () => {
    const id = TOPIC_ID || 'topic';
    const title = ($('#pun-main h1')?.textContent || '')
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
      const data = await helpers
        .request(url, { responseType: 'json' })
        .catch(() => ({}));
      const batch = Array.isArray(data?.response) ? data.response : [];
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < limit) break;
    }
    all.sort((a, b) => Number(a.posted || 0) - Number(b.posted || 0));
    return all;
  };

  function init() {
    if (!window.FORUM || !ALLOWED_FORUMS.has(String(FORUM?.topic?.forum_id)))
      return;

    const enc = new TextEncoder();

    $$('div.post').forEach((post) => {
      if (!SETTINGS.singleInsertAfterSelector) return;
      if ($('.copy-post-btn', post)) return;
      const anchor = $(SETTINGS.singleInsertAfterSelector, post);
      if (!anchor) return;
      const btn = createEl('button', {
        type: 'button',
        className: 'copy-post-btn',
        text: SETTINGS.singleBtnLabel,
        title: 'Скопировать этот пост',
      });
      btn.addEventListener('click', async () => {
        const author =
          $('.pa-author a', post)?.textContent?.trim() || 'Неизвестный автор';
        const src = $('.post-content', post);
        let html = '';
        if (src) {
          const clone = src.cloneNode(true);
          $('.post-sig', clone)?.remove();
          html = clone.innerHTML;
        }
        const payload = `${author}:\n${htmlToPlain(html)}`;
        const bytes = enc.encode(payload).length;
        if (bytes > SETTINGS.clipboardSoftLimitBytes) {
          const choice = await showToast('Текст поста очень большой.', {
            type: 'warning',
            actions: [
              { label: 'Скачать .txt', value: 'download', variant: 'primary' },
              { label: 'Копировать всё равно', value: 'copy' },
            ],
            duration: 0,
          });
          if (choice === 'download')
            return downloadTxt(payload, makeTopicFilename());
        }
        const ok = await window.helpers.copyToClipboard(payload);
        if (ok) {
          showToast('Пост скопирован в буфер обмена.', { type: 'success' });
        } else {
          const choice = await showToast(
            'Не удалось скопировать в буфер обмена.',
            {
              type: 'error',
              actions: [
                {
                  label: 'Скачать .txt',
                  value: 'download',
                  variant: 'primary',
                },
              ],
              duration: 0,
            },
          );
          if (choice === 'download') downloadTxt(payload, makeTopicFilename());
        }
      });
      anchor.insertAdjacentElement('afterend', btn);
    });
    const allAnchor = SETTINGS.allInsertAfterSelector
      ? $(SETTINGS.allInsertAfterSelector)
      : null;
    if (allAnchor && !$('.copy-all-btn')) {
      const allBtn = createEl('button', {
        type: 'button',
        className: 'copy-all-btn',
        text: SETTINGS.allBtnLabel,
        title: 'Скопировать все посты в теме',
      });
      allBtn.addEventListener('click', async () => {
        const topicId = TOPIC_ID;
        if (!topicId)
          return showToast('Не удалось определить ID темы.', {
            type: 'error',
          });
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
            const choice = await showToast('Текст всей темы очень большой.', {
              type: 'warning',
              actions: [
                {
                  label: 'Скачать .txt',
                  value: 'download',
                  variant: 'primary',
                },
                { label: 'Копировать всё равно', value: 'copy' },
              ],
              duration: 0,
            });
            if (choice === 'download')
              return downloadTxt(plain, makeTopicFilename());
          }
          const ok = await window.helpers.copyToClipboard(plain);
          if (ok) {
            showToast('Весь текст темы скопирован.', { type: 'success' });
          } else {
            const choice = await showToast(
              'Не удалось скопировать в буфер обмена.',
              {
                type: 'error',
                actions: [
                  {
                    label: 'Скачать .txt',
                    value: 'download',
                    variant: 'primary',
                  },
                ],
                duration: 0,
              },
            );
            if (choice === 'download') downloadTxt(plain, makeTopicFilename());
          }
        } catch {
          showToast('Не удалось получить данные о постах.', { type: 'error' });
        }
      });
      allAnchor.insertAdjacentElement('afterend', allBtn);
    }
  }

  helpers.runOnceOnReady(init);
  helpers.register('copyPosts', { init });
})();
