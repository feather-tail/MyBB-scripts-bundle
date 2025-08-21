(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', initAvatars);

  const DEFAULT_AVATAR = 'YOUR_LINK';

  const avatarByRole = new Map([
    ['Гость', DEFAULT_AVATAR],
    ['PR', 'YOUR_LINK'],
  ]);

  function getAvatarUrl(authorName) {
    return avatarByRole.get(authorName) || DEFAULT_AVATAR;
  }

  function insertAuthorAvatars() {
    const containers = document.querySelectorAll(
      '#pun-viewtopic, #pun-messages',
    );
    if (!containers.length) return;

    containers.forEach((container) => {
      container.querySelectorAll('.pa-title').forEach((titleEl) => {
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

    profileSection.querySelectorAll('strong').forEach((strongEl) => {
      if (strongEl.textContent.includes('Нет аватара')) {
        const container = strongEl.parentElement;
        if (!container) return;
        container.innerHTML = `<div><img src="${DEFAULT_AVATAR}" alt="Аватар по умолчанию"></div>`;
      }
    });
  }

  function initAvatars() {
    insertAuthorAvatars();
    replaceProfilePlaceholder();
  }
})();
