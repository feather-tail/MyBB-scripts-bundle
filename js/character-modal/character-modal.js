(() => {
  "use strict";

  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;

  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",
    showAwards: true,
    awardsErrorText: "Ошибка загрузки подарков.",
    awardsEmptyText: "Подарков нет.",
    awardsApi: "https://core.rusff.me/rusff.php",
    ajaxFolder: "",
    charset: "utf-8",
    classes: {
      tabs: "modal__tabs",
      tab: "modal__tab",
      tabContent: "modal__content",
      active: "active",
    },
  });

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

  const numFrom = (x) => {
    const n = parseInt(String(x ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const colorLink = (t01) => {
    const t = Math.min(1, Math.max(0, t01));
    const hue = 8 + 36 * t;
    const sat = 75;
    const light = 40 + 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const colorTaint = (t01) => {
    const t = Math.min(1, Math.max(0, t01));
    const hue = 120;
    const sat = 45 + 35 * t;
    const light = 44 - 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const applyMeter = (root) => {
    const linkRow = root.querySelector('.cm-barrow[data-meter="link"]');
    const taintRow = root.querySelector('.cm-barrow[data-meter="taint"]');
    const linkFill = linkRow?.querySelector(".cm-bar__fill");
    const taintFill = taintRow?.querySelector(".cm-bar__fill");

    const linkLevel = numFrom(root.getAttribute("data-link-level"));
    const linkMax = Math.max(1, numFrom(root.getAttribute("data-link-max")) || 10);

    const taintLevel = numFrom(root.getAttribute("data-taint-level"));
    const taintMax = Math.max(1, numFrom(root.getAttribute("data-taint-max")) || 10);

    const linkT = linkLevel / linkMax;
    const taintT = taintLevel / taintMax;

    if (linkFill) {
      linkFill.style.width = `${Math.round(linkT * 100)}%`;
      linkFill.style.background = colorLink(linkT);
      const v = linkRow.querySelector("[data-meter-value]");
      if (v) v.textContent = `${linkLevel} ур.`;
    }
    if (taintFill) {
      taintFill.style.width = `${Math.round(taintT * 100)}%`;
      taintFill.style.background = colorTaint(taintT);
      const v = taintRow.querySelector("[data-meter-value]");
      if (v) v.textContent = `${taintLevel} ур.`;
    }
  };

  const ensureEmptySlots = (slotsEl, targetCount = 24) => {
    if (!slotsEl) return;
    const items = slotsEl.querySelectorAll(".cm-slot--item").length;
    const emptiesNeeded = Math.max(0, targetCount - items);
    slotsEl.querySelectorAll(".cm-slot--empty").forEach((n) => n.remove());
    for (let i = 0; i < emptiesNeeded; i++) {
      const empty = document.createElement("div");
      empty.className = "cm-slot cm-slot--empty";
      empty.setAttribute("aria-hidden", "true");
      slotsEl.append(empty);
    }
  };

  const setInfoBox = (infoBox, data) => {
    if (!infoBox) return;
    const img = infoBox.querySelector("[data-info-img]");
    const name = infoBox.querySelector("[data-info-name]");
    const cat = infoBox.querySelector("[data-info-cat]");
    const desc = infoBox.querySelector("[data-info-desc]");

    if (img) {
      img.src = data.img || "https://placehold.co/96x96";
      img.alt = data.name || "";
    }
    if (name) name.textContent = data.name || "—";
    if (cat) cat.textContent = data.cat ? `Категория: ${data.cat}` : "";
    if (desc) desc.textContent = data.desc || "";
  };

  const bindSlotSelection = (root, slotsEl, infoBox) => {
    if (!slotsEl || !infoBox) return;

    const getDataFromBtn = (btn) => ({
      name: btn.getAttribute("data-item-name") || "",
      cat: btn.getAttribute("data-item-cat") || "",
      desc: btn.getAttribute("data-item-desc") || "",
      img: btn.getAttribute("data-item-img") || "",
    });

    const selected = slotsEl.querySelector(".cm-slot--item.is-selected") || slotsEl.querySelector(".cm-slot--item");
    if (selected) setInfoBox(infoBox, getDataFromBtn(selected));

    slotsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".cm-slot--item");
      if (!btn || !slotsEl.contains(btn)) return;

      slotsEl.querySelectorAll(".cm-slot--item.is-selected").forEach((n) => n.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      setInfoBox(infoBox, getDataFromBtn(btn));
    });
  };

  const setupInventorySearchAndFilters = (invRoot) => {
    const input = invRoot.querySelector("[data-inv-search]");
    const slots = invRoot.querySelector('[data-slots="inventory"]');
    const toggle = invRoot.querySelector("[data-filters-toggle]");
    const panel = invRoot.querySelector("[data-filters-panel]");
    const clearBtn = invRoot.querySelector("[data-filters-clear]");
    const closeBtn = invRoot.querySelector("[data-filters-close]");
    const checks = Array.from(invRoot.querySelectorAll("[data-filter]"));

    let isOpen = false;

    const getActiveCats = () => checks.filter((c) => c.checked).map((c) => c.value);

    const applyFilter = () => {
      const q = (input?.value || "").trim().toLowerCase();
      const cats = getActiveCats();

      const items = Array.from(slots?.querySelectorAll(".cm-slot--item") || []);
      for (const btn of items) {
        const name = (btn.getAttribute("data-item-name") || "").toLowerCase();
        const cat = btn.getAttribute("data-item-cat") || "";
        const okQ = !q || name.includes(q);
        const okC = !cats.length || cats.includes(cat);
        btn.style.display = okQ && okC ? "" : "none";
      }
    };

    const setOpen = (open) => {
      if (!panel || !toggle) return;
      isOpen = open;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    const onDocClick = (e) => {
      if (!isOpen) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (input) input.addEventListener("input", applyFilter);

    if (toggle && panel) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        setOpen(!isOpen);
      });

      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);

      if (closeBtn) closeBtn.addEventListener("click", () => setOpen(false));
      if (clearBtn)
        clearBtn.addEventListener("click", () => {
          checks.forEach((c) => (c.checked = false));
          applyFilter();
        });

      checks.forEach((c) => c.addEventListener("change", applyFilter));
    }

    applyFilter();

    return () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  };

  const renderGiftsIntoSlots = (slotsEl, awards) => {
    if (!slotsEl) return;
    slotsEl.textContent = "";

    const makeBtn = (a) => {
      const btn = document.createElement("button");
      btn.className = "cm-slot cm-slot--item";
      btn.type = "button";
      btn.setAttribute("data-item-name", a.name || "Подарок");
      btn.setAttribute("data-item-cat", "");
      btn.setAttribute("data-item-desc", a.desc || "");
      btn.setAttribute("data-item-img", a.img || "");
      const img = document.createElement("img");
      img.src = a.img || "https://placehold.co/96x96";
      img.alt = "";
      btn.append(img);
      return btn;
    };

    awards.forEach((a, i) => {
      const btn = makeBtn(a);
      if (i === 0) btn.classList.add("is-selected");
      slotsEl.append(btn);
    });

    ensureEmptySlots(slotsEl, 24);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        document.body.removeChild(ta);
        return false;
      }
    }
  };

  const getBgUrl = (el) => {
    const bg = getComputedStyle(el).backgroundImage || "";
    const m = bg.match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : "";
  };

  const setupAppearancePickersAndCopy = (root) => {
    const icons = Array.from(root.querySelectorAll(".cm-appearance .cm-icon"));
    const bgs = Array.from(root.querySelectorAll(".cm-appearance .cm-bg"));

    const setActive = (list, el) => {
      list.forEach((x) => x.classList.remove("is-active"));
      el.classList.add("is-active");
    };

    const getUrlFromBtn = (btn) => {
      const direct = btn.dataset.url || btn.getAttribute("data-url");
      if (direct) return direct;
      const img = btn.querySelector("img");
      if (img) return img.currentSrc || img.src || "";
      const thumb = btn.querySelector(".cm-bg__thumb");
      if (thumb) return getBgUrl(thumb) || getBgUrl(btn);
      return getBgUrl(btn);
    };

    const onClick = async (btn, list) => {
      setActive(list, btn);
      const url = getUrlFromBtn(btn);
      if (!url) return;
      const ok = await copyText(url);
      btn.classList.add("is-copied");
      const prevTitle = btn.getAttribute("title") || "";
      btn.setAttribute("title", ok ? "Ссылка скопирована" : "Не удалось скопировать");
      window.setTimeout(() => {
        btn.classList.remove("is-copied");
        if (prevTitle) btn.setAttribute("title", prevTitle);
        else btn.removeAttribute("title");
      }, 900);
    };

    icons.forEach((btn) => btn.addEventListener("click", () => onClick(btn, icons)));
    bgs.forEach((btn) => btn.addEventListener("click", () => onClick(btn, bgs)));
  };

  const enhanceCharacter = (character, { uid, close }) => {
    applyMeter(character);

    const btnClose = character.querySelector("[data-modal-close]");
    if (btnClose && typeof close === "function") {
      btnClose.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    }

    initTabs(character, {
      tabSelector: `.${config.classes.tab}`,
      contentSelector: `.${config.classes.tabContent}`,
      activeClass: config.classes.active,
    });

    const invRoot = character.querySelector("[data-inventory]");
    if (invRoot) {
      const slots = invRoot.querySelector('[data-slots="inventory"]');
      ensureEmptySlots(slots, 24);
      bindSlotSelection(character, slots, invRoot.querySelector('[data-info="inventory"]'));
      setupInventorySearchAndFilters(invRoot);
    }

    const achRoot = character.querySelector("[data-ach]");
    if (achRoot) {
      const info = achRoot.querySelector('[data-info="ach"]');
      const p = achRoot.querySelector('[data-slots="player-ach"]');
      ensureEmptySlots(p, 12);
      bindSlotSelection(character, p, info);
      const c = achRoot.querySelector('[data-slots="char-ach"]');
      ensureEmptySlots(c, 12);
      bindSlotSelection(character, c, info);
    }

    setupAppearancePickersAndCopy(character);

    const giftsRoot = character.querySelector("[data-gifts]");
    const giftsSlots = character.querySelector("[data-gifts-root]");
    const giftsInfo = character.querySelector('[data-info="gifts"]');
    const giftsStatus = character.querySelector("[data-gifts-status]");
    let giftsLoaded = false;

    const loadGifts = async () => {
      if (!config.showAwards) return;
      if (giftsLoaded) return;
      giftsLoaded = true;

      try {
        if (giftsStatus) giftsStatus.textContent = "Загрузка…";
        const awards = uid ? await fetchAwards(uid) : [];
        if (!awards.length) {
          if (giftsStatus) giftsStatus.textContent = config.awardsEmptyText;
          if (giftsSlots) {
            giftsSlots.textContent = "";
            ensureEmptySlots(giftsSlots, 24);
          }
          setInfoBox(giftsInfo, { name: "—", cat: "", desc: "Подарков нет.", img: "" });
          return;
        }

        if (giftsStatus) giftsStatus.textContent = "";
        renderGiftsIntoSlots(giftsSlots, awards);
        bindSlotSelection(character, giftsSlots, giftsInfo);
        if (giftsInfo) giftsInfo.classList.add("cm-infobox--gift");
      } catch (e) {
        if (giftsStatus) giftsStatus.textContent = config.awardsErrorText;
      }
    };

    const tryLoadIfActive = () => {
      if (!giftsRoot) return;
      if (giftsRoot.classList.contains(config.classes.active)) loadGifts();
    };

    character.addEventListener("click", () => {
      window.setTimeout(tryLoadIfActive, 0);
    });

    if (giftsSlots) ensureEmptySlots(giftsSlots, 24);
    if (giftsStatus) giftsStatus.textContent = "";
    tryLoadIfActive();
  };

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
          enhanceCharacter(character, { uid: targetUid, close });
        } else {
          box.append(...Array.from(doc.body.childNodes));
          const root = box.querySelector(".character");
          if (root) enhanceCharacter(root, { uid: targetUid, close });
        }
      } catch (err) {
        box.textContent = "";
        box.append(createEl("div", { style: "padding:2em; color:red;", text: config.errorText }));
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register("characterModal", { init });
})();
