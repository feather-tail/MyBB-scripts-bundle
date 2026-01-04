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

  waitForHelpers()
    .then((H) => {
      const cfg = H.getConfig('drops', window.ScriptConfig?.drops || {});
      const log = (...a) => cfg.debug && console.log('[drops:inv]', ...a);

      const apiUrl = (action, params) => {
        const base = String(cfg.apiBase || '').trim();
        const sp = new URLSearchParams({ action, ...(params || {}) });
        return base + (base.includes('?') ? '&' : '?') + sp.toString();
      };

      const toast = (msg, type = 'info') =>
        H.showToast ? H.showToast(msg, type) : alert(msg);

      const isEligibleForInventory = () => {
        const uid = toInt(H.getUserId());
        if (!uid || uid <= 0) return false;

        if (cfg.inventory?.allowAllUsers !== false) return true;

        const gid = toInt(H.getGroupId());
        return (cfg.access?.whitelistGroups || []).map(toInt).includes(gid);
      };

      const canDeposit = () => {
        if (cfg.inventory?.allowDepositToBank === false) return false;
        return isEligibleForInventory();
      };

      const findChestQty = (inv) => {
        const chestId = toInt(cfg.chest?.chestItemId || 0);
        if (!chestId) return 0;
        const it = (inv?.items || []).find((x) => toInt(x.item_id) === chestId);
        return it ? toInt(it.qty) : 0;
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

      const renderChest = (H, cfg, ui, inv, onOpen, state) => {
        if (!cfg.chest?.enabled) {
          ui.chestBox.hidden = true;
          return;
        }
        ui.chestBox.hidden = false;

        const chestQty = findChestQty(inv);
        const purchaseCfg = cfg.chest?.purchase || {};
        const purchaseEnabled =
          purchaseCfg.enabled !== false && toInt(purchaseCfg.price) > 0;
        const currencyField = purchaseCfg.currencyField || 'UserFld4';
        const rawCurrency = purchaseEnabled ? window[currencyField] : null;
        const currencyValue = purchaseEnabled ? toInt(rawCurrency) : 0;
        const maxAffordable = purchaseEnabled
          ? Math.floor(currencyValue / Math.max(1, toInt(purchaseCfg.price)))
          : 0;

        const key = [
          chestQty,
          purchaseEnabled ? 1 : 0,
          currencyValue,
          toInt(purchaseCfg.price),
        ].join('|');
        if (state.chestKey === key) return;
        state.chestKey = key;

        const frag = document.createDocumentFragment();
        const left = H.createEl('div', { className: 'ks-drops-chest__left' });
        const img = H.createEl('img', {
          className: 'ks-drops-chest__img',
          src: cfg.chest?.imageUrl || '',
          alt: cfg.chest?.title || 'Сундук',
        });

        const meta = H.createEl('div', { className: 'ks-drops-chest__meta' });
        meta.appendChild(
          H.createEl('div', {
            className: 'ks-drops-chest__title',
            text: cfg.chest?.title || 'Сундук',
          }),
        );
        meta.appendChild(
          H.createEl('div', {
            className: 'ks-drops-chest__qty',
            text: `В наличии: ${chestQty}`,
          }),
        );

        if (purchaseEnabled) {
          const purchaseBox = H.createEl('div', {
            className: 'ks-drops-chest__buy',
          });
          purchaseBox.appendChild(
            H.createEl('div', {
              className: 'ks-drops-chest__currency',
              text: `${purchaseCfg.currencyLabel || 'Валюта'}: ${
                rawCurrency ?? '0'
              }`,
            }),
          );
          purchaseBox.appendChild(
            H.createEl('div', {
              className: 'ks-drops-chest__price',
              text: `Цена: ${toInt(purchaseCfg.price)} за сундук`,
            }),
          );

          const buyRow = H.createEl('div', {
            className: 'ks-drops-chest__buyrow',
          });
          const qtyInput = H.createEl('input', {
            type: 'number',
            min: 1,
            max: Math.max(1, maxAffordable),
            value: 1,
            className: 'ks-drops-chest__buyqty',
          });
          qtyInput.disabled = maxAffordable <= 0;

          const totalText = H.createEl('div', {
            className: 'ks-drops-chest__total',
            text: `К оплате: ${toInt(purchaseCfg.price)}`,
          });

          const syncTotal = () => {
            const max = Math.max(0, maxAffordable);
            let val = toInt(qtyInput.value || 0);
            if (val < 1) val = 1;
            if (max > 0 && val > max) val = max;
            qtyInput.value = String(val);
            totalText.textContent = `К оплате: ${
              val * Math.max(1, toInt(purchaseCfg.price))
            }`;
          };

          qtyInput.addEventListener('input', syncTotal);
          syncTotal();

          const buyBtn = H.createEl('button', {
            type: 'button',
            className: 'ks-drops-chest__btn ks-drops-chest__buybtn',
            text: purchaseCfg.texts?.buy || 'Купить',
          });
          buyBtn.disabled = maxAffordable <= 0;
          buyBtn.addEventListener('click', () => {
            if (maxAffordable <= 0) return;
            syncTotal();
            const qty = Math.max(1, toInt(qtyInput.value || 1));
            if (qty > maxAffordable) return;
            onOpen(buyBtn, qty, currencyValue);
          });

          buyRow.append(qtyInput, buyBtn);
          purchaseBox.append(buyRow, totalText);
          meta.appendChild(purchaseBox);
        }

        left.append(img, meta);

        const btn = H.createEl('button', {
          type: 'button',
          className: 'ks-drops-chest__btn',
          text: cfg.chest?.texts?.open || 'Открыть',
        });
        btn.disabled = chestQty <= 0;
        btn.addEventListener('click', () => onOpen(btn));

        frag.append(left, btn);
        ui.chestBox.replaceChildren(frag);
      };

      const renderBank = (H, ui, bank, state) => {
        if (cfg.inventory?.showBankBox === false) {
          ui.bankBox.hidden = true;
          return;
        }
        ui.bankBox.hidden = false;

        const items = bank?.items || [];
        const key = `${bank?.total_qty ?? 0}|${buildItemsKey(items)}`;
        if (state.bankKey === key) return;
        state.bankKey = key;

        const frag = document.createDocumentFragment();

        const head = H.createEl('div', { className: 'ks-drops-bank__head' });
        head.appendChild(
          H.createEl('div', {
            className: 'ks-drops-bank__title',
            text: 'Общий банк (строительство)',
          }),
        );
        head.appendChild(
          H.createEl('div', {
            className: 'ks-drops-bank__total',
            text: `Всего: ${bank?.total_qty ?? 0}`,
          }),
        );
        frag.appendChild(head);

        const grid = H.createEl('div', { className: 'ks-drops-bank__grid' });

        if (!items.length) {
          grid.appendChild(
            H.createEl('div', {
              className: 'ks-drops-bank__empty',
              text: 'Пока пусто.',
            }),
          );
          frag.appendChild(grid);
          ui.bankBox.replaceChildren(frag);
          return;
        }

        for (const it of items) {
          const card = H.createEl('div', { className: 'ks-drops-bank__item' });

          const imgWrap = H.createEl('div', {
            className: 'ks-drops-bank__imgwrap',
          });
          imgWrap.appendChild(
            H.createEl('img', { src: it.image_url || '', alt: it.title || '' }),
          );

          const meta = H.createEl('div', { className: 'ks-drops-bank__meta' });
          meta.appendChild(
            H.createEl('div', {
              className: 'ks-drops-bank__name',
              text: it.title || 'Item #' + it.item_id,
            }),
          );
          meta.appendChild(
            H.createEl('div', {
              className: 'ks-drops-bank__qty',
              text: 'x' + (it.qty ?? 0),
            }),
          );

          card.appendChild(imgWrap);
          card.appendChild(meta);

          grid.appendChild(card);
        }

        frag.appendChild(grid);
        ui.bankBox.replaceChildren(frag);
      };

      const renderInventory = (
        H,
        cfg,
        ui,
        inv,
        bank,
        handlers,
        state,
      ) => {
        renderChest(H, cfg, ui, inv, handlers.onOpenChest, state);
        if (bank) {
          renderBank(H, ui, bank, state);
        } else {
          if (cfg.inventory?.showBankBox !== false) ui.bankBox.hidden = true;
          state.bankKey = null;
        }

        const chestId = toInt(cfg.chest?.chestItemId || 0);
        const hideChestInGrid = cfg.chest?.hideInGrid !== false;
        const items = (inv?.items || []).filter((it) => {
          if (!hideChestInGrid) return true;
          return toInt(it.item_id) !== chestId;
        });
        const invKey = `${inv?.total_qty ?? 0}|${buildItemsKey(items)}|${
          canDeposit() ? 1 : 0
        }`;
        if (state.invKey === invKey) return;
        state.invKey = invKey;

        ui.totalEl.textContent = `Всего: ${inv?.total_qty ?? 0}`;

        const frag = document.createDocumentFragment();

        if (!items.length) {
          frag.appendChild(
            H.createEl('div', {
              className: 'ks-drops-inv__empty',
              text: 'Пока пусто.',
            }),
          );
          ui.grid.replaceChildren(frag);
          return;
        }

        for (const it of items) {
          const card = H.createEl('div', { className: 'ks-drops-inv__item' });

          const imgWrap = H.createEl('div', {
            className: 'ks-drops-inv__imgwrap',
          });
          imgWrap.appendChild(
            H.createEl('img', { src: it.image_url || '', alt: it.title || '' }),
          );

          const meta = H.createEl('div', { className: 'ks-drops-inv__meta' });
          meta.appendChild(
            H.createEl('div', {
              className: 'ks-drops-inv__name',
              text: it.title || 'Item #' + it.item_id,
            }),
          );
          meta.appendChild(
            H.createEl('div', {
              className: 'ks-drops-inv__qty',
              text: 'x' + (it.qty ?? 0),
            }),
          );

          card.appendChild(imgWrap);
          card.appendChild(meta);

          if (canDeposit()) {
            const btn = H.createEl('button', {
              type: 'button',
              className: 'ks-drops-inv__deposit',
              text: 'В банк',
            });

            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              handlers.onDeposit(it, btn);
            });

            card.appendChild(btn);
          }

          frag.appendChild(card);
        }

        ui.grid.replaceChildren(frag);
      };

      const fetchInventory = async (targetUserId) => {
        const finalUrl = apiUrl('inventory', {
          user_id: targetUserId,
          group_id: toInt(H.getGroupId()),
        });

        const resp = await H.request(finalUrl, {
          method: 'GET',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
        });

        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'inventory error');
        return resp.data?.inventory;
      };

      const fetchBankState = async () => {
        const resp = await H.request(apiUrl('bank_state', {}), {
          method: 'GET',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
        });
        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'bank_state error');
        return resp.data?.bank;
      };

      const postDeposit = async (itemId, qty) => {
        const resp = await H.request(apiUrl('bank_deposit', {}), {
          method: 'POST',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            user_id: toInt(H.getUserId()),
            group_id: toInt(H.getGroupId()),
            item_id: toInt(itemId),
            qty: toInt(qty),
          }),
          retries: cfg.polling?.retries || 0,
        });

        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'bank_deposit error');
        return resp.data;
      };

      const init = async () => {
        const root = document.getElementById(
          cfg.inventory?.mountId || 'ks-drops-inventory-root',
        );
        if (!root) return;

        if (!isEligibleForInventory()) {
          root.innerHTML =
            '<div class="ks-drops-inv__empty">Нет доступа.</div>';
          return;
        }

        root.classList.add('ks-drops-inv');
        root.innerHTML = '';

        const ui = {
          chestBox: H.createEl('div', { className: 'ks-drops-chest' }),
          bankBox: H.createEl('div', { className: 'ks-drops-bank' }),
          header: H.createEl('div', { className: 'ks-drops-inv__header' }),
          totalEl: H.createEl('div', { className: 'ks-drops-inv__total' }),
          grid: H.createEl('div', { className: 'ks-drops-inv__grid' }),
        };
        ui.header.appendChild(
          H.createEl('div', {
            className: 'ks-drops-inv__title',
            text: 'Ресурсы',
          }),
        );
        ui.header.appendChild(ui.totalEl);
        root.append(
          ui.chestBox,
          ui.bankBox,
          ui.header,
          ui.grid,
        );

        const uid = toInt(H.getUserId());
        let inv = null;
        let bank = null;
        let online = null;
        const renderState = {
          chestKey: null,
          bankKey: null,
          invKey: null,
        };
        let renderScheduled = false;

        const rerender = () => {
          renderScheduled = false;
          renderInventory(H, cfg, ui, inv, bank, handlers, renderState);
        };

        const scheduleRender = () => {
          if (renderScheduled) return;
          renderScheduled = true;
          requestAnimationFrame(rerender);
        };

        const handlers = {
          onOpenChest: async (btn, purchaseQty = null, currencyValue = null) => {
              if (purchaseQty) {
                btn.disabled = true;
                btn.classList.add('is-busy');
                try {
                  const resp = await H.request(
                    apiUrl('purchase_request', {}),
                    {
                      method: 'POST',
                      timeout: cfg.polling?.requestTimeoutMs || 12000,
                      responseType: 'json',
                      headers: { 'Content-Type': 'application/json' },
                      data: JSON.stringify({
                        user_id: uid,
                        group_id: toInt(H.getGroupId()),
                        qty: toInt(purchaseQty),
                        price: toInt(cfg.chest?.purchase?.price || 0),
                        user_currency: toInt(currencyValue),
                      }),
                      retries: cfg.polling?.retries || 0,
                    },
                  );

                  if (resp?.ok !== true) throw new Error('bad response');

                  const d = resp.data || {};
                  if (!d.success) {
                    toast(d.message || 'Ошибка заявки', 'error');
                  } else {
                    toast(d.message || 'Заявка отправлена', 'success');
                  }
                } catch {
                  toast('Не удалось отправить заявку', 'error');
                } finally {
                  btn.classList.remove('is-busy');
                  btn.disabled = false;
                }
                return;
              }

              btn.disabled = true;
              btn.classList.add('is-busy');

              try {
                const resp = await H.request(apiUrl('chest_open', {}), {
                  method: 'POST',
                  timeout: cfg.polling?.requestTimeoutMs || 12000,
                  responseType: 'json',
                  headers: { 'Content-Type': 'application/json' },
                  data: JSON.stringify({
                    user_id: uid,
                    group_id: toInt(H.getGroupId()),
                  }),
                  retries: cfg.polling?.retries || 0,
                });

                if (resp?.ok !== true) throw new Error('bad response');

                const d = resp.data || {};
                if (!d.opened) {
                  toast(
                    d.message || cfg.chest?.texts?.noChest || 'Нет сундуков',
                    'info',
                  );
                } else {
                  const reward = d.reward || { type: 'none' };
                  if (reward.type === 'none') {
                    toast(
                      cfg.chest?.texts?.nothing || 'Ничего не выпало',
                      'info',
                    );
                  } else {
                    const title = reward.item?.title || 'награда';
                    const q = toInt(reward.qty || 1) || 1;
                    toast(
                      (
                        cfg.chest?.texts?.got ||
                        'Из сундука: {{title}} x{{qty}}'
                      )
                        .replace('{{title}}', title)
                        .replace('{{qty}}', String(q)),
                      'success',
                    );
                  }
                }

                if (d.inventory) {
                  inv = d.inventory;
                  window.dispatchEvent(
                    new CustomEvent('ks:drops:inventoryUpdated', {
                      detail: { inventory: inv },
                    }),
                  );
                }

                 try {
                  bank = await fetchBankState();
                } catch {}
                scheduleRender();
              } catch (e) {
                log('chest open error', e);
                toast(
                  cfg.chest?.texts?.error || 'Не удалось открыть сундук',
                  'error',
                );
              } finally {
                btn.classList.remove('is-busy');
                btn.disabled = findChestQty(inv) <= 0;
              }
            },

            onDeposit: async (item, btn) => {
              const itemId = toInt(item.item_id);
              const have = toInt(item.qty);
              if (have <= 0) return;

              const raw = prompt(`Сколько внести в банк? (1..${have})`, '1');
              if (raw === null) return;
              const qty = Math.max(1, Math.min(have, toInt(raw)));

              if (btn) {
                btn.disabled = true;
                btn.classList.add('is-busy');
              }

              try {
                const res = await postDeposit(itemId, qty);
                if (!res.success) {
                  toast(res.message || 'Ошибка взноса', 'error');
                  return;
                }
                toast('Взнос принят', 'success');

                if (res.inventory) {
                  inv = res.inventory;
                  window.dispatchEvent(
                    new CustomEvent('ks:drops:inventoryUpdated', {
                      detail: { inventory: inv },
                    }),
                  );
                }
                if (res.bank) {
                  bank = res.bank;
                  window.dispatchEvent(
                    new CustomEvent('ks:drops:bankUpdated', {
                      detail: { bank },
                    }),
                  );
                }

                scheduleRender();
              } catch (e) {
                log('deposit error', e);
                toast('Не удалось внести в банк', 'error');
              } finally {
                if (btn) {
                  btn.disabled = false;
                  btn.classList.remove('is-busy');
                }
              }
            },
          };

        try {
          const [invRes, bankRes] = await Promise.allSettled([
            fetchInventory(uid),
            fetchBankState(),
          ]);

          if (invRes.status !== 'fulfilled') throw invRes.reason;
          inv = invRes.value;

          bank = bankRes.status === 'fulfilled' ? bankRes.value : null;

          scheduleRender();
        } catch (e) {
          log('init load error', e);
          toast('Не удалось загрузить инвентарь/банк', 'error');
          root.innerHTML =
            '<div class="ks-drops-inv__empty">Ошибка загрузки.</div>';
          return;
        }

        window.addEventListener('ks:drops:inventoryUpdated', (ev) => {
          const newInv = ev.detail?.inventory;
          if (newInv && newInv.user_id === uid) {
            inv = newInv;
            scheduleRender();
          }
        });

        window.addEventListener('ks:drops:bankUpdated', (ev) => {
          const newBank = ev.detail?.bank;
          if (newBank) {
            bank = newBank;
            scheduleRender();
          }
        });
      };

      H.runOnceOnReady(init);
    })
    .catch((e) => console.warn('[drops:inv] init failed:', e));
})();





