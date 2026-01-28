(() => {
  'use strict';

  const helpers = window.helpers;
  if (!helpers) return;

  const { $, $$, createEl } = helpers;

  const DEFAULTS = {
    login: 'Gossip',
    pass: '1111',
    redirectUrl: 'https://kindredspirits.ru/viewtopic.php?id=515',
    loginUrl: '/login.php?action=in',
    formFields: {
      formSent: 'form_sent',
      redirectUrl: 'redirect_url',
      username: 'req_username',
      password: 'req_password',
    },
    selectors: {
      container: '#forum_f30 .pf-lnks',
    },
    ui: {
      buttonId: 'ks-gossip-create-btn',
      text: 'Создать сплетню',
      hideOriginalLinks: true,
    },
  };

  function getCfg() {
    const c = helpers.getConfig('gossipQuickLogin', {}) || {};
    return {
      ...DEFAULTS,
      ...c,
      formFields: { ...DEFAULTS.formFields, ...(c.formFields || {}) },
      selectors: { ...DEFAULTS.selectors, ...(c.selectors || {}) },
      ui: { ...DEFAULTS.ui, ...(c.ui || {}) },
    };
  }

  function loginAsGossip() {
    const cfg = getCfg();

    const form = createEl('form');
    form.method = 'post';
    form.action = cfg.loginUrl;

    form.append(
      createEl('input', {
        type: 'hidden',
        name: cfg.formFields.formSent,
        value: '1',
      }),
      createEl('input', {
        type: 'hidden',
        name: cfg.formFields.redirectUrl,
        value: cfg.redirectUrl || '',
      }),
      createEl('input', {
        type: 'hidden',
        name: cfg.formFields.username,
        value: cfg.login || '',
      }),
      createEl('input', {
        type: 'hidden',
        name: cfg.formFields.password,
        value: cfg.pass || '',
      }),
    );

    document.body.appendChild(form);
    form.submit();
  }

  function mountButton() {
    const cfg = getCfg();
    const box = $(cfg.selectors.container);
    if (!box) return;

    if (cfg.ui.hideOriginalLinks) {
      $$('.pf-lnks a', box).forEach((a) => (a.style.display = 'none'));
    }

    if ($('#' + cfg.ui.buttonId, box)) return;

    const btn = createEl('a', {
      id: cfg.ui.buttonId,
      href: '#',
      text: cfg.ui.text,
    });

    btn.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        loginAsGossip();
      },
      true,
    );

    box.appendChild(btn);
  }

  helpers.runOnceOnReady(mountButton);
  helpers.register('gossipQuickLogin', { init: mountButton });
})();
