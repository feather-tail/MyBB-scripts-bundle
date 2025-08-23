(() => {
  'use strict';

  const { $ } = window.helpers;
  const CFG = helpers.getConfig('quoteBubble', {});

  function init() {
    const topic = $(`#${CFG.topicId}`);
    if (!topic) return;

    const bubble = $(`#${CFG.bubbleId}`);
    $('img', bubble).src = CFG.iconUrl;

    let currentPost = null;

    function showBubble(rect, post) {
      bubble.style.left = window.scrollX + rect.right + CFG.offsetX + 'px';
      bubble.style.top = window.scrollY + rect.bottom + CFG.offsetY + 'px';
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
      const post = node?.closest(CFG.postSel);
      if (post) showBubble(rect, post);
      else hideBubble();
    }
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#' + CFG.bubbleId)) hideBubble();
    });
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('#' + CFG.bubbleId)) hideBubble();
    });

    document.addEventListener('selectionchange', () => {
      if (window.getSelection()?.isCollapsed) hideBubble();
    });
    window.addEventListener('scroll', hideBubble, true);
    window.addEventListener('resize', hideBubble, true);

    bubble.addEventListener('blur', hideBubble);
  }

  helpers.ready(init);
})();
