(() => {
  'use strict';

  const helpers = window.helpers || {};
  const getConfig =
    typeof helpers.getConfig === 'function' ? helpers.getConfig : () => ({});

  // ==== ЧИТАЕМ КОНФИГ charProfileTool ====
  const CHAR_CFG = getConfig('charProfileTool', {}) || {};
  const endpoints = CHAR_CFG.endpoints || {};
  const profileCfg = CHAR_CFG.profile || {};
  const fieldNames = profileCfg.fieldNames || {};

  const DEFAULT_PROFILE_FIELDS = {
    race: 'form[fld2]', // Вид
    title: 'form[fld1]', // Личное звание
    badge: 'form[fld3]', // Плашка
    money: 'form[fld4]', // Деньги
    posts: 'form[fld5]', // Игровые посты
  };

  const DEFAULT_ADMIN_PAGE_TEMPLATE = `
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
</div>`.trim();

  const KS_CONFIG = {
    apiBase: endpoints.apiBase || '/api.php',

    profileUrl:
      typeof endpoints.profileUrl === 'function'
        ? endpoints.profileUrl
        : (uid) => `/profile.php?section=fields&id=${encodeURIComponent(uid)}`,

    profileFormSelector:
      endpoints.profileFormSelector ||
      'form[action*="profile.php"][method="post"]',

    profileFields: {
      race: fieldNames.race || DEFAULT_PROFILE_FIELDS.race,
      title: fieldNames.title || DEFAULT_PROFILE_FIELDS.title,
      badge: fieldNames.badge || DEFAULT_PROFILE_FIELDS.badge,
      money: fieldNames.money || DEFAULT_PROFILE_FIELDS.money,
      posts: fieldNames.posts || DEFAULT_PROFILE_FIELDS.posts,
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

    adminAddPageUrl:
      endpoints.adminAddPageUrl || '/admin_pages.php?action=adddel',

    adminAddPageFormSelector:
      endpoints.adminAddPageFormSelector ||
      'form[action*="admin_pages.php"][method="post"], form#addpage',

    adminPageTemplate:
      typeof CHAR_CFG.adminPageTemplate === 'string'
        ? CHAR_CFG.adminPageTemplate.trim()
        : DEFAULT_ADMIN_PAGE_TEMPLATE,

    requestTimeoutMs:
      typeof CHAR_CFG.requestTimeoutMs === 'number'
        ? CHAR_CFG.requestTimeoutMs
        : 15000,
  };

  const parseHTML =
    typeof helpers.parseHTML === 'function'
      ? helpers.parseHTML
      : (html) => {
          const d = document.implementation.createHTMLDocument('');
          d.body.innerHTML = String(html || '');
          return d;
        };

  const initCharProfileToolPage = () => {
    const state = {
      userId: null,
      pageSlug: null,
    };

    const getFieldsBtn = document.getElementById('ks-get-fields');
    if (!getFieldsBtn) {
      return;
    }

    const outputFields = document.getElementById('ks-output-fields');
    const characterUrlInput = document.getElementById('ks-character-url');
    const lzHtmlInput = document.getElementById('ks-lz-html');
    const loadingEl = document.getElementById('ks-loading');
    const errorEl = document.getElementById('ks-error');
    const warningEl = document.getElementById('ks-warning');
    const manualUserIdEl = document.getElementById('ks-manual-user-id');
    const manualUserIdInput = document.getElementById(
      'ks-manual-user-id-input',
    );
    const fillProfileBtn = document.getElementById('ks-fill-profile');
    const createPageBtn = document.getElementById('ks-create-page');

    const textFrom = (el) =>
      String((el && (el.textContent || el.innerText)) || '').trim();

    const htmlToDom = (html) => parseHTML(html);

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

    const fetchWithTimeout = (url, options = {}) => {
      const controller = new AbortController();
      const id = setTimeout(
        () => controller.abort(),
        KS_CONFIG.requestTimeoutMs,
      );
      const opts = { ...options, signal: controller.signal };
      return fetch(toAbsUrl(url), opts).finally(() => clearTimeout(id));
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

      const hasAny = nameRu || nameEn || age !== null || race;

      if (!hasAny) return null;

      return {
        name: nameRu || '',
        name_en: nameEn || '',
        age,
        race: race || '',
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

    const getTopicIdFromUrl = (url) => {
      const match = url.match(/viewtopic\.php\?id=(\d+)/);
      return match ? match[1] : null;
    };

    const pickFirstPost = (posts) => {
      if (!Array.isArray(posts) || !posts.length) return null;
      const sorted = [...posts].sort((a, b) => Number(a.id) - Number(b.id));
      return sorted[0] || null;
    };

    const showLoading = (show) => {
      if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
      getFieldsBtn.disabled = show;
      if (fillProfileBtn) fillProfileBtn.disabled = show;
      if (createPageBtn) createPageBtn.disabled = show;
    };

    const showError = (message) => {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      hideWarning();
    };

    const showWarning = (message) => {
      if (!warningEl) return;
      warningEl.textContent = message;
      warningEl.style.display = 'block';
    };

    const hideError = () => {
      if (!errorEl) return;
      errorEl.style.display = 'none';
    };

    const hideWarning = () => {
      if (!warningEl) return;
      warningEl.style.display = 'none';
    };

    const getPostsForTopic = async (topicId) => {
      const url = `${
        KS_CONFIG.apiBase
      }?method=post.get&topic_id=${encodeURIComponent(
        topicId,
      )}&fields=id,topic_id,message,username,link&limit=100`;

      try {
        const response = await fetchWithTimeout(url, {
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

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
      if (!username) {
        console.warn('Не указано имя пользователя для поиска user_id');
        return null;
      }

      const encodedUsername = encodeURIComponent(username.trim());
      const url = `${KS_CONFIG.apiBase}?method=users.get&username=${encodedUsername}&fields=user_id`;

      try {
        const response = await fetchWithTimeout(url, {
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (
          data &&
          data.response &&
          data.response.users &&
          data.response.users.length > 0
        ) {
          return data.response.users[0].user_id;
        }
        console.warn('Пользователь не найден:', username);
        return null;
      } catch (error) {
        console.error('Ошибка при загрузке user_id:', error);
        return null;
      }
    };

    const findUserId = async (characterData, firstPost) => {
      let userId = null;
      let foundBy = '';

      if (characterData.name_en) {
        userId = await getUserIdByUsername(characterData.name_en);
        if (userId) {
          foundBy = `английскому имени "${characterData.name_en}"`;
          return { userId, foundBy };
        }
      }

      if (characterData.name) {
        userId = await getUserIdByUsername(characterData.name);
        if (userId) {
          foundBy = `русскому имени "${characterData.name}"`;
          return { userId, foundBy };
        }
      }

      if (firstPost.username) {
        userId = await getUserIdByUsername(firstPost.username);
        if (userId) {
          foundBy = `имени автора поста "${firstPost.username}"`;
          return { userId, foundBy };
        }
      }

      if (characterData.name_en) {
        const firstName = characterData.name_en.split(' ')[0];
        if (firstName && firstName !== characterData.name_en) {
          userId = await getUserIdByUsername(firstName);
          if (userId) {
            foundBy = `имени "${firstName}" (первая часть английского имени)`;
            return { userId, foundBy };
          }
        }
      }

      return { userId: null, foundBy: '' };
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
      const response = await fetchWithTimeout(url, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(
          `Не удалось загрузить профиль (HTTP ${response.status})`,
        );
      }
      const html = await response.text();
      const doc = htmlToDom(html);
      const form =
        doc.querySelector(KS_CONFIG.profileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) {
        throw new Error('Форма профиля не найдена в HTML профиля.');
      }
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAddPageForm = async () => {
      const url = toAbsUrl(KS_CONFIG.adminAddPageUrl);
      const response = await fetchWithTimeout(url, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(
          `Не удалось загрузить форму создания страницы (HTTP ${response.status})`,
        );
      }
      const html = await response.text();
      const doc = htmlToDom(html);
      const form =
        doc.querySelector(KS_CONFIG.adminAddPageFormSelector) ||
        doc.querySelector('form#addpage');
      if (!form) {
        throw new Error('Форма создания страницы не найдена в HTML админки.');
      }
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const buildProfileParams = (form, overrideMap) => {
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

    const buildAddPageParams = (form, overrideMap) => {
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

        if (overrideNames.has(el.name)) {
          const raw = overrideMap[el.name];
          const val = encodeNonAscii(raw ?? '');
          params.set(el.name, val);
          continue;
        }

        if ((type === 'checkbox' || type === 'radio') && el.checked) {
          params.append(el.name, el.value ?? '1');
          continue;
        }

        if (
          el.name === 'title' ||
          el.name === 'name' ||
          el.name === 'content' ||
          el.name === 'tags'
        ) {
          params.set(el.name, el.value ?? '');
          continue;
        }

        params.append(el.name, el.value ?? '');
      }

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
      const response = await fetchWithTimeout(finalUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        referrer: ref,
      });
      if (!response.ok) {
        throw new Error(`Ошибка при сохранении (HTTP ${response.status})`);
      }
      return response;
    };

    getFieldsBtn.addEventListener('click', async () => {
      const characterUrl = characterUrlInput.value.trim();
      const lzHtml = lzHtmlInput.value.trim();
      const manualUserId = manualUserIdInput.value.trim();

      if (!characterUrl) {
        showError('Введите ссылку на анкету персонажа');
        return;
      }

      if (!lzHtml) {
        showError('Введите HTML текст для личного звания');
        return;
      }

      if (!characterUrl.includes('kindredspirits.ru/viewtopic.php')) {
        showError('Ссылка должна вести на тему форума Kindred Spirits');
        return;
      }

      try {
        showLoading(true);
        hideError();
        hideWarning();

        const topicId = getTopicIdFromUrl(characterUrl);
        if (!topicId) {
          throw new Error('Не удалось извлечь ID темы из ссылки');
        }

        const posts = await getPostsForTopic(topicId);
        if (!posts.length) {
          throw new Error('В теме нет постов или тема не найдена');
        }

        const firstPost = pickFirstPost(posts);
        if (!firstPost) {
          throw new Error('Не удалось найти первый пост в теме');
        }

        const characterData = parseProfileFromHtml(firstPost.message);
        if (!characterData) {
          throw new Error(
            'Не удалось распознать анкету персонажа. Убедитесь, что ссылка ведет на анкету с корректно оформленными BB-кодами.',
          );
        }

        if (!characterData.name) {
          throw new Error('Не найдено имя персонажа (BB-код [charname])');
        }

        if (!characterData.name_en) {
          throw new Error(
            'Не найдено английское имя персонажа (BB-код [charnameen])',
          );
        }

        if (!characterData.age) {
          throw new Error('Не найден возраст персонажа (BB-код [charage])');
        }

        if (!characterData.race) {
          throw new Error('Не найдена раса персонажа (BB-код [charrace])');
        }

        const { userId: autoUserId, foundBy } = await findUserId(
          characterData,
          firstPost,
        );

        let userId;
        if (autoUserId) {
          userId = autoUserId;
          showWarning(`user_id найден автоматически по ${foundBy}`);
          if (manualUserIdEl) manualUserIdEl.style.display = 'none';
        } else {
          userId = manualUserId || '2';
          showWarning(
            `Не удалось найти user_id автоматически. Использовано значение: ${userId}`,
          );
          if (manualUserIdEl) manualUserIdEl.style.display = 'block';
        }

        state.userId = userId;

        const slug = generateFileName(characterData.name_en);
        state.pageSlug = slug;

        const raceLetter = getRaceLetter(characterData.race);

        const raceField = `<div title="${characterData.race}">${raceLetter}</div>`;
        const lzField = `<div class="lz-name"><a href="${characterUrl}">${characterData.name}</a>, ${characterData.age}</div> <div class="lz-text">${lzHtml}</div>`;
        const plahField = `<pers-plah class="modal-link" id="${slug}" data-user-id="${userId}" role="button" tabindex="0" style="cursor:pointer"><div class="pers-plah"><em class="pers-plah-text"> Two bodies, one soul </em></div></pers-plah>`;

        document.getElementById('ks-output-race').value = raceField;
        document.getElementById('ks-output-lz').value = lzField;
        document.getElementById('ks-output-plah').value = plahField;

        if (outputFields) outputFields.style.display = 'grid';
        if (fillProfileBtn) fillProfileBtn.style.display = 'inline-block';
        if (createPageBtn) createPageBtn.style.display = 'inline-block';
      } catch (error) {
        console.error('Ошибка при получении данных:', error);
        showError(
          error.message ||
            'Произошла ошибка при получении данных. Проверьте ссылку и попробуйте снова.',
        );
      } finally {
        showLoading(false);
      }
    });

    if (fillProfileBtn) {
      fillProfileBtn.addEventListener('click', async () => {
        try {
          hideError();
          hideWarning();

          const userId = state.userId || manualUserIdInput.value.trim();
          if (!userId) {
            throw new Error(
              'user_id не определён. Сначала получите поля или укажите user_id вручную.',
            );
          }

          const raceValue = document
            .getElementById('ks-output-race')
            .value.trim();
          const lzValue = document.getElementById('ks-output-lz').value.trim();
          const plahValue = document
            .getElementById('ks-output-plah')
            .value.trim();

          if (!raceValue || !lzValue || !plahValue) {
            throw new Error(
              'Сначала нажмите «Получить поля», чтобы сгенерировать данные.',
            );
          }

          showLoading(true);

          const { form, actionUrl } = await fetchProfileForm(userId);

          const overrides = {
            [KS_CONFIG.profileFields.race]: raceValue,
            [KS_CONFIG.profileFields.title]: lzValue,
            [KS_CONFIG.profileFields.badge]: plahValue,
            [KS_CONFIG.profileFields.money]: KS_CONFIG.defaultValues.money,
            [KS_CONFIG.profileFields.posts]: KS_CONFIG.defaultValues.posts,
          };

          const params = buildProfileParams(form, overrides);
          await postForm(actionUrl, params, actionUrl);

          showWarning(
            'Профиль обновлён. Проверьте вкладку «Дополнительно» в профиле пользователя.',
          );
        } catch (err) {
          console.error('Ошибка при заполнении профиля:', err);
          showError(err.message || String(err));
        } finally {
          showLoading(false);
        }
      });
    }

    if (createPageBtn) {
      createPageBtn.addEventListener('click', async () => {
        try {
          hideError();
          hideWarning();

          const slug = state.pageSlug;
          if (!slug) {
            throw new Error(
              'Slug страницы не определён. Сначала нажмите «Получить поля».',
            );
          }

          showLoading(true);

          const { form, actionUrl } = await fetchAddPageForm();

          const overrides = {
            title: slug,
            name: slug,
            content: KS_CONFIG.adminPageTemplate,
          };

          const params = buildAddPageParams(form, overrides);
          await postForm(actionUrl, params, actionUrl);

          showWarning(
            `Страница "${slug}" создана. Проверьте список страниц в админке.`,
          );
        } catch (err) {
          console.error('Ошибка при создании страницы:', err);
          showError(err.message || String(err));
        } finally {
          showLoading(false);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target || !target.classList) return;
      if (!target.classList.contains('ks-copy-btn')) return;

      const targetId = target.getAttribute('data-target');
      const textarea = document.getElementById(targetId);

      if (textarea) {
        textarea.select();
        document.execCommand('copy');

        const originalText = target.textContent;
        target.textContent = 'Скопировано!';
        setTimeout(() => {
          target.textContent = originalText;
        }, 2000);
      }
    });
  };

  const start = () => {
    try {
      initCharProfileToolPage();
    } catch (err) {
      console.error('Ошибка инициализации charProfileTool-page:', err);
    }
  };

  if (helpers && typeof helpers.runOnceOnReady === 'function') {
    helpers.runOnceOnReady(start);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
