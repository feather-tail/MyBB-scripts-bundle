(() => {
  'use strict';

  const { $, createEl, showToast } = window.helpers;
  const CFG = helpers.getConfig('mutualPR', {});

  function getGroupID() {
    return typeof window.GroupID !== 'undefined' ? +window.GroupID : null;
  }

  function getTopicSubject() {
    return window.FORUM?.get?.('topic.subject') || '';
  }

  function isAllowed() {
    return (
      CFG.ALLOWED_GROUPS.includes(getGroupID()) &&
      getTopicSubject().includes(CFG.TARGET_TOPIC)
    );
  }

  function showNotification(text) {
    if (window.jGrowl) {
      window.jGrowl(text);
    } else if (showToast) {
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
        CFG.PR_TEMPLATES[Math.floor(Math.random() * CFG.PR_TEMPLATES.length)];

      const linksUl = $('.post-links ul', post);
      if (!linksUl) return;

      const li = createEl('li', { className: 'pl-mutualPR' });
      const btn = createEl('a', { href: '#', text: CFG.BUTTON_LABEL });
      btn.onclick = (e) => {
        e.preventDefault();
        const textarea = createEl('textarea', { value: template + linkBB });
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showNotification(CFG.COPY_SUCCESS_TEXT);
        } finally {
          document.body.removeChild(textarea);
        }
      };
      li.appendChild(btn);
      linksUl.appendChild(li);
    });
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    if (!isAllowed()) return;
    addMutualPRButtons();

    if (window.RusffCore && window.RusffCore.sets) {
      window.RusffCore.sets.show_reportBtn = 0;
    }
  }

  ['pun_main_ready', 'pun_post'].forEach((event) =>
    document.addEventListener(event, init),
  );

  helpers.ready(init);
})();
