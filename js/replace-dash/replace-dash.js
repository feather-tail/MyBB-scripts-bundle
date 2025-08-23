(() => {
  'use strict';

  const { $$ } = window.helpers;
  const CFG = helpers.getConfig('replaceDash', {});

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

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

  helpers.ready(init);
})();
