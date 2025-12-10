(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const {
    $,
    $$,
    getConfig,
    parseHTML: helpersParseHTML,
    withTimeout: helpersWithTimeout,
    request,
    runOnceOnReady,
  } = helpers;

  const CONFIG_NAME = 'adminBank';

  const DEFAULT_CONFIG = {
    endpoints: {
      bankApiUrl: 'https://feathertail.ru/ks/bank/bank-api.php',
      forumApiBase: '/api.php',
      profileUrl: (uid) => `/profile.php?section=fields&id=${uid}`,
      profileFormSelector: 'form[action*="profile.php"][method="post"]',
    },
    profile: {
      moneyFieldName: 'form[fld4]',
      decimals: 2,
    },
    requestTimeoutMs: 15000,
    selectors: {
      root: '#ks-bank-admin-root',
      messages: '#ks-bank-admin-messages',
      summaryBox: '#ks-bank-admin-summary',
      list: '#ks-bank-admin-list',
      reloadBtn: '#ks-bank-admin-reload',
      statusFilter: '#ks-bank-admin-status',
      searchInput: '#ks-bank-admin-search',
    },
  };

  const SETTINGS =
    typeof getConfig === 'function'
      ? getConfig(CONFIG_NAME, DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

  const SELECTORS = SETTINGS.selectors || DEFAULT_CONFIG.selectors;
  const ENDPOINTS = SETTINGS.endpoints || DEFAULT_CONFIG.endpoints;
  const PROFILE_SETTINGS = SETTINGS.profile || DEFAULT_CONFIG.profile;

  const API_URL = ENDPOINTS.bankApiUrl || DEFAULT_CONFIG.endpoints.bankApiUrl;

  const FORUM_API_BASE =
    ENDPOINTS.forumApiBase || DEFAULT_CONFIG.endpoints.forumApiBase;

  const profileUrl =
    typeof ENDPOINTS.profileUrl === 'function'
      ? ENDPOINTS.profileUrl
      : DEFAULT_CONFIG.endpoints.profileUrl;

  const PROFILE_FORM_SELECTOR =
    ENDPOINTS.profileFormSelector ||
    DEFAULT_CONFIG.endpoints.profileFormSelector;

  const REQUEST_TIMEOUT_MS =
    typeof SETTINGS.requestTimeoutMs === 'number'
      ? SETTINGS.requestTimeoutMs
      : DEFAULT_CONFIG.requestTimeoutMs;

  const MONEY_FIELD_NAME =
    PROFILE_SETTINGS.moneyFieldName || DEFAULT_CONFIG.profile.moneyFieldName;

  const DECIMALS =
    typeof PROFILE_SETTINGS.decimals === 'number'
      ? PROFILE_SETTINGS.decimals
      : DEFAULT_CONFIG.profile.decimals;

  const parseHTML =
    typeof helpersParseHTML === 'function'
      ? helpersParseHTML
      : (html) => new DOMParser().parseFromString(html, 'text/html');

  const withTimeout =
    typeof helpersWithTimeout === 'function'
      ? helpersWithTimeout
      : (p, ms) =>
          ms
            ? Promise.race([
                p,
                new Promise((_, rej) =>
                  setTimeout(() => rej(new Error('Таймаут запроса')), ms),
                ),
              ])
            : p;

  const MULT_SIGN = '\u00D7';
  const DELTA_SIGN = '\u0394';

  const encodeNonAscii = (s) =>
    String(s).replace(/[\u0080-\uFFFF]/g, (ch) => `&#${ch.charCodeAt(0)};`);

  const roundVal = (v, d) => {
    const n = Number(v) || 0;
    if (!Number.isFinite(n)) return 0;
    if (!d) return Math.trunc(n);
    const p = 10 ** d;
    return Math.round(n * p) / p;
  };

  const fetchDoc = async (url) => {
    if (request && typeof TextDecoder !== 'undefined') {
      const res = await request(url, {
        timeout: REQUEST_TIMEOUT_MS,
      });
      if (!res.ok) throw new Error(`GET ${url} ${res.status}`);

      const buf = await res.arrayBuffer();
      let txt;
      try {
        txt = new TextDecoder('utf-8').decode(buf);
      } catch (e) {}

      if (!txt || /charset=windows-1251/i.test(txt)) {
        txt = new TextDecoder('windows-1251').decode(buf);
      }

      return parseHTML(txt);
    }

    const finalUrl = url.startsWith('http')
      ? url
      : new URL(url, location.origin).toString();

    const res = await withTimeout(
      fetch(finalUrl, { credentials: 'same-origin' }),
      REQUEST_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`GET ${finalUrl} ${res.status}`);
    const html = await res.text();
    return parseHTML(html);
  };

  const postForm = async (url, params, refUrl) => {
    const finalUrl = url.startsWith('http')
      ? url
      : new URL(url, location.origin).toString();
    const ref = refUrl
      ? refUrl.startsWith('http')
        ? refUrl
        : new URL(refUrl, location.origin).toString()
      : finalUrl;

    if (request) {
      const res = await request(finalUrl, {
        method: 'POST',
        data: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: REQUEST_TIMEOUT_MS,
        referrer: ref,
      });
      if (!res.ok) throw new Error(`POST ${finalUrl} ${res.status}`);
      return res;
    }

    const res = await withTimeout(
      fetch(finalUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        referrer: ref,
      }),
      REQUEST_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`POST ${finalUrl} ${res.status}`);
    return res;
  };

  const findSubmit = (form) => {
    let x = form.querySelector('input[type="submit"][name]');
    if (x) return { name: x.name, value: x.value || '1' };

    x = form.querySelector('button[type="submit"][name]');
    if (x) return { name: x.name, value: x.value || '1' };

    x = form.querySelector(
      'input[name="update"],input[name="submit"],input[name="save"],input[name="add_page"],input[name="update_group_membership"]',
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

  const fetchProfileForm = async (userId) => {
    const url = profileUrl(userId);
    const doc = await fetchDoc(url);

    const form =
      doc.querySelector(PROFILE_FORM_SELECTOR) ||
      doc.querySelector('form[id^="profile"]');
    if (!form) throw new Error('Форма профиля не найдена.');

    const raw = form.getAttribute('action') || url;
    const actionUrl = raw.startsWith('http')
      ? raw
      : new URL(raw, url).toString();

    return { form, actionUrl };
  };

  const fetchJson = (url) =>
    withTimeout(
      fetch(url, { credentials: 'same-origin' }),
      REQUEST_TIMEOUT_MS,
    ).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });

  const getUserIdByUsername = async (username) => {
    if (!username) return null;
    const encoded = encodeURIComponent(username.trim());
    const url = `${FORUM_API_BASE}?method=users.get&username=${encoded}&fields=user_id`;
    const data = await fetchJson(url);
    if (
      data &&
      data.response &&
      Array.isArray(data.response.users) &&
      data.response.users.length > 0
    ) {
      return data.response.users[0].user_id;
    }
    return null;
  };

  const setMsg = (text, type) => {
    const box = $(SELECTORS.messages);
    if (!box) return;

    box.textContent = text || '';
    box.classList.remove(
      'ks-bank-admin__messages--error',
      'ks-bank-admin__messages--info',
    );
    if (!text) return;

    if (type === 'error') {
      box.classList.add('ks-bank-admin__messages--error');
    } else if (type === 'info') {
      box.classList.add('ks-bank-admin__messages--info');
    }
  };

  const formatTs = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toLocaleString();
  };

  let lastItems = [];
  let statusSelect = null;
  let searchInput = null;
  let busy = false;

  const renderSummaryBlock = (items) => {
    const root = $(SELECTORS.summaryBox);
    if (!root) return;
    root.innerHTML = '';

    if (!items.length) return;

    let totalSpend = 0;
    let totalEarn = 0;
    let totalDelta = 0;

    items.forEach((item) => {
      totalSpend += Number(item.total_spend) || 0;
      totalEarn += Number(item.total_earn) || 0;
      totalDelta +=
        Number(item.delta) ||
        (Number(item.total_earn) || 0) - (Number(item.total_spend) || 0);
    });

    const p1 = document.createElement('p');
    p1.textContent = `Заявок: ${items.length}`;

    const p2 = document.createElement('p');
    p2.textContent = `Суммарно к списанию: ${totalSpend}`;

    const p3 = document.createElement('p');
    p3.textContent = `Суммарно к начислению: ${totalEarn}`;

    const p4 = document.createElement('p');
    const sign = totalDelta >= 0 ? '+' : '';
    p4.textContent = `Общее сальдо: ${sign}${totalDelta}`;

    root.append(p1, p2, p3, p4);
  };

  const renderList = (items) => {
    const root = $(SELECTORS.list);
    if (!root) return;
    root.innerHTML = '';

    if (!items.length) {
      const div = document.createElement('div');
      div.className = 'ks-bank-admin__empty';
      div.textContent = 'Заявок с такими фильтрами нет.';
      root.appendChild(div);
      return;
    }

    items.forEach((item) => {
      const art = document.createElement('article');
      art.className = 'ks-bank-admin__item';
      art.dataset.id = String(item.id);
      if (item.user_id != null) {
        art.dataset.userId = String(item.user_id);
      }

      const header = document.createElement('div');
      header.className = 'ks-bank-admin__item-header';

      const meta = document.createElement('div');
      meta.className = 'ks-bank-admin__item-meta';

      const line1 = document.createElement('div');
      const userLabel =
        item.user_login || (item.user_id != null ? `uid ${item.user_id}` : '—');
      line1.innerHTML = `<strong>#${item.id}</strong> — ${userLabel}`;

      const line2 = document.createElement('div');
      line2.textContent = `Создано: ${formatTs(item.created_at)}`;

      const line3 = document.createElement('div');
      const deltaVal =
        Number(item.delta) ||
        (Number(item.total_earn) || 0) - (Number(item.total_spend) || 0);
      const deltaSign = deltaVal >= 0 ? '+' : '';
      line3.textContent = `Итоги: -${item.total_spend} / +${item.total_earn} (${DELTA_SIGN} ${deltaSign}${deltaVal})`;

      const line4 = document.createElement('div');
      if (typeof item.user_balance === 'number') {
        const after = item.user_balance + deltaVal;
        line4.innerHTML = `Баланс: ${item.user_balance} &#8594; ${after}`;
      } else {
        line4.textContent = 'Баланс: –';
      }

      meta.append(line1, line2, line3, line4);

      const actions = document.createElement('div');
      actions.className = 'ks-bank-admin__item-actions';

      const balanceBtn = document.createElement('button');
      balanceBtn.type = 'button';
      balanceBtn.className = 'ks-bank-admin__btn ks-bank-admin__btn--balance';
      balanceBtn.textContent = 'Изменить баланс';
      balanceBtn.dataset.action = 'balance';
      balanceBtn.dataset.id = String(item.id);

      if (item.balanceApplied) {
        balanceBtn.disabled = true;
        balanceBtn.textContent = 'Изменено';
        balanceBtn.classList.add('ks-bank-admin__btn--done');
      }

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'ks-bank-admin__btn ks-bank-admin__btn--ok';
      okBtn.textContent = 'Обработано';
      okBtn.dataset.action = 'processed';
      okBtn.dataset.id = String(item.id);

      const rejBtn = document.createElement('button');
      rejBtn.type = 'button';
      rejBtn.className = 'ks-bank-admin__btn ks-bank-admin__btn--reject';
      rejBtn.textContent = 'Отклонено';
      rejBtn.dataset.action = 'rejected';
      rejBtn.dataset.id = String(item.id);

      actions.append(balanceBtn, okBtn, rejBtn);

      header.append(meta, actions);
      art.appendChild(header);

      const details = document.createElement('div');
      details.className = 'ks-bank-admin__details';

      const payload = item.payload || {};
      const spend = Array.isArray(payload.spend) ? payload.spend : [];
      const earn = Array.isArray(payload.earn) ? payload.earn : [];

      const spendBlock = document.createElement('div');
      spendBlock.className = 'ks-bank-admin__subsection';
      const sTitle = document.createElement('h4');
      sTitle.textContent = 'Покупки';
      spendBlock.appendChild(sTitle);

      const sList = document.createElement('ul');
      if (spend.length) {
        spend.forEach((row) => {
          const li = document.createElement('li');
          li.textContent = `${row.label} — ${row.qty} шт. ${MULT_SIGN} ${row.cost} = ${row.sum}`;

          if (row.comment) {
            li.appendChild(document.createElement('br'));
            const span = document.createElement('span');
            span.className = 'ks-bank-admin__comment';
            span.textContent = `Комментарий: ${row.comment}`;
            li.appendChild(span);
          }

          sList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = '–';
        sList.appendChild(li);
      }
      spendBlock.appendChild(sList);

      const earnBlock = document.createElement('div');
      earnBlock.className = 'ks-bank-admin__subsection';
      const eTitle = document.createElement('h4');
      eTitle.textContent = 'Начисления';
      earnBlock.appendChild(eTitle);
      
      const eList = document.createElement('ul');
      if (earn.length) {
        earn.forEach((row) => {
          const li = document.createElement('li');
      
          li.textContent = `${row.label} — +${row.amount}`;
      
          if (row.url) {
            li.appendChild(document.createElement('br'));
            const link = document.createElement('a');
            link.href = row.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = row.url;
            li.appendChild(link);
          }
      
          if (row.comment) {
            li.appendChild(document.createElement('br'));
            const span = document.createElement('span');
            span.className = 'ks-bank-admin__comment';
            span.textContent = `Комментарий: ${row.comment}`;
            li.appendChild(span);
          }
      
          eList.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = '–';
        eList.appendChild(li);
      }
      earnBlock.appendChild(eList);

      details.append(spendBlock, earnBlock);
      art.appendChild(details);

      root.appendChild(art);
    });
  };

  const enrichUserBalances = async (items) => {
    const balanceByUserId = new Map();
    const userIdByName = new Map();

    for (const item of items) {
      try {
        let userId = item.user_id || item.userId || null;
        const username = item.user_login || null;

        if (!userId && username) {
          if (userIdByName.has(username)) {
            userId = userIdByName.get(username);
          } else {
            const fetchedId = await getUserIdByUsername(username);
            if (!fetchedId) continue;
            userIdByName.set(username, fetchedId);
            userId = fetchedId;
          }
        }

        if (!userId) continue;

        if (!balanceByUserId.has(userId)) {
          const { form } = await fetchProfileForm(userId);
          const inp = form.querySelector(
            `input[name="${CSS.escape(MONEY_FIELD_NAME)}"]`,
          );
          if (!inp) continue;

          const current = parseFloat(String(inp.value).replace(',', '.')) || 0;
          balanceByUserId.set(userId, current);
        }

        const bal = balanceByUserId.get(userId);
        if (typeof bal === 'number') {
          item.user_balance = bal;
        }
      } catch (e) {
        console.error('Не удалось получить баланс для заявки', item.id, e);
      }
    }
  };

  const applyBalanceForRequest = async (item) => {
    let userId = item.user_id || item.userId || null;

    if (!userId && item.user_login) {
      userId = await getUserIdByUsername(item.user_login);
    }
    if (!userId) {
      throw new Error('Не удалось определить ID пользователя для этой заявки.');
    }

    const delta =
      Number(item.delta) ||
      (Number(item.total_earn) || 0) - (Number(item.total_spend) || 0);

    if (!delta) {
      return { before: null, after: null, delta: 0 };
    }

    const { form, actionUrl } = await fetchProfileForm(userId);
    const inp = form.querySelector(
      `input[name="${CSS.escape(MONEY_FIELD_NAME)}"]`,
    );
    if (!inp) {
      throw new Error(
        `Поле баланса "${MONEY_FIELD_NAME}" не найдено в форме профиля.`,
      );
    }

    const current = parseFloat(String(inp.value).replace(',', '.')) || 0;
    const next = roundVal(current + delta, DECIMALS);

    const params = buildProfileParams(form, MONEY_FIELD_NAME, next);
    await postForm(actionUrl, params, actionUrl);

    return { before: current, after: next, delta };
  };

  const applyFiltersAndRender = () => {
    let items = lastItems;
    const query = ((searchInput && searchInput.value) || '')
      .trim()
      .toLowerCase();
    if (query) {
      items = items.filter((item) =>
        (item.user_login || '').toLowerCase().includes(query),
      );
    }
    renderList(items);
    renderSummaryBlock(items);
  };

  const loadRequests = async () => {
    const listRoot = $(SELECTORS.list);
    if (!listRoot) return;

    const status = statusSelect ? statusSelect.value : 'pending';

    setMsg('Загружаем заявки…', 'info');
    try {
      const params = new URLSearchParams();
      params.set('action', 'list');
      if (status && status !== 'all') {
        params.set('status', status);
      }

      const resp = await withTimeout(
        fetch(`${API_URL}?${params.toString()}`),
        REQUEST_TIMEOUT_MS,
      );
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json();
      if (!json.ok) {
        throw new Error(json.error || 'UNKNOWN_ERROR');
      }

      lastItems = json.items || [];

      applyFiltersAndRender();
      setMsg(
        `Загружено заявок: ${lastItems.length}. Обновляем текущие балансы…`,
        'info',
      );

      await enrichUserBalances(lastItems);

      applyFiltersAndRender();
      setMsg(`Загружено заявок: ${lastItems.length}`, 'info');
    } catch (err) {
      console.error(err);
      setMsg('Ошибка загрузки заявок.', 'error');
    }
  };

  const markStatus = async (id, action) => {
    const resp = await withTimeout(
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'processed' ? 'markProcessed' : 'markRejected',
          id,
        }),
      }),
      REQUEST_TIMEOUT_MS,
    );
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const json = await resp.json();
    if (!json.ok) {
      throw new Error(json.error || 'UNKNOWN_ERROR');
    }
  };

  const updateStatus = async (id, action) => {
    if (busy) return;
    busy = true;

    try {
      const item = lastItems.find((it) => String(it.id) === String(id));
      if (!item) {
        setMsg('Заявка не найдена в текущем списке.', 'error');
        return;
      }

      if (action === 'balance') {
        if (item.balanceApplied) {
          setMsg(
            'Баланс по этой заявке уже был изменён в текущей сессии.',
            'info',
          );
          return;
        }

        const delta =
          Number(item.delta) ||
          (Number(item.total_earn) || 0) - (Number(item.total_spend) || 0);

        if (!delta) {
          setMsg(
            '&#916; по заявке равен 0, баланс пользователя не изменён.',
            'info',
          );
          return;
        }

        const userLabel =
          item.user_login ||
          (item.user_id != null
            ? `uid ${item.user_id}`
            : 'неизвестный пользователь');

        const confirmText = `Применить ${
          delta >= 0 ? '+' : ''
        }${delta} к балансу пользователя ${userLabel}?`;
        if (!window.confirm(confirmText)) {
          return;
        }

        setMsg('Обновляем баланс пользователя…', 'info');
        const result = await applyBalanceForRequest(item);
        if (result.before !== null && result.after !== null) {
          setMsg(
            `Баланс обновлён: было ${result.before}, стало ${result.after}.`,
            'info',
          );

          const uid = item.user_id || item.userId || null;
          const uname = (item.user_login || '').toLowerCase();

          lastItems.forEach((it) => {
            const sameUser =
              (uid && (it.user_id === uid || it.userId === uid)) ||
              (!uid &&
                uname &&
                String(it.user_login || '').toLowerCase() === uname);

            if (sameUser) {
              it.user_balance = result.after;
            }
          });

          item.balanceApplied = true;

          applyFiltersAndRender();
        } else {
          setMsg(
            '&#916; по заявке равен 0, баланс пользователя не изменён.',
            'info',
          );
        }
        return;
      }

      if (action === 'processed') {
        setMsg('Обновляем статус заявки…', 'info');
        await markStatus(id, action);
        await loadRequests();
        setMsg('Статус заявки обновлён.', 'info');
        return;
      }

      if (action === 'rejected') {
        if (!window.confirm(`Отклонить заявку #${id} без изменения баланса?`)) {
          return;
        }
        setMsg('Обновляем статус заявки…', 'info');
        await markStatus(id, action);
        await loadRequests();
        setMsg('Статус заявки обновлён (отклонено).', 'info');
        return;
      }
    } catch (err) {
      console.error(err);
      setMsg(`Ошибка при обработке заявки: ${err.message || err}`, 'error');
    } finally {
      busy = false;
    }
  };

  const init = () => {
    const reloadBtn = $(SELECTORS.reloadBtn);
    const listRoot = $(SELECTORS.list);
    statusSelect = $(SELECTORS.statusFilter);
    searchInput = $(SELECTORS.searchInput);

    if (!reloadBtn || !listRoot) return;

    reloadBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      loadRequests();
    });

    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        loadRequests();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        applyFiltersAndRender();
      });
    }

    listRoot.addEventListener('click', (evt) => {
      const t = evt.target;
      if (!t || !t.dataset) return;

      const act = t.dataset.action;
      if (act === 'processed' || act === 'rejected' || act === 'balance') {
        const id = Number(t.dataset.id || '0');
        if (!id) return;
        updateStatus(id, act);
      }
    });

    loadRequests();
  };

  const start = () => {
    try {
      init();
    } catch (err) {
      console.error('[adminBank] init error:', err);
    }
  };

  if (typeof runOnceOnReady === 'function') {
    runOnceOnReady(start);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();


