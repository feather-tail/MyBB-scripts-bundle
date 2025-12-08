(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { getConfig, runOnceOnReady } = helpers;

  const CONFIG_NAME = 'adminGamepostReward';

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
    baseReward: 10,
    fastMultiplier: 1.5,
    fastThresholdSeconds: 24 * 3600,
    episodeForumId: 17,
    endpoints: {
      bankApiUrl: 'https://feathertail.ru/ks/bank/bank-api.php',
    },
    selectors: {
      runButton: '#ks-gpreward-run',
      applyButton: '#ks-gpreward-apply',
      warningBox: '#ks-gpreward-warning',
      errorBox: '#ks-gpreward-error',
      previewBox: '#ks-gpreward-preview',
      summaryBox: '#ks-gpreward-summary',
    },
  };

  const SETTINGS =
    typeof getConfig === 'function'
      ? getConfig(CONFIG_NAME, DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

  const SELECTORS =
    SETTINGS.selectors || SETTINGS.DOM_SELECTORS || DEFAULT_CONFIG.selectors;
  const ENDPOINTS = SETTINGS.endpoints || DEFAULT_CONFIG.endpoints;
  const BANK_API_URL =
    ENDPOINTS.bankApiUrl || DEFAULT_CONFIG.endpoints.bankApiUrl;

  (() => {
    if (!Array.isArray(SETTINGS.forumIds)) {
      SETTINGS.forumIds = [];
    }
    SETTINGS.forumIds = SETTINGS.forumIds
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (!SETTINGS.forumIds.length) {
      SETTINGS.forumIds = DEFAULT_CONFIG.forumIds.slice();
    }

    if (
      typeof SETTINGS.episodeForumId === 'number' &&
      SETTINGS.episodeForumId > 0
    ) {
      if (!SETTINGS.forumIds.includes(SETTINGS.episodeForumId)) {
        SETTINGS.forumIds.push(SETTINGS.episodeForumId);
      }
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
      .filter((t) => t.id && SETTINGS.forumIds.includes(t.forum_id));

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
        `&fields=id,topic_id,username,link,posted&limit=${postsPerRequest}&skip=${skip}`;

      log(`post.get: skip=${skip}`);
      const data = await fetchJsonWithRetry(url, 'post.get');
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;

      for (const r of rows) {
        const topicId = Number(r.topic_id);
        if (!topicForumMap.has(topicId)) continue;

        const postedRaw =
          r.posted_unix ?? r.posted_ts ?? r.posted ?? r.timestamp ?? null;
        const posted = postedRaw != null ? Number(postedRaw) : 0;

        out.push({
          id: Number(r.id),
          topic_id: topicId,
          username: safeText(r.username).trim(),
          link: safeText(r.link).trim(),
          posted: Number.isFinite(posted) ? posted : 0,
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

  function computeUserPostStats(postsByTopic, includeFirstPost, log) {
    const statsByName = new Map();

    const fastThreshold = SETTINGS.fastThresholdSeconds;

    for (const [topicId, posts] of postsByTopic.entries()) {
      if (!Array.isArray(posts) || !posts.length) continue;

      posts.sort((a, b) => {
        if (a.posted !== b.posted) return a.posted - b.posted;
        return a.id - b.id;
      });

      let prev = null;

      for (let i = 0; i < posts.length; i += 1) {
        const p = posts[i];

        if (!includeFirstPost && i === 0) {
          prev = p;
          continue;
        }

        const username = p.username;
        if (!username) {
          prev = p;
          continue;
        }

        let isFast = false;

        if (prev && p.posted && prev.posted) {
          const delta = p.posted - prev.posted;
          if (delta > 0 && delta < fastThreshold) {
            isFast = true;
          }
        }

        prev = p;

        const key = username.toLowerCase();
        let rec = statsByName.get(key);
        if (!rec) {
          rec = {
            userId: null,
            username,
            totalPosts: 0,
            fastPosts: 0,
          };
          statsByName.set(key, rec);
        }

        rec.totalPosts += 1;
        if (isFast) rec.fastPosts += 1;
      }
    }

    const usersArr = Array.from(statsByName.values()).sort(
      (a, b) => b.totalPosts - a.totalPosts,
    );

    log(
      `Игровые посты: пользователей с постами — ${
        usersArr.length
      }, суммарно постов: ${usersArr.reduce(
        (sum, u) => sum + u.totalPosts,
        0,
      )}`,
    );

    return usersArr;
  }

  function computeEpisodeStats(
    postsByTopic,
    topicForumMap,
    episodeForumId,
    log,
  ) {
    const statsByName = new Map();

    for (const [topicId, posts] of postsByTopic.entries()) {
      const forumId = topicForumMap.get(topicId);
      if (forumId !== episodeForumId) continue;
      if (!Array.isArray(posts) || !posts.length) continue;

      const usersInTopic = new Map();
      for (const p of posts) {
        const name = (p.username || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!usersInTopic.has(key)) {
          usersInTopic.set(key, name);
        }
      }

      for (const [key, name] of usersInTopic.entries()) {
        let rec = statsByName.get(key);
        if (!rec) {
          rec = { username: name, episodesTotal: 0 };
          statsByName.set(key, rec);
        }
        rec.episodesTotal += 1;
      }
    }

    const totalParticipants = statsByName.size;
    const totalEpisodeParticipations = Array.from(statsByName.values()).reduce(
      (sum, u) => sum + (u.episodesTotal || 0),
      0,
    );

    log(
      `Эпизоды: пользователей с участием — ${totalParticipants}, ` +
        `суммарно участий (эпизод * пользователь): ${totalEpisodeParticipations}`,
    );

    return statsByName;
  }

  async function recalcGamepostRewards(log) {
    log('=== Старт пересчёта наград за игровые посты + эпизоды ===');
    log(
      `Форумы: [${SETTINGS.forumIds.join(', ')}], ` +
        `учитывать первый пост: ${SETTINGS.includeFirstPost ? 'да' : 'нет'}, ` +
        `форум эпизодов: #${SETTINGS.episodeForumId}`,
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

    const postsByTopic = new Map();
    for (const p of allPosts) {
      if (!p.topic_id) continue;
      let arr = postsByTopic.get(p.topic_id);
      if (!arr) {
        arr = [];
        postsByTopic.set(p.topic_id, arr);
      }
      arr.push(p);
    }

    const episodesStats = computeEpisodeStats(
      postsByTopic,
      topicForumMap,
      SETTINGS.episodeForumId,
      log,
    );

    const usersArr = computeUserPostStats(
      postsByTopic,
      SETTINGS.includeFirstPost,
      log,
    );

    if (!usersArr.length && episodesStats.size === 0) {
      log('Не найдено пользователей ни с постами, ни с эпизодами.');
      return null;
    }

    const statsByName = new Map();
    for (const u of usersArr) {
      const key = u.username.toLowerCase();
      if (!statsByName.has(key)) {
        statsByName.set(key, u);
      }
    }

    for (const [key, ep] of episodesStats.entries()) {
      let rec = statsByName.get(key);
      if (!rec) {
        rec = {
          userId: null,
          username: ep.username,
          totalPosts: 0,
          fastPosts: 0,
        };
        statsByName.set(key, rec);
        usersArr.push(rec);
      }
      rec.episodesTotal = ep.episodesTotal;
    }

    if (!usersArr.length) {
      log('Не найдено пользователей после объединения статистики.');
      return null;
    }

    await resolveUserIds(usersArr, log);

    const usersWithIds = usersArr.filter(
      (u) => Number.isFinite(u.userId) && u.userId > 0,
    );
    const usersWithoutIds = usersArr.filter(
      (u) => !Number.isFinite(u.userId) || u.userId <= 0,
    );

    if (usersWithoutIds.length) {
      log(
        `? ${usersWithoutIds.length} пользователей не имеют user_id (будут пропущены при начислении валюты).`,
      );
      usersWithoutIds.forEach((u) =>
        log(
          `  - "${u.username}" (${u.totalPosts} постов, ${
            u.episodesTotal || 0
          } эпизодов)`,
        ),
      );
    }

    if (!usersWithIds.length) {
      log('Нет пользователей с валидными user_id, начислять некому.');
      return null;
    }

    return {
      users: usersWithIds,
      usersWithoutIds,
    };
  }

  async function callBankApi(action, users, log) {
    const apiUrl = BANK_API_URL;

    const body = {
      action,
      data: {
        users: users.map((u) => ({
          userId: u.userId,
          username: u.username,
          totalPosts: u.totalPosts,
          fastPosts: u.fastPosts,
        })),
      },
    };

    log(`bank-api: ${action}, пользователей: ${body.data.users.length}`);

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`bank-api HTTP ${resp.status}`);
    }

    const json = await resp.json();
    if (!json || json.ok === false) {
      throw new Error(
        `bank-api error: ${json && json.error ? json.error : 'UNKNOWN_ERROR'}`,
      );
    }

    const items = Array.isArray(json.items) ? json.items : [];
    log(`bank-api: ${action} — вернуло записей: ${items.length}`);
    return items;
  }

  async function callBankApiEpisodes(action, users, log) {
    const apiUrl = BANK_API_URL;

    const body = {
      action,
      data: {
        users: users.map((u) => ({
          userId: u.userId,
          username: u.username,
          episodesTotal: u.episodesTotal || 0,
        })),
      },
    };

    log(
      `bank-api: ${action} (episodes), пользователей: ${body.data.users.length}`,
    );

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`bank-api HTTP ${resp.status}`);
    }

    const json = await resp.json();
    if (!json || json.ok === false) {
      throw new Error(
        `bank-api error (episodes): ${
          json && json.error ? json.error : 'UNKNOWN_ERROR'
        }`,
      );
    }

    const items = Array.isArray(json.items) ? json.items : [];
    log(`bank-api: ${action} (episodes) — вернуло записей: ${items.length}`);
    return items;
  }

  function mergeRewards(postItems, episodeItems) {
    const byKey = new Map();

    const add = (kind, arr) => {
      if (!Array.isArray(arr)) return;
      for (const it of arr) {
        const uid = it.user_id != null ? String(it.user_id) : null;
        const uname = (it.username || '').toLowerCase();
        const key = uid ? `id:${uid}` : `name:${uname}`;
        let rec = byKey.get(key);
        if (!rec) {
          rec = {};
          byKey.set(key, rec);
        }
        rec[kind] = it;
      }
    };

    add('posts', postItems);
    add('episodes', episodeItems);

    const combined = [];

    for (const rec of byKey.values()) {
      const p = rec.posts || {};
      const e = rec.episodes || {};

      const user_id = p.user_id ?? e.user_id ?? null;
      const username = p.username ?? e.username ?? '';

      const total_posts = p.total_posts ?? 0;
      const fast_posts = p.fast_posts ?? 0;
      const delta_posts = p.delta_posts ?? 0;
      const delta_fast = p.delta_fast ?? 0;

      const episodes_total = e.episodes_total ?? 0;
      const delta_episodes = e.delta_episodes ?? 0;

      const post_reward = p.reward ?? 0;
      const episode_reward = e.reward ?? 0;
      const reward_total = (post_reward || 0) + (episode_reward || 0);

      const post_request_id = p.request_id ?? null;
      const episode_request_id = e.request_id ?? null;

      combined.push({
        user_id,
        username,
        total_posts,
        fast_posts,
        delta_posts,
        delta_fast,
        episodes_total,
        delta_episodes,
        post_reward,
        episode_reward,
        reward_total,
        post_request_id,
        episode_request_id,
      });
    }

    return combined;
  }

  function renderPreview(container, items) {
    container.innerHTML = '';

    if (!items.length) {
      const div = document.createElement('div');
      div.className = 'ks-bank-admin__empty';
      div.textContent = 'Нет пользователей с изменением награды.';
      container.appendChild(div);
      return;
    }

    const table = document.createElement('table');
    table.className = 'ks-table ks-gpreward-table';

    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr>' +
      '<th>Пользователь</th>' +
      '<th>Всего постов</th>' +
      '<th>Быстрых постов</th>' +
      '<th>&#916; постов</th>' +
      '<th>&#916; быстрых</th>' +
      '<th>Всего эпизодов</th>' +
      '<th>&#916; эпизодов</th>' +
      '<th>Награда за посты</th>' +
      '<th>Награда за эпизоды</th>' +
      '<th>Итого</th>' +
      '<th>Заявка (посты)</th>' +
      '<th>Заявка (эпизоды)</th>' +
      '</tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    items
      .slice()
      .sort((a, b) => (b.reward_total || 0) - (a.reward_total || 0))
      .forEach((it) => {
        const tr = document.createElement('tr');

        const tdUser = document.createElement('td');
        if (it.user_id != null) {
          tdUser.textContent = `${it.username} (uid ${it.user_id})`;
        } else {
          tdUser.textContent = it.username;
        }
        tr.appendChild(tdUser);

        const tdTotalPosts = document.createElement('td');
        tdTotalPosts.textContent = String(it.total_posts || 0);
        tr.appendChild(tdTotalPosts);

        const tdFastPosts = document.createElement('td');
        tdFastPosts.textContent = String(it.fast_posts || 0);
        tr.appendChild(tdFastPosts);

        const tdDeltaPosts = document.createElement('td');
        tdDeltaPosts.textContent = String(it.delta_posts || 0);
        tr.appendChild(tdDeltaPosts);

        const tdDeltaFast = document.createElement('td');
        tdDeltaFast.textContent = String(it.delta_fast || 0);
        tr.appendChild(tdDeltaFast);

        const tdEpisodesTotal = document.createElement('td');
        tdEpisodesTotal.textContent = String(it.episodes_total || 0);
        tr.appendChild(tdEpisodesTotal);

        const tdDeltaEpisodes = document.createElement('td');
        tdDeltaEpisodes.textContent = String(it.delta_episodes || 0);
        tr.appendChild(tdDeltaEpisodes);

        const tdPostReward = document.createElement('td');
        tdPostReward.textContent = it.post_reward ? `+${it.post_reward}` : '0';
        tr.appendChild(tdPostReward);

        const tdEpisodeReward = document.createElement('td');
        tdEpisodeReward.textContent = it.episode_reward
          ? `+${it.episode_reward}`
          : '0';
        tr.appendChild(tdEpisodeReward);

        const tdTotalReward = document.createElement('td');
        tdTotalReward.textContent = it.reward_total
          ? `+${it.reward_total}`
          : '0';
        tr.appendChild(tdTotalReward);

        const tdPostReq = document.createElement('td');
        tdPostReq.textContent =
          it.post_request_id != null && it.post_request_id > 0
            ? `#${it.post_request_id}`
            : '–';
        tr.appendChild(tdPostReq);

        const tdEpisodeReq = document.createElement('td');
        tdEpisodeReq.textContent =
          it.episode_request_id != null && it.episode_request_id > 0
            ? `#${it.episode_request_id}`
            : '–';
        tr.appendChild(tdEpisodeReq);

        tbody.appendChild(tr);
      });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function initGamepostRewardsTab() {
    const root = document.getElementById('ks-admin');
    if (!root) return;

    const {
      runButton: runSel,
      applyButton: applySel,
      warningBox: warnSel,
      errorBox: errSel,
      previewBox: prevSel,
      summaryBox: summarySel,
    } = SELECTORS;

    const runBtn = runSel ? root.querySelector(runSel) : null;
    const applyBtn = applySel ? root.querySelector(applySel) : null;
    const warnBox = warnSel ? root.querySelector(warnSel) : null;
    const errBox = errSel ? root.querySelector(errSel) : null;
    const previewBox = prevSel ? root.querySelector(prevSel) : null;
    const summaryBox = summarySel ? root.querySelector(summarySel) : null;

    if (!runBtn || !previewBox) return;

    let isRunning = false;
    let lastUsers = null;
    let lastPreviewItems = null;

    const setWarning = (msg) => {
      if (!warnBox) return;
      warnBox.textContent = msg || '';
      warnBox.style.display = msg ? '' : 'none';
    };

    const setError = (msg) => {
      if (!errBox) return;
      errBox.textContent = msg || '';
      errBox.style.display = msg ? '' : 'none';
    };

    const setSummary = (msg) => {
      if (!summaryBox) return;
      summaryBox.textContent = msg || '';
    };

    const log = (msg) => {
      if (SETTINGS.logToConsole) {
        console.log('[Награды за посты/эпизоды]', msg);
      }
    };

    const setBusy = (busy) => {
      isRunning = busy;
      runBtn.disabled = busy;
      if (applyBtn) {
        applyBtn.disabled =
          busy || !lastPreviewItems || !lastPreviewItems.length;
      }
      runBtn.textContent = busy
        ? 'Пересчёт…'
        : 'Пересчитать и рассчитать награды';
    };

    runBtn.addEventListener('click', async () => {
      if (isRunning) return;

      setBusy(true);
      setWarning('');
      setError('');
      setSummary('');
      previewBox.innerHTML = '';
      lastUsers = null;
      lastPreviewItems = null;
      if (applyBtn) {
        applyBtn.style.display = 'none';
        applyBtn.disabled = true;
      }

      try {
        const snapshot = await recalcGamepostRewards(log);
        if (!snapshot || !snapshot.users || !snapshot.users.length) {
          setSummary(
            'Пересчёт не дал результата (нет тем или постов/эпизодов).',
          );
          setBusy(false);
          return;
        }

        lastUsers = snapshot.users;

        const postItems = await callBankApi(
          'calcGamepostRewards',
          lastUsers,
          log,
        );
        const episodeItems = await callBankApiEpisodes(
          'calcEpisodeRewards',
          lastUsers,
          log,
        );

        const items = mergeRewards(postItems, episodeItems);
        lastPreviewItems = items;

        const withReward = items.filter((it) => (it.reward_total || 0) > 0);
        const totalReward = items.reduce(
          (sum, it) => sum + (Number(it.reward_total) || 0),
          0,
        );

        renderPreview(previewBox, items);

        setSummary(
          `Пользователей с изменением: ${items.length}. ` +
            `С ненулевой наградой: ${withReward.length}. ` +
            `Суммарная награда (посты + эпизоды): ${totalReward}.`,
        );

        if (applyBtn) {
          applyBtn.style.display = 'inline-block';
          applyBtn.disabled = !withReward.length;
        }
      } catch (err) {
        console.error(err);
        setError(
          'Ошибка при пересчёте или расчёте наград: ' + (err.message || err),
        );
        setSummary('Произошла ошибка при пересчёте. Подробности — в консоли.');
      } finally {
        setBusy(false);
      }
    });

    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        if (isRunning || !lastUsers || !lastUsers.length) return;

        if (
          !window.confirm(
            'Создать заявки в банк на основе текущего расчёта наград (посты + эпизоды)?',
          )
        ) {
          return;
        }

        setBusy(true);
        setWarning('');
        setError('');
        setSummary('Отправляем заявки в банк…');

        try {
          const postItems = await callBankApi(
            'applyGamepostRewards',
            lastUsers,
            log,
          );
          const episodeItems = await callBankApiEpisodes(
            'applyEpisodeRewards',
            lastUsers,
            log,
          );

          const items = mergeRewards(postItems, episodeItems);
          lastPreviewItems = items;

          const withReward = items.filter((it) => (it.reward_total || 0) > 0);
          const totalReward = items.reduce(
            (sum, it) => sum + (Number(it.reward_total) || 0),
            0,
          );

          renderPreview(previewBox, items);

          setSummary(
            `Готово. Создано/обновлено заявок (посты и/или эпизоды): ${withReward.length}, ` +
              `суммарная награда: ${totalReward}.`,
          );
          setWarning(
            'Заявки добавлены во вкладку "Банк". Не забудьте их обработать.',
          );
        } catch (err) {
          console.error(err);
          setError(
            'Ошибка при создании заявок в банк: ' + (err.message || err),
          );
          setSummary('Не удалось создать заявки. Подробности — в консоли.');
        } finally {
          setBusy(false);
        }
      });
    }
  }

  const start = () => {
    try {
      initGamepostRewardsTab();
    } catch (err) {
      console.error('Ошибка инициализации вкладки "Награды за посты":', err);
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
