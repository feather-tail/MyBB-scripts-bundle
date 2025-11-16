(() => {
  'use strict';

  document.addEventListener('click', (event) => {
    const quoteBtn = event.target.closest('.pl-quote');
    if (!quoteBtn) return;

    const post = quoteBtn.closest('.post');
    if (!post) return;

    const lastEditEl = post.querySelector('.lastedit');
    const signatureEl = post.querySelector('.post-sig');

    if (!lastEditEl && !signatureEl) return;

    const originalLastEdit = lastEditEl ? lastEditEl.innerHTML : '';
    const originalSignature = signatureEl ? signatureEl.innerHTML : '';

    if (lastEditEl) lastEditEl.innerHTML = '';
    if (signatureEl) signatureEl.innerHTML = '';

    setTimeout(() => {
      if (lastEditEl) lastEditEl.innerHTML = originalLastEdit;
      if (signatureEl) signatureEl.innerHTML = originalSignature;
    }, 600);
  });
})();
