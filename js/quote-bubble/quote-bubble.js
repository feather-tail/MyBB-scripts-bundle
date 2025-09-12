(() => {
  'use strict';

  const helpers = window.helpers;
  const { $ } = helpers;
  const config = helpers.getConfig('quoteBubble', {});

  function init() {
    const topic = $(`#${config.topicId}`);
    if (!topic) return;

    const bubble = $(`#${config.bubbleId}`);
    $('img', bubble).src = config.iconUrl;

    let currentPost = null;

    function showBubble(rect, post) {
      bubble.style.left = window.scrollX + rect.right + config.offsetX + 'px';
      bubble.style.top = window.scrollY + rect.bottom + config.offsetY + 'px';
      bubble.classList.add('show');
      currentPost = post;
    }
    function hideBubble() {
      bubble.classList.remove('show');
      currentPost = null;
    }

    bubble.addEventListener('mousedown', (e) => e.preventDefault());
    bubble.addEventListener('click', (e) => {
      if (!currentPost) return;
      const quoteBtn = $('.pl-quote a, .post-quote a', currentPost);
      if (quoteBtn) quoteBtn.click();
      hideBubble();
    });

    function handleSelection(e) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return hideBubble();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return hideBubble();

      let node = sel.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      const post = node?.closest(config.postSel);
      if (post) showBubble(rect, post);
      else hideBubble();
    }
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#' + config.bubbleId)) hideBubble();
    });
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('#' + config.bubbleId)) hideBubble();
    });

    document.addEventListener('selectionchange', () => {
      if (window.getSelection()?.isCollapsed) hideBubble();
    });
    window.addEventListener('scroll', hideBubble, true);
    window.addEventListener('resize', hideBubble, true);

    bubble.addEventListener('blur', hideBubble);
  }

  helpers.runOnceOnReady(init);
  helpers.register('quoteBubble', { init });
})();
