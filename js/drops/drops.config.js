(() => {
  'use strict';

  window.ScriptConfig = window.ScriptConfig || {};
  window.ScriptConfig.drops = {
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    debug: false,

    access: {
      allowAllUsers: false,
      hideForGuests: true,
      whitelistGroups: [1, 2],
      adminGroup: 1,
    },

    chest: {
      enabled: true,
      chestItemId: 900,
      title: 'Сундук',
      imageUrl: 'https://feathertail.ru/ks/drops/assets/items/chest.png',
      hideInGrid: true,

      texts: {
        open: 'Открыть',
        noChest: 'Нет сундуков',
        nothing: 'Ничего не выпало',
        got: 'Из сундука: {{title}} x{{qty}}',
        error: 'Не удалось открыть сундук',
      },
    },
  };
})();

