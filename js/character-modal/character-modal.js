(() => {
  const MODAL_ID = 'character-modal';
  const MODAL_WRAP_CLASS = 'modal__wrap';
  const MODAL_CLOSE_CLASS = 'modal__close';
  const MODAL_BG_CLASS = 'modal__bg';
  const MODAL_OPEN_CLASS = 'open';
  const MODAL_HIDDEN_CLASS = 'hidden';
  const TAB_CLASS = 'modal__tab';
  const TAB_ACTIVE_CLASS = 'active';
  const TAB_CONTENT_CLASS = 'modal__content';
  const AJAX_FOLDER = 'pages/';
  const CARD_CHARSET = 'windows-1251';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const createEl = (tag, props = {}, ...children) => {
    const el = document.createElement(tag);
    Object.assign(el, props);
    for (let ch of children) el.append(ch);
    return el;
  };

  class Modal {
    constructor(id) {
      this.modal = $(`#${id}`);
      this.wrap = $(`.${MODAL_WRAP_CLASS}`, this.modal);
      this._bindEvents();
    }

    open(html) {
      if (html) this.wrap.innerHTML = html;
      this.modal.classList.remove(MODAL_HIDDEN_CLASS);
      setTimeout(() => this.modal.classList.add(MODAL_OPEN_CLASS), 20);
      this._focusFirstTab();
    }

    close() {
      this.modal.classList.remove(MODAL_OPEN_CLASS);
      setTimeout(() => this.modal.classList.add(MODAL_HIDDEN_CLASS), 220);
      this.wrap.innerHTML = '';
    }

    _bindEvents() {
      this.modal.addEventListener('click', (e) => {
        if (
          e.target.classList.contains(MODAL_CLOSE_CLASS) ||
          e.target.classList.contains(MODAL_BG_CLASS)
        ) {
          e.preventDefault();
          this.close();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (
          !this.modal.classList.contains(MODAL_HIDDEN_CLASS) &&
          e.key === 'Escape'
        )
          this.close();
      });
      this.wrap.addEventListener('click', (e) => {
        if (e.target.classList.contains(TAB_CLASS)) {
          this._activateTab(e.target);
        }
      });
    }

    _focusFirstTab() {
      const firstTab = $(`.${TAB_CLASS}`, this.wrap);
      if (firstTab) this._activateTab(firstTab);
    }

    _activateTab(tabBtn) {
      const tabGroup = tabBtn.closest('.modal__tabs');
      if (!tabGroup) return;
      $$(`.${TAB_CLASS}`, tabGroup).forEach((btn) =>
        btn.classList.remove(TAB_ACTIVE_CLASS),
      );
      tabBtn.classList.add(TAB_ACTIVE_CLASS);

      const tabsWrap = tabGroup.parentElement;
      const idx = $$(`.${TAB_CLASS}`, tabGroup).indexOf(tabBtn);
      $$(`.${TAB_CONTENT_CLASS}`, tabsWrap).forEach((tab, i) =>
        tab.classList.toggle(TAB_ACTIVE_CLASS, i === idx),
      );
    }
  }

  const modal = new Modal(MODAL_ID);

  document.body.addEventListener('click', async (e) => {
    const link = e.target.closest('.modal-link');
    if (!link) return;
    e.preventDefault();
    const pageId = link.id;
    if (!pageId) return;

    modal.open(
      '<div style="padding:2em; text-align:center;">Загрузка...</div>',
    );

    try {
      const res = await fetch(`${AJAX_FOLDER}${pageId}`);
      const buf = await res.arrayBuffer();
      const decoder = new TextDecoder(CARD_CHARSET);
      const html = decoder.decode(buf);

      const temp = document.createElement('div');
      temp.innerHTML = html;
      const character = temp.querySelector('.character');
      modal.open(character ? character.outerHTML : html);
    } catch (err) {
      modal.open(
        '<div style="padding:2em; color:red;">Ошибка загрузки данных.</div>',
      );
    }
  });
})();
