(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('forumTopicsDivider', {});

  function init() {
    const forumContainer = $(config.selectors.forum);
    if (!forumContainer) return;

    const stickyRows = $$(config.selectors.stickyRows, forumContainer);
    if (stickyRows.length > 0) {
      const firstStickyRow = stickyRows[0];
      const impRow = createEl('tr', { className: 'tr-divider imp' });
      impRow.appendChild(
        createEl('td', {
          className: 'td-divider',
          text: config.headers.important,
          colSpan: 4,
        }),
      );
      firstStickyRow.parentNode.insertBefore(impRow, firstStickyRow);

      const lastStickyRow = stickyRows[stickyRows.length - 1];
      const nextRowAfterLastSticky = lastStickyRow.nextElementSibling;
      if (nextRowAfterLastSticky) {
        const topicsRow = createEl('tr', { className: 'tr-divider st' });
        topicsRow.appendChild(
          createEl('td', {
            className: 'td-divider',
            text: config.headers.regular,
            colSpan: 4,
          }),
        );
        lastStickyRow.parentNode.insertBefore(
          topicsRow,
          nextRowAfterLastSticky,
        );
      }
    }

    $$(config.selectors.stickyLabel).forEach((labelEl) => labelEl.remove());
  }

  helpers.runOnceOnReady(init);
  helpers.register('forumTopicsDivider', { init });
})();
