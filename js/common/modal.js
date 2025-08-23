(() => {
  'use strict';
  const { createEl } = window.helpers;

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

    overlay.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);

    const focusEl = overlay.querySelector(FOCUSABLE_SEL);
    focusEl?.focus();

    return { close, overlay, content: node };
  }

  window.helpers.modal = { openModal };
})();
