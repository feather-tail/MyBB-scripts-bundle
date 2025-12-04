(() => {
  'use strict';

  const cfg = window.ScriptConfig && window.ScriptConfig.userActivityIndicator;
  if (!cfg) return;

  const sel = cfg.selectors || {};
  const cls = cfg.classes || {};
  const txt = cfg.texts || {};

  const POST_SELECTOR = sel.post || '.post';
  const AUTHOR_BLOCK_SELECTOR = sel.authorBlock || '.post-author';
  const AUTHOR_LINK_SELECTOR = sel.authorLink || '.pa-author > a';
  const LAST_VISIT_SELECTOR = sel.lastVisit || '.pa-last-visit';
  const ACTIVE_TIME_SELECTOR = sel.activeTime || '.pa-online';

  const ROOT_ONLINE_CLASS = cls.authorOnlineRoot || 'online';
  const LINK_ONLINE_CLASS = cls.linkOnline || 'online';
  const LINK_OFFLINE_CLASS = cls.linkOffline || 'offline';
  const IND_ONLINE_CLASS = cls.indicatorOnline || 'indOnline';
  const IND_OFFLINE_CLASS = cls.indicatorOffline || 'indOffline';

  const LAST_VISIT_PREFIX = txt.lastVisitPrefix || 'Последний визит:';
  const ACTIVE_PREFIX = txt.activePrefix || 'Активен';
  const TITLE_ONLINE_TEMPLATE = txt.titleOnline || 'Онлайн {{time}}';
  const TITLE_OFFLINE_TEMPLATE = txt.titleOffline || 'Был(а) онлайн {{time}}';

  const getTextAfterPrefix = (raw, prefix) => {
    if (!raw) return '';
    let text = String(raw);
    if (prefix) {
      const idx = text.indexOf(prefix);
      if (idx !== -1) {
        text = text.slice(idx + prefix.length);
      }
    }
    return text.trim().toLowerCase();
  };

  const createIndicator = (className, titleTemplate, time) => {
    const span = document.createElement('span');
    span.className = className;
    const filled = titleTemplate.replace('{{time}}', time || '').trim();
    span.title = filled;
    return span;
  };

  const apply = () => {
    const posts = document.querySelectorAll(POST_SELECTOR);
    if (!posts.length) return;

    for (const post of posts) {
      const authorBlock = post.querySelector(AUTHOR_BLOCK_SELECTOR);
      if (!authorBlock) continue;

      const link = authorBlock.querySelector(AUTHOR_LINK_SELECTOR);
      if (!link) continue;

      const existingIndicator = authorBlock.querySelector(
        `.${IND_ONLINE_CLASS}, .${IND_OFFLINE_CLASS}`,
      );
      if (existingIndicator) continue;

      const isOnline = authorBlock.classList.contains(ROOT_ONLINE_CLASS);

      if (isOnline) {
        link.classList.add(LINK_ONLINE_CLASS);
        link.classList.remove(LINK_OFFLINE_CLASS);
      } else {
        link.classList.add(LINK_OFFLINE_CLASS);
        link.classList.remove(LINK_ONLINE_CLASS);
      }

      const lastVisitNode = post.querySelector(LAST_VISIT_SELECTOR);
      const activeTimeNode = post.querySelector(ACTIVE_TIME_SELECTOR);

      const lastVisitText = getTextAfterPrefix(
        lastVisitNode && lastVisitNode.textContent,
        LAST_VISIT_PREFIX,
      );

      const activeTimeText = getTextAfterPrefix(
        activeTimeNode && activeTimeNode.textContent,
        ACTIVE_PREFIX,
      );

      if (isOnline) {
        const indicator = createIndicator(
          IND_ONLINE_CLASS,
          TITLE_ONLINE_TEMPLATE,
          activeTimeText,
        );
        link.insertAdjacentElement('afterend', indicator);
      } else {
        const indicator = createIndicator(
          IND_OFFLINE_CLASS,
          TITLE_OFFLINE_TEMPLATE,
          lastVisitText,
        );
        link.insertAdjacentElement('afterend', indicator);
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
