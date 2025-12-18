(() => {
  "use strict";

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",

    // для gifts (awards/index)
    showGifts: true,
    giftsErrorText: "Ошибка загрузки подарков.",
    giftsEmptyText: "Подарков не найдено.",
    giftsApi: "https://core.rusff.me/rusff.php",

    // нужные для загрузки страницы персонажа (если не заданы глобально)
    ajaxFolder: "",
    charset: "utf-8",
  });

  const TAB_SEL = ".modal__tab";
  const PANEL_SEL = ".modal__content";
  const ACTIVE = "active";

  const rpcCache = new Map();
  const rpcInflight = new Map();
  const giftsCache = new Map();

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

    const p = fetch(config.giftsApi, {
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

  const fetchGifts = (uid) => {
    if (giftsCache.has(uid)) return giftsCache.get(uid);

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

    giftsCache.set(uid, p);
    return p;
  };

  function initGiftsUI(root, uid) {
    const giftsRoot = root.querySelector("[data-gifts-root]");
    const status = root.querySelector(".gifts-status");
    if (!giftsRoot || !uid || !config.showGifts) return;

    if (status) status.textContent = config.loadingText;
    giftsRoot.textContent = "";

    fetchGifts(uid)
      .then((gifts) => {
        if (!gifts || !gifts.length) {
          if (status) status.textContent = config.giftsEmptyText;
          return;
        }
        if (status) status.textContent = "";

        const grid = createEl("div", { className: "inv-grid" });

        gifts.forEach((g) => {
          const lines = [];
          if (g.name) lines.push(g.name);
          if (g.desc) lines.push(g.desc);

          const slot = createEl("button", {
            className: "inv-slot cm-tip",
            type: "button",
          });

          slot.dataset.tooltip = lines.join("\n") || "Подарок";
          if (g.img) slot.style.setProperty("--slot-img", `url("${g.img}")`);

          grid.append(slot);
        });

        giftsRoot.append(grid);
      })
      .catch(() => {
        if (status) status.textContent = config.giftsErrorText;
      });
  }

  function initInventoryUI(root) {
    const panel = root.querySelectorAll(PANEL_SEL)[1]; // 2-я вкладка = Инвентарь
    if (!panel) return;

    const input = panel.querySelector(".inv-search");
    const btn = panel.querySelector(".inv-filter-btn");
    const filtersBox = panel.querySelector(".inv-filters");
    const grid = panel.querySelector("[data-inv-grid]");
    const empty = panel.querySelector(".inv-empty");
    if (!grid) return;

    const slots = Array.from(grid.querySelectorAll(".inv-slot"));

    const state = { q: "", cats: new Set(), filtersBuilt: false };

    const getSlotText = (el) =>
      `${el.dataset.name || ""} ${el.dataset.cat || ""} ${el.dataset.tooltip || ""}`.toLowerCase();

    const apply = () => {
      let shown = 0;
      for (const s of slots) {
        const text = getSlotText(s);
        const cat = (s.dataset.cat || "").trim();

        const okQ = !state.q || text.includes(state.q);
        const okC = !state.cats.size || (cat && state.cats.has(cat));
        const ok = okQ && okC;

        s.hidden = !ok;
        if (ok) shown++;
      }
      if (empty) empty.hidden = shown !== 0;
    };

    const buildFilters = () => {
      if (!filtersBox || state.filtersBuilt) return;

      const cats = Array.from(
        new Set(slots.map((s) => (s.dataset.cat || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "ru"));

      filtersBox.textContent = "";
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

      const resetBtn = createEl("button", { className: "cm-btn", type: "button", text: "Сбросить" });
      resetBtn.addEventListener("click", () => {
        state.cats.clear();
        filtersBox.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
        apply();
      });

      filtersBox.append(row, resetBtn);
      state.filtersBuilt = true;
    };

    const closeFilters = () => {
      if (filtersBox) filtersBox.hidden = true;
    };

    if (input) {
      input.addEventListener("input", () => {
        state.q = (input.value || "").trim().toLowerCase();
        apply();
      });
    }

    if (btn && filtersBox) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        buildFilters();
        filtersBox.hidden = !filtersBox.hidden; // toggle (теперь реально работает, см. CSS [hidden])
      });
    }

    // закрытие по клику вне фильтров
    panel.addEventListener("mousedown", (ev) => {
      if (!filtersBox || filtersBox.hidden) return;
      const inside = filtersBox.contains(ev.target) || (btn && btn.contains(ev.target));
      if (!inside) closeFilters();
    });

    // закрытие по Esc
    panel.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeFilters();
    });

    // при переключении вкладок — закрыть
    root.addEventListener("click", (ev) => {
      if (ev.target.closest(TAB_SEL)) closeFilters();
    });

    apply();
  }

  function initTabsSafe(root) {
    const tabParams = {
      tabSelector: TAB_SEL,
      contentSelector: PANEL_SEL,
      activeClass: ACTIVE,
    };

    if (typeof initTabs === "function") {
      initTabs(root, tabParams);
      return;
    }

    // fallback
    const tabs = Array.from(root.querySelectorAll(TAB_SEL));
    const panels = Array.from(root.querySelectorAll(PANEL_SEL));
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => {
        tabs.forEach((x) => x.classList.remove(ACTIVE));
        panels.forEach((x) => x.classList.remove(ACTIVE));
        t.classList.add(ACTIVE);
        if (panels[i]) panels[i].classList.add(ACTIVE);
      });
    });
  }

  function init() {
    document.body.addEventListener("click", async (e) => {
      const link = e.target.closest(".modal-link");
      if (!link) return;

      e.preventDefault();
      const pageId = link.id;
      if (!pageId) return;

      const box = createEl("div", { className: "character-modal" });
      box.append(createEl("div", { style: "padding:2em; text-align:center;", text: config.loadingText }));

      const { close } = window.helpers.modal.openModal(box);

      // close button inside markup
      box.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-modal-close]")) {
          ev.preventDefault();
          close();
        }
      });

      try {
        const res = await helpers.request(`${config.ajaxFolder || ""}${pageId}`);
        const buf = await res.arrayBuffer();
        const html = new TextDecoder(config.charset || "utf-8").decode(buf);

        const doc = parseHTML(html);
        const character = doc.querySelector(".character");

        box.textContent = "";
        if (character) box.append(character);
        else box.append(...Array.from(doc.body.childNodes));

        const root = box.querySelector(".character") || box;

        const targetUid =
          link.dataset.userId ||
          link.dataset.uid ||
          root.dataset.userId ||
          root.querySelector("[data-user-id]")?.dataset.userId;

        initTabsSafe(root);
        initInventoryUI(root);
        if (targetUid) initGiftsUI(root, targetUid);
      } catch (err) {
        box.textContent = "";
        box.append(createEl("div", { style: "padding:2em; color:red;", text: config.errorText }));
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register("characterModal", { init });
})();
