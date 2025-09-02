(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('chronoParser') || {};
  const forumsWithGames = config.forumsWithGames || { active: [], done: [] };
  const currentYearSetting =
    Number(config.currentYear) || new Date().getFullYear();
  const topicsPerRequest = Number(config.topicsPerRequest) || 100;
  const postsPerRequest = Math.min(Number(config.postsPerRequest) || 100, 100);
  const apiBase = config.apiBase || '/api.php';
  const decodeTextarea = document.createElement('textarea');

  const decodeHtml = (str) => {
    decodeTextarea.innerHTML = String(str ?? '');
    return decodeTextarea.value;
  };

  const monthMap = {
    январь: 1,
    февраль: 2,
    март: 3,
    апрель: 4,
    май: 5,
    июль: 7,
    август: 8,
    сентябрь: 9,
    октябрь: 10,
    ноябрь: 11,
    декабрь: 12,
  };
  const getMonthNumber = (monthStr) =>
    monthMap[String(monthStr || '').toLowerCase()] || 0;

  function getFullYear(year) {
    const yearType = typeof year;
    if (yearType !== 'number' && yearType !== 'string') return 0;
    const yearNum = Number(year);
    if (Number.isNaN(yearNum)) return 0;
    if (yearNum > 999) return yearNum;

    const currentYear = currentYearSetting;
    const currentCentury = Math.floor(currentYear / 100);
    let fullYear;

    if (yearNum <= 99) {
      let potentialYear = currentCentury * 100 + yearNum;
      if (potentialYear > currentYear) potentialYear -= 100;
      fullYear = potentialYear;
    } else {
      const yearStr = String(yearNum).padStart(3, '0');
      const currentYearPrefix = String(currentCentury).padStart(2, '0');
      const potentialYear = Number(currentYearPrefix + yearStr.substring(1, 3));
      fullYear =
        potentialYear > currentYear
          ? Number(
              String(currentCentury - 1).padStart(2, '0') +
                yearStr.substring(1, 3),
            )
          : potentialYear;
    }
    return fullYear;
  }

  const dateRegex = /(\d{1,2})[.\/ -]?(\d{1,2})[.\/ -]?(\d{2,4})/;
  const yearMonthRegex = /(\d{2,4})[.\/ -]?([a-zA-Zа-яА-Я]+)/i;
  const yearRegex = /(\d{1,})/;
  const complexDateRegex = /(\d{1,2})\.(\d{3,})-(\d{1,2})\.(\d{3,})/i;
  const wordMonthRegex = new RegExp(
    `(${Object.keys(monthMap).join('|')})\\s*(\\d{4})`,
    'i',
  );
  const nickRegex = /\[nick\](.*?)\[\/nick\]/;

  function parseDate(subject) {
    const normalized = subject.toLowerCase();

    let match = normalized.match(dateRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (month <= 12 && day <= 31) {
        return { y: getFullYear(year), m: month, d: day };
      }
    }

    match = normalized.match(yearMonthRegex);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = getMonthNumber(match[2]);
      if (month) return { y: getFullYear(year), m: month, d: 0 };
    }

    const normalizedNoComma = normalized.replace(/,/g, '');
    const wordMonthMatch = normalizedNoComma.match(wordMonthRegex);
    if (wordMonthMatch) {
      const monthStr = wordMonthMatch[1];
      const yearStr = wordMonthMatch[2];
      const month = getMonthNumber(monthStr);
      const year = parseInt(yearStr, 10);
      if (year && month) return { y: getFullYear(year), m: month, d: 0 };
    }

    const yearOnlyMatch = normalized.match(yearRegex);
    if (yearOnlyMatch) {
      const year = parseInt(yearOnlyMatch[1], 10);
      return { y: getFullYear(year), m: 0, d: 0 };
    }

    match = normalized.match(complexDateRegex);
    if (match) {
      const month = parseInt(match[1], 10);
      const year = parseInt(match[2], 10);
      return { y: getFullYear(year), m: month, d: 0 };
    }

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
    for (const addonName in addonParsers) {
      const match = message.match(addonParsers[addonName]);
      if (!match) continue;
      switch (addonName) {
        case 'display':
          addons[addonName] = match[1];
          hasMatch = true;
          break;
        case 'date':
          addons[addonName] = {
            y: parseInt(match[1], 10),
            m: parseInt(match[2], 10),
            d: parseInt(match[3], 10),
          };
          hasMatch = true;
          break;
        case 'serial':
          addons[addonName] = {
            is_serial: true,
            serial_first: parseInt(match[1], 10),
          };
          hasMatch = true;
          break;
        case 'quest':
          try {
            addons[addonName] = JSON.parse(match[1].trim());
          } catch {
            console.warn(
              'Не удалось разобрать значение [chronoquest]:',
              match[1].trim(),
            );
            addons[addonName] = match[1].trim();
          }
          hasMatch = true;
          break;
        default:
          addons[addonName] = match[1];
          hasMatch = true;
          break;
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
    return rows.map((raw) => {
      const firstPostId = Number(raw.init_id ?? raw.first_post ?? 0) || 0;
      return {
        id: Number(raw.id),
        subject: decodeHtml(raw.subject ?? ''),
        forum_id: String(raw.forum_id),
        first_post: firstPostId,
      };
    });
  }

  async function getFirstPostsByIds(postIds) {
    const chunks = [];
    for (let i = 0; i < postIds.length; i += postsPerRequest) {
      chunks.push(postIds.slice(i, i + postsPerRequest));
    }

    const results = [];
    for (const chunk of chunks) {
      const url =
        `${apiBase}?method=post.get&post_id=${chunk.join(',')}` +
        `&fields=id,user_id,username,message,topic_id&limit=${postsPerRequest}`;
      const data = await fetchData(url);
      const arr = Array.isArray(data?.response) ? data.response : [];
      results.push(...arr);
    }

    const map = new Map();
    for (const p of results) {
      const item = {
        id: Number(p.id),
        topic_id: Number(p.topic_id),
        user_id: String(p.user_id),
        username: p.username,
        message: p.message,
      };
      map.set(item.topic_id, item);
    }
    return map;
  }

  function blankTopic(topic, activeFlag) {
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
    const firstIds = forumTopics
      .map((t) => Number(t.first_post) || 0)
      .filter((id) => id > 0);

    const missing = forumTopics.filter((t) => !t.first_post).map((t) => t.id);
    if (missing.length) {
      for (let i = 0; i < missing.length; i += 100) {
        const slice = missing.slice(i, i + 100);
        const url =
          `${apiBase}?method=topic.get&topic_id=${slice.join(',')}` +
          `&fields=id,init_post&limit=${slice.length}`;
        const data = await fetchData(url);
        const arr = Array.isArray(data?.response) ? data.response : [];
        for (const r of arr) {
          const tid = Number(r.id);
          const fid = Number(r.init_id ?? 0);
          const topic = forumTopics.find((t) => t.id === tid);
          if (topic && fid) {
            topic.first_post = fid;
            firstIds.push(fid);
          }
        }
      }
    }

    const firstPostsMap = await getFirstPostsByIds(firstIds);

    const processed = forumTopics.map((t) => {
      const dto = blankTopic(t, activeFlag);

      const parsedDate = parseDate(dto.subject);
      if (parsedDate) {
        dto.date = parsedDate;
        dto.flags.full_date = Number(parsedDate.d) !== 0;
      }

      const firstPost = firstPostsMap.get(dto.id);
      if (firstPost) {
        const nickMatch = firstPost.message?.match(nickRegex);
        const authorRow = [firstPost.user_id, firstPost.username];
        if (nickMatch) authorRow.push(nickMatch[1].trim());
        dto.users = [authorRow];

        const addons = parseAddons(firstPost.message || '');
        if (addons) dto.addon = { ...dto.addon, ...addons };

        dto.addon.description ||= firstPost.message || '';

        dto.flags.descr = true;

        if (
          !dto.date &&
          (dto.addon.date.y || dto.addon.date.m || dto.addon.date.d)
        ) {
          dto.date = { ...dto.addon.date };
          dto.flags.full_date = Number(dto.date.d) !== 0;
        }
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
