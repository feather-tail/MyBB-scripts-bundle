(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$ } = helpers;
  const config = helpers.getConfig('defaultAvatars', { avatarByRole: {} });
  const avatarByRole = new Map(Object.entries(config.avatarByRole));

  function getAvatarUrl(authorId) {
    return avatarByRole.has(authorId)
      ? avatarByRole.get(authorId)
      : config.DEFAULT_AVATAR;
  }

  function insertAuthorAvatars() {
    const containers = $$('#pun-viewtopic, #pun-messages');
    if (!containers.length) return;

    containers.forEach((container) => {
      $$('.pa-title', container).forEach((titleEl) => {
        const wrapper = titleEl.parentElement;
        if (!wrapper || wrapper.querySelector('.pa-avatar')) return;

        const post = titleEl.closest('[data-user-id]');
        if (!post) return;

        const id = post.getAttribute('data-user-id');
        const url = getAvatarUrl(id);

        const avatarLi = document.createElement('li');
        avatarLi.className = 'pa-avatar item2';
        const img = document.createElement('img');
        img.className = 'defavtr';
        img.src = url;
        img.alt = 'Аватар';
        img.loading = 'lazy';
        avatarLi.append(img);
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
        const div = document.createElement('div');
        const img = document.createElement('img');
        img.src = config.DEFAULT_AVATAR;
        img.alt = 'Аватар по умолчанию';
        div.append(img);
        img.loading = 'lazy';
        container.textContent = '';
        container.append(div);
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
