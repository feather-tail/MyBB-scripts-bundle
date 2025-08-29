(() => {
  'use strict';

  const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)$/i;

  const helpers = window.helpers;
  const {
    $, // query selector
    createEl,
    getGroupId,
    getUserInfo,
    showToast,
    initTabs,
  } = helpers;
  const config = helpers.getConfig('stickerPack', {});

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
      title: 'Стикеры',
    });
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
    const tabs = createEl('div', { className: 'modal__tabs' });

    modal.append(tabs);
    modalContainer.append(modal);

    const contents = [];

    stickerPack.packs.forEach((pack) => {
      if (!pack.stickers.length) return;
      tabs.append(createTab(pack.name));
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
      tabs.append(createTab(config.myTabName));
      userContent = createEl('div', { className: 'modal__content' });
      stickerPack.userStickers.forEach((url) => {
        userContent.append(createStickerItem(url, true));
      });
      addBox = createEl('div', { className: 'sticker-pack-modal-add' });
      input = createEl('input', {
        className: 'sticker-pack-modal-input',
        type: 'text',
        placeholder: 'URL стикера',
      });
      addBtn = createEl('input', {
        className: 'sticker-pack-modal-add-btn',
        type: 'button',
        value: '+',
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

    if (tabs.firstElementChild && contents[0]) {
      tabs.firstElementChild.classList.add('active');
      contents[0].classList.add('active');
    }

    document.body.append(modalContainer);
    initTabs(modal, {
      tabSelector: '.modal__tab',
      contentSelector: '.modal__content',
      activeClass: 'active',
    });
    toggleStickerPackModal(true);
  }

  function createTab(name) {
    return createEl('div', { className: 'modal__tab', text: name });
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
        title: 'Удалить',
        text: 'x',
      });
      div.append(btn);
    }
    return div;
  }

  function toggleStickerPackModal(open = !stickerPack.isModalOpen) {
    stickerPack.isModalOpen = !!open;
    const { modal, modalContainer, userContent, addBtn } = stickerPack.elements;
    if (!modal) return;
    modal.classList.toggle('active', stickerPack.isModalOpen);
    if (stickerPack.isModalOpen) {
      const ref = $('#post') || $('#post-form');
      if (ref) {
        const rect = ref.getBoundingClientRect();
        modalContainer.style.position = 'absolute';
        modalContainer.style.top = window.scrollY + rect.top + 'px';
        modalContainer.style.left = window.scrollX + rect.left + 'px';
        modal.style.width = ref.offsetWidth + 'px';
      }
      const closeEvents = [
        'pun_post',
        'pun_preview',
        'pun_preedit',
        'pun_edit',
        'messenger:post',
      ];
      stickerPack.events = [
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
      stickerPack.events.forEach(({ target, type, handler, options }) =>
        target.addEventListener(type, handler, options),
      );
    } else {
      stickerPack.events.forEach(({ target, type, handler, options }) =>
        target.removeEventListener(type, handler, options),
      );
      stickerPack.events = [];
    }
  }
  function closeStickerPackModal() {
    toggleStickerPackModal(false);
  }

  function onStickerPackOutsideClick(e) {
    if (!stickerPack.elements.modal.contains(e.target))
      toggleStickerPackModal(false);
  }

  function onStickerPackKeyDown(e) {
    if (e.key === 'Escape') toggleStickerPackModal(false);
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
      stickerPack.userStickers.splice(idx, 1);
      item.remove();
      try {
        await saveUserStickers();
      } catch {
        showToast('Изменения не сохранились, что-то пошло не так', {
          type: 'error',
        });
      }
    }
  }

  async function addUserSticker(input) {
    const url = input.value.trim();
    try {
      const { protocol, pathname } = new URL(url);
      const isSafeProtocol = ['http:', 'https:'].includes(protocol);
      const isImage = IMAGE_EXT_RE.test(pathname);
      if (
        !isSafeProtocol ||
        !isImage ||
        stickerPack.userStickers.includes(url)
      ) {
        throw new Error('Invalid URL');
      }
      const stickers = [...stickerPack.userStickers, url];
      try {
        await saveUserStickers(stickers);
        stickerPack.userStickers = stickers;
        const item = createStickerItem(url, true);
        stickerPack.elements.userContent.insertBefore(
          item,
          stickerPack.elements.addBox,
        );
        input.value = '';
      } catch {
        showToast('Изменения не сохранились, что-то пошло не так', {
          type: 'error',
        });
      }
    } catch {
      showToast('Некорректная ссылка на изображение', { type: 'warning' });
    }
  }

  async function saveUserStickers(stickers = stickerPack.userStickers) {
    let json = JSON.stringify(stickers);
    while (json.length >= config.maxJsonSize && stickers.length) {
      showToast('Слишком много стикеров, последний не был сохранён', {
        type: 'warning',
      });
      stickers.pop();
      json = JSON.stringify(stickers);
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
    } catch (err) {
      showToast('Стикеры не сохранились, что-то пошло не так', {
        type: 'error',
      });
      throw err;
    }
  }

  function setStickerPackLoading(isLoading) {
    stickerPack.isLoading = isLoading;
    stickerPack.elements.button?.classList.toggle('loading', isLoading);
  }

  function parseForumStickerData(txt) {
    const lines = txt.split(/\r?\n/).map((s) => s.trim());
    let packs = [],
      pack = { name: '', stickers: [] },
      packIndex = 1;
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
    stickerPack.packs = packs;
  }

  async function loadForumStickerPacks() {
    try {
      const r = await helpers.request(config.dataUrl);
      const txt = await r.text();
      parseForumStickerData(txt);
    } catch (err) {
      showToast(
        'Стикеры не грузятся, что-то пошло не так. Может, поможет перезагрузка страницы?',
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
      const str = result?.response?.storage?.data?.[config.storageKey] || '';
      if (str) {
        try {
          stickerPack.userStickers = JSON.parse(str);
        } catch (err) {
          if (err instanceof SyntaxError && str.length > config.maxJsonSize) {
            await saveUserStickers();
            showToast(
              'Стикеры сохранились критично неправильно, пришлось очистить хранилище. Извините',
              { type: 'error' },
            );
          }
        }
      }
    } catch (err) {
      showToast(
        'Твои стикеры не прогрузились, придется пользоваться форумными',
        { type: 'warning' },
      );
      throw err;
    }
  }
  helpers.register('stickerPack', { init });
})();
