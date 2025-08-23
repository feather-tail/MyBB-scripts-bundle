(() => {
  'use strict';

  const { createEl } = window.helpers;
  const CFG = window.ScriptConfig.bbcodeHideProfile;

  const TAG = '[hideprofile]';
  const HIDE_CLASS = 'hide-profile';
  const BUTTON_TEXT = 'Скрыть минипрофиль';

  if (!CFG.allowedGroups.includes(window.GroupID)) return;

  function insertHideProfileTag() {
    if (typeof insert === 'function') {
      insert(TAG);
    }
  }

  function addHideProfileButton() {
    if (CFG.selectors.buttonInsert) {
      const container = document.querySelector(CFG.selectors.buttonInsert);
      if (!container || container.querySelector('#button-hideprofile')) return;
      const td = createEl('td', {
        id: 'button-hideprofile',
        title: BUTTON_TEXT,
      });
      const img = createEl('img', { src: CFG.buttonIcon, alt: '' });
      td.appendChild(img);
      td.addEventListener('click', insertHideProfileTag);
      container.appendChild(td);
    } else {
      const additionArea = document.getElementById('addition-area');
      if (!additionArea || additionArea.querySelector('.hideprofile-div'))
        return;
      const div = createEl('div', { className: 'hideprofile-div' });
      const span = createEl('span', { text: BUTTON_TEXT });
      div.appendChild(span);
      div.addEventListener('click', insertHideProfileTag);
      additionArea.appendChild(div);
    }
  }

  function applyHideProfileToPost(post) {
    if (post.classList.contains(HIDE_CLASS)) return;
    const body = post.querySelector(CFG.selectors.postBody);
    if (!body) return;
    if (body.innerHTML.includes(TAG)) {
      post.classList.add(HIDE_CLASS);
      body.innerHTML = body.innerHTML.split(TAG).join('');
    }
  }

  function applyHideProfileToAllPosts(root = document) {
    root.querySelectorAll(CFG.selectors.post).forEach(applyHideProfileToPost);
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    addHideProfileButton();
    applyHideProfileToAllPosts();
  }

  helpers.ready(init);

  window.applyHideProfileToAllPosts = applyHideProfileToAllPosts;
})();
