(() => {
  'use strict';

  const helpers = window.helpers;
  const { $$, createEl } = helpers;
  const config = helpers.getConfig('quotePostLink', {});

  function init() {
    $$(config.selectors.cite).forEach((cite) => {
      const text = cite.textContent;
      const match = text.match(/^(#p\d+),(.*)$/s);
      if (!match) return;
      const postId = match[1].trim();
      const label = match[2].trim();
      let href = '';
      if (document.querySelector(config.selectors.post(postId))) {
        href = config.linkTemplates.sameTopic(postId);
      } else {
        href = config.linkTemplates.otherTopic(postId.slice(2), postId);
      }
      const link = createEl('a', {
        className: 'qc-post-link',
        href,
        text: label,
      });
      cite.innerHTML = '';
      cite.appendChild(link);
    });

    $$(config.selectors.inlineQuote).forEach((a) => {
      const post = a.closest(config.selectors.postRoot);
      if (!post) return;
      const postId = post.id;
      a.href = a.href.replace("('", `('#${postId},`);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('quotePostLink', { init });
})();
