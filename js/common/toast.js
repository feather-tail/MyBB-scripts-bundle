(() => {
  'use strict';
  const helpers = window.helpers;
  const ensureRoot = () => {
    let root = document.querySelector('.toast-root');
    if (root) return root;
    root = document.createElement('div');
    root.className = 'toast-root';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    document.body.appendChild(root);
    return root;
  };

  function showToast(
    message,
    { type = 'info', actions = [], duration = 3000 } = {},
  ) {
    let promise;
    const root = ensureRoot();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    if (actions && actions.length) el.classList.add('toast--action');
    const content = document.createElement('div');
    content.className = 'toast__content';
    content.textContent = message;
    el.appendChild(content);
    let resolve;
    const cleanup = () => {
      if (el.isConnected) el.remove();
    };
    if (actions && actions.length) {
      const wrap = document.createElement('div');
      wrap.className = 'toast__actions';
      actions.forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'toast__btn' + (a.variant ? ` toast__btn--${a.variant}` : '');
        btn.textContent = a.label;
        btn.addEventListener('click', () => {
          cleanup();
          resolve(a.value);
        });
        wrap.appendChild(btn);
      });
      el.appendChild(wrap);
      if (duration > 0) {
        setTimeout(() => {
          cleanup();
          resolve(null);
        }, duration);
      }
      promise = new Promise((r) => (resolve = r));
    } else if (duration > 0) {
      setTimeout(cleanup, duration);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', 'Закрыть');
    close.textContent = '\u00D7';
    close.addEventListener('click', () => {
      cleanup();
      resolve && resolve(null);
    });
    el.appendChild(close);
    root.appendChild(el);
    return promise || Promise.resolve();
  }

  helpers.register('toast', showToast);
  helpers.showToast = (...args) => showToast(...args);
})();
