(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, getGroupId } = helpers;
  const config = helpers.getConfig('gossipQuickLogin', {});

  function bindCreateGossipLink() {
    if (getGroupId && getGroupId() !== 3) return;

    const link = $(config.selectors.triggerLink);
    if (!link) return;
    if (link.dataset.gossipQuickLoginBound === '1') return;
    link.dataset.gossipQuickLoginBound = '1';

    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let url = '/login.php?login=1&gossip=1';
      if (config.redirectUrl) {
        url += '&redirect=' + encodeURIComponent(config.redirectUrl);
      }
      location.href = url;
    });
  }

  function autoGossipLogin() {
    if (!location.pathname.endsWith('/login.php')) return;
    if (!location.search.includes('gossip=1')) return;

    const form = $(config.selectors.form);
    if (!form) return;

    const u = $(config.selectors.userInput, form);
    const p = $(config.selectors.passInput, form);
    const s = $(config.selectors.submitInput, form);

    if (!u || !p || !s) return;

    u.value = config.login || '';
    p.value = config.pass || '';

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = $(config.selectors.redirectField, form);
    if (redirectField && redirectUrl) redirectField.value = redirectUrl;

    s.click();
  }

  function init() {
    if (location.pathname.endsWith('/login.php')) autoGossipLogin();
    else bindCreateGossipLink();
  }

  helpers.runOnceOnReady(init);
  helpers.register('gossipQuickLogin', { init });
})();
