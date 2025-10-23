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
      currentPost = post;
      bubble.classList.add('show');
    
      const margin = 6;
      const vw = document.documentElement.clientWidth;
    
      let left = window.scrollX + rect.left + (rect.width - bubble.offsetWidth) / 2;
      let top  = window.scrollY + rect.top - bubble.offsetHeight - margin;
    
      if (top < window.scrollY + 4) {
        top = window.scrollY + rect.bottom + margin;
      }
    
      left = Math.max(window.scrollX + 4,
              Math.min(left, window.scrollX + vw - bubble.offsetWidth - 4));
    
      bubble.style.left = left + 'px';
      bubble.style.top  = top  + 'px';
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
