(() => {
  'use strict';

  const SETTINGS = {
    bubbleId: 'quote-bubble',
    iconUrl:
      'http://www.iconsearch.ru/uploads/icons/crystalclear/16x16/comment.png',
    postSel: '.post[id]',
    topicId: 'pun-viewtopic',
    offsetX: 8,
    offsetY: 8,
  };

  (() => {
    const topic = document.getElementById(SETTINGS.topicId);
    if (!topic) return;

    const bubble = document.getElementById(SETTINGS.bubbleId);
    bubble.querySelector('img').src = SETTINGS.iconUrl;

    let currentPost = null;

    function showBubble(rect, post) {
      bubble.style.left = window.scrollX + rect.right + SETTINGS.offsetX + 'px';
      bubble.style.top = window.scrollY + rect.bottom + SETTINGS.offsetY + 'px';
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
      const quoteBtn = currentPost.querySelector('.pl-quote a, .post-quote a');
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
      const post = node?.closest(SETTINGS.postSel);
      if (post) showBubble(rect, post);
      else hideBubble();
    }
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);

    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#' + SETTINGS.bubbleId)) hideBubble();
    });
    document.addEventListener('touchstart', (e) => {
      if (!e.target.closest('#' + SETTINGS.bubbleId)) hideBubble();
    });

    document.addEventListener('selectionchange', () => {
      if (window.getSelection()?.isCollapsed) hideBubble();
    });
    window.addEventListener('scroll', hideBubble, true);
    window.addEventListener('resize', hideBubble, true);

    bubble.addEventListener('blur', hideBubble);
  })();
})();
