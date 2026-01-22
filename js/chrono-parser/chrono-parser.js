(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('chronoParser') || {};

  const forumsWithGames = config.forumsWithGames || { active: [], done: [] };
  const currentYearSetting = Number(config.currentYear) || new Date().getFullYear();
  const topicsPerRequest = Math.min(Number(config.topicsPerRequest) || 100, 100);
  const postsPerRequest = Math.min(Number(config.postsPerRequest) || 100, 100);
  const topicIdsPerRequest = Math.max(1, Math.min(Number(config.topicIdsPerRequest) || 25, 50));

  const apiBase = config.apiBase || '/api.php';
  const pageDelayMs = Number(config.pageDelayMs) || 200;
  const retryAttempts = Number(config.retryAttempts) || 2;
  const retryBaseDelayMs = Number(config.retryBaseDelayMs) || 800;
  const maxTopicsPages = Math.max(1, Math.min(Number(config.maxTopicsPages) || 500, 5000));
  const maxPostsPages = Math.max(1, Math.min(Number(config.maxPostsPages) || 500, 5000));

  const pagePath = config.pagePath || '/pages/chrono';
  const mountId = config.mountId || 'chrono-root';
  const headings = {
    active: config.headingActive || 'Активные эпизоды',
    done: config.headingDone || 'Завершённые эпизоды',
  };

  const seriesStylesMap = config.seriesStyles || {};
  const seriesDefaultStyle = config.seriesDefaultStyle || null;

  const announceMaxChars = Math.max(40, Number(config.announceMaxChars) || 200);

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

  const loadedSeriesStyles = new Set();

  function ensureStyleLoaded(href) {
    if (!href || loadedSeriesStyles.has(href)) return;
    loadedSeriesStyles.add(href);
    const link = helpers.createEl('link', { rel: 'stylesheet', href });
    document.head.appendChild(link);
  }

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
      ? Number(String(currentCentury - 1).padStart(2, '0') + ystr.substring(1, 3))
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
    const normalized = String(subject || '').toLowerCase().replace(/,/g, ' ');
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

  function stripDateFromTitle(title) {
    let s = String(title || '');
    s = s.replace(/\s*\[\s*\d{1,2}[.\s\/-]\d{1,2}[.\s\/-]\d{2,4}\s*\]\s*[-–—:]?\s*/iu, '');
    s = s.replace(/^\s*\d{1,2}[.\s\/-]\d{1,2}[.\s\/-]\d{2,4}\s*[-–—:]?\s*/iu, '');
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

  function cleanPersonName(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = decodeHtml(s);
    s = s.replace(/^@+/, '').trim();
    s = s.replace(/[_]+/g, ' ');
    s = s.replace(/[|•·]+/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[^\p{L}\p{N}\s'’\-\.]/gu, '');
    s = s.replace(/\s{2,}/g, ' ').trim();
    if (!s) return '';

    const capSegment = (seg) => {
      const t = String(seg || '');
      if (!t) return '';
      const first = t.charAt(0);
      const rest = t.slice(1);
      return first.toLocaleUpperCase() + rest.toLocaleLowerCase();
    };

    const capWord = (w) => {
      const word = String(w || '').trim();
      if (!word) return '';
      const parts = word.split('-').filter(Boolean);
      if (parts.length > 1) return parts.map(capSegment).join('-');
      return capSegment(word);
    };

    return s
      .split(' ')
      .map((w) => capWord(w))
      .filter(Boolean)
      .join(' ');
  }

  function normalizeName(s) {
    return cleanPersonName(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function uniqNames(list) {
    const out = [];
    const seen = new Set();
    for (const item of list) {
      const cleaned = cleanPersonName(item);
      const key = normalizeName(cleaned);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
    }
    return out;
  }

  function truncateText(s, maxChars) {
    const str = String(s || '').replace(/\s+/g, ' ').trim();
    if (!str) return { text: '', truncated: false };
    if (str.length <= maxChars) return { text: str, truncated: false };
    const cut = str.slice(0, Math.max(0, maxChars - 1)).trimEnd();
    return { text: `${cut}…`, truncated: true };
  }

  function parseHtmlEpisode(message) {
    const html = decodeHtml(String(message ?? ''));
    if (!/[Cc]hrono(?:episode|data|date|display|members|member|announce|location|images|serial|quest)/.test(html)) {
      return null;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    const root = tmp.querySelector('.chrono-episode, .chronoepisode, .chrono-data, .chronodata') || tmp;

    const textFrom = (el) => {
      if (!el) return null;
      let t = '';
      if (el.firstElementChild && el.children.length === 1 && el.firstElementChild.tagName === 'P') {
        t = el.firstElementChild.textContent || '';
      } else {
        t = el.textContent || '';
      }
      t = t.replace(/\s+/g, ' ').trim();
      return t || null;
    };

    const getText = (sel) => textFrom(root.querySelector(sel));
    const getAllTexts = (sel) =>
      Array.from(root.querySelectorAll(sel))
        .map((el) => textFrom(el))
        .filter(Boolean);

    const display = getText('.chrono-display, .chronodisplay');
    const rawDate = getText('.chrono-date, .chronodate');
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

    const location = getText('.chrono-location, .chronolocation');
    const announce = getText('.chrono-announce, .chronoannounce');

    const membersRaw = getAllTexts(
      '.chrono-members .chrono-member, .chronomembers .chronomember, .chronomembers .chrono-member, .chronomembers .epcharacter, .chrono-members .ep-character',
    );
    const members = uniqNames(
      membersRaw
        .flatMap((t) => String(t).split(/[,;\n]+/g))
        .map((x) => x.trim())
        .filter(Boolean),
    );

    const images = Array.from(root.querySelectorAll('.chrono-images img, .chronoimages img'))
      .map((img) => String(img.getAttribute('src') || '').trim())
      .filter(Boolean);

    let is_serial = false;
    let serial_first = 0;
    let serial_key = null;

    const serialEl = root.querySelector('.chrono-serial, .chronoserial');
    if (serialEl) {
      const raw = (serialEl.textContent || '').trim();
      if (raw) {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) {
          is_serial = true;
          serial_first = n;
          serial_key = raw;
        } else {
          is_serial = true;
          serial_first = 0;
          serial_key = raw;
        }
      }
    }

    let quest = null;
    const questEl = root.querySelector('.chrono-quest, .chronoquest');
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
      (images && images.length) ||
      is_serial ||
      quest;

    return has
      ? {
          display: display || null,
          date: date || null,
          location: location || null,
          announce: announce || null,
          members: members && members.length ? members : null,
          images: images && images.length ? images : null,
          is_serial,
          serial_first,
          serial_key,
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

  async function getTopicsPaged(forumIds) {
    const out = [];
    const seen = new Set();
    let skip = 0;
    let pages = 0;

    for (;;) {
      pages++;
      if (pages > maxTopicsPages) break;

      const url =
        `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
        `&fields=id,subject,forum_id,first_post,init_post&limit=${topicsPerRequest}&skip=${skip}`;

      const data = await fetchJsonWithRetry(url);
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;

      let added = 0;

      for (const raw of rows) {
        const id = Number(raw?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          subject: decodeHtml(raw?.subject ?? ''),
          forum_id: String(raw?.forum_id ?? raw?.forum ?? ''),
          first_post: Number(raw?.init_post ?? raw?.first_post ?? 0) || 0,
        });
        added++;
      }

      if (rows.length < topicsPerRequest) break;
      if (added === 0) break;

      skip += topicsPerRequest;
      await delay(pageDelayMs);
    }

    return out.filter((t) => t.id && t.forum_id);
  }

  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function getAllPostsForTopics(topicIds) {
    if (!topicIds.length) return [];
    const out = [];
    const chunks = chunkArray(topicIds, topicIdsPerRequest);

    for (let ci = 0; ci < chunks.length; ci++) {
      const part = chunks[ci];
      let skip = 0;
      let pages = 0;

      for (;;) {
        pages++;
        if (pages > maxPostsPages) break;

        const url =
          `${apiBase}?method=post.get&topic_id=${part.join(',')}` +
          `&fields=id,user_id,username,message,topic_id&limit=${postsPerRequest}&skip=${skip}`;

        const data = await fetchJsonWithRetry(url);
        const arr = Array.isArray(data?.response) ? data.response : null;
        if (!arr || arr.length === 0) break;

        out.push(...arr);

        if (arr.length < postsPerRequest) break;
        skip += postsPerRequest;
        await delay(pageDelayMs);
      }

      if (ci < chunks.length - 1) await delay(pageDelayMs);
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
        serial_key: null,
        quest: null,
        description: '',
        location: null,
        announce: null,
        members: null,
        images: null,
      },
      subject_clean: String(topic.subject || ''),
    };
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
      const displayRaw = String(tag && tag[1] ? tag[1] : p.username || '').trim();
      const display = cleanPersonName(displayRaw);
      const key = normalizeName(display);

      if (key && !usersMap.has(key)) {
        usersMap.set(key, [String(p.user_id ?? ''), String(p.username ?? ''), display]);
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
        id: Number.isFinite(minPostId) ? minPostId : 0,
        message: firstMsg,
        user_id: firstUserId,
        username: firstUsername,
      },
    };
  }

  function findEpisodeAddonsFromPosts(postsForTopic) {
    const sorted = [...postsForTopic].sort((a, b) => Number(a.id) - Number(b.id));
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

            dto.addon.members = Array.isArray(addons.members) ? addons.members.slice() : dto.addon.members;
            dto.addon.images = Array.isArray(addons.images) ? addons.images.slice() : dto.addon.images;

            dto.addon.is_serial = !!addons.is_serial;
            dto.addon.serial_first = Number(addons.serial_first || 0);
            dto.addon.serial_key = addons.serial_key != null ? String(addons.serial_key) : dto.addon.serial_key;
            dto.addon.quest = addons.quest ?? dto.addon.quest;
          }

          if (Array.isArray(dto.addon.members) && dto.addon.members.length) {
            const cleanedMembers = uniqNames(dto.addon.members);
            dto.users = cleanedMembers.map((name) => ['', '', name]);
          } else {
            dto.users = users;
          }

          dto.addon.description ||= first.message || '';
          dto.flags.descr = true;
          dto.flags.full_date = dto.date ? Number(dto.date.d) !== 0 : false;
        } else {
          dto.flags.descr = Number(dto.first_post) !== 0;
        }

        if (dto.users && dto.users.length) {
          const fixed = uniqNames(dto.users.map((u) => u[2] || u[1] || '')).map((name) => ['', '', name]);
          dto.users = fixed;
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

  function applyFilters(episodes) {
    const f = state.filters;
    const fromR = f.dateFrom ? dateRangeFromObj(f.dateFrom) : null;
    const toR = f.dateTo ? dateRangeFromObj(f.dateTo) : null;
    const fromKey = fromR ? fromR[0] : null;
    const toKey = toR ? toR[1] : null;

    const titleNeedle = normalizeName(f.title);
    const userNeedles = f.users.map((x) => normalizeName(x)).filter(Boolean);

    return episodes
      .filter((t) => {
        if (!t.date) return false;
        if (f.status === 'active' && !t.flags.active) return false;
        if (f.status === 'done' && !t.flags.done) return false;

        if (titleNeedle) {
          const title = normalizeName(t.addon.display || t.subject_clean || t.subject || '');
          if (!title.includes(titleNeedle)) return false;
        }

        if (userNeedles.length) {
          const names = (t.users || []).map((u) => normalizeName(u[2] || u[1] || ''));
          const allFound = userNeedles.every((needle) => names.some((n) => n.includes(needle)));
          if (!allFound) return false;
        }

        const [emin, emax] = dateRangeFromObj(t.date);
        if (fromKey !== null && emax < fromKey) return false;
        if (toKey !== null && emin > toKey) return false;

        return true;
      })
      .sort(sortByDateAsc);
  }

  function createIcon(className) {
    const i = document.createElement('i');
    i.className = String(className || '');
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function renderField({ icon, label, value, valueTitle }) {
    const field = helpers.createEl('div', { className: 'chrono__field' });

    const head = helpers.createEl('div', { className: 'chrono__field-head' });
    const ic = createIcon(icon);
    const lab = helpers.createEl('span', { className: 'chrono__field-label', text: label });

    head.appendChild(ic);
    head.appendChild(lab);

    const val = helpers.createEl('div', { className: 'chrono__field-value', text: value });
    if (valueTitle) val.setAttribute('title', valueTitle);

    field.appendChild(head);
    field.appendChild(val);
    return field;
  }

  function renderUsers(users) {
    const wrap = helpers.createEl('div', { className: 'chrono__users-wrap' });
    const list = helpers.createEl('div', { className: 'chrono__users-list' });
    const names = Array.isArray(users) ? users.map((u) => cleanPersonName(u[2] || u[1] || '')).filter(Boolean) : [];
    const unique = uniqNames(names);

    unique.forEach((name) => {
      const chip = helpers.createEl('span', { className: 'chrono__user', text: name });
      list.appendChild(chip);
    });

    wrap.appendChild(list);
    return wrap;
  }

  function renderListSection(root, title, items) {
    if (!items.length) return;

    const section = helpers.createEl('section', { className: 'chrono__section' });
    const h = helpers.createEl('h2', { className: 'chrono__heading', text: title });
    const list = helpers.createEl('ul', { className: 'chrono__list' });

    items.forEach((t) => {
      const li = helpers.createEl('li', { className: 'chrono__item' });

      if (t.addon && t.addon.is_serial) {
        li.classList.add('chrono__item--serial');
        if (t.addon.serial_key) {
          const rawKey = String(t.addon.serial_key);
          const normalizedKey = rawKey
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          if (normalizedKey) {
            li.dataset.series = rawKey;
            li.classList.add(`chrono__item--series-${normalizedKey}`);
          }
        }
      }

      const top = helpers.createEl('div', { className: 'chrono__top' });

      const dateEl = helpers.createEl('div', {
        className: 'chrono__date',
        text: formatDateObj(t.date),
      });

      const badge = helpers.createEl('span', {
        className: `chrono__badge ${t.flags.active ? 'chrono__badge--active' : 'chrono__badge--done'}`,
        text: t.flags.active ? 'активно' : 'завершено',
      });

      top.appendChild(dateEl);
      top.appendChild(badge);

      const titleWrap = helpers.createEl('div', { className: 'chrono__title' });
      const a = helpers.createEl('a', { href: buildTopicUrl(t.id) });
      a.textContent = t.addon.display || t.subject_clean || t.subject || `Тема #${t.id}`;
      titleWrap.appendChild(a);

      li.appendChild(top);
      li.appendChild(titleWrap);

      if (t.addon.location) {
        li.appendChild(
          renderField({
            icon: 'fa-solid fa-location-dot',
            label: 'Место',
            value: String(t.addon.location).trim(),
          }),
        );
      }

      if (t.addon.announce) {
        const full = String(t.addon.announce).trim();
        const { text, truncated } = truncateText(full, announceMaxChars);
        li.appendChild(
          renderField({
            icon: 'fa-regular fa-file-lines',
            label: 'Описание',
            value: text,
            valueTitle: truncated ? full : '',
          }),
        );
      }

      const hasUsers = Array.isArray(t.users) && t.users.length;
      if (hasUsers) {
        const field = helpers.createEl('div', { className: 'chrono__field' });
        const head = helpers.createEl('div', { className: 'chrono__field-head' });
        head.appendChild(createIcon('fa-solid fa-user-group'));
        head.appendChild(helpers.createEl('span', { className: 'chrono__field-label', text: 'Участники' }));
        field.appendChild(head);
        field.appendChild(renderUsers(t.users));
        li.appendChild(field);
      }

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
      container.appendChild(helpers.createEl('p', { className: 'chrono__empty', text: 'Эпизоды не найдены.' }));
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

  function buildTabsBar(onChange) {
    const tabs = helpers.createEl('div', { className: 'chrono__tabs' });

    const mk = (status, text) => {
      const btn = helpers.createEl('button', { className: 'chrono__tab', text });
      btn.type = 'button';
      btn.dataset.status = status;
      btn.addEventListener('click', () => {
        state.filters.status = status;
        setActive(status);
        onChange();
      });
      return btn;
    };

    const btnAll = mk('all', 'Все');
    const btnActive = mk('active', 'Активные');
    const btnDone = mk('done', 'Завершённые');

    tabs.appendChild(btnAll);
    tabs.appendChild(btnActive);
    tabs.appendChild(btnDone);

    function setActive(status) {
      [btnAll, btnActive, btnDone].forEach((b) => b.classList.remove('is-active'));
      const map = { all: btnAll, active: btnActive, done: btnDone };
      const b = map[status] || btnAll;
      b.classList.add('is-active');
    }

    setActive(state.filters.status || 'all');

    return { el: tabs, setActive };
  }

  function buildFiltersBar(onChange) {
    const wrap = helpers.createEl('div', { className: 'chrono__filters' });

    const topRow = helpers.createEl('div', { className: 'chrono__filters-row chrono__filters-row--top' });
    const bottomRow = helpers.createEl('div', { className: 'chrono__filters-row chrono__filters-row--inputs' });

    const tabsApi = buildTabsBar(onChange);

    const mkGroup = (labelText, controlEl) => {
      const g = helpers.createEl('div', { className: 'chrono__filter-group' });
      const lab = helpers.createEl('div', { className: 'chrono__filter-label', text: labelText });
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

    const btnClear = helpers.createEl('button', { className: 'chrono__filter-clear', text: 'Сбросить' });
    btnClear.type = 'button';

    const actions = helpers.createEl('div', { className: 'chrono__filter-actions' });
    actions.appendChild(btnClear);

    topRow.appendChild(tabsApi.el);
    topRow.appendChild(actions);

    bottomRow.appendChild(mkGroup('С даты', inFrom));
    bottomRow.appendChild(mkGroup('По дату', inTo));
    bottomRow.appendChild(mkGroup('Название', inTitle));
    bottomRow.appendChild(mkGroup('Участники', inUsers));

    wrap.appendChild(topRow);
    wrap.appendChild(bottomRow);

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
        .map((s) => cleanPersonName(s))
        .filter(Boolean);
      debounced();
    });

    btnClear.addEventListener('click', () => {
      inFrom.value = inTo.value = inTitle.value = inUsers.value = '';
      state.filters = { dateFrom: null, dateTo: null, title: '', users: [], status: 'all' };
      tabsApi.setActive('all');
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
    wrap.appendChild(helpers.createEl('div', { className: 'chrono__spinner' }));
    wrap.appendChild(helpers.createEl('div', { className: 'chrono__loading-text', text: 'Загрузка эпизодов…' }));
    mount.appendChild(wrap);
  }

  function renderError(mount, msg) {
    mount.innerHTML = '';
    mount.appendChild(helpers.createEl('div', { className: 'chrono__error', text: msg }));
  }

  async function processAll() {
    const activeForums = Array.isArray(forumsWithGames.active) ? forumsWithGames.active.map(String) : [];
    const doneForums = Array.isArray(forumsWithGames.done) ? forumsWithGames.done.map(String) : [];
    const allForums = [...activeForums, ...doneForums];
    if (!allForums.length) return [];

    const activeSet = new Set(activeForums);
    const rawTopics = await getTopicsPaged(allForums);

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
      await delay(pageDelayMs);
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
    const pathOk = !!location.pathname && location.pathname.startsWith(pagePath);
    if (!pathOk) return;

    const mount = await waitForMount(mountId, 10000);
    if (!mount) return;

    renderLoading(mount);

    try {
      const episodes = await processAll();
      state.episodes = episodes.sort(sortByDateAsc);

      const seriesKeys = new Set(
        episodes
          .map((ep) =>
            ep && ep.addon && ep.addon.is_serial && ep.addon.serial_key ? String(ep.addon.serial_key).trim() : null,
          )
          .filter(Boolean),
      );

      seriesKeys.forEach((key) => {
        const href = (seriesStylesMap && seriesStylesMap[key]) || seriesDefaultStyle;
        if (href) ensureStyleLoaded(href);
      });

      renderRoot(mount);
    } catch (e) {
      renderError(mount, 'Не удалось загрузить эпизоды. Попробуйте обновить страницу.');
    }
  }

  function init() {
    run();
  }

  helpers.runOnceOnReady(init);
  helpers.register('chronoParser', { init });
})();
