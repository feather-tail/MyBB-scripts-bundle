(() => {
  "use strict";
  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs, getUserId, getGroupId } = helpers;
  const config = helpers.getConfig("characterModal", {
    loadingText: "Загрузка...",
    errorText: "Ошибка загрузки данных.",
    showAwards: true,
    awardsTabTitle: "Награды",
    awardsErrorText: "Ошибка загрузки наград.",
    awardsEmptyText: "Наград не найдено.",
    awardsApi: "https://core.rusff.me/rusff.php",
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
            name: a.item?.name,
            desc: a.desc,
            img: a.item?.href,
          });
        }
      }
      return res;
    });
    awardsCache.set(uid, p);
    return p;
  };

  const addAwardsTab = (root, uid) => {
    const tabs = root.querySelector(`.${config.classes.tabs}`);
    const contents = root.querySelectorAll(`.${config.classes.tabContent}`);
    if (!tabs || !contents.length) return;
    const tab = createEl("div", {
      className: config.classes.tab,
      text: config.awardsTabTitle,
    });
    tabs.append(tab);
    const content = createEl("div", {
      className: config.classes.tabContent,
      text: config.loadingText,
    });
    contents[0].parentNode.append(content);
    fetchAwards(uid)
      .then((awards) => {
        if (!awards.length) {
          content.textContent = config.awardsEmptyText;
          return;
        }
        const list = createEl("div", { className: "modal__awards" });
        awards.forEach((a) => {
          const item = createEl("div", { className: "modal__award" });
          if (a.img)
            item.append(
              createEl("img", {
                src: a.img,
                alt: a.name || "",
              })
            );
          item.append(createEl("span", { text: a.desc || a.name || "" }));
          list.append(item);
        });
        content.textContent = "";
        content.append(list);
      })
      .catch(() => {
        content.textContent = config.awardsErrorText;
      });
  };

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
        const tabParams = {
          tabSelector: `.${config.classes.tab}`,
          contentSelector: `.${config.classes.tabContent}`,
          activeClass: config.classes.active,
        };
        if (character) {
          box.append(character);
          if (config.showAwards && targetUid)
            addAwardsTab(character, targetUid);
          initTabs(character, tabParams);
        } else {
          box.append(...Array.from(doc.body.childNodes));
          if (config.showAwards && targetUid) addAwardsTab(box, targetUid);
          initTabs(box, tabParams);
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
