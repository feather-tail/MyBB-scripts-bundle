(() => {
  "use strict";

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",

    showGifts: true,
    giftsErrorText: "Ошибка загрузки подарков.",
    giftsEmptyText: "Подарков не найдено.",
    giftsApi: "https://core.rusff.me/rusff.php",

    // сколько слотов минимум показывать (плейсхолдеры)
    minSlots: 20,

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

  const setDot = (root, key, on) => {
    const el = root.querySelector(`[data-cm-dot="${key}"]`);
    if (!el) return;
    el.hidden = !on;
  };

  function padSlots(grid, minSlots) {
    if (!grid) return;
    // удалим старые плейсхолдеры перед пересозданием (на случай реинициализации)
    grid.querySelectorAll(".inv-slot--empty").forEach((n) => n.remove());

    const real = Array.from(grid.querySelectorAll(".inv-slot")).filter(
      (s) => !s.classList.contains("inv-slot--empty")
    ).length;

    const target = Math.max(Number(minSlots) || 0, real);
    for (let i = real; i < target; i++) {
      const ph = document.createElement("div");
      ph.className = "inv-slot inv-slot--empty";
      ph.setAttribute("aria-hidden", "true");
      grid.append(ph);
    }
  }

  function parseLevelFromText(text) {
    const m = String(text || "").match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function applyBarColors(root) {
    const bars = root.querySelectorAll(".cm-barrow[data-bar]");
    bars.forEach((b) => {
      const type = b.dataset.bar;
      const level = Number(b.dataset.level) || parseLevelFromText(b.querySelector(".cm-barrow__value")?.textContent);

      let color = "";
      if (type === "bond") {
        // связь: красные -> золотистые
        if (level <= 2) color = "#a85a5a";
        else if (level <= 5) color = "#c07a3a";
        else if (level <= 8) color = "#d0b050";
        else color = "#e3c66b";
      } else if (type === "taint") {
        // скверна: зелёные
        if (level <= 2) color = "#4aa35a";
        else if (level <= 5) color = "#2f9b4f";
        else if (level <= 8) color = "#1b7e3e";
        else color = "#0f5f2c";
      } else {
        color = "";
      }

      if (color) b.style.setProperty("--cm-bar-color", color);
    });
  }

  function initInventoryPopover(root) {
    const panel = root.querySelector('[data-cm-panel="inventory"]');
    if (!panel) return;

    const input = panel.querySelector(".inv-search");
    const btn = panel.querySelector("[data-inv-filter-btn]");
    const pop = panel.querySelector("[data-inv-popover]");
    const closeBtn = panel.querySelector("[data-inv-close]");
    const resetBtn = panel.querySelector("[data-inv-reset]");
    const filtersRoot = panel.querySelector("[data-inv-filters-root]");
    const grid = panel.querySelector("[data-inv-grid]");
    const empty = panel.querySelector(".inv-empty");

    const detail = panel.querySelector("[data-inv-detail]");
    const dImg = panel.querySelector("[data-inv-detail-img]");
    const dName = panel.querySelector("[data-inv-detail-name]");
    const dMeta = panel.querySelector("[data-inv-detail-meta]");
    const dDesc = panel.querySelector("[data-inv-detail-desc]");

    if (!btn || !pop || !filtersRoot || !grid) return;

    const getRealSlots = () =>
      Array.from(grid.querySelectorAll(".inv-slot")).filter((s) => !s.classList.contains("inv-slot--empty"));

    const state = { q: "", cats: new Set(), built: false };

    const getSlotText = (el) =>
      `${el.dataset.name || ""} ${el.dataset.cat || ""} ${el.dataset.desc || ""} ${el.dataset.tooltip || ""}`.toLowerCase();

    const apply = () => {
      const slots = getRealSlots();
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

      // плейсхолдеры оставляем всегда (не скрываем)
      setDot(root, "inventory", slots.length > 0);
    };

    const build = () => {
      if (state.built) return;
      const slots = getRealSlots();
      const cats = Array.from(new Set(slots.map((s) => (s.dataset.cat || "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ru")
      );

      filtersRoot.textContent = "";
      if (!cats.length) {
        filtersRoot.append(createEl("div", { className: "cm-muted", text: "Категорий нет." }));
        state.built = true;
        return;
      }

      filtersRoot.append(createEl("div", { className: "cm-muted", text: "Категории:" }));

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

      filtersRoot.append(row);
      state.built = true;
    };

    const open = () => { build(); pop.hidden = false; };
    const close = () => { pop.hidden = true; };
    const toggle = () => (pop.hidden ? open() : close());

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggle();
    });

    closeBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      close();
    });

    resetBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.cats.clear();
      filtersRoot.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
      apply();
    });

    input?.addEventListener("input", () => {
      state.q = (input.value || "").trim().toLowerCase();
      apply();
    });

    // click outside closes
    panel.addEventListener("mousedown", (ev) => {
      if (pop.hidden) return;
      const inside = pop.contains(ev.target) || btn.contains(ev.target);
      if (!inside) close();
    });

    // Esc closes
    panel.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
    });

    // смена вкладки закрывает поповер
    root.addEventListener("click", (ev) => {
      if (ev.target.closest(TAB_SEL)) close();
    });

    // detail on click
    grid.addEventListener("click", (ev) => {
      const slot = ev.target.closest(".inv-slot");
      if (!slot || slot.classList.contains("inv-slot--empty")) return;

      grid.querySelectorAll(".inv-slot.is-selected").forEach((s) => s.classList.remove("is-selected"));
      slot.classList.add("is-selected");

      const name = slot.dataset.name || "Предмет";
      const cat = slot.dataset.cat ? `Категория: ${slot.dataset.cat}` : "";
      const desc = slot.dataset.desc || "";
      const img = slot.dataset.img || "";

      if (dName) dName.textContent = name;
      if (dMeta) dMeta.textContent = cat || " ";
      if (dDesc) dDesc.textContent = desc;
      if (dImg) dImg.src = img || "https://placehold.co/96x96";

      if (detail) detail.scrollIntoView({ block: "nearest" });
    });

    apply();
  }

  function initGiftsUI(root, uid) {
    const giftsPanel = root.querySelector('[data-cm-panel="gifts"]');
    const giftsRoot = root.querySelector("[data-gifts-root]");
    const status = root.querySelector(".gifts-status");

    const detail = giftsPanel?.querySelector("[data-gifts-detail]");
    const dImg = giftsPanel?.querySelector("[data-gifts-detail-img]");
    const dName = giftsPanel?.querySelector("[data-gifts-detail-name]");
    const dMeta = giftsPanel?.querySelector("[data-gifts-detail-meta]");
    const dDesc = giftsPanel?.querySelector("[data-gifts-detail-desc]");

    if (!giftsPanel || !giftsRoot || !uid || !config.showGifts) return;

    if (status) status.textContent = config.loadingText;
    giftsRoot.textContent = "";

    fetchGifts(uid)
      .then((gifts) => {
        const count = gifts?.length || 0;

        setDot(root, "gifts", count > 0);

        if (!count) {
          if (status) status.textContent = config.giftsEmptyText;
          // всё равно сделаем пустую сетку с плейсхолдерами
          const grid = createEl("div", { className: "inv-grid", attrs: { "data-gifts-grid": "1" } });
          giftsRoot.append(grid);
          padSlots(grid, config.minSlots);
          return;
        }

        if (status) status.textContent = "";

        const grid = createEl("div", { className: "inv-grid", attrs: { "data-gifts-grid": "1" } });

        gifts.forEach((g) => {
          const tooltip = [g.name, g.desc].filter(Boolean).join("\n") || "Подарок";

          const slot = createEl("button", { className: "inv-slot cm-tip", type: "button" });
          slot.dataset.tooltip = tooltip;

          slot.dataset.name = g.name || "Подарок";
          slot.dataset.desc = g.desc || "";
          slot.dataset.img = g.img || "";

          if (g.img) slot.style.setProperty("--slot-img", `url("${g.img}")`);
          grid.append(slot);
        });

        giftsRoot.append(grid);

        // плейсхолдеры
        padSlots(grid, config.minSlots);

        // detail click
        grid.addEventListener("click", (ev) => {
          const slot = ev.target.closest(".inv-slot");
          if (!slot || slot.classList.contains("inv-slot--empty")) return;

          grid.querySelectorAll(".inv-slot.is-selected").forEach((s) => s.classList.remove("is-selected"));
          slot.classList.add("is-selected");

          const name = slot.dataset.name || "Подарок";
          const desc = slot.dataset.desc || "";
          const img = slot.dataset.img || "";

          if (dName) dName.textContent = name;
          if (dMeta) dMeta.textContent = " ";
          if (dDesc) dDesc.textContent = desc;
          if (dImg) dImg.src = img || "https://placehold.co/96x96";

          if (detail) detail.scrollIntoView({ block: "nearest" });
        });
      })
      .catch(() => {
        if (status) status.textContent = config.giftsErrorText;
      });
  }

  function initAppearancePickers(root) {
    const ap = root.querySelector('[data-cm-panel="appearance"]');
    if (!ap) return;

    const iconWrap = ap.querySelector("[data-ap-icons]");
    const bgWrap = ap.querySelector("[data-ap-bgs]");
    const iconPreview = ap.querySelector("[data-ap-icon-preview]");
    const bgPreview = ap.querySelector("[data-ap-bg-preview]");

    iconWrap?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-icon]");
      if (!btn) return;

      iconWrap.querySelectorAll(".cm-icon").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const name = btn.dataset.icon || "fa-feather";
      if (iconPreview) {
        iconPreview.innerHTML = "";
        const i = document.createElement("i");
        i.className = `fa-solid ${name}`;
        i.setAttribute("aria-hidden", "true");
        iconPreview.append(i);
      }
    });

    bgWrap?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-bg]");
      if (!btn) return;

      bgWrap.querySelectorAll(".cm-bg").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const url = btn.dataset.bg || "";
      if (bgPreview) bgPreview.style.backgroundImage = url ? `url("${url}")` : "";
    });
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

  function initDots(root) {
    const invSlots = root.querySelectorAll('[data-cm-panel="inventory"] [data-inv-grid] .inv-slot:not(.inv-slot--empty)').length;
    setDot(root, "inventory", invSlots > 0);

    const achSlots = root.querySelectorAll('[data-cm-panel="achievements"] .ach-slot').length;
    setDot(root, "achievements", achSlots > 0);

    // gifts dot ставится после загрузки
  }

  function initPlaceholders(root) {
    const invGrid = root.querySelector('[data-cm-panel="inventory"] [data-inv-grid]');
    if (invGrid) padSlots(invGrid, config.minSlots);
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
        initDots(root);
        initPlaceholders(root);

        applyBarColors(root);

        initInventoryPopover(root);
        initAppearancePickers(root);

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
