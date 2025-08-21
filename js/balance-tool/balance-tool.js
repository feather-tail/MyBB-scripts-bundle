(() => {
  'use strict';

  const CONFIG = {
    ui: {
      insertAfterSelector: '.post-rating',
      openButtonText: 'Баланс',
      runButtonText: 'Выполнить',
      labels: { type: 'Тип операции', amount: 'Количество' },
      inputStyle: 'color:#111 !important',
    },
    access: { allowedTopicIds: ['1', '2', '3'], allowedGroupIds: [1] },
    profileFieldKey: 'auto',
    operations: [
      { title: 'Начисление', factor: 1, topics: 'all' },
      { title: 'Списание', factor: -1, topics: 'all' },
    ],
    decimals: 2,
    decoratePost: true,
    simulateOnly: false,
    rate: { max: 10, windowMs: 300000 },
    wrapper: {
      start: `[spoiler="[b]ОБРАБОТАНО[/b] ({{ADMIN_NAME}}) — было: {{CACHE_BEFORE}}, стало: {{CACHE_AFTER}}"]\n[b]Операция:[/b] авто&#8209;начисление из темы банка\n\n`,
      end: `\n[/spoiler]`,
    },
    adminAliases: { 1: 'АМС' },
    endpoints: {
      profileUrl: (uid) => `/profile.php?section=fields&id=${uid}`,
      profileFormSelector: 'form[action*="profile.php"][method="post"]',
      postEditUrl: (pid) => `/edit.php?id=${pid}&action=edit`,
      postEditFormSelector: 'form[action*="edit.php"][method="post"]',
      postEditMessageField: 'req_message',
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const parseHTML = (html) =>
    new DOMParser().parseFromString(html, 'text/html');
  const topicId = () => new URLSearchParams(location.search).get('id') || '';
  const allowedTopic = (id) =>
    CONFIG.access.allowedTopicIds.includes(String(id));
  const allowedGroup = (gid) =>
    CONFIG.access.allowedGroupIds.includes(Number(gid));
  const pickAdminName = () =>
    CONFIG.adminAliases?.[window.UserID] || window.UserLogin || 'Администратор';
  const roundVal = (v, d) => {
    if (!Number.isFinite(v)) return 0;
    if (d === 0) return Math.trunc(v);
    const p = 10 ** d;
    return Math.round(v * p) / p;
  };
  const encodeNonAscii = (s) =>
    String(s).replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const normalizeEntities = (s) => String(s).replace(/&amp;#(\d+);/g, '&#$1;');
  const topicsMatch = (opTopics, id) =>
    opTopics === 'all' ||
    (Array.isArray(opTopics) && opTopics.includes(String(id)));

  const crc32 = (s) => {
    let c = ~0;
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i);
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (~c >>> 0).toString(16).padStart(8, '0');
  };
  const fieldsHash = (form) => {
    const arr = [];
    for (const el of Array.from(form.elements || [])) {
      if (!el.name) continue;
      if (/^form\[\w+\]$/.test(el.name))
        arr.push(el.name + '=' + String(el.value ?? ''));
    }
    arr.sort();
    return crc32(arr.join('&'));
  };

  const withTimeout = (p, ms = 15000) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Таймаут запроса')), ms),
      ),
    ]);

  const fetchDoc = async (url) => {
    const res = await withTimeout(fetch(url, { credentials: 'same-origin' }));
    if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
    const buf = await res.arrayBuffer();
    let txt;
    try {
      txt = new TextDecoder('utf-8').decode(buf);
    } catch {}
    if (!txt || /charset=windows-1251/i.test(txt))
      txt = new TextDecoder('windows-1251').decode(buf);
    return parseHTML(txt);
  };
  const fetchForm = async (url, selector) => {
    const doc = await fetchDoc(url);
    const form =
      typeof selector === 'string' ? $(selector, doc) : selector(doc);
    if (!form) throw new Error('Форма не найдена');
    return form;
  };
  const postForm = async (url, params, ref) => {
    const res = await withTimeout(
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        referrer: ref || url,
        referrerPolicy: 'strict-origin-when-cross-origin',
        mode: 'same-origin',
      }),
    );
    if (!res.ok) throw new Error(`POST ${url} ${res.status}`);
    return res;
  };

  const findSubmit = (form) => {
    let x = form.querySelector('input[type="submit"][name]');
    if (x) return { name: x.name, value: x.value || '1' };
    x = form.querySelector('button[type="submit"][name]');
    if (x) return { name: x.name, value: x.value || '1' };
    x = form.querySelector(
      'input[name="update"],input[name="submit"],input[name="save"]',
    );
    if (x) return { name: x.name, value: x.value || '1' };
    return null;
  };

  const buildProfileParams = (form, targetName, targetValue) => {
    const p = new URLSearchParams();
    const isHidden = (el) =>
      el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'hidden';
    for (const el of Array.from(form.elements || [])) {
      if (!el.name || el.disabled) continue;
      const type = (el.type || '').toLowerCase();
      if (isHidden(el)) {
        p.append(el.name, el.value ?? '');
        continue;
      }
      if (el.name === 'form_sent') {
        p.set('form_sent', el.value || '1');
        continue;
      }
      if (/^form\[\w+\]$/.test(el.name)) {
        const val =
          el.name === targetName ? String(targetValue) : el.value ?? '';
        p.set(el.name, encodeNonAscii(val));
        continue;
      }
    }
    if (!p.has('form_sent')) p.set('form_sent', '1');
    if (!p.has(targetName)) p.set(targetName, String(targetValue));
    const s = findSubmit(form);
    if (s) p.append(s.name, s.value);
    return p;
  };

  const buildEditParams = (form, msgField, msgValue) => {
    const p = new URLSearchParams();
    const isHidden = (el) =>
      el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'hidden';
    for (const el of Array.from(form.elements || [])) {
      if (!el.name || el.disabled) continue;
      const type = (el.type || '').toLowerCase();
      if (isHidden(el)) {
        p.append(el.name, el.value ?? '');
        continue;
      }
      if (el.name === 'form_sent') {
        p.set('form_sent', el.value || '1');
        continue;
      }
      if (type === 'checkbox' && el.checked) {
        if (/(hide|silent|subscribe|stick|closed)/i.test(el.name))
          p.append(el.name, el.value || '1');
      }
    }
    if (!p.has('form_sent')) p.set('form_sent', '1');
    p.set(msgField, normalizeEntities(encodeNonAscii(msgValue)));
    const subj = form.querySelector(
      'input[name="req_subject"],input[name="subject"]',
    );
    if (subj && subj.name)
      p.set(subj.name, normalizeEntities(encodeNonAscii(subj.value ?? '')));
    const s = findSubmit(form);
    if (s) p.append(s.name, s.value);
    return p;
  };

  const getUserId = (postRoot) => {
    const holder =
      postRoot.closest('[data-user-id]') ||
      postRoot.querySelector('[data-user-id]');
    if (holder?.dataset.userId) return String(holder.dataset.userId);
    const link = postRoot.querySelector('.pa-author a[href*="profile.php"]');
    if (link) {
      const u = new URL(link.href, location.origin);
      const id = u.searchParams.get('id');
      if (id) return String(id);
    }
    throw new Error('Не удалось определить ID пользователя поста');
  };
  const getPostId = (postRoot) => {
    const c =
      postRoot.closest('[id^="p"]') || postRoot.querySelector('[id^="p"]');
    if (c) {
      const m = String(c.id).match(/^p(\d+)/);
      if (m) return m[1];
    }
    const link = postRoot.querySelector(
      'a.permalink[href*="pid="],a.permalink[href*="edit.php?id="]',
    );
    if (link) {
      const u = new URL(link.href, location.origin);
      return u.searchParams.get('pid') || u.searchParams.get('id') || '';
    }
    throw new Error('Не удалось определить ID поста');
  };

  const toast = (msg, ok = true) => {
    const el = document.createElement('div');
    el.className =
      'balance-tool__toast ' +
      (ok ? 'balance-tool__toast--ok' : 'balance-tool__toast--err');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2200);
  };

  const LS_KEY = 'balance-tool:last';
  const saveLast = (factor, qty) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ factor, qty }));
    } catch {}
  };
  const loadLast = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '');
    } catch {
      return null;
    }
  };

  const queue = [];
  let queueBusy = false;
  const enqueue = async (fn) => {
    queue.push(fn);
    if (queueBusy) return;
    queueBusy = true;
    while (queue.length) {
      const f = queue.shift();
      try {
        await f();
      } catch (e) {}
    }
    queueBusy = false;
  };

  const ring = [];
  const rateOk = () => {
    const now = Date.now();
    while (ring.length && now - ring[0] > CONFIG.rate.windowMs) ring.shift();
    if (ring.length >= CONFIG.rate.max) return false;
    ring.push(now);
    return true;
  };

  const resolveMoneyFieldName = (profileForm) => {
    if (CONFIG.profileFieldKey !== 'auto')
      return `form[${CONFIG.profileFieldKey}]`;
    const legends = ['деньги', 'баланс'];
    for (const fs of profileForm.querySelectorAll('fieldset')) {
      const t = (
        fs.querySelector('legend,legend span')?.textContent || ''
      ).toLowerCase();
      if (legends.some((w) => t.includes(w))) {
        const inp = fs.querySelector('input[name^="form["]');
        if (inp?.name) return inp.name;
      }
    }
    const all = Array.from(
      profileForm.querySelectorAll('input[name^="form["]'),
    );
    const cand = all.find((i) => Number.isFinite(parseFloat(i.value)));
    return cand?.name || 'form[fld3]';
  };

  const buildReport = (factor, qty, before, after) =>
    `<div class="balance-tool__report"><dl class="balance-tool__kv"><dt>Тип операции</dt><dd>${
      factor > 0 ? `начисление (+ ${factor})` : `списание (${factor})`
    }</dd><dt>Количество</dt><dd>${qty}</dd><dt>Было</dt><dd>${before}</dd><dt>Стало</dt><dd>${after}</dd></dl><p>Новые значения будут видны после обновления страницы.</p></div>`;

  const mountAll = () => {
    $$(CONFIG.ui.insertAfterSelector).forEach((a) => {
      if (a.dataset.btMounted) return;
      a.dataset.btMounted = '1';
      try {
        mountUI(a);
      } catch (e) {}
    });
  };
  const mo = new MutationObserver(() => mountAll());

  const start = () => {
    if (!allowedTopic(topicId()) || !allowedGroup(window.GroupID)) return;
    mountAll();
    mo.observe(document.body, { childList: true, subtree: true });
  };

  function mountUI(anchor) {
    const postRoot = anchor.closest('.post,[id^="p"]') || anchor.parentElement;
    if (!postRoot) return;
    const wrap = document.createElement('div');
    wrap.className = 'balance-tool';
    anchor.insertAdjacentElement('afterend', wrap);
    const btnOpen = document.createElement('input');
    btnOpen.type = 'button';
    btnOpen.value = CONFIG.ui.openButtonText;
    btnOpen.className = 'balance-tool__open';
    btnOpen.setAttribute('aria-expanded', 'false');
    btnOpen.setAttribute('aria-controls', '');
    const panel = document.createElement('div');
    panel.className = 'balance-tool__panel';
    panel.hidden = true;
    const panelId = 'bt-panel-' + Math.random().toString(36).slice(2);
    panel.id = panelId;
    btnOpen.setAttribute('aria-controls', panelId);
    const sel = document.createElement('select');
    sel.className = 'balance-tool__select';
    sel.append(new Option('Не выбрано', ''));
    const ops = CONFIG.operations.filter((op) =>
      topicsMatch(op.topics, topicId()),
    );
    for (const op of ops) {
      sel.append(
        new Option(
          `${op.title} (${op.factor > 0 ? '+' : ''}${op.factor})`,
          String(op.factor),
        ),
      );
    }
    const amt = document.createElement('input');
    amt.type = 'number';
    amt.min = '0';
    amt.step = CONFIG.decimals > 0 ? String(1 / 10 ** CONFIG.decimals) : '1';
    amt.className = 'balance-tool__amount';
    amt.setAttribute('style', CONFIG.ui.inputStyle);
    amt.setAttribute('inputmode', 'decimal');
    amt.setAttribute('aria-label', 'Количество');
    const btnRun = document.createElement('input');
    btnRun.type = 'button';
    btnRun.value = CONFIG.ui.runButtonText;
    btnRun.className = 'balance-tool__run';
    btnRun.disabled = true;
    btnRun.setAttribute('aria-disabled', 'true');
    const rowType = document.createElement('p');
    rowType.className = 'balance-tool__row';
    const labelType = document.createElement('label');
    labelType.className = 'balance-tool__label';
    labelType.textContent = CONFIG.ui.labels.type;
    labelType.htmlFor = '';
    rowType.append(labelType, sel);
    const rowAmt = document.createElement('p');
    rowAmt.className = 'balance-tool__row';
    const labelAmt = document.createElement('label');
    labelAmt.className = 'balance-tool__label';
    labelAmt.textContent = CONFIG.ui.labels.amount;
    labelAmt.htmlFor = '';
    rowAmt.append(labelAmt, amt);
    const statusArea = document.createElement('div');
    statusArea.className = 'balance-tool__status-area';
    btnOpen.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      btnOpen.setAttribute('aria-expanded', String(!panel.hidden));
    });
    const toggleRun = () => {
      const en = !!(sel.value && Number(amt.value) > 0);
      btnRun.disabled = !en;
      btnRun.setAttribute('aria-disabled', String(!en));
    };
    sel.addEventListener('change', toggleRun);
    amt.addEventListener('input', toggleRun);
    amt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btnRun.disabled) btnRun.click();
    });
    const last = loadLast();
    if (last) {
      if (String(last.factor)) sel.value = String(last.factor);
      if (last.qty > 0) {
        amt.value = last.qty;
      }
      toggleRun();
    }
    btnRun.addEventListener('click', () => {
      if (!rateOk()) {
        toast('Слишком часто. Попробуйте позже.', false);
        return;
      }
      wrap.classList.add('is-busy');
      statusArea.innerHTML = '';
      btnRun.disabled = true;
      btnRun.setAttribute('aria-disabled', 'true');
      sel.disabled = true;
      amt.disabled = true;
      const task = async () => {
        try {
          await applyOperation({
            postRoot,
            statusArea,
            factor: parseFloat(sel.value),
            qty: Number(amt.value),
          });
        } catch (e) {
          statusArea.innerHTML = `<p class="balance-tool__error">${
            e.message || e
          }</p>`;
          toast('Ошибка операции', false);
        } finally {
          wrap.classList.remove('is-busy');
          sel.disabled = false;
          amt.disabled = false;
          toggleRun();
        }
      };
      enqueue(task);
      saveLast(parseFloat(sel.value), Number(amt.value));
    });
    panel.append(rowType, rowAmt, btnRun, statusArea);
    wrap.append(btnOpen, panel);
  }

  async function applyOperation({ postRoot, statusArea, factor, qty }) {
    const userId = getUserId(postRoot);
    const postId = getPostId(postRoot);
    const profileUrl = CONFIG.endpoints.profileUrl(userId);
    const profileForm = await fetchForm(
      profileUrl,
      CONFIG.endpoints.profileFormSelector,
    );
    const profileAction = profileForm.getAttribute('action') || profileUrl;
    const moneyField = resolveMoneyFieldName(profileForm);
    const moneyInput = profileForm.querySelector(
      `input[name="${CSS.escape(moneyField)}"]`,
    );
    const current = parseFloat(moneyInput?.value || '0') || 0;
    const next = roundVal(current + factor * qty, CONFIG.decimals);
    if (CONFIG.simulateOnly) {
      statusArea.innerHTML =
        buildReport(factor, qty, current, next) +
        `<p>&#129514; Предпросмотр: без сохранения.</p>`;
      toast('Предпросмотр выполнен');
      return;
    }
    const beforeHash = fieldsHash(profileForm);
    const profileParams = buildProfileParams(profileForm, moneyField, next);
    await postForm(profileAction, profileParams, profileAction);
    const afterForm = await fetchForm(
      profileAction,
      CONFIG.endpoints.profileFormSelector,
    );
    const afterInput = afterForm.querySelector(
      `input[name="${CSS.escape(moneyField)}"]`,
    );
    const saved = parseFloat(afterInput?.value || '0') || 0;
    const ok = Math.abs(saved - next) < 1 / 10 ** (CONFIG.decimals + 1);
    const afterHash = fieldsHash(afterForm);
    const hashChanged = beforeHash !== afterHash;
    statusArea.innerHTML =
      buildReport(factor, qty, current, saved) +
      (ok
        ? `<p>&#9989; Сохранено.</p>`
        : `<p class="balance-tool__error">&#9888;&#65039; Значение не подтвердилось сервером.</p>`) +
      (hashChanged
        ? `<p>&#8505;&#65039; Профиль изменён: возможно, кто-то редактировал параллельно.</p>`
        : '');
    toast(ok ? 'Баланс обновлён' : 'Проверка не прошла', ok);
    if (!CONFIG.decoratePost) return;
    const editUrl = CONFIG.endpoints.postEditUrl(postId);
    const editForm = await fetchForm(
      editUrl,
      CONFIG.endpoints.postEditFormSelector,
    );
    const editAction = editForm.getAttribute('action') || editUrl;
    let msgField = CONFIG.endpoints.postEditMessageField;
    let msgEl =
      editForm.querySelector(`textarea[name="${CSS.escape(msgField)}"]`) ||
      editForm.querySelector('textarea[name="message"]') ||
      editForm.querySelector('textarea[name*="message"]') ||
      editForm.querySelector('textarea');
    if (!msgEl || !msgEl.name)
      throw new Error('Поле текста сообщения не найдено');
    msgField = msgEl.name;
    const original = msgEl.value || '';
    let decorated = CONFIG.wrapper.start + original + CONFIG.wrapper.end;
    decorated = decorated
      .replaceAll('{{CACHE_BEFORE}}', String(current))
      .replaceAll('{{CACHE_AFTER}}', String(ok ? saved : next))
      .replaceAll('{{ADMIN_NAME}}', pickAdminName());
    const editParams = buildEditParams(editForm, msgField, decorated);
    await postForm(editAction, editParams, editAction);
    statusArea.insertAdjacentHTML(
      'beforeend',
      '<p>Сообщение обёрнуто шаблоном.</p>',
    );
  }

  start();
})();
