(() => {
  'use strict';

  const CFG = {
    panelSelector: '#ks-panel-5',
    endpoint: 'https://feathertail.ru/ks/rewards/ks-reward-multipliers.php',
    scope: 'gamepost',

    get adminToken() {
      return (window.KS_ADMIN_TOKEN || '').trim();
    },

    enableNicknameResolve: true,
  };

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style') n.style.cssText = String(v);
      else if (k.startsWith('on') && typeof v === 'function')
        n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, String(v));
    }
    for (const c of children) n.append(c);
    return n;
  }

  function fmtTs(ts) {
    try {
      return new Date((Number(ts) || 0) * 1000).toLocaleString();
    } catch {
      return String(ts);
    }
  }

  function parseDurationToSec(s) {
    const v = String(s || '')
      .trim()
      .toLowerCase();
    if (!v) return 0;

    const dict = {
      week: 7 * 24 * 3600,
      w: 7 * 24 * 3600,
      day: 24 * 3600,
      d: 24 * 3600,
      hour: 3600,
      h: 3600,
      min: 60,
      m: 60,
      minute: 60,
    };
    if (dict[v]) return dict[v];

    const m = v.match(/^(\d+)\s*(d|day|h|hour|m|min|minute|w|week)$/);
    if (!m) return 0;
    const n = Number(m[1]) || 0;
    const unit = m[2];
    const base = dict[unit] || dict[unit[0]] || 0;
    return n > 0 ? n * base : 0;
  }

  function parseLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return null;

    let note = '';
    let main = raw;
    const semIdx = raw.indexOf(';');
    if (semIdx !== -1) {
      main = raw.slice(0, semIdx).trim();
      note = raw.slice(semIdx + 1).trim();
    }

    const parts = main
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length < 3) {
      throw new Error(
        'Формат: "Ник, множитель, длительность" (пример: Kayden Moore, 2, week)',
      );
    }

    const who = parts[0];
    const factor = Number(parts[1]);
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error('Множитель должен быть числом > 0');
    }

    const dur = parts.slice(2).join(',').trim();
    const durationSec = parseDurationToSec(dur);
    if (!durationSec) {
      throw new Error(
        'Не понял длительность. Примеры: week / day / hour / 7d / 12h / 30m',
      );
    }

    let user_id = 0;
    let nickname = '';

    if (/^#\d+$/.test(who)) {
      user_id = Number(who.slice(1)) || 0;
      if (!user_id) throw new Error('Некорректный user_id');
    } else {
      nickname = who;
    }

    return { user_id, nickname, factor, duration_sec: durationSec, note };
  }

  async function apiGet(method, params = {}) {
    const url = new URL(CFG.endpoint, location.origin);
    url.searchParams.set('method', method);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      headers: {
        'X-KS-Admin-Token': CFG.adminToken,
      },
      credentials: 'same-origin',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      const msg = data && data.error ? data.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async function apiPost(method, body = {}) {
    const url = new URL(CFG.endpoint, location.origin);
    url.searchParams.set('method', method);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KS-Admin-Token': CFG.adminToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      const msg = data && data.error ? data.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function renderTable(tbody, items) {
    tbody.innerHTML = '';
    if (!items.length) {
      tbody.append(
        el('tr', {}, [
          el('td', { colspan: '7', style: 'padding:10px; opacity:.75;' }, [
            document.createTextNode('Пока нет записей.'),
          ]),
        ]),
      );
      return;
    }

    for (const it of items) {
      const tr = el('tr', {}, [
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(String(it.id))],
        ),
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(String(it.user_id))],
        ),
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(String(it.factor))],
        ),
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(fmtTs(it.start_ts))],
        ),
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(fmtTs(it.end_ts))],
        ),
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [document.createTextNode(String(it.note || ''))],
        ),
      ]);

      const delBtn = el(
        'button',
        {
          type: 'button',
          style: 'padding:4px 10px; cursor:pointer;',
          onclick: async () => {
            if (!confirm(`Удалить множитель #${it.id}?`)) return;
            try {
              await apiPost('delete', { id: Number(it.id) });
              await refresh();
            } catch (e) {
              alert(`Ошибка удаления: ${e.message || e}`);
            }
          },
        },
        [document.createTextNode('Удалить')],
      );

      tr.append(
        el(
          'td',
          { style: 'padding:6px; border-bottom:1px solid var(--bord, #333);' },
          [delBtn],
        ),
      );
      tbody.append(tr);
    }
  }

  let ui = null;

  async function refresh() {
    const data = await apiGet('list', { scope: CFG.scope, active: 0 });
    const items = Array.isArray(data.items) ? data.items : [];
    items.sort((a, b) => (Number(b.end_ts) || 0) - (Number(a.end_ts) || 0));
    renderTable(ui.tbody, items);
  }

  async function onAdd() {
    const line = ui.input.value.trim();
    if (!line) return;

    let parsed;
    try {
      parsed = parseLine(line);
    } catch (e) {
      alert(e.message || String(e));
      return;
    }

    try {
      if (!CFG.adminToken) {
        alert('Нет admin token: вставь window.KS_ADMIN_TOKEN в HTML админки.');
        return;
      }

      let user_id = parsed.user_id;
      if (!user_id) {
        if (!CFG.enableNicknameResolve) {
          alert('resolveUser выключен. Тогда укажи user_id так: #123, 2, week');
          return;
        }
        const r = await apiGet('resolveUser', { nickname: parsed.nickname });
        user_id = Number(r.user_id) || 0;
        if (!user_id) throw new Error('Не удалось получить user_id');
      }

      const start_ts = Math.floor(Date.now() / 1000);

      await apiPost('add', {
        user_id,
        scope: CFG.scope,
        factor: parsed.factor,
        start_ts,
        duration_sec: parsed.duration_sec,
        note: parsed.note || '',
      });

      ui.input.value = '';
      await refresh();
    } catch (e) {
      alert(`Ошибка добавления: ${e.message || e}`);
    }
  }

  function mount() {
    const panel = document.querySelector(CFG.panelSelector);
    if (!panel) return;

    const box = el(
      'section',
      {
        style:
          'margin-top:16px; padding:12px; border:1px solid var(--bord, #333); border-radius:8px;',
      },
      [
        el('h4', { style: 'margin:0 0 8px 0;' }, [
          document.createTextNode('Персональные множители наград за посты'),
        ]),
        el(
          'div',
          {
            style:
              'display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;',
          },
          [
            el('input', {
              type: 'text',
              placeholder: 'Kayden Moore, 2, week; комментарий',
              style: 'flex:1 1 420px; min-width:280px; padding:8px;',
            }),
            el(
              'button',
              { type: 'button', style: 'padding:8px 14px; cursor:pointer;' },
              [document.createTextNode('Добавить')],
            ),
          ],
        ),
        el('div', { style: 'margin-top:6px; font-size:12px; opacity:.8;' }, [
          document.createTextNode(
            'Длительность: week/day/hour или 7d/12h/30m. Можно указать user_id: #123, 2, week',
          ),
        ]),
        el('div', { style: 'overflow:auto; margin-top:12px;' }, [
          el('table', { style: 'width:100%; border-collapse:collapse;' }, [
            el('thead', {}, [
              el('tr', {}, [
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['ID'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['User ID'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['Factor'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['Start'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['End'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  ['Note'],
                ),
                el(
                  'th',
                  {
                    style:
                      'text-align:left; padding:6px; border-bottom:1px solid var(--bord, #333);',
                  },
                  [''],
                ),
              ]),
            ]),
            el('tbody', {}),
          ]),
        ]),
      ],
    );

    panel.append(box);

    const input = box.querySelector('input[type="text"]');
    const btn = box.querySelector('button[type="button"]');
    const tbody = box.querySelector('tbody');

    ui = { input, btn, tbody };

    btn.addEventListener('click', onAdd);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAdd();
    });

    refresh().catch((err) =>
      alert(`Ошибка загрузки списка множителей: ${err.message || err}`),
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

