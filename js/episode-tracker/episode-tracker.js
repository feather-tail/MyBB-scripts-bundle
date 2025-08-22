(() => {
  'use strict';

  const { $, $$, copyToClipboard } = window.helpers;
  const CFG = window.ScriptConfig.episodeTracker;

  const ALLOWED_GROUP_IDS = new Set(CFG.allowedGroupIds);
  if (!ALLOWED_GROUP_IDS.has(window.GroupID)) return;

  const CURRENT_USER = (window.UserLogin || '').trim();
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
    fetch(
      `${domain}/api.php?method=topic.get&topic_id=${id}&fields=subject,title,num_replies,last_username&format=json`,
    )
      .then((r) => r.json())
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

  const anchorSel = CFG.selectors.insertAfter || CFG.selectors.anchor;
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

  (document.readyState === 'loading'
    ? new Promise(waitAnchor)
    : Promise.resolve($(anchorSel) || new Promise(waitAnchor))
  ).then(initUI);

  function initUI(anchor) {
    anchor.insertAdjacentHTML(
      'afterend',
      `<li id="h-episodes"><a href="#" id="episodesOpenBtn">Эпизоды</a></li>`,
    );

    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div class="modal" id="episodesModal">
        <div class="episodes-modal-content">
          <div class="top-bar">
            <button id="exportBtn">Экспорт</button>
            <button id="importBtn">Импорт</button>
            <button class="close-btn" id="closeX" title="Закрыть">&times;</button>
          </div>

          <h2 class="tracker-header">Трекер эпизодов</h2>

          <div id="ownerFilters" class="owner-filters"></div>

          <div id="episodesList" class="episodes-list"><p>Пока нет эпизодов…</p></div>

          <form id="episodeForm" class="add-episode-form" style="display:none;">
            <label>Ссылка на эпизод:
              <input type="url" id="episodeUrl" required placeholder="https://...">
            </label>

            <label>Автор:
              <input type="text" id="episodeOwner" placeholder="Логин автора">
            </label>

            <div id="participantsBox">
              <label>Участник 1:<input type="text" name="participant" required placeholder="Имя игрока (по очередности отписи)"></label>
            </div>

            <button type="button" id="addParticipantBtn">Новый участник</button>
            <button type="submit" id="saveEpisodeBtn">Добавить эпизод</button>
          </form>

          <div class="modal-actions primary-row">
            <button id="refreshBtn" title="Обновить">&#x21bb;</button>
            <button id="showFormBtn">Новый эпизод</button>
          </div>
        </div>
      </div>
    `,
    );

    const el = {
      modal: $('#episodesModal'),
      btnOpen: $('#episodesOpenBtn'),
      btnClose: $('#closeX'),
      list: $('#episodesList'),
      btnRefresh: $('#refreshBtn'),
      btnExport: $('#exportBtn'),
      btnImport: $('#importBtn'),
      form: $('#episodeForm'),
      urlInput: $('#episodeUrl'),
      ownerInput: $('#episodeOwner'),
      partBox: $('#participantsBox'),
      btnAddPart: $('#addParticipantBtn'),
      btnShowForm: $('#showFormBtn'),
      btnSave: $('#saveEpisodeBtn'),
      ownerFilters: $('#ownerFilters'),
    };

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
      el.btnSave.textContent = 'Добавить';
    }

    function renderOwnerFilters() {
      const owners = [
        ...new Set(store.episodes.map((e) => (e.owner || LEGACY_OWNER).trim())),
      ].sort((a, b) => a.localeCompare(b, 'ru'));

      if (CURRENT_USER && !owners.includes(CURRENT_USER))
        owners.unshift(CURRENT_USER);

      el.ownerFilters.innerHTML = owners
        .map(
          (
            o,
          ) => `<label><input type="checkbox" class="owner-filter" value="${o}"
            ${activeOwners.has(o) ? 'checked' : ''}> ${o}</label>`,
        )
        .join('');

      $$('input.owner-filter', el.ownerFilters).forEach((inp) =>
        inp.addEventListener('change', () => {
          if (inp.checked) activeOwners.add(inp.value);
          else activeOwners.delete(inp.value);
          renderEpisodes();
        }),
      );
    }

    function renderEpisodes() {
      const visible = store.episodes.filter((e) =>
        activeOwners.has((e.owner || LEGACY_OWNER).trim()),
      );

      if (!visible.length) {
        el.list.innerHTML = '<p>Эпизодов нет…</p>';
        return;
      }

      const me = norm(CURRENT_USER);
      el.list.innerHTML = visible
        .map((ep, i) => {
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

          return `
          <div class="episode${alert ? ' episode-alert' : ''}" data-i="${i}">
            <div class="episode-actions">
              <button class="episode-action episode-edit"   title="Редактировать">✎</button>
              <button class="episode-action episode-remove" title="Удалить">×</button>
            </div>
            <div><b>Название эпизода:</b> <a href="${
              ep.url
            }" target="_blank" rel="noopener">${ep.subject || ep.url}</a></div>
            <div><b>Участники:</b> ${ep.participants
              .map((n) => `<span class="participant">${n}</span>`)
              .join(', ')}</div>
            <div><b>Последний пост:</b> ${
              ep.last_username ||
              '<span class="last-username-empty">Нет данных</span>'
            }</div>
            <div class="owner-tag"><em>Автор: ${
              ep.owner || LEGACY_OWNER
            }</em></div>
          </div>`;
        })
        .join('');
    }

    function renderAll() {
      renderOwnerFilters();
      renderEpisodes();
    }

    el.btnOpen.addEventListener('click', async (ev) => {
      ev.preventDefault();
      el.modal.style.display = 'block';

      if (Date.now() - store.lastStamp > CFG.oneDayMs) {
        el.list.textContent = 'Автообновление…';
        await refreshEpisodes();
        store.lastStamp = Date.now();
      } else {
        renderAll();
      }
    });

    el.btnClose.addEventListener('click', () => {
      el.modal.style.display = 'none';
      resetForm();
    });

    window.addEventListener('click', (e) => {
      if (e.target === el.modal) {
        el.modal.style.display = 'none';
        resetForm();
      }
    });

    el.btnShowForm.addEventListener('click', () => {
      el.form.style.display = 'flex';
      el.btnShowForm.style.display = 'none';
      el.ownerInput.value = CURRENT_USER || '';
      setTimeout(() => el.urlInput.focus(), 20);
    });

    el.btnAddPart.addEventListener('click', () => {
      if (participantCount >= CFG.maxParticipants) return;
      const last = el.partBox.querySelector('label:last-child input');
      if (!last.value.trim()) return last.focus();

      participantCount++;
      el.partBox.insertAdjacentHTML(
        'beforeend',
        `<label>Участник ${participantCount}:<input type="text" name="participant"></label>`,
      );
      if (participantCount >= CFG.maxParticipants)
        el.btnAddPart.disabled = true;
    });

    el.form.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const url = el.urlInput.value.trim();
      const owner = el.ownerInput.value.trim() || LEGACY_OWNER;
      const partsInp = $$('input', el.partBox);
      const participants = partsInp.map((i) => i.value.trim()).filter(Boolean);

      if (!url || !participants.length)
        return alert('Заполните ссылку и участников');

      const info = parseUrl(url);
      const topicId = info?.id ?? null;
      const domain = info?.domain ?? null;

      const duplicate = store.episodes.some(
        (ep, idx) =>
          (topicId ? ep.topicId === topicId : ep.url === url) &&
          idx !== editIndex,
      );
      if (duplicate) return alert('Такой эпизод уже есть');

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
      el.list.textContent = 'Обновление…';
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

    el.btnExport.addEventListener('click', () =>
      copyToClipboard(JSON.stringify(store.episodes, null, 2)),
    );

    el.btnImport.addEventListener('click', () => {
      const raw = prompt('Вставьте экспортированные данные:');
      if (!raw) return;

      let data;
      try {
        data = JSON.parse(raw);
        if (!Array.isArray(data)) throw 0;
      } catch {
        return alert('Неверный формат');
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
      alert(`Импорт: добавлено ${added}, повторов исключено ${skipped}`);
    });

    el.list.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.episode-action');
      if (!btn) return;
      const idx = +btn.closest('.episode').dataset.i;

      if (btn.classList.contains('episode-remove')) {
        if (confirm('Удалить эпизод?')) {
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
      el.partBox.innerHTML = '';
      ep.participants.forEach((p, i) => {
        el.partBox.insertAdjacentHTML(
          'beforeend',
          `<label>Участник ${
            i + 1
          }:<input type="text" name="participant" value="${p}" ${
            i === 0 ? 'required' : ''
          }></label>`,
        );
      });

      participantCount = ep.participants.length;
      el.btnAddPart.disabled = participantCount >= CFG.maxParticipants;
      el.form.style.display = 'flex';
      el.btnShowForm.style.display = 'none';
      el.btnSave.textContent = 'Сохранить';
      setTimeout(() => el.urlInput.focus(), 20);
    }

    renderAll();
  }
})();
