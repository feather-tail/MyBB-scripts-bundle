(() => {
  'use strict';

  function bootstrap() {
    const helpers = window.helpers;
    if (!helpers) {
      setTimeout(bootstrap, 25);
      return;
    }

    const {
      $,
      $$,
      parseHTML,
      withTimeout,
      getForumId,
      getGroupId,
      showToast,
      runOnceOnReady,
      getConfig,
    } = helpers;

    const config = getConfig('charProfileTool', {
      access: {
        allowedForumIds: [8, 9],
        allowedGroupIds: [1],
      },
      selectors: {
        insertAfter: 'input.button.preview[name="preview"]',
        lzSource: '.custom_tag_charpt, .char-pt, [data-bbcode="charpt"]',
      },
      ui: {
        fillProfileText: 'Автозаполнить профиль',
        createPageText: 'Создать страницу',
        changeGroupText: 'Перевести в группу',
      },
      profile: {
        moneyDefault: '40',
        postsDefault: '0',
        targetGroupId: 6,
        fieldNames: {
          race: 'form[fld2]',
          title: 'form[fld1]',
          badge: 'form[fld3]',
          money: 'form[fld4]',
          posts: 'form[fld5]',
        },
      },
      endpoints: {
        apiBase: '/api.php',
        profileUrl: (uid) => `/profile.php?section=fields&id=${uid}`,
        profileFormSelector: 'form[action*="profile.php"][method="post"]',
        adminProfileUrl: (uid) => `/profile.php?section=admin&id=${uid}`,
        adminProfileFormSelector:
          'form[action*="profile.php"][method="post"], form[id^="profile"]',
        adminAddPageUrl: '/admin_pages.php?action=adddel',
        adminAddPageFormSelector:
          'form[action*="admin_pages.php"][method="post"], form#addpage',
      },
      requestTimeoutMs: 15000,
    });

    const LABEL_FILL =
      (config.ui && config.ui.fillProfileText) || 'Автозаполнить профиль';
    const LABEL_CREATE_PAGE =
      (config.ui && config.ui.createPageText) || 'Создать страницу';
    const LABEL_CHANGE_GROUP =
      (config.ui && config.ui.changeGroupText) || 'Перевести в группу';

    const escapeHtml = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const buildPageTemplate = (ctx) => {
      const uid = Number(ctx?.userId) || 0;
      const nameEnRaw = String(ctx?.characterData?.name_en || '').trim();
      const nameEn = escapeHtml(ctx?.characterData?.name_en || '');
      const pairNameRaw = (ctx?.characterData?.pair_name || '').trim();
      const pairName = escapeHtml(pairNameRaw || 'Неизвестно');
      const roleRaw = String(ctx?.characterData?.role || '').trim();
      const role = escapeHtml(roleRaw || '');

      return `
<div class="character"
  data-user-id="${uid}"
  data-link-level="0"
  data-link-max="10"
  data-taint-level="0"
  data-taint-max="10"
>
  <div class="cm-shell" role="dialog" aria-modal="true" aria-labelledby="cm-title-left">
    <button class="cm-close" type="button" data-modal-close aria-label="Закрыть">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>

    <header class="cm-header">
      <div class="cm-side cm-side--left">
        <div class="cm-avatar">
          <img src="https://placehold.co/200x250" alt="Аватар персонажа" loading="lazy" decoding="async" />
        </div>
        <div class="cm-side__meta">
          <div class="cm-name" id="cm-title-left">${nameEn}</div>
          <div class="cm-role">${role}</div>
        </div>
      </div>

      <div class="cm-center">
        <div class="cm-bars">
          <div class="cm-barrow" data-meter="link">
            <div class="cm-barrow__top">
              <span class="cm-barrow__label">Связь</span>
              <span class="cm-barrow__value" data-meter-value>0 ур.</span>
            </div>
            <div class="cm-bar" role="img" aria-label="Связь">
              <span class="cm-bar__fill"></span>
            </div>
          </div>

          <div class="cm-barrow" data-meter="taint">
            <div class="cm-barrow__top">
              <span class="cm-barrow__label">Скверна</span>
              <span class="cm-barrow__value" data-meter-value>0 ур.</span>
            </div>
            <div class="cm-bar" role="img" aria-label="Скверна">
              <span class="cm-bar__fill"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="cm-side cm-side--right">
        <div class="cm-avatar">
          <img src="https://placehold.co/200x250" alt="Аватар родственной души" loading="lazy" decoding="async" />
        </div>
        <div class="cm-side__meta cm-side__meta--right">
          <a class="cm-name cm-link" href="#" title="Открыть профиль души" id="cm-title-right">${pairName}</a>
          <div class="cm-role">Род деятельности</div>
        </div>
      </div>
    </header>

    <nav class="modal__tabs" role="tablist" aria-label="Вкладки персонажа">
      <button class="modal__tab active" type="button" data-cm-tab="gift" role="tab" aria-selected="true" aria-controls="cm-pane-gift" id="cm-tab-gift" title="Дар">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <span class="cm-sr">Дар</span>
      </button>

      <button class="modal__tab" type="button" data-cm-tab="inventory" role="tab" aria-selected="false" aria-controls="cm-pane-inventory" id="cm-tab-inventory" title="Инвентарь">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        <span class="cm-sr">Инвентарь</span>
      </button>

      <button class="modal__tab" type="button" data-cm-tab="gifts" role="tab" aria-selected="false" aria-controls="cm-pane-gifts" id="cm-tab-gifts" title="Подарки">
        <i class="fa-solid fa-gift" aria-hidden="true"></i>
        <span class="cm-sr">Подарки</span>
      </button>

      <button class="modal__tab" type="button" data-cm-tab="ach" role="tab" aria-selected="false" aria-controls="cm-pane-ach" id="cm-tab-ach" title="Достижения">
        <i class="fa-solid fa-trophy" aria-hidden="true"></i>
        <span class="cm-sr">Достижения</span>
      </button>

      <button class="modal__tab" type="button" data-cm-tab="appearance" role="tab" aria-selected="false" aria-controls="cm-pane-appearance" id="cm-tab-appearance" title="Оформление">
        <i class="fa-solid fa-palette" aria-hidden="true"></i>
        <span class="cm-sr">Оформление</span>
      </button>
    </nav>

    <div class="cm-scroll" data-cm-scroll>
      <section class="modal__content active" data-cm-content="gift" role="tabpanel" aria-labelledby="cm-tab-gift" id="cm-pane-gift" tabindex="0">
        <div class="cm-pane">
          <div class="cm-gift">
            <div class="cm-gift__media">
              <img src="https://placehold.co/800x500" alt="Изображение дара" loading="lazy" decoding="async" />
            </div>

            <div class="cm-gift__text">
              <h3 class="cm-h3">Описание дара</h3>
              <p class="cm-p"></p>

              <div class="cm-chips"></div>

              <ul class="cm-list"></ul>
            </div>
          </div>

          <details class="cm-details">
            <summary>Детали применения</summary>
            <div class="cm-details__body">
              <p class="cm-p"></p>
            </div>
          </details>

          <details class="cm-details">
            <summary>Риски и побочные эффекты</summary>
            <div class="cm-details__body">
              <p class="cm-p"></p>
            </div>
          </details>
        </div>
      </section>

      <section class="modal__content" data-cm-content="inventory" role="tabpanel" aria-labelledby="cm-tab-inventory" id="cm-pane-inventory" tabindex="0">
        <div class="cm-pane" data-inventory>
          <div class="cm-toolbar">
            <input class="cm-input" type="search" placeholder="Поиск по инвентарю…" data-inv-search />
            <div class="cm-toolbar__right">
              <button class="cm-btn cm-btn--icon" type="button" data-filters-toggle aria-expanded="false" aria-label="Фильтры">
                <i class="fa-solid fa-filter" aria-hidden="true"></i>
              </button>

              <div class="cm-filters" hidden data-filters-panel>
                <div class="cm-filters__title">Фильтры</div>
                <label class="cm-check">
                  <input type="checkbox" value="Расходники" data-filter />
                  <span>Расходники</span>
                </label>
                <label class="cm-check">
                  <input type="checkbox" value="Артефакты" data-filter />
                  <span>Артефакты</span>
                </label>
                <label class="cm-check">
                  <input type="checkbox" value="Квестовые" data-filter />
                  <span>Квестовые</span>
                </label>

                <div class="cm-filters__actions">
                  <button class="cm-btn cm-btn--ghost" type="button" data-filters-clear>Сбросить</button>
                  <button class="cm-btn" type="button" data-filters-close>Закрыть</button>
                </div>
              </div>
            </div>
          </div>

          <div class="cm-two">
            <div class="cm-slots" data-slots="inventory" role="grid" aria-label="Инвентарь"></div>

            <aside class="cm-infobox is-empty" data-info="inventory">
              <div class="cm-infobox__title">Информация</div>
              <div class="cm-infobox__body">
                <div class="cm-infobox__img">
                  <img alt="" data-info-img loading="lazy" decoding="async" />
                </div>
                <div class="cm-infobox__text">
                  <div class="cm-infobox__name" data-info-name></div>
                  <div class="cm-infobox__meta" data-info-cat></div>
                  <div class="cm-infobox__desc" data-info-desc></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section class="modal__content" data-cm-content="gifts" role="tabpanel" aria-labelledby="cm-tab-gifts" id="cm-pane-gifts" tabindex="0">
        <div class="cm-pane" data-gifts>
          <div class="cm-toolbar">
            <div class="cm-muted" data-gifts-status></div>
          </div>

          <div class="cm-two">
            <div class="cm-slots" data-gifts-root role="grid" aria-label="Подарки"></div>

            <aside class="cm-infobox is-empty" data-info="gifts" data-kind="gift">
              <div class="cm-infobox__title">Информация</div>
              <div class="cm-infobox__body">
                <div class="cm-infobox__img">
                  <img alt="" data-info-img loading="lazy" decoding="async" />
                </div>
                <div class="cm-infobox__text">
                  <div class="cm-infobox__name" data-info-name></div>
                  <div class="cm-infobox__meta" data-info-cat></div>
                  <div class="cm-infobox__desc" data-info-desc></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section class="modal__content" data-cm-content="ach" role="tabpanel" aria-labelledby="cm-tab-ach" id="cm-pane-ach" tabindex="0">
        <div class="cm-pane" data-ach>
          <div class="cm-two">
            <div>
              <h3 class="cm-h3">Достижения игрока</h3>
              <div class="cm-slots" data-slots="player-ach" role="grid" aria-label="Достижения игрока"></div>

              <h3 class="cm-h3 cm-mt">Достижения персонажа</h3>
              <div class="cm-slots" data-slots="char-ach" role="grid" aria-label="Достижения персонажа"></div>
            </div>

            <aside class="cm-infobox is-empty" data-info="ach">
              <div class="cm-infobox__title">Информация</div>
              <div class="cm-infobox__body">
                <div class="cm-infobox__img">
                  <img alt="" data-info-img loading="lazy" decoding="async" />
                </div>
                <div class="cm-infobox__text">
                  <div class="cm-infobox__name" data-info-name></div>
                  <div class="cm-infobox__meta" data-info-cat></div>
                  <div class="cm-infobox__desc" data-info-desc></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section class="modal__content" data-cm-content="appearance" role="tabpanel" aria-labelledby="cm-tab-appearance" id="cm-pane-appearance" tabindex="0">
        <div class="cm-pane">
          <div class="cm-appearance">
            <section class="cm-frame">
              <div class="cm-frame__head">
                <h3 class="cm-h3">Иконки</h3>
              </div>
              <div class="cm-frame__body">
                <div class="cm-icons"></div>
              </div>
            </section>

            <section class="cm-frame">
              <div class="cm-frame__head">
                <h3 class="cm-h3">Плашки</h3>
              </div>
              <div class="cm-frame__body">
                <div class="cm-plates"></div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
      `.trim();
    };

    // ================== STATE ==================

    const state = {
      busy: false,
      context: null,
    };

    const notify = (message, type = 'info') => {
      if (typeof showToast === 'function') {
        showToast(message, { type });
      } else {
        console.log(`[${type}] ${message}`);
      }
    };

    const toAbsUrl = (url) => {
      if (!url) return url;
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith('/')) return url;
      return '/' + String(url).replace(/^\/+/, '');
    };

    const fetchJson = (url) =>
      withTimeout(
        fetch(toAbsUrl(url), { credentials: 'same-origin' }),
        config.requestTimeoutMs,
      ).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    const fetchDoc = async (url) => {
      const res = await withTimeout(
        fetch(toAbsUrl(url), { credentials: 'same-origin' }),
        config.requestTimeoutMs,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      return parseHTML(html);
    };

    const postForm = async (url, params, refUrl) => {
      const finalUrl = toAbsUrl(url);
      const ref = refUrl ? toAbsUrl(refUrl) : finalUrl;
      const res = await withTimeout(
        fetch(finalUrl, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          referrer: ref,
        }),
        config.requestTimeoutMs,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    };

    const encodeNonAscii = (s) =>
      String(s).replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);

    const toIntOrNull = (s) => {
      const n = parseInt(String(s || '').replace(/[^\d\-]/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    };

    const getTopicIdFromUrl = (url) => {
      const m = String(url).match(/viewtopic\.php\?id=(\d+)/);
      return m ? m[1] : null;
    };

    const textFrom = (el) =>
      String((el && (el.textContent || el.innerText)) || '').trim();

    const decodeHtmlEntities = (str) => {
      if (!str) return '';
      let out = String(str);

      out = out.replace(/&#(\d+);/g, (_, num) =>
        String.fromCharCode(Number(num) || 0),
      );

      out = out
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, '&');

      return out;
    };

    const parseProfileFromHtml = (html) => {
      if (!html) return null;
      const doc = parseHTML(html);

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

      const pairName = textFrom(
        doc.querySelector(
          '.custom_tag_charpair.char-pair, .custom_tag_charpair',
        ),
      );

      const role = textFrom(
        doc.querySelector(
          '.custom_tag_charrole.char-role, .custom_tag_charrole',
        ),
      );

      const hasAny = nameRu || nameEn || age !== null || race || pairName;
      if (!hasAny) return null;

      return {
        name: nameRu || '',
        name_en: nameEn || '',
        age,
        race: race || '',
        pair_name: pairName || '',
        role: role || '',
      };
    };

    const parseLzHtmlFromHtml = (html) => {
      if (!html) return '';
      const doc = parseHTML(html);
      const node = doc.querySelector(config.selectors.lzSource);
      if (!node) return '';
      const raw = node.innerHTML.trim();
      return decodeHtmlEntities(raw);
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

    const pickFirstPost = (posts) => {
      if (!Array.isArray(posts) || !posts.length) return null;
      const sorted = [...posts].sort((a, b) => Number(a.id) - Number(b.id));
      return sorted[0] || null;
    };

    const getPostsForTopic = async (topicId) => {
      const url = `${
        config.endpoints.apiBase
      }?method=post.get&topic_id=${encodeURIComponent(
        topicId,
      )}&fields=id,topic_id,message,username,link&limit=100`;
      const data = await fetchJson(url);
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
    };

    const getUserIdByUsername = async (username) => {
      if (!username) return null;
      const encoded = encodeURIComponent(username.trim());
      const url = `${config.endpoints.apiBase}?method=users.get&username=${encoded}&fields=user_id`;
      const data = await fetchJson(url);
      if (
        data &&
        data.response &&
        Array.isArray(data.response.users) &&
        data.response.users.length > 0
      ) {
        return data.response.users[0].user_id;
      }
      return null;
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
        'input[name="update"],input[name="submit"],input[name="save"],input[name="add_page"],input[name="update_group_membership"]',
      );
      if (x) return { name: x.name, value: x.value || '1' };
      return null;
    };

    const fetchProfileForm = async (userId) => {
      const url = config.endpoints.profileUrl(userId);
      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.profileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) throw new Error('Форма профиля не найдена в HTML профиля.');
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAdminProfileForm = async (userId) => {
      let url;
      if (
        config.endpoints &&
        typeof config.endpoints.adminProfileUrl === 'function'
      ) {
        url = config.endpoints.adminProfileUrl(userId);
      } else {
        url = `/profile.php?section=admin&id=${encodeURIComponent(userId)}`;
      }

      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.adminProfileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) {
        throw new Error(
          'Форма управления пользователем (группы) не найдена в профиле.',
        );
      }
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const tryUpdateExistingPage = async (pageSlug, newHtml) => {
      if (!config.endpoints || typeof config.endpoints.adminEditPageUrl !== 'function') {
        return false;
      }
    
      const editUrl = config.endpoints.adminEditPageUrl(pageSlug);
    
      let doc;
      try {
        doc = await fetchDoc(editUrl);
      } catch (e) {
        const msg = String(e?.message || e || '');
        if (msg.includes('HTTP 404')) return false;
        throw e;
      }
    
      const form =
        doc.querySelector('form[action*="admin_pages.php"][method="post"]') ||
        doc.querySelector('form');
    
      if (!form) return false;
    
      const actionRaw = form.getAttribute('action') || editUrl;
      const actionUrl = toAbsUrl(actionRaw);
    
      const contentEl =
        form.querySelector('textarea[name="content"]') ||
        form.querySelector('textarea[name="text"]') ||
        form.querySelector('textarea[name="message"]') ||
        form.querySelector('textarea[name]');
    
      if (!contentEl || !contentEl.name) return false;
    
      const overrides = {
        [contentEl.name]: newHtml,
      };
    
      const tagsEl = form.querySelector('input[name="tags"], textarea[name="tags"]');
      if (tagsEl && tagsEl.name) {
        const t = String(tagsEl.value || '').trim();
        if (t.toLowerCase() === 'character') {
          overrides[tagsEl.name] = '';
        }
      }
    
      const params = buildAddPageParams(form, overrides);
      await postForm(actionUrl, params, editUrl);
    
      return true;
    };

    const fetchAddPageForm = async () => {
      const url = config.endpoints.adminAddPageUrl;
      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.adminAddPageFormSelector) ||
        doc.querySelector('form#addpage');
      if (!form) {
        throw new Error('Форма создания страницы не найдена в HTML админки.');
      }
      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const findExistingPageEditHref = async (pageSlug) => {
      const doc = await fetchDoc(config.endpoints.adminAddPageUrl);

      const slug = String(pageSlug || '')
        .trim()
        .toLowerCase();
      if (!slug) return null;

      const links = Array.from(
        doc.querySelectorAll('a[href*="admin_pages.php"][href*="action=edit"]'),
      );

      for (const a of links) {
        const href = a.getAttribute('href');
        if (!href) continue;

        const row = a.closest('tr') || a.closest('li') || a.parentElement;
        const hay = String(row ? row.textContent : a.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        if (hay.includes(slug)) {
          return href;
        }
      }

      return null;
    };

    const fetchEditPageForm = async (editHref) => {
      const url = toAbsUrl(editHref);
      const doc = await fetchDoc(url);

      const form =
        doc.querySelector('form[action*="admin_pages.php"][method="post"]') ||
        doc.querySelector('form');

      if (!form) {
        throw new Error(
          'Форма редактирования страницы не найдена в HTML админки.',
        );
      }

      const actionRaw = form.getAttribute('action') || url;
      const actionUrl = toAbsUrl(actionRaw);

      return { form, actionUrl, editUrl: url };
    };

    const buildProfileParams = (form, overrideMap) => {
      const params = new URLSearchParams();
      const isHidden = (el) =>
        el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'hidden';

      const overrideNames = new Set(Object.keys(overrideMap || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;
        const type = (el.type || '').toLowerCase();

        if (type === 'submit') {
          continue;
        }

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

        params.append(el.name, el.value ?? '');
      }

      if (!params.has('form_sent')) params.set('form_sent', '1');

      overrideNames.forEach((name) => {
        const raw = overrideMap[name];
        const val = encodeNonAscii(raw ?? '');
        params.set(name, val);
      });


      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, submit.value);
      console.log(
  'fld4 inputs:',
  [...form.querySelectorAll('[name="form[fld4]"]')].map(el => ({
    tag: el.tagName,
    type: (el.type || '').toLowerCase(),
    value: el.value
  }))
);

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

        if (type === 'submit') {
          continue;
        }

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

        if (
          el.name === 'title' ||
          el.name === 'name' ||
          el.name === 'content' ||
          el.name === 'tags'
        ) {
          params.set(el.name, el.value ?? '');
          continue;
        }

        if (type === "checkbox" || type === "radio") {
          if (el.checked) params.append(el.name, el.value ?? "1");
          continue;
        }
        
        params.append(el.name, el.value ?? "");
      }

      overrideNames.forEach((name) => {
        if (!params.has(name)) {
          const raw = overrideMap[name];
          const val = encodeNonAscii(raw ?? '');
          params.set(name, val);
        }
      });

      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, submit.value);

      return params;
    };

    const ensureBasicContext = async () => {
      if (state.context) return state.context;

      const topicUrl = location.href.split('#')[0];
      const topicId = getTopicIdFromUrl(topicUrl);
      if (!topicId) {
        throw new Error('Не удалось определить ID темы из адреса.');
      }

      const posts = await getPostsForTopic(topicId);
      if (!posts.length) {
        throw new Error('В теме нет постов или тема не найдена.');
      }

      const firstPost = pickFirstPost(posts);
      if (!firstPost) {
        throw new Error('Не удалось найти первый пост в теме.');
      }

      const characterData = parseProfileFromHtml(firstPost.message);
      if (!characterData) {
        throw new Error(
          'Не удалось распознать анкету персонажа. Проверьте оформление BB-кодов.',
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

      const userId = await findUserId(characterData, firstPost);
      if (!userId) {
        throw new Error(
          'Не удалось определить user_id по имени персонажа. Проверьте пользователя в системе.',
        );
      }

      const pageSlug = generateFileName(characterData.name_en);

      state.context = {
        topicId,
        topicUrl,
        characterData,
        userId,
        firstPostHtml: firstPost.message,
        pageSlug,
      };

      return state.context;
    };

    const ensureFullContext = async ({ requireLz = true } = {}) => {
      const ctx = await ensureBasicContext();

      if (!ctx.lzHtml) {
        const lzHtml = parseLzHtmlFromHtml(ctx.firstPostHtml);

        if (!lzHtml && requireLz) {
          throw new Error(
            'Не найден HTML личного звания (BB-код [charpt]). Проверьте анкету.',
          );
        }

        ctx.lzHtml = lzHtml || '';
      }

      if (!ctx.pageSlug) {
        ctx.pageSlug = generateFileName(ctx.characterData.name_en);
      }

      return ctx;
    };

    const fillProfile = async () => {
      const ctx = await ensureFullContext();
      const { characterData, lzHtml, userId, topicUrl } = ctx;

      const raceLetter = getRaceLetter(characterData.race);
      const raceField = `<div title="${characterData.race}">${raceLetter}</div>`;
      const lzField = `<div class="lz-name"><a href="${topicUrl}">${characterData.name}</a>, ${characterData.age}</div> <div class="lz-text">${lzHtml}</div>`;
      const plahField = `<pers-plah class="modal-link" id="${ctx.pageSlug}" data-user-id="${userId}" role="button" tabindex="0" style="cursor:pointer"><div class="pers-plah"><em class="pers-plah-text"> Two bodies, one soul </em></div></pers-plah>`;

      const { fieldNames, moneyDefault, postsDefault } = config.profile;
      const { form, actionUrl } = await fetchProfileForm(userId);

      const overrides = {
        [fieldNames.race]: raceField,
        [fieldNames.title]: lzField,
        [fieldNames.badge]: plahField,
        [fieldNames.money]: moneyDefault,
        [fieldNames.posts]: postsDefault,
      };

      const params = buildProfileParams(form, overrides);
      await postForm(actionUrl, params, actionUrl);
    };

    const createOrUpdatePage = async () => {
      const ctx = await ensureFullContext({ requireLz: false });
      const { pageSlug } = ctx;
    
      const newContent = buildPageTemplate(ctx);
    
      const updated = await tryUpdateExistingPage(pageSlug, newContent);
      if (updated) return { mode: 'update' };
    
      const { form, actionUrl } = await fetchAddPageForm();
    
      const overrides = {
        title: pageSlug,
        name: pageSlug,
        content: newContent,
        tags: '',
      };
    
      const params = buildAddPageParams(form, overrides);
      await postForm(actionUrl, params, actionUrl);
    
      return { mode: 'create' };
    };

    const changeGroup = async () => {
      const ctx = await ensureBasicContext();
      const { userId } = ctx;
      const targetGroupId = String(config.profile.targetGroupId || 6);

      const { form, actionUrl } = await fetchAdminProfileForm(userId);

      const groupSelect = form.querySelector('select[name="group_id"]');
      if (!groupSelect) {
        throw new Error('Поле "group_id" не найдено в форме управления.');
      }

      const overrides = {
        group_id: targetGroupId,
      };

      const params = buildProfileParams(form, overrides);
      await postForm(actionUrl, params, actionUrl);
    };

    const handleFillProfileClick = async () => {
      if (state.busy) {
        notify('Уже выполняется другая операция, подождите.', 'error');
        return;
      }
      state.busy = true;
      try {
        await fillProfile();
        notify(
          'Профиль обновлён. Проверьте вкладку «Дополнительно».',
          'success',
        );
      } catch (err) {
        console.error('Ошибка при автозаполнении профиля:', err);
        notify(err.message || String(err), 'error');
      } finally {
        state.busy = false;
      }
    };

    const handleCreatePageClick = async () => {
      if (state.busy) {
        notify('Уже выполняется другая операция, подождите.', 'error');
        return;
      }
      state.busy = true;
      try {
        const r = await createOrUpdatePage();
        notify(
          r.mode === 'update'
            ? 'Страница персонажа обновлена (контент перезаписан).'
            : 'Страница персонажа создана. Проверьте список страниц.',
          'success',
        );
      } catch (err) {
        console.error('Ошибка при создании страницы:', err);
        notify(err.message || String(err), 'error');
      } finally {
        state.busy = false;
      }
    };

    const handleChangeGroupClick = async () => {
      if (state.busy) {
        notify('Уже выполняется другая операция, подождите.', 'error');
        return;
      }
      state.busy = true;
      try {
        await changeGroup();
        notify('Группа пользователя обновлена на «Одарённый».', 'success');
      } catch (err) {
        console.error('Ошибка при смене группы:', err);
        notify(err.message || String(err), 'error');
      } finally {
        state.busy = false;
      }
    };

    // --- Монтирование кнопок ---

    const mountButtons = () => {
      const targets = $$(config.selectors.insertAfter);
      targets.forEach((anchor) => {
        if (!anchor || anchor.dataset.charProfileToolMounted) return;
        anchor.dataset.charProfileToolMounted = '1';

        const btnFill = document.createElement('input');
        btnFill.type = 'button';
        btnFill.value = LABEL_FILL;
        btnFill.className = 'button ks-btn-fill-profile';

        const btnPage = document.createElement('input');
        btnPage.type = 'button';
        btnPage.value = LABEL_CREATE_PAGE;
        btnPage.className = 'button ks-btn-create-page';

        const btnGroup = document.createElement('input');
        btnGroup.type = 'button';
        btnGroup.value = LABEL_CHANGE_GROUP;
        btnGroup.className = 'button ks-btn-change-group';

        anchor.insertAdjacentElement('afterend', btnFill);
        btnFill.insertAdjacentElement('afterend', btnPage);
        btnPage.insertAdjacentElement('afterend', btnGroup);

        btnFill.addEventListener('click', handleFillProfileClick);
        btnPage.addEventListener('click', handleCreatePageClick);
        btnGroup.addEventListener('click', handleChangeGroupClick);
      });
    };

    const init = () => {
      const fid = getForumId();
      if (
        !fid ||
        !config.access.allowedForumIds
          .map((n) => Number(n))
          .includes(Number(fid))
      ) {
        return;
      }

      if (
        Array.isArray(config.access.allowedGroupIds) &&
        config.access.allowedGroupIds.length > 0
      ) {
        const gid = getGroupId();
        if (
          !config.access.allowedGroupIds
            .map((n) => Number(n))
            .includes(Number(gid))
        ) {
          return;
        }
      }

      mountButtons();

      const mo = new MutationObserver(() => mountButtons());
      mo.observe(document.body, { childList: true, subtree: true });
    };

    runOnceOnReady(init);
    if (helpers.register) helpers.register('charProfileTool', { init });
  }

  bootstrap();
})();

