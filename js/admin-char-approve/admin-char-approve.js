(() => {
  "use strict";

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

    const config = getConfig("charProfileTool", {
      access: {
        allowedForumIds: [8, 9],
        allowedGroupIds: [1],
      },
      selectors: {
        insertAfter: 'input.button.preview[name="preview"]',
        lzSource: '.custom_tag_charpt, .char-pt, [data-bbcode="charpt"]',
      },
      ui: {
        fillProfileText: "Автозаполнить профиль",
        createPageText: "Создать страницу",
        changeGroupText: "Перевести в группу",
      },
      profile: {
        moneyDefault: "0",
        postsDefault: "0",
        targetGroupId: 6,
        fieldNames: {
          race: "form[fld2]",
          title: "form[fld1]",
          badge: "form[fld3]",
          money: "form[fld4]",
          posts: "form[fld5]",
        },
      },
      endpoints: {
        apiBase: "/api.php",
        profileUrl: (uid) => `/profile.php?section=fields&id=${uid}`,
        profileFormSelector: 'form[action*="profile.php"][method="post"]',
        adminProfileUrl: (uid) => `/profile.php?section=admin&id=${uid}`,
        adminProfileFormSelector:
          'form[action*="profile.php"][method="post"], form[id^="profile"]',
        adminAddPageUrl: "/admin_pages.php?action=adddel",
        adminAddPageFormSelector:
          'form[action*="admin_pages.php"][method="post"], form#addpage',
        adminEditPageUrl: (slug) =>
          `/admin_pages.php?edit_page=${encodeURIComponent(String(slug || "").trim())}`,
      },
      requestTimeoutMs: 15000,
    });

    const LABEL_FILL =
      (config.ui && config.ui.fillProfileText) || "Автозаполнить профиль";
    const LABEL_CREATE_PAGE =
      (config.ui && config.ui.createPageText) || "Создать страницу";
    const LABEL_CHANGE_GROUP =
      (config.ui && config.ui.changeGroupText) || "Перевести в группу";

    // ================== STATE ==================
    const state = { busy: false, context: null };

    const notify = (message, type = "info") => {
      if (typeof showToast === "function") showToast(message, { type });
      else console.log(`[${type}] ${message}`);
    };

    const toAbsUrl = (url) => {
      if (!url) return url;
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith("/")) return url;
      return "/" + String(url).replace(/^\/+/, "");
    };

    const escapeHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // ВАЖНО: безопасно для cp1251 — превращаем всё не-ASCII в &#NNNN;
    const encodeNonAscii = (s) =>
      String(s ?? "").replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);

    const fetchJson = (url) =>
      withTimeout(
        fetch(toAbsUrl(url), {
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        }),
        config.requestTimeoutMs
      ).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    const fetchDoc = async (url) => {
      const res = await withTimeout(
        fetch(toAbsUrl(url), {
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        }),
        config.requestTimeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      return parseHTML(html);
    };

    const findSubmitControl = (form) => {
      let x = form.querySelector('input[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || "1" };

      x = form.querySelector('button[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || "1" };

      x = form.querySelector(
        'input[name="save"],input[name="update"],input[name="submit"],input[name="add_page"]'
      );
      if (x) return { name: x.name, value: x.value || "1" };

      return null;
    };

    // ========== IFRAME POST (как браузер) ==========
    const iframePost = (actionUrl, params, refUrl) =>
      new Promise((resolve, reject) => {
        const action = toAbsUrl(actionUrl);
        const ref = toAbsUrl(refUrl || actionUrl || "/");
        const iframeName = `ks_if_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        const iframe = document.createElement("iframe");
        iframe.name = iframeName;
        iframe.style.cssText =
          "position:absolute;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;";
        document.body.appendChild(iframe);

        let stage = 0;
        let done = false;

        const cleanup = () => {
          if (done) return;
          done = true;
          try {
            iframe.removeEventListener("load", onLoad);
          } catch {}
          try {
            iframe.remove();
          } catch {}
        };

        const fail = (err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        const succeed = (payload) => {
          cleanup();
          resolve(payload);
        };

        const onLoad = () => {
          try {
            const doc = iframe.contentDocument;
            if (!doc) return;

            if (stage === 0) {
              stage = 1;

              const form = doc.createElement("form");
              form.method = "POST";
              form.action = action;
              form.target = iframeName;

              // просим браузер кодировать как админка
              form.setAttribute("accept-charset", "windows-1251");

              for (const [k, v] of params.entries()) {
                const input = doc.createElement("input");
                input.type = "hidden";
                input.name = k;
                input.value = String(v ?? "");
                form.appendChild(input);
              }

              doc.body.appendChild(form);
              form.submit();
              return;
            }

            // stage 1: пришёл ответ после POST
            const title = String(doc.title || "");
            const text = String(doc.body ? doc.body.innerText || "" : "");
            const hay = (title + "\n" + text).toLowerCase();

            if (hay.includes("500") && hay.includes("internal server error")) {
              console.error("[charProfileTool] iframe POST got 500:", title);
              console.error("[charProfileTool] snippet:", text.slice(0, 800));
              fail(new Error("HTTP 500 (iframe submit)"));
              return;
            }

            // частая ситуация: улетели на логин/ошибку прав
            if (
              hay.includes("вход") ||
              hay.includes("login") ||
              hay.includes("пароль") ||
              hay.includes("доступ") ||
              hay.includes("forbidden")
            ) {
              console.warn("[charProfileTool] iframe POST response подозрительный:", title);
              console.warn("[charProfileTool] snippet:", text.slice(0, 800));
              // не фейлим тут — решает проверка ниже
            }

            succeed({ title, text });
          } catch (e) {
            fail(e);
          }
        };

        iframe.addEventListener("load", onLoad);

        try {
          iframe.src = ref; // чтобы referer был “админский”
        } catch (e) {
          fail(e);
        }
      });

    const shouldUseIframeForUrl = (url) =>
      /\/admin_pages\.php(\?|$)/i.test(String(url || ""));

    const postForm = async (url, params, refUrl) => {
      if (shouldUseIframeForUrl(url) || shouldUseIframeForUrl(refUrl)) {
        await withTimeout(iframePost(url, params, refUrl), config.requestTimeoutMs);
        return { ok: true };
      }

      const res = await withTimeout(
        fetch(toAbsUrl(url), {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          body: params.toString(),
          referrer: toAbsUrl(refUrl || url),
        }),
        config.requestTimeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    };

    // ========== Парсинг анкеты ==========
    const toIntOrNull = (s) => {
      const n = parseInt(String(s || "").replace(/[^\d\-]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };

    const textFrom = (el) =>
      String((el && (el.textContent || el.innerText)) || "").trim();

    const decodeHtmlEntities = (str) => {
      if (!str) return "";
      let out = String(str);
      out = out.replace(/&#(\d+);/g, (_, num) =>
        String.fromCharCode(Number(num) || 0)
      );
      out = out
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&");
      return out;
    };

    const parseProfileFromHtml = (html) => {
      if (!html) return null;
      const doc = parseHTML(html);

      const nameRu = textFrom(
        doc.querySelector(".custom_tag_charname p, .char-name-ru p")
      );
      const nameEn = textFrom(
        doc.querySelector(".custom_tag_charnameen p, .char-name-en p")
      );
      const age = toIntOrNull(
        textFrom(doc.querySelector(".custom_tag_charage p, .char-age p"))
      );
      const race = textFrom(
        doc.querySelector(".custom_tag_charrace p, .char-race p")
      );

      const pairName = textFrom(
        doc.querySelector(".custom_tag_charpair.char-pair, .custom_tag_charpair")
      );

      const role = textFrom(
        doc.querySelector(".custom_tag_charrole.char-role, .custom_tag_charrole")
      );

      const hasAny = nameRu || nameEn || age !== null || race || pairName || role;
      if (!hasAny) return null;

      return {
        name: nameRu || "",
        name_en: nameEn || "",
        age,
        race: race || "",
        pair_name: pairName || "",
        role: role || "",
      };
    };

    const parseLzHtmlFromHtml = (html) => {
      if (!html) return "";
      const doc = parseHTML(html);
      const node = doc.querySelector(config.selectors.lzSource);
      if (!node) return "";
      return decodeHtmlEntities(String(node.innerHTML || "").trim());
    };

    const getRaceLetter = (race) => {
      const r = String(race || "").toLowerCase();
      if (r === "фамильяр") return "f";
      if (r === "ведьма" || r === "ведьмак") return "w";
      if (r === "осквернённый") return "t";
      if (r === "человек") return "h";
      return "";
    };

    const generateFileName = (nameEn) =>
      String(nameEn || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zа-яё_]/g, "");

    const getTopicIdFromUrl = (url) => {
      const m = String(url).match(/viewtopic\.php\?id=(\d+)/);
      return m ? m[1] : null;
    };

    const pickFirstPost = (posts) => {
      if (!Array.isArray(posts) || !posts.length) return null;
      const sorted = [...posts].sort((a, b) => Number(a.id) - Number(b.id));
      return sorted[0] || null;
    };

    const getPostsForTopic = async (topicId) => {
      const url = `${config.endpoints.apiBase}?method=post.get&topic_id=${encodeURIComponent(
        topicId
      )}&fields=id,topic_id,message,username,link&limit=100`;
      const data = await fetchJson(url);
      if (data && data.response) {
        return data.response.map((post) => ({
          id: Number(post.id),
          topic_id: Number(post.topic_id),
          username: String(post.username || ""),
          message: String(post.message || ""),
          link: String(post.link || ""),
        }));
      }
      return [];
    };

    const getUserIdByUsername = async (username) => {
      if (!username) return null;
      const encoded = encodeURIComponent(String(username).trim());
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
        const firstName = characterData.name_en.split(" ")[0];
        if (firstName && firstName !== characterData.name_en) {
          userId = await getUserIdByUsername(firstName);
          if (userId) return userId;
        }
      }
      return null;
    };

    // ========== Шаблон страницы ==========
    const buildPageTemplate = (ctx) => {
      const uid = Number(ctx?.userId) || 0;
      const nameEn = escapeHtml(ctx?.characterData?.name_en || "");
      const pairNameRaw = String(ctx?.characterData?.pair_name || "").trim();
      const pairName = escapeHtml(pairNameRaw || "Неизвестно");
      const roleRaw = String(ctx?.characterData?.role || "").trim();
      const role = escapeHtml(roleRaw || "");

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
            <input class="cm-input" type="search" placeholder="Поиск по инвентарю..." data-inv-search />
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
                <div class="cm-bgs"></div>
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

    // ========== Формы профиля ==========
    const fetchProfileForm = async (userId) => {
      const url = config.endpoints.profileUrl(userId);
      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.profileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) throw new Error("Форма профиля не найдена в HTML профиля.");
      const actionRaw = form.getAttribute("action") || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAdminProfileForm = async (userId) => {
      const url =
        typeof config.endpoints.adminProfileUrl === "function"
          ? config.endpoints.adminProfileUrl(userId)
          : `/profile.php?section=admin&id=${encodeURIComponent(userId)}`;

      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.adminProfileFormSelector) ||
        doc.querySelector('form[id^="profile"]');
      if (!form) throw new Error("Форма управления пользователем не найдена.");
      const actionRaw = form.getAttribute("action") || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const buildProfileParams = (form, overrideMap) => {
      const params = new URLSearchParams();
      const overrideNames = new Set(Object.keys(overrideMap || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;

        const type = (el.type || "").toLowerCase();
        const tag = (el.tagName || "").toUpperCase();

        if (type === "submit") continue;

        if (overrideNames.has(el.name)) {
          params.set(el.name, encodeNonAscii(overrideMap[el.name] ?? ""));
          continue;
        }

        if (type === "checkbox" || type === "radio") {
          if (el.checked) params.append(el.name, el.value ?? "1");
          continue;
        }

        if (tag === "SELECT" && el.multiple) {
          const selected = Array.from(el.options || []).filter((o) => o.selected);
          selected.forEach((o) => params.append(el.name, o.value ?? ""));
          continue;
        }

        params.append(el.name, el.value ?? "");
      }

      if (!params.has("form_sent")) params.set("form_sent", "1");

      overrideNames.forEach((name) => {
        if (!params.has(name)) params.set(name, encodeNonAscii(overrideMap[name] ?? ""));
      });

      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, encodeNonAscii(submit.value));

      return params;
    };

    // ========== Формы админ-страниц ==========
    const fetchAddPageForm = async () => {
      const url = config.endpoints.adminAddPageUrl;
      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.adminAddPageFormSelector) ||
        doc.querySelector("form#addpage");
      if (!form) throw new Error("Форма создания страницы не найдена.");
      return { form, pageUrl: url };
    };

    const fetchEditPageForm = async (pageSlug) => {
      const editUrl = config.endpoints.adminEditPageUrl(pageSlug);
      const doc = await fetchDoc(editUrl);

      const form =
        doc.querySelector('form[action*="admin_pages.php"][method="post"]') ||
        doc.querySelector("form");
      if (!form) return { doc, form: null, editUrl };

      // Мы будем постить ВСЕГДА на editUrl (а не form.action), чтобы точно был ?edit_page=
      return { doc, form, editUrl };
    };

    const buildAdminPageParamsFromForm = (form, overrides = {}) => {
      const params = new URLSearchParams();
      const overrideNames = new Set(Object.keys(overrides || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;

        const type = (el.type || "").toLowerCase();
        const tag = (el.tagName || "").toUpperCase();

        if (type === "submit") continue;

        if (overrideNames.has(el.name)) {
          params.set(el.name, String(overrides[el.name] ?? ""));
          continue;
        }

        if (type === "checkbox" || type === "radio") {
          if (el.checked) params.append(el.name, el.value ?? "1");
          continue;
        }

        if (tag === "SELECT" && el.multiple) {
          const selected = Array.from(el.options || []).filter((o) => o.selected);
          selected.forEach((o) => params.append(el.name, o.value ?? ""));
          continue;
        }

        // textarea/input/select
        params.append(el.name, el.value ?? "");
      }

      overrideNames.forEach((name) => {
        if (!params.has(name)) params.set(name, String(overrides[name] ?? ""));
      });

      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, String(submit.value || "1"));

      return params;
    };

    const readAdminPageTextareaValue = (doc) => {
      const ta =
        doc.querySelector('textarea[name="content"]') ||
        doc.querySelector('textarea[name="text"]') ||
        doc.querySelector('textarea[name="message"]') ||
        doc.querySelector("textarea[name]");
      if (!ta) return "";
      return String(ta.value || ta.textContent || "");
    };

    const assertPageUpdated = async (pageSlug, marker) => {
      const { doc } = await fetchEditPageForm(pageSlug);
      const val = readAdminPageTextareaValue(doc);
      if (val.includes(marker)) return true;

      // часто подсказка лежит прямо в HTML страницы
      const title = String(doc.title || "");
      const bodyText = String(doc.body ? doc.body.innerText || "" : "");
      console.error("[charProfileTool] verify failed. title:", title);
      console.error("[charProfileTool] verify failed. textarea snippet:", val.slice(0, 600));
      console.error("[charProfileTool] verify failed. body snippet:", bodyText.slice(0, 800));

      throw new Error(
        "POST прошёл, но контент страницы не изменился (проверка не нашла новый шаблон). " +
          "Смотри console: там есть куски ответа/страницы — обычно видно причину (права/валидация/редирект)."
      );
    };

    const tryUpdateExistingPage = async (pageSlug, newHtml) => {
      const { doc, form, editUrl } = await fetchEditPageForm(pageSlug);
      if (!form) return false;

      // Подстрахуемся: перепишем ВСЕ textarea[name], вдруг имя не content
      const textareas = Array.from(form.querySelectorAll("textarea[name]"));
      if (!textareas.length) return false;

      const encodedHtml = encodeNonAscii(newHtml);

      const overrides = {};
      textareas.forEach((ta) => {
        overrides[ta.name] = encodedHtml;
      });

      // часто есть title/name/edit_page — тоже проставим, если поля есть
      const hasTitle = !!form.querySelector('input[name="title"]');
      const hasName = !!form.querySelector('input[name="name"]');
      if (hasTitle) overrides.title = pageSlug;
      if (hasName) overrides.name = pageSlug;

      let params = buildAdminPageParamsFromForm(form, overrides);

      // подстраховка: иногда edit_page хотят и в POST
      params.set("edit_page", pageSlug);

      // подстраховка: если submit не добавился — добавим save=1
      if (!params.has("save") && !params.has("update") && !params.has("submit")) {
        params.set("save", "1");
      }

      // POST делаем на editUrl, и ref тоже editUrl
      await postForm(editUrl, params, editUrl);

      // проверяем реальное изменение
      await assertPageUpdated(pageSlug, "cm-shell");

      return true;
    };

    const createNewPage = async (pageSlug, newHtml) => {
      const { form, pageUrl } = await fetchAddPageForm();

      const encodedHtml = encodeNonAscii(newHtml);

      // title/name + все textarea
      const overrides = {
        title: pageSlug,
        name: pageSlug,
      };

      const textareas = Array.from(form.querySelectorAll("textarea[name]"));
      if (!textareas.length) throw new Error("В форме создания страницы нет textarea[name].");
      textareas.forEach((ta) => {
        overrides[ta.name] = encodedHtml;
      });

      let params = buildAdminPageParamsFromForm(form, overrides);

      // подстраховка: если submit не добавился — добавим save=1
      if (!params.has("save") && !params.has("add_page") && !params.has("submit")) {
        params.set("save", "1");
      }

      await postForm(pageUrl, params, pageUrl);

      // после создания проверяем через edit_page
      await assertPageUpdated(pageSlug, "cm-shell");
    };

    // ========== Контекст ==========
    const ensureBasicContext = async () => {
      if (state.context) return state.context;

      const topicUrl = location.href.split("#")[0];
      const topicId = getTopicIdFromUrl(topicUrl);
      if (!topicId) throw new Error("Не удалось определить ID темы из адреса.");

      const posts = await getPostsForTopic(topicId);
      if (!posts.length) throw new Error("В теме нет постов или тема не найдена.");

      const firstPost = pickFirstPost(posts);
      if (!firstPost) throw new Error("Не удалось найти первый пост в теме.");

      const characterData = parseProfileFromHtml(firstPost.message);
      if (!characterData) throw new Error("Не удалось распознать анкету персонажа.");
      if (!characterData.name) throw new Error("Не найдено имя персонажа ([charname]).");
      if (!characterData.name_en) throw new Error("Не найдено англ. имя ([charnameen]).");
      if (!characterData.age) throw new Error("Не найден возраст ([charage]).");
      if (!characterData.race) throw new Error("Не найдена раса ([charrace]).");

      const userId = await findUserId(characterData, firstPost);
      if (!userId) throw new Error("Не удалось определить user_id по имени персонажа.");

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

      if (ctx.lzHtml === undefined) {
        const lzHtml = parseLzHtmlFromHtml(ctx.firstPostHtml);
        if (!lzHtml && requireLz) {
          throw new Error("Не найден HTML личного звания ([charpt]).");
        }
        ctx.lzHtml = lzHtml || "";
      }

      if (!ctx.pageSlug) ctx.pageSlug = generateFileName(ctx.characterData.name_en);
      return ctx;
    };

    // ========== Действия ==========
    const fillProfile = async () => {
      const ctx = await ensureFullContext({ requireLz: true });
      const { characterData, lzHtml, userId, topicUrl } = ctx;

      const raceLetter = getRaceLetter(characterData.race);
      const raceField = `<div title="${characterData.race}">${raceLetter}</div>`;
      const lzField =
        `<div class="lz-name"><a href="${topicUrl}">${characterData.name}</a>, ${characterData.age}</div>` +
        ` <div class="lz-text">${lzHtml}</div>`;
      const plahField =
        `<pers-plah class="modal-link" id="${ctx.pageSlug}" data-user-id="${userId}" role="button" tabindex="0" style="cursor:pointer">` +
        `<div class="pers-plah"><em class="pers-plah-text"> Two bodies, one soul </em></div></pers-plah>`;

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
      if (updated) return { mode: "update" };

      await createNewPage(pageSlug, newContent);
      return { mode: "create" };
    };

    const changeGroup = async () => {
      const ctx = await ensureBasicContext();
      const { userId } = ctx;
      const targetGroupId = String(config.profile.targetGroupId || 6);

      const { form, actionUrl } = await fetchAdminProfileForm(userId);

      const groupSelect = form.querySelector('select[name="group_id"]');
      if (!groupSelect) throw new Error('Поле "group_id" не найдено.');

      const overrides = { group_id: targetGroupId };
      const params = buildProfileParams(form, overrides);
      await postForm(actionUrl, params, actionUrl);
    };

    // ========== Handlers ==========
    const handleFillProfileClick = async () => {
      if (state.busy) return notify("Уже выполняется другая операция.", "error");
      state.busy = true;
      try {
        await fillProfile();
        notify("Профиль обновлён. Проверьте вкладку «Дополнительно».", "success");
      } catch (err) {
        console.error("Ошибка при автозаполнении профиля:", err);
        notify(err.message || String(err), "error");
      } finally {
        state.busy = false;
      }
    };

    const handleCreatePageClick = async () => {
      if (state.busy) return notify("Уже выполняется другая операция.", "error");
      state.busy = true;
      try {
        const r = await createOrUpdatePage();
        notify(
          r.mode === "update"
            ? "Страница персонажа обновлена (контент перезаписан и проверен)."
            : "Страница персонажа создана (проверено через edit_page).",
          "success"
        );
      } catch (err) {
        console.error("Ошибка при создании/обновлении страницы:", err);
        notify(err.message || String(err), "error");
      } finally {
        state.busy = false;
      }
    };

    const handleChangeGroupClick = async () => {
      if (state.busy) return notify("Уже выполняется другая операция.", "error");
      state.busy = true;
      try {
        await changeGroup();
        notify("Группа пользователя обновлена на «Одарённый».", "success");
      } catch (err) {
        console.error("Ошибка при смене группы:", err);
        notify(err.message || String(err), "error");
      } finally {
        state.busy = false;
      }
    };

    // ========== UI ==========
    const mountButtons = () => {
      const targets = $$(config.selectors.insertAfter);
      targets.forEach((anchor) => {
        if (!anchor || anchor.dataset.charProfileToolMounted) return;
        anchor.dataset.charProfileToolMounted = "1";

        const btnFill = document.createElement("input");
        btnFill.type = "button";
        btnFill.value = LABEL_FILL;
        btnFill.className = "button ks-btn-fill-profile";

        const btnPage = document.createElement("input");
        btnPage.type = "button";
        btnPage.value = LABEL_CREATE_PAGE;
        btnPage.className = "button ks-btn-create-page";

        const btnGroup = document.createElement("input");
        btnGroup.type = "button";
        btnGroup.value = LABEL_CHANGE_GROUP;
        btnGroup.className = "button ks-btn-change-group";

        anchor.insertAdjacentElement("afterend", btnFill);
        btnFill.insertAdjacentElement("afterend", btnPage);
        btnPage.insertAdjacentElement("afterend", btnGroup);

        btnFill.addEventListener("click", handleFillProfileClick);
        btnPage.addEventListener("click", handleCreatePageClick);
        btnGroup.addEventListener("click", handleChangeGroupClick);
      });
    };

    const init = () => {
      const fid = getForumId();
      if (!fid || !config.access.allowedForumIds.map(Number).includes(Number(fid))) return;

      if (Array.isArray(config.access.allowedGroupIds) && config.access.allowedGroupIds.length) {
        const gid = getGroupId();
        if (!config.access.allowedGroupIds.map(Number).includes(Number(gid))) return;
      }

      mountButtons();

      const mo = new MutationObserver(() => mountButtons());
      mo.observe(document.body, { childList: true, subtree: true });
    };

    runOnceOnReady(init);
    if (helpers.register) helpers.register("charProfileTool", { init });
  }

  bootstrap();
})();
