(() => {
  'use strict';

  let helpers;
  let cfg;

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
    if (n >= 100) return n;
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
    m = subject.match(re4);
    if (m) {
      return { y: getFullYear(m[2]), m: +m[1], d: 0 };
    }
    m = subject.match(/\b(\d{3,4})\b/);
    if (m) return { y: getFullYear(m[1]), m: 0, d: 0 };
    return null;
  }

  function parseAddons(message) {
    const res = {};
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
      res.isSerial = true;
      res.serialFirst = +s[1];
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
    if (!fIds.length) return [];
    let skip = 0;
    const topics = [];
    while (true) {
      const params =
        `method=topic.get&forum_id=${fIds.join(',')}` +
        `&fields=id,subject,first_post&limit=${cfg.topicsPerReq}&skip=${skip}`;
      const data = await requestJson(params);
      if (!data?.response?.length) break;
      topics.push(...data.response);
      if (data.response.length < cfg.topicsPerReq) break;
      skip += cfg.topicsPerReq;
    }
    return topics;
  }

  async function getPosts(tIds) {
    if (!tIds.length) return [];
    const posts = [];
    for (let i = 0; i < tIds.length; i += cfg.postsPerReq) {
      const chunk = tIds.slice(i, i + cfg.postsPerReq);
      let skip = 0;
      while (true) {
        const params =
          `method=post.get&topic_id=${chunk.join(',')}` +
          `&fields=id,user_id,username,message,topic_id` +
          `&limit=${cfg.postsPerReq}&skip=${skip}`;
        const data = await requestJson(params);
        if (!data?.response?.length) break;
        posts.push(...data.response);
        if (data.response.length < cfg.postsPerReq) break;
        skip += cfg.postsPerReq;
      }
    }
    return posts;
  }

  async function processForum(fid, isActive) {
    const topics = await getTopics([fid]);
    const tIds = topics.map((t) => t.id);
    const posts = await getPosts(tIds);

    const topicMap = {};
    const processed = topics.map((t) => {
      const topic = {
        ...t,
        postsCount: 0,
        users: new Map(),
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
      };
      topicMap[t.id] = topic;
      return topic;
    });

    for (const p of posts) {
      const t = topicMap[p.topic_id];
      if (!t) continue;

      t.postsCount++;
      const nick = (p.message.match(/\[nick\](.*?)\[\/nick\]/) || [])[1];
      if (!t.users.has(p.user_id))
        t.users.set(
          p.user_id,
          [p.user_id, p.username, nick].filter(
            (v) => v !== null && v !== undefined && v !== '',
          ),
        );

      const correctFirst = t.first_post && t.first_post < p.id;
      if (p.id === t.first_post || !correctFirst) {
        const addons = parseAddons(p.message);
        if (addons) Object.assign(t.addon, addons);
        if (!correctFirst) t.first_post = p.id;
        if (!t.addon.description) t.addon.description = p.message;
      }
    }

    processed.forEach((t) => {
      t.users = [...t.users.values()];
      t.flags.descr = Boolean(t.addon.description);
      const dt = parseDate(t.subject);
      if (dt) {
        t.date = dt;
        t.flags.fullDate = dt.d !== 0;
      } else if (cfg.debug) console.warn('Cannot parse date:', t.subject);
    });

    return processed;
  }

  async function init() {
    helpers = window.helpers;
    cfg = helpers.getConfig('forumChronology', {
      forums: { active: [23, 24], done: [19] },
      currentYear: 2010,
      debug: false,
      topicsPerReq: 100,
      postsPerReq: 100,
      backend: { endpoint: '/api.php' },
    });

    const pairs = [
      ...cfg.forums.done.map((fid) => [fid, false]),
      ...cfg.forums.active.map((fid) => [fid, true]),
    ];
    const unique = new Map();
    for (const [fid, isActive] of pairs) {
      if (!unique.has(fid) || isActive) unique.set(fid, isActive);
    }
    const promises = [...unique].map(([fid, isActive]) =>
      processForum(fid, isActive),
    );
    const result = (await Promise.all(promises)).flat();
    if (cfg.debug) console.log(result);
  }

  function bootstrap() {
    const helpers = window.helpers;
    if (helpers) {
      if (helpers.runOnceOnReady) {
        helpers.runOnceOnReady(init);
      } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    } else {
      setTimeout(bootstrap, 25);
    }
  }

  bootstrap();
})();
