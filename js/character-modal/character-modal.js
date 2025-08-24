(() => {
  'use strict';
  const { createEl } = window.helpers;
  const config = helpers.getConfig('characterModal', {});
  function init() {
    document.body.addEventListener('click', async (e) => {
      const link = e.target.closest('.modal-link');
      if (!link) return;
      e.preventDefault();
      const pageId = link.id;
      if (!pageId) return;
      const box = createEl('div', {
        className: 'character-modal',
        html: '<div style="padding:2em; text-align:center;">Загрузка...</div>',
      });
      const { close } = window.helpers.modal.openModal(box);
      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`);
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);
        const temp = createEl('div', { html });
        const character = temp.querySelector('.character');
        box.innerHTML = character ? character.outerHTML : html;
      } catch (err) {
        box.innerHTML =
          '<div style="padding:2em; color:red;">Ошибка загрузки данных.</div>';
      }
      box.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('modal__close')) close();
      });
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('characterModal', { init });
})();
