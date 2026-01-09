(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { getConfig, runOnceOnReady } = helpers;

  const CONFIG_NAME = 'adminGamepostReward';

  const DEFAULT_CONFIG = {
    siteKey: 'kindredspirits',
    forumIds: [10, 11, 12, 13, 17],
    includeFirstPost: false,
    apiBase: '/api.php',
    topicsPerRequest: 100,
    postsPerRequest: 100,
    delayBetweenRequestsMs: 250,
    retryAttempts: 3,
    retryBaseDelayMs: 900,
    logToConsole: true,
    baseReward: 10,
    fastMultiplier: 1.5,
    fastThresholdSeconds: 24 * 3600,
    episodeForumId: 17,
    safetyOverlapPosts: 6,
    safety: {
      maxTopicPages: 5000,
      maxPostPagesPerTopic: 20000,
    },
    endpoints: {
      bankApiUrl: 'https://feathertail.ru/ks/bank/bank-api.php',
      stateApiUrl: 'https://feathertail.ru/ks/rewards/rewards-state-api.php',
      multipliersUrl: 'https://feathertail.ru/ks/rewards/ks-reward-multipliers.php',
    },
    multipliers: {
      enabled: true,
      scope: 'gamepost',
      activeOnly: true,
    },
    adminToken: {
      enabled: true,
      headerName: 'X-KS-Admin-Token',
      windowVarName: 'KS_ADMIN_TOKEN',
    },
    selectors: {
      runButton: '#ks-gpreward-run',
      applyButton: '#ks-gpreward-apply',
      previewBox: '#ks-gpreward-preview',
      summaryBox: '#ks-gpreward-summary',
      warningBox: '#ks-gpreward-warning',
      errorBox: '#ks-gpreward-error',
    },
    episodeCompletedForumId: 0,
    episodeCompletion: {
      enabled: true,
      metaKey: '__meta__',
      rewardedKey: 'completedRewarded',
      rewardedAtKey: 'completedRewardedAt',
      completedAtKey: 'completedAt',
    },
  };

  const SETTINGS =
    typeof getConfig === 'function' ? getConfig(CONFIG_NAME, DEFAULT_CONFIG) : DEFAULT_CONFIG;

  const SELECTORS = SETTINGS.selectors || DEFAULT_CONFIG.selectors;
  const ENDPOINTS = SETTINGS.endpoints || DEFAULT_CONFIG.endpoints;

  const BANK_API_URL = ENDPOINTS.bankApiUrl || DEFAULT_CONFIG.endpoints.bankApiUrl;
  const STATE_API_URL = ENDPOINTS.stateApiUrl || DEFAULT_CONFIG.endpoints.stateApiUrl;

  const nowSec = () => Math.floor(Date.now() / 1000);
  const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
  const safeText = (v) => String(v == null ? '' : v);

  function getAdminToken() {
    const cfg = SETTINGS.adminToken || DEFAULT_CONFIG.adminToken;
    if (!cfg || cfg.enabled === false) return '';
    const varName = String(cfg.windowVarName || 'KS_ADMIN_TOKEN');
    const token = (window && window[varName]) ? String(window[varName]) : '';
    return token.trim();
  }

  function buildAdminHeaders() {
    const cfg = SETTINGS.adminToken || DEFAULT_CONFIG.adminToken;
    const token = getAdminToken();
    if (!token) return {};
    const headerName = String(cfg.headerName || 'X-KS-Admin-Token');
    return { [headerName]: token };
  }

  async function fetchJsonWithRetry(url, label = 'request') {
    const { retryAttempts, retryBaseDelayMs, logToConsole } = SETTINGS;
    let lastError = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data || (!data.response && !data.error)) throw new Error('Некорректный ответ API');
        if (data.error) {
          throw new Error(
            `API error (${label}): ${data.error.message || data.error.code || 'unknown'}`,
          );
        }
        return data;
      } catch (err) {
        lastError = err;
        if (attempt < retryAttempts) {
          const delayMs = retryBaseDelayMs * (attempt + 1);
          if (logToConsole) console.warn(`[${label}] retry через ${delayMs}мс`, err);
          await sleep(delayMs);
        }
      }
    }
    throw lastError || new Error(`Запрос ${label} не удался`);
  }

  async function postJson(url, payload, label = 'post', extraHeaders = {}) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(payload),
    });

    let json = null;
    try {
      json = await resp.json();
    } catch (_) {}

    if (!resp.ok) throw new Error(`${label}: HTTP ${resp.status}`);
    if (!json || json.ok === false) {
      throw new Error(`${label}: ${json && json.error ? json.error : 'UNKNOWN_ERROR'}`);
    }
    return json;
  }

  async function getStateFromDb(log) {
    const siteKey = SETTINGS.siteKey || 'kindredspirits';
    const forumIds = Array.isArray(SETTINGS.forumIds) ? SETTINGS.forumIds : [];
    log(`state.getState: siteKey=${siteKey}, forumIds=[${forumIds.join(',')}]`);
    return postJson(
      STATE_API_URL,
      { action: 'getState', data: { siteKey, forumIds, includeUserStates: true } },
      'state.getState',
    );
  }

  async function saveStateToDb(cursorsArr, log) {
    const siteKey = SETTINGS.siteKey || 'kindredspirits';
    log(`state.saveState: cursors=${cursorsArr.length}`);
    return postJson(
      STATE_API_URL,
      { action: 'saveState', data: { siteKey, cursors: cursorsArr } },
      'state.saveState',
    );
  }

  async function loadMultipliersForNow(log) {
    const cfg = SETTINGS.multipliers || DEFAULT_CONFIG.multipliers;
    if (!cfg.enabled) return new Map();

    const atTs = nowSec();
    const endpointRaw = ENDPOINTS.multipliersUrl || DEFAULT_CONFIG.endpoints.multipliersUrl;
    const endpoint = new URL(String(endpointRaw), location.origin);

    endpoint.searchParams.set('method', 'list');
    endpoint.searchParams.set('scope', String(cfg.scope || 'gamepost'));
    if (cfg.activeOnly) endpoint.searchParams.set('active', '1');
    endpoint.searchParams.set('at_ts', String(atTs));

    try {
      const res = await fetch(endpoint.toString(), {
        headers: { ...buildAdminHeaders() },
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && (data.error || data.details)) || `HTTP ${res.status}`);
      }

      const items = Array.isArray(data.items) ? data.items : [];
      log(`multipliers: загружено записей: ${items.length}`);

      const map = new Map();
      for (const it of items) {
        const uid = Number(it.user_id) || 0;
        if (!uid) continue;

        const start = Number(it.start_ts) || 0;
        const end = Number(it.end_ts) || 0;
        if (!(atTs >= start && atTs < end)) continue;

        const factor = Number(it.factor) || 1;
        if (!(factor > 0)) continue;

        const prev = map.get(uid);
        if (!prev || factor > prev.factor) {
          map.set(uid, { factor, validTo: end || 0 });
        }
      }

      return map;
    } catch (e) {
      log(`multipliers: ошибка загрузки: ${e.message || e}`);
      return new Map();
    }
  }

  const userIdCache = new Map();

  async function getUserIdByUsername(username, log) {
    const name = (username || '').trim();
    if (!name) return null;

    const key = name.toLowerCase();
    if (userIdCache.has(key)) return userIdCache.get(key);

    const url = `${SETTINGS.apiBase}?method=users.get&username=${encodeURIComponent(
      name,
    )}&fields=user_id`;

    log(`users.get: "${name}"`);
    try {
      const data = await fetchJsonWithRetry(url, `users.get "${name}"`);
      const users = Array.isArray(data?.response?.users) ? data.response.users : [];
      if (!users.length) {
        userIdCache.set(key, null);
        return null;
      }
      const uid = Number(users[0].user_id);
      const ok = Number.isFinite(uid) && uid > 0 ? uid : null;
      userIdCache.set(key, ok);
      await sleep(SETTINGS.delayBetweenRequestsMs);
      return ok;
    } catch (e) {
      userIdCache.set(key, null);
      return null;
    }
  }

  async function getAllTopicsForForums(forumIds, log) {
    const { apiBase, topicsPerRequest, delayBetweenRequestsMs, safety } = SETTINGS;

    const out = [];
    let skip = 0;
    let page = 0;

    for (;;) {
      page += 1;
      if (page > (safety?.maxTopicPages || DEFAULT_CONFIG.safety.maxTopicPages)) {
        throw new Error(`topic.get: превышен лимит страниц (${page})`);
      }

      const url =
        `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
        `&fields=id,forum_id,subject,first_post,init_post,link,last_post,last_post_id,last_posted_ts` +
        `&limit=${topicsPerRequest}&skip=${skip}`;

      log(`topic.get: skip=${skip}`);
      const data = await fetchJsonWithRetry(url, 'topic.get');
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;

      for (const raw of rows) {
        const t = {
          id: Number(raw.id),
          forum_id: Number(raw.forum_id ?? raw.forum ?? 0),
          subject: safeText(raw.subject),
          first_post: Number(raw.init_post ?? raw.first_post ?? 0) || 0,
          link: safeText(raw.link),
          last_post_id: Number(raw.last_post_id ?? raw.last_post ?? 0) || 0,
          last_posted_ts: Number(raw.last_posted_ts ?? 0) || 0,
        };
        if (t.id && forumIds.includes(t.forum_id)) out.push(t);
      }

      if (rows.length < topicsPerRequest) break;
      skip += topicsPerRequest;
      await sleep(delayBetweenRequestsMs);
    }

    const map = new Map();
    for (const t of out) map.set(t.id, t);
    const topics = Array.from(map.values());

    log(`topic.get: тем найдено ${topics.length}`);
    return topics;
  }

  async function getPostsDescPage(topicId, skip, limit, log) {
    const url =
      `${SETTINGS.apiBase}?method=post.get&topic_id=${topicId}` +
      `&fields=id,topic_id,username,link,posted,posted_unix,posted_ts,timestamp,user_id` +
      `&sort_by=id&sort_dir=desc` +
      `&limit=${limit}&skip=${skip}`;

    log(`post.get(desc): topic=${topicId}, skip=${skip}`);
    const data = await fetchJsonWithRetry(url, `post.get desc topic=${topicId}`);
    const rows = Array.isArray(data?.response) ? data.response : [];

    const out = [];
    for (const r of rows) {
      const postedRaw = r.posted_unix ?? r.posted_ts ?? r.posted ?? r.timestamp ?? 0;
      const posted = Number(postedRaw) || 0;
      const id = Number(r.id) || 0;
      if (id <= 0) continue;

      out.push({
        id,
        topic_id: Number(r.topic_id) || topicId,
        username: safeText(r.username).trim(),
        link: safeText(r.link).trim(),
        posted,
        userId: Number.isFinite(Number(r.user_id)) ? Number(r.user_id) : null,
      });
    }
    return out;
  }

  async function getAllPostsForTopicAsc(topicId, log) {
    const { postsPerRequest, delayBetweenRequestsMs, safety } = SETTINGS;

    const out = [];
    const seen = new Set();

    let skip = 0;
    let page = 0;

    for (;;) {
      page += 1;
      if (page > (safety?.maxPostPagesPerTopic || DEFAULT_CONFIG.safety.maxPostPagesPerTopic)) {
        throw new Error(`post.get: превышен лимит страниц по теме ${topicId} (${page})`);
      }

      const url =
        `${SETTINGS.apiBase}?method=post.get&topic_id=${topicId}` +
        `&fields=id,topic_id,username,link,posted,posted_unix,posted_ts,timestamp,user_id` +
        `&sort_by=id&sort_dir=asc` +
        `&limit=${postsPerRequest}&skip=${skip}`;

      log(`post.get(asc): topic=${topicId}, skip=${skip}`);
      const data = await fetchJsonWithRetry(url, `post.get asc topic=${topicId}`);
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;

      for (const r of rows) {
        const id = Number(r.id) || 0;
        if (id <= 0 || seen.has(id)) continue;
        seen.add(id);

        const postedRaw = r.posted_unix ?? r.posted_ts ?? r.posted ?? r.timestamp ?? 0;
        const posted = Number(postedRaw) || 0;

        out.push({
          id,
          topic_id: Number(r.topic_id) || topicId,
          username: safeText(r.username).trim(),
          link: safeText(r.link).trim(),
          posted,
          userId: Number.isFinite(Number(r.user_id)) ? Number(r.user_id) : null,
        });
      }

      if (rows.length < postsPerRequest) break;
      skip += postsPerRequest;
      await sleep(delayBetweenRequestsMs);
    }

    out.sort((a, b) => (a.id - b.id) || (a.posted - b.posted));
    log(`post.get(asc): topic=${topicId} — постов ${out.length}`);
    return out;
  }

  async function callBankApi(action, users, log) {
    log(`bank-api: ${action} (posts), users=${users.length}`);

    const headers = { 'Content-Type': 'application/json', ...buildAdminHeaders() };

    const resp = await fetch(BANK_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        data: {
          users: users.map((u) => ({
            userId: u.userId,
            username: u.username,
            totalPosts: u.totalPosts || 0,
            fastPosts: u.fastPosts || 0,
          })),
        },
      }),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(`bank-api HTTP ${resp.status}`);
    if (!json || json.ok === false) throw new Error(json?.error || 'bank-api error');
    return Array.isArray(json.items) ? json.items : [];
  }

  async function callBankApiEpisodes(action, users, log) {
    log(`bank-api: ${action} (episodes), users=${users.length}`);

    const headers = { 'Content-Type': 'application/json', ...buildAdminHeaders() };

    const resp = await fetch(BANK_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        data: {
          users: users.map((u) => ({
            userId: u.userId,
            username: u.username,
            episodesTotal: u.episodesTotal || 0,
          })),
        },
      }),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(`bank-api HTTP ${resp.status}`);
    if (!json || json.ok === false) throw new Error(json?.error || 'bank-api error');
    return Array.isArray(json.items) ? json.items : [];
  }

  function mergeRewards(postItems, episodeItems) {
    const byKey = new Map();

    const add = (kind, arr) => {
      if (!Array.isArray(arr)) return;
      for (const it of arr) {
        const uid = it.user_id != null ? String(it.user_id) : null;
        const uname = (it.username || '').toLowerCase();
        const key = uid ? `id:${uid}` : `name:${uname}`;
        const rec = byKey.get(key) || {};
        rec[kind] = it;
        byKey.set(key, rec);
      }
    };

    add('posts', postItems);
    add('episodes', episodeItems);

    const out = [];
    for (const rec of byKey.values()) {
      const p = rec.posts || {};
      const e = rec.episodes || {};
      const user_id = p.user_id ?? e.user_id ?? null;
      const username = p.username ?? e.username ?? '';

      out.push({
        user_id,
        username,

        total_posts: p.total_posts ?? 0,
        fast_posts: p.fast_posts ?? 0,
        delta_posts: p.delta_posts ?? 0,
        delta_fast: p.delta_fast ?? 0,

        raw_reward: p.raw_reward ?? null,
        applied_multiplier: p.applied_multiplier ?? null,

        episodes_total: e.episodes_total ?? 0,
        delta_episodes: e.delta_episodes ?? 0,

        post_reward: p.reward ?? 0,
        episode_reward: e.reward ?? 0,
        reward_total: (p.reward ?? 0) + (e.reward ?? 0),

        post_request_id: p.request_id ?? null,
        episode_request_id: e.request_id ?? null,
      });
    }

    return out;
  }

  function renderPreview(container, items, usersById) {
    container.innerHTML = '';

    if (!items.length) {
      container.textContent = 'Нет данных.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'ks-table ks-recount-table';

    table.innerHTML =
      `<thead><tr>
        <th>Пользователь</th>
        <th>Всего постов</th><th>Быстрых</th><th>Δ постов</th><th>Δ быстрых</th>
        <th>Эпизодов</th><th>Δ эпизодов</th>
        <th>Множитель</th>
        <th>Raw</th>
        <th>Награда (посты)</th><th>Награда (эпизоды)</th><th>Итого</th>
        <th>Заявка (посты)</th><th>Заявка (эпизоды)</th>
      </tr></thead>`;

    const tbody = document.createElement('tbody');

    items
      .slice()
      .sort((a, b) => (b.reward_total || 0) - (a.reward_total || 0))
      .forEach((it) => {
        const uid = Number(it.user_id) || 0;
        const userRec = uid && usersById ? usersById.get(uid) : null;

        const localMult = userRec ? Number(userRec.rewardMultiplier) || 1 : 1;
        const localTo = userRec ? Number(userRec.rewardMultiplierValidTo) || 0 : 0;

        const serverMult = it.applied_multiplier != null ? Number(it.applied_multiplier) : null;

        const multText =
          serverMult != null
            ? `×${serverMult}`
            : (localMult && localMult !== 1 ? `×${localMult}` : '×1');

        const multHint =
          localTo && localMult !== 1
            ? ` (до ${new Date(localTo * 1000).toLocaleString()})`
            : '';

        const raw = it.raw_reward != null ? Number(it.raw_reward) || 0 : 0;

        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${it.user_id ? `${safeText(it.username)} (uid ${it.user_id})` : safeText(it.username)}</td>
           <td>${it.total_posts || 0}</td>
           <td>${it.fast_posts || 0}</td>
           <td>${it.delta_posts || 0}</td>
           <td>${it.delta_fast || 0}</td>
           <td>${it.episodes_total || 0}</td>
           <td>${it.delta_episodes || 0}</td>
           <td title="${safeText(multHint)}">${safeText(multText)}${safeText(multHint)}</td>
           <td>${raw ? `+${raw}` : '0'}</td>
           <td>${it.post_reward ? `+${it.post_reward}` : '0'}</td>
           <td>${it.episode_reward ? `+${it.episode_reward}` : '0'}</td>
           <td>${it.reward_total ? `+${it.reward_total}` : '0'}</td>
           <td>${it.post_request_id ? `#${it.post_request_id}` : '–'}</td>
           <td>${it.episode_request_id ? `#${it.episode_request_id}` : '–'}</td>`;
        tbody.appendChild(tr);
      });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  function buildBaselineFromUserStates(userStates) {
    const baseById = new Map();

    const gp = Array.isArray(userStates?.gameposts) ? userStates.gameposts : [];
    for (const r of gp) {
      const uid = Number(r.user_id) || 0;
      if (uid <= 0) continue;
      baseById.set(uid, {
        userId: uid,
        username: safeText(r.username),
        totalPosts: Number(r.total_posts) || 0,
        fastPosts: Number(r.fast_posts) || 0,
        episodesTotal: 0,

        rewardMultiplier: 1,
        rewardMultiplierValidTo: 0,
      });
    }

    const ep = Array.isArray(userStates?.episodes) ? userStates.episodes : [];
    for (const r of ep) {
      const uid = Number(r.user_id) || 0;
      if (uid <= 0) continue;

      const rec = baseById.get(uid) || {
        userId: uid,
        username: safeText(r.username),
        totalPosts: 0,
        fastPosts: 0,
        episodesTotal: 0,

        rewardMultiplier: 1,
        rewardMultiplierValidTo: 0,
      };

      rec.episodesTotal = Number(r.episodes_total) || 0;
      baseById.set(uid, rec);
    }

    return baseById;
  }

  function ensureUser(baseById, uid, username) {
    if (!uid || uid <= 0) return null;
    const rec =
      baseById.get(uid) || {
        userId: uid,
        username: username || '',
        totalPosts: 0,
        fastPosts: 0,
        episodesTotal: 0,

        rewardMultiplier: 1,
        rewardMultiplierValidTo: 0,
      };
    if (!rec.username && username) rec.username = username;
    baseById.set(uid, rec);
    return rec;
  }

  async function incrementalScanTopic(topic, cursor, baseById, nextCursors, log) {
    const overlap = Math.max(0, Number(SETTINGS.safetyOverlapPosts) || 0);
    const postsPerPage = SETTINGS.postsPerRequest || 100;
    const fastThreshold = SETTINGS.fastThresholdSeconds || 24 * 3600;
    const tsNow = nowSec();

    // 1) Быстрая ветка
    if (
      cursor &&
      topic.last_post_id &&
      cursor.lastPostId &&
      topic.last_post_id === cursor.lastPostId
    ) {
      nextCursors.set(topic.id, { ...cursor, forumId: topic.forum_id, updatedAt: tsNow });
      return;
    }

    // 2) Нет курсора — полный скан
    if (!cursor || !cursor.lastPostId) {
      log(`topic#${topic.id}: no cursor → full scan`);
      const posts = await getAllPostsForTopicAsc(topic.id, log);

      let epParticipants = null;
      if (topic.forum_id === Number(SETTINGS.episodeForumId)) epParticipants = {};

      let prev = null;

      for (let i = 0; i < posts.length; i += 1) {
        const p = posts[i];

        if (!SETTINGS.includeFirstPost && i === 0) {
          prev = p;
          if (epParticipants) {
            const uname0 = (p.username || '').trim();
            if (uname0) {
              let uid0 = p.userId;
              if (!uid0) uid0 = await getUserIdByUsername(uname0, log);
              const key0 = uid0 ? String(uid0) : `name:${uname0.toLowerCase()}`;
              epParticipants[key0] = uname0;
            }
          }
          continue;
        }

        const uname = (p.username || '').trim();
        if (!uname) {
          prev = p;
          continue;
        }

        let uid = p.userId;
        if (!uid) uid = await getUserIdByUsername(uname, log);
        if (!uid) {
          prev = p;
          continue;
        }

        const rec = ensureUser(baseById, uid, uname);
        if (!rec) {
          prev = p;
          continue;
        }

        rec.totalPosts += 1;

        if (prev && prev.posted && p.posted) {
          const delta = p.posted - prev.posted;
          if (delta > 0 && delta < fastThreshold) rec.fastPosts += 1;
        }

        if (epParticipants) epParticipants[String(uid)] = uname;

        prev = p;
      }

      const last = posts.length ? posts[posts.length - 1] : null;

      nextCursors.set(topic.id, {
        topicId: topic.id,
        forumId: topic.forum_id,
        lastPostId: last ? last.id : 0,
        lastPostedTs: last ? (last.posted || 0) : 0,
        lastPostUsername: last ? (last.username || '') : '',
        lastPostUserId: last ? (last.userId || null) : null,
        episodeParticipants: epParticipants,
        createdAt: tsNow,
        updatedAt: tsNow,
      });

      return;
    }

    const targetId = Number(cursor.lastPostId) || 0;

    const collectedDesc = [];
    let found = false;
    let olderAfterFound = 0;
    let done = false;

    let skip = 0;
    let pages = 0;

    while (!done) {
      pages += 1;
      if (
        pages >
        (SETTINGS.safety?.maxPostPagesPerTopic || DEFAULT_CONFIG.safety.maxPostPagesPerTopic)
      ) {
        throw new Error(`topic#${topic.id}: exceeded maxPostPagesPerTopic while searching cursor`);
      }

      const pageRows = await getPostsDescPage(topic.id, skip, postsPerPage, log);
      if (!pageRows.length) break;

      for (const p of pageRows) {
        collectedDesc.push(p);

        if (!found) {
          if (p.id === targetId) {
            found = true;
            if (overlap === 0) {
              done = true;
              break;
            }
          }
        } else {
          olderAfterFound += 1;
          if (olderAfterFound >= overlap) {
            done = true;
            break;
          }
        }
      }

      if (done) break;
      if (pageRows.length < postsPerPage) break;

      skip += postsPerPage;
      await sleep(SETTINGS.delayBetweenRequestsMs);
    }

    if (!found) {
      log(`topic#${topic.id}: cursor post not found → FULL SCAN fallback`);
      const fallback = await getAllPostsForTopicAsc(topic.id, log);

      const lastPostedBoundary = Number(cursor.lastPostedTs) || 0;
      const lastIdBoundary = targetId;

      let epParticipants = cursor.episodeParticipants ? { ...cursor.episodeParticipants } : null;
      if (topic.forum_id === Number(SETTINGS.episodeForumId)) {
        if (!epParticipants) epParticipants = {};
      }

      const newPosts = fallback.filter((p) => p.id > lastIdBoundary);

      let prevPosted = lastPostedBoundary;

      for (let i = 0; i < newPosts.length; i += 1) {
        const p = newPosts[i];
        const uname = (p.username || '').trim();
        if (!uname) {
          prevPosted = p.posted || prevPosted;
          continue;
        }

        let uid = p.userId;
        if (!uid) uid = await getUserIdByUsername(uname, log);
        if (!uid) {
          prevPosted = p.posted || prevPosted;
          continue;
        }

        const rec = ensureUser(baseById, uid, uname);
        if (!rec) continue;

        rec.totalPosts += 1;

        if (prevPosted && p.posted) {
          const delta = p.posted - prevPosted;
          if (delta > 0 && delta < fastThreshold) rec.fastPosts += 1;
        }
        prevPosted = p.posted || prevPosted;

        if (epParticipants) {
          const key = String(uid);
          if (!epParticipants[key]) epParticipants[key] = uname;
        }
      }

      const last = fallback.length ? fallback[fallback.length - 1] : null;

      nextCursors.set(topic.id, {
        topicId: topic.id,
        forumId: topic.forum_id,
        lastPostId: last ? last.id : cursor.lastPostId,
        lastPostedTs: last ? (last.posted || 0) : cursor.lastPostedTs,
        lastPostUsername: last ? (last.username || '') : cursor.lastPostUsername,
        lastPostUserId: last ? (last.userId || null) : cursor.lastPostUserId,
        episodeParticipants: epParticipants,
        createdAt: cursor.createdAt || tsNow,
        updatedAt: tsNow,
      });

      return;
    }

    const allAsc = collectedDesc.slice().reverse();

    let targetPos = -1;
    for (let i = 0; i < allAsc.length; i += 1) {
      if (allAsc[i].id === targetId) {
        targetPos = i;
        break;
      }
    }

    if (targetPos < 0) {
      log(`topic#${topic.id}: targetPos lost → FULL SCAN fallback`);
      const fallback = await getAllPostsForTopicAsc(topic.id, log);
      const last = fallback.length ? fallback[fallback.length - 1] : null;

      nextCursors.set(topic.id, {
        ...cursor,
        forumId: topic.forum_id,
        lastPostId: last ? last.id : cursor.lastPostId,
        lastPostedTs: last ? (last.posted || 0) : cursor.lastPostedTs,
        lastPostUsername: last ? (last.username || '') : cursor.lastPostUsername,
        lastPostUserId: last ? (last.userId || null) : cursor.lastPostUserId,
        updatedAt: tsNow,
      });
      return;
    }

    const postsNew = allAsc.slice(targetPos + 1);

    if (!postsNew.length) {
      nextCursors.set(topic.id, { ...cursor, forumId: topic.forum_id, updatedAt: tsNow });
      return;
    }

    let boundaryPosted = Number(cursor.lastPostedTs) || 0;
    if (!boundaryPosted) {
      const cursorPost = allAsc[targetPos];
      if (cursorPost && cursorPost.posted) boundaryPosted = cursorPost.posted;
    }

    let epParticipants = cursor.episodeParticipants ? { ...cursor.episodeParticipants } : null;
    if (topic.forum_id === Number(SETTINGS.episodeForumId)) {
      if (!epParticipants) epParticipants = {};
    }

    let prevPosted = boundaryPosted;

    for (let i = 0; i < postsNew.length; i += 1) {
      const p = postsNew[i];
      const uname = (p.username || '').trim();
      if (!uname) {
        prevPosted = p.posted || prevPosted;
        continue;
      }

      let uid = p.userId;
      if (!uid) uid = await getUserIdByUsername(uname, log);
      if (!uid) {
        prevPosted = p.posted || prevPosted;
        continue;
      }

      const rec = ensureUser(baseById, uid, uname);
      if (!rec) continue;

      rec.totalPosts += 1;

      if (prevPosted && p.posted) {
        const delta = p.posted - prevPosted;
        if (delta > 0 && delta < fastThreshold) rec.fastPosts += 1;
      }
      prevPosted = p.posted || prevPosted;

      if (epParticipants) {
        const key = String(uid);
        if (!epParticipants[key]) epParticipants[key] = uname;
      }
    }

    const newest = allAsc[allAsc.length - 1];

    nextCursors.set(topic.id, {
      topicId: topic.id,
      forumId: topic.forum_id,
      lastPostId: newest ? newest.id : cursor.lastPostId,
      lastPostedTs: newest ? (newest.posted || 0) : cursor.lastPostedTs,
      lastPostUsername: newest ? (newest.username || '') : cursor.lastPostUsername,
      lastPostUserId: newest ? (newest.userId || null) : cursor.lastPostUserId,
      episodeParticipants: epParticipants,
      createdAt: cursor.createdAt || tsNow,
      updatedAt: tsNow,
    });
  }

  function applyEpisodeTotalsFromParticipants(baseById, nextCursors, prevCursors, log) {
    const episodeForumId = Number(SETTINGS.episodeForumId) || 0;
    if (!episodeForumId) return;

    for (const [topicId, cur] of nextCursors.entries()) {
      if (!cur || Number(cur.forumId) !== episodeForumId) continue;

      const prev = prevCursors && prevCursors[String(topicId)] ? prevCursors[String(topicId)] : null;
      const prevSet = prev && prev.episodeParticipants ? prev.episodeParticipants : null;
      const nextSet = cur.episodeParticipants || null;

      if (!nextSet) continue;

      const prevKeys = prevSet ? new Set(Object.keys(prevSet)) : new Set();
      const nextKeys = Object.keys(nextSet);

      let newParticipants = 0;

      for (const k of nextKeys) {
        if (prevKeys.has(k)) continue;
        if (k.startsWith('name:')) continue;

        const uid = Number(k) || 0;
        if (uid <= 0) continue;

        const uname = safeText(nextSet[k] || '');
        const rec = ensureUser(baseById, uid, uname);
        if (!rec) continue;

        rec.episodesTotal += 1;
        newParticipants += 1;
      }

      if (newParticipants) log(`episode topic#${topicId}: новых участников ${newParticipants}`);
    }
  }

  function init() {
    const pick = (...sels) => {
      for (const s of sels) {
        if (!s) continue;
        const el = document.querySelector(s);
        if (el) return el;
      }
      return null;
    };

    const runBtn = pick(SELECTORS.runButton, '#ks-gpreward-run', '#ks-recount-run');
    const applyBtn = pick(SELECTORS.applyButton, '#ks-gpreward-apply', '#ks-recount-save');
    const previewBox = pick(SELECTORS.previewBox, '#ks-gpreward-preview', '#ks-recount-result');
    const summaryBox = pick(SELECTORS.summaryBox, '#ks-gpreward-summary', '#ks-recount-progress');
    const warningBox = pick(SELECTORS.warningBox, '#ks-gpreward-warning', '#ks-recount-warning');
    const errorBox = pick(SELECTORS.errorBox, '#ks-gpreward-error', '#ks-recount-error');

    if (!runBtn || !previewBox) {
      if (SETTINGS.logToConsole) console.warn('[recount] UI not found. selectors=', SELECTORS);
      return;
    }

    let isBusy = false;

    let lastUsersForBank = null;
    let lastNextCursorsArr = null;
    let lastPrevCursors = null;

    const log = (m) => {
      if (SETTINGS.logToConsole) console.log('[recount]', m);
    };

    const setText = (el, txt) => {
      if (!el) return;
      el.textContent = txt || '';
    };

    const show = (el, visible) => {
      if (!el) return;
      el.style.display = visible ? '' : 'none';
    };

    const setBusy = (b) => {
      isBusy = b;
      runBtn.disabled = b;
      if (applyBtn) applyBtn.disabled = b || !lastUsersForBank;
      runBtn.textContent = b ? 'Пересчёт…' : 'Пересчитать';
      if (applyBtn && b) applyBtn.style.display = 'none';
    };

    async function doRun(isApplyPhase) {
      const forumIds = Array.isArray(SETTINGS.forumIds) ? SETTINGS.forumIds : [];
      if (!forumIds.length) throw new Error('forumIds пустой');

      setText(errorBox, '');
      show(errorBox, false);
      setText(warningBox, '');
      show(warningBox, false);
      setText(summaryBox, 'Загружаю состояние из БД…');

      const state = await getStateFromDb(log);
      lastPrevCursors = state.cursors || {};

      setText(summaryBox, 'Загружаю темы…');
      const topics = await getAllTopicsForForums(forumIds, log);
      setText(summaryBox, `Тем: ${topics.length}. Инкрементальный проход…`);

      const baseById = buildBaselineFromUserStates(state.userStates);
      const nextCursors = new Map();

      for (let i = 0; i < topics.length; i += 1) {
        const t = topics[i];
        setText(summaryBox, `Тема ${i + 1}/${topics.length}: #${t.id}`);

        const cursor = lastPrevCursors[String(t.id)] || null;
        await incrementalScanTopic(t, cursor, baseById, nextCursors, log);

        await sleep(SETTINGS.delayBetweenRequestsMs);
      }

      applyEpisodeTotalsFromParticipants(baseById, nextCursors, lastPrevCursors, log);

      const users = Array.from(baseById.values()).filter(
        (u) => Number.isFinite(u.userId) && u.userId > 0,
      );

      const multMap = await loadMultipliersForNow(log);
      let multCount = 0;
      for (const u of users) {
        const rec = multMap.get(Number(u.userId) || 0);
        if (rec) {
          u.rewardMultiplier = Number(rec.factor) || 1;
          u.rewardMultiplierValidTo = Number(rec.validTo) || 0;
          multCount += 1;
        } else {
          u.rewardMultiplier = 1;
          u.rewardMultiplierValidTo = 0;
        }
      }
      if (multCount) log(`multipliers: пользователей с активным множителем: ${multCount}`);

      const cursorsArr = Array.from(nextCursors.values());

      if (isApplyPhase) {
        for (const c of cursorsArr) {
          if (!c || !c.episodeParticipants) continue;
          const obj = c.episodeParticipants;
          const keys = Object.keys(obj);
          for (const k of keys) {
            if (!k.startsWith('name:')) continue;
            const uname = safeText(obj[k]);
            const uid = await getUserIdByUsername(uname, log);
            if (uid && uid > 0) {
              delete obj[k];
              obj[String(uid)] = uname;
            }
          }
        }
      }

      return { users, cursorsArr };
    }

    runBtn.addEventListener('click', async () => {
      if (isBusy) return;
      setBusy(true);

      previewBox.innerHTML = '';
      lastUsersForBank = null;
      lastNextCursorsArr = null;
      if (applyBtn) applyBtn.disabled = true;

      try {
        const { users, cursorsArr } = await doRun(false);

        setText(summaryBox, `Расчёт наград (bank-api)… пользователей: ${users.length}`);
        const postItems = await callBankApi('calcGamepostRewards', users, log);
        const episodeItems = await callBankApiEpisodes('calcEpisodeRewards', users, log);

        const merged = mergeRewards(postItems, episodeItems);

        const usersById = new Map(users.map((u) => [u.userId, u]));
        renderPreview(previewBox, merged, usersById);

        const total = merged.reduce((s, it) => s + (Number(it.reward_total) || 0), 0);
        setText(summaryBox, `Готово. Пользователей: ${merged.length}. Суммарная награда: ${total}.`);

        lastUsersForBank = users;
        lastNextCursorsArr = cursorsArr;

        if (applyBtn) {
          applyBtn.style.display = users.length ? '' : 'none';
          applyBtn.disabled = !users.length;
        }
      } catch (e) {
        console.error(e);
        setText(errorBox, `Ошибка: ${e.message || e}`);
        show(errorBox, true);
        setText(summaryBox, 'Пересчёт завершился с ошибкой.');
      } finally {
        setBusy(false);
      }
    });

    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        if (isBusy || !lastUsersForBank || !lastNextCursorsArr) return;

        const token = getAdminToken();
        if (!token) {
          alert('Нет admin token: задай window.KS_ADMIN_TOKEN в HTML админки.');
          return;
        }

        if (!window.confirm('Создать заявки (APPLY) и зафиксировать курсоры в БД?')) return;

        setBusy(true);
        try {
          setText(summaryBox, 'APPLY: создаю заявки в bank-api…');

          const postItems = await callBankApi('applyGamepostRewards', lastUsersForBank, log);
          const episodeItems = await callBankApiEpisodes('applyEpisodeRewards', lastUsersForBank, log);

          const merged = mergeRewards(postItems, episodeItems);

          const usersById = new Map(lastUsersForBank.map((u) => [u.userId, u]));
          renderPreview(previewBox, merged, usersById);

          setText(summaryBox, 'APPLY: сохраняю курсоры в БД…');
          await saveStateToDb(lastNextCursorsArr, log);

          const total = merged.reduce((s, it) => s + (Number(it.reward_total) || 0), 0);
          setText(summaryBox, `Готово. APPLY выполнен. Суммарная награда: ${total}.`);
          setText(warningBox, 'Курсоры обновлены. Заявки смотри во вкладке "Банк".');
          show(warningBox, true);
        } catch (e) {
          console.error(e);
          setText(errorBox, `Ошибка APPLY: ${e.message || e}`);
          show(errorBox, true);
        } finally {
          setBusy(false);
        }
      });
    }
  }

  if (typeof runOnceOnReady === 'function') runOnceOnReady(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


