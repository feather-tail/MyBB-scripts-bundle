(function () {
  const PR_SETTINGS = {
    login: 'Реклама',
    pass: '1111',
  };
  const PR_BTN_ID = 'pr-quick-login';
  const NAV_LOGIN_ID = '#navlogin';
  const FORM_SELECTOR = 'form[action*="login"]';
  const USER_INPUT = 'input[name="req_username"]';
  const PASS_INPUT = 'input[name="req_password"]';
  const SUBMIT_INPUT = 'input[type="submit"]';

  const PR_REDIRECT_URL = 'LINK_FOR_REDIRECT';

  function addPrButton() {
    if (typeof window.GroupID !== 'number' || window.GroupID !== 3) return;
    if (document.getElementById(PR_BTN_ID)) return;
    const loginLi = document.querySelector(NAV_LOGIN_ID);
    if (!loginLi) return;
    const btn = document.createElement('li');
    btn.id = PR_BTN_ID;
    btn.innerHTML = '<a href="javascript:void 0;">PR-вход</a>';
    btn.addEventListener('click', () => {
      let url = '/login.php?login=1&pr=1';
      if (PR_REDIRECT_URL) {
        url += '&redirect=' + encodeURIComponent(PR_REDIRECT_URL);
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
    const form = document.querySelector(FORM_SELECTOR);
    if (!form) return;

    form.querySelector(USER_INPUT).value = PR_SETTINGS.login;
    form.querySelector(PASS_INPUT).value = PR_SETTINGS.pass;

    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect');
    const redirectField = form.querySelector('input[name="redirect_url"]');
    if (redirectField) {
      if (redirectUrl) {
        redirectField.value = redirectUrl;
      }
    }
    form.querySelector(SUBMIT_INPUT).click();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  if (location.pathname.endsWith('/login.php')) {
    onReady(autoPrLogin);
  } else {
    onReady(addPrButton);
  }
})();
