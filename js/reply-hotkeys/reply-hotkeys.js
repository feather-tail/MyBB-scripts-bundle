(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl } = helpers;
  const config = helpers.getConfig('replyHotkeys', {});
  const HOTKEYS = new Map(config.HOTKEYS);

  const insertTrigger = (afterEl, beforeEl) => {
    const btn = createEl('button', {
      type: 'button',
      className: 'hotkeys-trigger',
      text: config.texts.trigger,
    });

    if (afterEl && afterEl.parentNode) {
      afterEl.parentNode.insertBefore(btn, afterEl.nextSibling);
    } else if (beforeEl && beforeEl.parentNode) {
      beforeEl.parentNode.insertBefore(btn, beforeEl);
    } else {
      return null;
    }

    return btn;
  };

  function init() {
    const textarea = $(config.selectors.textarea);
    const before = $(config.selectors.defaultBefore);
    const after =
      config.selectors.insertAfter && $(config.selectors.insertAfter);
    if (!textarea || !before) return;

    const btn = insertTrigger(after, before);
    if (!btn) return;

    const modalBox = createEl('div', {
      className: 'hotkeys-modal hk-box',
      role: 'dialog',
      'aria-modal': 'true',
      tabIndex: -1,
    });
    const h3 = createEl('h3', { text: config.texts.title });
    const ul = createEl('ul');
    modalBox.append(h3, ul);

    HOTKEYS.forEach(([, , text], combo) => {
      const li = createEl('li');
      const b = createEl('b', { text: combo.replace('Key', '') });
      li.append(b, document.createTextNode(' — ' + text));
      ul.appendChild(li);
    });

    const insertBB = (o, c) => {
      if (!o && !c) {
        $(config.selectors.submit)?.click();
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

    btn.addEventListener('click', show);

    document.addEventListener('keydown', (e) => {
      if (!api && (e.ctrlKey || e.metaKey) && e.code === 'Slash') {
        show();
        e.preventDefault();
      }
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('replyHotkeys', { init });
})();
