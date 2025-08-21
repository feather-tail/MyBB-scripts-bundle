(() => {
  'use strict';

  const STICKER_DATA_URL = 'LINK_YOUR_STICKERS';
  const STICKER_STYLESHEET_URL = 'LINK_STYLES';
  const BUTTON_AFTER_ID = 'button-smile';
  const MY_TAB_NAME = 'Свои';
  const STORAGE_KEY = 'stickerPackUserData';
  const USER_GROUP_HIDE_MY = 3;
  const MAX_JSON_SIZE = 65000;

  const stickerPack = {
    isLoading: false,
    packs: [],
    userStickers: [],
    isModalOpen: false,
    activeTab: '',
    elements: {},
  };

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    if (!document.getElementById(BUTTON_AFTER_ID)) return;
    addStickerPackStyles();
    addStickerPackButton();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  function addStickerPackStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STICKER_STYLESHEET_URL;
    document.head.appendChild(link);
  }

  function addStickerPackButton() {
    const buttonTd = document.createElement('td');
    buttonTd.id = 'sticker-pack-button';
    buttonTd.title = 'Стикеры';
    buttonTd.onclick = onStickerPackButtonClick;
    const afterElem = document.getElementById(BUTTON_AFTER_ID);
    afterElem?.after(buttonTd);
    stickerPack.elements.button = buttonTd;
  }

  function onStickerPackButtonClick(e) {
    e.stopPropagation();
    if (stickerPack.isLoading) return;
    if (stickerPack.packs.length) return toggleStickerPackModal();

    setStickerPackLoading(true);
    Promise.all([
      loadForumStickerPacks(),
      window.GroupID !== USER_GROUP_HIDE_MY
        ? loadUserStickers()
        : Promise.resolve(),
    ]).finally(() => {
      setStickerPackLoading(false);
      renderStickerPackModal();
    });
  }

  function renderStickerPackModal() {
    if (stickerPack.elements.modal) return toggleStickerPackModal(true);

    const modalContainer = createElement('div', 'sticker-pack-modal-container');
    const modal = createElement('div', 'sticker-pack-modal');
    const tabs = createElement('div', 'sticker-pack-modal-tabs');
    const content = createElement('div', 'sticker-pack-modal-content');
    const addBox = createElement('div', 'sticker-pack-modal-add', 'hidden');
    const input = createElement('input', 'sticker-pack-modal-input');
    input.type = 'text';
    input.placeholder = 'URL стикера';
    const addBtn = createElement('input', 'sticker-pack-modal-add-btn');
    addBtn.type = 'button';
    addBtn.value = '+';

    addBox.append(input, addBtn);
    modal.append(content, addBox, tabs);
    modalContainer.append(modal);

    stickerPack.packs.forEach((pack) => {
      if (pack.stickers.length) tabs.append(createTab(pack.name));
    });
    if (window.GroupID !== USER_GROUP_HIDE_MY)
      tabs.append(createTab(MY_TAB_NAME));

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
    const div = createElement('div', 'sticker-pack-modal-tab');
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
      const ref =
        document.getElementById('post') || document.getElementById('post-form');
      if (ref) {
        const rect = ref.getBoundingClientRect();
        modalContainer.style.position = 'absolute';
        modalContainer.style.top = window.scrollY + rect.top + 'px';
        modalContainer.style.left = window.scrollX + rect.left + 'px';
        modal.style.width = ref.offsetWidth + 'px';
      }
      setStickerPackTab(stickerPack.activeTab);
      document.addEventListener('mousedown', onStickerPackOutsideClick);
      [
        'pun_post',
        'pun_preview',
        'pun_preedit',
        'pun_edit',
        'messenger:post',
      ].forEach((ev) =>
        document.addEventListener(ev, closeStickerPackModal, { once: true }),
      );
    } else {
      document.removeEventListener('mousedown', onStickerPackOutsideClick);
    }
  }
  function closeStickerPackModal() {
    toggleStickerPackModal(false);
  }

  function onStickerPackOutsideClick(e) {
    if (!stickerPack.elements.modal.contains(e.target))
      toggleStickerPackModal(false);
  }

  function setStickerPackTab(tab) {
    stickerPack.activeTab = tab || stickerPack.packs[0]?.name || '';
    stickerPack.elements.tabs
      .querySelectorAll('.sticker-pack-modal-tab')
      .forEach((t) =>
        t.classList.toggle('active', t.dataset.pack === stickerPack.activeTab),
      );
    const isCustom = stickerPack.activeTab === MY_TAB_NAME;
    const pack = isCustom
      ? { name: MY_TAB_NAME, stickers: stickerPack.userStickers }
      : stickerPack.packs.find((p) => p.name === stickerPack.activeTab) || {
          stickers: [],
        };

    stickerPack.elements.content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const url of pack.stickers) {
      const div = createElement('div', 'sticker-pack-item');
      div.dataset.sticker = url;
      const img = document.createElement('img');
      img.src = url;
      img.loading = 'lazy';
      img.onclick = () => window.smile?.(`[img]${url}[/img]`);
      div.append(img);
      if (isCustom) {
        const btn = createElement('span', 'sticker-pack-remove-item');
        btn.title = 'Удалить';
        btn.textContent = 'x';
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
      setStickerPackTab(MY_TAB_NAME);
      saveUserStickers();
    }
  }

  function addUserSticker(input) {
    const url = input.value.trim();
    if (
      /^https?:\/\/.*\.(png|jpe?g|gif|webp)$/i.test(url) &&
      !stickerPack.userStickers.includes(url)
    ) {
      stickerPack.userStickers.push(url);
      saveUserStickers();
      setStickerPackTab(MY_TAB_NAME);
      input.value = '';
    }
  }

  function saveUserStickers() {
    let json = JSON.stringify(stickerPack.userStickers);
    if (json.length >= MAX_JSON_SIZE) {
      window.jGrowl?.('Слишком много стикеров, последний не был сохранён 😔');
      stickerPack.userStickers.pop();
      return saveUserStickers();
    }
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'storage.set',
        token: window.ForumAPITicket,
        key: STORAGE_KEY,
        value: json,
      }),
    });
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

  function loadForumStickerPacks() {
    return fetch(STICKER_DATA_URL)
      .then((r) => r.text())
      .then(parseForumStickerData)
      .catch(() =>
        window.jGrowl?.(
          'Стикеры не грузятся, что-то пошло не так 😔 Может, поможет перезагрузка страницы?',
        ),
      );
  }

  function loadUserStickers() {
    if (window.UserID === 1) return Promise.resolve();
    return fetch('/api.php?method=storage.get&key=' + STORAGE_KEY)
      .then((r) => r.json())
      .then((result) => {
        const str = result?.response?.storage?.data?.[STORAGE_KEY] || '';
        if (str) {
          try {
            stickerPack.userStickers = JSON.parse(str);
          } catch (err) {
            if (err instanceof SyntaxError && str.length > MAX_JSON_SIZE) {
              saveUserStickers();
              window.jGrowl?.(
                'Стикеры сохранились критично неправильно, пришлось очистить хранилище. Извините 😥',
              );
            }
          }
        }
      })
      .catch(() =>
        window.jGrowl?.(
          'Твои стикеры не прогрузились, придется пользоваться форумными 😒',
        ),
      );
  }

  function createElement(tag, ...classes) {
    const el = document.createElement(tag);
    classes.forEach((c) => el.classList.add(c));
    return el;
  }
})();
