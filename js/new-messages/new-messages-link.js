(() => {
  'use strict';

  const { $, createEl } = window.helpers;
  const CFG = window.ScriptConfig.newMessagesLink;
  const ALLOWED_GROUPS = new Set(CFG.allowedGroupIds);

  function init() {
    if (!ALLOWED_GROUPS.has(window.GroupID)) return;

    const list = $('#pun-ulinks .container');
    if (!list) return;

    const li = createEl('li', { className: 'item1' });
    const a = createEl('a', { href: CFG.url, text: CFG.text });
    li.append(a);
    list.insertBefore(li, list.firstChild);
  }

  helpers.ready(init);
})();
