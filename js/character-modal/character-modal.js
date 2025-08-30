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

  async function decodeResponseText(res) {
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const enc = (m ? m[1] : 'utf-8').trim().toLowerCase();
    const buf = await res.arrayBuffer();
    const dec = new TextDecoder(enc);
    return dec.decode(buf);
  }

  function extractAwardsFromHtml(html) {
    const doc = parseHTML(html);
    const anchors = Array.from(doc.querySelectorAll('a[href] > img')).map(
      (img) => img.parentElement,
    );
    return anchors.map((a) => {
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
  }

  async function fetchAwardsHtml(uid) {
    const res = await fetch(`/mod/awards/?uid=${encodeURIComponent(uid)}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await decodeResponseText(res);
    return extractAwardsFromHtml(html);
  }

  async function getAwards(uid) {
    const cached = awardsCache.get(String(uid));
    if (cached) return cached;
    const awards = await fetchAwardsHtml(uid);
    awardsCache.set(String(uid), awards);
    return awards;
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
      style: 'opacity:.8; padding:.5em 0;',
    });
    content.append(loading);

    try {
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
    } catch (e) {
      content.textContent = '';
      content.append(
        createEl('div', {
          style: 'opacity:.9; color:#b00; padding:.75em 0;',
          text: 'Не удалось загрузить награды.',
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
