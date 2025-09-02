(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('chronoParser') || {};

  const forumsWithGames = config.forumsWithGames || { active: [], done: [] };
  const currentYearSetting =
    Number(config.currentYear) || new Date().getFullYear();
  const topicsPerRequest = Math.min(
    Number(config.topicsPerRequest) || 100,
    100,
  );
  const postsPerRequest = Math.min(Number(config.postsPerRequest) || 100, 100);
  const usersMax = Math.min(Number(config.usersMax) || postsPerRequest, 100);
  const apiBase = config.apiBase || '/api.php';
  const preferSubjectDate =
    'preferSubjectDate' in config ? !!config.preferSubjectDate : true;
  const fetchDescriptionAll =
    'fetchDescriptionAll' in config ? !!config.fetchDescriptionAll : false;

  const decodeTextarea = document.createElement('textarea');
  const decodeHtml = (str) => {
    decodeTextarea.innerHTML = String(str ?? '');
    return decodeTextarea.value;
  };

  const monthMap = {
    январь: 1,
    января: 1,
    февраль: 2,
    февраля: 2,
    март: 3,
    марта: 3,
    апрель: 4,
    апреля: 4,
    май: 5,
    мая: 5,
    июнь: 6,
    июня: 6,
    июль: 7,
    июля: 7,
    август: 8,
    августа: 8,
    сентябрь: 9,
    сентября: 9,
    октябрь: 10,
    октября: 10,
    ноябрь: 11,
    ноября: 11,
    декабрь: 12,
    декабря: 12,
  };
  const getMonthNumber = (s) => monthMap[String(s || '').toLowerCase()] || 0;

  function getFullYear(year) {
    const t = typeof year;
    if (t !== 'number' && t !== 'string') return 0;
    const n = Number(year);
    if (Number.isNaN(n)) return 0;
    if (n > 999) return n;

    const currentYear = currentYearSetting;
    const currentCentury = Math.floor(currentYear / 100);

    if (n <= 99) {
      let candidate = currentCentury * 100 + n;
      if (candidate > currentYear) candidate -= 100;
      return candidate;
    }
    const ystr = String(n).padStart(3, '0');
    const pref = String(currentCentury).padStart(2, '0');
    const candidate = Number(pref + ystr.substring(1, 3));
    return candidate > currentYear
      ? Number(
          String(currentCentury - 1).padStart(2, '0') + ystr.substring(1, 3),
        )
      : candidate;
  }

  const dateRegex = /(\d{1,2})[.\/ -]?(\d{1,2})[.\/ -]?(\d{2,4})/;
  const monthsPattern = Object.keys(monthMap).join('|');
  const wordDayMonthYearRx = new RegExp(
    `\\b(\\d{1,2})\\s+(${monthsPattern})\\s+(\\d{4})(?:\\s*г(?:\\.|ода)?)?\\b`,
    'iu',
  );
  const wordMonthYearRx = new RegExp(
    `\\b(${monthsPattern})\\s+(\\d{4})(?:\\s*г(?:\\.|ода)?)?\\b`,
    'iu',
  );
  const yearOnlyRx = /(?:^|[^\d])(1\d{3}|20\d{2})(?!\d)/;

  const nickRegex = /\[nick\](.*?)\[\/nick\]/;

  function parseDate(subject) {
    const normalized = String(subject || '')
      .toLowerCase()
      .replace(/,/g, ' ');

    let m = normalized.match(dateRegex);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = parseInt(m[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { y: getFullYear(year), m: month, d: day };
      }
    }

    m = normalized.match(wordDayMonthYearRx);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = getMonthNumber(m[2]);
      const year = parseInt(m[3], 10);
      if (month) return { y: getFullYear(year), m: month, d: day };
    }

    m = normalized.match(wordMonthYearRx);
    if (m) {
      const month = getMonthNumber(m[1]);
      const year = parseInt(m[2], 10);
      if (month) return { y: getFullYear(year), m: month, d: 0 };
    }

    const yg = normalized.match(yearOnlyRx);
    if (yg) return { y: getFullYear(yg[1]), m: 0, d: 0 };

    return null;
  }

  const addonParsers = {
    display: /\[chronodisplay\](.*?)\[\/chronodisplay\]/,
    date: /\[chronodate\]y:\s*(\d+),\s*m:\s*(\d+),\s*d:\s*(\d+)\[\/chronodate\]/,
    serial: /\[chronoserial\](.*?)\[\/chronoserial\]/,
    quest: /\[chronoquest\](.*?)\[\/chronoquest\]/,
  };

  function parseAddons(message) {
    const addons = {};
    let hasMatch = false;

    for (const name in addonParsers) {
      const match = message.match(addonParsers[name]);
      if (!match) continue;

      switch (name) {
        case 'display':
          addons.display = match[1];
          hasMatch = true;
          break;
        case 'date':
          addons.date = {
            y: parseInt(match[1], 10),
            m: parseInt(match[2], 10),
            d: parseInt(match[3], 10),
          };
          hasMatch = true;
          break;
        case 'serial':
          addons.is_serial = true;
          addons.serial_first = parseInt(match[1], 10);
          hasMatch = true;
          break;
        case 'quest': {
          const raw = match[1].trim();
          if (/^[\[{]/.test(raw)) {
            try {
              addons.quest = JSON.parse(raw);
            } catch {
              addons.quest = raw;
            }
          } else {
            addons.quest = raw;
          }
          hasMatch = true;
          break;
        }
        default:
          addons[name] = match[1];
          hasMatch = true;
      }
    }
    return hasMatch ? addons : false;
  }

  async function fetchData(url) {
    try {
      return await helpers.request(url, { responseType: 'json' });
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return null;
    }
  }

  async function getTopics(forumIds) {
    const url =
      `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
      `&fields=id,subject,forum_id,first_post,init_post&limit=${topicsPerRequest}`;
    const data = await fetchData(url);
    const rows = Array.isArray(data?.response) ? data.response : [];
    return rows.map((raw) => ({
      id: Number(raw.id),
      subject: decodeHtml(raw.subject ?? ''),
      forum_id: String(raw.forum_id),
      first_post: Number(raw.init_id ?? raw.first_post ?? 0) || 0,
    }));
  }

  async function getFirstPostsByIds(postIds) {
    if (!postIds.length) return new Map();

    const uniqueIds = Array.from(new Set(postIds));
    const limit = Math.min(postsPerRequest, 100);
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += limit) {
      chunks.push(uniqueIds.slice(i, i + limit));
    }

    const out = [];
    const concurrency = 4;
    const executing = new Set();

    const runChunk = async (chunk) => {
      const url =
        `${apiBase}?method=post.get&post_id=${chunk.join(',')}` +
        `&fields=id,user_id,username,message,topic_id&limit=${chunk.length}`;
      const data = await fetchData(url);
      const arr = Array.isArray(data?.response) ? data.response : [];
      out.push(...arr);
    };

    for (const chunk of chunks) {
      const p = runChunk(chunk).finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= concurrency) await Promise.race(executing);
    }
    await Promise.all(executing);

    const map = new Map();
    for (const p of out) {
      map.set(Number(p.topic_id), {
        id: Number(p.id),
        topic_id: Number(p.topic_id),
        user_id: String(p.user_id),
        username: p.username,
        message: p.message,
      });
    }
    return map;
  }

  async function getUsersForTopics(topicIds) {
    const results = new Map();
    const concurrency = 4;
    const executing = new Set();

    const runOne = async (tid) => {
      const url =
        `${apiBase}?method=post.get&topic_id=${tid}` +
        `&fields=user_id,username,topic_id,id&sort_by=id&sort_dir=asc&limit=${usersMax}`;
      const data = await fetchData(url);
      const arr = Array.isArray(data?.response) ? data.response : [];
      const seen = new Set();
      const users = [];
      for (const p of arr) {
        const uid = String(p.user_id);
        if (!seen.has(uid)) {
          seen.add(uid);
          users.push([uid, p.username]);
        }
      }
      results.set(Number(tid), users);
    };

    for (const tid of topicIds) {
      const p = runOne(tid).finally(() => executing.delete(p));
      executing.add(p);
      if (executing.size >= concurrency) await Promise.race(executing);
    }
    await Promise.all(executing);

    return results;
  }

  function makeTopicSkeleton(topic, activeFlag) {
    return {
      ...topic,
      posts_count: 0,
      users: [],
      flags: {
        active: activeFlag,
        done: !activeFlag,
        full_date: false,
        descr: false,
      },
      date: null,
      addon: {
        display: null,
        date: { y: 0, m: 0, d: 0 },
        is_serial: false,
        serial_first: 0,
        quest: false,
        description: '',
      },
    };
  }

  async function processForum(forumId, activeFlag, forumTopics) {
    const topicsNeedingPost = forumTopics.filter((t) => {
      if (fetchDescriptionAll) return true;
      const hasSubjectDate = !!parseDate(t.subject);
      return !preferSubjectDate || !hasSubjectDate;
    });

    const firstIdsRaw = topicsNeedingPost
      .map((t) => Number(t.first_post) || 0)
      .filter((id) => id > 0);

    const firstIdsSet = new Set(firstIdsRaw);

    const missingTopics = topicsNeedingPost
      .filter((t) => !t.first_post)
      .map((t) => t.id);
    if (missingTopics.length) {
      for (let i = 0; i < missingTopics.length; i += 100) {
        const slice = missingTopics.slice(i, i + 100);
        const url =
          `${apiBase}?method=topic.get&topic_id=${slice.join(',')}` +
          `&fields=id,init_post&limit=${slice.length}`;
        const data = await fetchData(url);
        const arr = Array.isArray(data?.response) ? data.response : [];
        for (const r of arr) {
          const tid = Number(r.id);
          const fid = Number(r.init_id ?? 0);
          const target = forumTopics.find((t) => t.id === tid);
          if (target && fid) {
            target.first_post = fid;
            firstIdsSet.add(fid);
          }
        }
      }
    }

    const firstIds = Array.from(firstIdsSet);
    const firstPostsMap = await getFirstPostsByIds(firstIds);
    const topicUsersMap = await getUsersForTopics(forumTopics.map((t) => t.id));

    const processed = forumTopics.map((t) => {
      const dto = makeTopicSkeleton(t, activeFlag);

      const subjectDate = parseDate(dto.subject);
      if (subjectDate) {
        dto.date = subjectDate;
        dto.flags.full_date = Number(subjectDate.d) !== 0;
      }

      const users = topicUsersMap.get(dto.id);
      if (Array.isArray(users)) dto.users = users;

      if (firstPostsMap.has(dto.id)) {
        const fp = firstPostsMap.get(dto.id);
        const addons = parseAddons(fp.message || '');
        if (addons) dto.addon = { ...dto.addon, ...addons };
        dto.addon.description ||= fp.message || '';

        const nickMatch = fp.message?.match(nickRegex);
        if (nickMatch) {
          const nick = nickMatch[1].trim();
          const uid = String(fp.user_id);
          const i = dto.users.findIndex((u) => String(u[0]) === uid);
          if (i >= 0 && dto.users[i].length === 2) {
            dto.users[i].push(nick);
          } else if (i === -1) {
            dto.users.push([uid, fp.username, nick]);
          }
        }

        if (
          dto.addon.date &&
          (dto.addon.date.y || dto.addon.date.m || dto.addon.date.d)
        ) {
          if (!dto.date) {
            dto.date = { ...dto.addon.date };
          } else if (dto.addon.date.y) {
            dto.date.y = getFullYear(dto.addon.date.y);
          }
        }

        dto.flags.descr = true;
        dto.flags.full_date = dto.date ? Number(dto.date.d) !== 0 : false;
      } else {
        dto.flags.descr = Number(dto.first_post) !== 0;
      }

      return dto;
    });

    return processed;
  }

  async function run() {
    const activeForums = Array.isArray(forumsWithGames.active)
      ? forumsWithGames.active.map(String)
      : [];
    const doneForums = Array.isArray(forumsWithGames.done)
      ? forumsWithGames.done.map(String)
      : [];
    const allForums = [...activeForums, ...doneForums];
    if (!allForums.length) {
      console.warn('chronoParser: no forums configured');
      return;
    }

    const activeSet = new Set(activeForums);
    const rawTopics = await getTopics(allForums);

    const topicsByForum = new Map();
    for (const topic of rawTopics) {
      const key = topic.forum_id;
      if (!topicsByForum.has(key)) topicsByForum.set(key, []);
      topicsByForum.get(key).push(topic);
    }

    const promises = allForums.map((fid) =>
      processForum(fid, activeSet.has(fid), topicsByForum.get(fid) || []),
    );

    const results = await Promise.all(promises);
    console.log(results.flat().filter((t) => t.date));
  }

  function init() {
    run();
  }

  helpers.runOnceOnReady(init);
  helpers.register('chronoParser', { init });
})();
