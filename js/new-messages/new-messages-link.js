(() => {
  'use strict';

  if (GroupID !== 3) {
    const list = document.querySelector('#pun-ulinks .container');
    if (list) {
      const li = document.createElement('li');
      li.className = 'item1';
      const a = document.createElement('a');
      a.href = '/search.php?action=show_new';
      a.textContent = 'Новые сообщения';
      li.appendChild(a);
      list.insertBefore(li, list.firstChild);
    }
  }
})();
