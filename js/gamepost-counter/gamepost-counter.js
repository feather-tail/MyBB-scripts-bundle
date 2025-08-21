(() => {
  'use strict';

  const SETTINGS = {
    viewerGroups: [1, 2, 4],
    includeFirstPost: false,
    forumsRules: {
      defaultMode: 'all',
      perForum: new Map([
        ['2', { mode: 'all' }],
        // ['10', { mode:'include', topics:new Set([27]) }],
        // ['14', { mode:'exclude', topics:new Set([101]) }],
      ]),
    },

    ui: {
      showBadgesInTopic: true,
      badgeSource: 'week',
      profileBadgeSource: 'week',
      fieldId: 2,
      maxUsersToDecorate: 40,
      launcherAfter: '#button-addition',
      launcherText: 'Статистика постов',
      forumsOnly: [2],
    },

    backend: {
      endpoint: 'https://feathertail.ru/gamestats/index.php',
      subscription: 'KSPIRITS-TEST',
      tableKey: 'ks-global',
      limit: 20,
      scope: 'site',
    },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const last = (sel, root = document) => {
    const L = root.querySelectorAll(sel);
    return L.length ? L[L.length - 1] : null;
  };

  const PATH = {
    isTopic: () => /\/viewtopic\.php\b/i.test(location.pathname),
    isDelete: () => /\/delete\.php\b/i.test(location.pathname),
  };

  const getUser = () => ({
    id: Number(window.UserID || 0),
    name: (window.UserLogin || '').trim(),
    group: Number(window.GroupID || 0),
  });

  const parseQuery = () => {
    const obj = {};
    const q = location.search.slice(1);
    if (!q) return obj;
    for (const kv of q.split('&')) {
      if (!kv) continue;
      const [k, v = ''] = kv.split('=');
      obj[decodeURIComponent(k)] = decodeURIComponent(v);
    }
    return obj;
  };

  const getTopicId = () => {
    const a = last('#pun-crumbs1 a[href*="/viewtopic.php?id="]');
    if (a) {
      const m = a.href.match(/viewtopic\.php\?id=(\d+)/);
      if (m) return m[1];
    }
    const m2 = location.search.match(/(?:^|[?&])id=(\d+)/);
    return (m2 && m2[1]) || '';
  };

  const getForumId = () => {
    const fidFromGlobal =
      window.FORUM && window.FORUM.topic && window.FORUM.topic.forum_id
        ? String(window.FORUM.topic.forum_id)
        : '';
    if (fidFromGlobal) return fidFromGlobal;

    const a = last('#pun-crumbs1 a[href*="/viewforum.php?id="]');
    if (a) {
      const m = a.href.match(/viewforum\.php\?id=(\d+)/);
      if (m) return m[1];
    }
    const postForm = $('form#post[action*="/post.php?"]');
    const m2 = postForm && postForm.action.match(/fid=(\d+)/);
    return (m2 && m2[1]) || '';
  };

  function isCountable({ fid, tid, isFirstPost }) {
    if (!SETTINGS.includeFirstPost && isFirstPost) return false;
    const r = SETTINGS.forumsRules.perForum.get(String(fid));
    const mode = r?.mode || SETTINGS.forumsRules.defaultMode || 'all';
    if (mode === 'all') return true;
    const topics = r?.topics || new Set();
    if (mode === 'include') return topics.has(Number(tid));
    if (mode === 'exclude') return !topics.has(Number(tid));
    return false;
  }

  function sendUpdateFetch(body) {
    return fetch(`${SETTINGS.backend.endpoint}?method=update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(body),
    })
      .then((r) => r.json().catch(() => ({})))
      .catch(() => null);
  }

  async function getUserStats(userId) {
    const u =
      `${SETTINGS.backend.endpoint}?method=get_user` +
      `&subscription=${encodeURIComponent(SETTINGS.backend.subscription)}` +
      `&tableKey=${encodeURIComponent(SETTINGS.backend.tableKey)}` +
      `&userId=${userId}`;
    const res = await fetch(u, { credentials: 'include' });
    const data = await res.json().catch(() => null);
    return data?.ok ? data.user : null;
  }

  async function getTable() {
    const url =
      `${SETTINGS.backend.endpoint}?method=get_table` +
      `&subscription=${encodeURIComponent(SETTINGS.backend.subscription)}` +
      `&tableKey=${encodeURIComponent(SETTINGS.backend.tableKey)}` +
      `&limit=${SETTINGS.backend.limit}` +
      `&scope=${SETTINGS.backend.scope}`;
    const res = await fetch(url, { credentials: 'include' });
    return res.json().catch(() => null);
  }

  function normalizeCounterLi(li, value) {
    if (!li) return;
    const nameSpan = li.querySelector('.fld-name') || li.querySelector('span');
    let started = !nameSpan;
    const toRemove = [];
    let existingStrong = null;
    for (let n = li.firstChild; n; n = n.nextSibling) {
      if (!started) {
        if (n === nameSpan) {
          started = true;
        }
        continue;
      }
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'STRONG') {
        if (!existingStrong) existingStrong = n;
        else toRemove.push(n);
      } else {
        toRemove.push(n);
      }
    }
    toRemove.forEach((n) => li.removeChild(n));
    if (!existingStrong) {
      existingStrong = document.createElement('strong');
      if (nameSpan)
        nameSpan.after(document.createTextNode(' '), existingStrong);
      else {
        li.textContent = '';
        li.appendChild(existingStrong);
      }
    }
    existingStrong.textContent = String(value);
  }

  async function renderTable(container) {
    const data = await getTable();
    if (!data?.ok) return;
    const block = (title, s) => `
      <div class="gpc-table">
        <h4>${title} <small>${s.key}</small> <em>? ${s.total}</em></h4>
        <table><tbody>
          ${
            s.rows.length
              ? s.rows
                  .map(
                    (r, i) =>
                      `<tr><td>${i + 1}.</td><td><a href="/profile.php?id=${
                        r.user_id
                      }" target="_blank">${r.username}</a></td><td>${
                        r.score
                      }</td></tr>`,
                  )
                  .join('')
              : '<tr><td>—</td><td>—</td><td>0</td></tr>'
          }
        </tbody></table>
      </div>`;
    container.innerHTML =
      block('Текущая неделя', data.week) +
      block('Прошлая неделя', data.prevWeek) +
      block('Текущий месяц', data.month) +
      block('Прошлый месяц', data.prevMonth);
  }

  function injectBadgeIntoPost(postEl, value) {
    const li = postEl.querySelector(
      `.post-author li.pa-fld${SETTINGS.ui.fieldId}`,
    );
    if (li) normalizeCounterLi(li, value);
  }
  function valueFromUserObj(user, source) {
    return source === 'total'
      ? user.total || 0
      : source === 'month'
      ? user.month?.count || 0
      : user.week?.count || 0;
  }
  function updateUserValueInDom(userId, value) {
    $$('.post[data-user-id]').forEach((post) => {
      if (Number(post.getAttribute('data-user-id')) === Number(userId)) {
        injectBadgeIntoPost(post, String(value));
      }
    });
    const profBox = $('#viewprofile-next');
    if (profBox && profBox.className.includes(`id-${userId}`)) {
      const li = document.getElementById(`pa-fld${SETTINGS.ui.fieldId}`);
      if (li) normalizeCounterLi(li, String(value));
    }
  }
  function optimisticUpdate(userId, value) {
    updateUserValueInDom(userId, value);
    setTimeout(() => updateUserValueInDom(userId, value), 300);
    setTimeout(() => updateUserValueInDom(userId, value), 1000);
  }

  async function decorateAuthorsOnTopic() {
    if (!SETTINGS.ui.showBadgesInTopic) return;
    const { group, id: myId } = getUser();
    if (!SETTINGS.viewerGroups.includes(group)) return;

    const posts = $$('.post[data-user-id]');
    const allIds = Array.from(
      new Set(posts.map((p) => Number(p.getAttribute('data-user-id')))),
    );
    if (!allIds.includes(myId)) allIds.push(myId);

    let ids = allIds;
    if (ids.length > SETTINGS.ui.maxUsersToDecorate) {
      const rest = ids
        .filter((i) => i !== myId)
        .slice(0, SETTINGS.ui.maxUsersToDecorate - 1);
      ids = [myId, ...rest];
    }

    const cache = new Map();
    await Promise.all(
      ids.map(async (id) => {
        const data = await getUserStats(id);
        if (data) cache.set(id, data);
      }),
    );

    const source = SETTINGS.ui.badgeSource || 'week';
    for (const post of posts) {
      const id = Number(post.getAttribute('data-user-id'));
      const user = cache.get(id);
      if (!user) continue;
      injectBadgeIntoPost(post, String(valueFromUserObj(user, source)));
    }
  }

  async function decorateProfilePage() {
    const root = document.getElementById('pun-profile');
    if (!root) return;

    let uid = Number(parseQuery().id || 0);
    if (!uid) {
      const box = document.getElementById('viewprofile-next');
      const m = box?.className.match(/\bid-(\d+)\b/);
      if (m) uid = Number(m[1]);
    }
    if (!uid) return;

    const data = await getUserStats(uid);
    if (!data) return;

    const source =
      SETTINGS.ui.profileBadgeSource || SETTINGS.ui.badgeSource || 'week';
    const value = valueFromUserObj(data, source);
    const li = document.getElementById(`pa-fld${SETTINGS.ui.fieldId}`);
    if (li) normalizeCounterLi(li, value);
  }

  function waitForElement(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const mo = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) {
          mo.disconnect();
          resolve(n);
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      if (timeout > 0)
        setTimeout(() => {
          mo.disconnect();
          resolve(null);
        }, timeout);
    });
  }

  function ensureModal() {
    let m = document.getElementById('gpc-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'gpc-modal';
    m.className = 'gpc-modal';
    m.innerHTML = `
      <div class="gpc-modal__backdrop" data-close></div>
      <div class="gpc-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="gpc-modal-title">
        <button class="gpc-modal__close" type="button" aria-label="Закрыть" data-close>?</button>
        <h3 id="gpc-modal-title" class="gpc-modal__title">Статистика постов</h3>
        <div class="gpc-modal__body"><div class="gpc-tables-wrap"></div></div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
    return m;
  }
  function openModal() {
    const m = ensureModal();
    m.classList.add('is-open');
    const wrap = m.querySelector('.gpc-tables-wrap');
    renderTable(wrap);
  }
  function closeModal() {
    const m = document.getElementById('gpc-modal');
    if (m) m.classList.remove('is-open');
  }

  async function injectLauncher() {
    const { group } = getUser();
    if (!SETTINGS.viewerGroups.includes(group)) return;

    const fidNum = Number(getForumId());
    const allowed =
      !SETTINGS.ui.forumsOnly ||
      (Array.isArray(SETTINGS.ui.forumsOnly) &&
        SETTINGS.ui.forumsOnly.includes(fidNum));
    if (!allowed) return;

    document
      .querySelectorAll('#form-buttons li.gpc-open-li')
      .forEach((n) => n.remove());

    const anchorSel = SETTINGS.ui.launcherAfter || '#button-addition';
    const anchor = await waitForElement(anchorSel);
    if (!anchor) return;
    if (document.getElementById('gpc-open-btn')) return;

    const tdRef = anchor.closest('td') || anchor;
    if (!tdRef || tdRef.tagName !== 'TD') return;

    const td = document.createElement('td');
    td.className = 'gpc-open-td';
    td.title = SETTINGS.ui.launcherText || 'Статистика постов';

    const btn = document.createElement('button');
    btn.id = 'gpc-open-btn';
    btn.type = 'button';
    btn.className = 'gpc-open-btn';
    btn.textContent = SETTINGS.ui.launcherIcon || '?';
    ['pointerdown', 'mousedown', 'mouseup', 'pointerup'].forEach((t) => {
      btn.addEventListener(
        t,
        (e) => {
          e.stopPropagation();
        },
        true,
      );
    });

    btn.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openModal();
      },
      true,
    );

    td.appendChild(btn);
    tdRef.parentNode.insertBefore(td, tdRef.nextSibling);
  }

  const INTENT_ADD_KEY = 'gpc_add_intent';
  const INTENT_DEL_KEY = 'gpc_del_intent';

  const saveAddIntent = (v) => {
    try {
      localStorage.setItem(INTENT_ADD_KEY, JSON.stringify(v));
    } catch {}
  };
  const takeAddIntent = () => {
    const r = localStorage.getItem(INTENT_ADD_KEY);
    if (!r) return null;
    localStorage.removeItem(INTENT_ADD_KEY);
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  };

  const readDelIntent = () => {
    const r = localStorage.getItem(INTENT_DEL_KEY);
    if (!r) return null;
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  };
  const writeDelIntent = (obj) => {
    try {
      localStorage.setItem(INTENT_DEL_KEY, JSON.stringify(obj));
    } catch {}
  };
  const clearDelIntent = () => {
    try {
      localStorage.removeItem(INTENT_DEL_KEY);
    } catch {}
  };

  function buildPayload(fid, tid, isFirstPost, { userId, username, action }) {
    return {
      subscription: SETTINGS.backend.subscription,
      tableKey: SETTINGS.backend.tableKey,
      userId,
      username,
      action,
      forumId: Number(fid || 0),
      topicId: Number(tid || 0),
      isFirstPost: !!isFirstPost,
    };
  }

  function trySendFromIntent() {
    const intent = takeAddIntent();
    if (!intent) return;
    const u = getUser();
    if (!u.id || !u.name) return;
    let fid = intent.fid || getForumId();
    let tid =
      intent.tid && intent.tid !== '0' ? intent.tid : getTopicId() || '0';
    const isFirstPost = intent.isFirstPost;
    if (!fid) fid = getForumId();
    if (!tid) tid = getTopicId() || '0';
    if (!isCountable({ fid, tid, isFirstPost })) return;

    const payload = buildPayload(fid, tid, isFirstPost, {
      userId: u.id,
      username: u.name,
      action: 'add',
    });
    sendUpdateFetch(payload).then((res) => {
      if (res?.ok && res.user) {
        const val = valueFromUserObj(
          res.user,
          SETTINGS.ui.badgeSource || 'week',
        );
        optimisticUpdate(u.id, val);
      }
    });
  }

  function sendSubtractOnce(info) {
    if (!info || info.sent) return;
    const payload = buildPayload(info.fid, info.tid, !!info.isFirstPost, {
      userId: Number(info.uid || 0),
      username: info.uname || '',
      action: 'subtract',
    });
    if (!payload.userId || !payload.username) {
      clearDelIntent();
      return;
    }
    writeDelIntent({ ...info, sent: true });
    sendUpdateFetch(payload).then(async () => {
      const user = await getUserStats(payload.userId).catch(() => null);
      if (user) {
        const val = valueFromUserObj(user, SETTINGS.ui.badgeSource || 'week');
        optimisticUpdate(payload.userId, val);
      }
      clearDelIntent();
    });
  }

  function trySendFromDelIntent() {
    if (!PATH.isTopic()) return;
    const info = readDelIntent();
    if (!info) return;
    const tidNow = getTopicId();
    const fidNow = getForumId();
    if (!tidNow || !fidNow) return;
    if (
      String(fidNow) !== String(info.fid) ||
      String(tidNow) !== String(info.tid)
    )
      return;
    if (!document.getElementById('p' + info.postId)) sendSubtractOnce(info);
  }

  function hookPostSubmit() {
    const form = $('form#post[action*="/post.php?"]');
    if (!form) return;
    form.addEventListener(
      'submit',
      () => {
        const u = getUser();
        if (!u.id || !u.name) return;
        const fid = (form.action.match(/fid=(\d+)/) || [])[1] || getForumId();
        const tidRaw = (form.action.match(/tid=(\d+(\.\d+)*)/) || [])[1] || '';
        const tid = tidRaw ? tidRaw.split('.')[0] : '';
        const isFirstPost = !!(fid && !tid);
        saveAddIntent({
          action: 'add',
          fid: String(fid || ''),
          tid: String(tid || '0'),
          isFirstPost,
          sentBy: 'submit',
          t: Date.now(),
        });

        const payload = buildPayload(fid, tid || '0', isFirstPost, {
          userId: u.id,
          username: u.name,
          action: 'add',
        });
        sendUpdateFetch(payload).then((res) => {
          if (res?.ok && res.user) {
            const val = valueFromUserObj(
              res.user,
              SETTINGS.ui.badgeSource || 'week',
            );
            optimisticUpdate(u.id, val);
          }
        });
      },
      { passive: true },
    );

    const prepIntent = () => {
      const fid = getForumId();
      const tid = getTopicId() || '0';
      const isFirstPost = !!(fid && !tid);
      saveAddIntent({
        action: 'add',
        fid: String(fid || ''),
        tid: String(tid || '0'),
        isFirstPost,
        sentBy: 'button',
        t: Date.now(),
      });
    };
    form
      .querySelectorAll(
        'input[type=submit], button[type=submit], input[name=submit], button[name=submit]',
      )
      .forEach((btn) =>
        btn.addEventListener('click', prepIntent, { passive: true }),
      );
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') prepIntent();
    });
  }

  function hookDeleteLinks() {
    document.addEventListener(
      'click',
      (ev) => {
        if (!PATH.isTopic()) return;
        const a = ev.target.closest('.pl-delete a[href*="/delete.php?id="]');
        if (!a) return;
        const post = a.closest('.post');
        const postId = Number(
          (a.href.match(/delete\.php\?id=(\d+)/) || [])[1] || 0,
        );
        const uid = Number(post?.getAttribute('data-user-id') || 0);
        const uname = (
          post?.querySelector('.post-author .pa-author a')?.textContent ||
          window.UserLogin ||
          ''
        ).trim();

        let isFirstPost = false;
        const liDel = post?.querySelector('li.pl-delete');
        const mNum =
          liDel?.textContent && liDel.textContent.match(/Сообщение\s+(\d+)/i);
        if (mNum) isFirstPost = Number(mNum[1]) === 1;
        else {
          const n = post?.querySelector('h3 > span > strong');
          if (n) isFirstPost = Number((n.textContent || '').trim()) === 1;
        }

        const fid = getForumId();
        const tid = getTopicId() || '0';
        writeDelIntent({
          postId,
          uid,
          uname,
          fid: String(fid || ''),
          tid: String(tid || '0'),
          isFirstPost,
          sent: false,
          t: Date.now(),
        });
      },
      { passive: true, capture: true },
    );
  }

  function hookDeleteConfirmPage() {
    if (!PATH.isDelete()) return;
    const m = location.search.match(/(?:^|[?&])id=(\d+)/);
    const postId = (m && m[1]) || null;
    if (!postId) return;
    const info = readDelIntent();
    if (!info || String(info.postId) !== String(postId)) return;
    const form = document.querySelector('form[action*="/delete.php"]');
    if (form)
      form.addEventListener(
        'submit',
        () => {
          sendSubtractOnce(info);
        },
        { passive: true, capture: true },
      );
  }

  function hookDomObserver() {
    const target = document.getElementById('pun-main') || document.body;
    const mo = new MutationObserver((muts) => {
      let hasAdd = false,
        hasRem = false;
      for (const m of muts) {
        if (m.addedNodes?.length) hasAdd = true;
        if (m.removedNodes?.length) hasRem = true;
      }
      if (hasAdd) trySendFromIntent();
      if (hasAdd || hasRem) trySendFromDelIntent();
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  function hookPageShow() {
    window.addEventListener('pageshow', () => {
      trySendFromDelIntent();
    });
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    hookPostSubmit();
    hookDeleteLinks();
    hookDeleteConfirmPage();
    hookDomObserver();
    hookPageShow();
    injectLauncher();
    decorateAuthorsOnTopic();
    decorateProfilePage();
    setTimeout(() => trySendFromIntent(), 0);
    setTimeout(() => trySendFromDelIntent(), 0);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.GPC = {
    SETTINGS,
    getUserStats,
    updateGlobal({
      userId,
      username,
      action = 'add',
      fid,
      tid,
      isFirstPost = false,
    }) {
      const payload = {
        subscription: SETTINGS.backend.subscription,
        tableKey: SETTINGS.backend.tableKey,
        userId,
        username,
        action,
        forumId: Number(fid || getForumId() || 0),
        topicId: Number(tid || getTopicId() || 0),
        isFirstPost: !!isFirstPost,
      };
      sendUpdateFetch(payload);
    },
  };
})();
