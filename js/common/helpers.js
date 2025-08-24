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
  const once = (fn) => {
    let called = false;
    return function (...args) {
      if (called) return;
      called = true;
      return fn.apply(this, args);
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
  const parseHTML = (html) =>
    new DOMParser().parseFromString(html, 'text/html');
  const withTimeout = (p, ms) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Таймаут запроса')), ms),
      ),
    ]);
  const request = (url, opts = {}) => {
    const {
      method = 'GET',
      data = null,
      timeout = 0,
      headers = {},
      responseType,
      onProgress,
      signal,
    } = opts;
    if (typeof fetch === 'function' && !onProgress) {
      const ctrl = new AbortController();
      if (signal)
        try {
          signal.addEventListener('abort', () => ctrl.abort());
        } catch {}
      const p = fetch(url, {
        method,
        headers,
        body: data,
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      if (!timeout) return p;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          ctrl.abort();
          reject(new Error('Таймаут запроса'));
        }, timeout);
        p.then(resolve, reject).finally(() => clearTimeout(t));
      });
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.withCredentials = true;
      xhr.responseType = responseType || 'arraybuffer';
      Object.entries(headers || {}).forEach(([k, v]) =>
        xhr.setRequestHeader(k, v),
      );
      if (timeout) xhr.timeout = timeout;
      if (signal)
        try {
          signal.addEventListener('abort', () => xhr.abort());
        } catch {}
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.ceil((e.loaded / e.total) * 100), e);
        };
      }
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Таймаут запроса'));
      xhr.onabort = () => reject(new Error('Отменено'));
      xhr.onload = () => {
        const headersMap = {};
        xhr
          .getAllResponseHeaders()
          .trim()
          .split(/\r?\n/)
          .forEach((line) => {
            const i = line.indexOf(':');
            if (i > -1)
              headersMap[line.slice(0, i).trim().toLowerCase()] = line
                .slice(i + 1)
                .trim();
          });
        const buf = xhr.response || new ArrayBuffer(0);
        const resp = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            get: (k) => headersMap[String(k).toLowerCase()] || null,
          },
          arrayBuffer: () => Promise.resolve(buf),
          text: () => Promise.resolve(new TextDecoder().decode(buf)),
        };
        resp.json = () => resp.text().then((t) => JSON.parse(t));
        resolve(resp);
      };
      xhr.send(data);
    });
  };
  const ready = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };
  const runOnceOnReady = (fn) => ready(once(fn));
  const parseAccessMap = (obj = {}) => {
    const res = {};
    Object.keys(obj).forEach((k) => {
      res[k] = Array.isArray(obj[k]) ? obj[k].slice() : [];
    });
    return res;
  };
  const crc32 = (s) => {
    let c = ~0;
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i);
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    return (~c >>> 0).toString(16).padStart(8, '0');
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const formatBytes = (n) =>
    n >= 1048576
      ? (n / 1048576).toFixed(1) + ' MB'
      : n >= 1024
      ? ((n / 1024) | 0) + ' KB'
      : n + ' B';
  const getUserId = () => {
    if (typeof window.UserID === 'number' && window.UserID > 0)
      return window.UserID;
    if (typeof window.UserID === 'string' && /^\d+$/.test(window.UserID))
      return +window.UserID;
    const a = document.querySelector('a[href*="profile.php?id="]')?.href;
    const m = a && a.match(/[?&]id=(\d+)/);
    return m ? +m[1] : 0;
  };
  const getGroupId = () => {
    if (typeof window.GroupID === 'number' && window.GroupID > 0)
      return window.GroupID;
    if (typeof window.GroupID === 'string' && /^\d+$/.test(window.GroupID))
      return +window.GroupID;
    return 0;
  };
  const getUserInfo = () => ({
    id: getUserId(),
    name: (window.UserLogin || '').trim(),
    group: getGroupId(),
  });
  const buildForumUploadsURL = (filename) => {
    const board =
      typeof window.BoardID !== 'undefined' ? Number(window.BoardID) : 0;
    const hex = (board >>> 0).toString(16).padStart(8, '0');
    const userId = getUserId();
    if (userId > 0) {
      const parts = [
        hex.slice(0, 4),
        hex.slice(4, 6),
        hex.slice(6, 8),
        String(userId),
      ];
      return `https://upforme.ru/uploads/${parts.join('/')}/${filename}`;
    }
    return `${location.origin}/uploads/${filename}`;
  };
  const getConfig = (name, defaults = {}) => ({
    ...defaults,
    ...(window.ScriptConfig?.[name] || {}),
  });
  const showToast = (...args) => {
    if (typeof window.showToast === 'function')
      return window.showToast(...args);
    return window.scripts?.toast?.(...args);
  };
  const register = (name, api) => {
    window.scripts = window.scripts || {};
    window.scripts[name] = api;
    return window.scripts[name];
  };
  window.helpers = {
    $,
    $$,
    createEl,
    countGraphemes,
    debounce,
    once,
    copyToClipboard,
    setCookie,
    getCookie,
    parseHTML,
    withTimeout,
    request,
    ready,
    runOnceOnReady,
    crc32,
    parseAccessMap,
    uid,
    formatBytes,
    getUserId,
    getGroupId,
    getUserInfo,
    getConfig,
    buildForumUploadsURL,
    register,
    showToast,
  };
})();
