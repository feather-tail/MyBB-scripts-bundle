(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, createEl, getGroupId } = helpers;
  const config = helpers.getConfig('newMessagesLink', {});
  const allowedGroupIds = Array.isArray(config.allowedGroupIds)
    ? config.allowedGroupIds
    : [];
  const allowedGroups = new Set(allowedGroupIds.map(String));

  if (!allowedGroups.has(String(getGroupId()))) return;

  const url = config.url || '/search.php?action=show_new';
  const text = config.text || 'Новые сообщения';
  const itemClassName = config.itemClassName || 'item1';
  const listSelector = '#pun-ulinks .container';
  const styleId = 'ks-new-messages-link-preload-style';
  const root = document.documentElement;

  let observer = null;

  const addPreloadStyle = () => {
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html.ks-new-messages-link-pending #pun-ulinks .container {
        visibility: hidden;
      }
    `;

    (document.head || document.documentElement).append(style);
  };

  const setPending = () => {
    addPreloadStyle();
    root.classList.add('ks-new-messages-link-pending');
  };

  const setReady = () => {
    root.classList.remove('ks-new-messages-link-pending');
    root.classList.add('ks-new-messages-link-ready');

    const style = document.getElementById(styleId);
    if (style) style.remove();
  };

  const hasNewMessagesLink = (list) =>
    Array.from(list.querySelectorAll('a')).some((link) => {
      return (
        link.dataset.ksNewMessagesLink === 'true' ||
        link.getAttribute('href') === url
      );
    });

  const mount = () => {
    const list = $(listSelector);
    if (!list) return false;

    if (!hasNewMessagesLink(list)) {
      const li = createEl('li', { className: itemClassName });
      const a = createEl('a', { href: url, text });

      li.dataset.ksNewMessagesLink = 'true';
      a.dataset.ksNewMessagesLink = 'true';

      li.append(a);
      list.insertBefore(li, list.firstElementChild || list.firstChild);
    }

    setReady();

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    return true;
  };

  const init = () => mount();

  helpers.register('newMessagesLink', { init });

  setPending();

  if (mount()) return;

  observer = new MutationObserver(() => {
    mount();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!mount()) setReady();
      },
      { once: true },
    );
  } else {
    queueMicrotask(() => {
      if (!mount()) setReady();
    });
  }
})();
