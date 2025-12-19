(() => {
  "use strict";

  const helpers = window.helpers;
  if (!helpers) return;

  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",

    // загрузка html страницы персонажа:
    ajaxFolder: "",        // например: "/pages/characters/"
    charset: "utf-8",

    // Достижения игрока (из rusff awards/index)
    showAwards: true,
    awardsApi: "https://core.rusff.me/rusff.php",
    awardsErrorText: "Не удалось загрузить достижения.",
    awardsEmptyText: "Достижений пока нет.",
  });

  // ---------- RPC cache ----------
  const rpcCache = new Map();
  const rpcInflight = new Map();
  const awardsCache = new Map();

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

  const fetchAwards = (uid) => {
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
            name: a.item?.name || "Достижение",
            desc: a.desc || a.item?.name || "",
            img: a.item?.href || "",
            cat: "Игрок",
          });
        }
      }
      return res;
    });

    awardsCache.set(uid, p);
    return p;
  };

  // ---------- UI helpers ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  const colorLink = (t) => {
    // red (0deg) -> gold (45deg)
    const hue = 0 + 45 * t;
    const sat = 75;
    const light = 45 + 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const colorTaint = (t) => {
    // light green -> darker green
    const hue = 120 + 20 * t;
    const sat = 55 + 20 * t;
    const light = 42 - 8 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const applyBars = (root) => {
    const rows = root.querySelectorAll(".cm-stat-row[data-kind]");
    rows.forEach((row) => {
      const kind = row.dataset.kind;
      const lvl = Number(row.dataset.level || 0);
      const max = Number(row.dataset.max || 10) || 10;
      const t = clamp01(lvl / max);

      const fill = row.querySelector(".cm-bar__fill");
      if (fill) {
        fill.style.width = `${Math.round(t * 100)}%`;
        const c = kind === "taint" ? colorTaint(t) : colorLink(t);
        fill.style.background = c;
      }

      // синхронизируем текст уровня (если есть)
      const txt = row.querySelector("[data-level-text]");
      if (txt) txt.textContent = String(lvl);

      // aria
      const bar = row.querySelector(".cm-bar");
      if (bar) {
        const label = kind === "taint" ? "Скверна" : "Связь";
        bar.setAttribute("aria-label", `${label}: ${lvl} ур.`);
      }
    });
  };

  const initCollection = (collectionEl) => {
    if (!collectionEl) return;

    const slotsRoot = collectionEl.querySelector("[data-slots]");
    const info = collectionEl.querySelector("[data-info]");
    if (!slotsRoot || !info) return;

    const pick = (slot) => {
      const slots = slotsRoot.querySelectorAll("[data-slot]");
      slots.forEach((s) => s.classList.remove("is-active"));
      if (slot) slot.classList.add("is-active");

      const name = slot?.dataset.name || "—";
      const cat = slot?.dataset.cat || "";
      const desc = slot?.dataset.desc || "";
      const img = slot?.dataset.img || "";

      const iName = info.querySelector("[data-info-name]");
      const iMeta = info.querySelector("[data-info-meta]");
      const iDesc = info.querySelector("[data-info-desc]");
      const iImg = info.querySelector("[data-info-img]");

      if (iName) iName.textContent = name;
      if (iMeta) iMeta.textContent = cat ? `Категория: ${cat}` : "";
      if (iDesc) iDesc.textContent = desc || "";
      if (iImg) {
        if (img) iImg.src = img;
      }
    };

    const onClick = (e) => {
      const btn = e.target.closest("[data-slot]");
      if (!btn || !slotsRoot.contains(btn)) return;
      pick(btn);
    };

    slotsRoot.addEventListener("click", onClick);

    // выбрать первый доступный слот
    const first = slotsRoot.querySelector("[data-slot]");
    if (first) pick(first);
  };

  const observeSlots = (slotsRoot, onChange) => {
    if (!slotsRoot) return;
    const mo = new MutationObserver(() => onChange());
    mo.observe(slotsRoot, { childList: true, subtree: true });
  };

  const initInventory = (root) => {
    const search = root.querySelector("[data-inv-search]");
    const filtersToggle = root.querySelector("[data-inv-filters-toggle]");
    const filters = root.querySelector("[data-inv-filters]");
    const filtersClose = root.querySelector("[data-inv-filters-close]");
    const resetBtn = root.querySelector("[data-inv-reset]");
    const chips = root.querySelector("[data-inv-chips]");
    const invCollection = root.querySelector(".modal__content:nth-of-type(2) [data-collection]");

    let activeCat = "all";

    const closeFilters = () => {
      if (filters) filters.classList.remove("is-open");
    };
    const openFilters = () => {
      if (filters) filters.classList.add("is-open");
    };
    const toggleFilters = () => {
      if (!filters) return;
      filters.classList.toggle("is-open");
    };

    const matchSlot = (slot, q, cat) => {
      const name = (slot.dataset.name || "").toLowerCase();
      const slotCat = (slot.dataset.cat || "");
      const okQ = !q || name.includes(q);
      const okC = !cat || cat === "all" || slotCat === cat;
      return okQ && okC;
    };

    const applyFilter = () => {
      const q = (search?.value || "").trim().toLowerCase();
      const slots = invCollection?.querySelectorAll("[data-slots] [data-slot]") || [];
      slots.forEach((slot) => {
        const ok = matchSlot(slot, q, activeCat);
        slot.style.display = ok ? "" : "none";
      });

      // если активный скрыт — выбрать первый видимый
      const active = invCollection?.querySelector("[data-slots] [data-slot].is-active");
      if (active && active.style.display === "none") {
        active.classList.remove("is-active");
      }
      const firstVisible = Array.from(slots).find((s) => s.style.display !== "none");
      if (firstVisible && !invCollection?.querySelector("[data-slots] [data-slot].is-active")) {
        firstVisible.click();
      }
    };

    if (search) {
      search.addEventListener("input", applyFilter);
    }

    if (filtersToggle) {
      filtersToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFilters();
      });
    }

    if (filtersClose) {
      filtersClose.addEventListener("click", (e) => {
        e.preventDefault();
        closeFilters();
      });
    }

    if (chips) {
      chips.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cat]");
        if (!btn) return;

        chips.querySelectorAll(".cm-chip").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        activeCat = btn.dataset.cat || "all";
        applyFilter();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        activeCat = "all";
        if (chips) {
          chips.querySelectorAll(".cm-chip").forEach((b) => b.classList.remove("is-active"));
          const all = chips.querySelector('[data-cat="all"]');
          if (all) all.classList.add("is-active");
        }
        if (search) search.value = "";
        applyFilter();
        closeFilters();
      });
    }

    // клик вне фильтров закрывает
    document.addEventListener("click", (e) => {
      if (!filters || !filters.classList.contains("is-open")) return;
      const inside = e.target.closest("[data-inv-filters]") || e.target.closest("[data-inv-filters-toggle]");
      if (!inside) closeFilters();
    });

    // Esc закрывает
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFilters();
    });

    // при клике по вкладкам — закрыть фильтры
    const tabs = root.querySelector(".modal__tabs");
    if (tabs) {
      tabs.addEventListener("click", () => closeFilters());
    }

    // init slots collection behavior
    const col = root.querySelector(".modal__content:nth-of-type(2) [data-collection]");
    if (col) initCollection(col);

    applyFilter();
  };

  const initAllCollections = (root) => {
    root.querySelectorAll("[data-collection]").forEach(initCollection);

    // подарки будут добавлены позже — переинициализируем при появлении
    const giftsRoot = root.querySelector("[data-gifts-root]");
    if (giftsRoot) {
      observeSlots(giftsRoot, () => {
        const col = giftsRoot.closest("[data-collection]");
        if (col) initCollection(col);
      });
    }

    // достижения игрока (awards) добавим позже — тоже отслеживаем
    const awardsRoot = root.querySelector("[data-awards-root]");
    if (awardsRoot) {
      observeSlots(awardsRoot, () => {
        const col = awardsRoot.closest("[data-collection]");
        if (col) initCollection(col);
      });
    }
  };

  const renderAwardsInto = (awardsRoot, awards) => {
    awardsRoot.textContent = "";
    if (!awards.length) return;

    awards.forEach((a, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cm-slot" + (idx === 0 ? " is-active" : "");
      btn.setAttribute("data-slot", "");
      btn.dataset.name = a.name || "Достижение";
      btn.dataset.cat = a.cat || "Игрок";
      btn.dataset.desc = a.desc || "";
      btn.dataset.img = a.img || "";
      btn.dataset.count = "1";

      const img = document.createElement("img");
      img.className = "cm-slot__img";
      img.alt = "";
      img.src = a.img || "https://placehold.co/96x96";

      btn.appendChild(img);
      awardsRoot.appendChild(btn);
    });
  };

  const loadAwards = async (root, uid) => {
    const awardsRoot = root.querySelector("[data-awards-root]");
    const awardsInfo = awardsRoot?.closest("[data-collection]")?.querySelector("[data-info]");
    if (!awardsRoot || !awardsInfo) return;

    // заглушка в инфо
    const iName = awardsInfo.querySelector("[data-info-name]");
    const iDesc = awardsInfo.querySelector("[data-info-desc]");
    if (iName) iName.textContent = "Загрузка…";
    if (iDesc) iDesc.textContent = "";

    try {
      const awards = await fetchAwards(uid);
      if (!awards.length) {
        awardsRoot.textContent = "";
        if (iName) iName.textContent = config.awardsEmptyText;
        if (iDesc) iDesc.textContent = "";
        return;
      }
      renderAwardsInto(awardsRoot, awards);
      // инициируем коллекцию заново (выбор/инфо)
      const col = awardsRoot.closest("[data-collection]");
      if (col) initCollection(col);
    } catch (e) {
      if (iName) iName.textContent = config.awardsErrorText;
      if (iDesc) iDesc.textContent = "";
    }
  };

  const initCharacterUI = (root, closeFn, targetUid) => {
    // close
    const closeBtn = root.querySelector("[data-modal-close]");
    if (closeBtn && typeof closeFn === "function") {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeFn();
      });
    }

    // tabs
    initTabs(root, {
      tabSelector: ".modal__tab",
      contentSelector: ".modal__content",
      activeClass: "active",
    });

    // bars color/width
    applyBars(root);

    // collections
    initAllCollections(root);

    // inventory features
    initInventory(root);

    // awards -> achievements tab
    if (config.showAwards && targetUid) loadAwards(root, targetUid);

    // событие для внешнего скрипта подарков (если нужен)
    document.dispatchEvent(
      new CustomEvent("ks:characterModal:opened", {
        detail: { root, uid: targetUid || null },
      })
    );
  };

  // ---------- modal open ----------
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

      const { close } = helpers.modal.openModal(box);

      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`);
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);

        const doc = parseHTML(html);
        const character = doc.querySelector(".character");

        let targetUid =
          link.dataset.userId ||
          link.dataset.uid ||
          character?.dataset.userId ||
          doc.querySelector("[data-user-id]")?.dataset.userId;

        box.textContent = "";

        if (character) {
          box.append(character);
          initCharacterUI(character, close, targetUid);
        } else {
          // fallback: показать весь body, но попытаться инициализировать
          const wrap = createEl("div");
          wrap.append(...Array.from(doc.body.childNodes));
          box.append(wrap);

          const ch = box.querySelector(".character");
          if (ch) initCharacterUI(ch, close, targetUid);
        }
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
