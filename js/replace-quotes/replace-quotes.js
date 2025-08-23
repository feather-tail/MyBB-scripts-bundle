(() => {
  'use strict';

  const { $$ } = window.helpers;
  const CFG = window.ScriptConfig.replaceQuotes;

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    $$(CFG.selector).forEach((paragraphNode) => {
      const textWalker = document.createTreeWalker(
        paragraphNode,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );

      let textNode;
      while ((textNode = textWalker.nextNode())) {
        const originalText = textNode.nodeValue;
        const newText = originalText.replace(CFG.regex, '«$1»');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
