(() => {
  'use strict';

  const helpers = window.helpers;
  const {
    $,
    $$,
    copyToClipboard,
    showToast,
    dialog,
    getGroupId,
    getUserInfo,
    createEl,
  } = helpers;
  const config = helpers.getConfig('episodeTracker', { ids: {}, texts: {} });

  const IDS = Object.assign(
    {
      navItem: 'h-episodes',
      openBtn: 'episodesOpenBtn',
      modal: 'episodesModal',
      exportBtn: 'exportBtn',
      importBtn: 'importBtn',
      ownerFilters: 'ownerFilters',
      list: 'episodesList',
      form: 'episodeForm',
      urlInput: 'episodeUrl',
      ownerInput: 'episodeOwner',
      partBox: 'participantsBox',
      addPartBtn: 'addParticipantBtn',
      saveBtn: 'saveEpisodeBtn',
      refreshBtn: 'refreshBtn',
      showFormBtn: 'showFormBtn',
    },
    config.ids,
  );

  const TEXTS = Object.assign(
    {
      openBtn: 'Эпизоды',
      exportBtn: 'Экспорт',
      importBtn: 'Импорт',
      header: 'Трекер эпизодов',
      noEpisodesYet: 'Пока нет эпизодов…',
      urlLabel: 'Ссылка на эпизод:',
      urlPlaceholder: 'https://...',
      ownerLabel: 'Автор:',
      ownerPlaceholder: 'Логин автора',
      participantLabel: 'Участник',
      participantPlaceholder: 'Имя игрока (по очередности отписи)',
      addParticipant: 'Новый участник',
      addEpisode: 'Добавить эпизод',
      saveEpisode: 'Сохранить',
      refreshTitle: 'Обновить',
      showFormBtn: 'Новый эпизод',
      noEpisodes: 'Эпизодов нет',
      titleLabel: 'Название эпизода:',
      participantsLabel: 'Участники:',
      lastLabel: 'Последний пост:',
      ownerTag: 'Автор:',
      noData: 'Нет данных',
      editTitle: 'Редактировать',
      deleteTitle: 'Удалить',
      exportSuccess: 'Данные скопированы в буфер обмена.',
      exportError: 'Не удалось скопировать данные.',
    },
    config.texts,
  );

  const ALLOWED_GROUP_IDS = new Set(config.allowedGroupIds);
  if (!ALLOWED_GROUP_IDS.has(getGroupId())) return;

  const CURRENT_USER = getUserInfo().name;
  const LEGACY_OWNER = 'Не определён';

  const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const isSame = (a, b) => a === b || a.startsWith(b) || b.startsWith(a);

  const store = {
    KEY_DATA: 'forumEpisodes',
    KEY_TIME: 'forumEpisodesLastRefresh',
    get episodes() {
      return JSON.parse(localStorage.getItem(this.KEY_DATA) || '[]');
    },
    set episodes(v) {
      localStorage.setItem(this.KEY_DATA, JSON.stringify(v));
    },
    get lastStamp() {
      return +localStorage.getItem(this.KEY_TIME) || 0;
    },
    set lastStamp(v) {
      localStorage.setItem(this.KEY_TIME, String(v));
    },
  };

  const fetchTopicMeta = (domain, id) =>
    helpers
      .request(
        `${domain}/api.php?method=topic.get&topic_id=${id}&fields=subject,title,num_replies,last_username&format=json`,
        { responseType: 'json' },
      )
      .then((j) => {
        const x = j?.response?.[0] || {};
        return {
          title: x.subject ?? x.title ?? null,
          replies: +x.num_replies || 0,
          last: x.last_username ?? null,
        };
      })
      .catch(() => ({ title: null, replies: 0, last: null }));

  const parseUrl = (u) => {
    try {
      const url = new URL(u);
      if (url.pathname.endsWith('viewtopic.php')) {
        const id = url.searchParams.get('id');
        if (id) return { id: +id, domain: url.origin };
      }
    } catch {}
    return null;
  };

  const anchorSel = config.selectors.insertAfter || config.selectors.anchor;
  const waitAnchor = (done) => {
    const el = $(anchorSel);
    if (el) return done(el);
    new MutationObserver((_, o) => {
      const f = $(anchorSel);
      if (f) {
        o.disconnect();
        done(f);
      }
    }).observe(document.body, { childList: true, subtree: true });
  };

  function init() {
    return Promise.resolve($(anchorSel) || new Promise(waitAnchor)).then(
      initUI,
    );
  }

  helpers.ready(helpers.once(init));

  function buildModalUI() {
    const root = createEl('div', { className: 'episodes-modal-content' });
    const topBar = createEl('div', { className: 'top-bar' });
    const btnExport = createEl('button', {
      id: IDS.exportBtn,
      text: TEXTS.exportBtn,
    });
    const btnImport = createEl('button', {
      id: IDS.importBtn,
      text: TEXTS.importBtn,
    });
    topBar.append(btnExport, btnImport);
    const header = createEl('h2', {
      className: 'tracker-header',
      text: TEXTS.header,
    });
    const ownerFilters = createEl('div', {
      id: IDS.ownerFilters,
      className: 'owner-filters',
    });
    const list = createEl('div', { id: IDS.list, className: 'episodes-list' });
    list.appendChild(createEl('p', { text: TEXTS.noEpisodesYet }));
    const form = createEl('form', {
      id: IDS.form,
      className: 'add-episode-form',
      style: 'display:none;',
    });
    const labelUrl = createEl('label');
    const urlInput = createEl('input', {
      type: 'url',
      id: IDS.urlInput,
      required: true,
      placeholder: TEXTS.urlPlaceholder,
    });
    labelUrl.append(TEXTS.urlLabel, urlInput);
    const labelOwner = createEl('label');
    const ownerInput = createEl('input', {
      type: 'text',
      id: IDS.ownerInput,
      placeholder: TEXTS.ownerPlaceholder,
    });
    labelOwner.append(TEXTS.ownerLabel, ownerInput);
    const partBox = createEl('div', { id: IDS.partBox });
    const firstPartLabel = createEl('label');
    const firstPartInput = createEl('input', {
      type: 'text',
      name: 'participant',
      required: true,
      placeholder: TEXTS.participantPlaceholder,
    });
    firstPartLabel.append(`${TEXTS.participantLabel} 1:`, firstPartInput);
    partBox.appendChild(firstPartLabel);
    const btnAddPart = createEl('button', {
      type: 'button',
      id: IDS.addPartBtn,
      text: TEXTS.addParticipant,
    });
    const btnSave = createEl('button', {
      type: 'submit',
      id: IDS.saveBtn,
      text: TEXTS.addEpisode,
    });
    form.append(labelUrl, labelOwner, partBox, btnAddPart, btnSave);
    const actions = createEl('div', {
      className: 'modal-actions primary-row',
    });
    const btnRefresh = createEl('button', {
      id: IDS.refreshBtn,
      title: TEXTS.refreshTitle,
      text: '↻',
    });
    const btnShowForm = createEl('button', {
      id: IDS.showFormBtn,
      text: TEXTS.showFormBtn,
    });
    actions.append(btnRefresh, btnShowForm);
    root.append(topBar, header, ownerFilters, list, form, actions);
    return {
      root,
      el: {
        btnExport,
        btnImport,
        ownerFilters,
        list,
        form,
        urlInput,
        ownerInput,
        partBox,
        btnAddPart,
        btnSave,
        btnRefresh,
        btnShowForm,
      },
    };
  }

  function initUI(anchor) {
    const li = createEl('li', { id: IDS.navItem });
    const btnOpen = createEl('a', {
      href: '#',
      id: IDS.openBtn,
      text: TEXTS.openBtn,
    });
    li.appendChild(btnOpen);
    anchor.insertAdjacentElement('afterend', li);

    const { root: modalRoot, el } = buildModalUI();
    let modal;

    btnOpen.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!modal) {
        modal = helpers.modal.openModal(modalRoot, {
          onClose: () => {
            resetForm();
            modal = null;
          },
        });
        modal.overlay.id = IDS.modal;
      }
      if (Date.now() - store.lastStamp > config.oneDayMs) {
        el.list.replaceChildren(createEl('p', { text: 'Автообновление…' }));
        await refreshEpisodes();
        store.lastStamp = Date.now();
      } else {
        renderAll();
      }
    });

    let participantCount = 1;
    let editIndex = -1;
    let activeOwners = new Set([CURRENT_USER || LEGACY_OWNER]);

    function resetForm() {
      participantCount = 1;
      editIndex = -1;
      el.btnAddPart.disabled = false;
      el.urlInput.value = '';
      el.ownerInput.value = CURRENT_USER || '';
      while (el.partBox.children.length > 1) el.partBox.lastChild.remove();
      $('input', el.partBox).value = '';
      el.form.style.display = 'none';
      el.btnShowForm.style.display = '';
      el.btnSave.textContent = TEXTS.addEpisode;
    }

    function renderOwnerFilters() {
      const owners = [
        ...new Set(store.episodes.map((e) => (e.owner || LEGACY_OWNER).trim())),
      ].sort((a, b) => a.localeCompare(b, 'ru'));

      if (CURRENT_USER && !owners.includes(CURRENT_USER))
        owners.unshift(CURRENT_USER);

      el.ownerFilters.replaceChildren(
        ...owners.map((o) => {
          const label = createEl('label');
          const chk = createEl('input', {
            type: 'checkbox',
            className: 'owner-filter',
            value: o,
          });
          chk.checked = activeOwners.has(o);
          label.append(chk, ` ${o}`);
          chk.addEventListener('change', () => {
            if (chk.checked) activeOwners.add(chk.value);
            else activeOwners.delete(chk.value);
            renderEpisodes();
          });
          return label;
        }),
      );
    }

    function renderEpisodes() {
      const visible = store.episodes.filter((e) =>
        activeOwners.has((e.owner || LEGACY_OWNER).trim()),
      );

      if (!visible.length) {
        el.list.replaceChildren(createEl('p', { text: TEXTS.noEpisodes }));
        return;
      }

      const me = norm(CURRENT_USER);
      el.list.replaceChildren(
        ...visible.map((ep, i) => {
          const arrNorm = ep.participants.map(norm);
          const lastIdx = arrNorm.findIndex((n) =>
            isSame(n, norm(ep.last_username || '')),
          );
          const meIdx = arrNorm.findIndex((n) => isSame(n, me));
          const alert =
            ep.num_replies > 0 &&
            lastIdx !== -1 &&
            meIdx !== -1 &&
            (lastIdx + 1) % arrNorm.length === meIdx;

          const wrap = createEl('div', {
            className: `episode${alert ? ' episode-alert' : ''}`,
            dataset: { i },
          });
          const actions = createEl('div', { className: 'episode-actions' });
          const editBtn = createEl('button', {
            className: 'episode-action episode-edit',
            title: TEXTS.editTitle,
            text: '✎',
          });
          const delBtn = createEl('button', {
            className: 'episode-action episode-remove',
            title: TEXTS.deleteTitle,
            text: '×',
          });
          actions.append(editBtn, delBtn);

          const titleDiv = createEl('div');
          titleDiv.append(
            createEl('b', { text: TEXTS.titleLabel + ' ' }),
            createEl('a', {
              href: ep.url,
              target: '_blank',
              rel: 'noopener',
              text: ep.subject || ep.url,
            }),
          );

          const partsDiv = createEl('div');
          partsDiv.append(
            createEl('b', { text: TEXTS.participantsLabel + ' ' }),
          );
          ep.participants.forEach((n, idx) => {
            if (idx) partsDiv.append(', ');
            partsDiv.append(
              createEl('span', { className: 'participant', text: n }),
            );
          });

          const lastDiv = createEl('div');
          lastDiv.append(createEl('b', { text: TEXTS.lastLabel + ' ' }));
          if (ep.last_username) lastDiv.append(ep.last_username);
          else
            lastDiv.append(
              createEl('span', {
                className: 'last-username-empty',
                text: TEXTS.noData,
              }),
            );

          const ownerDiv = createEl('div', { className: 'owner-tag' });
          ownerDiv.append(
            createEl('em', {
              text: `${TEXTS.ownerTag} ${ep.owner || LEGACY_OWNER}`,
            }),
          );

          wrap.append(actions, titleDiv, partsDiv, lastDiv, ownerDiv);
          return wrap;
        }),
      );
    }

    function renderAll() {
      renderOwnerFilters();
      renderEpisodes();
    }

    el.btnShowForm.addEventListener('click', () => {
      el.form.style.display = 'flex';
      el.btnShowForm.style.display = 'none';
      el.ownerInput.value = CURRENT_USER || '';
      setTimeout(() => el.urlInput.focus(), 20);
    });

    el.btnAddPart.addEventListener('click', () => {
      if (participantCount >= config.maxParticipants) return;
      const last = el.partBox.querySelector('label:last-child input');
      if (!last.value.trim()) return last.focus();

      participantCount++;
      const label = createEl('label');
      const input = createEl('input', { type: 'text', name: 'participant' });
      label.append(`${TEXTS.participantLabel} ${participantCount}:`, input);
      el.partBox.appendChild(label);
      if (participantCount >= config.maxParticipants)
        el.btnAddPart.disabled = true;
    });

    el.form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const url = el.urlInput.value.trim();
      const owner = el.ownerInput.value.trim() || LEGACY_OWNER;
      const partsInp = $$('input', el.partBox);
      const participants = partsInp.map((i) => i.value.trim()).filter(Boolean);

      if (!url || !participants.length)
        return showToast('Заполните ссылку и участников', { type: 'error' });

      const info = parseUrl(url);
      const topicId = info?.id ?? null;
      const domain = info?.domain ?? null;

      const duplicate = store.episodes.some(
        (ep, idx) =>
          (topicId ? ep.topicId === topicId : ep.url === url) &&
          idx !== editIndex,
      );
      if (duplicate)
        return showToast('Такой эпизод уже есть', { type: 'error' });

      let meta = { title: null, replies: 0, last: null };
      if (topicId && domain) meta = await fetchTopicMeta(domain, topicId);

      const newEp = {
        url,
        participants,
        owner,
        last_username: meta.last,
        subject: meta.title,
        num_replies: meta.replies,
        topicId,
        domain,
      };

      const arr = store.episodes;
      if (editIndex === -1) arr.push(newEp);
      else Object.assign(arr[editIndex], newEp);

      store.episodes = arr;
      resetForm();
      renderAll();
    });

    el.btnRefresh.addEventListener('click', async () => {
      el.list.replaceChildren(createEl('p', { text: 'Обновление…' }));
      await refreshEpisodes();
      store.lastStamp = Date.now();
    });

    async function refreshEpisodes() {
      const arr = store.episodes;
      for (const ep of arr) {
        if (ep.topicId && ep.domain) {
          const m = await fetchTopicMeta(ep.domain, ep.topicId);
          ep.last_username = m.last;
          ep.num_replies = m.replies;
          ep.subject = m.title;
        }
        if (!ep.owner) ep.owner = LEGACY_OWNER;
      }
      store.episodes = arr;
      renderAll();
    }

    el.btnExport.addEventListener('click', async () => {
      const ok = await copyToClipboard(JSON.stringify(store.episodes, null, 2));
      showToast(ok ? TEXTS.exportSuccess : TEXTS.exportError, {
        type: ok ? 'success' : 'error',
      });
    });

    el.btnImport.addEventListener('click', async () => {
      const raw = await dialog('Вставьте экспортированные данные:', {
        prompt: true,
      });
      if (!raw) return;

      let data;
      try {
        data = JSON.parse(raw);
        if (!Array.isArray(data)) throw 0;
      } catch {
        return showToast('Неверный формат', { type: 'error' });
      }

      const arr = store.episodes;
      let added = 0,
        skipped = 0;

      data.forEach((it) => {
        if (!it.owner) it.owner = LEGACY_OWNER;
        const exists = arr.some(
          (e) =>
            (it.topicId && e.topicId === it.topicId) ||
            (!it.topicId && e.url === it.url),
        );
        if (exists) skipped++;
        else {
          arr.push(it);
          added++;
        }
      });

      store.episodes = arr;
      renderAll();
      showToast(`Импорт: добавлено ${added}, повторов исключено ${skipped}`);
    });

    el.list.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.episode-action');
      if (!btn) return;
      const idx = +btn.closest('.episode').dataset.i;

      if (btn.classList.contains('episode-remove')) {
        if (await dialog('Удалить эпизод?')) {
          const arr = store.episodes;
          arr.splice(idx, 1);
          store.episodes = arr;
          renderAll();
        }
      } else {
        startEdit(idx);
      }
    });

    function startEdit(idx) {
      const ep = store.episodes[idx];
      editIndex = idx;

      el.urlInput.value = ep.url;
      el.ownerInput.value = ep.owner || LEGACY_OWNER;
      el.partBox.replaceChildren();
      ep.participants.forEach((p, i) => {
        const label = createEl('label');
        const input = createEl('input', {
          type: 'text',
          name: 'participant',
          value: p,
        });
        if (i === 0) input.required = true;
        label.append(`${TEXTS.participantLabel} ${i + 1}:`, input);
        el.partBox.appendChild(label);
      });

      participantCount = ep.participants.length;
      el.btnAddPart.disabled = participantCount >= config.maxParticipants;
      el.form.style.display = 'flex';
      el.btnShowForm.style.display = 'none';
      el.btnSave.textContent = TEXTS.saveEpisode;
      setTimeout(() => el.urlInput.focus(), 20);
    }

    renderAll();
  }

  helpers.register('episodeTracker', { init });
})();
