(() => {
  'use strict';

  const PLACE_AFTER = '';
  const FALLBACK = '.formsubmit';
  const BBC_END_CODE = '[/' + 'code]';
  const HOTKEYS = new Map([
    ['Ctrl+KeyB', ['[b]', '[/b]', 'жирный']],
    ['Ctrl+KeyI', ['[i]', '[/i]', 'курсив']],
    ['Ctrl+KeyU', ['[u]', '[/u]', 'подчёркнутый']],
    ['Ctrl+KeyS', ['[s]', '[/s]', 'зачёркнутый']],
    ['Ctrl+KeyL', ['[align=left]', '[/align]', 'выравнивание влево']],
    ['Ctrl+KeyR', ['[align=right]', '[/align]', 'выравнивание вправо']],
    ['Ctrl+KeyE', ['[align=center]', '[/align]', 'выравнивание по центру']],
    ['Ctrl+KeyK', ['[url=https://]', '[/url]', 'ссылка']],
    ['Ctrl+KeyG', ['[spoiler="…"]', '[/spoiler]', 'спойлер']],
    ['Ctrl+KeyH', ['[hide=999999]', '[/hide]', 'скрытый текст']],
    ['Alt+KeyV', ['[video]', '[/video]', 'видео']],
    ['Ctrl+KeyQ', ['[quote]', '[/quote]', 'цитата']],
    ['Ctrl+BracketLeft', ['[code]', BBC_END_CODE, 'код']],
    ['Alt+KeyC', ['[color=maroon]', '[/color]', 'цвет']],
    ['Alt+KeyT', ['[table][tr][td]', '[/td][/tr][/table]', 'таблица']],
    ['Ctrl+Shift+KeyD', ['[add]', '', 'добавлено спустя']],
    ['Ctrl+Shift+KeyA', ['[abbr="…"]', '[/abbr]', 'поясняющий текст']],
    ['Ctrl+Shift+KeyM', ['[mark]', '[/mark]', 'маркированный текст']],
    ['Alt+KeyH', ['[hr]', '', 'горизонтальная линия']],
    ['Ctrl+Enter', [null, null, 'отправить сообщение']],
  ]);

  document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('main-reply');
    const fallbackAnchor = document.querySelector(FALLBACK);
    if (!textarea || !fallbackAnchor) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotkeys-trigger';
    btn.textContent = '?';
    const anchor =
      (PLACE_AFTER && document.querySelector(PLACE_AFTER)) || fallbackAnchor;
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);

    const modal = document.createElement('div');
    modal.className = 'hotkeys-modal';
    modal.hidden = true;

    const box = document.createElement('div');
    box.className = 'hk-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.tabIndex = -1;

    const close = document.createElement('button');
    close.className = 'hk-close';
    close.title = 'Esc';
    close.textContent = '\u00D7';

    const h3 = document.createElement('h3');
    h3.textContent = 'Горячие клавиши';

    const ul = document.createElement('ul');

    box.append(close, h3, ul);
    modal.appendChild(box);
    document.body.appendChild(modal);

    HOTKEYS.forEach(([, , text], combo) => {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = combo.replace('Key', '');
      li.append(b, document.createTextNode(' — ' + text));
      ul.appendChild(li);
    });

    const insertBB = (o, c) => {
      if (!o && !c) {
        document.querySelector('.submit')?.click();
        return;
      }
      const { value, selectionStart: s, selectionEnd: e } = textarea;
      textarea.value =
        value.slice(0, s) + o + value.slice(s, e) + c + value.slice(e);
      textarea.setSelectionRange(s + o.length, s + o.length + (e - s));
      textarea.focus();
    };

    const comboFromEvent = (e) => {
      const p = [];
      if (e.ctrlKey || e.metaKey) p.push('Ctrl');
      if (e.altKey) p.push('Alt');
      if (e.shiftKey) p.push('Shift');
      p.push(e.code);
      return p.join('+');
    };

    textarea.addEventListener('keydown', (e) => {
      const combo = comboFromEvent(e);
      const map = HOTKEYS.get(combo);
      if (map) {
        e.preventDefault();
        insertBB(map[0], map[1]);
      }
    });

    const show = () => {
      modal.hidden = false;
      box.focus();
    };
    const hide = () => {
      modal.hidden = true;
    };

    btn.addEventListener('click', show);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('hk-close')) hide();
    });

    document.addEventListener('keydown', (e) => {
      if (!modal.hidden && e.key === 'Escape') hide();
      if ((e.ctrlKey || e.metaKey) && e.code === 'Slash') {
        show();
        e.preventDefault();
      }
    });
  });
})();
