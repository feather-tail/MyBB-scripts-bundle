(() => {
  'use strict';

  const C = window.KS_DROPS_CORE;
  if (!C) return;

  window.KS_DROPS = window.KS_DROPS || {};
  if (window.KS_DROPS.__inventory_loaded) return;
  window.KS_DROPS.__inventory_loaded = true;

  const isEligibleForInventory = (H, cfg) => {
    const uid = C.getUserId(H);
    if (uid <= 0) return false;

    if (cfg.inventory?.allowAllUsers !== false) return true;
    return C.isEligibleByAccess(H, {
      ...(cfg.access || {}),
      allowAllUsers: false,
    });
  };

  const canDeposit = (H, cfg) => {
    if (cfg.inventory?.allowDepositToBank === false) return false;
    return isEligibleForInventory(H, cfg);
  };

  const findChestQty = (cfg, inv) => {
    const chestId = C.toInt(cfg.chest?.chestItemId || 0);
    if (!chestId) return 0;
    const it = (inv?.items || []).find((x) => C.toInt(x.item_id) === chestId);
    return it ? C.toInt(it.qty) : 0;
  };

  const renderOnline = (H, cfg, root, online) => {
    if (cfg.inventory?.showOnlineBox === false) return;

    let box = root.querySelector('.ks-drops-online');
    if (!box) {
      box = C.el(H, 'div', { className: 'ks-drops-online' });
      root.appendChild(box);
    }

    const count = C.toInt(online?.count);
    const wl = C.toInt(online?.whitelist_count);

    box.innerHTML = '';
    box.appendChild(
      C.el(H, 'div', { className: 'ks-drops-online__title', text: 'Онлайн' }),
    );
    box.appendChild(
      C.el(H, 'div', {
        className: 'ks-drops-online__meta',
        text: `Всего: ${count} • В белом списке: ${wl}`,
      }),
    );
  };

  const renderBank = (H, cfg, root, bank) => {
    if (cfg.inventory?.showBankBox === false) return;

    let box = root.querySelector('.ks-drops-bank');
    if (!box) {
      box = C.el(H, 'div', { className: 'ks-drops-bank' });
      root.appendChild(box);
    }

    box.innerHTML = '';

    const head = C.el(H, 'div', { className: 'ks-drops-bank__head' });
    head.appendChild(
      C.el(H, 'div', {
        className: 'ks-drops-bank__title',
        text: 'Общий банк (строительство)',
      }),
    );
    head.appendChild(
      C.el(H, 'div', {
        className: 'ks-drops-bank__total',
        text: `Всего: ${bank?.total_qty ?? 0}`,
      }),
    );
    box.appendChild(head);

    const grid = C.el(H, 'div', { className: 'ks-drops-bank__grid' });
    const items = bank?.items || [];

    if (!items.length) {
      grid.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-bank__empty',
          text: 'Пока пусто.',
        }),
      );
      box.appendChild(grid);
      return;
    }

    for (const it of items) {
      const card = C.el(H, 'div', { className: 'ks-drops-bank__item' });

      const imgWrap = C.el(H, 'div', { className: 'ks-drops-bank__imgwrap' });
      imgWrap.appendChild(
        C.el(H, 'img', { src: it.image_url || '', alt: it.title || '' }),
      );

      const meta = C.el(H, 'div', { className: 'ks-drops-bank__meta' });
      meta.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-bank__name',
          text: it.title || 'Item #' + it.item_id,
        }),
      );
      meta.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-bank__qty',
          text: 'x' + (it.qty ?? 0),
        }),
      );

      card.append(imgWrap, meta);
      grid.appendChild(card);
    }

    box.appendChild(grid);
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

    left.append(img, meta);

    const btn = C.el(H, 'button', {
      type: 'button',
      className: 'ks-drops-chest__btn',
      text: cfg.chest?.texts?.open || 'Открыть',
    });
    btn.disabled = chestQty <= 0;
    btn.addEventListener('click', () => onOpen(btn));

    box.append(left, btn);
  };

  const renderInventory = (H, cfg, root, inv, bank, online, handlers) => {
    root.innerHTML = '';
    root.classList.add('ks-drops-inv');

    renderOnline(H, cfg, root, online);
    renderChest(H, cfg, root, inv, handlers.onOpenChest);
    if (bank) renderBank(H, cfg, root, bank);

    const header = C.el(H, 'div', { className: 'ks-drops-inv__header' });
    header.appendChild(
      C.el(H, 'div', { className: 'ks-drops-inv__title', text: 'Ресурсы' }),
    );
    header.appendChild(
      C.el(H, 'div', {
        className: 'ks-drops-inv__total',
        text: `Всего: ${inv?.total_qty ?? 0}`,
      }),
    );
    root.appendChild(header);

    const grid = C.el(H, 'div', { className: 'ks-drops-inv__grid' });

    const chestId = C.toInt(cfg.chest?.chestItemId || 0);
    const hideChestInGrid = cfg.chest?.hideInGrid !== false;

    const items = (inv?.items || []).filter((it) =>
      !hideChestInGrid ? true : C.toInt(it.item_id) !== chestId,
    );

    if (!items.length) {
      grid.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-inv__empty',
          text: 'Пока пусто.',
        }),
      );
      root.appendChild(grid);
      return;
    }

    for (const it of items) {
      const card = C.el(H, 'div', { className: 'ks-drops-inv__item' });

      const imgWrap = C.el(H, 'div', { className: 'ks-drops-inv__imgwrap' });
      imgWrap.appendChild(
        C.el(H, 'img', { src: it.image_url || '', alt: it.title || '' }),
      );

      const meta = C.el(H, 'div', { className: 'ks-drops-inv__meta' });
      meta.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-inv__name',
          text: it.title || 'Item #' + it.item_id,
        }),
      );
      meta.appendChild(
        C.el(H, 'div', {
          className: 'ks-drops-inv__qty',
          text: 'x' + (it.qty ?? 0),
        }),
      );

      card.append(imgWrap, meta);

      if (canDeposit(H, cfg)) {
        const btn = C.el(H, 'button', {
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

  const init = async () => {
    await C.domReady();

    const H = await C.waitForHelpers(60000, 50);
    if (!H) return;

    const cfg = C.getCfg();
    const root = document.getElementById(
      cfg.inventory?.mountId || 'ks-drops-inventory-root',
    );
    if (!root) return;

    if (!isEligibleForInventory(H, cfg)) {
      root.innerHTML = '<div class="ks-drops-inv__empty">Нет доступа.</div>';
      return;
    }

    const api = (action, params) => C.apiUrl(cfg, action, params);

    const fetchInventory = async () => {
      const resp = await H.request(
        api('inventory', {
          user_id: C.getUserId(H),
          group_id: C.getGroupId(H),
        }),
        {
          method: 'GET',
          timeout: cfg.polling?.requestTimeoutMs || 12000,
          responseType: 'json',
          retries: cfg.polling?.retries || 0,
        },
      );
      if (resp?.ok !== true)
        throw new Error(resp?.error?.message || 'inventory error');
      return resp.data?.inventory;
    };

    const fetchBankState = async () => {
      const resp = await H.request(api('bank_state', {}), {
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
        api('online', { user_id: C.getUserId(H), group_id: C.getGroupId(H) }),
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
      const resp = await H.request(api('bank_deposit', {}), {
        method: 'POST',
        timeout: cfg.polling?.requestTimeoutMs || 12000,
        responseType: 'json',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          user_id: C.getUserId(H),
          group_id: C.getGroupId(H),
          item_id: C.toInt(itemId),
          qty: C.toInt(qty),
        }),
        retries: cfg.polling?.retries || 0,
      });
      if (resp?.ok !== true)
        throw new Error(resp?.error?.message || 'bank_deposit error');
      return resp.data;
    };

    let inv = null;
    let bank = null;
    let online = null;

    const rerender = () => {
      renderInventory(H, cfg, root, inv, bank, online, {
        onOpenChest: async (btn) => {
          btn.disabled = true;
          btn.classList.add('is-busy');

          try {
            const resp = await H.request(api('chest_open', {}), {
              method: 'POST',
              timeout: cfg.polling?.requestTimeoutMs || 12000,
              responseType: 'json',
              headers: { 'Content-Type': 'application/json' },
              data: JSON.stringify({
                user_id: C.getUserId(H),
                group_id: C.getGroupId(H),
              }),
              retries: cfg.polling?.retries || 0,
            });

            if (resp?.ok !== true) throw new Error('bad response');

            const d = resp.data || {};
            if (!d.opened) {
              C.toast(
                H,
                d.message || cfg.chest?.texts?.noChest || 'Нет сундуков',
                'info',
              );
            } else {
              const reward = d.reward || { type: 'none' };
              if (reward.type === 'none') {
                C.toast(
                  H,
                  cfg.chest?.texts?.nothing || 'Ничего не выпало',
                  'info',
                );
              } else {
                const title = reward.item?.title || 'награда';
                const q = Math.max(1, C.toInt(reward.qty || 1));
                C.toast(
                  H,
                  (cfg.chest?.texts?.got || 'Из сундука: {{title}} x{{qty}}')
                    .replace('{{title}}', title)
                    .replace('{{qty}}', String(q)),
                  'success',
                );
              }
            }

            if (d.inventory) {
              inv = d.inventory;
              C.dispatch('ks:drops:inventoryUpdated', { inventory: inv });
            }

            try {
              bank = await fetchBankState();
            } catch {}
            rerender();
          } catch {
            C.toast(
              H,
              cfg.chest?.texts?.error || 'Не удалось открыть сундук',
              'error',
            );
          } finally {
            btn.classList.remove('is-busy');
            btn.disabled = findChestQty(cfg, inv) <= 0;
          }
        },

        onDeposit: async (item, btn) => {
          const itemId = C.toInt(item.item_id);
          const have = C.toInt(item.qty);
          if (have <= 0) return;

          const raw = prompt(`Сколько внести в банк? (1..${have})`, '1');
          if (raw === null) return;

          const qty = Math.max(1, Math.min(have, C.toInt(raw)));

          btn.disabled = true;
          btn.classList.add('is-busy');

          try {
            const res = await postDeposit(itemId, qty);
            if (!res.success) {
              C.toast(H, res.message || 'Ошибка взноса', 'error');
              return;
            }

            C.toast(H, 'Взнос принят', 'success');

            if (res.inventory) {
              inv = res.inventory;
              C.dispatch('ks:drops:inventoryUpdated', { inventory: inv });
            }
            if (res.bank) {
              bank = res.bank;
              C.dispatch('ks:drops:bankUpdated', { bank });
            }

            rerender();
          } catch {
            C.toast(H, 'Не удалось внести в банк', 'error');
          } finally {
            btn.disabled = false;
            btn.classList.remove('is-busy');
          }
        },
      });
    };

    try {
      const [invRes, bankRes, onlineRes] = await Promise.allSettled([
        fetchInventory(),
        fetchBankState(),
        fetchOnline(),
      ]);
      if (invRes.status !== 'fulfilled') throw invRes.reason;

      inv = invRes.value;
      bank = bankRes.status === 'fulfilled' ? bankRes.value : null;
      online = onlineRes.status === 'fulfilled' ? onlineRes.value : null;

      rerender();
    } catch {
      root.innerHTML =
        '<div class="ks-drops-inv__empty">Ошибка загрузки.</div>';
      return;
    }

    window.addEventListener('ks:drops:inventoryUpdated', (ev) => {
      const newInv = ev.detail?.inventory;
      if (newInv) {
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
        C.toInt(cfg.polling?.onlinePollIntervalMs ?? 30000),
      );
      setInterval(async () => {
        try {
          online = await fetchOnline();
          rerender();
        } catch {}
      }, ms);
    }
  };

  init().catch(() => {});
})();
