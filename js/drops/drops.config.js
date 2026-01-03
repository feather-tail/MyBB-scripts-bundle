(() => {
  'use strict';

  window.ScriptConfig = window.ScriptConfig || {};
  window.ScriptConfig.drops = {
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    debug: false,

    access: {
      allowAllUsers: true,
      hideForGuests: true,
      whitelistGroups: [1, 2],
      adminGroup: 1,
    },
  };
})();
