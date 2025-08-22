(() => {
  'use strict';
  window.ScriptConfig = {
    dice: {
      maxDice: 9,
      maxSides: 100,
      obfOffset: 1193,
    },
    fontResizer: {
      fontSelector: '.post-content, #main-reply',
      storageKey: 'postFontSize',
      minSize: 10,
      maxSize: 38,
      defaultSize: 14,
      insertAfterSelector: '',
      defaultAnchorSelector: '.post h3 strong',
    },
    balanceTool: {},
  };
})();
