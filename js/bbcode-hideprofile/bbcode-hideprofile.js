(() => {
  'use strict';

  const helpers = window.helpers || {};
  const getCfg = (k, d) => (helpers.getConfig ? helpers.getConfig(k, d) : (window.ScriptConfig?.[k] || d));
  const cfg = getCfg('bbcodeHideProfile', {});

  const SELECTOR_POST = cfg.selectors?.post || '.post, .post-item, .postmsg';
  const SELECTOR_BODY = cfg.selectors?.postBody || '.post-body, .post_body, .postmsg';
  const HIDE_CLASS = cfg.hideClass || 'hide-profile';
  const TAG_RAW = cfg.tag || '[hideprofile]';

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const TAG_RX = new RegExp(esc(TAG_RAW), 'gi');
  const TAG_HTML_RX = /&#91;\s*hideprofile\s*&#93;/gi;

  function hasTag(html) {
    return TAG_RX.test(html) || TAG_HTML_RX.test(html);
  }
  function stripTag(html) {
    return html.replace(TAG_RX, '').replace(TAG_HTML_RX, '');
  }

  function applyToPost(post) {
    if (!post || post.classList.contains(HIDE_CLASS)) return;
    const body = post.querySelector(SELECTOR_BODY);
    if (!body) return;

    const html = body.innerHTML;
    if (hasTag(html)) {
      post.classList.add(HIDE_CLASS);
      body.innerHTML = stripTag(html);
    }
  }

  function scan(root = document) {
    root.querySelectorAll(SELECTOR_POST).forEach(applyToPost);
  }

  function observe() {
    const root = document.querySelector('#pun-main') || document.body;
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SELECTOR_POST)) applyToPost(n);
          n.querySelectorAll && n.querySelectorAll(SELECTOR_POST).forEach(applyToPost);
        });
      });
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  function insertHideProfileTag() {
    if (typeof insert === 'function') insert(TAG_RAW);
  }

  function addHideProfileButton() {
    const allowed = (cfg.allowedGroups || []);
    const gid = helpers.getGroupId ? helpers.getGroupId() : null;
    if (!allowed.length || (gid !== null && !allowed.includes(gid))) return;

    if (cfg.selectors?.buttonInsert) {
      const container = document.querySelector(cfg.selectors.buttonInsert);
      if (!container || container.querySelector('#button-hideprofile')) return;
      const td = helpers.createEl ? helpers.createEl('td', { id: 'button-hideprofile', title: cfg.buttonText }) : document.createElement('td');
      td.id = 'button-hideprofile';
      td.title = cfg.buttonText || 'Скрыть минипрофиль';
      const img = helpers.createEl ? helpers.createEl('img', { src: cfg.buttonIcon || '/i/blank.gif', alt: '' }) : document.createElement('img');
      img.src = cfg.buttonIcon || '/i/blank.gif';
      img.alt = '';
      td.appendChild(img);
      td.addEventListener('click', insertHideProfileTag);
      container.appendChild(td);
    } else {
      const additionArea = document.getElementById('addition-area');
      if (!additionArea || additionArea.querySelector('.hideprofile-div')) return;
      const div = helpers.createEl ? helpers.createEl('div', { className: 'hideprofile-div' }) : document.createElement('div');
      div.className = 'hideprofile-div';
      const span = helpers.createEl ? helpers.createEl('span', { text: cfg.buttonText || 'Скрыть минипрофиль' }) : document.createElement('span');
      span.textContent = cfg.buttonText || 'Скрыть минипрофиль';
      div.appendChild(span);
      div.addEventListener('click', insertHideProfileTag);
      additionArea.appendChild(div);
    }
  }

  function init() {
    addHideProfileButton();
    scan();
    observe();
  }

  if (helpers.runOnceOnReady) helpers.runOnceOnReady(init);
  else (document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init));

  if (helpers.register) helpers.register('bbcodeHideProfile', { applyToAllPosts: scan });
})();
