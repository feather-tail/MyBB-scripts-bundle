(() => {
  'use strict';
  const { $ } = window.helpers;
  const CFG = helpers.getConfig('insertAddress', {});
  const messageField = $(CFG.selector);

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

  window.scripts = window.scripts || {};
  window.scripts.insertAddress = insertAddress;
})();
