(() => {
  'use strict';

  const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)$/i;

  const helpers = window.helpers;
  const {
    $,
    createEl,
    getGroupId,
    getUserInfo,
    showToast,
    initTabs,
  } = helpers;
  const config = helpers.getConfig('stickerPack', {});

  const M = config.messages || {};
  const t = (key, fallback) =>
    typeof M[key] === 'string' ? M[key] : fallback;

  const stickerPack = {
    isLoading: false,
    packs: [],
    userStickers: [],
    isModalOpen: false,
    elements: {},
    events: [],
  };

  function init() {
    if (!$(`#${config.buttonAfterId}`)) return;
    addStickerPackButton();
  }

  helpers.runOnceOnReady(init);

  function addStickerPackButton() {
    const buttonTd = createEl('td', {
      id: 'sticker-pack-button',
      title: t('buttonTitle', 'Стикеры'),
    });
    if (config.buttonIcon) {
      const icon = createEl('img', {
        src: config.buttonIcon,
        alt: t('buttonTitle', 'Стикеры'),
        title: t('buttonTitle', 'Стикеры'),
      });
      buttonTd.append(icon);
    }
    buttonTd.addEventListener('click', onStickerPackButtonClick);
    const afterElem = $(`#${config.buttonAfterId}`);
    afterElem?.after(buttonTd);
    stickerPack.elements.button = buttonTd;
  }

  async function onStickerPackButtonClick(e) {
    e.stopPropagation();
    if (stickerPack.isLoading) return;
    if (stickerPack.packs.length) return toggleStickerPackModal();

    setStickerPackLoading(true);
    try {
      await Promise.all([
        loadForumStickerPacks(),
        getGroupId() !== config.hideMyGroupId
          ? loadUserStickers()
          : Promise.resolve(),
      ]);
    } catch (err) {
      window.console?.error(err);
    } finally {
      setStickerPackLoading(false);
      renderStickerPackModal();
    }
  }

  function renderStickerPackModal() {
    if (stickerPack.elements.modal) return toggleStickerPackModal(true);

    const modalContainer = createEl('div', {
      className: 'sticker-pack-modal-container',
    });
    const modal = createEl('div', { className: 'sticker-pack-modal' });
    const closeBtn = createEl('button', {
      className: 'sticker-pack-modal__close',
      type: 'button',
      title: t('closeTitle', 'Закрыть'),
      text: '×',
    });
    closeBtn.addEventListener('click', closeStickerPackModal);
    modal.append(closeBtn);
  
    const tabs = createEl('div', { className: 'modal__tabs' });
  
    modal.append(tabs);
    modalContainer.append(modal);
    const tabs = createEl('div', { className: 'modal__tabs' });

    modal.append(tabs);
    modalContainer.append(modal);

    const contents = [];

    stickerPack.packs.forEach((pack, index) => {
      if (!pack.stickers.length) return;
      tabs.append(createTab(pack.name, pack.stickers[0], false, index));
      const content = createEl('div', {
        className: 'modal__content',
      });
      pack.stickers.forEach((url) => {
        content.append(createStickerItem(url));
      });
      contents.push(content);
      modal.append(content);
    });

    let userContent, addBox, input, addBtn;
    if (getGroupId() !== config.hideMyGroupId) {
      const userTabIndex = contents.length;
      tabs.append(createTab(config.myTabName, null, true, userTabIndex));
      userContent = createEl('div', { className: 'modal__content' });
      stickerPack.userStickers.forEach((url) => {
        userContent.append(createStickerItem(url, true));
      });
      addBox = createEl('div', { className: 'sticker-pack-modal-add' });
      input = createEl('input', {
        className: 'sticker-pack-modal-input',
        type: 'text',
        placeholder: t('inputPlaceholder', 'URL стикера'),
      });
      addBtn = createEl('input', {
        className: 'sticker-pack-modal-add-btn',
        type: 'button',
        value: t('addButtonLabel', '+'),
      });
      addBox.append(input, addBtn);
      userContent.append(addBox);
      contents.push(userContent);
      modal.append(userContent);
    }

    stickerPack.elements = {
      ...stickerPack.elements,
      modalContainer,
      modal,
      tabs,
      userContent,
      addBox,
      input,
      addBtn,
    };

    document.body.append(modalContainer);

    initTabs(modal, {
      tabSelector: '.modal__tab',
      contentSelector: '.modal__content',
      activeClass: 'active',
    });

    const allTabs = Array.from(tabs.querySelectorAll('.modal__tab'));
    const allContents = Array.from(
      modal.querySelectorAll('.modal__content'),
    );
    if (allTabs.length && allContents.length) {
      let defaultIndex = 0;
      try {
        const saved = localStorage.getItem(
          config.lastTabKey || 'stickerPackLastTab',
        );
        const idx = saved != null ? Number(saved) : NaN;
        if (!Number.isNaN(idx) && idx >= 0 && idx < allTabs.length) {
          defaultIndex = idx;
        }
      } catch {}

      if (!allTabs[defaultIndex].classList.contains('active')) {
        allTabs[defaultIndex].click();
      }
    }

    tabs.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          tabs.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      },
      { passive: false },
    );

    toggleStickerPackModal(true);
  }

  function createTab(name, previewUrl, isTextOnly = false, index = 0) {
    const tab = createEl('button', {
      className: 'modal__tab',
      type: 'button',
      title: name,
    });

    tab.dataset.index = index;

    if (previewUrl && !isTextOnly) {
      const img = createEl('img', {
        src: previewUrl,
        alt: name,
        loading: 'lazy',
        className: 'sticker-pack-tab-icon',
      });
      tab.append(img);
    } else {
      tab.textContent = name;
    }

    tab.addEventListener('click', () => {
      try {
        localStorage.setItem(
          config.lastTabKey || 'stickerPackLastTab',
          String(index),
        );
      } catch {}
    });

    return tab;
  }

  function createStickerItem(url, isCustom = false) {
    const div = createEl('div', { className: 'sticker-pack-item' });
    div.dataset.sticker = url;
    const img = createEl('img', {
      src: url,
      alt: 'sticker',
      loading: 'lazy',
    });
    img.addEventListener('click', () => window.smile?.(`[img]${url}[/img]`));
    div.append(img);
    if (isCustom) {
      const btn = createEl('span', {
        className: 'sticker-pack-remove-item',
        title: t('removeTitle', 'Удалить'),
        text: 'x',
      });
      div.append(btn);
    }
    return div;
  }

  function positionStickerPackModal() {
    const { button, modalContainer } = stickerPack.elements;
    if (!button || !modalContainer) return;
  
    const rect = button.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = rect.left + rect.width / 2;
  
    modalContainer.style.setProperty('--sticker-pack-top', top + 'px');
    modalContainer.style.setProperty('--sticker-pack-left', left + 'px');
  }

  function addStickerEvent(entry) {
    if (!entry || !entry.target || !entry.type || !entry.handler) return;
    stickerPack.events.push(entry);
    entry.target.addEventListener(entry.type, entry.handler, entry.options);
  }

  function toggleStickerPackModal(open = !stickerPack.isModalOpen) {
    stickerPack.isModalOpen = !!open;
    const { modal, userContent, addBtn } = stickerPack.elements;
    if (!modal) return;
    modal.classList.toggle('active', stickerPack.isModalOpen);

    if (stickerPack.isModalOpen) {
      positionStickerPackModal();

      const closeEvents = [
        'pun_post',
        'pun_preview',
        'pun_preedit',
        'pun_edit',
        'messenger:post',
      ];

      const entries = [
        userContent && {
          target: userContent,
          type: 'click',
          handler: onStickerPackContentClick,
        },
        addBtn && {
          target: addBtn,
          type: 'click',
          handler: onStickerPackAddClick,
        },
        {
          target: document,
          type: 'mousedown',
          handler: onStickerPackOutsideClick,
        },
        {
          target: document,
          type: 'touchstart',
          handler: onStickerPackOutsideClick,
        },
        {
          target: document,
          type: 'keydown',
          handler: onStickerPackKeyDown,
        },
        ...closeEvents.map((ev) => ({
          target: document,
          type: ev,
          handler: closeStickerPackModal,
          options: { once: true },
        })),
      ].filter(Boolean);

      entries.forEach(addStickerEvent);
    } else {
      stickerPack.events.forEach((entry) => {
        entry.target?.removeEventListener(
          entry.type,
          entry.handler,
          entry.options,
        );
      });
      stickerPack.events = [];
    }
  }

  function closeStickerPackModal() {
    toggleStickerPackModal(false);
  }

  function onStickerPackOutsideClick(e) {
    if (!stickerPack.elements.modal?.contains(e.target)) {
      toggleStickerPackModal(false);
    }
  }

  function onStickerPackKeyDown(e) {
    if (!stickerPack.isModalOpen) return;

    if (e.key === 'Escape') {
      toggleStickerPackModal(false);
      return;
    }

    if (
      (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
      stickerPack.elements.tabs
    ) {
      const tabs = Array.from(
        stickerPack.elements.tabs.querySelectorAll('.modal__tab'),
      );
      if (!tabs.length) return;

      let idx = tabs.findIndex((t) => t.classList.contains('active'));
      if (idx === -1) idx = 0;
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (idx + delta + tabs.length) % tabs.length;
      tabs[nextIdx].click();
      e.preventDefault();
    }
  }

  function onStickerPackContentClick(e) {
    const btn = e.target.closest('.sticker-pack-remove-item');
    if (btn) removeUserSticker(btn);
  }

  function onStickerPackAddClick() {
    addUserSticker(stickerPack.elements.input);
  }

  async function removeUserSticker(btn) {
    const item = btn.closest('.sticker-pack-item');
    const url = item?.dataset.sticker;
    if (!url) return;
    const idx = stickerPack.userStickers.indexOf(url);
    if (idx >= 0) {
      const next = [...stickerPack.userStickers];
      next.splice(idx, 1);
      item.remove();
      try {
        await saveUserStickers(next);
      } catch {
        showToast(
          t(
            'toastUserSaveError',
            'Изменения не сохранились, что-то пошло не так',
          ),
          {
            type: 'error',
          },
        );
      }
    }
  }

  async function addUserSticker(input) {
    const url = input.value.trim();
    try {
      const urlObj = new URL(url);
      const isSafeProtocol = ['http:', 'https:'].includes(urlObj.protocol);
      const isImage = IMAGE_EXT_RE.test(urlObj.pathname);
      if (
        !isSafeProtocol ||
        !isImage ||
        stickerPack.userStickers.includes(url)
      ) {
        throw new Error('Invalid URL');
      }

      if (
        typeof config.maxUserStickers === 'number' &&
        stickerPack.userStickers.length >= config.maxUserStickers
      ) {
        showToast(
          t(
            'toastUserLimitReached',
            'Слишком много стикеров, достигнут лимит',
          ),
          { type: 'warning' },
        );
        return;
      }

      const stickers = [...stickerPack.userStickers, url];
      try {
        const saved = await saveUserStickers(stickers);
        const item = createStickerItem(url, true);
        stickerPack.elements.userContent.insertBefore(
          item,
          stickerPack.elements.addBox,
        );
        input.value = '';
        input.focus();
        stickerPack.userStickers = saved;
      } catch {
        showToast(
          t(
            'toastUserSaveError',
            'Изменения не сохранились, что-то пошло не так',
          ),
          {
            type: 'error',
          },
        );
      }
    } catch {
      showToast(
        t('toastInvalidUrl', 'Некорректная ссылка на изображение'),
        { type: 'warning' },
      );
    }
  }

  async function saveUserStickers(stickers = stickerPack.userStickers) {
    const next = Array.isArray(stickers) ? [...stickers] : [];
    let json = JSON.stringify(next);

    while (json.length >= config.maxJsonSize && next.length) {
      showToast(
        t(
          'toastTooManyStickers',
          'Слишком много стикеров, последний не был сохранён',
        ),
        {
          type: 'warning',
        },
      );
      next.pop();
      json = JSON.stringify(next);
    }

    try {
      await helpers.request(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          method: config.apiSetMethod,
          token: window.ForumAPITicket,
          key: config.storageKey,
          value: json,
        }),
      });
      stickerPack.userStickers = next;
      return next;
    } catch (err) {
      showToast(
        t(
          'toastStorageError',
          'Стикеры не сохранились, что-то пошло не так',
        ),
        { type: 'error' },
      );
      throw err;
    }
  }

  function setStickerPackLoading(isLoading) {
    stickerPack.isLoading = isLoading;
    stickerPack.elements.button?.classList.toggle('loading', isLoading);
  }

  function parseForumStickerData(txt) {
    const lines = txt.split(/\r?\n/).map((s) => s.trim());
    let packs = [];
    let pack = { name: '', stickers: [] };
    let packIndex = 1;

    for (let str of lines) {
      if (!str) {
        if (pack.stickers.length) {
          if (!pack.name) pack.name = `Pack ${packIndex++}`;
          packs.push(pack);
        }
        pack = { name: '', stickers: [] };
      } else if (IMAGE_EXT_RE.test(str)) {
        pack.stickers.push(str);
      } else {
        if (pack.stickers.length) {
          if (!pack.name) pack.name = `Pack ${packIndex++}`;
          packs.push(pack);
        }
        pack = { name: str, stickers: [] };
      }
    }

    if (pack.stickers.length) {
      if (!pack.name) pack.name = `Pack ${packIndex++}`;
      packs.push(pack);
    }
    return packs;
  }

  function normalizeForumPacks(raw) {
    if (!Array.isArray(raw)) return [];
    const packs = [];
    let packIndex = 1;

    for (const item of raw) {
      if (!item) continue;
      const name =
        typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : `Pack ${packIndex++}`;
      const stickersSource = Array.isArray(item.stickers)
        ? item.stickers
        : [];
      const stickers = stickersSource
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter((u) => u && IMAGE_EXT_RE.test(u));

      if (stickers.length) {
        packs.push({ name, stickers });
      }
    }

    return packs;
  }

  function getCachedForumPacks() {
    const key = config.cacheKey || 'stickerPackForumPacks';
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = parsed && typeof parsed.ts === 'number' ? parsed.ts : 0;
      const packs = Array.isArray(parsed?.packs) ? parsed.packs : null;
      const ttl =
        typeof config.cacheTtlMs === 'number'
          ? config.cacheTtlMs
          : 1000 * 60 * 60 * 24;
      if (!packs) return null;
      if (Date.now() - ts > ttl) return null;
      return normalizeForumPacks(packs);
    } catch {
      return null;
    }
  }

  function setCachedForumPacks(packs) {
    const key = config.cacheKey || 'stickerPackForumPacks';
    try {
      const payload = {
        ts: Date.now(),
        packs,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }

  async function loadForumStickerPacks() {
    const cached = getCachedForumPacks();
    if (cached && cached.length) {
      stickerPack.packs = cached;
      return;
    }

    try {
      const r = await helpers.request(config.dataUrl);
      const txt = await r.text();
      let packs;

      try {
        const json = JSON.parse(txt);
        packs = normalizeForumPacks(json);
      } catch {
        packs = parseForumStickerData(txt);
      }

      stickerPack.packs = packs;
      setCachedForumPacks(packs);
    } catch (err) {
      showToast(
        t(
          'toastForumLoadError',
          'Стикеры не грузятся, что-то пошло не так. Может, поможет перезагрузка страницы?',
        ),
        { type: 'error' },
      );
      throw err;
    }
  }

  async function loadUserStickers() {
    if (getUserInfo().id === 1) return;
    try {
      const result = await helpers.request(
        `${config.apiUrl}?method=${config.apiGetMethod}&key=${config.storageKey}`,
        { responseType: 'json' },
      );
      const str =
        result?.response?.storage?.data?.[config.storageKey] || '';
      if (str) {
        try {
          const parsed = JSON.parse(str);
          stickerPack.userStickers = Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          if (err instanceof SyntaxError) {
            try {
              localStorage.setItem(config.storageKey + '_backup', str);
            } catch {}
            await saveUserStickers([]);
            showToast(
              t(
                'toastStorageCorrupted',
                'Стикеры в хранилище были повреждены, пришлось их сбросить. Резервная копия строки сохранена локально.',
              ),
              { type: 'error' },
            );
          }
        }
      }
    } catch (err) {
      showToast(
        t(
          'toastUserLoadWarning',
          'Твои стикеры не прогрузились, придется пользоваться форумными',
        ),
        { type: 'warning' },
      );
      throw err;
    }
  }

  helpers.register('stickerPack', {
    init,
    open: () => toggleStickerPackModal(true),
    close: () => toggleStickerPackModal(false),
    reloadPacks: async () => {
      setStickerPackLoading(true);
      try {
        await loadForumStickerPacks();
      } finally {
        setStickerPackLoading(false);
      }
    },
  });
})();
