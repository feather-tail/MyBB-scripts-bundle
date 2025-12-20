(() => {
  "use strict";

  const defaults = {
    awardsApi: "https://core.rusff.me/rusff.php",
    showAwards: true,
    awardsErrorText: "Ошибка загрузки подарков.",
    awardsEmptyText: "Подарков нет.",
    charset: "utf-8",
    ajaxFolder: "",
    cacheTtlMs: 15 * 60 * 1000,
    giftsSkeletonCount: 24,
    invEmptyTo: 24,
    achEmptyTo: 12,
    pageSize: 48,
    searchDebounceMs: 110,
  };

  const getConfig = () => {
    const h = window.helpers;
    if (h && typeof h.getConfig === "function") return h.getConfig("characterModal", defaults);
    return { ...defaults };
  };

  const config = getConfig();

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

  const clamp01 = (t) => Math.min(1, Math.max(0, t));

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

  const applyLazyImages = (root) => {
    if (!root) return;
    root.querySelectorAll("img").forEach((img) => {
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
    });
  };

  const preloadImage = (src) => {
    if (!src) return;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = src;
  };

  const normalizeText = (s) => String(s ?? "").trim();

  const normalizeItem = (raw) => {
    const name = normalizeText(raw?.name || raw?.title || raw?.item_name || "");
    const cat = normalizeText(raw?.cat || raw?.category || raw?.item_cat || "");
    const desc = normalizeText(raw?.desc || raw?.description || raw?.item_desc || "");
    const img = normalizeText(raw?.img || raw?.image || raw?.href || raw?.src || "");
    const qty = Number.isFinite(+raw?.qty) ? String(+raw.qty) : normalizeText(raw?.qty || "");
    return { name: name || "—", cat, desc, img, qty };
  };

  const normalizeAward = (raw) => {
    const name = normalizeText(raw?.name || raw?.title || "");
    const desc = normalizeText(raw?.desc || raw?.description || "");
    const img = normalizeText(raw?.img || raw?.href || raw?.src || "");
    const id = normalizeText(raw?.id || raw?.award_id || "");
    return { id, name: name || "Подарок", desc, img };
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

  const createOverlay = () => {
    const overlay = document.createElement("div");
    overlay.className = "cm-modal-overlay";
    overlay.setAttribute("aria-hidden", "false");
    return overlay;
  };

  const createDialog = () => {
    const dialog = document.createElement("div");
    dialog.className = "cm-modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    return dialog;
  };

  const getFocusable = (root) => {
    const sel = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    return Array.from(root.querySelectorAll(sel)).filter((el) => {
      const style = getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    });
  };

  const createModal = () => {
    const overlay = createOverlay();
    const dialog = createDialog();
    overlay.append(dialog);

    let lastActive = null;
    let onCloseCb = null;
    const cleanups = new Set();

    const close = () => {
      try {
        for (const fn of cleanups) fn();
      } finally {
        cleanups.clear();
      }
      overlay.setAttribute("aria-hidden", "true");
      overlay.remove();
      document.documentElement.classList.remove("cm-modal-open");
      document.body.classList.remove("cm-modal-open");
      if (lastActive && typeof lastActive.focus === "function") lastActive.focus();
      if (typeof onCloseCb === "function") onCloseCb();
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = getFocusable(dialog);
      if (!focusables.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const onBackdropClick = (e) => {
      if (e.target === overlay) close();
    };

    const open = (node, { onClose } = {}) => {
      lastActive = document.activeElement;
      onCloseCb = onClose || null;
      dialog.textContent = "";
      dialog.append(node);
      document.body.append(overlay);
      document.documentElement.classList.add("cm-modal-open");
      document.body.classList.add("cm-modal-open");

      cleanups.add(() => overlay.removeEventListener("mousedown", onBackdropClick, true));
      cleanups.add(() => document.removeEventListener("keydown", onKeydown, true));

      overlay.addEventListener("mousedown", onBackdropClick, true);
      document.addEventListener("keydown", onKeydown, true);

      queueMicrotask(() => {
        const focusables = getFocusable(dialog);
        (focusables[0] || dialog).focus();
      });

      return { close, overlay, dialog, cleanups };
    };

    return { open };
  };

  const modal = createModal();

  const rpcCache = new Map();
  const rpcInflight = new Map();

  const rpc = (method, params, { signal } = {}) => {
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
      signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("network");
        return r.json();
      })
      .then((j) => j?.result ?? null)
      .finally(() => rpcInflight.delete(key));

    rpcInflight.set(key, p);
    p.then((res) => rpcCache.set(key, res)).catch(() => {});
    return p;
  };

  const awardsCache = new Map();
  const awardsInflight = new Map();

  const fetchAwards = (uid, { signal } = {}) => {
    const key = String(uid || "");
    if (!key) return Promise.resolve([]);
    const now = Date.now();
    const cached = awardsCache.get(key);
    if (cached && now - cached.ts < config.cacheTtlMs) return Promise.resolve(cached.data);
    if (awardsInflight.has(key)) return awardsInflight.get(key);

    const h = window.helpers || {};
    const getUserId = (h.getUserId && h.getUserId.bind(h)) || (() => Number(window.UserID) || 0);
    const getGroupId = (h.getGroupId && h.getGroupId.bind(h)) || (() => Number(window.GroupID) || 0);

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

    const p = rpc("awards/index", params, { signal }).then((rows = []) => {
      const u = Array.isArray(rows) ? rows.find((r) => r.user_id === String(uid)) : null;
      const out = [];
      const list = u && Array.isArray(u.awards) ? u.awards : [];
      for (const a of list) {
        out.push(
          normalizeAward({
            id: a.award_id,
            name: a.item?.name || "",
            desc: a.desc || "",
            img: a.item?.href || "",
          })
        );
      }
      awardsCache.set(key, { ts: Date.now(), data: out });
      return out;
    });

    awardsInflight.set(key, p);
    p.finally(() => awardsInflight.delete(key));
    return p;
  };

  const ensureEmptySlots = (slotsEl, targetCount) => {
    if (!slotsEl) return;
    const items = slotsEl.querySelectorAll(".cm-slot--item").length;
    const emptiesNeeded = Math.max(0, targetCount - items);
    slotsEl.querySelectorAll(".cm-slot--empty").forEach((n) => n.remove());
    slotsEl.querySelectorAll(".cm-slot--skeleton").forEach((n) => n.remove());
    for (let i = 0; i < emptiesNeeded; i++) {
      const empty = document.createElement("div");
      empty.className = "cm-slot cm-slot--empty";
      empty.setAttribute("aria-hidden", "true");
      slotsEl.append(empty);
    }
  };

  const renderSkeletonSlots = (slotsEl, targetCount) => {
    if (!slotsEl) return;
    slotsEl.textContent = "";
    for (let i = 0; i < targetCount; i++) {
      const sk = document.createElement("div");
      sk.className = "cm-slot cm-slot--skeleton";
      sk.setAttribute("aria-hidden", "true");
      slotsEl.append(sk);
    }
  };

  const setStatus = (root, key, state, text = "") => {
    const el = root.querySelector(`[data-status="${key}"]`);
    if (!el) return;
    if (state === "idle") {
      el.textContent = "";
      return;
    }
    if (state === "loading") {
      el.textContent = text || "Загрузка…";
      return;
    }
    if (state === "empty") {
      el.textContent = text || "Пусто.";
      return;
    }
    if (state === "error") {
      el.textContent = text || "Ошибка.";
      return;
    }
    el.textContent = text || "";
  };

  const isGiftInfoBox = (infoBox) =>
    infoBox?.classList.contains("cm-infobox--gift") || infoBox?.getAttribute("data-kind") === "gift";

  const setInfoBox = (infoBox, data) => {
    if (!infoBox) return;
    infoBox.classList.add("is-updating");
    const img = infoBox.querySelector("[data-info-img]");
    const name = infoBox.querySelector("[data-info-name]");
    const cat = infoBox.querySelector("[data-info-cat]");
    const desc = infoBox.querySelector("[data-info-desc]");
    const giftMode = isGiftInfoBox(infoBox);

    const d = normalizeItem(data);

    if (img) {
      img.src = d.img || "https://placehold.co/96x96";
      img.alt = d.name || "";
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    }

    if (giftMode) {
      if (cat) cat.textContent = "";
      if (name) name.textContent = d.desc || d.name || "—";
      if (desc) desc.textContent = "";
      if (d.img) preloadImage(d.img);
      requestAnimationFrame(() => infoBox.classList.remove("is-updating"));
      return;
    }

    if (name) name.textContent = d.name || "—";
    if (cat) cat.textContent = d.cat ? `Категория: ${d.cat}` : "";
    if (desc) desc.textContent = d.desc || "";
    if (d.img) preloadImage(d.img);
    requestAnimationFrame(() => infoBox.classList.remove("is-updating"));
  };

  const setSelected = (slotsEl, btn) => {
    if (!slotsEl || !btn) return;
    slotsEl.querySelectorAll(".cm-slot--item.is-selected").forEach((n) => {
      n.classList.remove("is-selected");
      n.setAttribute("aria-selected", "false");
      n.tabIndex = -1;
    });
    btn.classList.add("is-selected");
    btn.setAttribute("aria-selected", "true");
    btn.tabIndex = 0;
  };

  const getDataFromBtn = (btn) =>
    normalizeItem({
      name: btn.getAttribute("data-item-name"),
      cat: btn.getAttribute("data-item-cat"),
      desc: btn.getAttribute("data-item-desc"),
      img: btn.getAttribute("data-item-img"),
      qty: btn.getAttribute("data-item-qty"),
    });

  const setupGridKeyboard = (slotsEl) => {
    if (!slotsEl) return () => {};
    const cols = Math.max(1, numFrom(slotsEl.getAttribute("data-cols")) || 6);

    const items = () => Array.from(slotsEl.querySelectorAll(".cm-slot--item"));

    const focusAt = (i) => {
      const list = items().filter((b) => b.style.display !== "none");
      if (!list.length) return;
      const idx = Math.min(list.length - 1, Math.max(0, i));
      list[idx].focus();
    };

    const indexOf = (btn) => items().filter((b) => b.style.display !== "none").indexOf(btn);

    const onKey = (e) => {
      const active = document.activeElement;
      if (!active || !slotsEl.contains(active) || !active.classList.contains("cm-slot--item")) return;

      const list = items().filter((b) => b.style.display !== "none");
      const i = list.indexOf(active);
      if (i < 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusAt(i + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusAt(i - 1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusAt(i + cols);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusAt(i - cols);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        focusAt(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        focusAt(list.length - 1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        active.click();
      }
    };

    slotsEl.addEventListener("keydown", onKey);
    return () => slotsEl.removeEventListener("keydown", onKey);
  };

  const bindSlotSelection = (slotsEl, infoBox, { onSelect } = {}) => {
    if (!slotsEl || !infoBox) return () => {};
    const all = Array.from(slotsEl.querySelectorAll(".cm-slot--item"));

    all.forEach((b) => (b.tabIndex = -1));
    const initial =
      slotsEl.querySelector(".cm-slot--item.is-selected") ||
      slotsEl.querySelector(".cm-slot--item");

    if (initial) {
      setSelected(slotsEl, initial);
      setInfoBox(infoBox, getDataFromBtn(initial));
      if (typeof onSelect === "function") onSelect(initial, getDataFromBtn(initial));
    }

    const onClick = (e) => {
      const btn = e.target.closest(".cm-slot--item");
      if (!btn || !slotsEl.contains(btn)) return;
      setSelected(slotsEl, btn);
      const d = getDataFromBtn(btn);
      setInfoBox(infoBox, d);
      if (typeof onSelect === "function") onSelect(btn, d);
    };

    slotsEl.addEventListener("click", onClick);
    return () => slotsEl.removeEventListener("click", onClick);
  };

  const debounce = (fn, ms) => {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const setupInventorySearchAndFilters = (invRoot, cleanups) => {
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
      const q = normalizeText(input?.value || "").toLowerCase();
      const cats = getActiveCats();

      const items = Array.from(slots?.querySelectorAll(".cm-slot--item") || []);
      for (const btn of items) {
        const name = normalizeText(btn.getAttribute("data-item-name")).toLowerCase();
        const cat = normalizeText(btn.getAttribute("data-item-cat"));
        const okQ = !q || name.includes(q);
        const okC = !cats.length || cats.includes(cat);
        btn.style.display = okQ && okC ? "" : "none";
      }

      const firstVisible = Array.from(slots?.querySelectorAll(".cm-slot--item") || []).find((b) => b.style.display !== "none");
      if (firstVisible) {
        const selectedVisible = slots.querySelector(".cm-slot--item.is-selected");
        if (selectedVisible && selectedVisible.style.display === "none") {
          setSelected(slots, firstVisible);
        }
      }
    };

    const applyFilterDebounced = debounce(applyFilter, config.searchDebounceMs);

    const setOpen = (open) => {
      if (!panel || !toggle) return;
      isOpen = open;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        const first = panel.querySelector('input,button,[tabindex]:not([tabindex="-1"])');
        if (first) first.focus();
      }
    };

    const onDocClick = (e) => {
      if (!isOpen) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (input) input.addEventListener("input", applyFilterDebounced);

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

      checks.forEach((c) => c.addEventListener("change", applyFilterDebounced));
    }

    applyFilter();

    cleanups.add(() => {
      if (input) input.removeEventListener("input", applyFilterDebounced);
      if (toggle) toggle.replaceWith(toggle.cloneNode(true));
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey, true);
      if (closeBtn) closeBtn.replaceWith(closeBtn.cloneNode(true));
      if (clearBtn) clearBtn.replaceWith(clearBtn.cloneNode(true));
      checks.forEach((c) => c.replaceWith(c.cloneNode(true)));
    });
  };

  const initTabs = (root, { onChange } = {}) => {
    const tabs = Array.from(root.querySelectorAll(".modal__tab"));
    const panes = Array.from(root.querySelectorAll(".modal__content"));

    const setActive = (key) => {
      tabs.forEach((t) => {
        const active = (t.dataset.cmTab || "") === key;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
        t.tabIndex = active ? 0 : -1;
      });
      panes.forEach((p) => {
        const active = (p.dataset.cmContent || "") === key;
        p.classList.toggle("active", active);
      });
      root.dispatchEvent(new CustomEvent("cm:tabchange", { bubbles: true, detail: { key } }));
      if (typeof onChange === "function") onChange(key);
    };

    tabs.forEach((t) => (t.tabIndex = -1));
    const initial = tabs.find((t) => t.classList.contains("active")) || tabs[0];
    if (initial) {
      initial.tabIndex = 0;
      setActive(initial.dataset.cmTab || "gift");
    }

    const onClick = (e) => {
      const btn = e.target.closest(".modal__tab");
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      setActive(btn.dataset.cmTab || "");
    };

    const onKey = (e) => {
      const active = document.activeElement;
      if (!active || !active.classList.contains("modal__tab")) return;
      const i = tabs.indexOf(active);
      if (i < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        tabs[(i + 1) % tabs.length].focus();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        tabs[(i - 1 + tabs.length) % tabs.length].focus();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        active.click();
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);

    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
    };
  };

  const paginateSlots = (slotsEl, pagerEl, { pageSize, targetFill, makeEmpty } = {}) => {
    if (!slotsEl || !pagerEl) return { reset: () => {}, setItems: () => {} };

    const btnMore = pagerEl.querySelector("[data-pager-more]");
    let allNodes = [];
    let page = 1;

    const render = () => {
      slotsEl.textContent = "";
      const slice = allNodes.slice(0, page * pageSize);
      slice.forEach((n) => slotsEl.append(n));
      if (typeof makeEmpty === "function") makeEmpty();
      if (typeof targetFill === "number") ensureEmptySlots(slotsEl, targetFill);
      const hasMore = allNodes.length > slice.length;
      pagerEl.hidden = !hasMore;
    };

    const onMore = () => {
      page += 1;
      render();
    };

    if (btnMore) btnMore.addEventListener("click", onMore);

    const setItems = (nodes) => {
      allNodes = Array.isArray(nodes) ? nodes : [];
      page = 1;
      render();
    };

    const reset = () => {
      allNodes = [];
      page = 1;
      slotsEl.textContent = "";
      pagerEl.hidden = true;
    };

    return {
      setItems,
      reset,
      cleanup: () => {
        if (btnMore) btnMore.removeEventListener("click", onMore);
      },
    };
  };

  const buildSlotButton = (d, { selected = false } = {}) => {
    const btn = document.createElement("button");
    btn.className = `cm-slot cm-slot--item${selected ? " is-selected" : ""}`;
    btn.type = "button";
    btn.setAttribute("role", "gridcell");
    btn.setAttribute("aria-selected", selected ? "true" : "false");
    btn.setAttribute("data-item-name", d.name || "");
    btn.setAttribute("data-item-cat", d.cat || "");
    btn.setAttribute("data-item-desc", d.desc || "");
    btn.setAttribute("data-item-img", d.img || "");
    if (d.qty) btn.setAttribute("data-item-qty", d.qty);

    const img = document.createElement("img");
    img.src = d.img || "https://placehold.co/96x96";
    img.alt = "";
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    btn.append(img);

    if (d.qty) {
      const q = document.createElement("span");
      q.className = "cm-qty";
      q.textContent = d.qty;
      btn.append(q);
    }

    return btn;
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

  const setupAppearancePickers = (root, cleanups) => {
    const icons = Array.from(root.querySelectorAll(".cm-icon"));
    const bgs = Array.from(root.querySelectorAll(".cm-bg"));

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
        (btn.querySelector("img") && (btn.querySelector("img").currentSrc || btn.querySelector("img").src)) ||
        getBgUrl(btn.querySelector(".cm-bg__thumb") || btn);

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

    cleanups.add(() => {
      icons.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
      bgs.forEach((btn) => btn.replaceWith(btn.cloneNode(true)));
    });
  };

  const initAchievementsDemo = (achRoot) => {
    const p = achRoot.querySelector('[data-slots="player-ach"]');
    const c = achRoot.querySelector('[data-slots="char-ach"]');

    const player = [
      { name: "Пример достижения", cat: "Игрок", desc: "Короткое описание.", img: "https://placehold.co/96x96" },
      { name: "Коллекционер", cat: "Игрок", desc: "Собрал редкую коллекцию.", img: "https://placehold.co/96x96" },
    ].map(normalizeItem);

    const char = [
      { name: "Победил тварь", cat: "Персонаж", desc: "Выжил и одолел угрозу.", img: "https://placehold.co/96x96" },
    ].map(normalizeItem);

    const mk = (arr) => arr.map((d, i) => buildSlotButton(d, { selected: i === 0 }));
    const pn = mk(player);
    const cn = mk(char);

    pn.forEach((n) => p.append(n));
    cn.forEach((n) => c.append(n));

    ensureEmptySlots(p, config.achEmptyTo);
    ensureEmptySlots(c, config.achEmptyTo);
  };

  const enhanceCharacter = (character, { uid, close, cleanups }) => {
    if (!character || character.getAttribute("data-cm-initialized") === "1") return;
    character.setAttribute("data-cm-initialized", "1");

    applyMeter(character);
    applyLazyImages(character);

    const btnClose = character.querySelector("[data-modal-close]");
    if (btnClose && typeof close === "function") {
      const onClose = (e) => {
        e.preventDefault();
        close();
      };
      btnClose.addEventListener("click", onClose);
      cleanups.add(() => btnClose.removeEventListener("click", onClose));
    }

    const tabsCleanup = initTabs(character);
    cleanups.add(tabsCleanup);

    const invRoot = character.querySelector("[data-inventory]");
    if (invRoot) {
      const slots = invRoot.querySelector('[data-slots="inventory"]');
      ensureEmptySlots(slots, config.invEmptyTo);

      const gridCleanup = setupGridKeyboard(slots);
      cleanups.add(gridCleanup);

      const info = invRoot.querySelector('[data-info="inventory"]');
      const selCleanup = bindSlotSelection(slots, info, {
        onSelect: (_btn, d) => {
          if (d?.img) preloadImage(d.img);
        },
      });
      cleanups.add(selCleanup);

      setupInventorySearchAndFilters(invRoot, cleanups);

      const pager = invRoot.querySelector('[data-pager="inventory"]');
      const pag = paginateSlots(slots, pager, { pageSize: config.pageSize, targetFill: config.invEmptyTo });
      cleanups.add(pag.cleanup);

      const nodes = Array.from(slots.querySelectorAll(".cm-slot--item"));
      if (nodes.length > config.pageSize) {
        slots.textContent = "";
        pag.setItems(nodes);
      } else {
        pager.hidden = true;
      }
    }

    const achRoot = character.querySelector("[data-ach]");
    if (achRoot) {
      initAchievementsDemo(achRoot);

      const info = achRoot.querySelector('[data-info="ach"]');
      const p = achRoot.querySelector('[data-slots="player-ach"]');
      const c = achRoot.querySelector('[data-slots="char-ach"]');

      const gridCleanupP = setupGridKeyboard(p);
      const gridCleanupC = setupGridKeyboard(c);
      cleanups.add(gridCleanupP);
      cleanups.add(gridCleanupC);

      const selP = bindSlotSelection(p, info);
      const selC = bindSlotSelection(c, info);
      cleanups.add(selP);
      cleanups.add(selC);
    }

    setupAppearancePickers(character, cleanups);

    const giftsRoot = character.querySelector("[data-gifts]");
    const giftsSlots = character.querySelector('[data-slots="gifts"]');
    const giftsInfo = character.querySelector('[data-info="gifts"]');
    const giftsPager = giftsRoot?.querySelector('[data-pager="gifts"]');
    const pag = paginateSlots(giftsSlots, giftsPager, {
      pageSize: config.pageSize,
      targetFill: config.giftsSkeletonCount,
    });
    cleanups.add(pag.cleanup);

    let giftsLoaded = false;
    let giftsController = null;

    const renderGifts = (awards) => {
      const list = (awards || []).map(normalizeAward);
      if (!list.length) {
        giftsSlots.textContent = "";
        ensureEmptySlots(giftsSlots, config.giftsSkeletonCount);
        setInfoBox(giftsInfo, { name: "—", desc: config.awardsEmptyText, img: "" });
        setStatus(giftsRoot, "gifts", "empty", config.awardsEmptyText);
        giftsPager.hidden = true;
        return;
      }

      const nodes = list.map((a, i) =>
        buildSlotButton(
          normalizeItem({
            name: a.name,
            cat: "",
            desc: a.desc,
            img: a.img,
          }),
          { selected: i === 0 }
        )
      );

      pag.setItems(nodes);

      const gridCleanup = setupGridKeyboard(giftsSlots);
      cleanups.add(gridCleanup);

      const selCleanup = bindSlotSelection(giftsSlots, giftsInfo, {
        onSelect: (_btn, d) => {
          if (d?.img) preloadImage(d.img);
        },
      });
      cleanups.add(selCleanup);

      setStatus(giftsRoot, "gifts", "idle", "");
    };

    const loadGifts = async () => {
      if (!config.showAwards || giftsLoaded) return;
      giftsLoaded = true;

      if (giftsController) giftsController.abort();
      giftsController = new AbortController();
      cleanups.add(() => giftsController && giftsController.abort());

      setStatus(giftsRoot, "gifts", "loading", "Загрузка подарков…");
      renderSkeletonSlots(giftsSlots, config.giftsSkeletonCount);
      giftsPager.hidden = true;
      setInfoBox(giftsInfo, { name: "—", desc: "Загрузка…", img: "" });

      try {
        const awards = await fetchAwards(uid, { signal: giftsController.signal });
        renderGifts(awards);
      } catch (e) {
        if (e && e.name === "AbortError") return;
        giftsSlots.textContent = "";
        ensureEmptySlots(giftsSlots, config.giftsSkeletonCount);
        setInfoBox(giftsInfo, { name: "—", desc: config.awardsErrorText, img: "" });
        setStatus(giftsRoot, "gifts", "error", config.awardsErrorText);
      }
    };

    const onTab = (e) => {
      const key = e?.detail?.key;
      if (key === "gifts") loadGifts();
    };

    character.addEventListener("cm:tabchange", onTab);
    cleanups.add(() => character.removeEventListener("cm:tabchange", onTab));

    const activeTab = character.querySelector(".modal__tab.active")?.dataset?.cmTab || "";
    if (activeTab === "gifts") loadGifts();

    const shell = character.querySelector("[data-cm-shell]");
    if (shell) {
      const title = character.querySelector(".cm-name");
      if (title && !shell.getAttribute("aria-labelledby")) {
        const id = title.id || `cm-title-${Math.random().toString(36).slice(2)}`;
        title.id = id;
        shell.setAttribute("aria-labelledby", id);
      }
    }
  };

  const fetchCharacterHtml = async (url) => {
    const h = window.helpers;
    if (h && typeof h.request === "function") {
      const res = await h.request(url);
      const buf = await res.arrayBuffer();
      const decoder = new TextDecoder(config.charset);
      return decoder.decode(buf);
    }
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error("network");
    return await res.text();
  };

  const parseHTML = (html) => {
    const h = window.helpers;
    if (h && typeof h.parseHTML === "function") return h.parseHTML(html);
    const p = new DOMParser();
    return p.parseFromString(html, "text/html");
  };

  const openCharacterFromNode = (node, { uid } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "character-modal";
    wrap.append(node);

    const { close, cleanups } = modal.open(wrap, {
      onClose: () => {
        try {
          for (const fn of cleanups) fn();
        } catch (_) {}
      },
    });

    const character = wrap.querySelector(".character");
    if (character) {
      const targetUid =
        uid ||
        character.dataset.userId ||
        wrap.querySelector("[data-user-id]")?.dataset?.userId ||
        "";
      enhanceCharacter(character, { uid: targetUid, close, cleanups });
    }

    return { close };
  };

  const openCharacterFromTemplate = (templateSel, { uid } = {}) => {
    const tpl = document.querySelector(templateSel);
    if (!tpl || !("content" in tpl)) throw new Error("template");
    const node = tpl.content.firstElementChild?.cloneNode(true);
    if (!node) throw new Error("template_empty");
    return openCharacterFromNode(node, { uid });
  };

  const openCharacterFromUrl = async (url, { uid } = {}) => {
    const html = await fetchCharacterHtml(url);
    const doc = parseHTML(html);
    const character = doc.querySelector(".character") || doc.body.firstElementChild;
    if (!character) throw new Error("no_character");
    const node = character.cloneNode(true);
    return openCharacterFromNode(node, { uid });
  };

  const init = () => {
    document.body.addEventListener("click", async (e) => {
      const link = e.target.closest(".modal-link");
      if (!link) return;

      e.preventDefault();

      const src = link.getAttribute("data-src") || "";
      const uid = link.getAttribute("data-user-id") || link.getAttribute("data-uid") || "";

      try {
        if (src.startsWith("#")) {
          openCharacterFromTemplate(src, { uid });
          return;
        }
        if (src) {
          await openCharacterFromUrl(src, { uid });
          return;
        }

        const pageId = link.id;
        if (pageId) {
          await openCharacterFromUrl(`${config.ajaxFolder}${pageId}`, { uid });
          return;
        }
      } catch (_) {}
    });
  };

  if (window.helpers && typeof window.helpers.runOnceOnReady === "function") {
    window.helpers.runOnceOnReady(init);
  } else {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
