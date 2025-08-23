(() => {
  'use strict';
  const { $, createEl } = window.helpers;
  const CFG = window.ScriptConfig.prQuickLogin;

  function addPrButton() {
    if (typeof window.GroupID !== 'number' || window.GroupID !== 3) return;
    if ($(CFG.selectors.btn)) return;
    const loginLi = $(CFG.selectors.navLogin);
    if (!loginLi) return;
    const btn = createEl('li', {
      id: CFG.selectors.btn.replace(/^#/, ''),
      html: '<a href="javascript:void 0;">PR-вход</a>',
    });
    btn.addEventListener('click', () => {
      let url = '/login.php?login=1&pr=1';
      if (CFG.redirectUrl) {
        url += '&redirect=' + encodeURIComponent(CFG.redirectUrl);
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
    const form = $(CFG.selectors.form);
    if (!form) return;

    $(CFG.selectors.userInput, form).value = CFG.login;
    $(CFG.selectors.passInput, form).value = CFG.pass;

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = $(CFG.selectors.redirectField, form);
    if (redirectField && redirectUrl) {
      redirectField.value = redirectUrl;
    }
    $(CFG.selectors.submitInput, form).click();
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    if (location.pathname.endsWith('/login.php')) {
      autoPrLogin();
    } else {
      addPrButton();
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
