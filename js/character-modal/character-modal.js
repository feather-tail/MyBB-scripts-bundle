(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs } = helpers;

  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
  });

  const awardsCache = (window.__awardsCacheCore ||= new Map());
  const inflight = (window.__awardsInflight ||= new Map());
  let __boardIdPromise;

  function getAttrUid(node) {
    if (!node) return null;
    const n =
      node.getAttribute?.('data-uid') ||
      node.dataset?.uid ||
      node.getAttribute?.('data-id') ||
      node.dataset?.id;
    const m = n && String(n).match(/^\d+$/) ? n : null;
    return m ? String(m) : null;
  }

  function findUidNear(node) {
    let el = node;
    while (el && el !== document.body) {
      const byAttr = getAttrUid(el);
      if (byAttr) return byAttr;
      el = el.parentElement;
    }
    const post = node.closest?.('.post');
    if (post) {
      const byPa = post.querySelector('.pa-awards[data-id]');
      if (byPa?.dataset?.id) return String(byPa.dataset.id);
      const prof = post.querySelector('a[href*="profile.php?id="]');
      if (prof) {
        const m = (prof.href || '').match(/[?&]id=(\d+)/);
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

  function pickBoardIdFromGlobals() {
    const c = [
      window.BOARD_ID,
      window.board_id,
      window.PUNBB && window.PUNBB.board_id,
      window.FORUM && window.FORUM.board_id,
      document.body && document.body.dataset && document.body.dataset.boardId,
    ];
    for (const v of c) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  async function resolveBoardId() {
    if (__boardIdPromise) return __boardIdPromise;
    __boardIdPromise = (async () => {
      const g = pickBoardIdFromGlobals();
      if (g) return g;
      try {
        const r = await fetch('/api.php?method=board.get&format=json', {
          credentials: 'same-origin',
        });
        if (!r.ok) return null;
        const j = await r.json();
        const id =
          j?.result?.board?.id ?? j?.board?.id ?? j?.result?.id ?? j?.id;
        const n = Number(id);
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch (_) {
        return null;
      }
    })();
    return __boardIdPromise;
  }

  function detectCheckFromGlobals() {
    const c = [
      window.coreCheck,
      window.RUSFF_CHECK,
      window.rusffCheck,
      window.RUSFF && window.RUSFF.check,
      window.RusffCore && window.RusffCore.check,
      window.AWARDS && window.AWARDS.check,
    ];
    for (const x of c) {
      if (x && typeof x === 'object' && x.sign) return x;
    }
    try {
      const scripts = Array.from(document.scripts).slice(-16);
      for (const s of scripts) {
        const t = s.textContent || '';
        if (!/sign"\s*:\s*"/.test(t)) continue;
        const m = t.match(/check"\s*:\s*\{([\s\S]+?)\}/);
        if (!m) continue;
        let jsonish = m[0].replace(/check"\s*:\s*/, '');
        jsonish = jsonish.replace(
          /(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g,
          '"$2":',
        );
        jsonish = jsonish.replace(/'/g, '"');
        jsonish = jsonish.replace(/,\s*}/g, '}');
        const obj = JSON.parse(jsonish);
        if (obj && obj.sign) return obj;
      }
    } catch (_) {}
    return null;
  }

  async function fetchAwardsCore(uid) {
    const boardId = await resolveBoardId();
    if (!uid || !boardId) return [];
    const check = detectCheckFromGlobals();
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
        user_avatar: check.user_avatar ?? undefined,
        sign: check.sign,
      };
    }
    const payload = {
      jsonrpc: '2.0',
      method: 'awards/index',
      id: Date.now(),
      params,
    };
    const res = await fetch('https://core.rusff.me/rusff.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'omit',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json && (json.result || json.results);
    if (!Array.isArray(list)) return [];
    const entry = list.find((u) => String(u?.user_id) === String(uid));
    return (entry && Array.isArray(entry.awards) && entry.awards) || [];
  }

  function ensureFetch(uid) {
    const k = String(uid);
    if (awardsCache.has(k)) return Promise.resolve(awardsCache.get(k));
    if (inflight.has(k)) return inflight.get(k);
    const p = fetchAwardsCore(k)
      .then((aw) => {
        awardsCache.set(k, aw);
        inflight.delete(k);
        return aw;
      })
      .catch(() => {
        inflight.delete(k);
        return [];
      });
    inflight.set(k, p);
    return p;
  }

  async function getAwards(uid) {
    const k = String(uid);
    if (awardsCache.has(k)) return awardsCache.get(k);
    return ensureFetch(k);
  }

  function buildAwardNodes(arr) {
    const frag = document.createDocumentFragment();
    for (const a of arr) {
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

  async function addAwardsTab(container, link, preUid) {
    const { awardsTab } = config;
    if (!awardsTab?.enabled) return;
    const content = insertAwardsTabSkeleton(container);
    const uid = preUid || findUidNear(link);
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
      style: 'opacity:.8; padding:.5em 0;',
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

      const preUid = findUidNear(link);
      if (preUid) ensureFetch(preUid);

      const pageId = link.id;
      if (!pageId) return;

      const box = createEl('div', { className: 'character-modal' });
      box.append(
        createEl('div', {
          style: 'padding:2em; text-align:center;',
          text: config.loadingText,
        }),
      );
      window.helpers.modal.openModal(box);

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
          addAwardsTab(character, link, preUid);
          initTabs(character, tabParams);
        } else {
          box.append(...Array.from(doc.body.childNodes));
          addAwardsTab(box, link, preUid);
          initTabs(box, tabParams);
        }
      } catch (_) {
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
