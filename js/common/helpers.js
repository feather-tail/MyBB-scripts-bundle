(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sanitizeHTML = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('script').forEach((n) => n.remove());
    tpl.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      });
    });
    return tpl.innerHTML;
  };
  const createEl = (tag, props = {}) => {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = sanitizeHTML(v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
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
      referrer,
      retries = 0,
    } = opts;

    const doFetch = () => {
      const ctrl = new AbortController();
      if (signal)
        try {
          signal.addEventListener('abort', () => ctrl.abort());
        } catch {}
      const fopts = {
        method,
        headers,
        body: data,
        credentials: 'same-origin',
        signal: ctrl.signal,
      };
      if (referrer) fopts.referrer = referrer;
      let p = fetch(url, fopts);
      if (timeout)
        p = new Promise((resolve, reject) => {
          const t = setTimeout(() => {
            ctrl.abort();
            reject(new Error('Таймаут запроса'));
          }, timeout);
          p.then(resolve, reject).finally(() => clearTimeout(t));
        });
      if (responseType === 'json') return p.then((r) => r.json());
      return p;
    };

    const doXhr = () =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.withCredentials = true;
        xhr.responseType =
          responseType === 'json' ? 'json' : responseType || 'arraybuffer';
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
          if (responseType === 'json') return resolve(xhr.response);
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

    const attempt = (n) => {
      const fn = typeof fetch === 'function' && !onProgress ? doFetch : doXhr;
      return fn().catch((err) => {
        if (n < retries) return attempt(n + 1);
        throw err;
      });
    };

    return attempt(0);
  };
  const ready = (fn) => {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };
  const runOnceOnReady = (fn) => ready(once(fn));
  const initTabs = (
    container,
    {
      tabSelector = '.modal__tab',
      contentSelector = '.modal__content',
      activeClass = 'active',
    } = {},
  ) => {
    container.addEventListener('click', (e) => {
      const tab = e.target.closest(tabSelector);
      if (!tab || !container.contains(tab)) return;
      const tabs = Array.from(container.querySelectorAll(tabSelector));
      const contents = Array.from(container.querySelectorAll(contentSelector));
      const i = tabs.indexOf(tab);
      tabs.forEach((t, idx) => t.classList.toggle(activeClass, idx === i));
      contents.forEach((c, idx) => c.classList.toggle(activeClass, idx === i));
    });
  };
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
    window.settingsMenu?.notifyScriptLoaded(name);
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
    initTabs,
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
