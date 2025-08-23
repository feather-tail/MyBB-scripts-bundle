(() => {
  'use strict';

  const { $, createEl } = window.helpers;
  const CFG = window.ScriptConfig.guestAddress;
  const insertAddress = window.insertAddress || window.to;

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    const posts = document.querySelectorAll(
      `.post[data-group-id="${CFG.group}"]`,
    );

    posts.forEach((post) => {
      const authorCell = $(CFG.selector, post);
      if (!authorCell) return;

      const textNodes = Array.from(authorCell.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim(),
      );

      if (textNodes.length === 0) return;

      const nameNode = textNodes[textNodes.length - 1];
      const authorName = nameNode.nodeValue.trim();

      const linkElement = createEl('a', { text: authorName, href: '#' });
      linkElement.addEventListener('click', (event) => {
        event.preventDefault();
        insertAddress(authorName);
      });

      authorCell.replaceChild(linkElement, nameNode);
    });
  }

  helpers.ready(init);
})();
