(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$ } = helpers;
  const config = helpers.getConfig('replaceQuotes', {});

  function init() {
    $$(config.selector).forEach((paragraphNode) => {
      const textWalker = document.createTreeWalker(
        paragraphNode,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );

      let textNode;
      while ((textNode = textWalker.nextNode())) {
        const originalText = textNode.nodeValue;
        const newText = originalText.replace(config.regex, '«$1»');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('replaceQuotes', { init });
})();
