(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, showToast } = helpers;
  const config = helpers.getConfig('mutualPR', {});

  function getTopicSubject() {
    return window.FORUM?.get?.('topic.subject') || '';
  }

  function isAllowed() {
    return (
      config.ALLOWED_GROUPS.includes(helpers.getGroupId()) &&
      getTopicSubject().includes(config.TARGET_TOPIC)
    );
  }

  function showNotification(text) {
    if (showToast) {
      showToast(text, { type: 'info' });
    } else {
      console.log(text);
    }
  }

  function addMutualPRButtons() {
    document.querySelectorAll('.post').forEach((post) => {
      if ($('.pl-mutualPR', post)) return;

      const permalink = $('h3 span > a.permalink', post);
      if (!permalink) return;
      const linkBB = `\n\n[url=${permalink.href}]Взаимная реклама[/url]`;

      const template =
        config.PR_TEMPLATES[
          Math.floor(Math.random() * config.PR_TEMPLATES.length)
        ];

      const linksUl = $('.post-links ul', post);
      if (!linksUl) return;

      const li = createEl('li', { className: 'pl-mutualPR' });
      const btn = createEl('a', { href: '#', text: config.BUTTON_LABEL });
      btn.onclick = async (e) => {
        e.preventDefault();
        if (await helpers.copyToClipboard(template + linkBB)) {
          showNotification(config.COPY_SUCCESS_TEXT);
        }
      };
      li.appendChild(btn);
      linksUl.appendChild(li);
    });
  }

  function init() {
    if (!isAllowed()) return;
    addMutualPRButtons();

    if (window.RusffCore && window.RusffCore.sets) {
      window.RusffCore.sets.show_reportBtn = 0;
    }
  }

  const run = helpers.once(init);
  ['pun_main_ready', 'pun_post'].forEach((event) =>
    document.addEventListener(event, run),
  );

  helpers.ready(run);
  helpers.register('mutualPR', { init });
})();
