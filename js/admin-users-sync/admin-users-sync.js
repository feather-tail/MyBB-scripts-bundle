(() => {
  'use strict';

  const h = window.helpers;
  if (!h) return;

  const { $, createEl, request, showToast } = h;

  const panel = document.getElementById('ks-panel-7');
  if (!panel) return;

  const elWarn = $('#ks-usersync-warning', panel);
  const elErr = $('#ks-usersync-error', panel);
  const elLoad = $('#ks-usersync-loading', panel);
  const elProg = $('#ks-usersync-progress', panel);
  const elRes = $('#ks-usersync-result', panel);

  const inpGroups = $('#ks-usersync-groups', panel);
  const inpLimit = $('#ks-usersync-limit', panel);
  const chkDry = $('#ks-usersync-dryrun', panel);
  const chkOnlyNew = $('#ks-usersync-onlynew', panel);

  const btnRun = $('#ks-usersync-run', panel);
  const btnStop = $('#ks-usersync-stop', panel);

  const cfg = h.getConfig('adminUsersSync', {
    apiBase: '',
    timeoutMs: 30000,
    maxSkip: 500,
  });

  const show = (node, on = true) => {
    if (!node) return;
    node.style.display = on ? '' : 'none';
  };
  const setText = (node, text) => {
    if (!node) return;
    node.textContent = text || '';
  };
  const setHTML = (node, html) => {
    if (!node) return;
    node.innerHTML = '';
    if (!html) return;
    node.appendChild(createEl('div', { html }));
  };

  const uniqNums = (arr) =>
    Array.from(new Set(arr.filter((n) => Number.isFinite(n) && n > 0)));

  const parseGroupIds = (s) => {
    const raw = String(s || '').trim();
    if (!raw) return [];
    return uniqNums(
      raw
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
  };

  let running = false;
  let abortCtrl = null;

  const apiCall = async (payload) => {
    if (!cfg.apiBase) throw new Error('Не задан adminUsersSync.apiBase в config.js');

    const headers = { 'Content-Type': 'application/json' };
    if (window.KS_ADMIN_TOKEN) headers['X-KS-Admin-Token'] = String(window.KS_ADMIN_TOKEN);

    return request(cfg.apiBase, {
      method: 'POST',
      data: JSON.stringify(payload),
      headers,
      responseType: 'json',
      timeout: cfg.timeoutMs,
      signal: abortCtrl?.signal,
      retries: 0,
    });
  };

  const fmt = (n) => (Number.isFinite(n) ? String(n) : '0');

  const renderSummary = (totals) => {
    const lines = [
      `<div><strong>Итог</strong></div>`,
      `<div>Обработано (получено из API): <strong>${fmt(totals.fetched)}</strong></div>`,
      `<div>Добавлено: <strong>${fmt(totals.inserted)}</strong></div>`,
      `<div>Обновлено: <strong>${fmt(totals.updated)}</strong></div>`,
      `<div>Пропущено/без изменений: <strong>${fmt(totals.unchanged)}</strong></div>`,
      totals.dryRun ? `<div><em>Режим: тестовый (без записи в БД)</em></div>` : '',
      totals.onlyNew ? `<div><em>Режим: только новые</em></div>` : '',
    ].filter(Boolean);
    setHTML(elRes, lines.join(''));
  };

  const setRunningUI = (on) => {
    running = on;
    if (btnRun) btnRun.disabled = on;
    show(btnStop, on);
    show(elLoad, on);
  };

  const stop = () => {
    if (!running) return;
    try {
      abortCtrl?.abort();
    } catch {}
    setRunningUI(false);
    setText(elProg, 'Остановлено.');
    showToast?.('Остановлено', 'warn');
  };

  btnStop?.addEventListener('click', stop);

  btnRun?.addEventListener('click', async () => {
    if (running) return;

    show(elWarn, false);
    show(elErr, false);
    setText(elWarn, '');
    setText(elErr, '');
    setText(elProg, '');
    if (elRes) elRes.innerHTML = '';

    abortCtrl = new AbortController();
    setRunningUI(true);

    const limit = Math.max(1, Math.min(50, parseInt(inpLimit?.value || '50', 10) || 50));
    const groups = parseGroupIds(inpGroups?.value);
    const unfiltered = groups.length === 0;

    const dryRun = !!chkDry?.checked;
    const onlyNew = !!chkOnlyNew?.checked;

    const totals = {
      fetched: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      dryRun,
      onlyNew,
    };

    try {
      const groupList = unfiltered ? [null] : groups;

      for (let gi = 0; gi < groupList.length; gi++) {
        const groupId = groupList[gi];
        let skip = 0;

        while (true) {
          if (skip > cfg.maxSkip) {
            show(elWarn, true);
            setText(
              elWarn,
              'Достигнут предел skip>500. Используй режим по группам (введи группы через запятую).',
            );
            break;
          }

          setText(
            elProg,
            `Группа: ${groupId == null ? 'без фильтра' : groupId} • skip=${skip} • limit=${limit}...`,
          );

          const resp = await apiCall({ groupId, skip, limit, dryRun, onlyNew });

          if (!resp || resp.ok !== true) {
            const msg = (resp && (resp.error || resp.message)) || 'Неизвестная ошибка';
            throw new Error(msg);
          }

          totals.fetched += resp.fetched || 0;
          totals.inserted += resp.db?.inserted || 0;
          totals.updated += resp.db?.updated || 0;
          totals.unchanged += resp.db?.unchanged || 0;

          setText(
            elProg,
            `Группа: ${groupId == null ? 'без фильтра' : groupId} • ` +
              `получено: ${resp.fetched || 0} • ` +
              `+${resp.db?.inserted || 0} / ~${resp.db?.updated || 0} / =${resp.db?.unchanged || 0}`,
          );

          if (!resp.hasMore || resp.nextSkip == null) break;
          skip = resp.nextSkip;
        }
      }

      renderSummary(totals);
      showToast?.('Синхронизация завершена', 'success');
    } catch (e) {
      show(elErr, true);
      setText(elErr, e?.message || String(e));
      showToast?.('Ошибка синхронизации', 'error');
    } finally {
      setRunningUI(false);
      abortCtrl = null;
    }
  });

  h.register?.('adminUsersSync', { stop });
})();
