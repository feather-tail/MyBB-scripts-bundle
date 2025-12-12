(() => {
  'use strict';

  const helpers = window.helpers;
  const config = helpers.getConfig('charactersParser') || {};

  const forumsWithCharacters = Array.isArray(config.forumsWithCharacters)
    ? config.forumsWithCharacters.map((x) => Number(x)).filter(Boolean)
    : [7];

  const topicsPerRequest = Math.min(
    Number(config.topicsPerRequest) || 100,
    100,
  );
  const postsPerRequest = Math.min(Number(config.postsPerRequest) || 100, 100);
  const apiBase = config.apiBase || '/api.php';
  const pageDelayMs = Number(config.pageDelayMs) || 200;
  const retryAttempts = Number(config.retryAttempts) || 2;
  const retryBaseDelayMs = Number(config.retryBaseDelayMs) || 800;

  const pagePath = config.pagePath || '/pages/characters';
  const mountId = config.mountId || 'characters-root';
  const cacheTtlMs = Number(config.cacheTtlMs) || 30 * 60 * 1000;

  const imageIndex = Math.min(
    2,
    Math.max(0, (Number(config.imageIndex) || 1) - 1),
  );

  const UI = config.ui || {};
  const UIText = {
    title: UI.title || 'Персонажи',
    filters: {
      name: (UI.filters && UI.filters.name) || 'Имя / Фамилия',
      age: (UI.filters && UI.filters.age) || 'Возраст',
      gender: (UI.filters && UI.filters.gender) || 'Пол',
      race: (UI.filters && UI.filters.race) || 'Раса',
      status: (UI.filters && UI.filters.status) || 'Статус',
      pair: (UI.filters && UI.filters.pair) || 'Пара',
      clear: (UI.filters && UI.filters.clear) || 'Сбросить',
      refresh: (UI.filters && UI.filters.refresh) || 'Обновить',
      sort: (UI.filters && UI.filters.sort) || 'Сортировка',
    },
    sort: {
      nameAZ: (UI.sort && UI.sort.nameAZ) || 'Имя A&#8594;Я',
      nameZA: (UI.sort && UI.sort.nameZA) || 'Имя Я&#8594;A',
      faceAZ: (UI.sort && UI.sort.faceAZ) || 'Внешность A&#8594;Я',
      faceZA: (UI.sort && UI.sort.faceZA) || 'Внешность Я&#8594;A',
    },
    placeholders: {
      name: (UI.placeholders && UI.placeholders.name) || 'Имя или фамилия',
      ageFrom: (UI.placeholders && UI.placeholders.ageFrom) || 'от',
      ageTo: (UI.placeholders && UI.placeholders.ageTo) || 'до',
    },
    empty: UI.empty || 'Под подходящие фильтры ничего не найдено.',
    loadError:
      UI.loadError ||
      'Не удалось загрузить список персонажей. Попробуйте обновить.',
    views: {
      cards: (UI.views && UI.views.cards) || 'Карточки',
      byFace: (UI.views && UI.views.byFace) || 'По внешности',
      roleGrid: (UI.views && UI.views.roleGrid) || 'Сетка ролей',
    },
  };

  const state = {
    items: [],
    filters: {
      name: '',
      ageMin: '',
      ageMax: '',
      gender: 'all',
      race: 'all',
      status: 'all',
      hasPair: 'all',
      sort: 'nameAZ',
    },
    dicts: {
      genders: ['all'],
      races: [{ value: 'all', label: 'Все' }],
      statuses: ['all'],
      pairs: ['all', 'with', 'without'],
    },
    view: 'cards',
    refreshedAt: 0,
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchJsonWithRetry(url) {
    for (let i = 0; i <= retryAttempts; i++) {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data && (data.response || data.error)) return data;
      } catch {}
      if (i < retryAttempts) await delay(retryBaseDelayMs * (i + 1));
    }
    return null;
  }

  const textFrom = (el) =>
    String((el && (el.textContent || el.innerText)) || '').trim();

  function htmlToDom(html) {
    const d = document.implementation.createHTMLDocument('');
    d.body.innerHTML = String(html || '');
    return d;
  }
  const normKey = (s) =>
    String(s || '')
      .trim()
      .toLowerCase();
  function toIntOrNull(s) {
    const n = parseInt(String(s || '').replace(/[^\d\-]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }
  function decodeHtml(s) {
    const div = document.createElement('div');
    div.innerHTML = String(s ?? '');
    return div.textContent || div.innerText || '';
  }
  function raceCanonicalKey(s) {
    const k = normKey(s);
    if (k === 'ведьма' || k === 'ведьмак') return 'ведьма/ведьмак';
    return k;
  }
  function pickPreferredImage(item) {
    const arr = Array.isArray(item.images) ? item.images : [];
    if (arr[imageIndex]) return arr[imageIndex];
    return arr.find(Boolean) || item.img || '';
  }

  const mainName = (it) => it.name_en || it.name || '(без имени)';

  function faceSortKey(it) {
    const faces = Array.isArray(it.faces) ? it.faces : [];
    const keys = faces
      .map((f) => {
        const fandom = String(f?.fandom || '').trim();
        const canon = String(f?.canon || '').trim();
        const proto = String(f?.proto || '').trim();
        return normKey((fandom && canon) ? `[${fandom}] ${canon}` : (proto || canon || fandom));
      })
      .filter(Boolean);
  
    const fallback = normKey(
      it.faceproto ||
      ((it.face_fandom || it.face_canon) ? `[${it.face_fandom || ''}] ${it.face_canon || ''}`.trim() : '') ||
      ''
    );
    if (!keys.length) return fallback;
  
    keys.sort((a, b) => a.localeCompare(b, 'ru'));
    return keys[0];
  }

  async function getTopics(forumIds) {
    const url =
      `${apiBase}?method=topic.get&forum_id=${forumIds.join(',')}` +
      `&fields=id,subject,forum_id,first_post,init_post,link&limit=${topicsPerRequest}`;
    const data = await fetchJsonWithRetry(url);
    const rows = Array.isArray(data?.response) ? data.response : [];
    return rows
      .map((raw) => ({
        id: Number(raw.id),
        subject: String(raw.subject ?? ''),
        forum_id: Number(raw.forum_id ?? raw.forum ?? 0),
        first_post: Number(raw.init_post ?? raw.first_post ?? 0) || 0,
        link: String(raw.link || ''),
      }))
      .filter((x) => x.id && x.forum_id);
  }

  async function getAllPostsForTopics(topicIds) {
    if (!topicIds.length) return [];
    let skip = 0;
    const out = [];
    for (;;) {
      const url =
        `${apiBase}?method=post.get&topic_id=${topicIds.join(',')}` +
        `&fields=id,topic_id,message,username,link&limit=${postsPerRequest}&skip=${skip}`;
      const data = await fetchJsonWithRetry(url);
      const rows = Array.isArray(data?.response) ? data.response : [];
      if (!rows.length) break;
      for (const r of rows) {
        out.push({
          id: Number(r.id),
          topic_id: Number(r.topic_id),
          username: String(r.username || ''),
          message: String(r.message || ''),
          link: String(r.link || ''),
        });
      }
      if (rows.length < postsPerRequest) break;
      skip += postsPerRequest;
      await delay(pageDelayMs);
    }
    return out;
  }

  function parseProfileFromHtml(html) {
    if (!html) return null;
    const doc = htmlToDom(html);
  
    const imgEls = doc.querySelectorAll(
      '[class^="custom_tag_charimg"] img.postimg, .char-image img.postimg, .char-image .postimg',
    );
    const images = Array.from(imgEls)
      .map((el) => String(el.getAttribute('src') || '').trim())
      .filter(Boolean)
      .slice(0, 3);
  
    const img = images[0] || '';
  
    const nameRu = textFrom(
      doc.querySelector('.custom_tag_charname p, .char-name-ru p'),
    );
    const nameEn = textFrom(
      doc.querySelector('.custom_tag_charnameen p, .char-name-en p'),
    );
  
    function normFandomLabel(s) {
      const v = String(s || '').trim();
      if (!v) return '';
      const k = v.toLowerCase();
      if (k === 'original' || k === 'оригинал') return 'original';
      if (k === 'real' || k === 'реал' || k === 'реальный') return 'real';
      return v;
    }
  
    function parseLegacyFace(s) {
      const str = String(s || '').trim();
      const m = str.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
      if (!m) return { fandom: '', canon: '' };
      const fandomLabel = normFandomLabel(m[1]);
      const tail = String(m[2] || '').trim();
      if (String(fandomLabel).toLowerCase() === 'original') {
        return { fandom: 'original', canon: '' };
      }
      if (String(fandomLabel).toLowerCase() === 'real') {
        return { fandom: 'real', canon: tail };
      }
      return { fandom: fandomLabel, canon: tail };
    }
  
    const faces = [];
    const faceProtoBlocks = doc.querySelectorAll(
      '.custom_tag_charfaceproto, .char-face-proto',
    );
  
    if (faceProtoBlocks && faceProtoBlocks.length) {
      faceProtoBlocks.forEach((block) => {
        const fandomRaw = textFrom(
          block.querySelector('.custom_tag_charfacefandom p, .char-face-fandom p, .custom_tag_charfacefandom, .char-face-fandom'),
        );
        const canonRaw = textFrom(
          block.querySelector('.custom_tag_charfacecanon p, .char-face-canon p, .custom_tag_charfacecanon, .char-face-canon'),
        );
  
        const fandom = normFandomLabel(fandomRaw);
        let canon = String(canonRaw || '').trim();
  
        if (String(fandom).toLowerCase() === 'original') canon = '';
  
        if (!fandom && !canon) {
          const protoRaw = textFrom(block.querySelector('p')) || textFrom(block);
          if (protoRaw) {
            const { fandom: f2, canon: c2 } = parseLegacyFace(protoRaw);
            if (f2 || c2) faces.push({ fandom: f2, canon: c2, proto: protoRaw });
            return;
          }
          return;
        }
  
        faces.push({
          fandom: fandom || '',
          canon: canon || '',
          proto: fandom
            ? (String(fandom).toLowerCase() === 'original'
                ? '[original]'
                : String(fandom).toLowerCase() === 'real'
                ? (canon ? `[real] ${canon}` : '[real]')
                : (canon ? `[${fandom}] ${canon}` : `[${fandom}]`))
            : '',
        });
      });
    } else {
      const faceProtoRaw = textFrom(
        doc.querySelector('.custom_tag_charfaceproto p, .char-face-proto p'),
      );
      if (faceProtoRaw) {
        const { fandom, canon } = parseLegacyFace(faceProtoRaw);
        if (fandom || canon) {
          faces.push({ fandom, canon, proto: faceProtoRaw });
        }
      } else {
        const faceFandomRaw = textFrom(
          doc.querySelector('.custom_tag_charfacefandom p, .char-face-fandom p'),
        );
        const faceCanonRaw = textFrom(
          doc.querySelector('.custom_tag_charfacecanon p, .char-face-canon p'),
        );
        const fandom = normFandomLabel(faceFandomRaw);
        const canon = String(faceCanonRaw || '').trim();
        if (fandom || canon) {
          faces.push({
            fandom,
            canon: String(fandom).toLowerCase() === 'original' ? '' : canon,
            proto: '',
          });
        }
      }
    }
  
    const primaryFace = faces[0] || { fandom: '', canon: '', proto: '' };
    const faceproto = primaryFace.proto || '';
    const face_fandom = primaryFace.fandom || '';
    const face_canon = primaryFace.canon || '';
  
    const age = toIntOrNull(
      textFrom(doc.querySelector('.custom_tag_charage p, .char-age p')),
    );
    const gender = textFrom(
      doc.querySelector('.custom_tag_chargender p, .char-gender p'),
    );
    const race = textFrom(
      doc.querySelector('.custom_tag_charrace p, .char-race p'),
    );
  
    const gift = textFrom(
      doc.querySelector('.custom_tag_chargift p, .char-gift p'),
    );
  
    const occupations = [];
    const occRoot =
      doc.querySelector('.custom_tag_charoccupation, .char-occupation');
  
    if (occRoot) {
      const statusEls = occRoot.querySelectorAll(
        '.custom_tag_charstatus p, .char-status p, .custom_tag_charstatus, .char-status',
      );
      const roleEls = occRoot.querySelectorAll(
        '.custom_tag_charrole p, .char-role p, .custom_tag_charrole, .char-role',
      );
  
      const max = Math.max(statusEls.length, roleEls.length);
      for (let i = 0; i < max; i++) {
        const st = textFrom(statusEls[i]);
        const rl = textFrom(roleEls[i]);
        if (st || rl) occupations.push({ status: st || '', role: rl || '' });
      }
    }
  
    if (!occupations.length) {
      const statusSingle = textFrom(
        doc.querySelector('.custom_tag_charstatus p, .char-status p'),
      );
      const roleSingle = textFrom(
        doc.querySelector('.custom_tag_charrole p, .char-role p'),
      );
      if (statusSingle || roleSingle) {
        occupations.push({ status: statusSingle || '', role: roleSingle || '' });
      }
    }
  
    const primaryOcc = occupations[0] || { status: '', role: '' };
    const status = primaryOcc.status || '';
    const role = primaryOcc.role || '';
  
    const pair_name = textFrom(
      doc.querySelector(
        '.custom_tag_charpair p, .char-pair p, .custom_tag_charpair, .char-pair',
      ),
    );
    const pair_link = '';
  
    const hasAny =
      img ||
      nameRu ||
      nameEn ||
      faces.length ||
      age !== null ||
      gender ||
      race ||
      status ||
      gift ||
      role ||
      occupations.length ||
      pair_name;
  
    if (!hasAny) return null;
  
    return {
      images,
      img: img || '',
      name: nameRu || '',
      name_en: nameEn || '',
      faces,
      faceproto,
      face_fandom,
      face_canon,
      occupations,
      age: age,
      gender: gender || '',
      race: race || '',
      status,
      role,
      gift: gift || '',
      pair_name: pair_name || '',
      pair_link: pair_link,
    };
  }

  function pickFirstPost(postsForTopic) {
    if (!Array.isArray(postsForTopic) || !postsForTopic.length) return null;
    const sorted = [...postsForTopic].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    return sorted[0] || null;
  }

  async function loadCharacters() {
    const topics = await getTopics(forumsWithCharacters);
    const topicIds = topics.map((t) => t.id).filter(Boolean);
    if (!topicIds.length) return [];

    const allPosts = await getAllPostsForTopics(topicIds);
    const byTopic = new Map();
    for (const p of allPosts) {
      const tid = Number(p.topic_id);
      if (!byTopic.has(tid)) byTopic.set(tid, []);
      byTopic.get(tid).push(p);
    }

    const out = [];
    for (const t of topics) {
      const posts = byTopic.get(t.id) || [];
      const first = pickFirstPost(posts);
      if (!first) continue;

      const parsed = parseProfileFromHtml(first.message);
      if (!parsed) continue;

      out.push({
        topic_id: t.id,
        link: (t.link || first.link || '').trim(),
        subject: t.subject || '',
        ...parsed,
      });
    }
    return out;
  }

  const CACHE_VERSION = 'v7-faces-occupations';
  const CACHE_KEY_DATA = `charactersCatalogData_${CACHE_VERSION}`;
  const CACHE_KEY_TIME = `charactersCatalogTime_${CACHE_VERSION}`;

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY_DATA);
      const ts = Number(localStorage.getItem(CACHE_KEY_TIME)) || 0;
      if (!raw || !ts) return null;
      if (Date.now() - ts > cacheTtlMs) return null;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return { items: arr, ts };
    } catch {}
    return null;
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(items || []));
      localStorage.setItem(CACHE_KEY_TIME, String(Date.now()));
    } catch {}
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY_DATA);
      localStorage.removeItem(CACHE_KEY_TIME);
    } catch {}
  }

  function collectDicts(items) {
    const genders = new Set();
    const statuses = new Set();
    const raceLabelByKey = new Map();

    for (const it of items) {
      if (it.gender) genders.add(it.gender.trim());
    
      const occs = Array.isArray(it.occupations) ? it.occupations : [];
      if (occs.length) {
        occs.forEach((o) => {
          if (o && o.status) statuses.add(String(o.status).trim());
        });
      } else if (it.status) {
        statuses.add(it.status.trim());
      }
    
      if (it.race) {
        const canon = raceCanonicalKey(it.race);
        if (!raceLabelByKey.has(canon)) {
          raceLabelByKey.set(
            canon,
            canon === 'ведьма/ведьмак' ? 'ведьма/ведьмак' : it.race.trim(),
          );
        }
      }
    }

    const races = [{ value: 'all', label: 'Все' }];
    const raceEntries = [...raceLabelByKey.entries()].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]), 'ru'),
    );
    for (const [canon, label] of raceEntries)
      races.push({ value: canon, label });

    return {
      genders: [
        'all',
        ...[...genders].sort((a, b) => a.localeCompare(b, 'ru')),
      ],
      statuses: [
        'all',
        ...[...statuses].sort((a, b) => a.localeCompare(b, 'ru')),
      ],
      races,
      pairs: ['all', 'with', 'without'],
    };
  }

  function applyFilters(items) {
    const f = state.filters;
    const nameNeedle = normKey(f.name);
    const ageMin = toIntOrNull(f.ageMin);
    const ageMax = toIntOrNull(f.ageMax);

    return items.filter((it) => {
      if (nameNeedle) {
        const faces = Array.isArray(it.faces) ? it.faces : [];
        const faceFields = faces.flatMap((f) => [
          normKey(f?.fandom),
          normKey(f?.canon),
          normKey(f?.proto),
        ]);
      
        const fields = [
          normKey(it.name),
          normKey(it.name_en),
          normKey(it.faceproto),
          normKey(it.face_fandom),
          normKey(it.face_canon),
          ...faceFields,
        ];
      
        if (!fields.some((s) => s && s.includes(nameNeedle))) return false;
      }
      if (f.gender !== 'all' && normKey(it.gender) !== normKey(f.gender))
        return false;

      if (f.race !== 'all') {
        const itemRaceKey = raceCanonicalKey(it.race);
        if (itemRaceKey !== f.race) return false;
      }

      if (f.status !== 'all') {
        const needle = normKey(f.status);
        const occs = Array.isArray(it.occupations) ? it.occupations : [];
        const hay = occs.length
          ? occs.map((o) => normKey(o?.status)).filter(Boolean)
          : [normKey(it.status)];
        if (!hay.some((s) => s === needle)) return false;
      }

      if (f.hasPair === 'with' && !it.pair_name) return false;
      if (f.hasPair === 'without' && it.pair_name) return false;

      if (ageMin !== null && Number.isFinite(it.age) && it.age < ageMin)
        return false;
      if (ageMax !== null && Number.isFinite(it.age) && it.age > ageMax)
        return false;
      if ((ageMin !== null || ageMax !== null) && it.age == null) return false;

      return true;
    });
  }

  function applySort(items) {
    const mode = state.filters.sort || 'nameAZ';
    const arr = [...items];
    if (mode === 'nameAZ') {
      arr.sort((a, b) =>
        (mainName(a) || '').localeCompare(mainName(b) || '', 'ru'),
      );
    } else if (mode === 'nameZA') {
      arr.sort((a, b) =>
        (mainName(b) || '').localeCompare(mainName(a) || '', 'ru'),
      );
    } else if (mode === 'faceAZ') {
      arr.sort((a, b) => faceSortKey(a).localeCompare(faceSortKey(b), 'ru'));
    } else if (mode === 'faceZA') {
      arr.sort((a, b) => faceSortKey(b).localeCompare(faceSortKey(a), 'ru'));
    }
    
    return arr;
  }

  function renderError(mount, msg) {
    mount.innerHTML = '';
    mount.appendChild(
      helpers.createEl('div', {
        className: 'chars__error',
        text: msg || UIText.loadError,
      }),
    );
  }
  function renderEmpty(mount) {
    mount.innerHTML = '';
    mount.appendChild(
      helpers.createEl('div', {
        className: 'chars__empty',
        text: UIText.empty,
      }),
    );
  }

  const badge = (text, cls = '') => {
    const el = helpers.createEl('span', { className: `chars__badge ${cls}` });
    el.textContent = text;
    return el;
  };

  function makeCard(item) {
    const card = helpers.createEl('article', { className: 'chars__card' });
    card.dataset.nameKey = normKey(item.name);
    if (item.link) card.dataset.linkKey = normKey(item.link);

    const imgWrap = helpers.createEl('div', { className: 'chars__card-img' });
    const img = helpers.createEl('img', {
      alt: item.name_en || item.name || '',
    });
    const src1 = pickPreferredImage(item);
    if (src1) img.src = src1;
    imgWrap.appendChild(img);

    const body = helpers.createEl('div', { className: 'chars__card-body' });

    const title = helpers.createEl('h3', { className: 'chars__card-title' });
    const mainEn = item.name_en || item.name || '(без имени)';
    if (item.link) {
      const a = helpers.createEl('a', { href: item.link, text: mainEn });
      a.target = '_self';
      title.appendChild(a);
    } else {
      title.textContent = mainEn;
    }
    body.appendChild(title);

    if (item.name && item.name !== item.name_en) {
      body.appendChild(
        helpers.createEl('div', {
          className: 'chars__name-ru',
          text: item.name,
        }),
      );
    }

    const meta = helpers.createEl('div', { className: 'chars__meta' });

    const addField = (label, value, cls) => {
      if (!value && value !== 0) return;
      const row = helpers.createEl('div', {
        className: `chars__field ${cls || ''}`,
      });
      row.appendChild(
        helpers.createEl('span', {
          className: 'chars__field-label',
          text: label,
        }),
      );
      row.appendChild(
        helpers.createEl('span', {
          className: 'chars__field-value',
          text: String(value),
        }),
      );
      meta.appendChild(row);
    };

    addField('Род деятельности', item.status, 'is-status');
    addField('Раса', item.race, 'is-race');
    addField('Пара', item.pair_name, 'is-pair');
    addField('Пол', item.gender, 'is-gender');
    if (Number.isFinite(item.age))
      addField('Возраст', String(item.age), 'is-age');
    addField('Дар/форма', item.gift, 'is-gift');
    addField('Внешность', item.faceproto, 'is-face');

    body.appendChild(meta);

    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function renderCards(mount, items) {
    const cont = helpers.createEl('div', { className: 'chars__grid' });

    const mapByName = new Map();
    const linkMap = new Map();

    const cards = items.map((it) => {
      const card = makeCard(it);
      cont.appendChild(card);

      const ru = normKey(it.name);
      const en = normKey(it.name_en);
      if (ru) mapByName.set(ru, card);
      if (en) mapByName.set(en, card);

      const lk = it.link ? normKey(it.link) : '';
      if (lk) linkMap.set(lk, card);

      return { it, card };
    });

    for (const { it, card } of cards) {
      const pairNameKey = it.pair_name ? normKey(it.pair_name) : '';
      const pairLinkKey = it.pair_link ? normKey(it.pair_link) : '';

      function applyHover(on) {
        if (!pairNameKey || pairNameKey === 'unknown') {
          card.classList.toggle('is-related', on);
          return;
        }
        const target =
          mapByName.get(pairNameKey) ||
          (pairLinkKey ? linkMap.get(pairLinkKey) : null);
        card.classList.toggle('is-related', on);
        if (target) target.classList.toggle('is-related', on);
      }

      card.addEventListener('mouseenter', () => applyHover(true));
      card.addEventListener('mouseleave', () => applyHover(false));
    }

    mount.appendChild(cont);
  }

  function getAZBucket(ch) {
    const c = String(ch || '')
      .toUpperCase()
      .charCodeAt(0);
    if (c >= 65 && c <= 71) return 'A–G';
    if (c >= 72 && c <= 78) return 'H–N';
    if (c >= 79 && c <= 85) return 'O–U';
    if (c >= 86 && c <= 90) return 'V–Z';
    return 'Other';
  }

  function makeFaceLine(entry) {
    const ch = entry._char || {};
    const { fandom, canon } = (function getFaceMeta(e) {
      const f = String(e.fandom || '').trim();
      const c = String(e.canon || '').trim();
      if (f || c) return { fandom: f, canon: c };
  
      const s = String(e.proto || '').trim();
      const m = s.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
      if (m) {
        const ff = String(m[1] || '').trim();
        const name = String(m[2] || '').trim();
        const fk = ff.toLowerCase();
        if (fk === 'original' || fk === 'оригинал') return { fandom: 'original', canon: '' };
        if (fk === 'real' || fk === 'реал' || fk === 'реальный') return { fandom: 'real', canon: name };
        return { fandom: ff, canon: name };
      }
      return { fandom: '', canon: '' };
    })(entry);
  
    const row = helpers.createEl('div', { className: 'chars__line' });
  
    const left = helpers.createEl('span', { className: 'chars__line-left' });
    let leftText = '';
    if (fandom) {
      if (fandom.toLowerCase() === 'original') {
        leftText = '[original]';
      } else if (fandom.toLowerCase() === 'real') {
        leftText = canon ? `[real] ${canon}` : '[real]';
      } else {
        leftText = canon ? `[${fandom}] ${canon}` : `[${fandom}]`;
      }
    } else {
      leftText = entry.proto || '—';
    }
    left.textContent = leftText;
  
    const mid = helpers.createEl('span', { text: ' — ' });
  
    const right = helpers.createEl('span', { className: 'chars__line-right' });
    const link = ch.link
      ? helpers.createEl('a', { href: ch.link, text: ch.name_en || ch.name || '(без имени)' })
      : helpers.createEl('span', { text: ch.name_en || ch.name || '(без имени)' });
    if (ch.link) link.target = '_self';
    right.appendChild(link);
  
    row.appendChild(left);
    row.appendChild(mid);
    row.appendChild(right);
    return row;
  }

  function renderByFace(mount, items) {
    const wrap = helpers.createEl('div', { className: 'chars__byface' });
    const faceEntries = [];
    for (const ch of items) {
      const faces = Array.isArray(ch.faces) ? ch.faces : [];
      if (faces.length) {
        faces.forEach((f) => {
          faceEntries.push({
            _char: ch,
            fandom: String(f?.fandom || '').trim(),
            canon: String(f?.canon || '').trim(),
            proto: String(f?.proto || '').trim() || '',
          });
        });
      } else if (ch.faceproto || ch.face_fandom || ch.face_canon) {
        faceEntries.push({
          _char: ch,
          fandom: String(ch.face_fandom || '').trim(),
          canon: String(ch.face_canon || '').trim(),
          proto: String(ch.faceproto || '').trim(),
        });
      } else {}
    }

    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr';
    wrap.style.gap = '16px';

    if (typeof state.faceQuery !== 'string') state.faceQuery = '';

    const searchWrap = helpers.createEl('div', {
      className: 'chars__byface-search',
    });
    const faceSearch = helpers.createEl('input', {
      className: 'chars__input',
      placeholder: 'Фандом или персонаж внешности',
    });
    faceSearch.value = state.faceQuery;
    searchWrap.appendChild(faceSearch);
    wrap.appendChild(searchWrap);

    const colsWrap = helpers.createEl('div');
    colsWrap.style.display = 'grid';
    colsWrap.style.gridTemplateColumns = '1fr 1fr';
    colsWrap.style.gap = '16px';

    const colM = helpers.createEl('div', { className: 'chars__col' });
    const colF = helpers.createEl('div', { className: 'chars__col' });

    colM.appendChild(
      helpers.createEl('h3', {
        className: 'chars__col-title',
        text: 'Мужчины',
      }),
    );
    colF.appendChild(
      helpers.createEl('h3', {
        className: 'chars__col-title',
        text: 'Женщины',
      }),
    );

    colsWrap.appendChild(colM);
    colsWrap.appendChild(colF);
    wrap.appendChild(colsWrap);
    mount.appendChild(wrap);

    function faceMeta(entry) {
      const fandom = String(entry.fandom || '').trim();
      const canon = String(entry.canon || '').trim();
      if (fandom || canon) return { fandom, canon };
    
      const s = String(entry.proto || '').trim();
      const m = s.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
      if (m) {
        const f = String(m[1] || '').trim();
        const name = String(m[2] || '').trim();
        const fk = f.toLowerCase();
        if (fk === 'original' || fk === 'оригинал') return { fandom: 'original', canon: '' };
        if (fk === 'real' || fk === 'реал' || fk === 'реальный') return { fandom: 'real', canon: name };
        return { fandom: f, canon: name };
      }
      return { fandom: '', canon: '' };
    }

    function firstAZChar(str) {
      const s = String(str || '').toUpperCase();
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code >= 65 && code <= 90) return s[i];
      }
      return '';
    }

    function cmpByFandomThenCanonThenPlayer(a, b) {
      const A = faceMeta(a);
      const B = faceMeta(b);
      const af = normKey(A.fandom);
      const bf = normKey(B.fandom);
      if (af !== bf) return af.localeCompare(bf, 'ru');

      const ac = normKey(A.canon);
      const bc = normKey(B.canon);
      if (ac !== bc) return ac.localeCompare(bc, 'ru');
      const an = ((a._char?.name_en || a._char?.name || '')).trim();
      const bn = ((b._char?.name_en || b._char?.name || '')).trim();

      return an.localeCompare(bn, 'ru');
    }

    function passFaceSearch(item, needle) {
      if (!needle) return true;
      const { fandom, canon } = faceMeta(item);
      return (
        normKey(fandom).includes(needle) ||
        normKey(canon).includes(needle) ||
        normKey(item.proto).includes(needle)
      );
    }

    function buildColumn(col, arr) {
      const groups = new Map();

      for (const e of arr) {
        const { fandom, canon } = faceMeta(e);
        const ch = e._char || {};
        const keySource = fandom || canon || ch.name_en || ch.name || '';
        const chAz = firstAZChar(keySource);
        const bucket = getAZBucket(chAz);
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket).push(e);
      }

      const keys = ['A–G', 'H–N', 'O–U', 'V–Z', 'Other'].filter((k) =>
        groups.has(k),
      );

      for (const k of keys) {
        const sec = helpers.createEl('section', { className: 'chars__sec' });
        sec.appendChild(
          helpers.createEl('h4', { className: 'chars__sec-title', text: k }),
        );

        const list = helpers.createEl('div', { className: 'chars__lines' });
        groups
          .get(k)
          .sort(cmpByFandomThenCanonThenPlayer)
          .forEach((e) => list.appendChild(makeFaceLine(e)));

        sec.appendChild(list);
        col.appendChild(sec);
      }

      if (!keys.length) {
        const empty = helpers.createEl('div', { className: 'chars__empty' });
        empty.textContent = 'Ничего не найдено.';
        col.appendChild(empty);
      }
    }

    function rebuildColumns() {
      colM
        .querySelectorAll('.chars__sec, .chars__lines, .chars__empty')
        .forEach((n) => n.remove());
      colF
        .querySelectorAll('.chars__sec, .chars__lines, .chars__empty')
        .forEach((n) => n.remove());

      const q = normKey(state.faceQuery);

      const males = faceEntries
        .filter((e) => normKey(e._char?.gender) === 'мужской')
        .filter((e) => passFaceSearch(e, q));
      
      const females = faceEntries
        .filter((e) => normKey(e._char?.gender) === 'женский')
        .filter((e) => passFaceSearch(e, q));

      buildColumn(colM, males);
      buildColumn(colF, females);
    }

    rebuildColumns();

    const debounced = helpers.debounce(() => {
      state.faceQuery = String(faceSearch.value || '').trim();
      rebuildColumns();
    }, 150);
    faceSearch.addEventListener('input', debounced);
  }

  function makeMini(it) {
    const card = helpers.createEl('div', { className: 'chars__mini' });
    card.style.display = 'grid';
    card.style.gridTemplateRows = 'auto auto auto';
    card.style.justifyItems = 'center';
    card.style.gap = '6px';
    card.style.padding = '8px';
    card.style.border = '1px solid var(--hair, #ccc)';
    card.style.borderRadius = '8px';

    const img = helpers.createEl('img', { alt: it.name_en || it.name || '' });
    img.style.width = '72px';
    img.style.height = '96px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid var(--hair, #ccc)';
    const src2 = pickPreferredImage(it);
    if (src2) img.src = src2;
    card.appendChild(img);

    const name = it.link
      ? helpers.createEl('a', {
          href: it.link,
          text: it.name_en || it.name || '(без имени)',
        })
      : helpers.createEl('div', {
          text: it.name_en || it.name || '(без имени)',
        });
    if (it.link) name.target = '_self';
    name.className = 'chars__mini-name';
    card.appendChild(name);

    const race = helpers.createEl('div', {
      className: 'chars__mini-race',
      text: it.race || '—',
    });
    race.style.fontSize = '12px';
    race.style.opacity = '0.9';
    card.appendChild(race);

    const role = helpers.createEl('div', {
      className: 'chars__mini-role',
      text: it.role || '',
    });
    role.style.fontSize = '12px';
    role.style.opacity = '0.75';
    card.appendChild(role);

    return card;
  }

  function renderRoleGrid(mount, items) {
    const wrap = helpers.createEl('div', { className: 'chars__roles' });
  
    const byStatus = new Map();
  
    for (const ch of items) {
      const occs = Array.isArray(ch.occupations) ? ch.occupations : [];
      const list = occs.length ? occs : [{ status: ch.status || '—', role: ch.role || '' }];
  
      for (const o of list) {
        const st = String(o?.status || '—').trim() || '—';
        const rl = String(o?.role || '').trim();
  
        if (!byStatus.has(st)) byStatus.set(st, []);
        byStatus.get(st).push({ _char: ch, status: st, role: rl });
      }
    }
  
    const statusKeys = [...byStatus.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
  
    statusKeys.forEach((k) => {
      const sec = helpers.createEl('section', { className: 'chars__sec' });
      sec.appendChild(
        helpers.createEl('h4', { className: 'chars__sec-title', text: k }),
      );
  
      const grid = helpers.createEl('div', { className: 'chars__mini-grid' });
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
      grid.style.gap = '8px';
  
      byStatus
        .get(k)
        .sort((a, b) =>
          ((a._char?.name_en || a._char?.name || '')).localeCompare(
            (b._char?.name_en || b._char?.name || ''),
            'ru',
          ),
        )
        .forEach((e) => {
          const ch = e._char || {};
          const it = { ...ch, status: e.status, role: e.role };
          grid.appendChild(makeMini(it));
        });
  
      sec.appendChild(grid);
      wrap.appendChild(sec);
    });
  
    mount.appendChild(wrap);
  }

  function renderList(mount, items) {
    if (state.view === 'cards') {
      renderCards(mount, items);
    } else if (state.view === 'byFace') {
      renderByFace(mount, items);
    } else if (state.view === 'roleGrid') {
      renderRoleGrid(mount, items);
    }
  }

  function renderViewSwitcher(host) {
    const wrap = helpers.createEl('div', { className: 'chars__views' });
    const mkBtn = (id, text) =>
      helpers.createEl('button', {
        className: `chars__view-btn${state.view === id ? ' is-active' : ''}`,
        text,
        type: 'button',
      });
    const btn1 = mkBtn('cards', UIText.views.cards);
    const btn2 = mkBtn('byFace', UIText.views.byFace);
    const btn3 = mkBtn('roleGrid', UIText.views.roleGrid);

    function pick(id) {
      state.view = id;
      host.querySelector('.chars__list')?.remove();
      const listHolder = helpers.createEl('div', { className: 'chars__list' });
      host.appendChild(listHolder);
      const filtered = applySort(applyFilters(state.items));
      if (!filtered.length) renderEmpty(listHolder);
      else renderList(listHolder, filtered);
      wrap
        .querySelectorAll('.chars__view-btn')
        .forEach((b) =>
          b.classList.toggle(
            'is-active',
            (id === 'cards' && b === btn1) ||
              (id === 'byFace' && b === btn2) ||
              (id === 'roleGrid' && b === btn3),
          ),
        );
    }

    btn1.addEventListener('click', () => pick('cards'));
    btn2.addEventListener('click', () => pick('byFace'));
    btn3.addEventListener('click', () => pick('roleGrid'));

    wrap.appendChild(btn1);
    wrap.appendChild(btn2);
    wrap.appendChild(btn3);
    return wrap;
  }

  function renderFilters(mount) {
    const wrap = helpers.createEl('div', { className: 'chars__filters' });

    const inName = helpers.createEl('input', {
      className: 'chars__input',
      placeholder: UIText.placeholders.name,
    });

    const ageFrom = helpers.createEl('input', {
      className: 'chars__input chars__input--age',
      placeholder: UIText.placeholders.ageFrom,
      type: 'number',
      min: '0',
    });
    const ageTo = helpers.createEl('input', {
      className: 'chars__input chars__input--age',
      placeholder: UIText.placeholders.ageTo,
      type: 'number',
      min: '0',
    });

    const selGender = helpers.createEl('select', {
      className: 'chars__select',
    });
    const selRace = helpers.createEl('select', { className: 'chars__select' });
    const selStatus = helpers.createEl('select', {
      className: 'chars__select',
    });
    const selPair = helpers.createEl('select', { className: 'chars__select' });
    const selSort = helpers.createEl('select', { className: 'chars__select' });

    function fillSelect(sel, values) {
      sel.innerHTML = '';
      for (const v of values) {
        const isObj = v && typeof v === 'object';
        const value = isObj ? v.value : v;
        const label = isObj ? v.label : v;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent =
          value === 'all'
            ? 'Все'
            : value === 'with'
            ? 'Есть'
            : value === 'without'
            ? 'Нет'
            : decodeHtml(label);
        sel.appendChild(opt);
      }
    }

    fillSelect(selGender, state.dicts.genders);
    fillSelect(selRace, state.dicts.races);
    fillSelect(selStatus, state.dicts.statuses);
    fillSelect(selPair, state.dicts.pairs);
    fillSelect(selSort, [
      { value: 'nameAZ', label: UIText.sort.nameAZ },
      { value: 'nameZA', label: UIText.sort.nameZA },
      { value: 'faceAZ', label: UIText.sort.faceAZ },
      { value: 'faceZA', label: UIText.sort.faceZA },
    ]);

    function mkGroup(labelText, controlEl) {
      const g = helpers.createEl('label', { className: 'chars__filter-group' });
      g.appendChild(
        helpers.createEl('div', {
          className: 'chars__filter-label',
          text: labelText,
        }),
      );
      g.appendChild(controlEl);
      return g;
    }

    const btnClear = helpers.createEl('button', {
      className: 'chars__btn chars__btn--ghost',
      text: UIText.filters.clear,
      type: 'button',
    });
    const btnRefresh = helpers.createEl('button', {
      className: 'chars__btn',
      text: UIText.filters.refresh,
      type: 'button',
    });

    wrap.appendChild(mkGroup(UIText.filters.name, inName));
    const ageRow = helpers.createEl('div', { className: 'chars__age-row' });
    ageRow.appendChild(ageFrom);
    ageRow.appendChild(ageTo);
    wrap.appendChild(mkGroup(UIText.filters.age, ageRow));
    wrap.appendChild(mkGroup(UIText.filters.gender, selGender));
    wrap.appendChild(mkGroup(UIText.filters.race, selRace));
    wrap.appendChild(mkGroup(UIText.filters.status, selStatus));
    wrap.appendChild(mkGroup(UIText.filters.pair, selPair));
    wrap.appendChild(mkGroup(UIText.filters.sort, selSort));

    const actions = helpers.createEl('div', { className: 'chars__actions' });
    actions.appendChild(btnClear);
    actions.appendChild(btnRefresh);
    wrap.appendChild(actions);

    inName.value = state.filters.name;
    ageFrom.value = state.filters.ageMin;
    ageTo.value = state.filters.ageMax;
    selGender.value = state.filters.gender;
    selRace.value = state.filters.race;
    selStatus.value = state.filters.status;
    selPair.value = state.filters.hasPair;
    selSort.value = state.filters.sort;

    const debounced = helpers.debounce(() => {
      state.filters.name = String(inName.value || '').trim();
      state.filters.ageMin = String(ageFrom.value || '').trim();
      state.filters.ageMax = String(ageTo.value || '').trim();
      state.filters.gender = selGender.value || 'all';
      state.filters.race = selRace.value || 'all';
      state.filters.status = selStatus.value || 'all';
      state.filters.hasPair = selPair.value || 'all';
      state.filters.sort = selSort.value || 'nameAZ';
      mount.querySelector('.chars__list')?.remove();
      const listHolder = helpers.createEl('div', { className: 'chars__list' });
      mount.appendChild(listHolder);
      const filtered = applySort(applyFilters(state.items));
      if (!filtered.length) renderEmpty(listHolder);
      else renderList(listHolder, filtered);
    }, 150);

    inName.addEventListener('input', debounced);
    ageFrom.addEventListener('input', debounced);
    ageTo.addEventListener('input', debounced);
    selGender.addEventListener('change', debounced);
    selRace.addEventListener('change', debounced);
    selStatus.addEventListener('change', debounced);
    selPair.addEventListener('change', debounced);
    selSort.addEventListener('change', debounced);

    btnClear.addEventListener('click', () => {
      inName.value = '';
      ageFrom.value = '';
      ageTo.value = '';
      selGender.value = 'all';
      selRace.value = 'all';
      selStatus.value = 'all';
      selPair.value = 'all';
      selSort.value = 'nameAZ';
      debounced();
    });

    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      clearCache();
      await run(true);
      btnRefresh.disabled = false;
    });

    return wrap;
  }

  function render(mount) {
    mount.innerHTML = '';
    mount.appendChild(
      helpers.createEl('h2', { className: 'chars__title', text: UIText.title }),
    );
    const views = renderViewSwitcher(mount);
    mount.appendChild(views);
    const filterWrap = renderFilters(mount);
    mount.appendChild(filterWrap);
    const listHolder = helpers.createEl('div', { className: 'chars__list' });
    mount.appendChild(listHolder);
    const filtered = applySort(applyFilters(state.items));
    if (!filtered.length) renderEmpty(listHolder);
    else renderList(listHolder, filtered);
  }

  async function run(forceReload = false) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    if (!location.pathname.includes(pagePath)) return;

    if (!forceReload) {
      const cache = readCache();
      if (cache && Array.isArray(cache.items)) {
        state.items = cache.items;
        state.dicts = collectDicts(state.items);
        state.refreshedAt = cache.ts;
        render(mount);
        return;
      }
    }

    try {
      const items = await loadCharacters();
      state.items = items;
      state.dicts = collectDicts(items);
      writeCache(items);
      render(mount);
    } catch (e) {
      renderError(mount, UIText.loadError);
    }
  }

  function init() {
    run();
  }
  helpers.runOnceOnReady(init);
  helpers.register('charactersParser', { init });
})();

