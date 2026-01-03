(() => {
  'use strict';

  const C = window.KS_DROPS_CORE;
  if (!C) return;

  window.KS_DROPS = window.KS_DROPS || {};
  if (window.KS_DROPS.__admin_loaded) return;
  window.KS_DROPS.__admin_loaded = true;

  const init = async () => {
    await C.domReady();

    const H = await C.waitForHelpers(60000, 50);
    if (!H) return;

    const cfg = C.getCfg();
    const root = document.getElementById(
      cfg.admin?.mountId || 'ks-drops-admin-root',
    );
    if (!root) return;

    const isAdmin = () => {
      const uid = C.getUserId(H);
      const gid = C.getGroupId(H);
      return uid > 0 && gid === C.toInt(cfg.access?.adminGroup ?? 1);
    };

    if (!isAdmin()) {
      root.innerHTML =
        '<div class="ks-drops-admin__muted">Только для админов.</div>';
      return;
    }

    const api = (action, params) => C.apiUrl(cfg, action, params);
    const el = (tag, props) => C.el(H, tag, props);

    const renderList = (items) => {
      const wrap = el('div', { className: 'ks-drops-admin__list' });

      if (!items || !items.length) {
        wrap.appendChild(
          el('div', { className: 'ks-drops-admin__muted', text: 'Пусто' }),
        );
        return wrap;
      }

      for (const it of items) {
        const row = el('div', { className: 'ks-drops-admin__row' });
        const left = el('div', { className: 'ks-drops-admin__rowleft' });

        left.appendChild(
          el('img', {
            src: it.image_url || '',
            alt: it.title || '',
            className: 'ks-drops-admin__icon',
          }),
        );
        left.appendChild(
          el('div', {
            className: 'ks-drops-admin__title',
            text: it.title || 'Item #' + it.item_id,
          }),
        );

        row.append(
          left,
          el('div', {
            className: 'ks-drops-admin__qty',
            text: 'x' + (it.qty ?? 0),
          }),
        );
        wrap.appendChild(row);
      }

      return wrap;
    };

    const fetchAdminState = async (targetUserId) => {
      const resp = await H.request(
        api('admin_state', {
          user_id: C.getUserId(H),
          group_id: C.getGroupId(H),
          target_user_id: C.toInt(targetUserId || 0),
        }),
        {
          method: 'GET',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
        },
      );
      if (resp?.ok !== true)
        throw new Error(resp?.error?.message || 'admin_state error');
      return resp.data;
    };

    const postTransfer = async (payload) => {
      const resp = await H.request(api('admin_transfer', {}), {
        method: 'POST',
        timeout: cfg.polling?.requestTimeoutMs || 12000,
        responseType: 'json',
        retries: cfg.polling?.retries || 0,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          ...payload,
          user_id: C.getUserId(H),
          group_id: C.getGroupId(H),
        }),
      });
      if (resp?.ok !== true)
        throw new Error(resp?.error?.message || 'admin_transfer error');
      return resp.data;
    };

    const buildTransferForm = (pool, onSubmit) => {
      const form = el('form', { className: 'ks-drops-admin__form' });

      const mkSel = (labelText, name, opts) => {
        const w = el('label', { className: 'ks-drops-admin__field' });
        w.appendChild(
          el('div', { className: 'ks-drops-admin__label', text: labelText }),
        );
        const s = el('select', { name, className: 'ks-drops-admin__input' });
        for (const o of opts)
          s.appendChild(el('option', { value: o.value, text: o.text }));
        w.appendChild(s);
        return { w, s };
      };

      const mkInp = (labelText, name, type = 'text', ph = '') => {
        const w = el('label', { className: 'ks-drops-admin__field' });
        w.appendChild(
          el('div', { className: 'ks-drops-admin__label', text: labelText }),
        );
        const i = el('input', {
          name,
          type,
          placeholder: ph,
          className: 'ks-drops-admin__input',
        });
        w.appendChild(i);
        return { w, i };
      };

      const from = mkSel('Откуда', 'from_type', [
        { value: 'mint', text: 'mint (создать)' },
        { value: 'bank', text: 'bank' },
        { value: 'user', text: 'user' },
      ]);

      const to = mkSel('Куда', 'to_type', [
        { value: 'bank', text: 'bank' },
        { value: 'user', text: 'user' },
      ]);

      const fromUid = mkInp(
        'from_user_id (если user)',
        'from_user_id',
        'number',
        'например 2',
      );
      const toUid = mkInp(
        'to_user_id (если user)',
        'to_user_id',
        'number',
        'например 16',
      );

      const itemSel = mkSel(
        'Предмет',
        'item_id',
        (pool || []).map((p) => ({
          value: String(p.id),
          text: `${p.title} (#${p.id})`,
        })),
      );

      const qty = mkInp('Количество', 'qty', 'number', '1');
      qty.i.value = '1';

      const note = mkInp('Комментарий (лог)', 'note', 'text', 'опционально');

      const btn = el('button', {
        type: 'submit',
        className: 'ks-drops-admin__btn',
        text: 'Выполнить',
      });

      form.append(
        from.w,
        to.w,
        fromUid.w,
        toUid.w,
        itemSel.w,
        qty.w,
        note.w,
        btn,
      );

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);

        const payload = {
          from_type: String(fd.get('from_type') || ''),
          to_type: String(fd.get('to_type') || ''),
          from_user_id: fd.get('from_user_id')
            ? C.toInt(fd.get('from_user_id'))
            : null,
          to_user_id: fd.get('to_user_id')
            ? C.toInt(fd.get('to_user_id'))
            : null,
          item_id: C.toInt(fd.get('item_id')),
          qty: Math.max(1, C.toInt(fd.get('qty'))),
          note: String(fd.get('note') || ''),
        };

        onSubmit(payload);
      });

      return form;
    };

    root.classList.add('ks-drops-admin');
    root.innerHTML = '';

    const head = el('div', { className: 'ks-drops-admin__head' });
    head.appendChild(
      el('div', { className: 'ks-drops-admin__h', text: 'Админка Drops' }),
    );

    const targetWrap = el('div', { className: 'ks-drops-admin__target' });
    const targetInp = el('input', {
      type: 'number',
      className: 'ks-drops-admin__input',
      placeholder: 'user_id для просмотра',
    });
    const targetBtn = el('button', {
      type: 'button',
      className: 'ks-drops-admin__btn',
      text: 'Загрузить',
    });
    targetWrap.append(targetInp, targetBtn);

    head.appendChild(targetWrap);
    root.appendChild(head);

    const userBox = el('div', { className: 'ks-drops-admin__box' });
    userBox.append(
      el('div', {
        className: 'ks-drops-admin__boxh',
        text: 'Инвентарь пользователя',
      }),
    );
    const userBody = el('div', { className: 'ks-drops-admin__boxb' });
    userBox.appendChild(userBody);

    const formBox = el('div', { className: 'ks-drops-admin__box' });
    formBox.append(
      el('div', { className: 'ks-drops-admin__boxh', text: 'Переводы / mint' }),
    );
    const formBody = el('div', { className: 'ks-drops-admin__boxb' });
    formBox.appendChild(formBody);

    root.append(userBox, formBox);

    let pool = [];

    const load = async (targetUserId) => {
      userBody.innerHTML = 'Загрузка...';

      const data = await fetchAdminState(targetUserId);

      if (data.bank) C.dispatch('ks:drops:bankUpdated', { bank: data.bank });

      pool = data.item_pool || [];

      userBody.innerHTML = '';
      if (data.target_inventory?.items)
        userBody.appendChild(renderList(data.target_inventory.items));
      else
        userBody.appendChild(
          el('div', {
            className: 'ks-drops-admin__muted',
            text: 'Пользователь не выбран.',
          }),
        );

      if (!formBody.querySelector('form')) {
        const form = buildTransferForm(pool, async (payload) => {
          try {
            const res = await postTransfer(payload);

            if (res.success) {
              C.toast(H, 'Ок', 'success');

              if (res.bank)
                C.dispatch('ks:drops:bankUpdated', { bank: res.bank });
              if (
                res.touched_inventory &&
                res.touched_user_id &&
                C.toInt(res.touched_user_id) === C.getUserId(H)
              ) {
                C.dispatch('ks:drops:inventoryUpdated', {
                  inventory: res.touched_inventory,
                });
              }

              if (res.touched_inventory?.items) {
                userBody.innerHTML = '';
                userBody.appendChild(renderList(res.touched_inventory.items));
              }
            } else {
              C.toast(H, res.message || 'Ошибка', 'error');
            }
          } catch {
            C.toast(H, 'Ошибка перевода', 'error');
          }
        });

        formBody.appendChild(form);
      }
    };

    targetBtn.addEventListener('click', () => {
      const uid = C.toInt(targetInp.value || 0);
      load(uid > 0 ? uid : 0).catch(() =>
        C.toast(H, 'Не удалось загрузить admin_state', 'error'),
      );
    });

    load(0).catch(() =>
      C.toast(H, 'Не удалось загрузить admin_state', 'error'),
    );
  };

  init().catch(() => {});
})();
