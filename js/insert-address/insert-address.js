(() => {
  'use strict';

  const helpers = window.helpers;
  const { $ } = helpers;
  const config = helpers.getConfig('insertAddress', {});
  let messageField;

  const insertAddress = (userName) => {
    const snippet = config.snippet.replace('{{USER}}', userName);

    if (typeof insert === 'function') {
      insert(snippet);
    } else if (messageField) {
      const { selectionStart: start, selectionEnd: end } = messageField;
      messageField.setRangeText(snippet, start, end, 'end');
      messageField.focus();
    }
  };

  function init() {
    messageField = $(config.selector);
  }

  helpers.runOnceOnReady(init);
  window.insertAddress = helpers.register('insertAddress', insertAddress);
  window.to = window.insertAddress;
})();
