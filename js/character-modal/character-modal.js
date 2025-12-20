(() => {
  "use strict";

  const helpers = window.helpers || null;

  const getConfig = (key, fallback) => {
    if (helpers?.getConfig) return helpers.getConfig(key, fallback);
    return fallback;
  };

  const config = getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",

    showAwards: true,
    awardsErrorText: "Ошибка загрузки подарков.",
    awardsEmptyText: "Подарков нет.",
    awardsApi: "https://core.rusff.me/rusff.php",

    ajaxFolder: "",
    charset: "utf-8",

    cacheTtlMs: 20 * 60 * 1000,
    inventorySearchDebounceMs: 110,
    skeletonCount: 24,
  });

  const qs = (root, sel) => (root ? root.querySelector(sel) : null);
  const qsa = (root, sel) => (root ? Array.from(root.querySelectorAll(sel)) : []);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

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

  const numFrom = (x) => {
    const n = parseInt(String(x ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const colorLink = (t01) => {
    const t = clamp01(t01);
    const hue = 8 + 36 * t;
    const sat = 75;
    const light = 40 + 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const colorTaint = (t01) => {
    const t = clamp01(t01);
    const hue = 120;
    const sat = 45 + 35 * t;
    const light = 44 - 10 * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const applyMeter = (root) => {
    const linkRow = qs(root, '.cm-barrow[data-meter="link"]');
    const taintRow = qs(root, '.cm-barrow[data-meter="taint"]');
    const linkFill = qs(linkRow, ".cm-bar__fill");
    const taintFill = qs(taintRow, ".cm-bar__fill");

    const linkLevel = numFrom(root.getAttribute("data-link-level"));
    const linkMax = Math.max(1, numFrom(root.getAttribute("data-link-max")) || 10);

    const taintLevel = numFrom(root.getAttribute("data-taint-level"));
    const taintMax = Math.max(1, numFrom(root.getAttribute("data-taint-max")) || 10);

    const linkT = linkLevel / linkMax;
    const taintT = taintLevel / taintMax;

    if (linkFill) {
      linkFill.style.width = `${Math.round(linkT * 100)}%`;
      linkFill.style.background = colorLink(linkT);
      const v = qs(linkRow, "[data-meter-value]");
      if (v) v.textContent = `${linkLevel} ур.`;
    }
    if (taintFill) {
      taintFill.style.width = `${Math.round(taintT * 100)}%`;
      taintFill.style.background = colorTaint(taintT);
      const v = qs(taintRow, "[data-meter-value]");
      if (v) v.textContent = `${taintLevel} ур.`;
    }
  };

  const applyLazyImages = (root) => {
    qsa(root, "img").forEach((img) => {
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    });
  };

  const createInfoBox = (titleText) => {
    const box = document.createElement("aside");
    box.className = "cm-infobox";
    box.innerHTML = `
      <div class="cm-infobox__title"></div>
      <div class="cm-infobox__body">
        <div class="cm-infobox__img">
          <img src="https://placehold.co/96x96" alt="" data-info-img />
        </div>
        <div class="cm-infobox__text">
          <div class="cm-infobox__name" data-info-name>—</div>
          <div class="cm-infobox__meta" data-info-cat></div>
          <div class="cm-infobox__desc" data-info-desc></div>
        </div>
      </div>
    `;
    const t = qs(box, ".cm-infobox__title");
    if (t) t.textContent = titleText || "Информация";
    applyLazyImages(box);
    return box;
  };

  const getOrCreateInfoBox = (scopeEl, selector, titleText) => {
    if (!scopeEl) return null;
    let box = qs(scopeEl, selector);
    if (box) return box;
    box = createInfoBox(titleText);
    scopeEl.append(box);
    return box;
  };

  const isGiftInfoBox = (infoBox) => {
    if (!infoBox) return false;
    return infoBox.classList.contains("cm-infobox--gift") || infoBox.getAttribute("data-kind") === "gift";
  };

  const setInfoBox = (infoBox, data) => {
    if (!infoBox) return;
    infoBox.classList.add("is-updating");
    window.setTimeout(() => infoBox.classList.remove("is-updating"), 140);

    const img = qs(infoBox, "[data-info-img]");
    const name = qs(infoBox, "[data-info-name]");
    const cat = qs(infoBox, "[data-info-cat]");
    const desc = qs(infoBox, "[data-info-desc]");
    const giftMode = isGiftInfoBox(infoBox);

    if (img) {
      img.src = data.img || "https://placehold.co/96x96";
      img.alt = data.name || "";
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    }

    if (giftMode) {
      if (cat) cat.textContent = "";
      if (name) name.textContent = data.desc || data.name || "—";
      if (desc) desc.textContent = "";
      return;
    }

    if (name) name.textContent = data.name || "—";
    if (cat) cat.textContent = data.cat ? `Категория: ${data.cat}` : "";
    if (desc) desc.textContent = data.desc || "";
  };

  const ensureEmptySlots = (slotsEl, targetCount = 24) => {
    if (!slotsEl) return;
    const items = qsa(slotsEl, ".cm-slot--item").length;
    const emptiesNeeded = Math.max(0, targetCount - items);
    qsa(slotsEl, ".cm-slot--empty").forEach((n) => n.remove());
    qsa(slotsEl, ".cm-slot--skeleton").forEach((n) => n.remove());
    for (let i = 0; i < emptiesNeeded; i++) {
      const empty = document.createElement("div");
      empty.className = "cm-slot cm-slot--empty";
      empty.setAttribute("aria-hidden", "true");
      slotsEl.append(empty);
    }
  };

  const renderSkeletonSlots = (slotsEl, targetCount = 24) => {
    if (!slotsEl) return;
    slotsEl.textContent = "";
    for (let i = 0; i < targetCount; i++) {
      const sk = document.createElement("div");
      sk.className = "cm-slot cm-slot--skeleton";
      sk.setAttribute("aria-hidden", "true");
      slotsEl.append(sk);
    }
  };

  const createStatus = (kind, text) => {
    const el = document.createElement("div");
    el.className = `cm-status${kind === "error" ? " cm-status--error" : ""}`;
    el.innerHTML = `<span class="cm-status__dot" aria-hidden="true"></span><span class="cm-status__text"></span>`;
    qs(el, ".cm-status__text").textContent = text || "";
    return el;
  };

  const setStatus = (scope, { state, text }) => {
    if (!scope) return;
    const old = qs(scope, ".cm-status");
    if (old) old.remove();
    if (!state) return;
    const el = createStatus(state === "error" ? "error" : "info", text || "");
    scope.prepend(el);
  };

  const normalizeItemFromBtn = (btn) => ({
    name: btn.getAttribute("data-item-name") || "",
    cat: btn.getAttribute("data-item-cat") || "",
    desc: btn.getAttribute("data-item-desc") || "",
    img: btn.getAttribute("data-item-img") || "",
    qty: btn.getAttribute("data-item-qty") || "",
  });

  const normalizeAward = (a) => ({
    id: a?.id ?? a?.award_id ?? "",
    name: (a?.name || a?.item?.name || "").trim(),
    desc: (a?.desc || a?.description || "").trim(),
    img: (a?.img || a?.href || a?.item?.href || "").trim(),
  });

  const getGridCols = (gridEl) => {
    if (!gridEl) return 1;
    const css = getComputedStyle(gridEl).gridTemplateColumns || "";
    const cols = css.split(" ").filter(Boolean).length;
    return Math.max(1, cols || 1);
  };

  const setupGridA11y = (slotsEl, getKey) => {
    if (!slotsEl) return () => {};

    slotsEl.setAttribute("role", "grid");
    slotsEl.setAttribute("aria-label", slotsEl.getAttribute("aria-label") || "Сетка");

    const applyRoles = () => {
      const items = qsa(slotsEl, ".cm-slot--item");
      items.forEach((btn, i) => {
        btn.setAttribute("role", "gridcell");
        btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
        const key = getKey(btn);
        if (key) btn.setAttribute("data-cm-key", key);
      });
    };

    applyRoles();

    const moveFocus = (from, toIndex) => {
      const items = qsa(slotsEl, ".cm-slot--item");
      if (!items.length) return;
      const idx = Math.max(0, Math.min(items.length - 1, toIndex));
      items.forEach((b) => b.setAttribute("tabindex", "-1"));
      items[idx].setAttribute("tabindex", "0");
      items[idx].focus({ preventScroll: true });
      if (from) from.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const onKeyDown = (e) => {
      const btn = e.target.closest(".cm-slot--item");
      if (!btn || !slotsEl.contains(btn)) return;

      const items = qsa(slotsEl, ".cm-slot--item");
      const i = items.indexOf(btn);
      if (i < 0) return;

      const cols = getGridCols(slotsEl);

      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveFocus(btn, i + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveFocus(btn, i - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveFocus(btn, i + cols);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocus(btn, i - cols);
      } else if (e.key === "Home") {
        e.preventDefault();
        moveFocus(btn, 0);
      } else if (e.key === "End") {
        e.preventDefault();
        moveFocus(btn, items.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    };

    slotsEl.addEventListener("keydown", onKeyDown);

    return () => {
      slotsEl.removeEventListener("keydown", onKeyDown);
    };
  };

  const bindSlotSelection = (slotsEl, infoBox, getDataFromBtn) => {
    if (!slotsEl || !infoBox) return () => {};

    const setSelected = (btn) => {
      qsa(slotsEl, ".cm-slot--item.is-selected").forEach((n) => n.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      btn.setAttribute("aria-selected", "true");
      qsa(slotsEl, ".cm-slot--item").forEach((x) => {
        if (x !== btn) x.setAttribute("aria-selected", "false");
      });
      setInfoBox(infoBox, getDataFromBtn(btn));
    };

    const initSelected = () => {
      const selected = qs(slotsEl, ".cm-slot--item.is-selected") || qs(slotsEl, ".cm-slot--item");
      if (selected) setSelected(selected);
    };

    initSelected();

    const onClick = (e) => {
      const btn = e.target.closest(".cm-slot--item");
      if (!btn || !slotsEl.contains(btn)) return;
      setSelected(btn);
    };

    slotsEl.addEventListener("click", onClick);

    return () => {
      slotsEl.removeEventListener("click", onClick);
    };
  };

  const debounce = (fn, ms) => {
    let t = 0;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), ms);
    };
  };

  const setupInventorySearchAndFilters = (invRoot) => {
    const input = qs(invRoot, "[data-inv-search]");
    const slots = qs(invRoot, '[data-slots="inventory"]');
    const toggle = qs(invRoot, "[data-filters-toggle]");
    const panel = qs(invRoot, "[data-filters-panel]");
    const clearBtn = qs(invRoot, "[data-filters-clear]");
    const closeBtn = qs(invRoot, "[data-filters-close]");
    const checks = qsa(invRoot, "[data-filter]");

    let isOpen = false;

    const getActiveCats = () => checks.filter((c) => c.checked).map((c) => c.value);

    const applyFilterNow = () => {
      const q = (input?.value || "").trim().toLowerCase();
      const cats = getActiveCats();
      const items = qsa(slots, ".cm-slot--item");
      for (const btn of items) {
        const name = (btn.getAttribute("data-item-name") || "").toLowerCase();
        const cat = btn.getAttribute("data-item-cat") || "";
        const okQ = !q || name.includes(q);
        const okC = !cats.length || cats.includes(cat);
        btn.style.display = okQ && okC ? "" : "none";
      }
    };

    const applyFilter = debounce(applyFilterNow, config.inventorySearchDebounceMs);

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
          applyFilterNow();
        });

      checks.forEach((c) => c.addEventListener("change", applyFilter));
    }

    applyFilterNow();

    return () => {
      if (input) input.removeEventListener("input", applyFilter);
      if (toggle) toggle.replaceWith(toggle.cloneNode(true));
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
      checks.forEach((c) => c.replaceWith(c.cloneNode(true)));
    };
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

  const setupAppearancePickers = (root) => {
    const icons = qsa(root, ".cm-icon");
    const bgs = qsa(root, ".cm-bg");

    const setActive = (list, el) => {
      list.forEach((x) => x.classList.remove("is-active"));
      el.classList.add("is-active");
    };

    const pickAndCopy = async (btn, group) => {
      if (group === "icon") setActive(icons, btn);
      if (group === "bg") setActive(bgs, btn);

      const url =
        btn.dataset.url ||
        btn.getAttribute("data-url") ||
        (qs(btn, "img") && (qs(btn, "img").currentSrc || qs(btn, "img").src)) ||
        getBgUrl(qs(btn, ".cm-bg__thumb") || btn);

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

    const onIcon = (btn) => (e) => {
      e.preventDefault();
      pickAndCopy(btn, "icon");
    };

    const onBg = (btn) => (e) => {
      e.preventDefault();
      pickAndCopy(btn, "bg");
    };

    icons.forEach((btn) => btn.addEventListener("click", onIcon(btn)));
    bgs.forEach((btn) => btn.addEventListener("click", onBg(btn)));

    return () => {
      icons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
      bgs.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
    };
  };

  const initTabsWithEvent = (root) => {
    const tabs = qsa(root, ".modal__tab");
    const panels = qsa(root, ".modal__content");

    const setActive = (key) => {
      tabs.forEach((t) => {
        const isOn = (t.dataset.cmTab || "") === key;
        t.classList.toggle("active", isOn);
        t.setAttribute("aria-selected", isOn ? "true" : "false");
        t.setAttribute("tabindex", isOn ? "0" : "-1");
      });

      panels.forEach((p) => {
        const isOn = (p.dataset.cmContent || "") === key;
        p.classList.toggle("active", isOn);
        if (isOn) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "hidden");
      });

      root.dispatchEvent(new CustomEvent("cm:tabchange", { bubbles: true, detail: { key } }));
    };

    const onClick = (e) => {
      const tab = e.target.closest(".modal__tab");
      if (!tab || !root.contains(tab)) return;
      e.preventDefault();
      const key = tab.dataset.cmTab || "";
      if (!key) return;
      setActive(key);
    };

    const onKeyDown = (e) => {
      const tab = e.target.closest(".modal__tab");
      if (!tab || !root.contains(tab)) return;
      const idx = tabs.indexOf(tab);
      if (idx < 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = e.key === "ArrowRight" ? idx + 1 : idx - 1;
        const t = tabs[(next + tabs.length) % tabs.length];
        t.focus({ preventScroll: true });
        const key = t.dataset.cmTab || "";
        if (key) setActive(key);
      } else if (e.key === "Home") {
        e.preventDefault();
        tabs[0].focus({ preventScroll: true });
        setActive(tabs[0].dataset.cmTab || "");
      } else if (e.key === "End") {
        e.preventDefault();
        tabs[tabs.length - 1].focus({ preventScroll: true });
        setActive(tabs[tabs.length - 1].dataset.cmTab || "");
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);

    const active = qs(root, ".modal__tab.active")?.dataset.cmTab || tabs[0]?.dataset.cmTab || "";
    if (active) setActive(active);

    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
    };
  };

  const focusableSelector =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

  const setupFocusTrap = (dialogEl, onClose) => {
    if (!dialogEl) return () => {};

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = qsa(dialogEl, focusableSelector).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    dialogEl.addEventListener("keydown", onKeyDown);

    return () => {
      dialogEl.removeEventListener("keydown", onKeyDown);
    };
  };

  const rpcCache = new Map();
  const rpcInflight = new Map();
  const awardsCache = new Map();
  const awardsInflight = new Map();

  const rpc = (method, params, signal) => {
    const body = { jsonrpc: "2.0", id: 1, method, params };
    const key = `${method}|${stableStringify(params)}`;

    const cached = rpcCache.get(key);
    if (cached && Date.now() - cached.ts < config.cacheTtlMs) return Promise.resolve(cached.value);

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
      signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("network");
        return r.json();
      })
      .then((j) => j?.result ?? null)
      .finally(() => rpcInflight.delete(key));

    rpcInflight.set(key, p);
    p.then((res) => rpcCache.set(key, { ts: Date.now(), value: res }), () => {});
    return p;
  };

  const fetchAwards = (uid, signal) => {
    const key = String(uid || "");

    const cached = awardsCache.get(key);
    if (cached && Date.now() - cached.ts < config.cacheTtlMs) return Promise.resolve(cached.value);

    if (awardsInflight.has(key)) return awardsInflight.get(key);

    const params = {
      board_id: Number(window.BoardID) || 0,
      user_id: helpers?.getUserId ? helpers.getUserId() : Number(window.UserID) || 0,
      sort: "user",
      users_ids: [String(uid)],
      check: {
        board_id: Number(window.BoardID) || 0,
        user_id: helpers?.getUserId ? helpers.getUserId() : Number(window.UserID) || 0,
        partner_id: Number(window.PartnerID) || 0,
        group_id: helpers?.getGroupId ? helpers.getGroupId() : Number(window.GroupID) || 0,
        user_login: String(window.UserLogin || ""),
        user_avatar: "",
        user_lastvisit: Number(window.UserLastVisit) || 0,
        user_unique_id: String(window.UserUniqueID || ""),
        host: location.host,
        sign: String(window.ForumAPITicket || ""),
      },
    };

    const p = rpc("awards/index", params, signal).then((rows = []) => {
      const u = Array.isArray(rows) ? rows.find((r) => r.user_id === String(uid)) : null;
      const res = [];
      if (u && Array.isArray(u.awards)) {
        for (const a of u.awards) {
          res.push(
            normalizeAward({
              id: a.award_id,
              name: a.item?.name || "",
              desc: a.desc || "",
              img: a.item?.href || "",
            })
          );
        }
      }
      return res;
    });

    awardsInflight.set(key, p);
    p.then(
      (val) => {
        awardsCache.set(key, { ts: Date.now(), value: val });
        awardsInflight.delete(key);
      },
      () => awardsInflight.delete(key)
    );

    return p;
  };

  const renderGiftsIntoSlots = (slotsEl, awards, selectedIndex = 0) => {
    if (!slotsEl) return;

    slotsEl.textContent = "";

    awards.forEach((a, i) => {
      const btn = document.createElement("button");
      btn.className = "cm-slot cm-slot--item";
      btn.type = "button";
      btn.setAttribute("data-item-name", a.name || "Подарок");
      btn.setAttribute("data-item-cat", "");
      btn.setAttribute("data-item-desc", a.desc || "");
      btn.setAttribute("data-item-img", a.img || "");
      btn.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
      const img = document.createElement("img");
      img.src = a.img || "https://placehold.co/96x96";
      img.alt = "";
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      btn.append(img);
      if (i === selectedIndex) btn.classList.add("is-selected");
      slotsEl.append(btn);
    });

    ensureEmptySlots(slotsEl, config.skeletonCount);
  };

  const openModalNative = (contentEl) => {
    const overlay = document.createElement("div");
    overlay.className = "cm-modal-overlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.background = "transparent";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.padding = "12px";
    overlay.append(contentEl);
    document.body.append(overlay);

    const close = () => {
      overlay.remove();
    };

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });

    return { close, overlay };
  };

  const decodeResponseToText = async (res, charset) => {
    const buf = await res.arrayBuffer();
    const decoder = new TextDecoder(charset || "utf-8");
    return decoder.decode(buf);
  };

  const parseHTML = (html) => {
    if (helpers?.parseHTML) return helpers.parseHTML(html);
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  };

  const request = (url, signal) => {
    if (helpers?.request) return helpers.request(url, { signal });
    return fetch(url, { credentials: "same-origin", signal });
  };

  const enhanceCharacter = (character, { uid, close, overlayEl }) => {
    if (!character || character.getAttribute("data-cm-initialized") === "1") return () => {};
    character.setAttribute("data-cm-initialized", "1");

    const cleanups = [];

    applyMeter(character);
    applyLazyImages(character);

    const shell = qs(character, ".cm-shell");
    if (shell && overlayEl) {
      shell.style.margin = "0";
    }

    const btnClose = qs(character, "[data-modal-close]");
    if (btnClose && typeof close === "function") {
      const onClose = (e) => {
        e.preventDefault();
        close();
      };
      btnClose.addEventListener("click", onClose);
      cleanups.push(() => btnClose.removeEventListener("click", onClose));
    }

    const tabsCleanup = initTabsWithEvent(character);
    cleanups.push(tabsCleanup);

    const focusTrapCleanup = setupFocusTrap(shell, close);
    cleanups.push(focusTrapCleanup);

    if (shell) {
      window.setTimeout(() => {
        shell.focus({ preventScroll: true });
      }, 0);
    }

    const invRoot = qs(character, "[data-inventory]");
    if (invRoot) {
      const slots = qs(invRoot, '[data-slots="inventory"]');
      ensureEmptySlots(slots, 24);
      const info = getOrCreateInfoBox(qs(invRoot, ".cm-two") || invRoot, '[data-info="inventory"]', "Информация");
      if (info && !info.getAttribute("data-info")) info.setAttribute("data-info", "inventory");

      setStatus(invRoot, { state: null });

      const selectCleanup = bindSlotSelection(slots, info, (btn) => normalizeItemFromBtn(btn));
      const gridCleanup = setupGridA11y(slots, (btn) => btn.getAttribute("data-item-name") || "");
      const filtersCleanup = setupInventorySearchAndFilters(invRoot);

      cleanups.push(selectCleanup, gridCleanup, filtersCleanup);
    }

    const achRoot = qs(character, "[data-ach]");
    if (achRoot) {
      const two = qs(achRoot, ".cm-two") || achRoot;
      const info = getOrCreateInfoBox(two, '[data-info="ach"]', "Информация");
      if (info && !info.getAttribute("data-info")) info.setAttribute("data-info", "ach");

      const p = qs(achRoot, '[data-slots="player-ach"]');
      ensureEmptySlots(p, 12);
      const pSel = bindSlotSelection(p, info, (btn) => normalizeItemFromBtn(btn));
      const pGrid = setupGridA11y(p, (btn) => btn.getAttribute("data-item-name") || "");
      cleanups.push(pSel, pGrid);

      const c = qs(achRoot, '[data-slots="char-ach"]');
      ensureEmptySlots(c, 12);
      const cSel = bindSlotSelection(c, info, (btn) => normalizeItemFromBtn(btn));
      const cGrid = setupGridA11y(c, (btn) => btn.getAttribute("data-item-name") || "");
      cleanups.push(cSel, cGrid);
    }

    const appearanceCleanup = setupAppearancePickers(character);
    cleanups.push(appearanceCleanup);

    const giftsRoot = qs(character, "[data-gifts]");
    const giftsSlots = qs(character, "[data-gifts-root]");
    const giftsInfo = qs(character, '[data-info="gifts"]') || (giftsRoot ? getOrCreateInfoBox(qs(giftsRoot, ".cm-two") || giftsRoot, '[data-info="gifts"]', "Информация") : null);

    if (giftsInfo) {
      giftsInfo.classList.add("cm-infobox--gift");
      giftsInfo.setAttribute("data-kind", "gift");
      giftsInfo.setAttribute("data-info", "gifts");
    }

    let giftsLoaded = false;
    let giftsAbort = null;

    const loadGifts = async () => {
      if (!config.showAwards) return;
      if (giftsLoaded) return;
      giftsLoaded = true;

      if (giftsAbort) giftsAbort.abort();
      giftsAbort = new AbortController();

      try {
        if (giftsRoot) setStatus(giftsRoot, { state: null });
        if (giftsSlots) renderSkeletonSlots(giftsSlots, config.skeletonCount);
        if (giftsInfo) setInfoBox(giftsInfo, { name: "—", cat: "", desc: "Загрузка…", img: "" });

        const awards = uid ? await fetchAwards(uid, giftsAbort.signal) : [];

        if (!awards.length) {
          if (giftsSlots) {
            giftsSlots.textContent = "";
            ensureEmptySlots(giftsSlots, config.skeletonCount);
          }
          if (giftsInfo) setInfoBox(giftsInfo, { name: "—", cat: "", desc: config.awardsEmptyText, img: "" });
          return;
        }

        renderGiftsIntoSlots(giftsSlots, awards, 0);

        const selectCleanup = bindSlotSelection(giftsSlots, giftsInfo, (btn) => ({
          name: btn.getAttribute("data-item-name") || "",
          cat: "",
          desc: btn.getAttribute("data-item-desc") || "",
          img: btn.getAttribute("data-item-img") || "",
        }));
        const gridCleanup = setupGridA11y(giftsSlots, (btn) => btn.getAttribute("data-item-name") || "");
        cleanups.push(selectCleanup, gridCleanup);

        applyLazyImages(giftsSlots);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (giftsSlots) {
          giftsSlots.textContent = "";
          ensureEmptySlots(giftsSlots, config.skeletonCount);
        }
        if (giftsRoot) setStatus(giftsRoot, { state: "error", text: config.awardsErrorText });
        if (giftsInfo) setInfoBox(giftsInfo, { name: "—", cat: "", desc: config.awardsErrorText, img: "" });
      }
    };

    const onTabChange = (e) => {
      const key = e?.detail?.key;
      if (key === "gifts") loadGifts();
    };

    character.addEventListener("cm:tabchange", onTabChange);
    cleanups.push(() => character.removeEventListener("cm:tabchange", onTabChange));

    if (giftsSlots) ensureEmptySlots(giftsSlots, config.skeletonCount);

    return () => {
      if (giftsAbort) giftsAbort.abort();
      cleanups.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    };
  };

  const openCharacterModal = async (linkEl) => {
    const lastFocus = document.activeElement;

    const box = document.createElement("div");
    box.className = "character-modal";

    const loading = document.createElement("div");
    loading.style.padding = "2em";
    loading.style.textAlign = "center";
    loading.textContent = config.loadingText;
    box.append(loading);

    let close = null;
    let overlayEl = null;
    let cleanup = null;

    if (helpers?.modal?.openModal) {
      const res = helpers.modal.openModal(box);
      close = res?.close || (() => {});
      overlayEl = box.closest(".modal, .modal-overlay, .modal__overlay, .overlay, #modal-overlay") || null;
    } else {
      const res = openModalNative(box);
      close = res.close;
      overlayEl = res.overlay;
    }

    const safeClose = () => {
      try {
        cleanup?.();
      } catch (_) {}
      cleanup = null;
      try {
        close?.();
      } catch (_) {}
      try {
        if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
      } catch (_) {}
    };

    box.addEventListener("click", (e) => {
      const c = e.target.closest("[data-modal-close]");
      if (!c) return;
      e.preventDefault();
      safeClose();
    });

    const url = String(linkEl.id || "");
    const uid = linkEl.dataset.userId || linkEl.dataset.uid || "";

    try {
      let doc = null;

      if (url && url !== "/character-card.html") {
        const ctrl = new AbortController();
        const res = await request(`${config.ajaxFolder}${url}`, ctrl.signal);
        const html = await decodeResponseToText(res, config.charset);
        doc = parseHTML(html);
      } else {
        const tpl = document.getElementById("demo-character-page");
        if (tpl?.content) {
          doc = document.implementation.createHTMLDocument("");
          doc.body.append(tpl.content.cloneNode(true));
        } else {
          doc = document.implementation.createHTMLDocument("");
        }
      }

      const character = qs(doc, ".character");
      box.textContent = "";

      if (character) {
        box.append(character);
        cleanup = enhanceCharacter(character, { uid: uid || character.dataset.userId || "", close: safeClose, overlayEl });
      } else {
        const err = document.createElement("div");
        err.style.padding = "2em";
        err.style.color = "red";
        err.textContent = config.errorText;
        box.append(err);
      }
    } catch (err) {
      box.textContent = "";
      const el = document.createElement("div");
      el.style.padding = "2em";
      el.style.color = "red";
      el.textContent = config.errorText;
      box.append(el);
    }

    const shell = qs(box, ".cm-shell");
    if (shell) {
      const trapCleanup = setupFocusTrap(shell, safeClose);
      cleanup = ((prev) => () => {
        try {
          trapCleanup();
        } catch (_) {}
        try {
          prev?.();
        } catch (_) {}
      })(cleanup);
    }

    return safeClose;
  };

  const init = () => {
    document.body.addEventListener("click", async (e) => {
      const link = e.target.closest(".modal-link");
      if (!link) return;
      e.preventDefault();
      await openCharacterModal(link);
    });
  };

  if (helpers?.runOnceOnReady) helpers.runOnceOnReady(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  if (helpers?.register) helpers.register("characterModal", { init });
})();
