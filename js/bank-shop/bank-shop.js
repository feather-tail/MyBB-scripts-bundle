(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, $$, runOnceOnReady, getConfig } = helpers;

  const CONFIG_NAME = 'bankShop';

  const DEFAULT_CONFIG = {
    forumBaseUrl: 'https://kindredspirits.ru/',
    storageKeyPrefix: 'ks-bank-cart-',
    endpoints: {
      configUrl: 'https://feathertail.ru/ks/bank/bank.php',
      apiUrl: 'https://feathertail.ru/ks/bank/bank-api.php',
    },
    selectors: {
      root: '#ks-bank-root',
      messages: '#ks-bank-messages',
      myRequestsMessages: '#ks-bank-requests-messages',
      spendList: '#ks-bank-spend-list',
      earnList: '#ks-bank-earn-list',
      cartSpend: '#ks-bank-cart-spend',
      cartEarn: '#ks-bank-cart-earn',
      balanceBox: '#ks-bank-balance',
      summaryBox: '#ks-bank-summary',
      generateBtn: '#ks-bank-generate',
      requestsRoot: '#ks-bank-requests',
      requestsList: '#ks-bank-requests-list',
      requestsToggle: '#ks-bank-requests-toggle',
      requestsToggleIcon: '#ks-bank-requests-toggle-icon',
    },
    restorePrompt:
      'Обнаружена незавершённая заявка банка. Восстановить корзину?',
  };

  const SETTINGS = getConfig(CONFIG_NAME, DEFAULT_CONFIG);
  const SELECTORS = SETTINGS.selectors || DEFAULT_CONFIG.selectors;

  const userInfo = helpers.getUserInfo
    ? helpers.getUserInfo()
    : { id: 0, name: (window.UserLogin || '').trim(), group: 0 };

  const MULT_SIGN = '\u00D7';
  const DELTA_SIGN = '\u0394';
  const STATUS_LABELS = {
    pending: 'В обработке',
    approved: 'Завершена',
    rejected: 'Отклонена',
    canceled: 'Отменена',
  };

  const FORUM_BASE_URL =
    (SETTINGS.forumBaseUrl || DEFAULT_CONFIG.forumBaseUrl || '').replace(
      /\/+$/,
      '',
    ) || location.origin;

  const STORAGE_KEY =
    (SETTINGS.storageKeyPrefix || DEFAULT_CONFIG.storageKeyPrefix) +
    (userInfo.name || 'guest');

  const BANK_CONFIG_URL =
    (SETTINGS.endpoints && SETTINGS.endpoints.configUrl) ||
    DEFAULT_CONFIG.endpoints.configUrl;

  const BANK_API_URL =
    (SETTINGS.endpoints && SETTINGS.endpoints.apiUrl) ||
    DEFAULT_CONFIG.endpoints.apiUrl;

  const state = {
    currencyName: 'валюта',
    currentBalance: 0,
    catalog: {
      spend: {},
      earn: {},
    },
    groups: {
      spend: [],
      earn: [],
    },
    cart: {
      spend: {},
      earn: [],
    },
    nextEarnRowId: 1,
    editingRequestId: null,
  };

  const clearNode = (node) => {
    if (!node) return;
    while (node.firstChild) node.firstChild.remove();
  };

  const setMessage = (text, type) => {
    const box = $(SELECTORS.messages);
    if (!box) return;

    box.textContent = text || '';
    box.classList.remove('ks-bank__messages--error', 'ks-bank__messages--info');

    if (!text) return;
    if (type === 'error') box.classList.add('ks-bank__messages--error');
    if (type === 'info') box.classList.add('ks-bank__messages--info');
  };

  const linkifyText = (text) => {
    const frag = document.createDocumentFragment();
    const str = String(text || '');
    if (!str) return frag;

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(str)) !== null) {
      const index = match.index;
      const url = match[0];

      if (index > lastIndex) {
        frag.appendChild(
          document.createTextNode(str.slice(lastIndex, index)),
        );
      }

      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      frag.appendChild(a);

      lastIndex = urlRegex.lastIndex;
    }

    if (lastIndex < str.length) {
      frag.appendChild(document.createTextNode(str.slice(lastIndex)));
    }

    return frag;
  };

  const setMyRequestsMessage = (text, type) => {
    const box = $(SELECTORS.myRequestsMessages);
    if (!box) return;

    box.textContent = text || '';
    box.classList.remove(
      'ks-bank__requests-messages--error',
      'ks-bank__requests-messages--info',
    );

    if (!text) return;
    if (type === 'error') {
      box.classList.add('ks-bank__requests-messages--error');
    } else if (type === 'info') {
      box.classList.add('ks-bank__requests-messages--info');
    }
  };

  const sumSpend = () => {
    let total = 0;
    Object.keys(state.cart.spend).forEach((id) => {
      const row = state.cart.spend[id];
      total += row.cost * row.qty;
    });
    return total;
  };

  const sumEarn = () => {
    let total = 0;
    state.cart.earn.forEach((row) => {
      total += row.amount || 0;
    });
    return total;
  };

  const saveCartToStorage = () => {
    try {
      const dataToSave = {
        cart: {
          spend: state.cart.spend,
          earn: state.cart.earn,
        },
        nextEarnRowId: state.nextEarnRowId,
        editingRequestId: state.editingRequestId,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {}
  };

  const loadCartStateFromStorage = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const clearCartStorage = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  const normalizeUrl = (url) => {
    let val = (url || '').trim();
    if (!val) return '';

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(val)) {
      return val;
    }

    const base = FORUM_BASE_URL.replace(/\/+$/, '');
    if (val.startsWith('/')) {
      return base + val;
    }

    if (/^(viewtopic|viewforum)\.php/i.test(val)) {
      return base + '/' + val;
    }

    return base + '/' + val;
  };

  const isProbablyValidUrl = (url) => {
    const val = (url || '').trim();
    if (!val) return false;
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const loadBankConfig = async () => {
    const resp = await fetch(BANK_CONFIG_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  };

  const normalizeSection = (rawItems, kind) => {
    state.catalog[kind] = {};
    state.groups[kind] = [];
    if (!Array.isArray(rawItems)) return;

    const ensureItem = (item) => {
      if (!item || !item.id) return null;
      const result = {
        id: item.id,
        label: item.label || item.id,
        tooltip: item.tooltip || '',
        maxPerOrder:
          typeof item.maxPerOrder === 'number' ? item.maxPerOrder : null,
      };
      if (kind === 'spend') {
        result.cost = Number(item.cost) || 0;
      } else {
        result.amount = Number(item.amount) || 0;
      }
      state.catalog[kind][item.id] = result;
      return item.id;
    };

    rawItems.forEach((entry) => {
      if (!entry) return;

      if (Array.isArray(entry.items)) {
        const itemIds = [];
        entry.items.forEach((child) => {
          const id = ensureItem(child);
          if (id) itemIds.push(id);
        });

        const label = entry.groupLabel || entry.label || '';
        if (label && itemIds.length) {
          state.groups[kind].push({
            type: 'group',
            label,
            itemIds,
          });
        } else {
          itemIds.forEach((id) => {
            state.groups[kind].push({
              type: 'item',
              itemId: id,
            });
          });
        }
      } else if (entry.id) {
        const id = ensureItem(entry);
        if (id) {
          state.groups[kind].push({
            type: 'item',
            itemId: id,
          });
        }
      }
    });
  };

  const normalizeConfig = (raw) => {
    const data = Array.isArray(raw) ? raw[0] : raw;

    const spendRaw = Array.isArray(data.spend)
      ? data.spend
      : Array.isArray(data.spendItems)
      ? data.spendItems
      : [];

    const earnRaw = Array.isArray(data.earn)
      ? data.earn
      : Array.isArray(data.earnItems)
      ? data.earnItems
      : [];

    state.currencyName = data.currencyName || 'валюта';

    normalizeSection(spendRaw, 'spend');
    normalizeSection(earnRaw, 'earn');
  };

  const createCatalogCard = (kind, id) => {
    const collection = state.catalog[kind];
    const item = collection[id];
    if (!item) return null;

    const card = document.createElement('div');
    card.className = 'ks-bank-item';
    card.dataset.type = kind;
    card.dataset.id = item.id;

    const info = document.createElement('div');
    info.className = 'ks-bank-item__info';

    const label = document.createElement('div');
    label.className = 'ks-bank-item__label';
    label.textContent = item.label;
    info.appendChild(label);

    if (item.tooltip) {
      const tip = document.createElement('div');
      tip.className = 'ks-bank-item__tooltip';
      tip.textContent = item.tooltip;
      info.appendChild(tip);
    }

    if (item.maxPerOrder) {
      const meta = document.createElement('div');
      meta.className = 'ks-bank-item__meta';
      meta.textContent =
        kind === 'spend'
          ? 'Лимит: до ' + item.maxPerOrder + ' шт. за заявку'
          : 'Лимит: до ' + item.maxPerOrder + ' строк за заявку';
      info.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'ks-bank-item__actions';

    if (kind === 'spend') {
      const existing = state.cart.spend[id];
      const currentQty = existing ? existing.qty : 0;
      const limit = item.maxPerOrder;
      const limitReached = limit && currentQty >= limit;

      const price = document.createElement('div');
      price.className = 'ks-bank-item__price';
      price.textContent = item.cost + ' ' + state.currencyName;

      const controls = document.createElement('div');
      controls.className = 'ks-bank-item__qty';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'ks-bank-item__qty-btn';
      minusBtn.dataset.id = item.id;
      minusBtn.title =
        currentQty > 0 ? 'Уменьшить количество на 1' : 'Нечего уменьшать';
      minusBtn.innerHTML =
        '<i class="fa-solid fa-minus" aria-hidden="true"></i>';
      minusBtn.setAttribute('aria-label', 'Уменьшить количество на 1');
      minusBtn.disabled = currentQty <= 0;

      const qtySpan = document.createElement('span');
      qtySpan.className = 'ks-bank-item__qty-value';
      qtySpan.textContent = String(currentQty);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'ks-bank-item__add-btn';
      plusBtn.textContent = '+';
      plusBtn.dataset.type = 'spend';
      plusBtn.dataset.id = item.id;
      plusBtn.title = limitReached
        ? 'Достигнут лимит по этому товару'
        : 'Добавить в корзину';
      if (limitReached) {
        plusBtn.disabled = true;
      }

      controls.append(minusBtn, qtySpan, plusBtn);
      actions.append(price, controls);
    } else {
      const limit = item.maxPerOrder;
      let currentCount = 0;
      if (limit) {
        currentCount = state.cart.earn.filter((row) => row.id === id).length;
      }
      const limitReached = limit && currentCount >= limit;

      const amount = document.createElement('div');
      amount.className = 'ks-bank-item__amount';
      amount.textContent = '+ ' + item.amount + ' ' + state.currencyName;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ks-bank-item__add-btn';
      btn.textContent = '+';
      btn.dataset.type = 'earn';
      btn.dataset.id = item.id;
      btn.title = limitReached
        ? 'Достигнут лимит по этому основанию'
        : 'Добавить строку начисления';
      if (limitReached) {
        btn.disabled = true;
      }

      actions.append(amount, btn);
    }

    card.append(info, actions);
    return card;
  };

  const renderSectionCatalog = (kind, root) => {
    clearNode(root);
    const groups = state.groups[kind];
    if (!groups || !groups.length) return;

    groups.forEach((entry) => {
      if (entry.type === 'group') {
        const groupWrap = document.createElement('div');
        groupWrap.className = 'ks-bank-group';

        const title = document.createElement('div');
        title.className = 'ks-bank-group__title';
        title.textContent = entry.label;
        groupWrap.appendChild(title);

        const list = document.createElement('div');
        list.className = 'ks-bank-group__items';

        entry.itemIds.forEach((itemId) => {
          const card = createCatalogCard(kind, itemId);
          if (card) list.appendChild(card);
        });

        groupWrap.appendChild(list);
        root.appendChild(groupWrap);
      } else if (entry.type === 'item') {
        const card = createCatalogCard(kind, entry.itemId);
        if (card) root.appendChild(card);
      }
    });
  };

  const renderCatalog = () => {
    const spendRoot = $(SELECTORS.spendList);
    const earnRoot = $(SELECTORS.earnList);
    if (!spendRoot || !earnRoot) return;

    renderSectionCatalog('spend', spendRoot);
    renderSectionCatalog('earn', earnRoot);
  };

  const renderCartSpend = () => {
    const root = $(SELECTORS.cartSpend);
    if (!root) return;
    clearNode(root);

    Object.keys(state.cart.spend).forEach((id) => {
      const rowData = state.cart.spend[id];
      if (!rowData || !rowData.qty) return;

      const sum = rowData.cost * rowData.qty;

      const row = document.createElement('div');
      row.className = 'ks-bank-cart-row';
      row.dataset.type = 'spend';
      row.dataset.id = rowData.id;

      const top = document.createElement('div');
      top.className = 'ks-bank-cart-row__top';

      const name = document.createElement('div');
      name.className = 'ks-bank-cart-row__name';
      name.textContent = rowData.label;

      const summary = document.createElement('div');
      summary.className = 'ks-bank-cart-row__summary';
      summary.textContent = `${MULT_SIGN} ${rowData.qty} = ${sum} ${state.currencyName}`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ks-bank-cart-row__remove-btn';
      removeBtn.dataset.type = 'spend';
      removeBtn.dataset.id = rowData.id;
      removeBtn.title = 'Удалить товар из корзины';
      removeBtn.innerHTML =
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      removeBtn.setAttribute('aria-label', 'Удалить');

      top.append(name, summary, removeBtn);
      row.append(top);

      const proofInput = document.createElement('input');
      proofInput.type = 'url';
      proofInput.className = 'ks-bank-cart-row__proof-input';
      proofInput.placeholder = 'Ссылка (пост, эпизод и т.д.)';
      proofInput.value = rowData.url || '';
      proofInput.dataset.id = rowData.id;

      const commentInput = document.createElement('input');
      commentInput.type = 'text';
      commentInput.className = 'ks-bank-cart-row__comment-input';
      commentInput.placeholder = 'Комментарий';
      commentInput.value = rowData.comment || '';
      commentInput.dataset.id = rowData.id;

      row.append(proofInput, commentInput);

      root.appendChild(row);
    });
  };

  const renderCartEarn = () => {
    const root = $(SELECTORS.cartEarn);
    if (!root) return;
    clearNode(root);

    state.cart.earn.forEach((row) => {
      const block = document.createElement('div');
      block.className = 'ks-bank-cart-row';
      block.dataset.type = 'earn';
      block.dataset.rowId = row.rowId;

      const top = document.createElement('div');
      top.className = 'ks-bank-cart-row__top';

      const name = document.createElement('div');
      name.className = 'ks-bank-cart-row__name';
      name.textContent = row.label;

      const summary = document.createElement('div');
      summary.className = 'ks-bank-cart-row__summary';
      summary.textContent = `+ ${row.amount} ${state.currencyName}`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ks-bank-cart-row__remove-btn';
      removeBtn.dataset.type = 'earn';
      removeBtn.dataset.rowId = row.rowId;
      removeBtn.title = 'Удалить';
      removeBtn.innerHTML =
        '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      removeBtn.setAttribute('aria-label', 'Удалить');

      const proofInput = document.createElement('input');
      proofInput.type = 'url';
      proofInput.className = 'ks-bank-cart-row__proof-input';
      proofInput.placeholder = 'Ссылка (пост, эпизод и т.д.)';
      proofInput.value = row.url || '';
      proofInput.dataset.rowId = row.rowId;
      
      const commentInput = document.createElement('input');
      commentInput.type = 'text';
      commentInput.className = 'ks-bank-cart-row__comment-input';
      commentInput.placeholder = 'Комментарий';
      commentInput.value = row.comment || '';
      commentInput.dataset.rowId = row.rowId;
      
      top.append(name, summary, removeBtn);
      block.append(top, proofInput, commentInput);
      root.appendChild(block);
    });
  };

  const renderSummary = () => {
    const balRoot = $(SELECTORS.balanceBox);
    const sumRoot = $(SELECTORS.summaryBox);
    if (balRoot) {
      clearNode(balRoot);
      const pCur = document.createElement('p');
      pCur.textContent = `Ваш текущий баланс: ${state.currentBalance} ${state.currencyName}`;
      const delta = sumEarn() - sumSpend();
      const after = state.currentBalance + delta;
      const pAfter = document.createElement('p');
      pAfter.textContent = `Баланс после обработки заявки: ${after} ${state.currencyName}`;
      balRoot.append(pCur, pAfter);
    }

    if (!sumRoot) return;

    const totalSpend = sumSpend();
    const totalEarn = sumEarn();
    const delta = totalEarn - totalSpend;

    clearNode(sumRoot);

    const p1 = document.createElement('p');
    p1.textContent = `Итого к списанию: ${totalSpend} ${state.currencyName}`;

    const p2 = document.createElement('p');
    p2.textContent = `Итого к начислению: ${totalEarn} ${state.currencyName}`;

    const p3 = document.createElement('p');
    p3.textContent = `Сальдо: ${(delta >= 0 ? '+' : '') + delta} ${
      state.currencyName
    }`;

    sumRoot.append(p1, p2, p3);

    sumRoot.classList.remove(
      'ks-bank__summary--positive',
      'ks-bank__summary--negative',
    );
    if (delta > 0) {
      sumRoot.classList.add('ks-bank__summary--positive');
    } else if (delta < 0) {
      sumRoot.classList.add('ks-bank__summary--negative');
    }
  };

  const updateSubmitButtonLabel = () => {
    const submitBtn = $(SELECTORS.generateBtn);
    if (!submitBtn) return;
    submitBtn.textContent = state.editingRequestId
      ? 'Обновить заявку'
      : 'Отправить заявку';
  };

  const updateCartUI = () => {
    renderCartSpend();
    renderCartEarn();
    renderSummary();
    renderCatalog();
    saveCartToStorage();
  };

  const handleAddSpend = (id) => {
    const item = state.catalog.spend[id];
    if (!item) return;

    const existing = state.cart.spend[id];
    const newQty = existing ? existing.qty + 1 : 1;
    const existingComment =
      existing && typeof existing.comment === 'string' ? existing.comment : '';
    const existingUrl =
      existing && typeof existing.url === 'string' ? existing.url : '';

    if (item.maxPerOrder && newQty > item.maxPerOrder) {
      setMessage(
        `Нельзя добавить больше ${item.maxPerOrder} шт. для "${item.label}" за один раз.`,
        'error',
      );
      return;
    }

    state.cart.spend[id] = {
      id: item.id,
      label: item.label,
      cost: item.cost,
      qty: newQty,
      comment: existingComment,
      url: existingUrl,
    };

    setMessage('', '');
    updateCartUI();
  };

  const handleAddEarn = (id) => {
    const item = state.catalog.earn[id];
    if (!item) return;

    if (item.maxPerOrder) {
      const count = state.cart.earn.filter((row) => row.id === id).length;
      if (count >= item.maxPerOrder) {
        setMessage(
          `Нельзя добавить больше ${item.maxPerOrder} строк для "${item.label}" за один раз.`,
          'error',
        );
        return;
      }
    }

    const rowObj = {
      rowId: `e${state.nextEarnRowId++}`,
      id: item.id,
      label: item.label,
      amount: item.amount,
      url: '',
      comment: '',
    };

    state.cart.earn.push(rowObj);
    setMessage('', '');
    updateCartUI();
  };

  const handleRemoveSpend = (id) => {
    if (state.cart.spend[id]) {
      delete state.cart.spend[id];
      updateCartUI();
    }
  };

  const handleDecreaseSpend = (id) => {
    const row = state.cart.spend[id];
    if (!row) return;

    const newQty = row.qty - 1;
    if (newQty <= 0) {
      delete state.cart.spend[id];
    } else {
      row.qty = newQty;
    }

    updateCartUI();
  };

  const handleRemoveEarn = (rowId) => {
    state.cart.earn = state.cart.earn.filter((row) => row.rowId !== rowId);
    updateCartUI();
  };

  const handleEarnComment = (rowId, value) => {
    state.cart.earn.forEach((row) => {
      if (row.rowId === rowId) {
        row.comment = value;
      }
    });
    saveCartToStorage();
  };

  const handleSpendProof = (id, value) => {
    const row = state.cart.spend[id];
    if (!row) return;
    row.url = value;
    saveCartToStorage();
  };

  const handleEarnProof = (rowId, value) => {
    state.cart.earn.forEach((row) => {
      if (row.rowId === rowId) {
        row.url = value;
      }
    });
    saveCartToStorage();
  };

  const initTabsLocal = (root) => {
    const buttons = $$('.ks-bank__tab-btn', root);

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!tab) return;

        buttons.forEach((b) => {
          b.classList.toggle('is-active', b.dataset.tab === tab);
        });

        const panels = $$('.ks-bank__tab-content', root);
        panels.forEach((panel) => {
          const panelTab = panel.dataset.tabPanel;
          panel.classList.toggle('is-active', panelTab === tab);
        });
      });
    });
  };

  const buildRequestData = () => {
    const spend = Object.values(state.cart.spend).map((row) => ({
      id: row.id,
      label: row.label,
      qty: row.qty,
      cost: row.cost,
      sum: row.cost * row.qty,
      url: (row.url || '').trim(),
      comment: row.comment || '',
    }));

    const earn = state.cart.earn.map((row) => ({
      id: row.id,
      label: row.label,
      amount: row.amount,
      url: (row.url || '').trim(),
      comment: row.comment || '',
    }));

    const totals = {
      spend: sumSpend(),
      earn: sumEarn(),
    };
    totals.delta = totals.earn - totals.spend;

    return {
      userLogin: userInfo.name || 'Unknown',
      userId: userInfo.id || null,
      spend,
      earn,
      totals,
    };
  };

  let myRequests = [];

  const renderMyRequests = (items) => {
    const root = $(SELECTORS.requestsList);
    if (!root) return;
    clearNode(root);

    if (!items.length) {
      const div = document.createElement('div');
      div.className = 'ks-bank-request__empty';
      div.textContent = 'У вас ещё нет заявок.';
      root.appendChild(div);
      return;
    }

    items.forEach((item) => {
      const wrap = document.createElement('article');
      wrap.className = 'ks-bank-request';
      wrap.dataset.id = String(item.id);

      const header = document.createElement('div');
      header.className = 'ks-bank-request__header';

      const left = document.createElement('div');
      left.className = 'ks-bank-request__meta';

      const idDiv = document.createElement('div');
      idDiv.className = 'ks-bank-request__id';
      idDiv.textContent = `#${item.id}`;

      const dateDiv = document.createElement('div');
      dateDiv.className = 'ks-bank-request__date';
      const d = item.created_at ? new Date(item.created_at * 1000) : null;
      dateDiv.textContent = 'Создано: ' + (d ? d.toLocaleString() : '-');

      const totalsDiv = document.createElement('div');
      totalsDiv.className = 'ks-bank-request__totals';
      const deltaSign = item.delta >= 0 ? '+' : '';
      totalsDiv.textContent = `Итоги: -${item.total_spend} / +${item.total_earn} (${DELTA_SIGN} ${deltaSign}${item.delta})`;

      left.append(idDiv, dateDiv, totalsDiv);

      const right = document.createElement('div');
      right.className = 'ks-bank-request__meta_second';

      const statusSpan = document.createElement('span');
      statusSpan.className = 'ks-bank-request__status';
      const status = item.status || 'pending';
      const statusLabel = STATUS_LABELS[status] || status;
      statusSpan.classList.add(`ks-bank-request__status--${status}`);
      statusSpan.textContent = statusLabel;

      right.appendChild(statusSpan);

      const balanceDiv = document.createElement('div');
      balanceDiv.className = 'ks-bank-request__date';
      const current = state.currentBalance;
      const after = current + (Number(item.delta) || 0);
      balanceDiv.innerHTML = `Баланс: ${current}. Будет ${after}`;
      right.appendChild(balanceDiv);

      header.append(left, right);
      wrap.appendChild(header);

      const details = document.createElement('div');
      details.className = 'ks-bank-request__details';

      const payload = item.payload || {};
      const spendRows = Array.isArray(payload.spend) ? payload.spend : [];
      const earnRows = Array.isArray(payload.earn) ? payload.earn : [];

      const spendBlock = document.createElement('div');
      spendBlock.className = 'ks-bank-request__subsection';
      const sTitle = document.createElement('h4');
      sTitle.textContent = 'Покупки';
      spendBlock.appendChild(sTitle);

      const sList = document.createElement('ul');
      if (spendRows.length) {
        spendRows.forEach((row) => {
          const li = document.createElement('li');
          li.textContent = `${row.label} — ${row.qty} шт. ${MULT_SIGN} ${row.cost} = ${row.sum}`;

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
            span.className = 'ks-bank-request__comment';
            span.append(document.createTextNode('Комментарий: '));
            span.append(linkifyText(row.comment));

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
      earnBlock.className = 'ks-bank-request__subsection';
      const eTitle = document.createElement('h4');
      eTitle.textContent = 'Начисления';
      earnBlock.appendChild(eTitle);
      
      const eList = document.createElement('ul');
      if (earnRows.length) {
        earnRows.forEach((row) => {
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
            span.className = 'ks-bank-request__comment';
            span.append(document.createTextNode('Комментарий: '));
            span.append(linkifyText(row.comment));
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
      wrap.appendChild(details);

      if (status === 'pending') {
        const actions = document.createElement('div');
        actions.className = 'ks-bank-request__actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'ks-bank-request__edit';
        editBtn.textContent = 'Редактировать';
        editBtn.dataset.action = 'edit';
        editBtn.dataset.id = String(item.id);

        actions.appendChild(editBtn);
        wrap.appendChild(actions);
      }

      root.appendChild(wrap);
    });
  };

  const loadMyRequests = async () => {
    const root = $(SELECTORS.requestsList);
    if (!root) return;

    const login = userInfo.name || '';
    if (!login) {
      setMyRequestsMessage(
        'Невозможно загрузить заявки: неизвестен логин пользователя.',
        'error',
      );
      return;
    }

    setMyRequestsMessage('Загружаем ваши заявки…', 'info');

    try {
      const params = new URLSearchParams({
        action: 'listMy',
        userLogin: login,
      });

      const resp = await fetch(`${BANK_API_URL}?${params.toString()}`, {
        method: 'GET',
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'UNKNOWN_ERROR');

      const allItems = json.items || [];
      myRequests = allItems.filter((item) => item.status === 'pending');

      renderMyRequests(myRequests);
      setMyRequestsMessage(`Активных заявок: ${myRequests.length}`, 'info');
    } catch (err) {
      console.error(err);
      setMyRequestsMessage(
        'Не удалось загрузить ваши заявки. Попробуйте ещё раз позже.',
        'error',
      );
    }
  };

  const beginEditRequest = (id) => {
    const numericId = Number(id);
    if (!numericId) return;
    const item = myRequests.find((r) => r.id === numericId);
    if (!item || item.status !== 'pending') return;

    const payload = item.payload || {};
    const spendRows = Array.isArray(payload.spend) ? payload.spend : [];
    const earnRows = Array.isArray(payload.earn) ? payload.earn : [];

    state.cart.spend = {};
    spendRows.forEach((row) => {
      if (!row.id) return;
      state.cart.spend[row.id] = {
        id: row.id,
        label: row.label || row.id,
        cost: Number(row.cost) || 0,
        qty: Number(row.qty) || 0,
        url: row.url || '',
        comment: row.comment || '',
      };
    });

    state.cart.earn = [];
    state.nextEarnRowId = 1;
    earnRows.forEach((row) => {
      state.cart.earn.push({
        rowId: `e${state.nextEarnRowId++}`,
        id: row.id,
        label: row.label || row.id,
        amount: Number(row.amount) || 0,
        url: row.url || '',
        comment: row.comment || '',
      });
    });

    state.editingRequestId = numericId;
    setMessage(
      `Редактирование заявки №${numericId}. После отправки она будет обновлена.`,
      'info',
    );
    updateSubmitButtonLabel();
    updateCartUI();
  };

  const submitRequest = async () => {
    setMessage('', '');

    const inputs = $$('.ks-bank-cart-row__proof-input');
    let hasInvalid = false;

    inputs.forEach((input) => {
      const id = input.dataset.id;
      const rowId = input.dataset.rowId;
      let val = (input.value || '').trim();

      if (!val) {
        input.classList.remove('ks-bank-cart-row__input--error');
        if (id) {
          handleSpendProof(id, '');
        }
        if (rowId) {
          handleEarnProof(rowId, '');
        }
        return;
      }

      const normalized = normalizeUrl(val);
      input.value = normalized;

      if (!isProbablyValidUrl(normalized)) {
        hasInvalid = true;
        input.classList.add('ks-bank-cart-row__input--error');
      } else {
        input.classList.remove('ks-bank-cart-row__input--error');
      }

      if (id) {
        handleSpendProof(id, normalized);
      }
      if (rowId) {
        handleEarnProof(rowId, normalized);
      }
    });

    if (hasInvalid) {
      setMessage(
        'Некоторые ссылки выглядят некорректно.',
        'error',
      );
      return;
    }

    const data = buildRequestData();

    if (!data.spend.length && !data.earn.length) {
      setMessage('Корзина пуста. Добавьте покупки или начисления.', 'error');
      return;
    }

    const totalSpend = data.totals.spend || 0;
    const totalEarn = data.totals.earn || 0;
    const delta = totalEarn - totalSpend;
    const afterBalance = state.currentBalance + delta;

    if (afterBalance < 0) {
      setMessage(
        `Нельзя отправить заявку: баланс не может стать отрицательным. Текущий баланс: ${
          state.currentBalance
        } ${state.currencyName}, изменение по заявке: ${
          (delta >= 0 ? '+' : '') + delta
        } ${state.currencyName}.`,
        'error',
      );
      return;
    }

    const action = state.editingRequestId ? 'update' : 'create';

    const submitBtn = $(SELECTORS.generateBtn);
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = state.editingRequestId
        ? 'Обновляем заявку...'
        : 'Отправляем заявку...';
    }

    try {
      const body = state.editingRequestId
        ? { action, id: state.editingRequestId, data }
        : { action, data };

      const resp = await fetch(BANK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'UNKNOWN_ERROR');

      const id = json.id;
      if (state.editingRequestId) {
        setMessage(
          `Заявка №${id} обновлена. Ожидайте обработки мастером.`,
          'info',
        );
      } else {
        setMessage(
          `Заявка №${id} отправлена. Ожидайте обработки мастером.`,
          'info',
        );
      }

      state.cart.spend = {};
      state.cart.earn = [];
      state.editingRequestId = null;
      clearCartStorage();
      updateSubmitButtonLabel();
      updateCartUI();

      loadMyRequests();
    } catch (err) {
      console.error(err);
      setMessage(
        'Не удалось отправить заявку.',
        'error',
      );
    } finally {
      const btn = $(SELECTORS.generateBtn);
      if (btn) {
        btn.disabled = false;
        updateSubmitButtonLabel();
      }
    }
  };

  const setRequestsCollapsed = (collapsed) => {
    const section = $(SELECTORS.requestsRoot);
    const toggle = $(SELECTORS.requestsToggle);
    const icon = $(SELECTORS.requestsToggleIcon);

    if (!section) return;

    section.classList.toggle('ks-bank__requests--collapsed', collapsed);

    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
    }

    if (icon) {
      icon.classList.toggle('fa-chevron-right', collapsed);
      icon.classList.toggle('fa-chevron-down', !collapsed);
    }
  };

  const init = async () => {
    const root = $(SELECTORS.root);
    if (!root) return;

    initTabsLocal(root);

    const rawBalance = window.UserFld4;
    const parsed =
      typeof rawBalance === 'string'
        ? parseInt(rawBalance, 10)
        : Number(rawBalance);
    state.currentBalance = Number.isFinite(parsed) ? parsed : 0;

    const saved = loadCartStateFromStorage();
    if (saved && saved.cart) {
      const hasCart =
        (saved.cart.spend && Object.keys(saved.cart.spend).length > 0) ||
        (Array.isArray(saved.cart.earn) && saved.cart.earn.length > 0);
      if (hasCart) {
        const msg = SETTINGS.restorePrompt || DEFAULT_CONFIG.restorePrompt;
        const confirmRestore = window.confirm(msg);
        if (confirmRestore) {
          state.cart.spend = saved.cart.spend || {};
          state.cart.earn = Array.isArray(saved.cart.earn)
            ? saved.cart.earn
            : [];
          state.nextEarnRowId =
            typeof saved.nextEarnRowId === 'number' ? saved.nextEarnRowId : 1;
          state.editingRequestId = saved.editingRequestId || null;
          updateSubmitButtonLabel();
        } else {
          clearCartStorage();
        }
      }
    }

    root.addEventListener('click', (evt) => {
      const t = evt.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.classList.contains('ks-bank-item__add-btn')) {
        const type = t.dataset.type;
        const id = t.dataset.id;
        if (!id || !type) return;
        if (type === 'spend') handleAddSpend(id);
        if (type === 'earn') handleAddEarn(id);
      }

      if (t.classList.contains('ks-bank-item__qty-btn')) {
        const id = t.dataset.id;
        if (id) handleDecreaseSpend(id);
      }

      const btnRemove = t.closest('.ks-bank-cart-row__remove-btn');
      if (btnRemove) {
        const type = btnRemove.dataset.type;
        if (type === 'spend') {
          const id = btnRemove.dataset.id;
          if (id) handleRemoveSpend(id);
        } else if (type === 'earn') {
          const rowId = btnRemove.dataset.rowId;
          if (rowId) handleRemoveEarn(rowId);
        }
      }

      if (t.classList.contains('ks-bank-request__edit')) {
        const id = t.dataset.id;
        if (id) {
          beginEditRequest(id);
          window.scrollTo({ top: root.offsetTop, behavior: 'smooth' });
        }
      }

      if (t.id === 'ks-bank-requests-reload') {
        evt.preventDefault();
        loadMyRequests();
      }
    });

    root.addEventListener('input', (evt) => {
      const t = evt.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.classList.contains('ks-bank-cart-row__proof-input')) {
        const id = t.dataset.id;
        const rowId = t.dataset.rowId;

        if (id) {
          handleSpendProof(id, t.value);
        } else if (rowId) {
          handleEarnProof(rowId, t.value);
        }
      }

      if (t.classList.contains('ks-bank-cart-row__comment-input')) {
        const id = t.dataset.id;
        const rowId = t.dataset.rowId;

        if (id) {
          handleSpendComment(id, t.value);
        } else if (rowId) {
          handleEarnComment(rowId, t.value);
        }
      }
    });

    const submitBtn = $(SELECTORS.generateBtn);
    if (submitBtn) {
      updateSubmitButtonLabel();
      submitBtn.addEventListener('click', submitRequest);
    }

    const requestsToggle = $(SELECTORS.requestsToggle);
    if (requestsToggle) {
      setRequestsCollapsed(true);
      requestsToggle.addEventListener('click', (evt) => {
        evt.preventDefault();
        const section = $(SELECTORS.requestsRoot);
        const isCollapsed = section
          ? section.classList.contains('ks-bank__requests--collapsed')
          : true;
        setRequestsCollapsed(!isCollapsed);
      });
    }

    try {
      const cfg = await loadBankConfig();
      normalizeConfig(cfg);
      updateCartUI();
    } catch (err) {
      console.error(err);
      setMessage(
        'Не удалось загрузить список товаров. Попробуйте позже или сообщите администрации.',
        'error',
      );
    }

    loadMyRequests();
  };

  const start = () => {
    try {
      init();
    } catch (err) {
      console.error('[bankShop] init error:', err);
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









