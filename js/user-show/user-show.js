(() => {
  'use strict';

  const H = window.helpers || null;

  const getConfig = (name, defaults) => {
    try {
      if (H && typeof H.getConfig === 'function')
        return H.getConfig(name, defaults);
    } catch {}
    const raw = (window.ScriptConfig && window.ScriptConfig[name]) || {};
    return Object.assign({}, defaults, raw);
  };

  const cfg = getConfig('usershow', {
    rootSelector: '#pun-main',
    messageSelectors: [
      '.post-content',
      '.postmsg',
      '.post-body',
      '.post-message',
      '.post-box',
    ],
    alwaysUsers: [],
    alwaysGroups: [],
    showAllowedListInStub: true,
    citeText: 'Скрытый текст:',
    stubText: 'Скрытый текст доступен только определённым пользователям.',
    prehide: true,
  });

  const norm = (s) =>
    String(s == null ? '' : s)
      .trim()
      .toLowerCase();
  const uniq = (arr) =>
    Array.from(
      new Set((arr || []).map((x) => String(x).trim()).filter(Boolean)),
    );

  const currentLoginRaw = (window.UserLogin || '').trim();
  const currentLogin = norm(currentLoginRaw);
  const currentGroup = (() => {
    const g = window.GroupID;
    const n = typeof g === 'string' ? Number(g) : typeof g === 'number' ? g : 0;
    return Number.isFinite(n) ? n : 0;
  })();

  const alwaysUsers = uniq(cfg.alwaysUsers).map(norm);
  const alwaysGroups = Array.isArray(cfg.alwaysGroups)
    ? cfg.alwaysGroups.map((x) => Number(x)).filter(Number.isFinite)
    : [];
  const isAlwaysAllowed = () =>
    (currentLogin && alwaysUsers.includes(currentLogin)) ||
    (currentGroup && alwaysGroups.includes(currentGroup));

  const escapeHTML = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const escapeAttr = (s) => escapeHTML(s).replace(/\s+/g, ' ').trim();

  const sanitizeHTML = (html) => {
    if (H && typeof H.createEl === 'function') {
      try {
        return H.createEl('div', { html: String(html == null ? '' : html) })
          .innerHTML;
      } catch {}
    }
    return String(html == null ? '' : html);
  };

  const decodeParamEntities = (s) =>
    String(s == null ? '' : s)
      .replace(/&quot;/g, '"')
      .replace(/&#0*39;|&apos;/g, "'")
      .replace(/&amp;/g, '&');

  const splitUsers = (raw) => {
    const s0 = decodeParamEntities(raw).trim();
    if (!s0) return [];
    const res = [];
    let cur = '';
    let q = '';
    for (let i = 0; i < s0.length; i++) {
      const ch = s0[i];
      if ((ch === '"' || ch === "'") && (!q || q === ch)) {
        q = q ? '' : ch;
        cur += ch;
        continue;
      }
      if (!q && (ch === ',' || ch === ';')) {
        const t = cur.trim();
        if (t) res.push(t);
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) res.push(cur.trim());

    return uniq(
      res.map((t) => {
        t = t.trim();
        if (!t) return '';
        if (
          (t.startsWith("'") && t.endsWith("'")) ||
          (t.startsWith('"') && t.endsWith('"'))
        ) {
          t = t.slice(1, -1);
        }
        return t.trim();
      }),
    );
  };

  const buildBoxHTML = ({ allowedUsers, allowed, contentHTML }) => {
    const usersStr = allowedUsers.join(', ');
    const dataUsers = escapeAttr(usersStr);

    if (allowed) {
      const safe = sanitizeHTML(contentHTML);
      return (
        `<div class="quote-box hide-box usershow-box usershow-box--open" data-usershow="1" data-usershow-users="${dataUsers}">` +
        `<cite>${escapeHTML(cfg.citeText)}</cite>` +
        `<blockquote><p>${safe}</p></blockquote>` +
        `</div>`
      );
    }

    const stub =
      cfg.showAllowedListInStub && allowedUsers.length
        ? `Доступно только для: ${usersStr}`
        : String(cfg.stubText || 'Скрытый текст недоступен.');
    return (
      `<div class="quote-box hide-box usershow-box usershow-box--locked" data-usershow="1" data-usershow-users="${dataUsers}">` +
      `<cite>${escapeHTML(cfg.citeText)}</cite>` +
      `<blockquote><p>${escapeHTML(stub)}</p></blockquote>` +
      `</div>`
    );
  };

  const isAllowedFor = (tagUsers) => {
    if (isAlwaysAllowed()) return true;
    if (!currentLogin) return false;
    const set = new Set(tagUsers.map(norm));
    return set.has(currentLogin);
  };

  const RE = /\[usershow(?:\s*=\s*([^\]]*))?\]([\s\S]*?)\[\/usershow\]/gi;

  const processMessageEl = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.dataset && el.dataset.usershowProcessed === '1') return false;

    const t = (el.textContent || '').toLowerCase();
    if (!t.includes('[usershow')) {
      if (el.dataset) el.dataset.usershowProcessed = '1';
      return false;
    }

    const html = el.innerHTML || '';
    RE.lastIndex = 0;

    let out = '';
    let last = 0;
    let changed = false;
    let m;

    while ((m = RE.exec(html))) {
      changed = true;
      out += html.slice(last, m.index);

      const rawParam = (m[1] || '').trim();
      const inner = m[2] || '';
      const users = splitUsers(rawParam);
      const allowed = isAllowedFor(users);

      out += buildBoxHTML({ allowedUsers: users, allowed, contentHTML: inner });
      last = RE.lastIndex;
    }

    if (!changed) {
      if (el.dataset) el.dataset.usershowProcessed = '1';
      return false;
    }

    out += html.slice(last);
    el.innerHTML = out;
    if (el.dataset) el.dataset.usershowProcessed = '1';
    return true;
  };

  const getRoot = () => document.querySelector(cfg.rootSelector) || document;
  const getMessageEls = (root) => {
    const sels = Array.isArray(cfg.messageSelectors)
      ? cfg.messageSelectors
      : [];
    const uniqSels = uniq(sels);
    if (!uniqSels.length) return [];
    const q = uniqSels.join(',');
    try {
      return Array.from(root.querySelectorAll(q));
    } catch {
      return [];
    }
  };

  const addPrehide = () => {
    if (!cfg.prehide) return null;

    const sels = Array.isArray(cfg.messageSelectors)
      ? uniq(cfg.messageSelectors)
      : [];
    if (!sels.length) return null;

    const rootSel = (cfg.rootSelector || '').trim() || '';
    const scoped = sels
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (rootSel && rootSel !== 'document' ? `${rootSel} ${s}` : s))
      .join(', ');

    const style = document.createElement('style');
    style.id = 'usershow-prehide-style';
    style.textContent = scoped
      ? `html.usershow-prehide ${scoped}{visibility:hidden!important}`
      : `html.usershow-prehide{visibility:hidden!important}`;

    document.documentElement.classList.add('usershow-prehide');
    (document.head || document.documentElement).appendChild(style);
    return style;
  };

  const removePrehide = (styleEl) => {
    document.documentElement.classList.remove('usershow-prehide');
    try {
      if (styleEl && styleEl.parentNode)
        styleEl.parentNode.removeChild(styleEl);
    } catch {}
  };

  const run = () => {
    const styleEl = addPrehide();

    try {
      const root = getRoot();
      const els = getMessageEls(root);
      for (const el of els) processMessageEl(el);
    } finally {
      removePrehide(styleEl);
    }

    const root = getRoot();
    if (!root || root === document) return;

    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      const fn = () => {
        scheduled = false;
        const els = getMessageEls(root);
        for (const el of els) processMessageEl(el);
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(fn);
      else setTimeout(fn, 0);
    };

    const obs = new MutationObserver((mut) => {
      for (const rec of mut) {
        if (
          rec.type !== 'childList' ||
          !rec.addedNodes ||
          !rec.addedNodes.length
        )
          continue;
        schedule();
        break;
      }
    });
    try {
      obs.observe(root, { childList: true, subtree: true });
    } catch {}
  };

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
})();
