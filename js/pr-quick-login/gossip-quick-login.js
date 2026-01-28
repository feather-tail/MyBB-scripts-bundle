(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, createEl } = helpers;
  const config = helpers.getConfig('gossipQuickLogin', {});

  function loginToGossip() {
    const action = config.loginUrl || 'login.php?action=in';

    const form = createEl('form', { method: 'post', action });

    form.append(
      createEl('input', {
        type: 'hidden',
        name: config.formFields.formSent,
        value: '1',
      }),
      createEl('input', {
        type: 'hidden',
        name: config.formFields.redirectUrl,
        value: config.redirectUrl || '',
      }),
      createEl('input', {
        type: 'hidden',
        name: config.formFields.username,
        value: config.login || '',
      }),
      createEl('input', {
        type: 'hidden',
        name: config.formFields.password,
        value: config.pass || '',
      }),
    );

    document.body.appendChild(form);
    form.submit();
  }

  function bind() {
    const a = $(config.selectors.triggerLink);
    if (!a) return;

    if (a.dataset.gossipQuickLoginBound === '1') return;
    a.dataset.gossipQuickLoginBound = '1';

    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      loginToGossip();
    });
  }

  helpers.runOnceOnReady(bind);
  helpers.register('gossipQuickLogin', { init: bind });
})();
