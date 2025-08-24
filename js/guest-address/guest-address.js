(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl } = helpers;
  const config = helpers.getConfig('guestAddress', {});

  function init() {
    const posts = document.querySelectorAll(
      `.post[data-group-id="${config.group}"]`,
    );

    posts.forEach((post) => {
      const authorCell = $(config.selector, post);
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
        (window.insertAddress || window.to)(authorName);
      });

      authorCell.replaceChild(linkElement, nameNode);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('guestAddress', { init });
})();
