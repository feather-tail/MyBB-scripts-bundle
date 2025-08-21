(() => {
  'use strict';

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const forumContainer = document.getElementById('pun-viewforum');
    if (!forumContainer) return;

    const stickyRows = Array.from(
      forumContainer.querySelectorAll('tr[class$="isticky"]'),
    );
    if (stickyRows.length > 0) {
      const firstStickyRow = stickyRows[0];
      firstStickyRow.insertAdjacentHTML(
        'beforebegin',
        '<tr class="tr-divider imp"><td class="td-divider" colspan="4">Важные темы</td></tr>',
      );

      const lastStickyRow = stickyRows[stickyRows.length - 1];
      const nextRowAfterLastSticky = lastStickyRow.nextElementSibling;
      if (nextRowAfterLastSticky) {
        nextRowAfterLastSticky.insertAdjacentHTML(
          'beforebegin',
          '<tr class="tr-divider st"><td class="td-divider" colspan="4">Темы форума</td></tr>',
        );
      }
    }

    document
      .querySelectorAll('.stickytext')
      .forEach((labelEl) => labelEl.remove());
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
