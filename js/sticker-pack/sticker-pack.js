(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl, getGroupId, getUserInfo } = helpers;
  const config = helpers.getConfig('stickerPack', {});

  const stickerPack = {
    isLoading: false,
    packs: [],
    userStickers: [],
    isModalOpen: false,
    activeTab: '',
    elements: {},
    events: [],
  };

  function init() {
    if (!$(`#${config.buttonAfterId}`)) return;
    addStickerPackStyles();
    addStickerPackButton();
  }

  helpers.runOnceOnReady(init);

  function addStickerPackStyles() {
    const link = createEl('link', {
      rel: 'stylesheet',
      href: config.stylesheetUrl,
    });
    document.head.appendChild(link);
  }

  function addStickerPackButton() {
    const buttonTd = createEl('td', {
      id: 'sticker-pack-button',
      title: 'Стикеры',
      onclick: onStickerPackButtonClick,
    });
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
    const tabs = createEl('div', { className: 'sticker-pack-modal-tabs' });
    const content = createEl('div', {
      className: 'sticker-pack-modal-content',
    });
    const addBox = createEl('div', {
      className: 'sticker-pack-modal-add hidden',
    });
    const input = createEl('input', {
      className: 'sticker-pack-modal-input',
      type: 'text',
      placeholder: 'URL стикера',
    });
    const addBtn = createEl('input', {
      className: 'sticker-pack-modal-add-btn',
      type: 'button',
      value: '+',
    });

    addBox.append(input, addBtn);
    modal.append(content, addBox, tabs);
    modalContainer.append(modal);

    stickerPack.packs.forEach((pack) => {
      if (pack.stickers.length) tabs.append(createTab(pack.name));
    });
    if (getGroupId() !== config.hideMyGroupId)
      tabs.append(createTab(config.myTabName));

    tabs.onclick = (e) => {
      const tab = e.target.closest('.sticker-pack-modal-tab');
      if (tab) setStickerPackTab(tab.dataset.pack);
    };
    content.onclick = (e) => {
      const btn = e.target.closest('.sticker-pack-remove-item');
      if (btn) removeUserSticker(btn);
    };
    addBtn.onclick = () => addUserSticker(input);

    stickerPack.elements = {
      ...stickerPack.elements,
      modalContainer,
      modal,
      tabs,
      content,
      addBox,
      input,
      addBtn,
    };

    document.body.append(modalContainer);
    toggleStickerPackModal(true);
  }

  function createTab(name) {
    const div = createEl('div', { className: 'sticker-pack-modal-tab' });
    div.dataset.pack = name;
    div.textContent = name;
    return div;
  }

  function toggleStickerPackModal(open = !stickerPack.isModalOpen) {
    stickerPack.isModalOpen = !!open;
    const { modal, modalContainer } = stickerPack.elements;
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
      setStickerPackTab(stickerPack.activeTab);
      document.addEventListener('mousedown', onStickerPackOutsideClick);
      stickerPack.events.push({
        target: document,
        type: 'mousedown',
        handler: onStickerPackOutsideClick,
      });
      document.addEventListener('keydown', onStickerPackKeyDown);
      stickerPack.events.push({
        target: document,
        type: 'keydown',
        handler: onStickerPackKeyDown,
      });
      const closeEvents = [
        'pun_post',
        'pun_preview',
        'pun_preedit',
        'pun_edit',
        'messenger:post',
      ];
      closeEvents.forEach((ev) => {
        const options = { once: true };
        document.addEventListener(ev, closeStickerPackModal, options);
        stickerPack.events.push({
          target: document,
          type: ev,
          handler: closeStickerPackModal,
          options,
        });
      });
    } else {
      document.removeEventListener('keydown', onStickerPackKeyDown);
      stickerPack.events = stickerPack.events.filter(
        (event) =>
          !(
            event.target === document &&
            event.type === 'keydown' &&
            event.handler === onStickerPackKeyDown
          ),
      );
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

  function setStickerPackTab(tab) {
    stickerPack.activeTab = tab || stickerPack.packs[0]?.name || '';
    $$('.sticker-pack-modal-tab', stickerPack.elements.tabs).forEach((t) =>
      t.classList.toggle('active', t.dataset.pack === stickerPack.activeTab),
    );
    const isCustom = stickerPack.activeTab === config.myTabName;
    const pack = isCustom
      ? { name: config.myTabName, stickers: stickerPack.userStickers }
      : stickerPack.packs.find((p) => p.name === stickerPack.activeTab) || {
          stickers: [],
        };

    stickerPack.elements.content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const url of pack.stickers) {
      const div = createEl('div', { className: 'sticker-pack-item' });
      div.dataset.sticker = url;
      const img = createEl('img', {
        src: url,
        alt: 'sticker',
        loading: 'lazy',
        onclick: () => window.smile?.(`[img]${url}[/img]`),
      });
      div.append(img);
      if (isCustom) {
        const btn = createEl('span', {
          className: 'sticker-pack-remove-item',
          title: 'Удалить',
          text: 'x',
        });
        div.append(btn);
      }
      fragment.append(div);
    }
    stickerPack.elements.content.append(fragment);
    stickerPack.elements.addBox.classList.toggle('hidden', !isCustom);
  }

  function removeUserSticker(btn) {
    const item = btn.closest('.sticker-pack-item');
    const url = item?.dataset.sticker;
    if (!url) return;
    const idx = stickerPack.userStickers.indexOf(url);
    if (idx >= 0) {
      stickerPack.userStickers.splice(idx, 1);
      setStickerPackTab(config.myTabName);
      saveUserStickers();
    }
  }

  function addUserSticker(input) {
    const url = input.value.trim();
    try {
      const { protocol, pathname } = new URL(url);
      const isSafeProtocol = ['http:', 'https:'].includes(protocol);
      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(pathname);
      if (
        !isSafeProtocol ||
        !isImage ||
        stickerPack.userStickers.includes(url)
      ) {
        throw new Error('Invalid URL');
      }
      stickerPack.userStickers.push(url);
      saveUserStickers();
      setStickerPackTab(config.myTabName);
      input.value = '';
    } catch {
      window.jGrowl?.('Некорректная ссылка на изображение');
    }
  }

  async function saveUserStickers() {
    let json = JSON.stringify(stickerPack.userStickers);
    while (
      json.length >= config.maxJsonSize &&
      stickerPack.userStickers.length
    ) {
      window.jGrowl?.('Слишком много стикеров, последний не был сохранён 😔');
      stickerPack.userStickers.pop();
      json = JSON.stringify(stickerPack.userStickers);
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
      window.jGrowl?.('Стикеры не сохранились, что-то пошло не так 😥');
      throw err;
    }
  }

  function setStickerPackLoading(isLoading) {
    stickerPack.isLoading = isLoading;
    stickerPack.elements.button?.classList.toggle('loading', isLoading);
  }

  function parseForumStickerData(txt) {
    const lines = txt.split(/\r?\n/).map((s) => s.replace(/\r/g, ''));
    let packs = [],
      pack = { name: '', stickers: [] };
    for (let str of lines) {
      if (/\.(gif|jpe?g|png|webp)$/i.test(str)) {
        pack.stickers.push(str);
      } else if (str === '') {
        if (pack.stickers.length) packs.push(pack);
        pack = { name: `Pack ${packs.length + 2}`, stickers: [] };
      } else {
        if (pack.stickers.length) packs.push(pack);
        pack = { name: str, stickers: [] };
      }
    }
    if (pack.stickers.length) packs.push(pack);
    stickerPack.packs = packs;
    stickerPack.activeTab = packs[0]?.name || '';
  }

  async function loadForumStickerPacks() {
    try {
      const r = await helpers.request(config.dataUrl);
      const txt = await r.text();
      parseForumStickerData(txt);
    } catch (err) {
      window.jGrowl?.(
        'Стикеры не грузятся, что-то пошло не так 😔 Может, поможет перезагрузка страницы?',
      );
      throw err;
    }
  }

  async function loadUserStickers() {
    if (getUserInfo().id === 1) return;
    try {
      const r = await helpers.request(
        `${config.apiUrl}?method=${config.apiGetMethod}&key=${config.storageKey}`,
      );
      const result = await r.json();
      const str = result?.response?.storage?.data?.[config.storageKey] || '';
      if (str) {
        try {
          stickerPack.userStickers = JSON.parse(str);
        } catch (err) {
          if (err instanceof SyntaxError && str.length > config.maxJsonSize) {
            saveUserStickers();
            window.jGrowl?.(
              'Стикеры сохранились критично неправильно, пришлось очистить хранилище. Извините 😥',
            );
          }
        }
      }
    } catch (err) {
      window.jGrowl?.(
        'Твои стикеры не прогрузились, придется пользоваться форумными 😒',
      );
      throw err;
    }
  }
  helpers.register('stickerPack', { init });
})();
