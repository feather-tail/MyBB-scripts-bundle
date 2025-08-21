(() => {
  'use strict';

  const TAG = '[hideprofile]';
  const POST_SELECTOR = '.post';
  const POST_BODY_SELECTOR = '.post-body';
  const HIDE_CLASS = 'hide-profile';
  const ALLOWED_GROUPS = [1, 2, 4];
  const BUTTON_INSERT_SELECTOR = '';
  const ICON_URL = '/i/blank.gif';

  if (!ALLOWED_GROUPS.includes(window.GroupID)) return;

  function insertHideProfileTag() {
    if (typeof insert === 'function') {
      insert(TAG);
    }
  }

  function addHideProfileButton() {
    if (BUTTON_INSERT_SELECTOR) {
      const container = document.querySelector(BUTTON_INSERT_SELECTOR);
      if (!container || container.querySelector('#button-hideprofile')) return;
      const td = document.createElement('td');
      td.id = 'button-hideprofile';
      td.title = 'Скрыть минипрофиль';
      const img = document.createElement('img');
      img.src = ICON_URL;
      img.alt = '';
      td.appendChild(img);
      td.addEventListener('click', insertHideProfileTag);
      container.appendChild(td);
    } else {
      const additionArea = document.getElementById('addition-area');
      if (!additionArea || additionArea.querySelector('.hideprofile-div'))
        return;
      const div = document.createElement('div');
      div.className = 'hideprofile-div';
      const span = document.createElement('span');
      span.textContent = 'Скрыть минипрофиль';
      div.appendChild(span);
      div.addEventListener('click', insertHideProfileTag);
      additionArea.appendChild(div);
    }
  }

  function applyHideProfileToPost(post) {
    if (post.classList.contains(HIDE_CLASS)) return;
    const body = post.querySelector(POST_BODY_SELECTOR);
    if (!body) return;
    if (body.innerHTML.includes(TAG)) {
      post.classList.add(HIDE_CLASS);
      body.innerHTML = body.innerHTML.split(TAG).join('');
    }
  }

  function applyHideProfileToAllPosts(root = document) {
    root.querySelectorAll(POST_SELECTOR).forEach(applyHideProfileToPost);
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    addHideProfileButton();
    applyHideProfileToAllPosts();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.applyHideProfileToAllPosts = applyHideProfileToAllPosts;
})();
