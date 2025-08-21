(() => {
  const ALLOWED_GROUPS = [1, 2, 4, 5];
  const TARGET_TOPIC = 'Техническая тема';
  const PR_TEMPLATES = [
    `[align=center][url=YOUR_LINK][img]YOUR_IMG[/img][/url][/align]`,
  ];
  const COPY_SUCCESS_TEXT =
    'Наш шаблон и ссылка на взаимную рекламу скопированы!';
  const BUTTON_LABEL = 'Взаимная реклама';

  function getGroupID() {
    return typeof window.GroupID !== 'undefined' ? +window.GroupID : null;
  }

  function getTopicSubject() {
    return window.FORUM?.get?.('topic.subject') || '';
  }

  function isAllowed() {
    return (
      ALLOWED_GROUPS.includes(getGroupID()) &&
      getTopicSubject().includes(TARGET_TOPIC)
    );
  }

  function showNotification(text) {
    if (window.jGrowl) {
      window.jGrowl(text);
    } else {
      alert(text);
    }
  }

  function addMutualPRButtons() {
    document.querySelectorAll('.post').forEach((post) => {
      if (post.querySelector('.pl-mutualPR')) return;

      const permalink = post.querySelector('h3 span > a.permalink');
      if (!permalink) return;
      const linkBB = `\n\n[url=${permalink.href}]Взаимная реклама[/url]`;

      const template =
        PR_TEMPLATES[Math.floor(Math.random() * PR_TEMPLATES.length)];

      const linksUl = post.querySelector('.post-links ul');
      if (!linksUl) return;

      const li = document.createElement('li');
      li.className = 'pl-mutualPR';
      const btn = document.createElement('a');
      btn.href = '#';
      btn.textContent = BUTTON_LABEL;
      btn.onclick = (e) => {
        e.preventDefault();
        const textarea = document.createElement('textarea');
        textarea.value = template + linkBB;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showNotification(COPY_SUCCESS_TEXT);
        } finally {
          document.body.removeChild(textarea);
        }
      };
      li.appendChild(btn);
      linksUl.appendChild(li);
    });
  }

  function onForumEvents() {
    if (!isAllowed()) return;
    addMutualPRButtons();

    if (window.RusffCore && window.RusffCore.sets) {
      window.RusffCore.sets.show_reportBtn = 0;
    }
  }

  ['pun_main_ready', 'pun_post'].forEach((event) =>
    document.addEventListener(event, onForumEvents),
  );

  if (document.readyState !== 'loading') onForumEvents();
  else document.addEventListener('DOMContentLoaded', onForumEvents);
})();
