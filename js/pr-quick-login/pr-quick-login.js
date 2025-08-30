(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, getGroupId } = helpers;
  const config = helpers.getConfig('prQuickLogin', {});

  function addPrButton() {
    if (getGroupId() !== 3) return;
    if ($(config.selectors.btn)) return;
    const loginLi = $(config.selectors.navLogin);
    if (!loginLi) return;
    const btn = createEl('li', {
      id: config.selectors.btn.replace(/^#/, ''),
      html: '<a href="javascript:void 0;">PR-вход</a>',
    });
    btn.addEventListener('click', () => {
      let url = '/login.php?login=1&pr=1';
      if (config.redirectUrl) {
        url += '&redirect=' + encodeURIComponent(config.redirectUrl);
      }
      location.href = url;
    });
    loginLi.after(btn);
  }

  function autoPrLogin() {
    if (
      !location.pathname.endsWith('/login.php') ||
      !location.search.includes('pr=1')
    )
      return;
    const form = $(config.selectors.form);
    if (!form) return;

    $(config.selectors.userInput, form).value = config.login;
    $(config.selectors.passInput, form).value = config.pass;

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = $(config.selectors.redirectField, form);
    if (redirectField && redirectUrl) {
      redirectField.value = redirectUrl;
    }
    $(config.selectors.submitInput, form).click();
  }

  function init() {
    if (location.pathname.endsWith('/login.php')) {
      autoPrLogin();
    } else {
      addPrButton();
    }
  }

  helpers.runOnceOnReady(init);
  helpers.register('prQuickLogin', { init });
})();
