(() => {
  'use strict';

  const helpers = window.helpers;
  const { $ } = helpers;

  const cfg = helpers.getConfig('quoteBubble', {
    topicId: 'pun-viewtopic',
    postSel: '.post[id]',
    bubbleId: 'quote-bubble',
    iconUrl: '',
    text: 'Цитировать',
    offsetX: 6,
    offsetY: 4,
    margin: 6
  });

  let bubble = null;
  let currentPost = null;

  function createBubble() {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = cfg.bubbleId;
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-label', cfg.text);

    const img = document.createElement('img');
    img.alt = '';
    if (cfg.iconUrl) img.src = cfg.iconUrl;

    const span = document.createElement('span');
    span.textContent = cfg.text;

    el.append(img, span);

    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', () => {
      if (!currentPost) return;
      const quoteBtn = $('.pl-quote a, .post-quote a', currentPost);
      if (quoteBtn) quoteBtn.click();
      hideBubble();
    });

    return el;
  }

  function ensureBubbleIn(post) {
    if (!bubble) bubble = createBubble();

    if (bubble.parentNode !== post) {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
      if (getComputedStyle(post).position === 'static') post.style.position = 'relative';
      post.appendChild(bubble);
    }
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

  function showAt(left, top, post) {
    ensureBubbleIn(post);
    currentPost = post;

    bubble.style.visibility = 'hidden';
    bubble.classList.add('show');

    const maxLeft = post.clientWidth  - bubble.offsetWidth  - 4;
    const maxTop  = post.clientHeight - bubble.offsetHeight - 4;

    bubble.style.left = clamp(left, 4, maxLeft) + 'px';
    bubble.style.top  = clamp(top,  4, maxTop)  + 'px';

    bubble.style.visibility = '';
  }

  function placeByPointer(e, post) {
    const host = post.getBoundingClientRect();
    const m = cfg.margin || 0;
    const x = (e.clientX - host.left) + m;
    const y = (e.clientY - host.top)  + m;
    showAt(x, y, post);
  }

  function placeByRect(rect, post) {
    const host = post.getBoundingClientRect();
    const x = (rect.right  - host.left) + (cfg.offsetX || 0);
    const y = (rect.bottom - host.top)  + (cfg.offsetY || 0);
    showAt(x, y, post);
  }

  function hideBubble() {
    if (!bubble) return;
    bubble.classList.remove('show');
    currentPost = null;
  }

  function handleSelection(evt) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return hideBubble();

    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    const post = node && node.closest && node.closest(cfg.postSel);
    if (!post) return hideBubble();

    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range) return hideBubble();

    const rect = range.getBoundingClientRect();
    if (!(rect.width || rect.height)) return hideBubble();

    if (evt && typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
      placeByPointer(evt, post);
    } else {
      placeByRect(rect, post);
    }
  }

  function init() {
    const topic = document.getElementById(cfg.topicId);
    if (!topic) return;

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', (ev) => {
      const t = ev.changedTouches && ev.changedTouches[0];
      handleSelection(t ? { clientX: t.clientX, clientY: t.clientY } : ev);
    });

    document.addEventListener('mousedown', (e) => {
      if (!bubble) return;
      if (!e.target.closest('#' + cfg.bubbleId)) hideBubble();
    });
    document.addEventListener('touchstart', (e) => {
      if (!bubble) return;
      if (!e.target.closest('#' + cfg.bubbleId)) hideBubble();
    });

    document.addEventListener('selectionchange', () => {
      if (window.getSelection()?.isCollapsed) hideBubble();
    });

    window.addEventListener('scroll', hideBubble, true);
    window.addEventListener('resize', hideBubble, true);

    document.addEventListener('blur', (e) => {
      if (e.target && e.target.id === cfg.bubbleId) hideBubble();
    }, true);
  }

  helpers.runOnceOnReady(init);
  helpers.register('quoteBubble', { init });
})();
