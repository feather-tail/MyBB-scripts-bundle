(() => {
  'use strict';

  const DEFAULTS = {
    rootSelector: '#pun-main',
    messageSelectors: ['.post-content', '.postmsg'],
    alwaysUsers: ['Kayden Moore'],
    alwaysGroups: [],
    showAllowedListInStub: true,
    citeText: 'Скрытый текст:',
    stubText: 'Скрытый текст доступен только определённым пользователям.',
    prehide: true,
  };

  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const uniq = (arr) => Array.from(new Set((arr || []).map((x) => String(x).trim()).filter(Boolean)));

  const readCfg = () => {
    const raw = window.ScriptConfig?.usershow || {};
    const cfg = { ...DEFAULTS, ...raw };
    cfg.messageSelectors = Array.isArray(raw.messageSelectors) ? raw.messageSelectors : DEFAULTS.messageSelectors;
    cfg.alwaysUsers = Array.isArray(raw.alwaysUsers) ? raw.alwaysUsers : DEFAULTS.alwaysUsers;
    cfg.alwaysGroups = Array.isArray(raw.alwaysGroups) ? raw.alwaysGroups : DEFAULTS.alwaysGroups;
    cfg.rootSelector = String(cfg.rootSelector || DEFAULTS.rootSelector);
    cfg.citeText = String(cfg.citeText || DEFAULTS.citeText);
    cfg.stubText = String(cfg.stubText || DEFAULTS.stubText);
    cfg.showAllowedListInStub = !!cfg.showAllowedListInStub;
    cfg.prehide = !!cfg.prehide;
    return cfg;
  };

  const escapeHTML = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const escapeAttr = (s) => escapeHTML(s).replace(/\s+/g, ' ').trim();

  const sanitizeHTML = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    tpl.content.querySelectorAll('script').forEach((n) => n.remove());
    tpl.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      });
    });
    return tpl.innerHTML;
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
        if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) t = t.slice(1, -1);
        return t.trim();
      }),
    );
  };

  const getCurrentLogin = () => norm(window.UserLogin || '');
  const getCurrentGroup = () => {
    const g = window.GroupID;
    const n = typeof g === 'string' ? Number(g) : typeof g === 'number' ? g : 0;
    return Number.isFinite(n) ? n : 0;
  };

  const isAlwaysAllowed = (cfg) => {
    const login = getCurrentLogin();
    const group = getCurrentGroup();
    const alwaysUsers = uniq(cfg.alwaysUsers).map(norm);
    const alwaysGroups = (cfg.alwaysGroups || []).map((x) => Number(x)).filter(Number.isFinite);
    return (login && alwaysUsers.includes(login)) || (group && alwaysGroups.includes(group));
  };

  const renderBlockquoteInner = (safeHtml) => {
    const t = String(safeHtml || '').trim();
    if (!t) return '<p></p>';
    if (/^<(p|div|ul|ol|table|blockquote|pre|h\d|section|article|figure|aside)\b/i.test(t)) return t;
    return `<p>${safeHtml}</p>`;
  };

  const buildBoxHTML = (cfg, { allowedUsers, allowed, contentHTML }) => {
    const usersStr = allowedUsers.join(', ');
    const dataUsers = escapeAttr(usersStr);

    if (allowed) {
      const safe = sanitizeHTML(contentHTML);
      return (
        `<div class="quote-box hide-box usershow-box usershow-box--open" data-usershow="1" data-usershow-users="${dataUsers}">` +
        `<cite>${escapeHTML(cfg.citeText)}</cite>` +
        `<blockquote>${renderBlockquoteInner(safe)}</blockquote>` +
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

  const isAllowedFor = (cfg, tagUsers) => {
    if (isAlwaysAllowed(cfg)) return true;
    const login = getCurrentLogin();
    if (!login) return false;
    const set = new Set((tagUsers || []).map(norm));
    return set.has(login);
  };

  const RE = /\[usershow(?:\s*=\s*([^\]]*))?\]([\s\S]*?)\[\/usershow\]/gi;

  const processMessageEl = (cfg, el) => {
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
      const allowed = isAllowedFor(cfg, users);

      out += buildBoxHTML(cfg, { allowedUsers: users, allowed, contentHTML: inner });
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

  const getRoot = (cfg) => document.querySelector(cfg.rootSelector) || document;

  const getMessageEls = (cfg, root) => {
    const sels = uniq(Array.isArray(cfg.messageSelectors) ? cfg.messageSelectors : []);
    if (!sels.length) return [];
    try {
      return Array.from(root.querySelectorAll(sels.join(',')));
    } catch {
      return [];
    }
  };

  let prehideStyleEl = null;
  const applyPrehideNow = () => {
    const cfg = readCfg();
    if (!cfg.prehide) return;

    const rootSel = (cfg.rootSelector || '').trim() || '';
    const sels = uniq(cfg.messageSelectors || []);
    const scoped = sels
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (rootSel && rootSel !== 'document' ? `${rootSel} ${s}` : s))
      .join(', ');

    const css = scoped
      ? `html.usershow-prehide ${scoped}{visibility:hidden!important}`
      : `html.usershow-prehide{visibility:hidden!important}`;

    document.documentElement.classList.add('usershow-prehide');

    if (!prehideStyleEl) {
      prehideStyleEl = document.createElement('style');
      prehideStyleEl.id = 'usershow-prehide-style';
      prehideStyleEl.textContent = css;
      (document.head || document.documentElement).appendChild(prehideStyleEl);
    } else if (prehideStyleEl.textContent !== css) {
      prehideStyleEl.textContent = css;
    }
  };

  const removePrehide = () => {
    document.documentElement.classList.remove('usershow-prehide');
    try {
      if (prehideStyleEl && prehideStyleEl.parentNode) prehideStyleEl.parentNode.removeChild(prehideStyleEl);
    } catch {}
    prehideStyleEl = null;
  };

  applyPrehideNow();

  const run = () => {
    const cfg = readCfg();
    try {
      applyPrehideNow();
      const root = getRoot(cfg);
      const els = getMessageEls(cfg, root);
      for (const el of els) processMessageEl(cfg, el);
    } finally {
      removePrehide();
    }

    const cfg2 = readCfg();
    const root2 = getRoot(cfg2);
    if (!root2 || root2 === document) return;

    const obs = new MutationObserver((mut) => {
      const cfgLive = readCfg();
      const msgSelectors = uniq(cfgLive.messageSelectors || []);
      if (!msgSelectors.length) return;

      for (const rec of mut) {
        if (rec.type !== 'childList' || !rec.addedNodes || !rec.addedNodes.length) continue;

        const toProcess = [];
        rec.addedNodes.forEach((node) => {
          if (!node || node.nodeType !== 1) return;
          msgSelectors.forEach((sel) => {
            try {
              if (node.matches && node.matches(sel)) toProcess.push(node);
            } catch {}
            try {
              node.querySelectorAll && node.querySelectorAll(sel).forEach((n) => toProcess.push(n));
            } catch {}
          });
        });

        if (!toProcess.length) continue;

        for (const el of toProcess) {
          if ((el.textContent || '').toLowerCase().includes('[usershow')) el.style.visibility = 'hidden';
        }
        for (const el of toProcess) processMessageEl(cfgLive, el);
        for (const el of toProcess) el.style.visibility = '';

        break;
      }
    });

    try {
      obs.observe(root2, { childList: true, subtree: true });
    } catch {}
  };

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
})();
