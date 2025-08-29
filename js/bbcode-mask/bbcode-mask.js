(() => {
  'use strict';
  const helpers = window.helpers;
  const {
    $,
    $$,
    createEl,
    debounce,
    parseAccessMap,
    showToast,
    dialog,
    getUserInfo,
    getGroupId,
  } = helpers;
  const config = helpers.getConfig('bbcodeMask', {});
  const SELECTORS = config.selectors;
  const MAX_CACHE_ENTRIES = config.maxCacheEntries;

  config.allTags = Object.values(config.fields)
    .flatMap((f) => f.tags)
    .concat(config.blockTag);

  const Cache = {
    parsedMask: new Map(),
    cleanedHtml: new Map(),
    set(map, key, val) {
      if (map.size >= MAX_CACHE_ENTRIES) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
      }
      map.set(key, val);
      return val;
    },
    getParsed(html) {
      if (this.parsedMask.has(html)) return this.parsedMask.get(html);
      const parsed = extractMaskTags_noCache(html);
      return this.set(this.parsedMask, html, parsed);
    },
    getCleaned(html) {
      if (this.cleanedHtml.has(html)) return this.cleanedHtml.get(html);
      const cleaned = cleanupContentHtml_noCache(stripMaskTags_noCache(html));
      return this.set(this.cleanedHtml, html, cleaned);
    },
    clear() {
      this.parsedMask.clear();
      this.cleanedHtml.clear();
    },
  };

  let currentMask = {};
  let previewContainer;
  let errorContainer;
  let editingIndex = null;
  let escHandler = null;
  let focusTrapHandler = null;
  let closeDialog = () => {};
  let previewObserver = null;

  const nodes = {
    overlay: null,
    dialog: null,
    previewPanel: null,
    formEl: null,
    storagePanel: null,
    actionsPanel: null,
    templateSelect: null,
  };

  const debouncedPreviewAndDraft = debounce(() => {
    updatePreview();
    saveDraft();
  }, 150);

  const cacheDomElements = () => {
    nodes.overlay = $('#mask-overlay');
    nodes.dialog = $('#mask-dialog');
    if (!nodes.dialog) return;
    nodes.previewPanel = $('.mask-preview-panel', nodes.dialog);
    nodes.formEl = $('.mask-form', nodes.dialog);
    nodes.storagePanel = $('.mask-storage-panel', nodes.dialog);
    nodes.actionsPanel = $('.mask-actions', nodes.dialog);
    nodes.templateSelect = $('#mask-template-select', nodes.dialog);
  };

  const sanitizeStorageData = (rawDecoded) =>
    rawDecoded
      .split('|splitKey|')
      .filter((s) => {
        try {
          JSON.parse(s);
          return true;
        } catch {
          return false;
        }
      })
      .join('|splitKey|');

  const MaskStore = {
    masks: [],
    lastDeleted: null,
    async load() {
      try {
        const params = new URLSearchParams({
          method: 'storage.get',
          key: config.storageKey,
        });
        const json = await helpers.request(`/api.php?${params}`, {
          responseType: 'json',
        });
        const raw = json.response?.storage?.data?.[config.storageKey] || '';
        const decoded = raw ? decodeURIComponent(raw) : '';
        const cleaned = decoded ? sanitizeStorageData(decoded) : '';
        this.masks = cleaned ? cleaned.split('|splitKey|') : [];
      } catch {
        this.masks = [];
      }
    },
    async save() {
      const joined = this.masks.join('|splitKey|');
      const body = new URLSearchParams({
        method: 'storage.set',
        token: window.ForumAPITicket,
        key: config.storageKey,
        value: encodeURIComponent(joined),
      });
      await helpers.request('/api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: body,
      });
    },
    add(record) {
      if (this.masks.length >= config.storageLimit) {
        this.masks.pop();
        showToast('Самая старая маска была удалена из-за переполнения.', {
          type: 'warning',
        });
      }
      this.masks.unshift(record);
    },
    update(i, record) {
      if (i >= 0 && i < this.masks.length) this.masks[i] = record;
    },
    remove(i) {
      if (i >= 0 && i < this.masks.length) {
        this.lastDeleted = { record: this.masks[i], index: i };
        this.masks.splice(i, 1);
      }
    },
    undoDelete() {
      if (this.lastDeleted) {
        this.masks.splice(
          Math.min(this.lastDeleted.index, this.masks.length),
          0,
          this.lastDeleted.record,
        );
        this.lastDeleted = null;
      }
    },
    move(from, to) {
      if (
        from === to ||
        from < 0 ||
        from >= this.masks.length ||
        to < 0 ||
        to > this.masks.length
      )
        return;
      const [it] = this.masks.splice(from, 1);
      this.masks.splice(to, 0, it);
    },
  };

  const DragDrop = {
    draggedIndex: null,
    placeholderEl: null,
    onDragStart(e, wrap, index) {
      e.stopPropagation();
      $$('.mask-placeholder').forEach((t) => t.remove());
      this.draggedIndex = index;
      this.placeholderEl = createEl('div');
      this.placeholderEl.className = 'mask-placeholder';
      this.placeholderEl.style.height = `${wrap.offsetHeight}px`;
      wrap.parentNode.insertBefore(this.placeholderEl, wrap.nextSibling);
      wrap.style.opacity = '0.5';
      wrap.classList.add('mask-dragging');
    },
    onDragEnd(e, wrap) {
      e.stopPropagation();
      wrap.style.opacity = '';
      wrap.classList.remove('mask-dragging');
      $$('.mask-storage-item.highlight').forEach((el) =>
        el.classList.remove('highlight'),
      );
      if (this.placeholderEl) {
        this.placeholderEl.remove();
        this.placeholderEl = null;
      }
      this.draggedIndex = null;
    },
    onDragOver(e, storagePanel) {
      e.preventDefault();
      e.stopPropagation();
      const items = [...storagePanel.children];
      items.forEach((el) => el.classList.remove('highlight'));
      let inserted = false;
      for (const item of items) {
        if (
          item !== this.placeholderEl &&
          e.clientY < item.getBoundingClientRect().top + item.offsetHeight / 2
        ) {
          item.classList.add('highlight');
          storagePanel.insertBefore(this.placeholderEl, item);
          inserted = true;
          break;
        }
      }
      if (!inserted) storagePanel.appendChild(this.placeholderEl);
    },
    async onDrop(e, storagePanel, MaskStore, renderStoragePanel) {
      e.preventDefault();
      e.stopPropagation();
      if (this.draggedIndex === null) return;
      const items = [...storagePanel.children];
      let newIndex = items.indexOf(this.placeholderEl);
      if (newIndex < 0) newIndex = MaskStore.masks.length;
      this.placeholderEl.remove();
      this.placeholderEl = null;
      MaskStore.move(this.draggedIndex, newIndex);
      await MaskStore.save();
      renderStoragePanel(storagePanel);
      this.draggedIndex = null;
    },
  };

  const getFieldKeyByClass = (className) =>
    Object.keys(config.fields).find(
      (k) => config.fields[k].class === className,
    );

  const normalizeUrl = (raw) => {
    let url = String(raw || '').trim();
    if (!url) return '#';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'http://' + url;
    try {
      const obj = new URL(url);
      return config.safeProtocols.includes(obj.protocol) ? obj.href : '#';
    } catch {
      return '#';
    }
  };

  const getForumName = () => {
    let name = null;
    if (window.FORUM?.topic?.forum_name) {
      name = window.FORUM.topic.forum_name;
    } else {
      const crumbs = $('#pun-crumbs1');
      const links = crumbs?.querySelectorAll('a[href*="viewforum"]');
      if (links && links.length) name = links[links.length - 1].textContent;
    }
    if (!name) return null;
    return name.trim().replace(/\u00AD/g, '');
  };

  const accessConfig = {
    forumAccess: parseAccessMap(config.forumAccess),
    forumAccessExtended: parseAccessMap(config.forumAccessExtended),
    guestAccess: Array.isArray(config.guestAccess)
      ? config.guestAccess.slice()
      : [],
  };

  const clearFormFields = () => {
    Object.keys(config.fields).forEach((key) => {
      const el = $(`#mask-${key}`);
      if (el) el.value = '';
    });
  };

  const saveDraft = () => {
    const obj = {};
    Object.keys(config.fields).forEach((key) => {
      const el = $(`#mask-${key}`);
      if (el?.value.trim()) obj[key] = el.value.trim();
    });
    localStorage.setItem(config.localDraftKey, JSON.stringify(obj));
  };

  const loadDraft = () => {
    const str = localStorage.getItem(config.localDraftKey);
    if (!str) return;
    try {
      const obj = JSON.parse(str);
      Object.keys(config.fields).forEach((k) => {
        const el = $(`#mask-${k}`);
        if (el && obj[k]) el.value = obj[k];
      });
    } catch {}
  };

  const clearDraft = () => localStorage.removeItem(config.localDraftKey);

  const validateField = (fieldKey, value) => {
    const fld = config.fields[fieldKey];
    if (!fld) return '';
    const v = String(value ?? '');
    if (v === '') return '';
    if (fld.max && v.length > fld.max)
      return `Поле «${fld.label || fieldKey}» не должно превышать ${
        fld.max
      } символов`;
    if (fieldKey === 'avatar') {
      try {
        const url = new URL(v);
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(url.pathname))
          return 'Аватар должен быть ссылкой на картинку (jpg, jpeg, png, gif, webp)';
        if (!config.safeProtocols.includes(url.protocol))
          return 'Аватар: недопустимый протокол';
      } catch {
        return 'Аватар: некорректный URL';
      }
    } else if (fieldKey === 'signature') {
      if (/<[^>]+>/.test(v)) return 'Подпись содержит запрещённый HTML';
      if (/javascript\s*:/i.test(v)) return 'Подпись содержит недопустимый URL';
    } else if (fieldKey === 'author' || fieldKey === 'status') {
      if (/^\s+$/.test(v)) return 'Поле не может быть пустым';
      if (fieldKey === 'author' && /[\[\]<>{}]/.test(v))
        return 'Имя не может содержать скобки и спецсимволы';
    }
    return '';
  };

  const convertBbcodeToHtml = (str) => {
    let s = String(str || '');
    s = s.replace(
      /\[(b|i|u|s)\]([\s\S]*?)\[\/\1\]/gi,
      (_, tag, content) =>
        `<${config.bbTagMap[tag.toLowerCase()]}>${content}</${
          config.bbTagMap[tag.toLowerCase()]
        }>`,
    );
    s = s.replace(
      /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
      (_, link, text) =>
        `<a href="${normalizeUrl(
          link,
        )}" target="_blank" rel="noopener noreferrer">${text}</a>`,
    );
    s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, link) => {
      const href = normalizeUrl(link);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${link.trim()}</a>`;
    });
    s = s.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, src) => {
      const clean = normalizeUrl(src);
      return clean === '#' ? '' : `<img src="${clean}" alt="">`;
    });
    s = s.replace(
      /\[color=([#\w]+)\]([\s\S]*?)\[\/color\]/gi,
      (_, c, t) => `<span style="color:${c}">${t}</span>`,
    );
    s = s.replace(
      /\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi,
      (_, z, t) => `<span style="font-size:${z}px">${t}</span>`,
    );
    s = s.replace(
      /\[font=([^\]]+)\]([\s\S]*?)\[\/font\]/gi,
      (_, f, t) => `<span style="font-family:${f}">${t}</span>`,
    );
    s = s.replace(
      /\[mark\]([\s\S]*?)\[\/mark\]/gi,
      (_, t) => `<mark>${t}</mark>`,
    );
    s = s.replace(
      /\[abbr=([^\]]+)\]([\\s\S]*?)\[\/abbr\]/gi,
      (_, title, t) => `<abbr title="${title}">${t}</abbr>`,
    );
    s = s.replace(/\[you\]/gi, getUserInfo().name || 'Вы');
    s = s.replace(/\[hr\]/gi, '<hr>');
    s = s.replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, (_, t) => `<sup>${t}</sup>`);
    s = s.replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, (_, t) => `<sub>${t}</sub>`);
    s = s.replace(
      /\[align=(left|center|right)\]([\s\S]*?)\[\/align\]/gi,
      (_, a, t) => `<div style="text-align:${a}">${t}</div>`,
    );
    s = s.replace(
      /\[center\]([\s\S]*?)\[\/center\]/gi,
      (_, t) => `<div style="text-align:center">${t}</div>`,
    );
    s = s.replace(
      /\[left\]([\s\S]*?)\[\/left\]/gi,
      (_, t) => `<div style="text-align:left">${t}</div>`,
    );
    s = s.replace(
      /\[right\]([\s\S]*?)\[\/right\]/gi,
      (_, t) => `<div style="text-align:right">${t}</div>`,
    );
    s = s.replace(/<br\s*\/?>\s*(\r?\n)+/gi, '<br>');
    s = s.replace(/(\r?\n)+(?=<br\s*\/?>)/g, '');
    s = s.replace(/(\r?\n)+/g, '<br>');
    return s;
  };

  const sanitizeHtml = (html) => {
    if (!html) return '';
    const decoder = createEl('textarea');
    decoder.innerHTML = html;
    html = decoder.value;
    const wrapper = createEl('div');
    wrapper.innerHTML = html;
    const ALLOWED_TAGS = config.sanitize.allowedTags;
    const ALLOWED_ATTRS = config.sanitize.allowedAttrs;
    const SAFE_PROTOCOLS = config.sanitize.safeProtocols;
    const ALLOWED_STYLES = config.sanitize.allowedInlineStyles;
    const BLOCK_SVG = !!config.sanitize.blockSvgInImg;

    const clean = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        !ALLOWED_TAGS.includes(node.tagName.toLowerCase())
      ) {
        node.parentNode && node.parentNode.removeChild(node);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        [...node.attributes].forEach((attr) => {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          if (!ALLOWED_ATTRS[tag] || !ALLOWED_ATTRS[tag].includes(name)) {
            node.removeAttribute(attr.name);
            return;
          }
          if (name === 'href' || name === 'src') {
            try {
              const url = new URL(value, window.location.origin);
              if (!SAFE_PROTOCOLS.includes(url.protocol)) {
                node.removeAttribute(name);
                return;
              }
            } catch {
              node.removeAttribute(name);
              return;
            }
          }
          if (
            tag === 'img' &&
            name === 'src' &&
            BLOCK_SVG &&
            /\.svg(\?.*)?$/i.test(value)
          ) {
            node.removeAttribute(name);
            return;
          }
          if (/^(javascript|data):/i.test(value)) node.removeAttribute(name);
          if (name === 'style') {
            const v = String(value);
            const ok = ALLOWED_STYLES.some((prop) =>
              new RegExp(`(^|;)\\s*${prop}\\s*:`, 'i').test(v),
            );
            if (!ok) node.removeAttribute('style');
          }
        });
        if (tag === 'a' && !node.hasAttribute('href')) {
          node.parentNode && node.parentNode.removeChild(node);
          return;
        }
      }
      [...node.childNodes].forEach(clean);
    };
    [...wrapper.childNodes].forEach(clean);
    return wrapper.innerHTML.trim();
  };

  function cleanupContentHtml_noCache(html) {
    if (!html) return '';
    let s = html;
    s = s.replace(/^[\s\u00A0]+/, '');
    s = s.replace(/^(?:<br\s*\/?>\s*)+/i, '');
    s = s.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
    s = s.replace(
      /<p>\s*(?:<br\s*\/?>\s*)+([^]*?)<\/p>/i,
      (m, body) => `<p>${body}</p>`,
    );
    s = s.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
    return s;
  }

  function showUndoToast(onUndo) {
    showToast('Маска удалена.', {
      type: 'info',
      actions: [{ label: 'Отменить', value: 'undo', variant: 'primary' }],
      duration: 5000,
    }).then((res) => {
      if (res === 'undo') onUndo?.();
    });
  }

  const stripMaskTags_noCache = (html) => {
    if (!html) return '';
    const codeBlocks = [];
    const placeholder = '___CODE_BLOCK_PLACEHOLDER___';
    html = html.replace(/<div class="code-box">([\s\S]*?)<\/div>/gi, (m) => {
      codeBlocks.push(m);
      return `${placeholder}${codeBlocks.length - 1}${placeholder}`;
    });
    const tags = config.allTags.join('|');
    html = html.replace(
      new RegExp(`\\[(${tags})\\][\\s\\S]*?\\[\\/\\1\\]`, 'gi'),
      '',
    );
    html = html.replace(
      new RegExp(`${placeholder}(\\d+)${placeholder}`, 'g'),
      (_, i) => codeBlocks[+i] || '',
    );
    return html;
  };

  const stripMaskTags = (html) => Cache.getCleaned(html);

  const removeMaskTagsFromPreview = () => {
    scrubPreview();
  };

  function createFormField(fieldConfig, key, value) {
    const wrap = createEl('div');
    wrap.className = 'mask-form-field';
    if (fieldConfig.label) {
      const lbl = createEl('label');
      lbl.className = 'mask-field-label';
      lbl.htmlFor = `mask-${key}`;
      lbl.textContent = fieldConfig.label;
      wrap.append(lbl);
    }
    if (fieldConfig.defaultCode) {
      const btn = createEl('button');
      btn.type = 'button';
      btn.className = 'mask-template-btn';
      btn.textContent = '« вставить шаблон';
      btn.dataset.field = key;
      wrap.append(btn);
    }
    const input =
      fieldConfig.type === 'bbcode' ||
      fieldConfig.type === 'html' ||
      key === 'signature'
        ? createEl('textarea')
        : createEl('input');
    input.id = `mask-${key}`;
    input.className = 'mask-field-input';
    input.placeholder = fieldConfig.label || key;
    if (fieldConfig.max) input.maxLength = fieldConfig.max;
    input.value = value || '';
    input.addEventListener('input', debouncedPreviewAndDraft);
    wrap.append(input);
    return wrap;
  }

  function createActionButton(text, action) {
    const btn = createEl('button');
    btn.type = 'button';
    btn.className = 'mask-action-btn';
    btn.textContent = text;
    btn.dataset.action = action;
    return btn;
  }

  const observePreviewChanges = () => {
    const box = $(SELECTORS.previewBox);
    if (!box) return;
    if (previewObserver) previewObserver.disconnect();
    previewObserver = new MutationObserver(() => {
      scrubPreview();
    });
    previewObserver.observe(box, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scrubPreview();
  };

  function scrubPreview() {
    const box = $(SELECTORS.previewBox);
    if (!box) return;
    const target = box.querySelector('.post-content') || box;
    const cleaned = Cache.getCleaned(target.innerHTML);
    if (target.innerHTML !== cleaned) target.innerHTML = cleaned;
  }

  const extractMaskTags_noCache = (html) => {
    const res = {};
    for (const [fieldKey, fieldConfig] of Object.entries(config.fields)) {
      for (const tag of fieldConfig.tags) {
        const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
        const m = html.match(re);
        if (m) {
          res[fieldKey] = {
            tag,
            content: m[1].trim(),
            type: fieldConfig.type,
            fieldClass: fieldConfig.class,
          };
          break;
        }
      }
    }
    return res;
  };

  const extractMaskTags = (html) => Cache.getParsed(html);

  const getOrCreateProfileField = (profileBlock, className) => {
    let li = profileBlock.querySelector('.' + className);
    if (li) return li;
    const idx = config.userFieldOrder.indexOf(className);
    let insertBefore;
    if (idx !== -1) {
      for (let i = idx + 1; i < config.userFieldOrder.length; i++) {
        const el = profileBlock.querySelector('.' + config.userFieldOrder[i]);
        if (el) {
          insertBefore = el;
          break;
        }
      }
    }
    li = createEl('li');
    li.className = className;
    insertBefore
      ? profileBlock.insertBefore(li, insertBefore)
      : profileBlock.appendChild(li);
    return li;
  };

  const escHtml = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (m) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[m]),
    );

  const computeAccessForUser = (user, forumName) => {
    if (!user) return { common: false, extended: false };
    if (
      user.groupId === '1' ||
      user.groupId === '2' ||
      user.groupId === 1 ||
      user.groupId === 2
    )
      return { common: true, extended: true };
    if (user.groupId === '3' || user.groupId === 3) {
      const ok = accessConfig.guestAccess.includes(forumName);
      return { common: ok, extended: ok };
    }
    const titles = {
      common: accessConfig.forumAccess[forumName] || null,
      extended: accessConfig.forumAccessExtended[forumName] || null,
    };
    const title = user.groupTitle || '';
    const inCommon = titles.common ? titles.common.includes(title) : true;
    const inExtended = titles.extended
      ? titles.extended.includes(title)
      : false;
    return { common: inExtended || inCommon, extended: inExtended };
  };

  const fetchUsersInfo = async (userIds) => {
    const ids = Array.from(new Set(userIds.filter((id) => +id > 0)));
    const res = {};
    if (userIds.includes('1') || userIds.includes(1))
      res['1'] = {
        userId: '1',
        username: 'Guest',
        groupId: '3',
        groupTitle: 'Гость',
      };
    if (!ids.length) return res;
    const params = new URLSearchParams({
      method: 'users.get',
      user_id: ids.join(','),
    });
    const json = await helpers.request(`/api.php?${params}`, {
      responseType: 'json',
    });
    const list = json.response?.users || {};
    Object.values(list).forEach((u) => {
      res[u.user_id] = {
        userId: String(u.user_id),
        username: u.username,
        groupId: String(u.group_id),
        groupTitle: u.group_title,
      };
    });
    return res;
  };

  const applyMaskToPost = (post, data, access) => {
    const profileBlock = post.querySelector(SELECTORS.profile);
    if (!profileBlock) return;
    const onlyAvatar = access && access.common && !access.extended;
    const allowAll = access && access.extended;
    const doAvatar = !!data.avatar;

    if (doAvatar && (onlyAvatar || allowAll)) {
      const li = getOrCreateProfileField(
        profileBlock,
        config.fields.avatar.class,
      );
      const img = li.querySelector('img') || li.appendChild(createEl('img'));
      img.src = normalizeUrl(
        typeof data.avatar === 'object' ? data.avatar.content : data.avatar,
      );
      img.alt = '';
    }

    if (allowAll) {
      config.userFieldOrder.forEach((className) => {
        const key = getFieldKeyByClass(className);
        if (!key || !data[key]) return;
        const fld = config.fields[key];
        const value =
          typeof data[key] === 'object' ? data[key].content : data[key];
        if (key === 'avatar') return;
        if (fld.type === 'bbcode') {
          const contentEl = post.querySelector(SELECTORS.content);
          if (!contentEl) return;
          let dl = contentEl.querySelector('.post-sig');
          if (!dl) {
            dl = createEl('dl');
            dl.className = fld.class;
            dl.innerHTML = '<dt><span>Подпись автора</span></dt><dd></dd>';
            contentEl.appendChild(dl);
          }
          dl.querySelector('dd').innerHTML = convertBbcodeToHtml(value);
        } else if (fld.type === 'html') {
          const li = getOrCreateProfileField(profileBlock, fld.class);
          li.innerHTML = sanitizeHtml(value);
        } else if (fld.type === 'link') {
          const li = getOrCreateProfileField(profileBlock, fld.class);
          const a = li.querySelector('a') || li.appendChild(createEl('a'));
          a.href = normalizeUrl(value);
          a.textContent = value;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        } else {
          const li = getOrCreateProfileField(profileBlock, fld.class);
          li.textContent = value.slice(0, fld.max || 999);
        }
      });

      const authorVal = data.author
        ? typeof data.author === 'object'
          ? data.author.content
          : data.author
        : '';
      if (authorVal) {
        const safeName = authorVal
          .replace(/'/g, "\\'")
          .replace(/[\[\]\{\}<>\"]/g, '');
        const postId =
          (post.id && post.id.replace(/^\D+/, '')) || post.dataset.id || '';
        const quoteHref = `javascript:quote('#p${postId},${safeName}',${postId})`;
        post
          .querySelectorAll(
            '.pl-quote a, .quote-btn a, a[href^="javascript:quote"]',
          )
          .forEach((link) => {
            link.setAttribute('href', quoteHref);
            link.setAttribute('title', `Цитировать пользователя ${safeName}`);
          });
        post.querySelectorAll('[data-quote]').forEach((btn) => {
          btn.setAttribute('data-quote', `#p${postId},${safeName}`);
          btn.setAttribute('title', `Цитировать пользователя ${safeName}`);
        });
      }
    }
  };

  const processPosts = async () => {
    const posts = [...$$(SELECTORS.post)];
    if (!posts.length) return;
    const changed = [];
    for (const post of posts) {
      if (post.dataset.masked) continue;
      const content = post.querySelector(SELECTORS.content);
      if (!content) continue;
      const html = content.innerHTML;
      const data = extractMaskTags(html);
      if (!Object.keys(data).length) continue;
      changed.push({ post, content, data, html });
    }
    if (!changed.length) return;

    const forum = getForumName() || '';
    const userIds = changed
      .map(({ post }) => {
        const d = post.dataset.userId || post.getAttribute('data-user-id');
        if (d) return String(d);
        const a =
          post.querySelector('.post-author a[href*="profile.php?id="]') ||
          post.querySelector('a[href*="profile.php?id="]');
        if (!a) return '';
        try {
          const u = new URL(a.href, location.origin);
          return u.searchParams.get('id') || '';
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    const users = await fetchUsersInfo(userIds);

    for (const item of changed) {
      const uid =
        item.post.dataset.userId ||
        item.post.getAttribute('data-user-id') ||
        '';
      const access = computeAccessForUser(users[String(uid)] || null, forum);
      item.content.innerHTML = Cache.getCleaned(item.html);
      applyMaskToPost(item.post, item.data, access);
      item.post.dataset.masked = '1';
      item.post.querySelector(SELECTORS.profile)?.classList.add('hv-mask');
    }
  };

  const getActiveTextarea = () => {
    if (window.sceditor?.instance) {
      const sced = window.sceditor.instance;
      if (sced.focus) sced.focus();
      return { type: 'sceditor', insert: (val) => sced.insert(val) };
    }
    const active = document.activeElement;
    if (
      active?.tagName === 'TEXTAREA' &&
      !active.disabled &&
      !active.readOnly &&
      active.offsetParent !== null
    )
      return active;
    for (const sel of SELECTORS.textarea) {
      const el = $(sel);
      if (
        el?.tagName === 'TEXTAREA' &&
        !el.disabled &&
        !el.readOnly &&
        el.offsetParent !== null
      )
        return el;
    }
    return [...$$('textarea')].find(
      (el) =>
        !el.disabled &&
        !el.readOnly &&
        el.offsetParent !== null &&
        getComputedStyle(el).display !== 'none' &&
        getComputedStyle(el).visibility !== 'hidden',
    );
  };

  const addToolbarButton = () => {
    const tryInsert = () => {
      const addition = $('#button-addition');
      const row = addition?.closest('tr') || $(SELECTORS.toolbarRow);
      if (!row) return;
      insertBtnAfterAddition(addition, row);
      observer.disconnect();
    };
    const observer = new MutationObserver(tryInsert);
    observer.observe(document.body, { childList: true, subtree: true });
    tryInsert();
  };

  const insertBtnAfterAddition = (additionTd, row) => {
    if ($('#button-mask')) return;
    const isTableRow = row.tagName === 'TR' || additionTd;
    if (isTableRow) {
      const btn = createEl('td');
      btn.id = 'button-mask';
      btn.title = 'Маска профиля';
      btn.innerHTML = '<img src="/i/blank.gif">';
      btn.style.backgroundImage = `url("${config.buttonIcon}")`;
      btn.style.backgroundRepeat = 'no-repeat';
      btn.style.backgroundPosition = '50% 4px';
      btn.style.display = 'table-cell';
      btn.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) return insertQuickIcon();
        openDialog();
      });
      if (additionTd && additionTd.parentNode)
        additionTd.parentNode.insertBefore(btn, additionTd.nextSibling);
      else row.appendChild(btn);
    } else {
      const btn = createEl('span');
      btn.id = 'maskBtn';
      btn.style.display = 'inline-block';
      btn.style.verticalAlign = 'middle';
      btn.style.marginLeft = '8px';
      btn.title = 'Маска профиля';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<img src="${config.buttonIcon}" alt="Маска">`;
      btn.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) return insertQuickIcon();
        openDialog();
      });
      row.appendChild(btn);
    }
  };

  const insertQuickIcon = () => {
    const ta = getActiveTextarea();
    if (!ta) return;
    let sel = '';
    if (ta.type === 'sceditor') {
      const inst = window.sceditor.instance;
      if (!inst) return;
      inst.focus();
      sel = inst.getText().trim();
    } else {
      sel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    }
    if (!sel) return;
    const code = `[icon]${sel}[/icon]`;
    if (typeof ta.insert === 'function') {
      ta.insert(code);
    } else if ('setRangeText' in ta) {
      ta.setRangeText(code);
      ta.focus();
    }
  };

  const showTooltip = (e, html) => {
    const tip = createEl('div');
    tip.className = 'mask-tooltip';
    tip.innerHTML = html;
    tip.style.left = e.clientX + 16 + 'px';
    tip.style.top = e.clientY + 4 + 'px';
    document.body.appendChild(tip);
    requestAnimationFrame(() => tip.classList.add('mask-tooltip--visible'));
    const move = (ev) => {
      tip.style.left = ev.clientX + 16 + 'px';
      tip.style.top = ev.clientY + 4 + 'px';
    };
    e.target.addEventListener('mousemove', move);
    e.target._tip = tip;
    e.target._tipMove = move;
  };

  const hideTooltip = (e) => {
    const tip = e.target._tip;
    if (tip) {
      tip.classList.remove('mask-tooltip--visible');
      setTimeout(() => tip.remove(), 120);
      e.target.removeEventListener('mousemove', e.target._tipMove);
      delete e.target._tip;
      delete e.target._tipMove;
    }
  };

  const validateForm = () => {
    const errors = [];
    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const el = $(`#mask-${key}`);
      if (!el) return;
      const err = validateField(key, el.value.trim());
      if (err) errors.push({ key, err });
    });

    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const field = $(`#mask-${key}`);
      if (!field) return;
      let errBox = field.nextElementSibling;
      if (!errBox || !errBox.classList.contains('mask-field-error')) {
        errBox = createEl('div');
        errBox.className = 'mask-field-error';
        field.after(errBox);
      }
      const errObj = errors.find((e) => e.key === key);
      errBox.textContent = errObj ? errObj.err : '';
    });

    if (errorContainer)
      errorContainer.textContent = errors.map((e) => e.err).join('; ');

    const hasAnyValue = config.userFieldOrder.some((className) => {
      const key = getFieldKeyByClass(className);
      const el = $(`#mask-${key}`);
      return el && el.value.trim() !== '';
    });

    if (!hasAnyValue) {
      if (errorContainer)
        errorContainer.textContent =
          'Заполните хотя бы одно поле для сохранения маски';
      return false;
    }
    return errors.length === 0;
  };

  const updatePreview = () => {
    currentMask = {};
    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const el = $(`#mask-${key}`);
      if (el?.value.trim()) currentMask[key] = el.value.trim();
    });
    const code =
      `[${config.blockTag}]` +
      Object.entries(currentMask)
        .map(
          ([k, v]) =>
            `[${config.fields[k].tags[0]}]${v}[/${config.fields[k].tags[0]}]`,
        )
        .join('') +
      `[/${config.blockTag}]`;

    if (previewContainer) previewContainer.innerHTML = '';

    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const fld = config.fields[key];
      if (!fld) return;
      const value = currentMask[key];
      let el;
      if (fld.type === 'avatar') {
        el = createEl('img');
        el.className = 'mask-preview-avatar';
        el.src = value || config.defaultAvatar;
      } else if (fld.type === 'bbcode') {
        el = createEl('div');
        el.className = 'mask-preview-bbcode';
        el.innerHTML = convertBbcodeToHtml(value || '');
      } else if (fld.type === 'html') {
        el = createEl('div');
        el.className = 'mask-preview-html';
        el.innerHTML = sanitizeHtml(value || '');
      } else if (fld.type === 'link') {
        el = createEl('a');
        el.className = 'mask-preview-link';
        el.href = normalizeUrl(value || '');
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
        el.textContent = value || fld.label || key;
      } else {
        el = createEl('div');
        el.className = 'mask-preview-text';
        el.textContent = value || fld.label || key;
      }
      previewContainer?.appendChild(el);
    });

    nodes.dialog?.querySelector('#mask-preview')?.remove();
    const codeEl = createEl('pre');
    codeEl.id = 'mask-preview';
    codeEl.className = 'mask-preview-code';
    codeEl.textContent = code;
    nodes.dialog?.querySelector('form')?.after(codeEl);

    validateForm();
  };

  const insertTemplate = (key) => {
    const fld = config.fields[key];
    const el = $(`#mask-${key}`);
    if (fld?.defaultCode && el) {
      el.value = fld.defaultCode;
      el.dispatchEvent(new Event('input'));
    }
  };

  const fillForm = (data) => {
    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const el = $(`#mask-${key}`);
      if (el) el.value = data[key] || '';
    });
    updatePreview();
    saveDraft();
  };

  const insertCode = () => {
    const codeEl = $('#mask-preview');
    if (!codeEl) return;
    const code = codeEl.textContent;
    const ta = getActiveTextarea();
    if (!ta) return;
    if (ta.type === 'sceditor') {
      ta.insert(code);
    } else if ('setRangeText' in ta) {
      ta.setRangeText(code, ta.selectionStart, ta.selectionEnd, 'end');
      ta.focus();
    } else {
      ta.value += code;
      ta.focus();
    }
  };

  const saveCurrentMask = async () => {
    const record = JSON.stringify(currentMask);
    if (editingIndex !== null) {
      MaskStore.update(editingIndex, record);
      showToast('Маска обновлена!', { type: 'success' });
    } else {
      MaskStore.add(record);
      showToast('Маска сохранена!', { type: 'success' });
    }
    await MaskStore.save();
    editingIndex = null;
    clearDraft();
  };

  function createMaskItem(record, index) {
    const m = JSON.parse(record);
    const wrap = createEl('div');
    wrap.className = 'mask-storage-item';
    wrap.draggable = false;
    wrap.dataset.index = index;
    const handle = createEl('span');
    handle.className = 'drag-handle';
    handle.innerHTML = '&#x22EE;';
    handle.draggable = true;
    wrap.append(handle);
    handle.addEventListener('dragstart', (e) =>
      DragDrop.onDragStart(e, wrap, index),
    );
    handle.addEventListener('dragend', (e) => DragDrop.onDragEnd(e, wrap));
    handle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handle.draggable = true;
      handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
    });
    handle.addEventListener('touchend', (e) => {
      handle.draggable = false;
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    });
    const upBtn = createEl('button');
    upBtn.type = 'button';
    upBtn.className = 'mask-move-up';
    upBtn.title = 'Переместить вверх';
    upBtn.innerHTML = '&#x2191;';
    upBtn.tabIndex = 0;
    upBtn.setAttribute('aria-label', 'Переместить вверх');
    wrap.append(upBtn);
    const downBtn = createEl('button');
    downBtn.type = 'button';
    downBtn.className = 'mask-move-down';
    downBtn.title = 'Переместить вниз';
    downBtn.innerHTML = '&#x2193;';
    downBtn.tabIndex = 0;
    downBtn.setAttribute('aria-label', 'Переместить вниз');
    wrap.append(downBtn);
    const img = createEl('img');
    img.src = m.avatar || config.defaultAvatar;
    img.className = 'mask-storage-avatar';
    wrap.append(img);
    const tooltipHtml = Object.entries(m)
      .map(
        ([k, v]) =>
          `<div class="mask-tooltip-field"><b>${escHtml(
            config.fields[k]?.tags[0] || k,
          )}</b>: ${escHtml(v)}</div>`,
      )
      .join('');
    img.addEventListener('mouseenter', (e) => showTooltip(e, tooltipHtml));
    img.addEventListener('mouseleave', hideTooltip);
    const del = createEl('span');
    del.className = 'mask-delete-btn';
    del.textContent = '\u00D7';
    del.title = 'Удалить';
    wrap.append(del);
    return wrap;
  }

  function renderStoragePanel(storagePanel) {
    storagePanel.innerHTML = '';
    if (!MaskStore.masks.length) {
      const emptyMsg = createEl('div');
      emptyMsg.className = 'mask-storage-empty';
      emptyMsg.innerHTML =
        '<div><div>📋</div><b>Нет сохранённых масок</b><br><span>Используйте форму, чтобы добавить первую маску.</span></div>';
      storagePanel.appendChild(emptyMsg);
      return;
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < MaskStore.masks.length; i++)
      frag.appendChild(createMaskItem(MaskStore.masks[i], i, storagePanel));
    storagePanel.appendChild(frag);
  }

  const openDialog = async () => {
    if ($('#mask-overlay')) return;
    nodes.overlay = document.body.appendChild(createEl('div'));
    nodes.overlay.id = 'mask-overlay';
    nodes.overlay.addEventListener('click', (e) => {
      if (e.target === nodes.overlay) closeDialog();
    });
    document.body.classList.add('mask-modal-open');
    nodes.dialog = nodes.overlay.appendChild(createEl('div'));
    nodes.dialog.id = 'mask-dialog';
    nodes.dialog.innerHTML = `
    <div class="mask-content">
      <div class="mask-preview-panel"></div>
      <div class="mask-form-panel">
        <div class="mask-templates-container">
          <label for="mask-template-select">Шаблон:</label>
          <select id="mask-template-select">
            <option value="0">Пустой</option>
            <option value="1">Администратор</option>
            <option value="2">Весёлый</option>
          </select>
        </div>
        <form class="mask-form"></form>
      </div>
      <div class="mask-storage-panel"></div>
    </div>
    <div class="mask-actions"></div>
  `;
    cacheDomElements();
    if (escHandler) document.removeEventListener('keydown', escHandler);
    if (focusTrapHandler)
      nodes.dialog.removeEventListener('keydown', focusTrapHandler);

    escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener('keydown', escHandler);

    focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const sel = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');
      const focusable = [...nodes.dialog.querySelectorAll(sel)];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    nodes.dialog.addEventListener('keydown', focusTrapHandler);

    closeDialog = () => {
      document.body.classList.remove('mask-modal-open');
      nodes.overlay?.remove();
      currentMask = {};
      document.removeEventListener('keydown', escHandler);
      nodes.dialog?.removeEventListener('keydown', focusTrapHandler);
      escHandler = null;
      focusTrapHandler = null;
    };

    await MaskStore.load();

    const { previewPanel, formEl, storagePanel, actionsPanel, templateSelect } =
      nodes;

    storagePanel.addEventListener('dragover', (e) =>
      DragDrop.onDragOver(e, storagePanel),
    );
    storagePanel.addEventListener('drop', (e) =>
      DragDrop.onDrop(e, storagePanel, MaskStore, renderStoragePanel),
    );
    storagePanel.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      storagePanel.classList.add('drag-over');
    });
    storagePanel.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      storagePanel.classList.remove('drag-over');
    });

    renderStoragePanel(storagePanel);

    const templates = [
      {},
      { author: 'Admin', status: 'Всея форума' },
      { status: '?? Рад всех видеть!' },
    ];
    templateSelect.addEventListener('change', (e) => {
      fillForm(templates[Number(e.target.value)]);
      showToast('Шаблон подставлен', { type: 'info' });
      setTimeout(() => $('#mask-author')?.focus(), 0);
    });

    formEl.innerHTML = '';
    config.userFieldOrder.forEach((className) => {
      const key = getFieldKeyByClass(className);
      if (!key) return;
      const fld = config.fields[key];
      const value = currentMask[key] || '';
      const field = createFormField(fld, key, value);
      field
        .querySelector('.mask-template-btn')
        ?.setAttribute('data-field', key);
      formEl.appendChild(field);
    });

    formEl.addEventListener('click', (e) => {
      if (e.target.matches('.mask-template-btn')) {
        insertTemplate(e.target.dataset.field);
        showToast('Шаблон поля подставлен', { type: 'info' });
        setTimeout(() => $('#mask-author')?.focus(), 0);
      }
    });

    previewContainer = previewPanel;
    errorContainer = createEl('div');
    errorContainer.className = 'mask-errors';
    formEl.after(errorContainer);

    actionsPanel.innerHTML = '';
    [
      ['Вставить и сохранить', 'save'],
      ['Вставить без сохранения', 'insert'],
      ['Очистить', 'clear'],
      ['Отмена', 'cancel'],
    ].forEach(([text, action]) => {
      const btn = createActionButton(text, action);
      actionsPanel.appendChild(btn);
    });

    actionsPanel.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mask-action-btn');
      if (!btn) return;
      const act = btn.dataset.action;
      if (act === 'save') {
        if (!validateForm()) {
          showToast('Исправьте ошибки в форме.', { type: 'warning' });
          return;
        }
        insertCode();
        try {
          await saveCurrentMask();
          renderStoragePanel(storagePanel);
          closeDialog();
        } catch {}
      } else if (act === 'insert') {
        if (!validateForm()) {
          showToast('Исправьте ошибки в форме.', { type: 'warning' });
          return;
        }
        insertCode();
        clearDraft();
        closeDialog();
        showToast('Маска вставлена (без сохранения)', { type: 'success' });
      } else if (act === 'clear') {
        editingIndex = null;
        clearFormFields();
        updatePreview();
        clearDraft();
        showToast('Поля очищены', { type: 'info' });
      } else if (act === 'cancel') {
        closeDialog();
        showToast('Отмена', { type: 'info' });
      }
    });

    storagePanel.addEventListener('click', async (e) => {
      const item = e.target.closest('.mask-storage-item');
      const idx = item ? +item.dataset.index : -1;
      if (e.target.matches('.mask-delete-btn') && idx > -1) {
        if (!(await dialog('Удалить маску?'))) return;
        MaskStore.remove(idx);
        await MaskStore.save();
        renderStoragePanel(storagePanel);
        showUndoToast(async () => {
          MaskStore.undoDelete();
          await MaskStore.save();
          renderStoragePanel(storagePanel);
          showToast('Маска восстановлена.', { type: 'success' });
        });
        return;
      }
      if (e.target.matches('.mask-storage-avatar') && idx > -1) {
        editingIndex = idx;
        fillForm(JSON.parse(MaskStore.masks[idx]));
        showToast('Маска загружена для редактирования', { type: 'info' });
        setTimeout(() => $('#mask-author')?.focus(), 0);
        return;
      }
      if (e.target.matches('.mask-move-up') && idx > 0) {
        MaskStore.move(idx, idx - 1);
        await MaskStore.save();
        renderStoragePanel(storagePanel);
        showToast('Маска перемещена', { type: 'info' });
        return;
      }
      if (
        e.target.matches('.mask-move-down') &&
        idx < MaskStore.masks.length - 1
      ) {
        MaskStore.move(idx, idx + 1);
        await MaskStore.save();
        renderStoragePanel(storagePanel);
        showToast('Маска перемещена', { type: 'info' });
        return;
      }
    });

    loadDraft();
    updatePreview();
    setTimeout(() => $('#mask-author')?.focus(), 0);
  };

  async function init() {
    document.addEventListener('pun_post', () => processPosts());
    document.addEventListener('pun_edit', () => processPosts());
    addToolbarButton();

    if ($(SELECTORS.previewBox)) {
      observePreviewChanges();
      document.addEventListener('pun_preview', scrubPreview);
      document.addEventListener('pun_preedit', scrubPreview);
    }

    if (getGroupId() === 1) {
      const toSave = {
        fields: config.fields,
        userFields: config.userFieldOrder,
        blockTag: config.blockTag,
        defaultAvatar: config.defaultAvatar,
        buttonImage: config.buttonIcon,
        sanitize: config.sanitize,
      };
      const getParams = new URLSearchParams({
        method: 'storage.get',
        key: 'profileMaskSettings',
        app_id: 16777215,
      });
      try {
        const j = await helpers.request(`/api.php?${getParams}`, {
          responseType: 'json',
        });
        const saved = j?.response?.storage?.data?.profileMaskSettings;
        if (saved !== JSON.stringify(toSave)) {
          const body = new URLSearchParams({
            method: 'storage.set',
            token: window.ForumAPITicket,
            key: 'profileMaskSettings',
            app_id: 16777215,
            value: JSON.stringify(toSave),
          });
          await helpers.request('/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: body,
          });
        }
      } catch {}
    }

    processPosts();
    helpers.register('bbcodeMask', {
      CONFIG: config,
      removeMaskTagsFromPreview,
      Cache,
    });
  }

  helpers.runOnceOnReady(init);
})();
