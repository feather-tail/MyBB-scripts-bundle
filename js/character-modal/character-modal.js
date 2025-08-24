(() => {
  'use strict';
  const helpers = window.helpers;
  const { createEl, parseHTML } = helpers;
  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
  });

  function initTabs(box) {
    const tabs = [...box.querySelectorAll('.modal__tab')];
    const contents = box.querySelectorAll('.modal__content');
    box.addEventListener('click', (e) => {
      const tab = e.target.closest('.modal__tab');
      if (!tab) return;
      const i = tabs.indexOf(tab);
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      contents.forEach((c, idx) => c.classList.toggle('active', idx === i));
    });
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
        if (character) box.append(character);
        else box.append(...Array.from(doc.body.childNodes));
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
