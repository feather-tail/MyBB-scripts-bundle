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
  const apiBase = config.apiBase || '/api.php';
  const pageDelayMs = Number(config.pageDelayMs) || 200;
  const retryAttempts = Number(config.retryAttempts) || 2;
  const retryBaseDelayMs = Number(config.retryBaseDelayMs) || 800;

  const pagePath = config.pagePath || '/pages/chrono';
  const mountId = config.mountId || 'chrono-root';
  const headings = {
    active: config.headingActive || 'Активные эпизоды',
    done: config.headingDone || 'Завершённые эпизоды',
  };

  const state = {
    episodes: [],
    filters: {
      dateFrom: null,
      dateTo: null,
      title: '',
      users: [],
      status: 'all',
    },
  };

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

  function parseDate(subject) {
    const normalized = String(subject || '')
      .toLowerCase()
      .replace(/,/g, ' ');
    let m = normalized.match(dateRegex);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const year = parseInt(m[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
        return { y: getFullYear(year), m: month, d: day };
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

  function stripDateFromTitle(title) {
    let s = String(title || '');
    s = s.replace(
      /\s*\[\s*\d{1,2}[.\s\/-]\d{1,2}[.\s\/-]\d{2,4}\s*\]\s*[-–—:]?\s*/iu,
      '',
    );
    s = s.replace(
      /^\s*\d{1,2}[.\s\/-]\d{1,2}[.\s\/-]\d{2,4}\s*[-–—:]?\s*/iu,
      '',
    );
    s = s.replace(
      new RegExp(
        `\\s*\\[\\s*\\d{1,2}\\s+(${monthsPattern})\\s+\\d{4}(?:\\s*г(?:\\.|ода)?)?\\s*\\]\\s*[-–—:]?\\s*`,
        'iu',
      ),
      '',
    );
    s = s.replace(
      new RegExp(
        `^\\s*\\d{1,2}\\s+(${monthsPattern})\\s+\\d{4}(?:\\s*г(?:\\.|ода)?)?\\s*[-–—:]?\\s*`,
        'iu',
      ),
      '',
    );
    s = s.replace(
      new RegExp(
        `\\s*\\[\\s*(${monthsPattern})\\s+\\d{4}(?:\\s*г(?:\\.|ода)?)?\\s*\\]\\s*[-–—:]?\\s*`,
        'iu',
      ),
      '',
    );
    s = s.replace(
      new RegExp(
        `^\\s*(${monthsPattern})\\s+\\d{4}(?:\\s*г(?:\\.|ода)?)?\\s*[-–—:]?\\s*`,
        'iu',
      ),
      '',
    );
    s = s.replace(/^\s*[-–—:]\s*/, '');
    return s.replace(/\s{2,}/g, ' ').trim();
  }

  function parseHtmlEpisode(message) {
    const html = String(message || '');
    if (
      !/[Cc]hrono(?:episode|data|date|display|members|announce|location|serial|quest)/.test(
        html,
      )
    )
      return null;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    const root =
      tmp.querySelector('.chronoepisode') ||
      tmp.querySelector('.chronodata') ||
      tmp;

    const textFrom = (el) => {
      if (!el) return null;
      let t = '';
      if (
        el.firstElementChild &&
        el.children.length === 1 &&
        el.firstElementChild.tagName === 'P'
      ) {
        t = el.firstElementChild.textContent || '';
      } else {
        t = el.textContent || '';
      }
      t = t.replace(/\s+/g, ' ').trim();
      return t || null;
    };

    const getText = (sel) => textFrom(root.querySelector(sel));

    const getAllTexts = (sel) => {
      const list = Array.from(root.querySelectorAll(sel));
      return list.map((el) => textFrom(el)).filter(Boolean);
    };

    const display = getText('.chronodisplay');
    const rawDate = getText('.chronodate');
    let date = null;
    if (rawDate) {
      const m = rawDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (m) {
        date = { d: +m[1], m: +m[2], y: getFullYear(m[3]) };
      } else {
        const alt = parseDate(rawDate);
        if (alt) date = alt;
      }
    }

    const location = getText('.chronolocation');
    const announce = getText('.chronoannounce');
    const members = getAllTexts('.chronomembers .epcharacter');

    let is_serial = false;
    let serial_first = 0;
    const serialEl = root.querySelector('.chronoserial');
    if (serialEl) {
      const n = parseInt(serialEl.textContent || '', 10);
      if (!Number.isNaN(n)) {
        is_serial = true;
        serial_first = n;
      }
    }

    let quest = null;
    const questEl = root.querySelector('.chronoquest');
    if (questEl) {
      const raw = (questEl.textContent || '').trim();
      if (/^[\[{]/.test(raw)) {
        try {
          quest = JSON.parse(raw);
        } catch {
          quest = raw;
        }
      } else {
        quest = raw || null;
      }
    }

    const has =
      display ||
      date ||
      location ||
      announce ||
      (members && members.length) ||
      is_serial ||
      quest;

    return has
      ? {
          display: display || null,
          date: date || null,
          location: location || null,
          announce: announce || null,
          members: members && members.length ? members : null,
          is_serial,
          serial_first,
          quest,
        }
      : null;
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchJsonWithRetry(url) {
    for (let i = 0; i <= retryAttempts; i++) {
      try {
        const data = await helpers.request(url, { responseType: 'json' });
        if (data && typeof data === 'object') return data;
      } catch {}
      if (i < retryAttempts) await delay(retryBaseDelayMs * (i + 1));
    }
    return null;
  }

  async function getTopics(forumIds) {
    const url =
      `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
      `&fields=id,subject,forum_id,first_post,init_post&limit=${topicsPerRequest}`;
    const data = await fetchJsonWithRetry(url);
    const rows = Array.isArray(data?.response) ? data.response : [];
    const safe = rows.filter((r) => r && typeof r === 'object');
    return safe
      .map((raw) => ({
        id: Number(raw.id),
        subject: decodeHtml(raw.subject ?? ''),
        forum_id: String(raw.forum_id ?? raw.forum ?? ''),
        first_post: Number(raw.init_post ?? raw.first_post ?? 0) || 0,
      }))
      .filter((t) => t.id && t.forum_id);
  }

  async function getAllPostsForTopics(topicIds) {
    if (!topicIds.length) return [];
    let skip = 0;
    const out = [];
    for (;;) {
      const url =
        `${apiBase}?method=post.get&topic_id=${topicIds.join(',')}` +
        `&fields=id,user_id,username,message,topic_id&limit=${postsPerRequest}&skip=${skip}`;
      const data = await fetchJsonWithRetry(url);
      const arr = Array.isArray(data?.response) ? data.response : null;
      if (!arr || arr.length === 0) break;
      out.push(...arr);
      if (arr.length < postsPerRequest) break;
      skip += postsPerRequest;
      await delay(pageDelayMs);
    }
    return out;
  }

  function makeTopicSkeleton(topic, activeFlag) {
    return {
      ...topic,
      topic: { forum_id: Number(topic.forum_id) || 0 },
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
        quest: null,
        description: '',
        location: null,
        announce: null,
        members: null,
      },
      subject_clean: String(topic.subject || ''),
    };
  }

  function normalizeName(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function extractUsersAndFirstPost(postsForTopic) {
    const usersMap = new Map();
    let minPostId = Infinity;
    let firstMsg = '';
    let firstUserId = '';
    let firstUsername = '';
    for (const p of postsForTopic) {
      const msg = String(p.message || '');
      const tag = msg.match(/\[nick\]([\s\S]*?)\[\/nick\]/i);
      const display = String(tag && tag[1] ? tag[1] : p.username || '').trim();
      const key = normalizeName(display);
      if (key && !usersMap.has(key)) {
        usersMap.set(key, [
          String(p.user_id ?? ''),
          String(p.username ?? ''),
          display,
        ]);
      }
      if (Number(p.id) < minPostId) {
        minPostId = Number(p.id);
        firstMsg = msg;
        firstUserId = String(p.user_id ?? '');
        firstUsername = String(p.username ?? '');
      }
    }
    return {
      users: Array.from(usersMap.values()),
      first: {
        id: isFinite(minPostId) ? minPostId : 0,
        message: firstMsg,
        user_id: firstUserId,
        username: firstUsername,
      },
    };
  }

  function findEpisodeAddonsFromPosts(postsForTopic) {
    const sorted = [...postsForTopic].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    for (const p of sorted) {
      const add = parseHtmlEpisode(p?.message ?? '');
      if (add) return { addons: add, sourcePost: p };
    }
    return { addons: null, sourcePost: null };
  }

  async function processForum(activeFlag, forumTopics) {
    if (!Array.isArray(forumTopics) || forumTopics.length === 0) return [];
    const topicIds = forumTopics.map((t) => t && t.id).filter(Boolean);
    const allPosts = await getAllPostsForTopics(topicIds);
    const byTopic = new Map();
    for (const p of allPosts) {
      const tid = Number(p.topic_id);
      if (!byTopic.has(tid)) byTopic.set(tid, []);
      byTopic.get(tid).push(p);
    }

    const processed = [];
    for (const t of forumTopics) {
      if (!t || !t.id) continue;
      try {
        const dto = makeTopicSkeleton(t, activeFlag);

        const subjectDate = parseDate(dto.subject);
        if (subjectDate) {
          dto.date = subjectDate;
          dto.flags.full_date = Number(subjectDate.d) !== 0;
          dto.subject_clean = stripDateFromTitle(dto.subject);
        }

        const posts = byTopic.get(Number(dto.id)) || [];
        dto.posts_count = posts.length;

        if (posts.length) {
          const { users, first } = extractUsersAndFirstPost(posts);
          const { addons } = findEpisodeAddonsFromPosts(posts);

          if (addons) {
            dto.addon.display = addons.display ?? dto.addon.display;
            if (addons.date) dto.date = { ...addons.date };
            dto.addon.location = addons.location ?? dto.addon.location;
            dto.addon.announce = addons.announce ?? dto.addon.announce;
            dto.addon.members = Array.isArray(addons.members)
              ? addons.members.slice()
              : dto.addon.members;
            dto.addon.is_serial = !!addons.is_serial;
            dto.addon.serial_first = Number(addons.serial_first || 0);
            dto.addon.quest = addons.quest ?? dto.addon.quest;
          }

          if (Array.isArray(dto.addon.members) && dto.addon.members.length) {
            dto.users = dto.addon.members.map((name) => ['', '', String(name)]);
          } else {
            dto.users = users;
          }

          dto.addon.description ||= first.message || '';
          dto.flags.descr = true;
          dto.flags.full_date = dto.date ? Number(dto.date.d) !== 0 : false;
        } else {
          dto.flags.descr = Number(dto.first_post) !== 0;
        }
        processed.push(dto);
      } catch {}
    }

    return processed;
  }

  function dateKey(y, m = 0, d = 0) {
    return Number(y || 0) * 10000 + Number(m || 0) * 100 + Number(d || 0);
  }

  function dateRangeFromObj(obj) {
    if (!obj || !obj.y) return [0, 0];
    if (obj.y && obj.m && obj.d) {
      const k = dateKey(obj.y, obj.m, obj.d);
      return [k, k];
    }
    if (obj.y && obj.m && !obj.d) {
      const k1 = dateKey(obj.y, obj.m, 1);
      const k2 = dateKey(obj.y, obj.m, 31);
      return [k1, k2];
    }
    const k1 = dateKey(obj.y, 1, 1);
    const k2 = dateKey(obj.y, 12, 31);
    return [k1, k2];
  }

  function parseFilterDate(s) {
    const str = String(s || '').trim();
    if (!str) return null;
    const rxDots = /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/;
    const rxMonthYear = /^(\d{1,2})[.\-\/](\d{4})$/;
    const rxYear = /^(\d{4})$/;
    let m = str.match(rxDots);
    if (m) return { y: +m[3], m: +m[2], d: +m[1] };
    m = str.match(rxMonthYear);
    if (m) return { y: +m[2], m: +m[1], d: 0 };
    m = str.match(rxYear);
    if (m) return { y: +m[1], m: 0, d: 0 };
    return null;
  }

  function sortByDateAsc(a, b) {
    const keyA = dateKey(a.date?.y, a.date?.m, a.date?.d);
    const keyB = dateKey(b.date?.y, b.date?.m, b.date?.d);
    return keyA - keyB;
  }

  function buildTopicUrl(id) {
    return `/viewtopic.php?id=${id}`;
  }

  function formatDateObj(date) {
    if (!date) return '';
    const y = Number(date.y || 0);
    const m = Number(date.m || 0);
    const d = Number(date.d || 0);
    const dd = d ? String(d).padStart(2, '0') : '';
    const mm = m ? String(m).padStart(2, '0') : '';
    if (d && m && y) return `${dd}.${mm}.${y}`;
    if (m && y) return `${mm}.${y}`;
    if (y) return String(y);
    return '';
  }

  function listAllUsers(users) {
    if (!Array.isArray(users) || users.length === 0) return '';
    const names = users.map((u) => u[2] || u[1]).filter(Boolean);
    return names.join(', ');
  }

  function applyFilters(episodes) {
    const f = state.filters;
    const fromR = f.dateFrom ? dateRangeFromObj(f.dateFrom) : null;
    const toR = f.dateTo ? dateRangeFromObj(f.dateTo) : null;
    const fromKey = fromR ? fromR[0] : null;
    const toKey = toR ? toR[1] : null;

    const titleNeedle = normalizeName(f.title);
    const userNeedles = f.users.map(normalizeName).filter(Boolean);

    return episodes
      .filter((t) => {
        if (!t.date) return false;
        if (f.status === 'active' && !t.flags.active) return false;
        if (f.status === 'done' && !t.flags.done) return false;
        if (titleNeedle) {
          const title = normalizeName(
            t.addon.display || t.subject_clean || t.subject || '',
          );
          if (!title.includes(titleNeedle)) return false;
        }
        if (userNeedles.length) {
          const names = (t.users || []).map((u) =>
            normalizeName(u[2] || u[1] || ''),
          );
          const allFound = userNeedles.every((needle) =>
            names.some((n) => n.includes(needle)),
          );
          if (!allFound) return false;
        }
        const [emin, emax] = dateRangeFromObj(t.date);
        if (fromKey !== null && emax < fromKey) return false;
        if (toKey !== null && emin > toKey) return false;
        return true;
      })
      .sort(sortByDateAsc);
  }

  function renderListSection(root, title, items) {
    if (!items.length) return;
    const section = helpers.createEl('section', {
      className: 'chrono__section',
    });
    const h = helpers.createEl('h2', {
      className: 'chrono__heading',
      text: title,
    });
    const list = helpers.createEl('ul', { className: 'chrono__list' });

    items.forEach((t) => {
      const li = helpers.createEl('li', { className: 'chrono__item' });
      const date = helpers.createEl('div', {
        className: 'chrono__date',
        text: formatDateObj(t.date),
      });
      const titleWrap = helpers.createEl('div', { className: 'chrono__title' });
      const a = helpers.createEl('a', { href: buildTopicUrl(t.id) });
      a.textContent =
        t.addon.display || t.subject_clean || t.subject || `Тема #${t.id}`;
      titleWrap.appendChild(a);

      if (t.addon.location) {
        titleWrap.appendChild(
          helpers.createEl('div', {
            className: 'chrono__location',
            text: t.addon.location,
          }),
        );
      }

      if (t.addon.announce) {
        titleWrap.appendChild(
          helpers.createEl('div', {
            className: 'chrono__announce',
            text: String(t.addon.announce).trim(),
          }),
        );
      }

      const who = listAllUsers(t.users);
      if (who) {
        const usersEl = helpers.createEl('div', {
          className: 'chrono__users',
          text: who,
        });
        titleWrap.appendChild(usersEl);
      }
      const meta = helpers.createEl('div', { className: 'chrono__meta' });
      const badge = helpers.createEl('span', {
        className: `chrono__badge ${
          t.flags.active ? 'chrono__badge--active' : 'chrono__badge--done'
        }`,
        text: t.flags.active ? 'активно' : 'завершено',
      });
      meta.appendChild(badge);
      li.appendChild(date);
      li.appendChild(titleWrap);
      li.appendChild(meta);
      list.appendChild(li);
    });

    section.appendChild(h);
    section.appendChild(list);
    root.appendChild(section);
  }

  function renderEpisodesInto(container, episodes) {
    container.innerHTML = '';
    const withDate = episodes.filter((t) => t.date);
    if (!withDate.length) {
      container.appendChild(
        helpers.createEl('p', {
          className: 'chrono__empty',
          text: 'Эпизоды не найдены.',
        }),
      );
      return;
    }
    const active = withDate.filter((t) => t.flags.active);
    const done = withDate.filter((t) => t.flags.done);
    if (state.filters.status === 'active') {
      renderListSection(container, headings.active, active);
    } else if (state.filters.status === 'done') {
      renderListSection(container, headings.done, done);
    } else {
      renderListSection(container, headings.active, active);
      renderListSection(container, headings.done, done);
    }
  }

  function buildFiltersBar(onChange) {
    const wrap = helpers.createEl('div', { className: 'chrono__filters' });
    const mkGroup = (labelText, controlEl) => {
      const g = helpers.createEl('div', { className: 'chrono__filter-group' });
      const lab = helpers.createEl('div', {
        className: 'chrono__filter-label',
        text: labelText,
      });
      g.appendChild(lab);
      g.appendChild(controlEl);
      return g;
    };
    const inFrom = helpers.createEl('input', {
      className: 'chrono__filter-input',
      placeholder: 'ДД.ММ.ГГГГ | ММ.ГГГГ | ГГГГ',
    });
    const inTo = helpers.createEl('input', {
      className: 'chrono__filter-input',
      placeholder: 'ДД.ММ.ГГГГ | ММ.ГГГГ | ГГГГ',
    });
    const inTitle = helpers.createEl('input', {
      className: 'chrono__filter-input',
      placeholder: 'Например: Северное сияние',
    });
    const inUsers = helpers.createEl('input', {
      className: 'chrono__filter-input',
      placeholder: 'Через запятую: Имя, Имя…',
    });
    const selStatus = helpers.createEl('select', {
      className: 'chrono__filter-select',
    });
    ['all:Все', 'active:Активные', 'done:Завершённые'].forEach((opt) => {
      const [v, t] = opt.split(':');
      selStatus.appendChild(helpers.createEl('option', { value: v, text: t }));
    });
    const btnClear = helpers.createEl('button', {
      className: 'chrono__filter-clear',
      text: 'Сбросить',
    });
    wrap.appendChild(mkGroup('С даты', inFrom));
    wrap.appendChild(mkGroup('По дату', inTo));
    wrap.appendChild(mkGroup('Название', inTitle));
    wrap.appendChild(mkGroup('Участники', inUsers));
    wrap.appendChild(mkGroup('Статус', selStatus));
    wrap
      .appendChild(
        helpers.createEl('div', { className: 'chrono__filter-actions' }),
      )
      .appendChild(btnClear);
    const debounced = helpers.debounce(() => onChange(), 250);
    inFrom.addEventListener('input', () => {
      state.filters.dateFrom = parseFilterDate(inFrom.value);
      debounced();
    });
    inTo.addEventListener('input', () => {
      state.filters.dateTo = parseFilterDate(inTo.value);
      debounced();
    });
    inTitle.addEventListener('input', () => {
      state.filters.title = inTitle.value || '';
      debounced();
    });
    inUsers.addEventListener('input', () => {
      const raw = String(inUsers.value || '');
      state.filters.users = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      debounced();
    });
    selStatus.addEventListener('change', () => {
      state.filters.status = selStatus.value || 'all';
      onChange();
    });
    btnClear.addEventListener('click', () => {
      inFrom.value = inTo.value = inTitle.value = inUsers.value = '';
      selStatus.value = 'all';
      state.filters = {
        dateFrom: null,
        dateTo: null,
        title: '',
        users: [],
        status: 'all',
      };
      onChange();
    });
    return wrap;
  }

  function renderRoot(mount) {
    mount.innerHTML = '';
    const root = helpers.createEl('div', { className: 'chrono' });
    const listBox = helpers.createEl('div', { className: 'chrono__lists' });
    const filtersBar = buildFiltersBar(() => {
      const filtered = applyFilters(state.episodes);
      renderEpisodesInto(listBox, filtered);
    });
    root.appendChild(filtersBar);
    root.appendChild(listBox);
    mount.appendChild(root);
    const initial = applyFilters(state.episodes);
    renderEpisodesInto(listBox, initial);
  }

  function renderLoading(mount) {
    mount.innerHTML = '';
    const wrap = helpers.createEl('div', { className: 'chrono__loading' });
    wrap.appendChild(
      helpers.createEl('div', {
        className: 'chrono__spinner',
        ariaLabel: 'Загрузка…',
      }),
    );
    wrap.appendChild(
      helpers.createEl('div', {
        className: 'chrono__loading-text',
        text: 'Загрузка эпизодов…',
      }),
    );
    mount.appendChild(wrap);
  }

  function renderError(mount, msg) {
    mount.innerHTML = '';
    mount.appendChild(
      helpers.createEl('div', { className: 'chrono__error', text: msg }),
    );
  }

  async function processAll() {
    const activeForums = Array.isArray(forumsWithGames.active)
      ? forumsWithGames.active.map(String)
      : [];
    const doneForums = Array.isArray(forumsWithGames.done)
      ? forumsWithGames.done.map(String)
      : [];
    const allForums = [...activeForums, ...doneForums];
    if (!allForums.length) return [];
    const activeSet = new Set(activeForums);
    const rawTopics = await getTopics(allForums);
    const topicsByForum = new Map();
    const arr = Array.isArray(rawTopics) ? rawTopics : [];
    for (let i = 0; i < arr.length; i++) {
      const t = arr[i];
      if (!t || typeof t !== 'object') continue;
      const key = String(t.forum_id || '');
      if (!key) continue;
      if (!topicsByForum.has(key)) topicsByForum.set(key, []);
      topicsByForum.get(key).push(t);
    }
    const results = [];
    for (const fid of allForums) {
      const list = topicsByForum.get(String(fid)) || [];
      if (!list.length) continue;
      const processed = await processForum(activeSet.has(String(fid)), list);
      results.push(...processed);
    }
    return results;
  }

  function waitForMount(id, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const ready = document.getElementById(id);
      if (ready) return resolve(ready);
      const obs = new MutationObserver(() => {
        const el = document.getElementById(id);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(document.getElementById(id) || null);
      }, timeoutMs);
    });
  }

  async function run() {
    const pathOk =
      !!location.pathname && location.pathname.startsWith(pagePath);
    if (!pathOk) return;
    const mount = await waitForMount(mountId, 10000);
    if (!mount) return;
    renderLoading(mount);
    try {
      const episodes = await processAll();
      state.episodes = episodes.sort(sortByDateAsc);
      renderRoot(mount);
    } catch (e) {
      renderError(
        mount,
        'Не удалось загрузить эпизоды. Попробуйте обновить страницу.',
      );
    }
  }

  function init() {
    run();
  }

  helpers.runOnceOnReady(init);
  helpers.register('chronoParser', { init });
})();
