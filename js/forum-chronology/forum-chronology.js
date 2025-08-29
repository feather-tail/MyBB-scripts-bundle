/**
 * Forum chronology collector
 * – получает темы и посты из указанных форумов,
 * – парсит даты из заголовков тем,
 * – извлекает дополнительные теги ([chronodisplay], [chronodate] и т.д.).
 */
(() => {
  'use strict';

  const helpers = window.helpers;
  const cfg = helpers.getConfig('forumChronology', {
    forums: { active: [23, 24], done: [19] },
    currentYear: 2010,
    debug: false,
    topicsPerReq: 100,
    postsPerReq: 100,
    backend: { endpoint: '/api.php' },
  });

  const monthMap = {
    январь: 1,
    янв: 1,
    january: 1,
    jan: 1,
    февраль: 2,
    февр: 2,
    february: 2,
    feb: 2,
    март: 3,
    мар: 3,
    march: 3,
    mar: 3,
    апрель: 4,
    апр: 4,
    april: 4,
    apr: 4,
    май: 5,
    may: 5,
    июнь: 6,
    июн: 6,
    june: 6,
    jun: 6,
    июль: 7,
    июл: 7,
    july: 7,
    jul: 7,
    август: 8,
    авг: 8,
    august: 8,
    aug: 8,
    сентябрь: 9,
    сент: 9,
    september: 9,
    sep: 9,
    октябрь: 10,
    окт: 10,
    october: 10,
    oct: 10,
    ноябрь: 11,
    ноя: 11,
    november: 11,
    nov: 11,
    декабрь: 12,
    дек: 12,
    december: 12,
    dec: 12,
  };

  const addonRx = {
    display: /\[chronodisplay\](.*?)\[\/chronodisplay\]/i,
    date: /\[chronodate\]y:\s*(\d+),\s*m:\s*(\d+),\s*d:\s*(\d+)\[\/chronodate\]/i,
    serial: /\[chronoserial\](\d+)\[\/chronoserial\]/i,
    quest: /\[chronoquest\]([\s\S]*?)\[\/chronoquest\]/i,
  };

  const getMonthNum = (s) => monthMap[s.toLowerCase()] || 0;

  function getFullYear(year) {
    const n = Number(year);
    if (!n) return 0;
    if (n > 999) return n;
    const cur = Number(cfg.currentYear);
    const century = Math.floor(cur / 100) * 100;
    let y = century + n;
    if (y > cur) y -= 100;
    return y;
  }

  function parseDate(subject) {
    const re1 = /(\d{1,2})[.\/ -](\d{1,2})[.\/ -](\d{2,4})/;
    const re2 = /(\d{2,4})[.\/ -]?([a-zа-я]+)/i;
    const re3 = new RegExp(
      `(${Object.keys(monthMap).join('|')})\\s*(\\d{4})`,
      'i',
    );
    const re4 = /(\d{1,2})\.(\d{3,})-(\d{1,2})\.(\d{3,})/i;

    let m = subject.match(re1);
    if (m) {
      return { y: getFullYear(m[3]), m: +m[2], d: +m[1] };
    }
    m = subject.match(re2);
    if (m) {
      const month = getMonthNum(m[2]);
      if (month) return { y: getFullYear(m[1]), m: month, d: 0 };
    }
    m = subject.replace(/,/g, '').match(re3);
    if (m) {
      return { y: getFullYear(m[2]), m: getMonthNum(m[1]), d: 0 };
    }
    m = subject.match(/(\d{1,})/);
    if (m) return { y: getFullYear(m[1]), m: 0, d: 0 };
    m = subject.match(re4);
    if (m) return { y: getFullYear(m[2]), m: +m[1], d: 0 };
    return null;
  }

  function parseAddons(message) {
    const res = { display: null, date: null, serial: null, quest: null };
    let matched = false;

    const disp = message.match(addonRx.display);
    if (disp) {
      res.display = disp[1];
      matched = true;
    }

    const d = message.match(addonRx.date);
    if (d) {
      res.date = { y: +d[1], m: +d[2], d: +d[3] };
      matched = true;
    }

    const s = message.match(addonRx.serial);
    if (s) {
      res.serial = { isSerial: true, serialFirst: +s[1] };
      matched = true;
    }

    const q = message.match(addonRx.quest);
    if (q) {
      try {
        res.quest = JSON.parse(q[1].trim());
      } catch {
        res.quest = q[1].trim();
      }
      matched = true;
    }

    return matched ? res : false;
  }

  const requestJson = (params) =>
    helpers
      .request(`${cfg.backend.endpoint}?${params}`, { responseType: 'json' })
      .catch((e) => (cfg.debug && console.error(e), null));

  async function getTopics(fIds) {
    const params =
      `method=topic.get&forum_id=${fIds.join(',')}` +
      `&fields=id,subject,first_post&limit=${cfg.topicsPerReq}`;
    const data = await requestJson(params);
    return data?.response || [];
  }

  async function getPosts(tIds) {
    if (!tIds.length) return [];
    let skip = 0;
    const posts = [];
    while (true) {
      const params =
        `method=post.get&topic_id=${tIds.join(',')}` +
        `&fields=id,user_id,username,message,topic_id` +
        `&limit=${cfg.postsPerReq}&skip=${skip}`;
      const data = await requestJson(params);
      if (!data?.response?.length) break;
      posts.push(...data.response);
      if (data.response.length < cfg.postsPerReq) break;
      skip += cfg.postsPerReq;
    }
    return posts;
  }

  async function processForum(fid, isActive) {
    const topics = await getTopics([fid]);
    const tIds = topics.map((t) => t.id);
    const posts = await getPosts(tIds);

    const processed = topics.map((t) => ({
      ...t,
      postsCount: 0,
      users: [],
      flags: {
        active: isActive,
        done: !isActive,
        fullDate: false,
        descr: false,
      },
      addon: {
        display: null,
        date: { y: 0, m: 0, d: 0 },
        isSerial: false,
        serialFirst: 0,
        quest: false,
        description: '',
      },
    }));

    for (const p of posts) {
      const idx = processed.findIndex((t) => t.id === p.topic_id);
      if (idx === -1) continue;
      const t = processed[idx];

      t.postsCount++;
      const nick = (p.message.match(/\[nick\](.*?)\[\/nick\]/) || [])[1];
      t.users.push([p.user_id, p.username, nick].filter(Boolean));

      const correctFirst = t.first_post && t.first_post < p.id;
      if (p.id === t.first_post || !correctFirst) {
        const addons = parseAddons(p.message);
        if (addons) Object.assign(t.addon, addons);
        if (!correctFirst) t.first_post = p.id;
        if (!t.addon.description) t.description = p.message;
      }
      t.flags.descr = t.first_post !== 0;
    }

    processed.forEach((t) => {
      const dt = parseDate(t.subject);
      if (dt) {
        t.date = dt;
        t.flags.fullDate = dt.d !== 0;
      } else if (cfg.debug) console.warn('Cannot parse date:', t.subject);
    });

    return processed;
  }

  async function init() {
    const ids = Object.values(cfg.forums).flat();
    const promises = ids.map((fid) =>
      processForum(fid, cfg.forums.active.includes(fid)),
    );
    const result = (await Promise.all(promises)).flat();
    if (cfg.debug) console.log(result);
  }

  init();
})();
