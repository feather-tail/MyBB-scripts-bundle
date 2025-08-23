(() => {
  'use strict';
  const { $ } = window.helpers;
  const CFG = window.ScriptConfig.insertAddress;
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

  window.to = insertAddress;
})();
