(() => {
  'use strict';

  const { $$ } = window.helpers;
  const CFG = helpers.getConfig('replaceDash', {});

  function init() {
    const paragraphElements = $$(CFG.paragraphSelector);

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
        const newText = originalText.replace(CFG.dashRegex, '$1\u2014');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  }

  helpers.ready(helpers.once(init));
})();
