(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$ } = helpers;
  const config = helpers.getConfig('replaceDash', {});

  function init() {
    const paragraphElements = $$(config.paragraphSelector);

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
        const newText = originalText.replace(config.dashRegex, '$1\u2014');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('replaceDash', { init });
})();
