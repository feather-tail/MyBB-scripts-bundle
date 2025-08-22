(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const createEl = (tag, props = {}) => {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v);
    });
    return el;
  };
  const countGraphemes = (str) => {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter().segment(str)).length;
    }
    return Array.from(str).length;
  };
  const debounce = (fn, wait) => {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };
  const copyToClipboard = async (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {}
    }
    const ta = createEl('textarea', { value: text });
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (e) {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  };
  const setCookie = (name, value, days = 365, path = '/') => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(
      value,
    )}; expires=${expires}; path=${path}`;
  };
  const getCookie = (name) => {
    const m = document.cookie.match(
      '(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)',
    );
    return m ? decodeURIComponent(m[1]) : null;
  };
  window.helpers = {
    $,
    $$,
    createEl,
    countGraphemes,
    debounce,
    copyToClipboard,
    setCookie,
    getCookie,
  };
})();
