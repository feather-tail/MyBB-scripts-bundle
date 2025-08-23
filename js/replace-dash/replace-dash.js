(() => {
  'use strict';

  const { $$ } = window.helpers;
  const CFG = window.ScriptConfig.replaceDash;

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

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
