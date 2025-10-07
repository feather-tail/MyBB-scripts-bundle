(() => {
  'use strict';

  const STORAGE_KEY = 'forceMobile.enabled';
  const URL_PARAM = 'view';

  const root = document.documentElement;
  const box = document.getElementById('forceMobileToggle');

  const save = (on) => {
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {}
  };
  const load = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  };

  const set = (on, silent = false) => {
    root.classList.toggle('force-mobile', on);
    save(on);
    box && (box.checked = on);
    if (!silent)
      document.dispatchEvent(
        new CustomEvent('forcemobilechange', { detail: { enabled: on } }),
      );
  };

  set(load(), true);

  const v = new URLSearchParams(location.search).get(URL_PARAM)?.toLowerCase();
  if (v === 'mobile') set(true);
  else if (v === 'reset') set(false);

  box?.addEventListener('change', () => set(box.checked));

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) set(e.newValue === '1');
  });
})();
