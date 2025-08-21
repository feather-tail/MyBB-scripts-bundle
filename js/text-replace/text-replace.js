(() => {
  'use strict';

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const updateParentText = (
      elementSelector,
      searchValue,
      replacementValue,
    ) => {
      const parentElements = new Set();
      document.querySelectorAll(elementSelector).forEach((child) => {
        if (child.parentElement) {
          parentElements.add(child.parentElement);
        }
      });

      parentElements.forEach((parentEl) => {
        const walker = document.createTreeWalker(
          parentEl,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );
        let textNode;
        while ((textNode = walker.nextNode())) {
          const originalText = textNode.nodeValue;
          const newText = originalText.replace(searchValue, replacementValue);
          if (newText !== originalText) {
            textNode.nodeValue = newText;
          }
        }
      });
    };

    updateParentText('#navadmin', 'Администрирование', 'Амс');
    updateParentText('li.item1 span', 'Всего тем: ', 'Тем: ');
    updateParentText('li.item2 span', 'Всего сообщений: ', 'Сообщений: ');
    updateParentText(
      'li.item3 span',
      'Зарегистрированных пользователей: ',
      'Жителей: ',
    );
    updateParentText(
      'li.item4 span',
      'Последним зарегистрировался: ',
      'Приветствуем: ',
    );
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
