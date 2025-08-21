(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const authorCells = document.querySelectorAll(
      '.post[data-group-id="3"] .pa-author',
    );

    authorCells.forEach((authorCell, cellIndex) => {
      const textNodes = Array.from(authorCell.childNodes).filter(
        (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim(),
      );

      if (textNodes.length === 0) return;

      const nameNode = textNodes[textNodes.length - 1];
      const authorName = nameNode.nodeValue.trim();

      const linkElement = document.createElement('a');
      linkElement.textContent = authorName;
      linkElement.href = '#';
      linkElement.addEventListener('click', (event) => {
        event.preventDefault();
        to(authorName);
      });

      authorCell.replaceChild(linkElement, nameNode);
    });
  });
})();
