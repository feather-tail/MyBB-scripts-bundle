(() => {
  'use strict';
  const { $, createEl } = window.helpers;
  const CFG = window.ScriptConfig.replyHotkeys;
  const HOTKEYS = new Map(CFG.HOTKEYS);

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    const textarea = $(CFG.selectors.textarea);
    const fallbackAnchor = $(CFG.selectors.fallback);
    if (!textarea || !fallbackAnchor) return;

    const btn = createEl('button', {
      type: 'button',
      className: 'hotkeys-trigger',
      text: CFG.texts.trigger,
    });
    const anchor =
      (CFG.selectors.placeAfter && $(CFG.selectors.placeAfter)) ||
      fallbackAnchor;
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);

    const modalBox = createEl('div', {
      className: 'hotkeys-modal hk-box',
      role: 'dialog',
      'aria-modal': 'true',
      tabIndex: -1,
    });
    const close = createEl('button', {
      className: 'hk-close',
      title: CFG.texts.close,
      text: '×',
    });
    const h3 = createEl('h3', { text: CFG.texts.title });
    const ul = createEl('ul');
    modalBox.append(close, h3, ul);

    HOTKEYS.forEach(([, , text], combo) => {
      const li = createEl('li');
      const b = createEl('b', { text: combo.replace('Key', '') });
      li.append(b, document.createTextNode(' — ' + text));
      ul.appendChild(li);
    });

    const insertBB = (o, c) => {
      if (!o && !c) {
        $(CFG.selectors.submit)?.click();
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

    let api = null;
    const show = () => {
      api = window.helpers.modal.openModal(modalBox, {
        onClose: () => {
          api = null;
          btn.focus();
        },
      });
      modalBox.focus();
    };
    const hide = () => api?.close();

    btn.addEventListener('click', show);
    close.addEventListener('click', hide);

    document.addEventListener('keydown', (e) => {
      if (!api && (e.ctrlKey || e.metaKey) && e.code === 'Slash') {
        show();
        e.preventDefault();
      }
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
