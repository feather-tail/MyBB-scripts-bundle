(() => {
  'use strict';

  const { $$ } = window.helpers;
  const config = helpers.getConfig('defaultAvatars', {});
  const avatarByRole = new Map(Object.entries(config.avatarByRole));

  function getAvatarUrl(authorName) {
    return avatarByRole.get(authorName) || config.DEFAULT_AVATAR;
  }

  function insertAuthorAvatars() {
    const containers = $$('#pun-viewtopic, #pun-messages');
    if (!containers.length) return;

    containers.forEach((container) => {
      $$('.pa-title', container).forEach((titleEl) => {
        const wrapper = titleEl.parentElement;
        if (!wrapper || wrapper.querySelector('.pa-avatar')) return;

        const name = titleEl.textContent.trim();
        const url = getAvatarUrl(name);

        const avatarLi = document.createElement('li');
        avatarLi.className = 'pa-avatar item2';
        avatarLi.innerHTML = `<img class="defavtr" src="${url}" alt="Аватар">`;

        titleEl.insertAdjacentElement('afterend', avatarLi);
      });
    });
  }

  function replaceProfilePlaceholder() {
    const profileSection = document.getElementById('profile-left');
    if (!profileSection) return;

    $$('strong', profileSection).forEach((strongEl) => {
      if (strongEl.textContent.includes('Нет аватара')) {
        const container = strongEl.parentElement;
        if (!container) return;
        container.innerHTML = `<div><img src="${config.DEFAULT_AVATAR}" alt="Аватар по умолчанию"></div>`;
      }
    });
  }

  function init() {
    insertAuthorAvatars();
    replaceProfilePlaceholder();
  }

  helpers.runOnceOnReady(init);
  helpers.register('defaultAvatars', { init });
})();
