(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl } = helpers;

  const FOCUSABLE_SEL =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function openModal(content, { className = '', onClose } = {}) {
    const overlay = createEl('div', {
      className: 'modal-overlay' + (className ? ' ' + className : ''),
    });
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
    const node =
      typeof content === 'string'
        ? createEl('div', { html: content })
        : content;
    overlay.appendChild(node);
    document.body.appendChild(overlay);
    const closeBtn = createEl('button', {
      className: 'modal-close',
      'aria-label': 'Закрыть',
      text: '×',
    });
    node.appendChild(closeBtn);
    if (getComputedStyle(node).position === 'static') {
      node.style.position = 'relative';
    }
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function trapFocus(e) {
      if (e.key !== 'Tab') return;
      const focusable = overlay.querySelectorAll(FOCUSABLE_SEL);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else {
        trapFocus(e);
      }
    }

    function onClick(e) {
      if (e.target === overlay) close();
    }

    function close() {
      document.removeEventListener('keydown', onKey, true);
      overlay.removeEventListener('click', onClick, true);
      overlay.remove();
      document.body.style.overflow = prevOverflow;
      if (prevFocus) prevFocus.focus();
      if (typeof onClose === 'function') onClose();
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);

    const focusEl = overlay.querySelector(FOCUSABLE_SEL);
    focusEl?.focus();

    return { close, overlay, content: node };
  }

  function dialog(message, opts = {}) {
    const {
      prompt = false,
      placeholder = '',
      defaultValue = '',
      okText = 'OK',
      cancelText = 'Отмена',
    } = opts;

    return new Promise((resolve) => {
      const box = createEl('div', {
        className: 'modal-dialog',
        style: 'background:#fff;padding:20px;max-width:90%;',
      });
      box.appendChild(createEl('p', { text: message }));

      let input;
      if (prompt) {
        input = createEl('input', {
          type: 'text',
          value: defaultValue,
          placeholder,
          style: 'margin-top:10px;',
        });
        box.appendChild(input);
      }

      const actions = createEl('div', {
        className: 'modal-actions',
        style: 'margin-top:15px;text-align:right;',
      });
      const btnCancel = createEl('button', {
        type: 'button',
        text: cancelText,
      });
      const btnOk = createEl('button', {
        type: 'button',
        text: okText,
      });
      actions.append(btnCancel, btnOk);
      box.appendChild(actions);

      const { close } = openModal(box, {
        onClose: () => resolve(prompt ? null : false),
      });
      btnCancel.addEventListener('click', () => {
        resolve(prompt ? null : false);
        close();
      });
      btnOk.addEventListener('click', () => {
        resolve(prompt ? input.value : true);
        close();
      });

      (prompt ? input : btnOk).focus();
    });
  }

  window.helpers.dialog = dialog;
  window.helpers.modal = { openModal, dialog };
})();
