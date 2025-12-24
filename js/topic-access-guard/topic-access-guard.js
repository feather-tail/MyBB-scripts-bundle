(() => {
  'use strict';

  const CFG = window.ScriptConfig?.topicAccessGuard;
  if (!CFG) return;

  const log = (...a) =>
    CFG.debug && console.log('%c[TopicGuard]', 'color:#ffb86c', ...a);

  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const uniqPush = (arr, v) => {
    if (v == null) return;
    if (!arr.includes(v)) arr.push(v);
  };

  const toNumberOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const parseRegex = (x) => {
    if (!x) return null;
    if (x instanceof RegExp) return x;
    if (typeof x !== 'string') return null;

    const m = x.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      try {
        return new RegExp(m[1], m[2]);
      } catch {
        return null;
      }
    }

    try {
      return new RegExp(x, 'i');
    } catch {
      return null;
    }
  };

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const parseIdFromHref = (href, param = 'id') => {
    if (!href) return null;
    try {
      const u = new URL(href, location.origin);
      return toNumberOrNull(u.searchParams.get(param));
    } catch {
      const re = new RegExp(`[?&]${param}=(\\d+)`, 'i');
      const m = String(href).match(re);
      return m ? toNumberOrNull(m[1]) : null;
    }
  };

  const getQueryInt = (param) =>
    toNumberOrNull(new URLSearchParams(location.search).get(param));

  const currentUser = {
    id: toNumberOrNull(window.UserID) || 0,
    login: String(window.UserLogin || '').trim(),
  };

  if (!currentUser.id && !currentUser.login) return;

  const rules = Array.isArray(CFG.users) ? CFG.users : [];

  const active = {
    topicIds: [],
    subjectIncludes: [],
    subjectRegexes: [],
  };

  const userMatchesRule = (r) => {
    if (!r || typeof r !== 'object') return false;

    const idOk =
      toNumberOrNull(r.userId) && toNumberOrNull(r.userId) === currentUser.id;
    const loginOk = r.login && norm(r.login) === norm(currentUser.login);

    const idsOk =
      Array.isArray(r.userIds) &&
      r.userIds.map(toNumberOrNull).includes(currentUser.id);
    const loginsOk =
      Array.isArray(r.logins) &&
      r.logins.some((x) => norm(x) === norm(currentUser.login));

    return Boolean(idOk || loginOk || idsOk || loginsOk);
  };

  for (const r of rules) {
    if (!userMatchesRule(r)) continue;
    const b = r.block || {};

    if (Array.isArray(b.topicIds)) {
      for (const id of b.topicIds) {
        const n = toNumberOrNull(id);
        if (n) uniqPush(active.topicIds, n);
      }
    }

    if (Array.isArray(b.subjectIncludes)) {
      for (const s of b.subjectIncludes) {
        const v = norm(s);
        if (v) uniqPush(active.subjectIncludes, v);
      }
    }

    if (Array.isArray(b.subjectRegex)) {
      for (const rx of b.subjectRegex) {
        const re = parseRegex(rx);
        if (re) active.subjectRegexes.push(re);
      }
    }
  }

  const hasAnyBlock =
    active.topicIds.length ||
    active.subjectIncludes.length ||
    active.subjectRegexes.length;

  if (!hasAnyBlock) return;

  const blockedIdSet = new Set(active.topicIds);

  const isBlockedTopic = ({ topicId, subject }) => {
    if (topicId && blockedIdSet.has(topicId)) return true;

    const subj = norm(subject);
    if (subj) {
      for (const inc of active.subjectIncludes) {
        if (inc && subj.includes(inc)) return true;
      }
      for (const re of active.subjectRegexes) {
        try {
          if (re.test(subject || '')) return true;
        } catch {}
      }
    }

    return false;
  };

  const ensureCSS = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;

      const style = document.createElement('style');
      style.id = 'ks-topic-guard-css';
      style.textContent = `
        .ks-topic-guarded-link {
          cursor: not-allowed !important;
          text-decoration: none !important;
          opacity: .65;
        }
        .ks-topic-guard-lock {
          overflow: hidden !important;
        }
        #ks-topic-guard-overlay {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0,0,0,.78);
          backdrop-filter: blur(3px);
        }
        #ks-topic-guard-overlay .ks-guard-card {
          width: min(680px, 100%);
          border-radius: 14px;
          padding: 18px 18px 14px;
          background: rgba(30,30,34,.92);
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 10px 40px rgba(0,0,0,.45);
          color: #fff;
          font: 14px/1.45 Arial, sans-serif;
        }
        #ks-topic-guard-overlay .ks-guard-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        #ks-topic-guard-overlay .ks-guard-text {
          margin: 0 0 14px;
          opacity: .9;
        }
        #ks-topic-guard-overlay .ks-guard-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        #ks-topic-guard-overlay .ks-guard-btn {
          border-radius: 10px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.08);
          color: #fff;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        #ks-topic-guard-overlay .ks-guard-btn:hover {
          background: rgba(255,255,255,.14);
        }
      `;
      document.head.appendChild(style);
    };
  })();

  const showOverlay = ({ title, text, homeUrl, showBackButton }) => {
    if (document.getElementById('ks-topic-guard-overlay')) return;

    ensureCSS();
    document.documentElement.classList.add('ks-topic-guard-lock');
    document.body.classList.add('ks-topic-guard-lock');

    const o = document.createElement('div');
    o.id = 'ks-topic-guard-overlay';

    const t = title || 'Доступ запрещён';
    const msg = text || 'У вас нет доступа к этой теме.';
    const home = homeUrl || '/';

    o.innerHTML = `
      <div class="ks-guard-card" role="dialog" aria-modal="true">
        <div class="ks-guard-title">${escapeHtml(t)}</div>
        <p class="ks-guard-text">${escapeHtml(msg)}</p>
        <div class="ks-guard-actions">
          <a class="ks-guard-btn" href="${escapeAttr(home)}">На главную</a>
          ${
            showBackButton
              ? `<a class="ks-guard-btn" href="#" data-ks-guard-back="1">Назад</a>`
              : ''
          }
        </div>
      </div>
    `;

    o.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    o.querySelector('[data-ks-guard-back="1"]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        history.back();
      },
    );

    document.body.appendChild(o);
  };

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, '&#096;');
  }

  const killLink = (a) => {
    if (!a || a.nodeType !== 1) return;
    a.removeAttribute('href');
    a.removeAttribute('onclick');
    a.classList.add('ks-topic-guarded-link');
    a.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true,
    );
  };

  const maskTopicRow = (scope, topicId) => {
    if (!scope || !topicId) return;

    const anchors = scope.querySelectorAll(
      'a[href*="viewtopic.php"], a[href*="post.php"]',
    );
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const vid = parseIdFromHref(href, 'id');
      const tid = parseIdFromHref(href, 'tid');
      if (vid === topicId || tid === topicId) killLink(a);
    });

    scope.querySelectorAll('.newtext, .pagestext').forEach((el) => el.remove());
  };

  const replaceTopicTitleInLink = (a) => {
    const repl = CFG.listReplacementText || 'Доступ запрещён';
    a.textContent = repl;
    a.setAttribute('title', repl);
    killLink(a);
  };

  const shouldSkipAnchor = (a) => {
    const skipSel =
      CFG.selectors?.skipWithin ||
      '.post-content, .post-box, .post .container, .post .content';
    return Boolean(a.closest(skipSel));
  };

  const processLists = (root = document) => {
    if (CFG.behavior?.hideInLists === false) return;

    const sel = CFG.selectors?.topicLinks || 'a[href*="viewtopic.php?id="]';
    const links = root.querySelectorAll(sel);

    links.forEach((a) => {
      if (!a || a.dataset.ksTopicGuardDone === '1') return;
      a.dataset.ksTopicGuardDone = '1';

      if (shouldSkipAnchor(a)) return;

      const href = a.getAttribute('href') || '';
      const topicId = parseIdFromHref(href, 'id');
      const subject = a.textContent?.trim() || '';

      if (!isBlockedTopic({ topicId, subject })) return;

      replaceTopicTitleInLink(a);

      const row =
        a.closest('tr') ||
        a.closest('td') ||
        a.closest('.tcr-wrap') ||
        a.parentElement;
      if (row) maskTopicRow(row, topicId);

      log('Masked topic in list:', { topicId, subject });
    });
  };

  const getTopicSubject = () => {
    const s1 = window.FORUM?.topic?.subject;
    if (s1) return String(s1);

    const h1 = document.querySelector('h1, #pun-title h1, .pun-title h1');
    if (h1?.textContent) return h1.textContent.trim();

    return document.title || '';
  };

  const disablePosting = (topicId) => {
    if (CFG.behavior?.disablePosting === false) return;

    const pf = document.querySelector('#post-form');
    if (pf) pf.remove();

    const forms = document.querySelectorAll('form[action*="post.php"]');
    forms.forEach((f) => {
      const tid = parseIdFromHref(f.getAttribute('action') || '', 'tid');
      if (tid !== topicId) return;

      f.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        },
        true,
      );

      f.removeAttribute('onsubmit');
    });

    document.querySelectorAll('a[href*="post.php?tid="]').forEach((a) => {
      const tid = parseIdFromHref(a.getAttribute('href') || '', 'tid');
      if (tid === topicId) killLink(a);
    });
  };

  const processTopicAccess = () => {
    const path = (location.pathname || '').toLowerCase();

    const isViewTopic =
      path.endsWith('/viewtopic.php') || path.endsWith('viewtopic.php');
    const isPostPage = path.endsWith('/post.php') || path.endsWith('post.php');

    let topicId = null;
    if (isViewTopic) topicId = getQueryInt('id');
    if (isPostPage) topicId = getQueryInt('tid');

    if (!topicId) return;

    const subject = getTopicSubject();
    const blocked = isBlockedTopic({ topicId, subject });

    if (!blocked) return;

    log('Blocked topic page:', { topicId, subject });

    disablePosting(topicId);

    if (CFG.behavior?.blockView !== false) {
      const o = CFG.overlay || {};
      showOverlay({
        title: o.title,
        text: o.text,
        homeUrl: o.homeUrl,
        showBackButton: o.showBackButton !== false,
      });
    }
  };

  const setupObserver = () => {
    if (CFG.behavior?.useObserver === false) return;

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        processLists(document);
      });
    };

    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  onReady(() => {
    processLists(document);
    processTopicAccess();
    setupObserver();
  });
})();
