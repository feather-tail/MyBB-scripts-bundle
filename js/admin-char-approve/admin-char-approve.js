(() => {
  'use strict';

  const helpers = window.helpers || {};
  const {
    $,
    getConfig,
    runOnceOnReady,
    parseHTML,
    request,
    getForumId,
    getUserInfo,
    showToast,
  } = helpers;

  const notify = (msg, type = 'info') => {
    if (typeof showToast === 'function') {
      showToast(msg, { type });
    } else {
      alert(msg);
    }
  };

  const start = () => {
    const CHAR_CFG = getConfig('charProfileTool', {}) || {};
    const access = CHAR_CFG.access || {};
    const endpoints = CHAR_CFG.endpoints || {};
    const profileCfg = CHAR_CFG.profile || {};
    const selectors = CHAR_CFG.selectors || {};
    const ui = CHAR_CFG.ui || {};

    const KS_CONFIG = {
      apiBase: endpoints.apiBase || '/api.php',
      profileUrl:
        typeof endpoints.profileUrl === 'function'
          ? endpoints.profileUrl
          : (uid) =>
              `/profile.php?section=fields&id=${encodeURIComponent(uid)}`,
      profileFormSelector:
        endpoints.profileFormSelector ||
        'form[action*="profile.php"][method="post"]',

      adminProfileUrl:
        typeof endpoints.adminProfileUrl === 'function'
          ? endpoints.adminProfileUrl
          : (uid) => `/profile.php?section=admin&id=${encodeURIComponent(uid)}`,
      adminProfileFormSelector:
        endpoints.adminProfileFormSelector ||
        'form[action*="profile.php?section=admin"][method="post"], form#profile11',

      adminAddPageUrl:
        endpoints.adminAddPageUrl || '/admin_pages.php?action=adddel',
      adminAddPageFormSelector:
        endpoints.adminAddPageFormSelector ||
        'form[action*="admin_pages.php"][method="post"], form#addpage',

      profileFields: {
        race: profileCfg.fieldNames?.race || 'form[fld2]',
        title: profileCfg.fieldNames?.title || 'form[fld1]',
        badge: profileCfg.fieldNames?.badge || 'form[fld3]',
        money: profileCfg.fieldNames?.money || 'form[fld4]',
        posts: profileCfg.fieldNames?.posts || 'form[fld5]',
      },

      defaultValues: {
        money:
          typeof profileCfg.moneyDefault === 'string'
            ? profileCfg.moneyDefault
            : '0',
        posts:
          typeof profileCfg.postsDefault === 'string'
            ? profileCfg.postsDefault
            : '0',
      },

      targetGroupId:
        typeof profileCfg.targetGroupId === 'number'
          ? profileCfg.targetGroupId
          : 6,

      adminPageTemplate:
        typeof CHAR_CFG.adminPageTemplate === 'string'
          ? CHAR_CFG.adminPageTemplate.trim()
          : `
<div class="character">
  <div class="modal__tabs">
    <button class="modal__tab active" type="button">Профиль</button>
    <button class="modal__tab" type="button">Навыки</button>
    <button class="modal__tab" type="button">История</button>
  </div>
  <div class="modal__content active">
<!--Профиль контент-->

<div class="pf-cnt">Что здесь будет?</div>

<!--Конец профиль контент-->
  </div>
  <div class="modal__content">
<!--Навыки контент-->

<div class="pf-cnt">Что здесь будет?</div>

<!--Конец навыки контент-->
  </div>
  <div class="modal__content">
<!--История контент-->

<div class="pf-cnt">Ожидание обновления...</div>

<!--Конец истории контент-->
  </div>
</div>`.trim(),

      requestTimeoutMs:
        typeof CHAR_CFG.requestTimeoutMs === 'number'
          ? CHAR_CFG.requestTimeoutMs
          : 15000,
    };

    // --- Проверка доступа ---
    const forumId = getForumId();
    const user = getUserInfo();

    const allowedForums = access.allowedForumIds || [];
    const allowedGroups = access.allowedGroupIds || [];

    if (
      !forumId ||
      (Array.isArray(allowedForums) &&
        allowedForums.length &&
        !allowedForums.includes(forumId))
    ) {
      return;
    }

    if (
      !user ||
      (Array.isArray(allowedGroups) &&
        allowedGroups.length &&
        !allowedGroups.includes(user.group))
    ) {
      return;
    }

    if (!location.pathname.includes('viewtopic.php')) {
      // Ограничимся страницами темы
      return;
    }

    // --- Состояние ---
    const state = {
      loaded: false,
      topicId: null,
      characterData: null,
      firstPost: null,
      userId: null,
      slug: null,
    };

    // --- Утилиты парсинга и запросов ---
    const textFrom = (el) =>
      String((el && (el.textContent || el.innerText)) || '').trim();

    const htmlToDom = (html) => parseHTML(String(html || ''));

    const toIntOrNull = (s) => {
      const n = parseInt(String(s || '').replace(/[^\d\-]/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    };

    const encodeNonAscii = (s) =>
      String(s).replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);

    const toAbsUrl = (url) => {
      if (!url) return url;
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith('/')) return url;
      return '/' + url;
    };

    const fetchWithTimeoutJSON = async (url) => {
      const resp = await request(toAbsUrl(url), {
        responseType: 'json',
        timeout: KS_CONFIG.requestTimeoutMs,
      });
      return resp;
    };

    const fetchWithTimeoutText = async (url, opts = {}) => {
      const resp = await request(toAbsUrl(url), {
        ...opts,
        timeout: KS_CONFIG.requestTimeoutMs,
      });
      const text =
        typeof resp.text === 'function' ? await resp.text() : await resp;
      return text;
    };

    const parseProfileFromHtml = (html) => {
      if (!html) return null;
      const doc = htmlToDom(html);

      const nameRu = textFrom(
        doc.querySelector('.custom_tag_charname p, .char-name-ru p'),
      );
      const nameEn = textFrom(
        doc.querySelector('.custom_tag_charnameen p, .char-name-en p'),
      );
      const age = toIntOrNull(
        textFrom(doc.querySelector('.custom_tag_charage p, .char-age p')),
      );
      const race = textFrom(
        doc.querySelector('.custom_tag_charrace p, .char-race p'),
      );

      const personalText = textFrom(
        doc.querySelector(
          '.custom_tag_charpt p, .custom_tag.custom_tag_charpt.char-field.personal-text p',
        ),
      );

      const hasAny = nameRu || nameEn || age !== null || race;
      if (!hasAny) return null;

      return {
        name: nameRu || '',
        name_en: nameEn || '',
        age,
        race: race || '',
        lz: personalText || '',
      };
    };

    const getRaceLetter = (race) => {
      const raceLower = race.toLowerCase();
      if (raceLower === 'фамильяр') return 'f';
      if (raceLower === 'ведьма' || raceLower === 'ведьмак') return 'w';
      if (raceLower === 'осквернённый') return 't';
      if (raceLower === 'человек') return 'h';
      return '';
    };

    const generateFileName = (nameEn) =>
      nameEn
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zа-яё_]/g, '');

    const getTopicIdFromLocation = () => {
      const m = location.search.match(/[?&]id=(\d+)/);
      if (m) return m[1];
      const link = $('#pun-viewtopic a.permalink[href*="viewtopic.php?id="]');
      if (link) {
        const m2 = link.href.match(/viewtopic\.php\?id=(\d+)/);
        if (m2) return m2[1];
      }
      return null;
    };

    const pickFirstPost = (posts) => {
      if (!Array.isArray(posts) || !posts.length) return null;
      const sorted = [...posts].sort((a, b) => Number(a.id) - Number(b.id));
      return sorted[0] || null;
    };

    const getPostsForTopic = async (topicId) => {
      const url = `${
        KS_CONFIG.apiBase
      }?method=post.get&topic_id=${encodeURIComponent(
        topicId,
      )}&fields=id,topic_id,message,username,link&limit=100`;

      try {
        const data = await fetchWithTimeoutJSON(url);
        if (data && data.response) {
          return data.response.map((post) => ({
            id: Number(post.id),
            topic_id: Number(post.topic_id),
            username: String(post.username || ''),
            message: String(post.message || ''),
            link: String(post.link || ''),
          }));
        }
        return [];
      } catch (error) {
        console.error('Ошибка при загрузке постов:', error);
        throw new Error('Не удалось загрузить данные темы');
      }
    };

    const getUserIdByUsername = async (username) => {
      if (!username) return null;
      const encodedUsername = encodeURIComponent(username.trim());
      const url = `${KS_CONFIG.apiBase}?method=users.get&username=${encodedUsername}&fields=user_id`;
      try {
        const data = await fetchWithTimeoutJSON(url);
        if (
          data &&
          data.response &&
          data.response.users &&
          data.response.users.length > 0
        ) {
          return data.response.users[0].user_id;
        }
        return null;
      } catch (e) {
        console.error('Ошибка при загрузке user_id:', e);
        return null;
      }
    };

    const findUserId = async (characterData, firstPost) => {
      let userId = null;

      if (characterData.name_en) {
        userId = await getUserIdByUsername(characterData.name_en);
        if (userId) return userId;
      }

      if (characterData.name) {
        userId = await getUserIdByUsername(characterData.name);
        if (userId) return userId;
      }

      if (firstPost.username) {
        userId = await getUserIdByUsername(firstPost.username);
        if (userId) return userId;
      }

      if (characterData.name_en) {
        const firstName = characterData.name_en.split(' ')[0];
        if (firstName && firstName !== characterData.name_en) {
          userId = await getUserIdByUsername(firstName);
          if (userId) return userId;
        }
      }

      return null;
    };

    const findSubmitControl = (form) => {
      let x = form.querySelector('input[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || '1' };
      x = form.querySelector('button[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || '1' };
      x = form.querySelector(
        'input[name="update"],input[name="submit"],input[name="save"],input[name="add_page"]',
      );
      if (x) return { name: x.name, value: x.value || '1' };
      return null;
    };

    const fetchProfileForm = async (userId) => {
      const url = toAbsUrl(KS_CONFIG.profileUrl(userId));
      const html = await fetchWithTimeoutText(url);
      const doc = htmlToDom(html);
      const form =
        doc.querySelector(KS_CONFIG.profileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) throw new Error('Форма профиля не найдена.');
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAdminProfileForm = async (userId) => {
      const url = toAbsUrl(KS_CONFIG.adminProfileUrl(userId));
      const html = await fetchWithTimeoutText(url);
      const doc = htmlToDom(html);
      const form =
        doc.querySelector(KS_CONFIG.adminProfileFormSelector) ||
        doc.querySelector('form#profile11');
      if (!form) throw new Error('Форма админ-профиля не найдена.');
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAddPageForm = async () => {
      const url = toAbsUrl(KS_CONFIG.adminAddPageUrl);
      const html = await fetchWithTimeoutText(url);
      const doc = htmlToDom(html);
      const form =
        doc.querySelector(KS_CONFIG.adminAddPageFormSelector) ||
        doc.querySelector('form#addpage');
      if (!form) throw new Error('Форма создания страницы не найдена.');
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const buildParamsWithOverrides = (form, overrideMap) => {
      const params = new URLSearchParams();
      const isHidden = (el) =>
        el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'hidden';

      const overrideNames = new Set(Object.keys(overrideMap || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;
        const type = (el.type || '').toLowerCase();

        if (isHidden(el)) {
          params.append(el.name, el.value ?? '');
          continue;
        }

        if (el.name === 'form_sent') {
          params.set('form_sent', el.value || '1');
          continue;
        }

        if (overrideNames.has(el.name)) {
          const raw = overrideMap[el.name];
          const val = encodeNonAscii(raw ?? '');
          params.set(el.name, val);
          continue;
        }

        if (/^form\[\w+\]$/.test(el.name)) {
          params.set(el.name, el.value ?? '');
          continue;
        }

        if ((type === 'checkbox' || type === 'radio') && el.checked) {
          params.append(el.name, el.value ?? '1');
          continue;
        }
      }

      if (!params.has('form_sent')) params.set('form_sent', '1');

      overrideNames.forEach((name) => {
        if (!params.has(name)) {
          const raw = overrideMap[name];
          const val = encodeNonAscii(raw ?? '');
          params.set(name, val);
        }
      });

      const submit = findSubmitControl(form);
      if (submit) {
        params.append(submit.name, submit.value);
      }

      return params;
    };

    const postForm = async (actionUrl, params, refUrl) => {
      const finalUrl = toAbsUrl(actionUrl);
      const ref = refUrl ? toAbsUrl(refUrl) : finalUrl;
      const resp = await request(finalUrl, {
        method: 'POST',
        data: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: KS_CONFIG.requestTimeoutMs,
        referrer: ref,
      });
      if (!resp.ok) {
        throw new Error(`Ошибка при сохранении (HTTP ${resp.status})`);
      }
    };

    const detectGroupFieldName = (form, targetGroupId) => {
      let el =
        form.querySelector('select[name="group_id"]') ||
        form.querySelector('select[name="req_group_id"]');
      if (el) return el.name;
      const selects = form.querySelectorAll('select[name]');
      for (const s of selects) {
        const opts = Array.from(s.options || []);
        if (opts.some((o) => String(o.value) === String(targetGroupId))) {
          return s.name;
        }
      }
      return null;
    };

    // --- Загрузка данных из текущей темы (один раз) ---
    const ensureLoaded = async () => {
      if (state.loaded) return;

      const topicId = getTopicIdFromLocation();
      if (!topicId) throw new Error('Не удалось определить ID темы.');
      state.topicId = topicId;

      const posts = await getPostsForTopic(topicId);
      if (!posts.length) throw new Error('В теме нет постов.');

      const firstPost = pickFirstPost(posts);
      if (!firstPost) throw new Error('Не удалось найти первый пост.');

      const characterData = parseProfileFromHtml(firstPost.message);
      if (!characterData) {
        throw new Error(
          'Не удалось распознать анкету персонажа в первом посте. Проверь BB-коды.',
        );
      }

      if (!characterData.name) {
        throw new Error('Не найдено имя персонажа (BB-код [charname]).');
      }
      if (!characterData.name_en) {
        throw new Error(
          'Не найдено английское имя персонажа (BB-код [charnameen]).',
        );
      }
      if (!characterData.age) {
        throw new Error('Не найден возраст персонажа (BB-код [charage]).');
      }
      if (!characterData.race) {
        throw new Error('Не найдена раса персонажа (BB-код [charrace]).');
      }
      if (!characterData.lz) {
        throw new Error('Не найден текст ЛЗ (BB-код [charpt]).');
      }

      const userId = await findUserId(characterData, firstPost);
      if (!userId) {
        throw new Error(
          'Не удалось автоматически определить user_id по нику и анкете.',
        );
      }

      state.characterData = characterData;
      state.firstPost = firstPost;
      state.userId = userId;
      state.slug = generateFileName(characterData.name_en);
      state.loaded = true;
    };

    const handleFillProfile = async () => {
      try {
        await ensureLoaded();
        const { userId, slug, characterData, topicId } = state;
        const raceLetter = getRaceLetter(characterData.race);
    
        const topicUrlBase = `${location.origin}/viewtopic.php?id=${topicId}`;
    
        const lzText = characterData.lz;
    
        const raceField = `<div title="${characterData.race}">${raceLetter}</div>`;
        const lzField = `<div class="lz-name"><a href="${topicUrlBase}">${characterData.name}</a>, ${characterData.age}</div> <div class="lz-text">${lzText}</div>`;
        const plahField = `<pers-plah class="modal-link" id="${slug}" data-user-id="${userId}" role="button" tabindex="0" style="cursor:pointer"><div class="pers-plah"><em class="pers-plah-text"> Two bodies, one soul </em></div></pers-plah>`;
    
        const { form, actionUrl } = await fetchProfileForm(userId);
    
        const overrides = {
          [KS_CONFIG.profileFields.race]: raceField,
          [KS_CONFIG.profileFields.title]: lzField,
          [KS_CONFIG.profileFields.badge]: plahField,
          [KS_CONFIG.profileFields.money]: KS_CONFIG.defaultValues.money,
          [KS_CONFIG.profileFields.posts]: KS_CONFIG.defaultValues.posts,
        };
    
        const params = buildParamsWithOverrides(form, overrides);
        await postForm(actionUrl, params, actionUrl);
    
        notify(
          'Профиль обновлён. Проверь вкладку «Дополнительно» в профиле пользователя.',
          'success',
        );
      } catch (e) {
        console.error('Ошибка при заполнении профиля:', e);
        notify(e.message || String(e), 'error');
      }
    };

    const handleCreatePage = async () => {
      try {
        await ensureLoaded();
        const { slug } = state;

        const { form, actionUrl } = await fetchAddPageForm();

        const overrides = {
          title: slug,
          name: slug,
          content: KS_CONFIG.adminPageTemplate,
        };

        const params = buildParamsWithOverrides(form, overrides);
        await postForm(actionUrl, params, actionUrl);

        notify(
          `Страница "${slug}" создана. Проверь список страниц.`,
          'success',
        );
      } catch (e) {
        console.error('Ошибка при создании страницы:', e);
        notify(e.message || String(e), 'error');
      }
    };

    const handleChangeGroup = async () => {
      try {
        await ensureLoaded();
        const { userId } = state;
        const targetGroupId = KS_CONFIG.targetGroupId;

        const { form, actionUrl } = await fetchAdminProfileForm(userId);
        const groupFieldName = detectGroupFieldName(form, targetGroupId);
        if (!groupFieldName) {
          throw new Error(
            'Не удалось найти поле выбора группы в форме админ-профиля.',
          );
        }

        const overrides = {
          [groupFieldName]: String(targetGroupId),
        };

        const params = buildParamsWithOverrides(form, overrides);
        await postForm(actionUrl, params, actionUrl);

        notify(
          `Пользователь переведён в группу ${targetGroupId}. Проверь админ-профиль.`,
          'success',
        );
      } catch (e) {
        console.error('Ошибка при смене группы:', e);
        notify(e.message || String(e), 'error');
      }
    };

    // --- Рендер кнопок ---
    const renderButtons = () => {
      const container = document.createElement('div');
      container.className = 'charpt-inline-controls';
      container.style.margin = '12px 0';
      container.style.display = 'flex';
      container.style.flexWrap = 'wrap';
      container.style.gap = '8px';

      const makeBtn = (text) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.className = 'button charpt-btn';
        b.style.padding = '4px 10px';
        b.style.cursor = 'pointer';
        return b;
      };

      const fillBtn = makeBtn(ui.fillProfileText || 'Заполнить поля');
      const pageBtn = makeBtn(ui.createPageText || 'Создать страницу');
      const groupBtn = makeBtn(ui.changeGroupText || 'Смена группы');

      fillBtn.addEventListener('click', handleFillProfile);
      pageBtn.addEventListener('click', handleCreatePage);
      groupBtn.addEventListener('click', handleChangeGroup);

      container.appendChild(fillBtn);
      container.appendChild(pageBtn);
      container.appendChild(groupBtn);

      // Куда вставлять
      const anchorSel =
        selectors.insertAfter || 'input.button.preview[name="preview"]';
      const anchor = document.querySelector(anchorSel);

      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(container, anchor.nextSibling);
      } else {
        const main = document.querySelector('#pun-main, #brd-main, main, body');
        (main || document.body).insertBefore(
          container,
          (main || document.body).firstChild,
        );
      }
    };

    renderButtons();
  };

  if (!helpers || !runOnceOnReady) {
    console.error('helpers.js не найден или не инициализирован.');
    return;
  }

  runOnceOnReady(start);
})();

