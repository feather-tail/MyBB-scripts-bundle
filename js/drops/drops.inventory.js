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

      const renderOnline = (root, online) => {
        if (cfg.inventory?.showOnlineBox === false) return;

        let box = root.querySelector('.ks-drops-online');
        if (!box) {
          box = H.createEl('div', { className: 'ks-drops-online' });
          root.appendChild(box);
        }

        const count = toInt(online?.count);
        const wl = toInt(online?.whitelist_count);

        box.innerHTML = '';
        box.appendChild(
          H.createEl('div', {
            className: 'ks-drops-online__title',
            text: 'Онлайн',
          }),
        );
        box.appendChild(
          H.createEl('div', {
            className: 'ks-drops-online__meta',
            text: `Всего: ${count} • В белом списке: ${wl}`,
          }),
        );
      };

      const renderChest = (H, cfg, root, inv, onOpen) => {
        if (!cfg.chest?.enabled) return;

        let box = root.querySelector('.ks-drops-chest');
        if (!box) {
          box = C.el(H, 'div', { className: 'ks-drops-chest' });
          root.prepend(box);
        }

        const chestQty = findChestQty(cfg, inv);
        box.innerHTML = '';

        const left = C.el(H, 'div', { className: 'ks-drops-chest__left' });
        const img = C.el(H, 'img', {
          className: 'ks-drops-chest__img',
          src: cfg.chest?.imageUrl || '',
          alt: cfg.chest?.title || 'Сундук',
        });

        const meta = C.el(H, 'div', { className: 'ks-drops-chest__meta' });
        meta.appendChild(
          C.el(H, 'div', {
            className: 'ks-drops-chest__title',
            text: cfg.chest?.title || 'Сундук',
          }),
        );
        meta.appendChild(
          C.el(H, 'div', {
            className: 'ks-drops-chest__qty',
            text: `В наличии: ${chestQty}`,
          }),
        );

        const purchaseCfg = cfg.chest?.purchase || {};
        const purchaseEnabled =
          purchaseCfg.enabled !== false && C.toInt(purchaseCfg.price) > 0;

        let purchaseBox = null;
        if (purchaseEnabled) {
          const currencyField = purchaseCfg.currencyField || 'UserFld4';
          const rawCurrency = window[currencyField];
          const currencyValue = C.toInt(rawCurrency);
          const maxAffordable = Math.floor(
            currencyValue / Math.max(1, C.toInt(purchaseCfg.price)),
          );

          purchaseBox = C.el(H, 'div', { className: 'ks-drops-chest__buy' });
          purchaseBox.appendChild(
            C.el(H, 'div', {
              className: 'ks-drops-chest__currency',
              text: `${purchaseCfg.currencyLabel || 'Валюта'}: ${
                rawCurrency ?? '0'
              }`,
            }),
          );
          purchaseBox.appendChild(
            C.el(H, 'div', {
              className: 'ks-drops-chest__price',
              text: `Цена: ${C.toInt(purchaseCfg.price)} за сундук`,
            }),
          );

          const buyRow = C.el(H, 'div', {
            className: 'ks-drops-chest__buyrow',
          });
          const qtyInput = C.el(H, 'input', {
            type: 'number',
            min: 1,
            max: Math.max(1, maxAffordable),
            value: 1,
            className: 'ks-drops-chest__buyqty',
          });
          qtyInput.disabled = maxAffordable <= 0;

          const totalText = C.el(H, 'div', {
            className: 'ks-drops-chest__total',
            text: `К оплате: ${C.toInt(purchaseCfg.price)}`,
          });

          const syncTotal = () => {
            const max = Math.max(0, maxAffordable);
            let val = C.toInt(qtyInput.value || 0);
            if (val < 1) val = 1;
            if (max > 0 && val > max) val = max;
            qtyInput.value = String(val);
            totalText.textContent = `К оплате: ${
              val * Math.max(1, C.toInt(purchaseCfg.price))
            }`;
          };

          qtyInput.addEventListener('input', syncTotal);
          syncTotal();

          const buyBtn = C.el(H, 'button', {
            type: 'button',
            className: 'ks-drops-chest__btn ks-drops-chest__buybtn',
            text: purchaseCfg.texts?.buy || 'Купить',
          });
          buyBtn.disabled = maxAffordable <= 0;
          buyBtn.addEventListener('click', () => {
            if (maxAffordable <= 0) return;
            syncTotal();
            const qty = Math.max(1, C.toInt(qtyInput.value || 1));
            if (qty > maxAffordable) return;
            onOpen(buyBtn, qty, currencyValue);
          });

          buyRow.append(qtyInput, buyBtn);
          purchaseBox.append(buyRow, totalText);
        }

        left.append(img, meta);

        const btn = C.el(H, 'button', {
          type: 'button',
          className: 'ks-drops-chest__btn',
          text: cfg.chest?.texts?.open || 'Открыть',
        });
        btn.disabled = chestQty <= 0;
        btn.addEventListener('click', () => onOpen(btn));

        if (purchaseBox) meta.appendChild(purchaseBox);
        box.append(left, btn);
      };

      const renderBank = (root, bank) => {
        if (cfg.inventory?.showBankBox === false) return;

        let box = root.querySelector('.ks-drops-bank');
        if (!box) {
          box = H.createEl('div', { className: 'ks-drops-bank' });
          root.appendChild(box);
        }

        box.innerHTML = '';

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
        box.appendChild(head);

        const grid = H.createEl('div', { className: 'ks-drops-bank__grid' });

        const items = bank?.items || [];
        if (!items.length) {
          grid.appendChild(
            H.createEl('div', {
              className: 'ks-drops-bank__empty',
              text: 'Пока пусто.',
            }),
          );
          box.appendChild(grid);
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

        box.appendChild(grid);
      };

      const renderInventory = (H, cfg, root, inv, bank, online, handlers) => {
        root.innerHTML = '';
        root.classList.add('ks-drops-inv');

        renderOnline(H, cfg, root, online);
        renderChest(H, cfg, root, inv, handlers.onOpenChest);
        if (bank) renderBank(H, cfg, root, bank);

        const header = H.createEl('div', { className: 'ks-drops-inv__header' });
        header.appendChild(
          H.createEl('div', {
            className: 'ks-drops-inv__title',
            text: 'Ресурсы',
          }),
        );

        const total = H.createEl('div', {
          className: 'ks-drops-inv__total',
          text: `Всего: ${inv?.total_qty ?? 0}`,
        });

        header.appendChild(total);
        root.appendChild(header);

        const grid = H.createEl('div', { className: 'ks-drops-inv__grid' });

        const chestId = toInt(cfg.chest?.chestItemId || 0);
        const hideChestInGrid = cfg.chest?.hideInGrid !== false;

        const items = (inv?.items || []).filter((it) => {
          if (!hideChestInGrid) return true;
          return toInt(it.item_id) !== chestId;
        });

        if (!items.length) {
          grid.appendChild(
            H.createEl('div', {
              className: 'ks-drops-inv__empty',
              text: 'Пока пусто.',
            }),
          );
          root.appendChild(grid);
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

          grid.appendChild(card);
        }

        root.appendChild(grid);
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

      const fetchOnline = async () => {
        const resp = await H.request(
          apiUrl('online', {
            user_id: toInt(H.getUserId()),
            group_id: toInt(H.getGroupId()),
          }),
          {
            method: 'GET',
            timeout: cfg.polling?.requestTimeoutMs || 12000,
            responseType: 'json',
            retries: cfg.polling?.retries || 0,
          },
        );
        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'online error');
        return resp.data?.online;
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

        const uid = toInt(H.getUserId());
        let inv = null;
        let bank = null;
        let online = null;

        const rerender = () => {
          renderInventory(H, cfg, root, inv, bank, online, {
            onOpenChest: async (
              btn,
              purchaseQty = null,
              currencyValue = null,
            ) => {
              if (purchaseQty) {
                btn.disabled = true;
                btn.classList.add('is-busy');
                try {
                  const resp = await H.request(api('purchase_request', {}), {
                    method: 'POST',
                    timeout: cfg.polling?.requestTimeoutMs || 12000,
                    responseType: 'json',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                      user_id: C.getUserId(H),
                      group_id: C.getGroupId(H),
                      qty: C.toInt(purchaseQty),
                      price: C.toInt(cfg.chest?.purchase?.price || 0),
                      user_currency: C.toInt(currencyValue),
                    }),
                    retries: cfg.polling?.retries || 0,
                  });

                  if (resp?.ok !== true) throw new Error('bad response');

                  const d = resp.data || {};
                  if (!d.success) {
                    C.toast(H, d.message || 'Ошибка заявки', 'error');
                  } else {
                    C.toast(H, d.message || 'Заявка отправлена', 'success');
                  }
                } catch {
                  C.toast(H, 'Не удалось отправить заявку', 'error');
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
                rerender();
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

                rerender();
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
          });
        };

        try {
          const [invRes, bankRes, onlineRes] = await Promise.allSettled([
            fetchInventory(uid),
            fetchBankState(),
            fetchOnline(),
          ]);

          if (invRes.status !== 'fulfilled') throw invRes.reason;
          inv = invRes.value;

          bank = bankRes.status === 'fulfilled' ? bankRes.value : null;
          online = onlineRes.status === 'fulfilled' ? onlineRes.value : null;

          rerender();
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
            rerender();
          }
        });

        window.addEventListener('ks:drops:bankUpdated', (ev) => {
          const newBank = ev.detail?.bank;
          if (newBank) {
            bank = newBank;
            rerender();
          }
        });

        window.addEventListener('ks:drops:onlineUpdated', (ev) => {
          const newOnline = ev.detail?.online;
          if (newOnline) {
            online = newOnline;
            rerender();
          }
        });

        if (cfg.inventory?.showOnlineBox !== false) {
          const ms = Math.max(
            5000,
            toInt(cfg.polling?.onlinePollIntervalMs ?? 30000),
          );
          setInterval(async () => {
            try {
              online = await fetchOnline();
              rerender();
            } catch {}
          }, ms);
        }
      };

      H.runOnceOnReady(init);
    })
    .catch((e) => console.warn('[drops:inv] init failed:', e));
})();
