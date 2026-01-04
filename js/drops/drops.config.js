(() => {
  'use strict';

  const defaults = {
    debug: true,
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    access: {
      whitelistGroups: [1, 2],
      adminGroup: 1,
      hideForGuests: true,
    },

    chest: {
      enabled: true,
      chestItemId: 900,
      title: 'Сундук',
      imageUrl: 'https://feathertail.ru/ks/drops/assets/items/chest.png',
      hideInGrid: true,

      purchase: {
        enabled: true,
        price: 100,
        currencyField: 'UserFld4',
        currencyLabel: 'Деньги',
        texts: {
          buy: 'Купить',
        },
      },

      texts: {
        open: 'Открыть',
        noChest: 'Нет сундуков',
        nothing: 'Ничего не выпало',
        got: 'Из сундука: {{title}} x{{qty}}',
        error: 'Не удалось открыть сундук',
      },
    },

    scope: {
      mode: 'global',
      pageRules: [{ id: 'all', match: /.*/ }],
      onlyWhenPageMatches: false,
    },

    polling: {
      pollIntervalMs: 3500,
      onlinePollIntervalMs: 30000,
      renderTickMs: 250,
      requestTimeoutMs: 12000,
      retries: 1,
    },

    ui: {
      mountTo: 'body',
      widgetId: 'ks-drops-root',
      position: 'bottom-right',
      zIndex: 99999,
      showTimer: false,
      compactStack: true,
      maxVisible: 2,
      dropSizePx: 34,
      randomPosition: { enabled: true, padding: 16, reRollOnSpawn: true },
      texts: {
        collected: 'Собрано: {{title}} x{{qty}}',
        already: 'Не успели: дроп уже забрали',
        expired: 'Дроп исчез',
        forbidden: 'Нет прав для сбора',
        error: 'Ошибка дропов',
      },
    },

    inventory: {
      mountId: 'ks-drops-inventory-root',
      showOnlineBox: true,

      showBankBox: true,
      allowAllUsers: true,
      allowDepositToBank: true,
    },

    admin: {
      mountId: 'ks-drops-admin-root',
    },
  };

  const cfg =
    window.helpers && typeof window.helpers.getConfig === 'function'
      ? window.helpers.getConfig('drops', defaults)
      : { ...defaults, ...(window.ScriptConfig?.drops || {}) };

  cfg.ui = cfg.ui || {};
  if (!cfg.ui.randomPosition && cfg.randomPosition)
    cfg.ui.randomPosition = cfg.randomPosition;
  if (!cfg.randomPosition && cfg.ui.randomPosition)
    cfg.randomPosition = cfg.ui.randomPosition;

  window.ScriptConfig = window.ScriptConfig || {};
  window.ScriptConfig.drops = cfg;
})();
