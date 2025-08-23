(() => {
  'use strict';
  const { $ } = window.helpers;
  const CFG = helpers.getConfig('insertAddress', {});
  let messageField;

  const insertAddress = (userName) => {
    const snippet = CFG.snippet.replace('{{USER}}', userName);

    if (typeof insert === 'function') {
      insert(snippet);
    } else if (messageField) {
      const { selectionStart: start, selectionEnd: end } = messageField;
      messageField.setRangeText(snippet, start, end, 'end');
      messageField.focus();
    }
  };

  function init() {
    messageField = $(CFG.selector);
  }

  helpers.ready(init);

  window.scripts = window.scripts || {};
  window.scripts.insertAddress = insertAddress;
})();
