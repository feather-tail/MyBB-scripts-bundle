(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, getGroupId } = helpers;
  const config = helpers.getConfig('newMessagesLink', {});
  const ALLOWED_GROUPS = new Set(config.allowedGroupIds);

  function init() {
    if (!ALLOWED_GROUPS.has(getGroupId())) return;

    const list = $('#pun-ulinks .container');
    if (!list) return;

    const li = createEl('li', { className: 'item1' });
    const a = createEl('a', { href: config.url, text: config.text });
    li.append(a);
    list.insertBefore(li, list.firstChild);
  }

  helpers.runOnceOnReady(init);
  helpers.register('newMessagesLink', { init });
})();
