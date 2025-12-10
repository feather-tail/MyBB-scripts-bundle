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
        targetGroupId: 6, // «Одарённый»
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
      },
      requestTimeoutMs: 15000,
    });

    const LABEL_FILL =
      (config.ui && config.ui.fillProfileText) || "Автозаполнить профиль";
    const LABEL_CREATE_PAGE =
      (config.ui && config.ui.createPageText) || "Создать страницу";
    const LABEL_CHANGE_GROUP =
      (config.ui && config.ui.changeGroupText) || "Перевести в группу";

    const PAGE_TEMPLATE = `
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
</div>
    `.trim();

    const state = {
      busy: false,
      // context:
      // { topicId, topicUrl, characterData, userId, firstPostHtml, lzHtml?, pageSlug? }
      context: null,
    };

    const notify = (message, type = "info") => {
      if (typeof showToast === "function") {
        showToast(message, { type });
      } else {
        console.log(`[${type}] ${message}`);
      }
    };

    const toAbsUrl = (url) => {
      if (!url) return url;
      if (/^https?:\/\//i.test(url)) return url;
      if (url.startsWith("/")) return url;
      return "/" + String(url).replace(/^\/+/, "");
    };

    const fetchJson = (url) =>
      withTimeout(
        fetch(toAbsUrl(url), { credentials: "same-origin" }),
        config.requestTimeoutMs
      ).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    const fetchDoc = async (url) => {
      const res = await withTimeout(
        fetch(toAbsUrl(url), { credentials: "same-origin" }),
        config.requestTimeoutMs
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
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
          referrer: ref,
        }),
        config.requestTimeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    };

    const encodeNonAscii = (s) =>
      String(s).replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);

    const toIntOrNull = (s) => {
      const n = parseInt(String(s || "").replace(/[^\d\-]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };

    const getTopicIdFromUrl = (url) => {
      const m = String(url).match(/viewtopic\.php\?id=(\d+)/);
      return m ? m[1] : null;
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

      const hasAny = nameRu || nameEn || age !== null || race;
      if (!hasAny) return null;

      return {
        name: nameRu || "",
        name_en: nameEn || "",
        age,
        race: race || "",
      };
    };

    const parseLzHtmlFromHtml = (html) => {
      if (!html) return "";
      const doc = parseHTML(html);
      const node = doc.querySelector(config.selectors.lzSource);
      if (!node) return "";
      const raw = node.innerHTML.trim();
      return decodeHtmlEntities(raw);
    };

    const getRaceLetter = (race) => {
      const raceLower = race.toLowerCase();
      if (raceLower === "фамильяр") return "f";
      if (raceLower === "ведьма" || raceLower === "ведьмак") return "w";
      if (raceLower === "осквернённый") return "t";
      if (raceLower === "человек") return "h";
      return "";
    };

    const generateFileName = (nameEn) =>
      nameEn
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zа-яё_]/g, "");

    const pickFirstPost = (posts) => {
      if (!Array.isArray(posts) || !posts.length) return null;
      const sorted = [...posts].sort((a, b) => Number(a.id) - Number(b.id));
      return sorted[0] || null;
    };

    const getPostsForTopic = async (topicId) => {
      const url = `${
        config.endpoints.apiBase
      }?method=post.get&topic_id=${encodeURIComponent(
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
        const firstName = characterData.name_en.split(" ")[0];
        if (firstName && firstName !== characterData.name_en) {
          userId = await getUserIdByUsername(firstName);
          if (userId) return userId;
        }
      }
      return null;
    };

    const findSubmitControl = (form) => {
      let x = form.querySelector('input[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || "1" };
      x = form.querySelector('button[type="submit"][name]');
      if (x) return { name: x.name, value: x.value || "1" };
      x = form.querySelector(
        'input[name="update"],input[name="submit"],input[name="save"],input[name="add_page"],input[name="update_group_membership"]'
      );
      if (x) return { name: x.name, value: x.value || "1" };
      return null;
    };

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
      // <-- Фикс: безопасный фоллбэк, если adminProfileUrl не определён в конфиге
      let url;
      if (
        config.endpoints &&
        typeof config.endpoints.adminProfileUrl === "function"
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
          "Форма управления пользователем (группы) не найдена в профиле."
        );
      }
      const actionRaw = form.getAttribute("action") || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const fetchAddPageForm = async () => {
      const url = config.endpoints.adminAddPageUrl;
      const doc = await fetchDoc(url);
      const form =
        doc.querySelector(config.endpoints.adminAddPageFormSelector) ||
        doc.querySelector("form#addpage");
      if (!form) {
        throw new Error("Форма создания страницы не найдена в HTML админки.");
      }
      const actionRaw = form.getAttribute("action") || url;
      const actionUrl = toAbsUrl(actionRaw);
      return { form, actionUrl };
    };

    const buildProfileParams = (form, overrideMap) => {
      const params = new URLSearchParams();
      const isHidden = (el) =>
        el.tagName === "INPUT" && (el.type || "").toLowerCase() === "hidden";

      const overrideNames = new Set(Object.keys(overrideMap || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;
        const type = (el.type || "").toLowerCase();

        if (type === "submit") {
          continue;
        }

        if (isHidden(el)) {
          params.append(el.name, el.value ?? "");
          continue;
        }

        if (el.name === "form_sent") {
          params.set("form_sent", el.value || "1");
          continue;
        }

        if (overrideNames.has(el.name)) {
          const raw = overrideMap[el.name];
          const val = encodeNonAscii(raw ?? "");
          params.set(el.name, val);
          continue;
        }

        if (/^form\[\w+\]$/.test(el.name)) {
          params.set(el.name, el.value ?? "");
          continue;
        }

        if ((type === "checkbox" || type === "radio") && el.checked) {
          params.append(el.name, el.value ?? "1");
          continue;
        }

        params.append(el.name, el.value ?? "");
      }

      if (!params.has("form_sent")) params.set("form_sent", "1");

      overrideNames.forEach((name) => {
        if (!params.has(name)) {
          const raw = overrideMap[name];
          const val = encodeNonAscii(raw ?? "");
          params.set(name, val);
        }
      });

      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, submit.value);

      return params;
    };

    const buildAddPageParams = (form, overrideMap) => {
      const params = new URLSearchParams();
      const isHidden = (el) =>
        el.tagName === "INPUT" && (el.type || "").toLowerCase() === "hidden";

      const overrideNames = new Set(Object.keys(overrideMap || {}));

      for (const el of Array.from(form.elements || [])) {
        if (!el.name || el.disabled) continue;
        const type = (el.type || "").toLowerCase();

        if (type === "submit") {
          continue;
        }

        if (isHidden(el)) {
          params.append(el.name, el.value ?? "");
          continue;
        }

        if (overrideNames.has(el.name)) {
          const raw = overrideMap[el.name];
          const val = encodeNonAscii(raw ?? "");
          params.set(el.name, val);
          continue;
        }

        if (
          el.name === "title" ||
          el.name === "name" ||
          el.name === "content" ||
          el.name === "tags"
        ) {
          params.set(el.name, el.value ?? "");
          continue;
        }

        if ((type === "checkbox" || type === "radio") && el.checked) {
          params.append(el.name, el.value ?? "1");
          continue;
        }

        params.append(el.name, el.value ?? "");
      }

      overrideNames.forEach((name) => {
        if (!params.has(name)) {
          const raw = overrideMap[name];
          const val = encodeNonAscii(raw ?? "");
          params.set(name, val);
        }
      });

      const submit = findSubmitControl(form);
      if (submit) params.append(submit.name, submit.value);

      return params;
    };

    // --- КОНТЕКСТЫ ---

    const ensureBasicContext = async () => {
      if (state.context) return state.context;

      const topicUrl = location.href.split("#")[0];
      const topicId = getTopicIdFromUrl(topicUrl);
      if (!topicId) {
        throw new Error("Не удалось определить ID темы из адреса.");
      }

      const posts = await getPostsForTopic(topicId);
      if (!posts.length) {
        throw new Error("В теме нет постов или тема не найдена.");
      }

      const firstPost = pickFirstPost(posts);
      if (!firstPost) {
        throw new Error("Не удалось найти первый пост в теме.");
      }

      const characterData = parseProfileFromHtml(firstPost.message);
      if (!characterData) {
        throw new Error(
          "Не удалось распознать анкету персонажа. Проверьте оформление BB-кодов."
        );
      }
      if (!characterData.name) {
        throw new Error("Не найдено имя персонажа (BB-код [charname]).");
      }
      if (!characterData.name_en) {
        throw new Error(
          "Не найдено английское имя персонажа (BB-код [charnameen])."
        );
      }
      if (!characterData.age) {
        throw new Error("Не найден возраст персонажа (BB-код [charage]).");
      }
      if (!characterData.race) {
        throw new Error("Не найдена раса персонажа (BB-код [charrace]).");
      }

      const userId = await findUserId(characterData, firstPost);
      if (!userId) {
        throw new Error(
          "Не удалось определить user_id по имени персонажа. Проверьте пользователя в системе."
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

    const ensureFullContext = async () => {
      const ctx = await ensureBasicContext();

      if (!ctx.lzHtml) {
        const lzHtml = parseLzHtmlFromHtml(ctx.firstPostHtml);
        if (!lzHtml) {
          throw new Error(
            "Не найден HTML личного звания (BB-код [charpt]). Проверьте анкету."
          );
        }
        ctx.lzHtml = lzHtml;
      }

      if (!ctx.pageSlug) {
        ctx.pageSlug = generateFileName(ctx.characterData.name_en);
      }

      return ctx;
    };

    // --- ОПЕРАЦИИ ---

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

    const createPage = async () => {
      const ctx = await ensureFullContext();
      const { pageSlug } = ctx;

      const { form, actionUrl } = await fetchAddPageForm();

      const overrides = {
        title: pageSlug,
        name: pageSlug,
        content: PAGE_TEMPLATE,
      };

      const params = buildAddPageParams(form, overrides);
      await postForm(actionUrl, params, actionUrl);
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

    // --- Хэндлеры кнопок ---

    const handleFillProfileClick = async () => {
      if (state.busy) {
        notify("Уже выполняется другая операция, подождите.", "error");
        return;
      }
      state.busy = true;
      try {
        await fillProfile();
        notify(
          "Профиль обновлён. Проверьте вкладку «Дополнительно».",
          "success"
        );
      } catch (err) {
        console.error("Ошибка при автозаполнении профиля:", err);
        notify(err.message || String(err), "error");
      } finally {
        state.busy = false;
      }
    };

    const handleCreatePageClick = async () => {
      if (state.busy) {
        notify("Уже выполняется другая операция, подождите.", "error");
        return;
      }
      state.busy = true;
      try {
        await createPage();
        notify(
          "Страница персонажа создана. Проверьте список страниц.",
          "success"
        );
      } catch (err) {
        console.error("Ошибка при создании страницы:", err);
        notify(err.message || String(err), "error");
      } finally {
        state.busy = false;
      }
    };

    const handleChangeGroupClick = async () => {
      if (state.busy) {
        notify("Уже выполняется другая операция, подождите.", "error");
        return;
      }
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

    // --- Монтирование кнопок ---

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
    if (helpers.register) helpers.register("charProfileTool", { init });
  }

  bootstrap();
})();
