(() => {
  'use strict';

  const { $$, createEl } = window.helpers;
  const CFG = helpers.getConfig('quotePostLink', {});

  function init() {
    $$(CFG.selectors.cite).forEach((cite) => {
      const text = cite.textContent;
      const match = text.match(/^(#p\d+),(.*)$/s);
      if (!match) return;
      const postId = match[1].trim();
      const label = match[2].trim();
      let href = '';
      if (document.querySelector(CFG.selectors.post(postId))) {
        href = CFG.linkTemplates.sameTopic(postId);
      } else {
        href = CFG.linkTemplates.otherTopic(postId.slice(2), postId);
      }
      const link = createEl('a', {
        className: 'qc-post-link',
        href,
        text: label,
      });
      cite.innerHTML = '';
      cite.appendChild(link);
    });

    $$(CFG.selectors.inlineQuote).forEach((a) => {
      const post = a.closest(CFG.selectors.postRoot);
      if (!post) return;
      const postId = post.id;
      a.href = a.href.replace("('", `('#${postId},`);
    });
  }

  helpers.ready(init);
})();
