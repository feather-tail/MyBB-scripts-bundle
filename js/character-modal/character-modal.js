(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs } = helpers;

  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
  });

  const awardsCache = (window.__awardsCacheDirect ||= new Map());

  function findUserIdForLink(link) {
    const post = link.closest?.('.post');
    if (post) {
      const a = post.querySelector('a[href*="profile.php?id="]');
      if (a) {
        const m = (a.href || '').match(/[?&]id=(\d+)/);
        if (m) return m[1];
      }
    }
    const nav =
      document.querySelector('#navprofile a[href*="profile.php?id="]') ||
      document.querySelector('a#navprofile[href*="profile.php?id="]');
    if (nav) {
      const m = (nav.href || '').match(/[?&]id=(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function detectBoardId() {
    const cand = [
      window.BOARD_ID,
      window.board_id,
      window.PUNBB && window.PUNBB.board_id,
      window.FORUM && window.FORUM.board_id,
      document.body && document.body.dataset && document.body.dataset.boardId,
    ];
    for (const v of cand) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function detectRusffCheck() {
    const cand = [
      window.coreCheck,
      window.RUSFF_CHECK,
      window.rusffCheck,
      window.RusffCore && window.RusffCore.check,
      window.RUSFF && window.RUSFF.check,
    ];
    for (const c of cand) {
      if (c && typeof c === 'object' && 'sign' in c) return c;
    }
    return null;
  }

  async function fetchAwardsViaJsonRpc(uid) {
    const boardId = detectBoardId();
    if (!uid || !boardId) {
      return { ok: false, reason: 'no-uid-or-board' };
    }

    const check = detectRusffCheck();
    const params = {
      board_id: boardId,
      users_ids: [String(uid)],
      sort: 'user',
    };
    if (check) {
      params.check = {
        board_id: boardId,
        user_id: check.user_id ?? undefined,
        partner_id: check.partner_id ?? undefined,
        group_id: check.group_id ?? undefined,
        user_login: check.user_login ?? undefined,
        host: location.hostname,
        user_lastvisit: check.user_lastvisit ?? undefined,
        user_unique_id: check.user_unique_id ?? undefined,
        sign: check.sign,
      };
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'awards/index',
      id: Date.now(),
      params,
    };

    try {
      const res = await fetch('https://core.rusff.me/rusff.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        return { ok: false, reason: `http-${res.status}` };
      }
      const json = await res.json();
      const list = json && (json.result || json.results);
      if (!Array.isArray(list)) {
        return { ok: false, reason: 'bad-json' };
      }
      const entry = list.find((u) => String(u?.user_id) === String(uid));
      const awards =
        (entry && Array.isArray(entry.awards) && entry.awards) || [];
      return { ok: true, awards };
    } catch (e) {
      return { ok: false, reason: 'network', error: e };
    }
  }

  async function fetchAwardsViaHtml(uid) {
    try {
      const res = await fetch(`/mod/awards/?uid=${encodeURIComponent(uid)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return { ok: false, reason: `http-${res.status}` };
      const html = await res.text();
      const doc = parseHTML(html);
      const anchors = Array.from(doc.querySelectorAll('a[href] > img')).map(
        (img) => img.parentElement,
      );
      const awards = anchors.map((a) => {
        const img = a.querySelector('img');
        const title = (a.title || img?.title || '').trim();
        return {
          item: {
            href: img?.src || '',
            name: title || img?.alt || 'Награда',
            width: img?.width ? String(img.width) : undefined,
            height: img?.height ? String(img.height) : undefined,
          },
          desc: title,
        };
      });
      return { ok: true, awards };
    } catch (e) {
      return { ok: false, reason: 'network', error: e };
    }
  }

  async function getAwards(uid) {
    const cached = awardsCache.get(String(uid));
    if (cached) return cached;

    const rpc = await fetchAwardsViaJsonRpc(uid);
    if (rpc.ok) {
      awardsCache.set(String(uid), rpc.awards);
      return rpc.awards;
    }

    const html = await fetchAwardsViaHtml(uid);
    if (html.ok) {
      awardsCache.set(String(uid), html.awards);
      return html.awards;
    }

    return [];
  }

  function buildAwardNodes(awardsArr) {
    const frag = document.createDocumentFragment();
    for (const a of awardsArr) {
      const imgSrc = a?.item?.href || '';
      if (!imgSrc) continue;
      const title = (a.desc || a.item?.name || '').trim();
      const aEl = createEl('a', {
        href: imgSrc,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      const img = createEl('img', { src: imgSrc, alt: title || 'award' });
      img.style.maxWidth = '40px';
      img.style.maxHeight = '40px';
      img.style.width = 'auto';
      img.style.height = 'auto';
      if (title) aEl.title = title;
      aEl.append(img);
      frag.append(aEl);
    }
    return frag;
  }

  function insertAwardsTabSkeleton(container) {
    const { awardsTab, classes } = config;
    const tab = createEl('div', {
      className: classes.tab,
      text: awardsTab.title,
    });
    const content = createEl('div', {
      className: `${classes.tabContent} character-modal__awards`,
    });
    if (awardsTab.perRow) {
      content.style.display = 'grid';
      content.style.gridTemplateColumns = `repeat(${awardsTab.perRow}, 1fr)`;
      content.style.gap = '8px';
      content.style.alignItems = 'start';
    }
    const tabs = container.querySelector(`.${classes.tabs}`);
    tabs?.append(tab);
    container.append(content);
    return content;
  }

  async function addAwardsTab(container, link) {
    const { awardsTab } = config;
    if (!awardsTab?.enabled) return;

    const content = insertAwardsTabSkeleton(container);

    const uid = findUserIdForLink(link);
    if (!uid) {
      content.append(
        createEl('div', {
          style: 'opacity:.7; padding:.75em 0;',
          text: 'Невозможно определить пользователя.',
        }),
      );
      return;
    }

    const loading = createEl('div', {
      text: 'Загрузка наград…',
      style: 'opacity:.8;padding:.5em 0;',
    });
    content.append(loading);

    const awards = await getAwards(uid);

    content.textContent = '';
    if (awards.length) {
      content.append(buildAwardNodes(awards));
    } else {
      content.append(
        createEl('div', {
          style: 'opacity:.7; padding:.75em 0;',
          text: 'Награды не найдены.',
        }),
      );
    }
  }

  function init() {
    document.body.addEventListener('click', async (e) => {
      const link = e.target.closest('.modal-link');
      if (!link) return;
      e.preventDefault();

      const pageId = link.id;
      if (!pageId) return;

      const box = createEl('div', { className: 'character-modal' });
      box.append(
        createEl('div', {
          style: 'padding:2em; text-align:center;',
          text: config.loadingText,
        }),
      );
      const { close } = window.helpers.modal.openModal(box);

      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`);
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);
        const doc = parseHTML(html);
        const character = doc.querySelector('.character');

        box.textContent = '';

        const tabParams = {
          tabSelector: `.${config.classes.tab}`,
          contentSelector: `.${config.classes.tabContent}`,
          activeClass: config.classes.active,
        };

        if (character) {
          box.append(character);
          addAwardsTab(character, link);
          initTabs(character, tabParams);
        } else {
          box.append(...Array.from(doc.body.childNodes));
          addAwardsTab(box, link);
          initTabs(box, tabParams);
        }
      } catch (err) {
        box.textContent = '';
        box.append(
          createEl('div', {
            style: 'padding:2em; color:red;',
            text: config.errorText,
          }),
        );
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('characterModal', { init });
})();
