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
            const userId =
              link.dataset.userId ||
              character.dataset.userId ||
              character.querySelector('[data-user-id]')?.dataset.userId ||
              '';
            const tabs = character.querySelector('.modal__tabs');
            const awardsUrl = config.awards.url || config.awards.apiUrl;
            if (userId && tabs && awardsUrl) {
              const tab = createEl('div', {
                className: config.classes.tab,
                text: config.awards.tabTitle,
              });
              const content = createEl('div', {
                className: config.classes.tabContent,
              });
              let list = [];
              let isError = false;
              try {
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
                const data = await helpers.request(awardsUrl, {
                  method: config.awards.method || 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  data: JSON.stringify(payload),
                  responseType: 'json',
                });
                const res = data?.result;
                const userAwards =
                  (res &&
                    typeof res === 'object' &&
                    (res[userId] || Object.values(res)[0])) ||
                  null;
                list = userAwards?.awards || [];
              } catch (e) {
                isError = true;
              }

              if (Array.isArray(list) && list.length) {
                list.forEach((a) => {
                  const linkEl = createEl('a', {
                    href: a.url || '#',
                    target: '_blank',
                  });
                  if (a.icon)
                    linkEl.append(
                      createEl('img', { src: a.icon, alt: a.title || '' }),
                    );
                  else linkEl.textContent = a.title || a.name || '';
                  content.append(linkEl);
                });
              } else {
                content.append(
                  createEl('div', {
                    text: isError
                      ? config.awards.errorText || config.errorText
                      : config.awards.emptyText,
                  }),
                );
              }

              tabs.append(tab);
              character.append(content);
              initTabs(character, tabParams);
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
