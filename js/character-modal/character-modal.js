(() => {
  'use strict';
  const helpers = window.helpers;
  const { createEl, parseHTML, initTabs } = helpers;
  const config = helpers.getConfig('characterModal', {
    loadingText: 'Загрузка...',
    errorText: 'Ошибка загрузки данных.',
    awards: {
      enabled: false,
      tabTitle: 'Награды',
      emptyText: 'Наград нет.',
      errorText: 'Не удалось загрузить награды.',
    },
  });

  function init() {
    document.body.addEventListener('click', async (e) => {
      const link = e.target.closest('.modal-link');
      if (!link) return;
      e.preventDefault();
      const pageId = link.id;
      if (!pageId) return;
      const box = createEl('div', { className: 'character-modal' });
      box.append(
        createEl('div', {
          style: 'padding:2em; text-align:center;',
          text: config.loadingText,
        }),
      );
      const { close } = window.helpers.modal.openModal(box);
      try {
        const res = await helpers.request(`${config.ajaxFolder}${pageId}`);
        const buf = await res.arrayBuffer();
        const decoder = new TextDecoder(config.charset);
        const html = decoder.decode(buf);
        const doc = parseHTML(html);
        const character = doc.querySelector('.character');
        box.textContent = '';
        const tabParams = {
          tabSelector: `.${config.classes.tab}`,
          contentSelector: `.${config.classes.tabContent}`,
          activeClass: config.classes.active,
        };
        if (character) {
          box.append(character);
          initTabs(character, tabParams);

          if (config.awards?.enabled) {
            // 1) Источник userId: data-атрибуты -> глобали окна (как в «старом» коде)
            const userId =
              link.dataset.userId ||
              character.dataset.userId ||
              character.querySelector('[data-user-id]')?.dataset.userId ||
              window.UserID ||
              '';

            // 2) Таб-бар ищем по конфигу (не хардкодим класс)
            const tabs = character.querySelector(`.${config.classes.tabs}`);

            // 3) URL API
            const awardsUrl =
              config.awards.url ||
              config.awards.apiUrl ||
              'https://core.rusff.me/rusff.php';

            // 4) Если есть userId и URL — шлём запрос, даже если табов сейчас нет
            if (userId && awardsUrl) {
              // (необязательно) лог: увидим в DevTools сам факт попытки запроса
              console.debug('[characterModal:awards] sending request', {
                awardsUrl,
                userId,
              });

              // Подготовим UI только если таб-бар есть
              const tab =
                tabs &&
                createEl('div', {
                  className: config.classes.tab,
                  text: config.awards.tabTitle || 'Награды',
                });
              const content = createEl('div', {
                className: config.classes.tabContent,
              });

              let list = [];
              let isError = false;
              try {
                // 5) Полезная нагрузка точно соответствует «старому» рабочему варианту
                const payload = {
                  id: config.awards.requestId || '1',
                  jsonrpc: '2.0',
                  method: config.awards.rpcMethod || 'awards/index',
                  params: {
                    users_ids: [userId],
                    check: {
                      board_id: config.awards.boardId || window.BoardID,
                      user_id: window.UserID,
                      group_id: window.GroupID,
                      user_lastvisit: window.UserLastVisit,
                      sign: window.ForumAPITicket,
                    },
                    board_id: config.awards.boardId || window.BoardID,
                    user_id: userId,
                    sort: 'user',
                  },
                };

                // 6) Отправка JSON (аналог $.post(url, JSON.stringify(request), ..., 'json'))
                const data = await helpers.request(awardsUrl, {
                  method: config.awards.method || 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  data: JSON.stringify(payload),
                  responseType: 'json',
                  timeout: config.requestTimeoutMs || 15000,
                });

                // Распарсим результат «как в старом»
                const res = data?.result;
                const userAwards =
                  (res &&
                    typeof res === 'object' &&
                    (res[userId] || Object.values(res)[0])) ||
                  null;
                list = userAwards?.awards || [];
              } catch (e) {
                isError = true;
                console.warn('[characterModal:awards] request failed', e);
              }

              // 7) Рисуем вкладку только если есть таб-бар
              if (tabs) {
                if (Array.isArray(list) && list.length) {
                  list.forEach((a) => {
                    const linkEl = createEl('a', {
                      href: a.url || a.item?.href || '#',
                      target: '_blank',
                    });
                    if (a.icon) {
                      linkEl.append(
                        createEl('img', {
                          src: a.icon,
                          alt: a.title || a.item?.name || '',
                        }),
                      );
                    } else {
                      linkEl.textContent = a.title || a.item?.name || '';
                    }
                    content.append(linkEl);
                  });
                } else {
                  content.append(
                    createEl('div', {
                      text: isError
                        ? config.awards.errorText ||
                          config.errorText ||
                          'Не удалось загрузить награды.'
                        : config.awards.emptyText || 'Наград нет.',
                    }),
                  );
                }

                tabs.append(tab);
                character.append(content);
                initTabs(character, {
                  tabSelector: `.${config.classes.tab}`,
                  contentSelector: `.${config.classes.tabContent}`,
                  activeClass: config.classes.active,
                });
              }
            } else {
              console.warn(
                '[characterModal:awards] skipped — no userId or awardsUrl',
                { userId, awardsUrl },
              );
            }
          }
        } else {
          box.append(...Array.from(doc.body.childNodes));
          initTabs(box, tabParams);
        }
      } catch (err) {
        box.textContent = '';
        box.append(
          createEl('div', {
            style: 'padding:2em; color:red;',
            text: config.errorText,
          }),
        );
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('characterModal', { init });
})();
