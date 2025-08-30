(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs } = helpers;

  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
  });

  const AWARDS_EVENT = 'awards:cache-updated';

  const awardsCache = (window.__awardsCache ||= {
    byUser: new Map(),
    lastUpdated: 0,
  });

  function emitAwardsUpdated() {
    awardsCache.lastUpdated = Date.now();
    document.dispatchEvent(new CustomEvent(AWARDS_EVENT));
  }

  function storeAwards(json) {
    try {
      const list = (json && (json.result || json.results)) || [];
      let changed = false;
      list.forEach((u) => {
        const uid = String(u?.user_id ?? '');
        if (!uid) return;
        const arr = Array.isArray(u.awards) ? u.awards : [];
        awardsCache.byUser.set(uid, arr);
        changed = true;
      });
      if (changed) emitAwardsUpdated();
    } catch (_) {}
  }

  function patchAwardsInterception() {
    if (window.__awardsInterceptionPatched) return;
    window.__awardsInterceptionPatched = true;

    const isAwardsReq = (url, bodyStr) => {
      if (!url) return false;
      const urlHit = /core\.rusff\.me\/rusff\.php/.test(url);
      const methodHit =
        bodyStr && /"method"\s*:\s*"awards\/index"/.test(bodyStr);
      return urlHit && methodHit;
    };

    if (typeof window.fetch === 'function') {
      const origFetch = window.fetch.bind(window);
      window.fetch = function (input, init = {}) {
        const url = typeof input === 'string' ? input : input?.url;
        const bodyStr =
          typeof init?.body === 'string'
            ? init.body
            : init?.body && init.body.toString();

        const p = origFetch(input, init);
        if (isAwardsReq(url, bodyStr)) {
          p.then((res) => {
            try {
              const clone = res.clone();
              clone
                .json()
                .then(storeAwards)
                .catch(() => {});
            } catch (_) {}
          }).catch(() => {});
        }
        return p;
      };
    }

    if (window.XMLHttpRequest) {
      const XO = XMLHttpRequest.prototype;
      const origOpen = XO.open;
      const origSend = XO.send;

      XO.open = function (method, url) {
        this.__aw_url = url;
        return origOpen.apply(this, arguments);
      };

      XO.send = function (body) {
        const bodyStr =
          typeof body === 'string' ? body : body && body.toString();
        this.addEventListener('load', function () {
          try {
            if (isAwardsReq(this.__aw_url, bodyStr)) {
              const json = JSON.parse(this.responseText);
              storeAwards(json);
            }
          } catch (_) {}
        });
        return origSend.apply(this, arguments);
      };
    }
  }

  function findUserIdForLink(link) {
    const post = link.closest('.post');
    if (post) {
      const a = post.querySelector('a[href*="profile.php?id="]');
      if (a) {
        const m = (a.href || '').match(/[?&]id=(\d+)/);
        if (m) return m[1];
      }
    }
    const nav =
      document.querySelector('#navprofile a[href*="profile.php?id="]') ||
      document.querySelector('a#navprofile[href*="profile.php?id="]') ||
      document.querySelector('#navprofile');
    if (nav) {
      const href = nav.href || nav.getAttribute('href') || '';
      const m = href.match(/[?&]id=(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function normalizeDomAwards(nodes) {
    return nodes.map((a) => {
      const img = a.querySelector ? a.querySelector('img') : null;
      const title = (a.title || img?.title || '').trim();
      return {
        item: {
          href: img?.src || '',
          name: title || 'Награда',
          width: img?.width ? String(img.width) : undefined,
          height: img?.height ? String(img.height) : undefined,
        },
        desc: title,
      };
    });
  }

  async function collectAwardsForUserId(uid, domContext) {
    if (!uid) return [];

    const cached = awardsCache.byUser.get(String(uid));
    if (cached && cached.length) return cached;

    const sel = config.awardsTab?.selector;
    const root = domContext || document;

    const fromCachePromise = new Promise((resolve) => {
      const onUpdate = () => {
        document.removeEventListener(AWARDS_EVENT, onUpdate);
        resolve(awardsCache.byUser.get(String(uid)) || []);
      };
      document.addEventListener(AWARDS_EVENT, onUpdate, { once: true });
      setTimeout(() => {
        document.removeEventListener(AWARDS_EVENT, onUpdate);
        resolve([]);
      }, 2000);
    });

    const fromDomPromise = new Promise((resolve) => {
      if (!sel) return resolve([]);
      const ready = Array.from(root.querySelectorAll(sel));
      if (ready.length) return resolve(normalizeDomAwards(ready));

      const obs = new MutationObserver(() => {
        const found = Array.from(root.querySelectorAll(sel));
        if (found.length) {
          obs.disconnect();
          resolve(normalizeDomAwards(found));
        }
      });
      obs.observe(root === document ? document.body : root, {
        childList: true,
        subtree: true,
      });
      setTimeout(() => {
        obs.disconnect();
        resolve([]);
      }, 2000);
    });

    const winner = await Promise.race([fromCachePromise, fromDomPromise]);
    return winner || [];
  }

  function buildAwardNodes(awardsArr) {
    const frag = document.createDocumentFragment();
    awardsArr.forEach((a) => {
      const imgSrc = a?.item?.href || '';
      if (!imgSrc) return;
      const title = (a.desc || a.item?.name || '').trim();
      const aEl = createEl('a', {
        href: imgSrc,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      const img = createEl('img', {
        src: imgSrc,
        alt: title || 'award',
      });
      if (title) aEl.title = title;
      aEl.append(img);
      frag.append(aEl);
    });
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
    const awards = await collectAwardsForUserId(uid, container);

    if (awards && awards.length) {
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
    patchAwardsInterception();

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
