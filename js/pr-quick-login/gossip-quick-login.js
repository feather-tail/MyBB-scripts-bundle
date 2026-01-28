(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, getGroupId } = helpers;
  const config = helpers.getConfig('gossipQuickLogin', {});

  function patchGossipLink() {
    const a = $(config.selectors.triggerLink);
    if (!a) return;

    if (a.dataset.gossipQuickLogin === '1') return;
    a.dataset.gossipQuickLogin = '1';

    let url = '/login.php?login=1&gossip=1';
    if (config.redirectUrl) {
      url += '&redirect=' + encodeURIComponent(config.redirectUrl);
    }

    a.setAttribute('href', url);
  }

  function autoGossipLogin() {
    if (
      !location.pathname.endsWith('/login.php') ||
      !location.search.includes('gossip=1')
    )
      return;

    const form = $(config.selectors.form);
    if (!form) return;

    const u = $(config.selectors.userInput, form);
    const p = $(config.selectors.passInput, form);
    if (!u || !p) return;

    u.value = config.login;
    p.value = config.pass;

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = $(config.selectors.redirectField, form);
    if (redirectField && redirectUrl) {
      redirectField.value = redirectUrl;
    }

    const submit = $(config.selectors.submitInput, form);
    if (submit) submit.click();
  }

  function init() {
    if (location.pathname.endsWith('/login.php')) {
      autoGossipLogin();
    } else {
      patchGossipLink();
    }
  }

  helpers.runOnceOnReady(init);
  helpers.register('gossipQuickLogin', { init });
})();
