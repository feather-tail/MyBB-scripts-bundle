(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('chronoParser') || {};
  const forumsWithGames = config.forumsWithGames || { active: [], done: [] };
  const currentYearSetting =
    Number(config.currentYear) || new Date().getFullYear();
  const topicsPerRequest = Number(config.topicsPerRequest) || 100;
  const postsPerRequest = Number(config.postsPerRequest) || 100;
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
    июнь: 6,
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
      if (potentialYear > currentYear) {
        fullYear = Number(
          String(currentCentury - 1).padStart(2, '0') + yearStr.substring(1, 3),
        );
      } else {
        fullYear = potentialYear;
      }
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
          } catch (error) {
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
      `&fields=id,subject,first_post,forum_id&limit=${topicsPerRequest}`;
    const data = await fetchData(url);
    return Array.isArray(data?.response) ? data.response : [];
  }

  async function getPosts(topicIds) {
    if (!topicIds || topicIds.length === 0) return [];

    const topicParam = topicIds.join(',');
    const baseUrl =
      `${apiBase}?method=post.get&topic_id=${topicParam}` +
      `&fields=id,user_id,username,message,topic_id&limit=${postsPerRequest}`;

    async function fetchWithRetry(url, retries = 2) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const data = await fetchData(url);
        if (data) return data;
      }
      return null;
    }

    const allPosts = [];
    let skip = 0;
    const maxPages = 200;

    while (skip / postsPerRequest < maxPages) {
      const data = await fetchWithRetry(`${baseUrl}&skip=${skip}`);
      const batch = Array.isArray(data?.response)
        ? normalizePosts(data.response)
        : [];
      if (!batch.length) break;
      allPosts.push(...batch);
      if (batch.length < postsPerRequest) break;
      skip += postsPerRequest;
    }

    return allPosts;
  }

  function normalizePosts(items) {
    return items.map((p) => ({
      ...p,
      id: Number(p.id),
      topic_id: Number(p.topic_id),
      user_id: String(p.user_id),
      username: p.username,
      message: p.message,
    }));
  }

  async function processForum(forumId, activeFlag, forumTopics) {
    const topicIds = forumTopics.map((t) => t.id);
    const posts = await getPosts(topicIds);

    const processedTopics = forumTopics.map((topic) => ({
      ...topic,
      posts_count: 0,
      users: new Map(),
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
    }));

    const topicMap = new Map(processedTopics.map((t) => [t.id, t]));

    for (const post of posts) {
      const topic = topicMap.get(post.topic_id);
      if (!topic) {
        console.error(`Тема не найдена для поста в форуме ${forumId}:`, post);
        continue;
      }

      topic.posts_count++;

      const userKey = String(post.user_id);
      if (!topic.users.has(userKey)) {
        const userData = [post.user_id, post.username];
        const nickMatch = post.message.match(nickRegex);
        if (nickMatch) userData.push(nickMatch[1].trim());
        topic.users.set(userKey, userData);
      }

      const pid = Number(post.id);
      const firstPost = Number(topic.first_post);
      const hasFirst = firstPost > 0;
      const correctFirstPost = hasFirst && firstPost < pid;

      if (pid === firstPost || !correctFirstPost) {
        const addons = parseAddons(post.message);
        if (addons) topic.addon = { ...topic.addon, ...addons };
        if (!correctFirstPost) {
          topic.first_post = pid;
        }
        if (!topic.addon.description) topic.addon.description = post.message;
      }
      topic.flags.descr = Number(topic.first_post) !== 0;
    }

    for (const topic of processedTopics) {
      topic.users = Array.from(topic.users.values());

      const parsedDate = parseDate(topic.subject);
      const addonDate = topic.addon.date;

      if (parsedDate || addonDate.y || addonDate.m || addonDate.d) {
        topic.date = parsedDate || addonDate;
        topic.flags.full_date = Number(topic.date.d) !== 0;
      }
    }

    return processedTopics;
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
    for (const raw of rawTopics) {
      const topic = {
        id: Number(raw.id),
        subject: decodeHtml(raw.subject ?? ''),
        first_post: Number(raw.first_post),
        forum_id: String(raw.forum_id),
      };
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
