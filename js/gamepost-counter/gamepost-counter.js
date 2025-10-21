(() => {
  "use strict";

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig("gamepostCounter", {});
  const STORAGE_KEY = config.storageKey || "gamepostCounterToggle";
  const TOGGLE_LABEL = config.toggleLabel || "Счётчик игровых постов";
  const SETTINGS_SECTION = config.settingsMenuSection || "";
  const INTENT_TTL_MS = 120000;

  const last = (sel, root = document) => {
    const L = root.querySelectorAll(sel);
    return L.length ? L[L.length - 1] : null;
  };

  const PATH = {
    isTopic: () => /\/viewtopic\.php\b/i.test(location.pathname),
    isDelete: () => /\/delete\.php\b/i.test(location.pathname),
  };

  const getUser = () => helpers.getUserInfo();

  const isEnabled = () => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v !== "0";
    } catch {
      return true;
    }
  };

  const saveState = (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {}
  };

  let intentsSent = false;

  const parseQuery = () => {
    const obj = {};
    const q = location.search.slice(1);
    if (!q) return obj;
    for (const kv of q.split("&")) {
      if (!kv) continue;
      const [k, v = ""] = kv.split("=");
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
    return (m2 && m2[1]) || "";
  };

  const getForumId = () => {
    const fidFromGlobal =
      window.FORUM && window.FORUM.topic && window.FORUM.topic.forum_id
        ? String(window.FORUM.topic.forum_id)
        : "";
    if (fidFromGlobal) return fidFromGlobal;

    const a = last('#pun-crumbs1 a[href*="/viewforum.php?id="]');
    if (a) {
      const m = a.href.match(/viewforum\.php\?id=(\d+)/);
      if (m) return m[1];
    }
    const postForm = $('form#post[action*="/post.php?"]');
    const m2 = postForm && postForm.action.match(/fid=(\d+)/);
    return (m2 && m2[1]) || "";
  };

  function isCountable({ fid, tid, isFirstPost }) {
    if (!config.includeFirstPost && isFirstPost) return false;
    const r = config.forumsRules.perForum.get(String(fid));
    const mode = r?.mode || config.forumsRules.defaultMode || "all";
    if (mode === "all") return true;
    const topics = r?.topics || new Set();
    if (mode === "include") return topics.has(Number(tid));
    if (mode === "exclude") return !topics.has(Number(tid));
    return false;
  }

  function sendUpdateFetch(body) {
    return helpers
      .request(`${config.backend.endpoint}?method=update`, {
        method: "POST",
        data: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        responseType: "json",
      })
      .catch(() => null);
  }

  async function getUserStats(userId) {
    const u =
      `${config.backend.endpoint}?method=get_user` +
      `&subscription=${encodeURIComponent(config.backend.subscription)}` +
      `&tableKey=${encodeURIComponent(config.backend.tableKey)}` +
      `&userId=${userId}`;
    const data = await helpers
      .request(u, { responseType: "json" })
      .catch(() => null);
    return data?.ok ? data.user : null;
  }

  async function getTable() {
    const url =
      `${config.backend.endpoint}?method=get_table` +
      `&subscription=${encodeURIComponent(config.backend.subscription)}` +
      `&tableKey=${encodeURIComponent(config.backend.tableKey)}` +
      `&limit=${config.backend.limit}` +
      `&scope=${config.backend.scope}`;
    return helpers.request(url, { responseType: "json" }).catch(() => null);
  }

  function normalizeCounterLi(li, value) {
    if (!li) return;
    li.style.removeProperty("display");
    const nameSpan = li.querySelector(".fld-name") || li.querySelector("span");
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
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName === "STRONG") {
        if (!existingStrong) existingStrong = n;
        else toRemove.push(n);
      } else {
        toRemove.push(n);
      }
    }
    toRemove.forEach((n) => li.removeChild(n));
    if (!existingStrong) {
      existingStrong = document.createElement("strong");
      if (nameSpan)
        nameSpan.after(document.createTextNode(" "), existingStrong);
      else {
        li.textContent = "";
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
        <h4>${title} <small>${s.key}</small> <em>Всего: ${s.total}</em></h4>
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
                      }</td></tr>`
                  )
                  .join("")
              : "<tr><td>—</td><td>—</td><td>0</td></tr>"
          }
        </tbody></table>
      </div>`;
    container.innerHTML =
      block("Текущая неделя", data.week) +
      block("Прошлая неделя", data.prevWeek) +
      block("Текущий месяц", data.month) +
      block("Прошлый месяц", data.prevMonth);
  }

  function injectBadgeIntoPost(postEl, value) {
    const li = postEl.querySelector(
      `.post-author li.pa-fld${config.ui.fieldId}`
    );
    if (li) normalizeCounterLi(li, value);
  }

  function valueFromUserObj(user, source) {
    return source === "total"
      ? user.total || 0
      : source === "month"
      ? user.month?.count || 0
      : user.week?.count || 0;
  }

  function updateUserValueInDom(userId, value) {
    $$(".post[data-user-id]").forEach((post) => {
      if (Number(post.getAttribute("data-user-id")) === Number(userId)) {
        injectBadgeIntoPost(post, String(value));
      }
    });
    const profBox = $("#viewprofile-next");
    if (profBox && profBox.className.includes(`id-${userId}`)) {
      const li = document.getElementById(`pa-fld${config.ui.fieldId}`);
      if (li) normalizeCounterLi(li, String(value));
    }
  }

  function optimisticUpdate(userId, value) {
    updateUserValueInDom(userId, value);
    setTimeout(() => updateUserValueInDom(userId, value), 300);
    setTimeout(() => updateUserValueInDom(userId, value), 1000);
  }

  async function decorateAuthorsOnTopic() {
    if (!config.ui.showBadgesInTopic) return;
    const { group, id: myId } = getUser();
    if (!config.viewerGroups.includes(group)) return;

    const posts = $$(".post[data-user-id]");
    const allIds = Array.from(
      new Set(posts.map((p) => Number(p.getAttribute("data-user-id"))))
    );
    if (!allIds.includes(myId)) allIds.push(myId);

    let ids = allIds;
    if (ids.length > config.ui.maxUsersToDecorate) {
      const rest = ids
        .filter((i) => i !== myId)
        .slice(0, config.ui.maxUsersToDecorate - 1);
      ids = [myId, ...rest];
    }

    const cache = new Map();
    await Promise.all(
      ids.map(async (id) => {
        const data = await getUserStats(id);
        if (data) cache.set(id, data);
      })
    );

    const source = config.ui.badgeSource || "week";
    for (const post of posts) {
      const id = Number(post.getAttribute("data-user-id"));
      const user = cache.get(id);
      if (!user) continue;
      injectBadgeIntoPost(post, String(valueFromUserObj(user, source)));
    }
  }

  async function decorateProfilePage() {
    const root = document.getElementById("pun-profile");
    if (!root) return;

    let uid = Number(parseQuery().id || 0);
    if (!uid) {
      const box = document.getElementById("viewprofile-next");
      const m = box?.className.match(/\bid-(\d+)\b/);
      if (m) uid = Number(m[1]);
    }
    if (!uid) return;

    const data = await getUserStats(uid);
    if (!data) return;

    const source =
      config.ui.profileBadgeSource || config.ui.badgeSource || "week";
    const value = valueFromUserObj(data, source);
    const li = document.getElementById(`pa-fld${config.ui.fieldId}`);
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

  function openModal() {
    const content = document.createElement("div");
    content.className = "gpc-modal__dialog";
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");

    const title = document.createElement("h3");
    title.id = "gpc-modal-title";
    title.className = "gpc-modal__title";
    title.textContent = "Статистика постов";

    const body = document.createElement("div");
    body.className = "gpc-modal__body";

    const wrap = document.createElement("div");
    wrap.className = "gpc-tables-wrap";
    body.appendChild(wrap);

    content.append(title, body);
    const { close } = window.helpers.modal.openModal(content);
    renderTable(wrap);
  }

  async function injectLauncher() {
    const { group } = getUser();
    if (!config.viewerGroups.includes(group)) return;

    const fidNum = Number(getForumId());
    const allowed =
      !config.ui.forumsOnly ||
      (Array.isArray(config.ui.forumsOnly) &&
        config.ui.forumsOnly.includes(fidNum));
    if (!allowed) return;

    document
      .querySelectorAll("#form-buttons li.gpc-open-li")
      .forEach((n) => n.remove());

    const anchorSel = config.ui.launcherAfter || "#button-addition";
    const anchor = await waitForElement(anchorSel);
    if (!anchor) return;
    if (document.getElementById("gpc-open-btn")) return;

    const tdRef = anchor.closest("td") || anchor;
    if (!tdRef || tdRef.tagName !== "TD") return;

    const td = document.createElement("td");
    td.className = "gpc-open-td";
    td.title = config.ui.launcherText || "Статистика постов";

    const btn = document.createElement("button");
    btn.id = "gpc-open-btn";
    btn.type = "button";
    btn.className = "gpc-open-btn";
    btn.textContent = config.ui.launcherIcon || "?";
    ["pointerdown", "mousedown", "mouseup", "pointerup"].forEach((t) => {
      btn.addEventListener(
        t,
        (e) => {
          e.stopPropagation();
        },
        true
      );
    });

    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openModal();
      },
      true
    );

    td.appendChild(btn);
    tdRef.parentNode.insertBefore(td, tdRef.nextSibling);
  }

  function removeCounters() {
    $$(".gpc-open-td").forEach((n) => n.remove());
    $$(".post-author li.pa-fld" + config.ui.fieldId).forEach((li) => {
      li.style.display = "none";
    });
    const profileLi = document.getElementById("pa-fld" + config.ui.fieldId);
    if (profileLi) profileLi.style.display = "none";
  }

  const INTENT_ADD_KEY = "gpc_add_intent";
  const INTENT_DEL_KEY = "gpc_del_intent";

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
      subscription: config.backend.subscription,
      tableKey: config.backend.tableKey,
      userId,
      username,
      action,
      forumId: Number(fid || 0),
      topicId: Number(tid || 0),
      isFirstPost: !!isFirstPost,
    };
  }

  const collectMyPostIds = () => {
    const me = getUser();
    if (!me?.id) return [];
    return Array.from($$(".post[data-user-id]"))
      .filter(
        (p) => Number(p.getAttribute("data-user-id")) === Number(me.id)
      )
      .map((p) => p.id || "")
      .filter(Boolean);
  };

  function trySendFromIntent() {
    if (!isEnabled()) return;

    const intent = takeAddIntent();
    if (!intent) return;

    if (!intent.t || Date.now() - intent.t > INTENT_TTL_MS) return;

    if (document.querySelector('form#post[action*="edit.php"]')) return;

    const u = getUser();
    if (!u.id || !u.name) return;

    let fid = intent.fid || getForumId();
    const originalTid = intent.tid || "0";
    let tid =
      originalTid && originalTid !== "0" ? originalTid : getTopicId() || "0";
    const isFirstPost = Boolean(intent.isFirstPost || originalTid === "0");

    if (!fid) fid = getForumId();
    if (!tid) tid = getTopicId() || "0";

    if (!isCountable({ fid, tid, isFirstPost })) return;

    const before = Array.isArray(intent.snapshotIds)
      ? new Set(intent.snapshotIds)
      : new Set();
    const after = new Set(collectMyPostIds());
    let hasNewMine = false;
    for (const id of after) {
      if (!before.has(id)) {
        hasNewMine = true;
        break;
      }
    }

    if (!hasNewMine && !isFirstPost) return;

    const payload = buildPayload(fid, tid, isFirstPost, {
      userId: u.id,
      username: u.name,
      action: "add",
    });

    sendUpdateFetch(payload).then((res) => {
      if (res?.ok && res.user) {
        const val = valueFromUserObj(res.user, config.ui.badgeSource || "week");
        optimisticUpdate(u.id, val);
      }
    });
  }

  function sendSubtractOnce(info) {
    if (!isEnabled() || !info || info.sent) return;

    if (
      !isCountable({
        fid: info.fid,
        tid: info.tid,
        isFirstPost: !!info.isFirstPost,
      })
    ) {
      clearDelIntent();
      return;
    }

    const payload = buildPayload(info.fid, info.tid, !!info.isFirstPost, {
      userId: Number(info.uid || 0),
      username: info.uname || "",
      action: "subtract",
    });

    if (!payload.userId || !payload.username) {
      clearDelIntent();
      return;
    }

    writeDelIntent({ ...info, sent: true });
    sendUpdateFetch(payload).then(async () => {
      const user = await getUserStats(payload.userId).catch(() => null);
      if (user) {
        const val = valueFromUserObj(user, config.ui.badgeSource || "week");
        optimisticUpdate(payload.userId, val);
      }
      clearDelIntent();
    });
  }

  function trySendFromDelIntent() {
    if (!isEnabled() || !PATH.isTopic()) return;
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
    if (!document.getElementById("p" + info.postId)) sendSubtractOnce(info);
  }

  function hookPostSubmit() {
    const form = $('form#post[action]');
    if (!form) return;

    const isCreateForm = (f) => !!f?.action && /\/post\.php\b/i.test(f.action);

    form.addEventListener(
      "submit",
      (e) => {
        if (!isEnabled()) return;
        if (!isCreateForm(form)) return;

        const sb = e.submitter || document.activeElement;
        if (sb && (sb.classList?.contains("preview") || sb.name === "preview"))
          return;

        const u = getUser();
        if (!u.id || !u.name) return;

        const fid =
          (form.action.match(/fid=(\d+)/) || [])[1] || getForumId();
        const tidRaw =
          (form.action.match(/tid=(\d+(\.\d+)*)/) || [])[1] || "";
        const tid = tidRaw ? tidRaw.split(".")[0] : "";
        const isFirstPost = !!(fid && !tid);

        saveAddIntent({
          action: "add",
          fid: String(fid || ""),
          tid: String(tid || "0"),
          isFirstPost,
          sentBy: "submit",
          snapshotIds: collectMyPostIds(),
          t: Date.now(),
        });

        if (!isCountable({ fid, tid: tid || "0", isFirstPost })) return;

        const payload = buildPayload(fid, tid || "0", isFirstPost, {
          userId: u.id,
          username: u.name,
          action: "add",
        });

        sendUpdateFetch(payload).then((res) => {
          if (res?.ok && res.user) {
            const val = valueFromUserObj(
              res.user,
              config.ui.badgeSource || "week"
            );
            optimisticUpdate(u.id, val);
          }
        });
      },
      { passive: true }
    );

    const prepIntent = (e) => {
      if (!isEnabled()) return;
      const btn = e?.currentTarget;
      if (btn && (btn.classList?.contains("preview") || btn.name === "preview"))
        return;

      const f = btn?.form || document.querySelector("form#post");
      if (!isCreateForm(f)) return;

      const fid = getForumId();
      const tidRaw = getTopicId();
      const isFirstPost = !!(fid && !tidRaw);

      saveAddIntent({
        action: "add",
        fid: String(fid || ""),
        tid: String(tidRaw || "0"),
        isFirstPost,
        sentBy: "button",
        snapshotIds: collectMyPostIds(),
        t: Date.now(),
      });
    };

    form
      .querySelectorAll(
        "input[type=submit], button[type=submit], input[name=submit], button[name=submit]"
      )
      .forEach((btn) =>
        btn.addEventListener("click", prepIntent, { passive: true })
      );

    form.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const active = document.activeElement;
        const f = active?.form || form;
        if (f && /\/post\.php\b/i.test(f.action)) {
          e.preventDefault();
          e.stopPropagation();
          const fid = getForumId();
          const tidRaw = getTopicId();
          const isFirstPost = !!(fid && !tidRaw);
          saveAddIntent({
            action: "add",
            fid: String(fid || ""),
            tid: String(tidRaw || "0"),
            isFirstPost,
            sentBy: "hotkey",
            snapshotIds: collectMyPostIds(),
            t: Date.now(),
          });
        }
      }
    });
  }

  function hookDeleteLinks() {
    document.addEventListener(
      "click",
      (ev) => {
        if (!PATH.isTopic() || !isEnabled()) return;
        const a = ev.target.closest('.pl-delete a[href*="/delete.php?id="]');
        if (!a) return;
        const post = a.closest(".post");
        const postId = Number(
          (a.href.match(/delete\.php\?id=(\d+)/) || [])[1] || 0
        );
        const uid = Number(post?.getAttribute("data-user-id") || 0);
        const uname = (
          post?.querySelector(".post-author .pa-author a")?.textContent ||
          helpers.getUserInfo().name ||
          ""
        ).trim();

        let isFirstPost = false;
        const liDel = post?.querySelector("li.pl-delete");
        const mNum =
          liDel?.textContent && liDel.textContent.match(/Сообщение\s+(\d+)/i);
        if (mNum) isFirstPost = Number(mNum[1]) === 1;
        else {
          const n = post?.querySelector("h3 > span > strong");
          if (n) isFirstPost = Number((n.textContent || "").trim()) === 1;
        }

        const fid = getForumId();
        const tid = getTopicId() || "0";
        writeDelIntent({
          postId,
          uid,
          uname,
          fid: String(fid || ""),
          tid: String(tid || "0"),
          isFirstPost,
          sent: false,
          t: Date.now(),
        });
      },
      { passive: true, capture: true }
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
        "submit",
        () => {
          if (!isEnabled()) return;
          sendSubtractOnce(info);
        },
        { passive: true, capture: true }
      );
  }

  function hookDomObserver() {
    const target = document.getElementById("pun-main") || document.body;
    const mo = new MutationObserver((muts) => {
      let postAdded = false;
      let hasRem = false;
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (
              n.nodeType === 1 &&
              ((n.classList && n.classList.contains("post")) ||
                n.querySelector?.(".post"))
            ) {
              postAdded = true;
              break;
            }
          }
        }
        if (m.removedNodes?.length) hasRem = true;
        if (postAdded) break;
      }
      if (postAdded) trySendFromIntent();
      if (postAdded || hasRem) trySendFromDelIntent();
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  function hookPageShow() {
    window.addEventListener("pageshow", () => {
      trySendFromDelIntent();
    });
  }

  function applyCounters() {
    injectLauncher();
    decorateAuthorsOnTopic();
    decorateProfilePage();
    if (!intentsSent) {
      intentsSent = true;
      setTimeout(() => trySendFromIntent(), 0);
      setTimeout(() => trySendFromDelIntent(), 0);
    }
  }

  function renderToggle(container) {
    const label = createEl("label");
    const cb = createEl("input", { type: "checkbox" });
    cb.checked = isEnabled();
    label.append(cb, document.createTextNode(" " + TOGGLE_LABEL));
    cb.addEventListener("change", () => {
      const on = cb.checked;
      saveState(on);
      if (on) applyCounters();
      else removeCounters();
    });
    if (container) container.append(label);
    return label;
  }

  function initSection(list) {
    if (!list) return;
    const li = createEl("li");
    renderToggle(li);
    list.insertBefore(li, list.children[1] || null);
  }

  function initToggle() {
    if (SETTINGS_SECTION) {
      const tryRegister = () => {
        if (window.settingsMenu?.registerSection) {
          window.settingsMenu.registerSection(SETTINGS_SECTION, initSection);
          clearInterval(timer);
        }
      };
      const timer = window.settingsMenu?.registerSection
        ? null
        : setInterval(tryRegister, 100);
      tryRegister();
    }
    if (config.toggleInsertAfter) {
      const anchor = document.querySelector(config.toggleInsertAfter);
      if (anchor) anchor.insertAdjacentElement("afterend", renderToggle());
    }
  }

  function init() {
    hookPostSubmit();
    hookDeleteLinks();
    hookDeleteConfirmPage();
    hookDomObserver();
    hookPageShow();
    if (isEnabled()) applyCounters();
    else removeCounters();
  }

  helpers.runOnceOnReady(init);
  helpers.runOnceOnReady(initToggle);

  helpers.register("gamepostCounter", {
    config,
    SETTINGS: config,
    getUserStats,
    renderToggle,
    initToggle,
    initSection,
    updateGlobal({
      userId,
      username,
      action = "add",
      fid,
      tid,
      isFirstPost = false,
    }) {
      const payload = {
        subscription: config.backend.subscription,
        tableKey: config.backend.tableKey,
        userId,
        username,
        action,
        forumId: Number(fid || getForumId() || 0),
        topicId: Number(tid || getTopicId() || 0),
        isFirstPost: !!isFirstPost,
      };

      if (
        !isCountable({
          fid: String(payload.forumId || ""),
          tid: String(payload.topicId || "0"),
          isFirstPost: payload.isFirstPost,
        })
      ) {
        return;
      }

      sendUpdateFetch(payload);
    },
  });
})();
