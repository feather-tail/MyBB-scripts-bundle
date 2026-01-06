(() => {
  'use strict';

  const waitForHelpers = (maxMs = 10000, stepMs = 50) =>
    new Promise((resolve, reject) => {
      const t0 = Date.now();
      (function tick() {
        if (window.helpers && typeof window.helpers.request === 'function')
          return resolve(window.helpers);
        if (Date.now() - t0 >= maxMs)
          return reject(new Error('helpers not found'));
        setTimeout(tick, stepMs);
      })();
    });

  const toInt = (v) => {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const buildItemsKey = (items) =>
    (items || [])
      .map(
        (it) =>
          `${toInt(it.item_id)}:${toInt(it.qty)}:${it.title || ''}:${
            it.image_url || ''
          }`,
      )
      .join('|');

  const buildRequestsKey = (items) =>
    (items || [])
      .map(
        (it) =>
          `${toInt(it.id)}:${it.status || ''}:${toInt(it.qty)}:${toInt(
            it.price_per_chest,
          )}:${toInt(it.total_price)}:${toInt(it.user_id)}:${
            it.user_login || ''
          }:${toInt(it.user_currency)}`,
      )
      .join('|');

  const deepMerge = (base, patch) => {
    const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
    const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
    if (!patch) return out;
    if (Array.isArray(patch)) return patch.slice();
    for (const [k, v] of Object.entries(patch)) {
      if (isObj(v) && isObj(out[k])) out[k] = deepMerge(out[k], v);
      else out[k] = v;
    }
    return out;
  };

  const DEFAULTS = {
    debug: false,
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    access: { adminGroup: 1 },
    polling: { requestTimeoutMs: 12000, retries: 0 },
    admin: {
      mountId: 'ks-drops-admin-root',
      renderBankBox: false,
    },
  };

  waitForHelpers()
    .then((H) => {
      const cfg = deepMerge(
        DEFAULTS,
        H.getConfig('drops', window.ScriptConfig?.drops || {}),
      );
      const log = (...a) => cfg.debug && console.log('[drops:admin]', ...a);

      const getUserId = () => toInt(H.getUserId());
      const getGroupId = () => toInt(H.getGroupId());

      const isAdmin = () => {
        const uid = getUserId();
        const gid = getGroupId();
        return uid > 0 && gid === toInt(cfg.access?.adminGroup ?? 1);
      };

      const apiUrl = (action, params) => {
        const base = String(cfg.apiBase || '').trim();
        const sp = new URLSearchParams({ action, ...(params || {}) });
        return base + (base.includes('?') ? '&' : '?') + sp.toString();
      };

      const toast = (msg, type = 'info') =>
        H.showToast ? H.showToast(msg, type) : alert(msg);
      const el = (tag, props) => H.createEl(tag, props || {});

      const emitBankUpdated = (bank) => {
        if (!bank) return;
        window.dispatchEvent(
          new CustomEvent('ks:drops:bankUpdated', { detail: { bank } }),
        );
      };

      const emitInventoryUpdatedIfSelf = (inv, touchedUserId) => {
        if (!inv) return;
        const uid = getUserId();
        if (touchedUserId && toInt(touchedUserId) === uid) {
          window.dispatchEvent(
            new CustomEvent('ks:drops:inventoryUpdated', {
              detail: { inventory: inv },
            }),
          );
        }
      };

      const renderList = (items) => {
        const wrap = el('div', { className: 'ks-drops-admin__list' });

        if (!items || !items.length) {
          wrap.appendChild(
            el('div', { className: 'ks-drops-admin__muted', text: 'Пусто' }),
          );
          return wrap;
        }

        const frag = document.createDocumentFragment();
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
          row.appendChild(left);

          row.appendChild(
            el('div', {
              className: 'ks-drops-admin__qty',
              text: 'x' + (it.qty ?? 0),
            }),
          );
          frag.appendChild(row);
        }

        wrap.appendChild(frag);
        return wrap;
      };

      const fetchAdminState = async (targetUserId) => {
        const resp = await H.request(
          apiUrl('admin_state', {
            user_id: getUserId(),
            group_id: getGroupId(),
            target_user_id: toInt(targetUserId || 0),
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
        const resp = await H.request(apiUrl('admin_transfer', {}), {
          method: 'POST',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            ...payload,
            user_id: getUserId(),
            group_id: getGroupId(),
          }),
        });

        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'admin_transfer error');
        return resp.data;
      };

      const postPurchaseAction = async (action, payload) => {
        const resp = await H.request(apiUrl(action, {}), {
          method: 'POST',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            ...payload,
            user_id: getUserId(),
            group_id: getGroupId(),
          }),
        });
        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'purchase action error');
        return resp.data;
      };

      const postBuildingVoteReset = async () => {
        const resp = await H.request(apiUrl('admin_building_vote_reset', {}), {
          method: 'POST',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            user_id: getUserId(),
            group_id: getGroupId(),
          }),
          retries: cfg.polling?.retries || 0,
        });
        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'vote reset error');
        return resp.data;
      };

      const renderPurchaseRequests = (items, onProcess, onDelete) => {
        const wrap = el('div', { className: 'ks-drops-admin__list' });

        if (!items || !items.length) {
          wrap.appendChild(
            el('div', {
              className: 'ks-drops-admin__muted',
              text: 'Пока нет заявок.',
            }),
          );
          return wrap;
        }

        const frag = document.createDocumentFragment();
        for (const it of items) {
          const row = el('div', { className: 'ks-drops-admin__row' });
          const left = el('div', { className: 'ks-drops-admin__rowleft' });
          const title = el('div', {
            className: 'ks-drops-admin__title',
            text: `${it.user_login || 'Пользователь'} (#${it.user_id})`,
          });
          const meta = el('div', {
            className: 'ks-drops-admin__qty',
            text: `Сундуки: ${it.qty} • Цена: ${it.price_per_chest} • Итого: ${it.total_price}`,
          });
          const extra = el('div', {
            className: 'ks-drops-admin__muted',
            text: `Валюта: ${it.user_currency ?? '—'} • Статус: ${
              it.status === 'processed' ? 'обработано' : 'ожидает'
            }`,
          });

          left.append(title, meta, extra);

          const actions = el('div', { className: 'ks-drops-admin__actions' });
          const processBtn = el('button', {
            type: 'button',
            className: 'ks-drops-admin__btn',
            text: 'Обработано',
          });
          processBtn.disabled = it.status === 'processed';
          processBtn.addEventListener('click', () => onProcess(it, processBtn));

          const deleteBtn = el('button', {
            type: 'button',
            className: 'ks-drops-admin__btn',
            text: 'Удалить',
          });
          deleteBtn.disabled = it.status !== 'processed';
          deleteBtn.addEventListener('click', () => onDelete(it, deleteBtn));

          actions.append(processBtn, deleteBtn);
          row.append(left, actions);
          frag.appendChild(row);
        }

        wrap.appendChild(frag);
        return wrap;
      };

      const buildTransferForm = (pool, onSubmit) => {
        const form = el('form', { className: 'ks-drops-admin__form' });

        const mkSel = (label, name, opts) => {
          const w = el('label', { className: 'ks-drops-admin__field' });
          w.appendChild(
            el('div', { className: 'ks-drops-admin__label', text: label }),
          );
          const s = el('select', { name, className: 'ks-drops-admin__input' });
          for (const o of opts)
            s.appendChild(el('option', { value: o.value, text: o.text }));
          w.appendChild(s);
          return { w, s };
        };

        const mkInp = (label, name, type = 'text', ph = '') => {
          const w = el('label', { className: 'ks-drops-admin__field' });
          w.appendChild(
            el('div', { className: 'ks-drops-admin__label', text: label }),
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
          { value: 'burn', text: 'burn (удалить)' },
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
              ? toInt(fd.get('from_user_id'))
              : null,
            to_user_id: fd.get('to_user_id')
              ? toInt(fd.get('to_user_id'))
              : null,
            item_id: toInt(fd.get('item_id')),
            qty: Math.max(1, toInt(fd.get('qty'))),
            note: String(fd.get('note') || ''),
          };

          onSubmit(payload);
        });

        return form;
      };

      const init = async () => {
        const root = document.getElementById(
          cfg.admin?.mountId || 'ks-drops-admin-root',
        );
        if (!root) return;

        if (!isAdmin()) {
          root.innerHTML =
            '<div class="ks-drops-admin__muted">Только для админов.</div>';
          log('not admin', {
            uid: getUserId(),
            gid: getGroupId(),
            adminGroup: cfg.access?.adminGroup,
          });
          return;
        }

        root.classList.add('ks-drops-admin');
        root.innerHTML = '';

        const head = el('div', { className: 'ks-drops-admin__head' });
        head.appendChild(
          el('div', { className: 'ks-drops-admin__h', text: 'Админка' }),
        );
        const voteResetBtn = el('button', {
          type: 'button',
          className: 'ks-drops-admin__btn',
          text: 'Сбросить голосование',
        });
        voteResetBtn.addEventListener('click', async () => {
          voteResetBtn.disabled = true;
          voteResetBtn.classList.add('is-busy');
          try {
            const res = await postBuildingVoteReset();
            if (!res?.success) {
              toast(res?.message || 'Ошибка сброса голосования', 'error');
            } else {
              toast(res?.message || 'Голосование сброшено', 'success');
            }
          } catch (e) {
            log('vote reset error', e);
            toast('Не удалось сбросить голосование', 'error');
          } finally {
            voteResetBtn.classList.remove('is-busy');
            voteResetBtn.disabled = false;
          }
        });
        head.appendChild(voteResetBtn);

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
        userBox.appendChild(
          el('div', {
            className: 'ks-drops-admin__boxh',
            text: 'Инвентарь пользователя',
          }),
        );
        const userBody = el('div', { className: 'ks-drops-admin__boxb' });
        userBox.appendChild(userBody);

        const requestsBox = el('div', { className: 'ks-drops-admin__box' });
        const requestsHead = el('div', {
          className: 'ks-drops-admin__boxh',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          },
        });
        requestsHead.appendChild(
          el('div', {
            className: 'ks-drops-admin__boxtitle',
            text: 'Заявки на сундуки',
          }),
        );
        const requestsRefreshBtn = el('button', {
          type: 'button',
          className: 'ks-drops-admin__btn',
          text: 'Обновить',
        });
        requestsHead.appendChild(requestsRefreshBtn);
        requestsBox.appendChild(requestsHead);
        const requestsBody = el('div', { className: 'ks-drops-admin__boxb' });
        requestsBox.appendChild(requestsBody);

        const formBox = el('div', { className: 'ks-drops-admin__box' });
        formBox.appendChild(
          el('div', {
            className: 'ks-drops-admin__boxh',
            text: 'Переводы',
          }),
        );
        const formBody = el('div', { className: 'ks-drops-admin__boxb' });
        formBox.appendChild(formBody);

        root.append(userBox, requestsBox, formBox);

        let pool = [];
        let lastTargetUserId = 0;
        const renderState = {
          userKey: null,
          requestsKey: null,
        };

        const renderRequests = (items) => {
          const key = buildRequestsKey(items);
          if (renderState.requestsKey === key) return;
          renderState.requestsKey = key;

          requestsBody.replaceChildren(
            renderPurchaseRequests(
              items || [],
              async (item, btn) => {
                btn.disabled = true;
                try {
                  const res = await postPurchaseAction(
                    'admin_purchase_process',
                    { id: item.id },
                  );
                  if (!res.success) {
                    toast(res.message || 'Ошибка обработки', 'error');
                  } else {
                    toast('Заявка обработана', 'success');
                    await refreshRequests();
                  }
                } catch {
                  toast('Не удалось обновить заявку', 'error');
                } finally {
                  btn.disabled = item.status === 'processed';
                }
              },
              async (item, btn) => {
                if (!confirm('Удалить заявку?')) return;
                btn.disabled = true;
                try {
                  const res = await postPurchaseAction(
                    'admin_purchase_delete',
                    { id: item.id },
                  );
                  if (!res.success) {
                    toast(res.message || 'Ошибка удаления', 'error');
                  } else {
                    toast('Заявка удалена', 'success');
                    await refreshRequests();
                  }
                } catch {
                  toast('Не удалось удалить заявку', 'error');
                } finally {
                  btn.disabled = item.status !== 'processed';
                }
              },
            ),
          );
        };

        const renderUserList = (items) => {
          const key = buildItemsKey(items);
          if (renderState.userKey === key) return;
          renderState.userKey = key;
          userBody.replaceChildren(renderList(items));
        };

        const refreshRequests = async () => {
          requestsRefreshBtn.disabled = true;
          requestsBody.innerHTML = 'Загрузка...';
          renderState.requestsKey = null;
          try {
            const data = await fetchAdminState(lastTargetUserId);
            if (data.bank) emitBankUpdated(data.bank);
            pool = data.item_pool || pool;
            renderRequests(data.purchase_requests || []);
          } catch (e) {
            log('refresh requests error', e);
            toast('Не удалось обновить заявки', 'error');
          } finally {
            requestsRefreshBtn.disabled = false;
          }
        };

        const load = async (targetUserId) => {
          userBody.innerHTML = 'Загрузка...';
          requestsBody.innerHTML = 'Загрузка...';
          renderState.userKey = null;
          renderState.requestsKey = null;

          const data = await fetchAdminState(targetUserId);
          lastTargetUserId = targetUserId;

          if (data.bank) emitBankUpdated(data.bank);

          pool = data.item_pool || [];

          if (data.target_inventory?.items) {
            renderUserList(data.target_inventory.items);
          } else {
            renderState.userKey = null;
            userBody.replaceChildren(
              el('div', {
                className: 'ks-drops-admin__muted',
                text: 'Пользователь не выбран.',
              }),
            );
          }

          renderRequests(data.purchase_requests || []);

          if (!formBody.querySelector('form')) {
            const form = buildTransferForm(pool, async (payload) => {
              try {
                const res = await postTransfer(payload);

                if (res.success) {
                  toast('Ок', 'success');

                  if (res.bank) emitBankUpdated(res.bank);

                  emitInventoryUpdatedIfSelf(
                    res.touched_inventory,
                    res.touched_user_id,
                  );

                  if (res.touched_inventory?.items) {
                    renderUserList(res.touched_inventory.items);
                  }
                } else {
                  toast(res.message || 'Ошибка', 'error');
                }
              } catch (e) {
                log('transfer error', e);
                toast('Ошибка перевода', 'error');
              }
            });

            formBody.appendChild(form);
          }
        };

        targetBtn.addEventListener('click', () => {
          const uid = toInt(targetInp.value || 0);
          load(uid > 0 ? uid : 0).catch((e) => {
            log('load error', e);
            toast('Не удалось загрузить admin_state', 'error');
          });
        });

        requestsRefreshBtn.addEventListener('click', () => {
          refreshRequests();
        });

        load(0).catch((e) => {
          log('initial load error', e);
          toast('Не удалось загрузить admin_state', 'error');
        });
      };

      H.runOnceOnReady(init);
    })
    .catch((e) => {
      console.warn('[drops:admin] init failed:', e);
    });
})();



