(() => {
  "use strict";
  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",

    // awards используем как "Подарки"
    showAwards: true,
    awardsTabTitle: "Подарки",
    awardsErrorText: "Ошибка загрузки подарков.",
    awardsEmptyText: "Подарков не найдено.",
    awardsApi: "https://core.rusff.me/rusff.php",

    giftsTabIconClass: "fa-solid fa-gift",
  });

  // fallback на случай если config.classes не задан
  const classes = {
    tabs: (config.classes && config.classes.tabs) || "modal__tabs",
    tab: (config.classes && config.classes.tab) || "modal__tab",
    tabContent: (config.classes && config.classes.tabContent) || "modal__content",
    active: (config.classes && config.classes.active) || "active",
  };

  const awardsCache = new Map();
  const rpcCache = new Map();
  const rpcInflight = new Map();

  const stableStringify = (v) => {
    if (v && typeof v === "object") {
      if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v);
  };

  const rpc = (method, params) => {
    const body = { jsonrpc: "2.0", id: 1, method, params };
    const key = `${method}|${stableStringify(params)}`;
    if (rpcCache.has(key)) return Promise.resolve(rpcCache.get(key));
    if (rpcInflight.has(key)) return rpcInflight.get(key);

    const p = fetch(config.awardsApi, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (!r.ok) throw new Error("network");
        return r.json();
      })
      .then((j) => j?.result ?? null)
      .finally(() => rpcInflight.delete(key));

    rpcInflight.set(key, p);
    p.then((res) => rpcCache.set(key, res));
    return p;
  };

  const fetchAwardsAsGifts = (uid) => {
    if (awardsCache.has(uid)) return awardsCache.get(uid);

    const params = {
      board_id: Number(window.BoardID) || 0,
      user_id: getUserId(),
      sort: "user",
      users_ids: [String(uid)],
      check: {
        board_id: Number(window.BoardID) || 0,
        user_id: getUserId(),
        partner_id: Number(window.PartnerID) || 0,
        group_id: getGroupId(),
        user_login: String(window.UserLogin || ""),
        user_avatar: "",
        user_lastvisit: Number(window.UserLastVisit) || 0,
        user_unique_id: String(window.UserUniqueID || ""),
        host: location.host,
        sign: String(window.ForumAPITicket || ""),
      },
    };

    const p = rpc("awards/index", params).then((rows = []) => {
      const u = rows.find((r) => r.user_id === String(uid));
      const res = [];
      if (u && Array.isArray(u.awards)) {
        for (const a of u.awards) {
          res.push({
            id: a.award_id,
            name: a.item?.name || "",
            desc: a.desc || "",
            img: a.item?.href || "",
          });
        }
      }
      return res;
    });

    awardsCache.set(uid, p);
    return p;
  };

  function ensureGiftsTabAndPanel(root) {
    const tabs = root.querySelector(`.${classes.tabs}`);
    const body = root.querySelector("[data-cm-body]") || root;
    if (!tabs || !body) return null;

    // already exists?
    let tab = tabs.querySelector('[data-cm-tab="gifts"]');
    let panel = body.querySelector('[data-cm-panel="gifts"]');

    if (!tab) {
      tab = createEl("button", {
        className: classes.tab,
        type: "button",
      });
      tab.setAttribute("aria-label", config.awardsTabTitle);
      tab.dataset.cmTab = "gifts";
      tab.append(
        createEl("i", { className: config.giftsTabIconClass, "aria-hidden": "true" })
      );
      tab.append(createEl("span", { className: "cm-sr", text: config.awardsTabTitle }));

      // вставляем сразу после инвентаря
      const invTab = tabs.querySelector('[data-cm-tab="inventory"]');
      if (invTab && invTab.nextSibling) tabs.insertBefore(tab, invTab.nextSibling);
      else tabs.append(tab);
    }

    if (!panel) {
      panel = createEl("section", { className: classes.tabContent });
      panel.dataset.cmPanel = "gifts";

      const sec = createEl("div", { className: "cm-section" });
      sec.append(createEl("div", { className: "cm-muted", text: config.loadingText }));
      sec.append(createEl("div", { className: "cm-gifts-root", "data-gifts-root": "" }));
      panel.append(sec);

      // вставляем панель сразу после панели инвентаря
      const invPanel = body.querySelector('[data-cm-panel="inventory"]');
      if (invPanel && invPanel.nextSibling) body.insertBefore(panel, invPanel.nextSibling);
      else body.append(panel);
    }

    return { tab, panel };
  }

  function renderGifts(panel, gifts) {
    const root = panel.querySelector("[data-gifts-root]") || panel;
    root.textContent = "";

    if (!gifts || !gifts.length) {
      root.append(createEl("div", { className: "cm-muted", text: config.awardsEmptyText }));
      return;
    }

    const grid = createEl("div", { className: "inv-grid" }); // те же “слоты”
    gifts.forEach((g) => {
      const tipLines = [];
      if (g.name) tipLines.push(g.name);
      if (g.desc) tipLines.push(g.desc);

      const slot = createEl("button", {
        className: "inv-slot cm-tip",
        type: "button",
      });
      slot.dataset.tooltip = tipLines.join("\n");
      if (g.img) slot.style.setProperty("--slot-img", `url("${g.img}")`);

      grid.append(slot);
    });

    root.append(grid);
  }

  function initInventoryUI(root) {
    const panel = root.querySelector('[data-cm-panel="inventory"]');
    if (!panel) return;

    const input = panel.querySelector(".inv-search");
    const btn = panel.querySelector(".inv-filter-btn");
    const filtersBox = panel.querySelector(".inv-filters");
    const grid = panel.querySelector("[data-inv-grid]");
    const empty = panel.querySelector(".inv-empty");
    if (!grid) return;

    const slots = Array.from(grid.querySelectorAll(".inv-slot"));
    if (!slots.length) return;

    const state = {
      q: "",
      cats: new Set(), // выбранные категории
      filtersReady: false,
    };

    const getSlotText = (el) =>
      `${el.dataset.name || ""} ${el.dataset.tooltip || ""}`.toLowerCase();

    const apply = () => {
      const q = state.q;
      const cats = state.cats;
      let shown = 0;

      for (const s of slots) {
        const text = getSlotText(s);
        const cat = (s.dataset.cat || "").trim();

        const okQ = !q || text.includes(q);
        const okC = !cats.size || (cat && cats.has(cat));
        const ok = okQ && okC;

        s.hidden = !ok;
        if (ok) shown++;
      }

      if (empty) empty.hidden = shown !== 0;
    };

    const buildFilters = () => {
      if (!filtersBox || state.filtersReady) return;

      const cats = Array.from(
        new Set(slots.map((s) => (s.dataset.cat || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "ru"));

      filtersBox.textContent = "";
      if (!cats.length) {
        filtersBox.append(createEl("div", { className: "cm-muted", text: "Категорий нет." }));
        state.filtersReady = true;
        return;
      }

      filtersBox.append(createEl("div", { className: "cm-muted", text: "Категории:" }));

      const row = createEl("div", { className: "inv-filters__row" });
      cats.forEach((c) => {
        const id = `inv-cat-${c.replace(/\s+/g, "-").toLowerCase()}`;
        const cb = createEl("input", { type: "checkbox", id });
        cb.addEventListener("change", () => {
          if (cb.checked) state.cats.add(c);
          else state.cats.delete(c);
          apply();
        });

        const label = createEl("label", { htmlFor: id });
        label.append(cb, createEl("span", { text: c }));
        row.append(label);
      });

      // кнопка сброса
      const resetBtn = createEl("button", { className: "cm-btn", type: "button", text: "Сбросить" });
      resetBtn.addEventListener("click", () => {
        state.cats.clear();
        const inputs = filtersBox.querySelectorAll('input[type="checkbox"]');
        inputs.forEach((i) => (i.checked = false));
        apply();
      });

      filtersBox.append(row, resetBtn);

      state.filtersReady = true;
    };

    if (input) {
      input.addEventListener("input", () => {
        state.q = (input.value || "").trim().toLowerCase();
        apply();
      });
    }

    if (btn && filtersBox) {
      btn.addEventListener("click", () => {
        buildFilters();
        filtersBox.hidden = !filtersBox.hidden;
      });
    }

    apply();
  }

  function init() {
    document.body.addEventListener("click", async (e) => {
      const link = e.target.closest(".modal-link");
      if (!link) return;

      e.preventDefault();
      const pageId = link.id;
      if (!pageId) return;

      const box = createEl("div", { className: "character-modal" });
      box.append(
        createEl("div", {
          style: "padding:2em; text-align:center;",
          text: config.loadingText,
        })
      );

      const { close } = window.helpers.modal.openModal(box);

      // закрытие по кнопке внутри контента
      box.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-modal-close]")) {
          ev.preventDefault();
          close();
        }
      });

      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`);
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);
        const doc = parseHTML(html);

        const character = doc.querySelector(".character");
        box.textContent = "";

        const tabParams = {
          tabSelector: `.${classes.tab}`,
          contentSelector: `.${classes.tabContent}`,
          activeClass: classes.active,
        };

        const root = character || box;

        if (character) box.append(character);
        else box.append(...Array.from(doc.body.childNodes));

        // user id берём максимально надёжно
        const targetUid =
          link.dataset.userId ||
          link.dataset.uid ||
          root.querySelector(".character")?.dataset.userId ||
          root.querySelector("[data-user-id]")?.dataset.userId ||
          root.querySelector(".character")?.getAttribute("data-user-id");

        // Добавляем вкладку "Подарки" из awards (без дублей)
        if (config.showAwards && targetUid) {
          const giftsUI = ensureGiftsTabAndPanel(root.querySelector(".character") || root);
          if (giftsUI) {
            const panel = giftsUI.panel;
            fetchAwardsAsGifts(targetUid)
              .then((gifts) => renderGifts(panel, gifts))
              .catch(() => {
                const r = panel.querySelector("[data-gifts-root]") || panel;
                r.textContent = config.awardsErrorText;
              });
          }
        }

        // Инициализация вкладок (после возможного добавления gifts)
        initTabs(root.querySelector(".character") || root, tabParams);

        // Инвентарь: поиск/фильтры
        initInventoryUI(root.querySelector(".character") || root);
      } catch (err) {
        box.textContent = "";
        box.append(
          createEl("div", {
            style: "padding:2em; color:red;",
            text: config.errorText,
          })
        );
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register("characterModal", { init });
})();
