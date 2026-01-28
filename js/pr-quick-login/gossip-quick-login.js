(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, getGroupId } = helpers;
  const config = helpers.getConfig('gossipQuickLogin', {});

  const MARK = 'gossip=1';

  function isGuest() {
    return typeof getGroupId === 'function' ? getGroupId() === 3 : true;
  }

  function goToLogin() {
    let url = `/login.php?login=1&${MARK}`;
    const redirect = config.redirectUrl || '';
    if (redirect) url += `&redirect=${encodeURIComponent(redirect)}`;
    location.href = url;
  }

  function bindCreateGossipLink() {
    if (!isGuest()) return;

    const root = $(config.selectors.triggerRoot);
    if (!root) return;

    if (root.dataset.gossipQuickLoginBound === '1') return;
    root.dataset.gossipQuickLoginBound = '1';

    root.addEventListener('click', (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !root.contains(a)) return;

      const text = (a.textContent || '').trim().toLowerCase();
      if (text !== 'создать сплетню') return;

      e.preventDefault();
      e.stopPropagation();

      goToLogin();
    });
  }

  function autoGossipLogin() {
    if (!location.pathname.endsWith('/login.php')) return;
    if (!location.search.includes(MARK)) return;

    const form = $(config.selectors.form) || $('form');
    if (!form) return;

    const u = $(config.selectors.userInput, form);
    const p = $(config.selectors.passInput, form);
    if (!u || !p) return;

    u.value = config.login || '';
    p.value = config.pass || '';

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = $(config.selectors.redirectField, form);
    if (redirectField && redirectUrl) redirectField.value = redirectUrl;

    form.submit();
  }

  function init() {
    if (location.pathname.endsWith('/login.php')) autoGossipLogin();
    else bindCreateGossipLink();
  }

  helpers.runOnceOnReady(init);
  helpers.register('gossipQuickLogin', { init });
})();
