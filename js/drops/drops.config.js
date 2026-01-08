(() => {
  'use strict';

  const defaults = {
    // Включает подробные логи и диагностические сообщения.
    debug: true,
    // Базовый URL API, к которому обращается клиент.
    apiBase: 'https://feathertail.ru/ks/drops/api/index.php',
    access: {
      // Группы, которым разрешён доступ к дропам.
      whitelistGroups: [1, 2, 6],
      // Группа администраторов дропов.
      adminGroup: 1,
      // Скрывать виджет для гостей форума.
      hideForGuests: true,
    },

    chest: {
      // Разрешает механику сундуков.
      enabled: true,
      // ID предмета, который считается сундуком.
      chestItemId: 900,
      // Отображаемое название сундука.
      title: 'Сундук',
      // Картинка сундука в интерфейсе.
      imageUrl: 'https://feathertail.ru/ks/drops/assets/items/chest.png',
      // Скрывать сундуки в общем списке предметов.
      hideInGrid: true,

      purchase: {
        // Разрешить покупку сундуков.
        enabled: true,
        // Стоимость покупки.
        price: 50,
        // Поле пользователя, где хранится валюта.
        currencyField: 'UserFld4',
        // Подпись валюты в интерфейсе.
        currencyLabel: 'Деньги',
        texts: {
          // Текст кнопки покупки.
          buy: 'Купить',
        },
      },

      texts: {
        // Текст кнопки открытия.
        open: 'Открыть',
        // Сообщение, когда сундуков нет.
        noChest: 'Нет сундуков',
        // Сообщение, если выпадение пустое.
        nothing: 'Ничего не выпало',
        // Сообщение об успешном получении.
        got: 'Из сундука: {{title}} x{{qty}}',
        // Сообщение об ошибке открытия.
        error: 'Не удалось открыть сундук',
      },
    },

    scope: {
      // Режим области действия дропов: global или per_user.
      mode: 'global',
      // Правила страниц, где разрешены дропы.
      pageRules: [{ id: 'all', match: /.*/ }],
      // Запускать механику только при совпадении правила страницы.
      onlyWhenPageMatches: false,
    },

    polling: {
      // Интервал опроса сервера о дропах.
      pollIntervalMs: 10000,
      // Интервал проверки онлайна.
      onlinePollIntervalMs: 30000,
      // Частота перерисовки интерфейса.
      renderTickMs: 250,
      // Таймаут сетевых запросов.
      requestTimeoutMs: 20000,
      // Количество повторов при ошибке.
      retries: 1,
    },

    ui: {
      // CSS-селектор контейнера, куда монтируется виджет.
      mountTo: 'body',
      // ID DOM-узла виджета.
      widgetId: 'ks-drops-root',
      // Позиция виджета на экране.
      position: 'bottom-right',
      // Z-index, чтобы виджет был поверх.
      zIndex: 99999,
      // Показывать таймер исчезновения.
      showTimer: false,
      // Уплотнить стек всплывающих дропов.
      compactStack: true,
      // Максимум видимых дропов одновременно.
      maxVisible: 2,
      // Размер иконки дропа в пикселях.
      dropSizePx: 34,
      // Случайное смещение позиции появления дропа.
      randomPosition: { enabled: true, padding: 16, reRollOnSpawn: true },
      texts: {
        // Текст при успешном сборе.
        collected: 'Собрано: {{title}} x{{qty}}',
        // Текст, когда дроп уже забрали.
        already: 'Не успели: дроп уже забрали',
        // Текст, когда дроп исчез.
        expired: 'Дроп исчез',
        // Текст при отсутствии прав.
        forbidden: 'Нет прав для сбора',
        // Текст общей ошибки.
        error: 'Ошибка дропов',
      },
    },

    inventory: {
      // ID контейнера для инвентаря.
      mountId: 'ks-drops-inventory-root',
      // Показывать блок онлайна.
      showOnlineBox: true,

      // Показывать блок банка.
      showBankBox: true,
      // Разрешить доступ к инвентарю всем пользователям.
      allowAllUsers: true,
      // Разрешить пополнение банка.
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






