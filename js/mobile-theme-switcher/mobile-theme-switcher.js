(() => {
  'use strict';

  function bootstrap() {
    const helpers = window.helpers;
    if (!helpers) {
      setTimeout(bootstrap, 25);
      return;
    }

    const { $$ } = helpers;
    const config = helpers.getConfig('mobileThemeSwitcher', {
      themes: [],
      storageKey: 'selectedMobileTheme',
      insertAfterSelector: '#pun-crumbs2',
      settingsMenuSection: 'mobileThemes',
      containerId: 'mobile_theme_switcher',
      cookieName: null,
      cookiePath: '/',
      cookieDays: 365,
    });

    const themeClasses = [
      ...new Set(
        (config.themes || [])
          .map((t) => (t?.className || '').trim().split(/\s+/))
          .flat()
          .filter(Boolean),
      ),
    ];

    let currentThemeValue;
    let switcherCounter = 0;
    const switchers = new Map();

    function getThemeValue(theme) {
      if (!theme) return '';
      return (
        theme.value ??
        theme.className ??
        (typeof theme.title === 'string' ? theme.title : '')
      );
    }

    function findTheme(value) {
      return (
        (config.themes || []).find((t) => getThemeValue(t) === value) || null
      );
    }

    function dispatchThemeChange(value, theme) {
      document.dispatchEvent(
        new CustomEvent('mobilethemechange', {
          detail: { value, theme },
        }),
      );
    }

    document.addEventListener('mobilethemechange', (e) => {
      const value = e?.detail?.value;
      switchers.forEach((prefix, container) => {
        $$(`input[name='${prefix}']`, container).forEach((input) => {
          input.checked = input.value === value;
        });
      });
    });

    function applyTheme(value) {
      const theme = findTheme(value);
      if (!theme || value === currentThemeValue) return;

      if (themeClasses.length) {
        document.documentElement.classList.remove(...themeClasses);
      }

      if (theme.className) {
        theme.className
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .forEach((cls) => document.documentElement.classList.add(cls));
      }

      if (config.cookieName && typeof helpers.setCookie === 'function') {
        helpers.setCookie(
          config.cookieName,
          theme.cookieValue ?? value,
          config.cookieDays ?? 365,
          config.cookiePath ?? '/',
        );
      }

      currentThemeValue = value;

      try {
        localStorage.setItem(config.storageKey, value);
      } catch (_) {}

      dispatchThemeChange(value, theme);
    }

    function renderThemeSwitcher(container, prefix) {
      if (!container) return null;
      container.textContent = '';
      const fragment = document.createDocumentFragment();
      const uniquePrefix = prefix || container?.id || `mts${switcherCounter++}`;

      (config.themes || []).forEach((theme) => {
        const value = getThemeValue(theme);
        if (!value) return;

        const li = document.createElement('li');
        if (theme.title) li.title = theme.title;

        const span = document.createElement('span');
        span.className = 'radio';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = uniquePrefix;
        const safeValue = value.replace(/[^\w-]/g, '_');
        const id = `${uniquePrefix}-theme-${safeValue}`;
        input.id = id;
        input.value = value;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = theme.title || value;

        span.append(input, label);
        li.append(span);
        fragment.appendChild(li);
      });

      container.appendChild(fragment);
      return uniquePrefix;
    }

    function getSavedThemeValue() {
      let saved = null;
      try {
        saved = localStorage.getItem(config.storageKey);
      } catch (_) {}

      if (
        (!saved || !findTheme(saved)) &&
        config.cookieName &&
        typeof helpers.getCookie === 'function'
      ) {
        saved = helpers.getCookie(config.cookieName);
      }

      const fallback = config.themes?.[0]
        ? getThemeValue(config.themes[0])
        : null;

      if (!saved) return fallback;
      return findTheme(saved) ? saved : fallback;
    }

    function restoreTheme(container, prefix) {
      if (!config.themes?.length) return;
      const uniquePrefix = prefix || container?.id;
      const themeValue = getSavedThemeValue();
      if (themeValue) applyTheme(themeValue);
      if (uniquePrefix) {
        $$(`input[name='${uniquePrefix}']`, container).forEach((input) => {
          input.checked = input.value === themeValue;
        });
      }
    }

    function bindSwitcher(container, uniquePrefix) {
      if (!container || container.dataset.mobileThemeBound) return;
      container.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || target.name !== uniquePrefix) return;
        if (target.value === currentThemeValue) return;
        applyTheme(target.value);
      });
      container.dataset.mobileThemeBound = '1';
    }

    function initSection(container) {
      if (!config.themes?.length || !container) return;
      const prefix = renderThemeSwitcher(container, container.id);
      restoreTheme(container, prefix);
      if (prefix) {
        switchers.set(container, prefix);
        bindSwitcher(container, prefix);
      }
    }

    function init(container) {
      if (!config.themes?.length) return;

      const saved = getSavedThemeValue();
      if (saved) applyTheme(saved);

      if (container instanceof HTMLElement) {
        initSection(container);
        return;
      }

      const smCfg = helpers.getConfig('settingsMenu', {});
      if (
        config.settingsMenuSection &&
        smCfg?.sections?.[config.settingsMenuSection]?.mount !== undefined
      ) {
        return;
      }

      const id = config.containerId || 'mobile_theme_switcher';
      let targetContainer = id ? document.getElementById(id) : null;

      if (!targetContainer) {
        targetContainer = document.createElement('ul');
        if (id) targetContainer.id = id;

        const target = document.querySelector(config.insertAfterSelector);
        if (target) {
          target.insertAdjacentElement('afterend', targetContainer);
        } else {
          document.body.appendChild(targetContainer);
        }
      }

      initSection(targetContainer);
    }

    if (helpers.runOnceOnReady) {
      helpers.runOnceOnReady(init);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      init();
    }

    if (helpers.register) {
      helpers.register('mobileThemeSwitcher', { init, initSection });
    }
  }

  bootstrap();
})();
