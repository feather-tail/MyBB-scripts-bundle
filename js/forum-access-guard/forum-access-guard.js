(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, getGroupId } = helpers;
  const config = helpers.getConfig('forumAccessGuard', {
    allowedGroupIds: ['1', '2'],
    protectedForumIds: ['8'],
    hideRowsOnIndex: true,
    blockMode: 'replace',
    redirectUrl: '/',
    selectors: {
      forumRowIdPrefix: 'forum_f',
      mainContainer: '#pun-main, #brd-main, main, #container, body',
    },
    texts: {
      blockedTitle: 'Доступ ограничен',
      blockedMessage: 'У вас нет прав для просмотра этого раздела.',
      blockedHint:
        'Если вы считаете, что это ошибка, свяжитесь с администрацией.',
    },
  });

  const ALLOWED = new Set((config.allowedGroupIds || []).map(String));
  const PROTECTED = new Set((config.protectedForumIds || []).map(String));
  const ROW_PREFIX = (config.selectors?.forumRowIdPrefix || 'forum_f') + '';
  const MAIN_CONTAINER_SEL =
    config.selectors?.mainContainer ||
    '#pun-main, #brd-main, main, #container, body';
  const BLOCK_MODE = config.blockMode === 'redirect' ? 'redirect' : 'replace';
  const REDIRECT_URL = config.redirectUrl || '/';

  const getQueryParam = (name, href) => {
    try {
      const u = new URL(href || location.href);
      return u.searchParams.get(name);
    } catch {
      return null;
    }
  };

  const pathEndsWith = (file) => {
    const p = location.pathname.toLowerCase();
    return p.endsWith('/' + file) || p.endsWith(file);
  };

  const isViewForum = () => pathEndsWith('viewforum.php');
  const isViewTopic = () => pathEndsWith('viewtopic.php');
  const isIndexLike = () => !isViewForum() && !isViewTopic();

  const getUserGroups = () => {
    const groups = new Set();

    try {
      const g = getGroupId && getGroupId();
      if (g != null) groups.add(String(g));
    } catch {}

    const meta = document.querySelector('meta[name="user-groups"]');
    if (meta?.content) {
      meta.content
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((id) => groups.add(id));
    }

    try {
      const u = window.MYBB && window.MYBB.user;
      if (u) {
        if (u.usergroup != null) groups.add(String(u.usergroup));
        if (u.additionalgroups) {
          String(u.additionalgroups)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((id) => groups.add(id));
        }
      }
    } catch {}

    return Array.from(groups);
  };

  const userIsAllowed = () => {
    const gs = getUserGroups();
    return gs.some((g) => ALLOWED.has(String(g)));
  };

  const getViewForumId = () => getQueryParam('id');

  const getTopicForumId = () => {
    try {
      const fid =
        window.FORUM && window.FORUM.topic && window.FORUM.topic.forum_id;
      if (typeof fid === 'string' && fid) return fid;
      if (typeof fid === 'number') return String(fid);
    } catch {}

    const link = document.querySelector('a[href*="viewforum.php?id="]');
    if (link) {
      const id = getQueryParam('id', link.href);
      if (id) return id;
    }
    return null;
  };

  const hideProtectedForumRows = () => {
    if (!config.hideRowsOnIndex) return;
    PROTECTED.forEach((fid) => {
      const row = document.getElementById(ROW_PREFIX + fid);
      if (row) row.classList.add('forum-guard-row-hidden');
    });
  };

  const blockPage = () => {
    if (BLOCK_MODE === 'redirect' && REDIRECT_URL) {
      try {
        location.replace(REDIRECT_URL);
        return;
      } catch {}
    }

    const box = createEl('div', {
      className: 'forum-guard-block',
    });

    const titleEl = createEl('h2', {
      className: 'forum-guard-title',
      text: config.texts.blockedTitle,
    });

    const msgEl = createEl('p', {
      className: 'forum-guard-message',
      text: config.texts.blockedMessage,
    });

    const hintEl = createEl('p', {
      className: 'forum-guard-hint',
      text: config.texts.blockedHint,
    });

    box.append(titleEl, msgEl, hintEl);

    ($(MAIN_CONTAINER_SEL) || document.body).replaceChildren(box);
    document.title = config.texts.blockedTitle || document.title;
  };

  function init() {
    const allowed = userIsAllowed();

    if (!allowed && isIndexLike()) {
      hideProtectedForumRows();
    }

    if (!allowed && isViewForum()) {
      const fid = getViewForumId();
      if (fid && PROTECTED.has(String(fid))) {
        blockPage();
        return;
      }
    }

    if (!allowed && isViewTopic()) {
      const fid = getTopicForumId();
      if (fid && PROTECTED.has(String(fid))) {
        blockPage();
        return;
      }
    }
  }

  helpers.runOnceOnReady(init);
  helpers.register('forumAccessGuard', { init });
})();
