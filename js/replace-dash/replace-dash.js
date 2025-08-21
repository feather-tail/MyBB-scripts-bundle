(() => {
  'use strict';

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const paragraphElements = document.querySelectorAll('.post-content p');
    const DASH_REGEX = /(^|[\s\u00A0])-(?=[\s\u00A0])/g;

    paragraphElements.forEach((paraNode) => {
      const walker = document.createTreeWalker(
        paraNode,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        const originalText = textNode.nodeValue;
        const newText = originalText.replace(DASH_REGEX, '$1\u2014');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
