(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, getGroupId } = helpers;
  const config = helpers.getConfig('bbcodeHideProfile', {});

  if (!config.allowedGroups.includes(getGroupId())) return;

  function insertHideProfileTag() {
    if (typeof insert === 'function') {
      insert(config.tag);
    }
  }

  function addHideProfileButton() {
    if (config.selectors.buttonInsert) {
      const container = document.querySelector(config.selectors.buttonInsert);
      if (!container || container.querySelector('#button-hideprofile')) return;
      const td = createEl('td', {
        id: 'button-hideprofile',
        title: config.buttonText,
      });
      const img = createEl('img', { src: config.buttonIcon, alt: '' });
      td.appendChild(img);
      td.addEventListener('click', insertHideProfileTag);
      container.appendChild(td);
    } else {
      const additionArea = document.getElementById('addition-area');
      if (!additionArea || additionArea.querySelector('.hideprofile-div'))
        return;
      const div = createEl('div', { className: 'hideprofile-div' });
      const span = createEl('span', { text: config.buttonText });
      div.appendChild(span);
      div.addEventListener('click', insertHideProfileTag);
      additionArea.appendChild(div);
    }
  }

  function applyHideProfileToPost(post) {
    if (post.classList.contains(config.hideClass)) return;
    const body = post.querySelector(config.selectors.postBody);
    if (!body) return;
    if (body.innerHTML.includes(config.tag)) {
      post.classList.add(config.hideClass);
      body.innerHTML = body.innerHTML.split(config.tag).join('');
    }
  }

  function applyHideProfileToAllPosts(root = document) {
    root
      .querySelectorAll(config.selectors.post)
      .forEach(applyHideProfileToPost);
  }

  function init() {
    addHideProfileButton();
    applyHideProfileToAllPosts();
  }

  helpers.runOnceOnReady(init);
  helpers.register('bbcodeHideProfile', {
    applyToAllPosts: applyHideProfileToAllPosts,
  });
})();
