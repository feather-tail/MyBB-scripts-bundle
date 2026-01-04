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
      const buildBankQtyMap = (bank) => {
        const map = new Map();
        (bank?.items || []).forEach((it) => {
          map.set(toInt(it.item_id), toInt(it.qty));
        });
        return map;
      };

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
            text: 'Склад',
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

      const renderBuildings = (H, cfg, ui, buildingsState, bank, state) => {
        const buildings = buildingsState?.items || [];
        if (!buildings.length || buildingsState?.enabled === false) {
          ui.buildingsBox.hidden = true;
          state.buildingsKey = null;
          return;
        }
        ui.buildingsBox.hidden = false;

        const bankKey = bank
          ? `${bank?.total_qty ?? 0}|${buildItemsKey(bank?.items || [])}`
          : 'nobank';
        const buildingsKey = buildings
          .map(
            (b) =>
              `${b.id}:${b.built ? 1 : 0}:${b.main_building_id || ''}:${
                (b.resources || []).map((r) => `${r.item_id}:${r.qty}`).join(',')
              }`,
          )
          .join('|');
        const key = `${buildingsKey}|${bankKey}`;
        if (state.buildingsKey === key) return;
        state.buildingsKey = key;

        const builtMap = new Map();
        for (const b of buildings) {
          builtMap.set(b.id, !!b.built);
        }
        const bankMap = buildBankQtyMap(bank);

        const wrap = H.createEl('div', {
          className: 'ks-drops-buildings__wrap',
        });
        wrap.appendChild(
          H.createEl('div', {
            className: 'ks-drops-buildings__title',
            text: 'Здания и помещения',
          }),
        );

        const grid = H.createEl('div', {
          className: 'ks-drops-buildings__grid',
        });

        for (const b of buildings) {
          const mainId = b.main_building_id || '';
          const mainBuilt = mainId ? builtMap.get(mainId) : true;
          const locked = !!mainId && !mainBuilt && !b.built;

          const card = H.createEl('div', {
            className: [
              'ks-drops-buildings__card',
              b.built ? 'is-built' : '',
              locked ? 'is-locked' : '',
            ]
              .filter(Boolean)
              .join(' '),
          });

          const imgWrap = H.createEl('div', {
            className: 'ks-drops-buildings__imgwrap',
          });
          imgWrap.appendChild(
            H.createEl('img', {
              src: b.image_url || '',
              alt: b.title || '',
              className: 'ks-drops-buildings__img',
            }),
          );
          card.appendChild(imgWrap);

          const meta = H.createEl('div', {
            className: 'ks-drops-buildings__meta',
          });
          meta.appendChild(
            H.createEl('div', {
              className: 'ks-drops-buildings__name',
              text: b.title || b.id || 'Здание',
            }),
          );
          if (b.description) {
            meta.appendChild(
              H.createEl('div', {
                className: 'ks-drops-buildings__desc',
                text: b.description,
              }),
            );
          }
          if (mainId) {
            const mainTitle =
              b.main_building_title || mainId || 'Основное здание';
            meta.appendChild(
              H.createEl('div', {
                className: 'ks-drops-buildings__main',
                text: `Основное здание: ${mainTitle}`,
              }),
            );
          }
          if (b.built) {
            meta.appendChild(
              H.createEl('div', {
                className: 'ks-drops-buildings__status is-built',
                text: 'Построено',
              }),
            );
          } else if (locked) {
            const mainTitle =
              b.main_building_title || mainId || 'основное здание';
            meta.appendChild(
              H.createEl('div', {
                className: 'ks-drops-buildings__status is-locked',
                text: `Недоступно: требуется ${mainTitle}`,
              }),
            );
          }

          const resList = H.createEl('div', {
            className: 'ks-drops-buildings__resources',
          });
          const resources = b.resources || [];
          if (!resources.length) {
            resList.appendChild(
              H.createEl('div', {
                className: 'ks-drops-buildings__res ks-drops-buildings__res--empty',
                text: 'Ресурсы не указаны',
              }),
            );
          } else {
            for (const r of resources) {
              const have = bankMap.get(toInt(r.item_id)) || 0;
              const need = toInt(r.qty);
              const enough = have >= need && need > 0;
              const res = H.createEl('div', {
                className: [
                  'ks-drops-buildings__res',
                  enough ? 'is-enough' : '',
                ]
                  .filter(Boolean)
                  .join(' '),
              });

              if (r.image_url) {
                res.appendChild(
                  H.createEl('img', {
                    className: 'ks-drops-buildings__resimg',
                    src: r.image_url || '',
                    alt: r.title || '',
                  }),
                );
              }
              res.appendChild(
                H.createEl('div', {
                  className: 'ks-drops-buildings__restitle',
                  text: r.title || `Ресурс #${r.item_id}`,
                }),
              );
              res.appendChild(
                H.createEl('div', {
                  className: 'ks-drops-buildings__resqty',
                  text: `${have}/${need}`,
                }),
              );
              resList.appendChild(res);
            }
          }

          meta.appendChild(resList);
          card.appendChild(meta);
          grid.appendChild(card);
        }

        wrap.appendChild(grid);
        ui.buildingsBox.replaceChildren(wrap);
      };

      const renderVoting = (H, cfg, ui, buildingsState, state, handlers) => {
        const buildings = buildingsState?.items || [];
        const voting = buildingsState?.voting || {};
        if (!voting.enabled || !buildings.length) {
          ui.voteBox.hidden = true;
          state.voteKey = null;
          return;
        }
        ui.voteBox.hidden = false;

        const counts = voting.counts || {};
        const builtMap = new Map();
        for (const b of buildings) {
          builtMap.set(b.id, !!b.built);
        }

        const available = buildings.filter((b) => {
          if (b.built) return false;
          const mainId = b.main_building_id || '';
          if (!mainId) return true;
          return builtMap.get(mainId);
        });

        const countKey = Object.keys(counts)
          .sort()
          .map((k) => `${k}:${counts[k]}`)
          .join('|');
        const key = [
          available.map((b) => b.id).join(','),
          voting.user_vote || '',
          countKey,
        ].join('|');
        if (state.voteKey === key) return;
        state.voteKey = key;

        const wrap = H.createEl('div', {
          className: 'ks-drops-vote__wrap',
        });
        wrap.appendChild(
          H.createEl('div', {
            className: 'ks-drops-vote__title',
            text: 'Голосование за следующее строительство',
          }),
        );

        if (voting.user_vote) {
          const picked = buildings.find((b) => b.id === voting.user_vote);
          wrap.appendChild(
            H.createEl('div', {
              className: 'ks-drops-vote__subtitle',
              text: `Ваш голос: ${picked?.title || voting.user_vote}`,
            }),
          );
        }

        const list = H.createEl('div', { className: 'ks-drops-vote__list' });

        if (!available.length) {
          list.appendChild(
            H.createEl('div', {
              className: 'ks-drops-vote__empty',
              text: 'Нет доступных зданий для голосования.',
            }),
          );
        } else {
          for (const b of available) {
            const row = H.createEl('div', {
              className: [
                'ks-drops-vote__item',
                voting.user_vote === b.id ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' '),
            });

            const left = H.createEl('div', {
              className: 'ks-drops-vote__left',
            });
            if (b.image_url) {
              left.appendChild(
                H.createEl('img', {
                  className: 'ks-drops-vote__img',
                  src: b.image_url || '',
                  alt: b.title || '',
                }),
              );
            }
            left.appendChild(
              H.createEl('div', {
                className: 'ks-drops-vote__name',
                text: b.title || b.id,
              }),
            );
            row.appendChild(left);

            row.appendChild(
              H.createEl('div', {
                className: 'ks-drops-vote__count',
                text: `Голоса: ${counts[b.id] || 0}`,
              }),
            );

            const btn = H.createEl('button', {
              type: 'button',
              className: 'ks-drops-vote__btn',
              text: voting.user_vote === b.id ? 'Ваш выбор' : 'Голосовать',
            });
            btn.disabled = voting.user_vote === b.id;
            btn.addEventListener('click', () => handlers.onVote(b.id, btn));
            row.appendChild(btn);

            list.appendChild(row);
          }
        }

        wrap.appendChild(list);
        ui.voteBox.replaceChildren(wrap);
      };

      const renderInventory = (
        H,
        cfg,
        ui,
        inv,
        bank,
        buildingsState,
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
        renderBuildings(H, cfg, ui, buildingsState, bank, state);
        renderVoting(H, cfg, ui, buildingsState, state, handlers);

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

      const fetchBuildingsState = async () => {
        const resp = await H.request(
          apiUrl('buildings_state', {
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
          throw new Error(resp?.error?.message || 'buildings_state error');
        return resp.data?.buildings_state || null;
      };

      const postBuildingVote = async (buildingId) => {
        const resp = await H.request(apiUrl('building_vote', {}), {
          method: 'POST',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({
            user_id: toInt(H.getUserId()),
            group_id: toInt(H.getGroupId()),
            building_id: buildingId,
          }),
          retries: cfg.polling?.retries || 0,
        });

        if (resp?.ok !== true)
          throw new Error(resp?.error?.message || 'building_vote error');
        return resp.data || {};
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
          buildingsBox: H.createEl('div', {
            className: 'ks-drops-buildings',
          }),
          voteBox: H.createEl('div', { className: 'ks-drops-vote' }),
          header: H.createEl('div', { className: 'ks-drops-inv__header' }),
          totalEl: H.createEl('div', { className: 'ks-drops-inv__total' }),
          grid: H.createEl('div', { className: 'ks-drops-inv__grid' }),
        };
        ui.header.appendChild(
          H.createEl('div', {
            className: 'ks-drops-inv__title',
            text: 'Инвентарь',
          }),
        );
        ui.header.appendChild(ui.totalEl);
        root.append(
          ui.chestBox,
          ui.bankBox,
          ui.buildingsBox,
          ui.voteBox,
          ui.header,
          ui.grid,
        );

        const uid = toInt(H.getUserId());
        let inv = null;
        let bank = null;
        let buildingsState = null;
        let online = null;
        const renderState = {
          chestKey: null,
          bankKey: null,
          invKey: null,
          buildingsKey: null,
          voteKey: null,
        };
        let renderScheduled = false;

        const rerender = () => {
          renderScheduled = false;
          renderInventory(
            H,
            cfg,
            ui,
            inv,
            bank,
            buildingsState,
            handlers,
            renderState,
          );
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

            onVote: async (buildingId, btn) => {
              if (!buildingId) return;
              if (btn) {
                btn.disabled = true;
                btn.classList.add('is-busy');
              }

              try {
                const res = await postBuildingVote(buildingId);
                if (!res.success) {
                  toast(res.message || 'Ошибка голосования', 'error');
                } else {
                  toast(res.message || 'Голос учтен', 'success');
                }
                if (res.buildings_state) {
                  buildingsState = res.buildings_state;
                }
                scheduleRender();
              } catch (e) {
                log('vote error', e);
                toast('Не удалось отправить голос', 'error');
              } finally {
                if (btn) {
                  btn.classList.remove('is-busy');
                  btn.disabled = false;
                }
              }
            },
          };

        try {
          const [invRes, bankRes, buildingsRes] = await Promise.allSettled([
            fetchInventory(uid),
            fetchBankState(),
            fetchBuildingsState(),
          ]);

          if (invRes.status !== 'fulfilled') throw invRes.reason;
          inv = invRes.value;

          bank = bankRes.status === 'fulfilled' ? bankRes.value : null;
          buildingsState =
            buildingsRes.status === 'fulfilled' ? buildingsRes.value : null;

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







