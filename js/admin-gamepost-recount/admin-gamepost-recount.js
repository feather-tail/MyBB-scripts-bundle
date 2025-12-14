(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { getConfig, runOnceOnReady } = helpers;

  const CONFIG_NAME = 'adminGamepostRecount';

  const DEFAULT_CONFIG = {
    forumIds: [10, 13, 11, 12, 17],
    includeFirstPost: false,
    apiBase: '/api.php',
    topicsPerRequest: 100,
    postsPerRequest: 100,
    delayBetweenRequestsMs: 200,
    retryAttempts: 2,
    retryBaseDelayMs: 800,
    logToConsole: true,
    selectors: {
      runButton: '#ks-recount-run',
      saveButton: '#ks-recount-save',
      logBox: '#ks-recount-result',
      summaryBox: '#ks-recount-progress',
    },
    backend: {
      endpoint: '',
      method: 'recalc',
      subscription: '',
      tableKey: '',
    },
  };

  const SETTINGS =
    typeof getConfig === 'function'
      ? getConfig(CONFIG_NAME, DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

  const SELECTORS =
    SETTINGS.selectors || SETTINGS.DOM_SELECTORS || DEFAULT_CONFIG.selectors;

  const BACKEND = {
    ...DEFAULT_CONFIG.backend,
    ...(SETTINGS.backend || SETTINGS.BACKEND || {}),
  };

  (() => {
    let fids = SETTINGS.forumIds;
    if (!Array.isArray(fids)) {
      fids = DEFAULT_CONFIG.forumIds.slice();
    }
    SETTINGS.forumIds = fids
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (!SETTINGS.forumIds.length) {
      SETTINGS.forumIds = DEFAULT_CONFIG.forumIds.slice();
    }
  })();

  const sleep = (ms) =>
    ms > 0
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : Promise.resolve();

  const safeText = (v) => String(v == null ? '' : v);

  async function fetchJsonWithRetry(url, label = 'request') {
    const { retryAttempts, retryBaseDelayMs, logToConsole } = SETTINGS;
    let lastError = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || (!data.response && !data.error)) {
          throw new Error('Некорректный ответ API');
        }
        if (data.error) {
          throw new Error(
            `API error (${label}): ${
              data.error.message || data.error.code || 'unknown'
            }`,
          );
        }
        return data;
      } catch (err) {
        lastError = err;
        if (attempt < retryAttempts) {
          const delayMs = retryBaseDelayMs * (attempt + 1);
          if (logToConsole) {
            console.warn(
              `[${label}] Ошибка (попытка ${attempt + 1}/${
                retryAttempts + 1
              }):`,
              err,
              `— повтор через ${delayMs} мс`,
            );
          }
          await sleep(delayMs);
        }
      }
    }

    throw lastError || new Error(`Запрос ${label} не удался`);
  }

    const gpcConfig = (() => {
    try {
      return typeof helpers.getConfig === 'function'
        ? helpers.getConfig('gamepostCounter', null)
        : null;
    } catch {
      return null;
    }
  })();

  function isTopicCountableByGpc(fid, tid) {
    if (!gpcConfig) return true;

    const r = gpcConfig.forumsRules?.perForum?.get?.(String(fid));
    const mode = r?.mode || gpcConfig.forumsRules?.defaultMode || 'all';
    if (mode === 'all') return true;

    const topics = r?.topics || new Set();
    if (mode === 'include') return topics.has(Number(tid));
    if (mode === 'exclude') return !topics.has(Number(tid));
    return false;
  }

  async function getTopicsForForums(forumIds, log) {
    const { apiBase, topicsPerRequest } = SETTINGS;
    const url =
      `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
      `&fields=id,subject,forum_id,first_post,init_post,link&limit=${topicsPerRequest}`;

    log(`topic.get: загрузка тем по форумам [${forumIds.join(', ')}]`);
    const data = await fetchJsonWithRetry(url, 'topic.get');
    const rows = Array.isArray(data?.response) ? data.response : [];

    const topics = rows
      .map((raw) => ({
        id: Number(raw.id),
        subject: safeText(raw.subject),
        forum_id: Number(raw.forum_id ?? raw.forum ?? 0),
        first_post: Number(raw.init_post ?? raw.first_post ?? 0) || 0,
        link: safeText(raw.link),
      }))
      .filter((t) => t.id && SETTINGS.forumIds.includes(t.forum_id))
      .filter((t) => isTopicCountableByGpc(t.forum_id, t.id));

    const byForum = topics.reduce((acc, t) => {
      acc[t.forum_id] = (acc[t.forum_id] || 0) + 1;
      return acc;
    }, {});

    log(
      `topic.get: найдено ${topics.length} тем. По форумам: ` +
        Object.entries(byForum)
          .map(([fid, n]) => `#${fid}: ${n}`)
          .join(', '),
    );

    return topics;
  }

  async function getAllPostsForTopics(topicIds, topicForumMap, log) {
    const { apiBase, postsPerRequest, delayBetweenRequestsMs } = SETTINGS;
    if (!topicIds.length) return [];

    const out = [];
    let skip = 0;

    for (;;) {
      const url =
        `${apiBase}?method=post.get&topic_id=${topicIds.join(',')}` +
        `&fields=id,topic_id,username,link&limit=${postsPerRequest}&skip=${skip}`;

      log(`post.get: skip=${skip}`);
      const data = await fetchJsonWithRetry(url, 'post.get');
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;

      for (const r of rows) {
        const topicId = Number(r.topic_id);
        if (!topicForumMap.has(topicId)) continue;

        out.push({
          id: Number(r.id),
          topic_id: topicId,
          username: safeText(r.username).trim(),
          link: safeText(r.link).trim(),
        });
      }

      if (rows.length < postsPerRequest) break;
      skip += postsPerRequest;
      await sleep(delayBetweenRequestsMs);
    }

    log(
      `post.get: загружено постов (после фильтрации по темам): ${out.length}`,
    );
    return out;
  }

  async function getUserIdByUsername(username, log) {
    const { apiBase, delayBetweenRequestsMs } = SETTINGS;
    if (!username) return null;

    const encoded = encodeURIComponent(username.trim());
    const url = `${apiBase}?method=users.get&username=${encoded}&fields=user_id`;

    log(`users.get: username="${username}"`);
    try {
      const data = await fetchJsonWithRetry(url, `users.get "${username}"`);
      const users = Array.isArray(data?.response?.users)
        ? data.response.users
        : [];
      if (!users.length) {
        log(`? Пользователь не найден: "${username}"`);
        return null;
      }
      const rawId = users[0].user_id;
      const uid = Number(rawId);
      if (!Number.isFinite(uid) || uid <= 0) {
        log(`? Некорректный user_id "${rawId}" для "${username}"`);
        return null;
      }
      await sleep(delayBetweenRequestsMs);
      return uid;
    } catch (err) {
      log(`? Ошибка users.get для "${username}": ${err.message || err}`);
      return null;
    }
  }

  async function resolveUserIds(usersArr, log) {
    for (const u of usersArr) {
      if (u.userId != null) continue;
      u.userId = await getUserIdByUsername(u.username, log);
    }
  }

  async function recalcPostStats(log) {
    log('=== Старт пересчёта игровых постов через API ===');
    log(
      `Форумы: [${SETTINGS.forumIds.join(', ')}], ` +
        `учитывать первый пост: ${SETTINGS.includeFirstPost ? 'да' : 'нет'}`,
    );

    const topics = await getTopicsForForums(SETTINGS.forumIds, log);
    if (!topics.length) {
      log('Тем в указанных форумах не найдено, пересчёт прерван.');
      return null;
    }

    const topicIds = topics.map((t) => t.id);
    const topicForumMap = new Map();
    for (const t of topics) {
      topicForumMap.set(t.id, t.forum_id);
    }

    log(`Всего тем для пересчёта: ${topicIds.length}`);

    const allPosts = await getAllPostsForTopics(topicIds, topicForumMap, log);
    if (!allPosts.length) {
      log('Постов по этим темам не найдено, пересчёт прерван.');
      return null;
    }

    const firstPostIdByTopic = new Map();
    for (const p of allPosts) {
      const prev = firstPostIdByTopic.get(p.topic_id);
      if (prev == null || p.id < prev) {
        firstPostIdByTopic.set(p.topic_id, p.id);
      }
    }

    const statsByName = new Map();
    let countedPosts = 0;

    for (const p of allPosts) {
      const firstId = firstPostIdByTopic.get(p.topic_id);
      if (!SETTINGS.includeFirstPost && firstId != null && p.id === firstId) {
        continue;
      }

      const username = p.username;
      if (!username) continue;

      const key = username.toLowerCase();
      let rec = statsByName.get(key);
      if (!rec) {
        rec = {
          userId: null,
          username,
          count: 0,
          posts: 0,
          links: [],
        };
        statsByName.set(key, rec);
      }

      rec.count += 1;
      rec.posts = rec.count;
      rec.links.push(
        p.link || `${location.origin}/viewtopic.php?id=${p.topic_id}#p${p.id}`,
      );
      countedPosts += 1;
    }

    const usersArr = Array.from(statsByName.values()).sort(
      (a, b) => b.count - a.count,
    );

    log(
      `Промежуточно: пользователей с постами — ${usersArr.length}, постов — ${countedPosts}`,
    );

    await resolveUserIds(usersArr, log);

    const usersWithIds = usersArr.filter(
      (u) => Number.isFinite(u.userId) && u.userId > 0,
    );
    const usersWithoutIds = usersArr.filter(
      (u) => !Number.isFinite(u.userId) || u.userId <= 0,
    );

    if (usersWithoutIds.length) {
      log(
        `? ${usersWithoutIds.length} пользователей не имеют user_id (будут пропущены при записи в БД).`,
      );
      usersWithoutIds.forEach((u) =>
        log(`  - "${u.username}" (${u.count} постов)`),
      );
    }

    const totalPosts = usersArr.reduce((sum, u) => sum + u.count, 0);

    const snapshot = {
      settings: { ...SETTINGS },
      forumIds: [...SETTINGS.forumIds],
      totalUsers: usersArr.length,
      totalPosts,
      topics: topics.map((t) => ({
        id: t.id,
        forumId: t.forum_id,
        subject: t.subject,
        link: t.link,
      })),
      users: usersArr,
      usersWithIds,
      usersWithoutIds,
    };

    window.ksForumPostStats = snapshot;

    log(
      `Готово: всего пользователей: ${snapshot.totalUsers}, суммарно постов: ${snapshot.totalPosts}.`,
    );
    log(
      `Из них с валидными user_id: ${usersWithIds.length}, без user_id: ${usersWithoutIds.length}.`,
    );

    return snapshot;
  }

  async function sendSnapshotToBackend(snapshot, log) {
    if (!helpers || !helpers.request) {
      throw new Error(
        'helpers.request не найден — не могу обратиться к бэкенду.',
      );
    }

    if (!BACKEND.endpoint) {
      throw new Error(
        'Не указан endpoint бэкенда. Задайте его в config.js (gamepostRecount.backend.endpoint).',
      );
    }
    if (!BACKEND.subscription || !BACKEND.tableKey) {
      throw new Error(
        'Не заданы subscription/tableKey для бэкенда. Задайте их в config.js (gamepostRecount.backend).',
      );
    }

    const payload = {
      subscription: BACKEND.subscription,
      tableKey: BACKEND.tableKey,
      forumIds: snapshot.forumIds,
      includeFirstPost: snapshot.settings.includeFirstPost,
      users: snapshot.usersWithIds.map((u) => ({
        userId: u.userId,
        username: u.username,
        total: u.count,
      })),
    };

    log(
      `Отправка в бэкенд (${payload.users.length} пользователей) через ${BACKEND.endpoint}?method=${BACKEND.method}`,
    );

    const url =
      BACKEND.endpoint +
      (BACKEND.method ? `?method=${encodeURIComponent(BACKEND.method)}` : '');

    const res = await helpers.request(url, {
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      responseType: 'json',
    })
      .catch((err) => {
        throw new Error(
          `Ошибка сети при обращении к бэкенду: ${
            err && err.message ? err.message : err
          }`,
        );
      });

    if (!res || res.ok === false) {
      const msg =
        res && res.message ? res.message : 'Неизвестная ошибка бэкенда';
      throw new Error(`Бэкенд вернул ошибку: ${msg}`);
    }

    log('✓ Данные успешно записаны в базу.');
    return res;
  }

  function initRecalcTab() {
    const root = document.getElementById('ks-admin');
    if (!root) return;

    const {
      runButton: runSel,
      saveButton: saveSel,
      logBox: logSel,
      summaryBox: summarySel,
    } = SELECTORS;

    const runBtn = runSel ? root.querySelector(runSel) : null;
    const saveBtn = saveSel ? root.querySelector(saveSel) : null;
    const logBox = logSel ? root.querySelector(logSel) : null;
    const summaryBox = summarySel ? root.querySelector(summarySel) : null;

    if (!runBtn) return;

    let isRunning = false;
    let lastSnapshot = null;

    const appendLog = (msg) => {
      const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
      if (SETTINGS.logToConsole) console.log('[Пересчёт постов]', msg);
      if (!logBox) return;
      const div = document.createElement('div');
      div.textContent = line;
      logBox.appendChild(div);
      logBox.scrollTop = logBox.scrollHeight;
    };

    const setSummary = (text) => {
      if (summaryBox) summaryBox.textContent = text || '';
    };

    const setBusy = (busy) => {
      isRunning = busy;
      runBtn.disabled = busy;
      if (saveBtn) saveBtn.disabled = busy || !lastSnapshot;
      runBtn.textContent = busy ? 'Пересчёт…' : 'Пересчёт';
    };

    runBtn.addEventListener('click', async () => {
      if (isRunning) return;
      lastSnapshot = null;
      if (logBox) logBox.innerHTML = '';
      setSummary('');
      setBusy(true);

      try {
        const snapshot = await recalcPostStats(appendLog);
        if (!snapshot) {
          appendLog('Пересчёт завершился без результата.');
          setSummary('Пересчёт не дал результата (нет тем или постов).');
          setBusy(false);
          return;
        }

        lastSnapshot = snapshot;

        setSummary(
          `Пользователей: ${snapshot.totalUsers}, постов: ${snapshot.totalPosts}. ` +
            `С валидным user_id: ${snapshot.usersWithIds.length}, без user_id: ${snapshot.usersWithoutIds.length}.`,
        );

        if (saveBtn) {
          saveBtn.style.display = 'inline-block';
          saveBtn.disabled = false;
        }
      } catch (err) {
        appendLog(`✗ Ошибка при пересчёте: ${err.message || err}`);
        setSummary('Произошла ошибка при пересчёте. Подробности см. в логе.');
      } finally {
        setBusy(false);
      }
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (isRunning) return;
        if (!lastSnapshot) {
          appendLog(
            'Сначала нужно выполнить пересчёт, прежде чем записывать в БД.',
          );
          return;
        }

        setBusy(true);
        appendLog('Запись результата пересчёта в БД…');

        try {
          await sendSnapshotToBackend(lastSnapshot, appendLog);
          setSummary(
            `Данные записаны в БД. Пользователей: ${lastSnapshot.usersWithIds.length}, постов: ${lastSnapshot.totalPosts}.`,
          );
        } catch (err) {
          appendLog(`✗ Ошибка при записи в БД: ${err.message || err}`);
          setSummary(
            'Не удалось записать данные в БД. Подробности см. в логе.',
          );
        } finally {
          setBusy(false);
        }
      });
    }
  }

  const start = () => {
    try {
      initRecalcTab();
    } catch (err) {
      console.error('Ошибка инициализации вкладки "Пересчёт постов":', err);
    }
  };

  if (typeof runOnceOnReady === 'function') {
    runOnceOnReady(start);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();


