(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('textReplace', {});

  function init() {
    const updateParentText = (
      elementSelector,
      searchValue,
      replacementValue,
    ) => {
      const parentElements = new Set();
      document.querySelectorAll(elementSelector).forEach((child) => {
        if (child.parentElement) {
          parentElements.add(child.parentElement);
        }
      });

      parentElements.forEach((parentEl) => {
        const walker = document.createTreeWalker(
          parentEl,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );
        let textNode;
        while ((textNode = walker.nextNode())) {
          const originalText = textNode.nodeValue;
          const newText = originalText.replace(searchValue, replacementValue);
          if (newText !== originalText) {
            textNode.nodeValue = newText;
          }
        }
      });
    };

    config.rules.forEach(({ selector, search, replace }) => {
      updateParentText(selector, search, replace);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('textReplace', { init });
})();
