(function () {
  const messageField = document.querySelector('textarea');

  const insertAddress = (userName) => {
    const snippet = `[b]${userName}[/b], `;

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
