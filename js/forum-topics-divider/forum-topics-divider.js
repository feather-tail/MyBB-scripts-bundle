(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const CFG = window.ScriptConfig.forumTopicsDivider;

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const forumContainer = $(CFG.selectors.forum);
    if (!forumContainer) return;

    const stickyRows = $$(CFG.selectors.stickyRows, forumContainer);
    if (stickyRows.length > 0) {
      const firstStickyRow = stickyRows[0];
      const impRow = createEl('tr', { className: 'tr-divider imp' });
      impRow.appendChild(
        createEl('td', {
          className: 'td-divider',
          text: CFG.headers.important,
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
            text: CFG.headers.regular,
            colSpan: 4,
          }),
        );
        lastStickyRow.parentNode.insertBefore(
          topicsRow,
          nextRowAfterLastSticky,
        );
      }
    }

    $$(CFG.selectors.stickyLabel).forEach((labelEl) => labelEl.remove());
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
