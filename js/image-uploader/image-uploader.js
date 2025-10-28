(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl, uid, formatBytes } = helpers;

  const rfu = {
    CONFIG: window.ScriptConfig.imageUploader,
    inTypes(f) {
      return (
        !f.type ||
        rfu.CONFIG.allowedMimes.includes(f.type) ||
        /\.(jpe?g|png|gif|webp)$/i.test(f.name)
      );
    },
    readThumb(f) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onerror = rej;
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
    },
    targetTA: null,
    caret: { start: 0, end: 0 },
    bindCaretTracking(ta) {
      if (!ta) return;
      const upd = () => {
        rfu.caret.start = ta.selectionStart || 0;
        rfu.caret.end = ta.selectionEnd || rfu.caret.start;
      };
      ['keyup', 'mouseup', 'input', 'select', 'focus'].forEach((ev) =>
        ta.addEventListener(ev, upd),
      );
      upd();
    },
    insertAtCaret(text) {
      const ta = rfu.targetTA || $(rfu.CONFIG.replyTextareaSelector);
      if (!ta) return;
      const s = rfu.caret.start ?? ta.selectionStart ?? ta.value.length;
      const e = rfu.caret.end ?? ta.selectionEnd ?? ta.value.length;
      const before = ta.value.slice(0, s),
        after = ta.value.slice(e);
      ta.focus({ preventScroll: true });
      ta.value = before + text + after;
      const pos = before.length + text.length;
      ta.setSelectionRange(pos, pos);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      rfu.caret.start = rfu.caret.end = pos;
    },
    bb({ fmt, direct, thumb, name }) {
      switch (fmt) {
        case 'link':
          return `[url=${direct}]${name || direct}[/url]`;
        case 'thumb':
          return thumb
            ? `[url=${direct}][img]${thumb}[/img][/url]`
            : `[img]${direct}[/img]`;
        default:
          return `[img]${direct}[/img]`;
      }
    },
    uploadXHR({
      url,
      method = 'POST',
      headers = {},
      formData,
      onProgress,
      signal,
    }) {
      return helpers
        .request(url, {
          method,
          data: formData,
          headers,
          onProgress,
          signal,
        })
        .then(async (res) => {
          const text = await res.text();
          const contentType = res.headers.get('Content-Type') || '';
          if (res.ok) return { status: res.status, contentType, text };
          const snippet = text.slice(0, 180).replace(/\s+/g, ' ');
          throw new Error(`Upload error (HTTP ${res.status}). ${snippet}`);
        });
    },
    async host_forum(file, onProgress, signal) {
      const cfg = rfu.CONFIG.forumUpload || {};
      const token =
        (typeof cfg.token === 'function' ? cfg.token() : cfg.token) || '';
      if (!token) throw new Error('Forum: нет токена');

      const fd = new FormData();
      fd.append('method', 'upload.userfile');
      fd.append('token', token);
      fd.append('files[]', file);

      const { contentType, text, status } = await rfu.uploadXHR({
        url: cfg.endpoint || '/upload',
        method: 'POST',
        headers:
          (typeof cfg.headers === 'function' ? cfg.headers() : cfg.headers) ||
          {},
        formData: fd,
        onProgress,
        signal,
      });

      if (!/application\/json/i.test(contentType))
        throw new Error(`Forum: ожидался JSON (HTTP ${status})`);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Forum: некорректный JSON');
      }
      const resp = data && (data.response || data.data || data);
      const filename = resp && (resp.filename || resp.name);
      if (!filename) throw new Error('Forum: нет имени файла в ответе');

      const buildUrl =
        typeof cfg.buildUrl === 'function'
          ? cfg.buildUrl
          : (fname) => `${location.origin}/uploads/${fname}`;
      const direct = buildUrl(filename);
      return { direct, thumb: null, deleteUrl: null };
    },
    async host_imgbb(file, onProgress, signal) {
      const key = rfu.CONFIG.imgbb?.key;
      if (!key) {
        throw new Error('ImgBB: не задан API key');
      }
    
      const fd = new FormData();
      fd.append('image', file);
      fd.append('key', key);
    
      if (typeof onProgress === 'function') {
        try {
          onProgress(0);
        } catch (_) {}
      }
      
      const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: fd,
        signal,
        credentials: 'omit',
      });
    
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `ImgBB: HTTP ${res.status} ${txt.slice(0, 180).replace(/\s+/g, ' ')}`
        );
      }
    
      let resp;
      try {
        resp = await res.json();
      } catch (e) {
        throw new Error('ImgBB: invalid JSON');
      }
    
      if (!resp?.success || !resp?.data?.url) {
        throw new Error(resp?.error?.message || 'ImgBB: upload failed');
      }
    
      if (typeof onProgress === 'function') {
        try {
          onProgress(100);
        } catch (_) {}
      }
    
      return {
        direct: resp.data.url,
        thumb: resp.data?.thumb?.url || null,
        deleteUrl: resp.data?.delete_url || null,
      };
    },
    HOSTS: {},
    mounted: false,
    addFiles: null,
    openUI: null,
    closeUI: null,
    setupAutoWidth(modal, anchorEl) {
      const apply = () => {
        const w = Math.min(640, Math.max(480, anchorEl.clientWidth - 16));
        modal.style.maxWidth = w + 'px';
      };
      const ro = new ResizeObserver(apply);
      ro.observe(anchorEl);
      window.addEventListener('resize', apply);
      apply();
    },
    mountUI() {
      if (rfu.mounted) return;
      rfu.mounted = true;

      const ta = document.querySelector(rfu.CONFIG.replyTextareaSelector);
      const anchor =
        document.querySelector(rfu.CONFIG.anchorSelector) ||
        ta?.parentElement ||
        document.body;
      if (anchor) anchor.classList.add('rfu-anchor');

      let layer = anchor.querySelector(':scope > .rfu-layer');
      if (!layer) {
        layer = createEl('div', { className: 'rfu-layer' });
        anchor.appendChild(layer);
      }

      rfu.targetTA =
        ta || document.querySelector(rfu.CONFIG.replyTextareaSelector);
      rfu.bindCaretTracking(rfu.targetTA);

      const savedHost = localStorage.getItem(rfu.CONFIG.storage.host);
      const savedFmt = localStorage.getItem(rfu.CONFIG.storage.fmt);
      let currentHost =
        savedHost && rfu.CONFIG.enabledHosts.includes(savedHost)
          ? savedHost
          : rfu.CONFIG.defaultHost;
      let currentFmt = savedFmt || rfu.CONFIG.defaultInsertFormat;

      const modal = createEl('div', {
        className: 'rfu-modal',
        html: `
      <div class="rfu-toolbar">
        <div class="rfu-seg" id="rfu-hosts"></div>
        <div class="rfu-seg">
          <span class="rfu-label">Вставка:</span>
          <select id="rfu-fmt" class="rfu-select">
            <option value="img">Картинка [img]</option>
            <option value="link">Ссылка [url]</option>
            <option value="thumb">Превью → полно</option>
          </select>
        </div>
        <button class="rfu-btn rfu-x" id="rfu-close" type="button" title="Закрыть"><span>×</span></button>
      </div>
      <div class="rfu-drop" id="rfu-drop">
        <div class="rfu-hint">Выберите файлы или перетащите в зону загрузки</div>
        <div class="rfu-seг" style="padding-top:.4rem">
          <button id="rfu-choose" class="rfu-btn" type="button">Выбрать файлы</button>
          <input id="rfu-file" type="file" accept="image/*" multiple hidden>
        </div>
      </div>
      <div class="rfu-list" id="rfu-list"></div>
      <div class="rfu-footer">
        <button class="rfu-btn" id="rfu-insert-all" type="button">Вставить все</button>
        <button class="rfu-btn" id="rfu-clear" type="button">Очистить</button>
      </div>
    `,
      });
      layer.appendChild(modal);
      rfu.setupAutoWidth(modal, anchor);

      const hostsSeg = $('#rfu-hosts', modal);
      hostsSeg.insertAdjacentHTML(
        'beforeend',
        `<span class="rfu-label">Хостинг:</span>`,
      );
      for (const hostName of rfu.CONFIG.enabledHosts) {
        const id = 'rfu-host-' + hostName;
        hostsSeg.insertAdjacentHTML(
          'beforeend',
          `
        <label class="rfu-host" title="${hostName}">
          <input type="radio" name="rfu-host" id="${id}" value="${hostName}">
          <span>${hostName}</span>
        </label>
      `,
        );
      }
      $$('input[name="rfu-host"]', modal).forEach(
        (r) => (r.checked = r.value === currentHost),
      );
      $('#rfu-fmt', modal).value = currentFmt;

      modal.addEventListener('change', (e) => {
        if (e.target.name === 'rfu-host') {
          currentHost = e.target.value;
          localStorage.setItem(rfu.CONFIG.storage.host, currentHost);
        }
        if (e.target.id === 'rfu-fmt') {
          currentFmt = e.target.value;
          localStorage.setItem(rfu.CONFIG.storage.fmt, currentFmt);
        }
      });

      $('#rfu-choose', modal).addEventListener('click', () =>
        $('#rfu-file', modal).click(),
      );
      $('#rfu-file', modal).addEventListener('change', (e) => {
        if (e.target.files?.length) rfu.addFiles([...e.target.files]);
        e.target.value = '';
      });

      const drop = $('#rfu-drop', modal);
      ['dragenter', 'dragover'].forEach((ev) =>
        drop.addEventListener(
          ev,
          (e) => {
            e.preventDefault();
            drop.classList.add('rfu-hover');
          },
          { passive: false },
        ),
      );
      ['dragleave', 'drop'].forEach((ev) =>
        drop.addEventListener(
          ev,
          (e) => {
            e.preventDefault();
            drop.classList.remove('rfu-hover');
          },
          { passive: false },
        ),
      );
      drop.addEventListener('drop', (e) => {
        const files = [...(e.dataTransfer?.files || [])].filter(
          (f) => f && rfu.inTypes(f),
        );
        if (files.length) rfu.addFiles(files);
      });

      $('#rfu-close', modal).addEventListener('click', () => rfu.closeUI());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') rfu.closeUI();
      });

      const items = new Map();
      const fileSeen = new Set();

      function createRow(file) {
        const id = 'rfu-' + uid();
        const row = createEl('div', { className: 'rfu-item', id });
        return rfu
          .readThumb(file)
          .catch(() => '')
          .then((thumbSrc) => {
            row.innerHTML = `
          <img class="rfu-thumb" src="${thumbSrc}" alt="">
          <div class="rfu-meta">
            <div><b>${file.name}</b> • ${formatBytes(file.size)}</div>
            <div class="rfu-progress"><div class="rfu-bar"></div></div>
          </div>
          <div class="rfu-actions">
            <button class="rfu-btn rfu-btn--ok" type="button" data-act="upload">Загрузить</button>
            <button class="rfu-btn" type="button" data-act="remove">Удалить</button>
          </div>`;
            return {
              id,
              row,
              file,
              status: 'pending',
              direct: null,
              thumb: null,
              progressEl: row.querySelector('.rfu-bar'),
              ctrl: null,
            };
          });
      }

      async function doUpload(item) {
        if (item.status === 'uploading' || item.status === 'done') return;
        const setP = (p) => {
          item.progressEl.style.width = (p | 0) + '%';
        };
        const chosenHost =
          modal.querySelector('input[name="rfu-host"]:checked')?.value ||
          rfu.CONFIG.defaultHost;
        const adapter = rfu.HOSTS[chosenHost];
        if (!adapter || !rfu.CONFIG.enabledHosts.includes(chosenHost)) {
          item.row
            .querySelector('.rfu-meta')
            .insertAdjacentHTML(
              'beforeend',
              `<div class="rfu-error">Хостинг не настроен: ${chosenHost}</div>`,
            );
          return;
        }
        item.status = 'uploading';
        item.ctrl = new AbortController();
        const actions = item.row.querySelector('.rfu-actions');
        actions.innerHTML = `<button class="rfu-btn" type="button" data-act="cancel">Отменить</button>`;
        try {
          const res = await adapter(item.file, setP, item.ctrl.signal);
          item.status = 'done';
          item.direct = res.direct;
          item.thumb = res.thumb || null;
          setP(100);
          const meta = item.row.querySelector('.rfu-meta');
          meta.insertAdjacentHTML(
            'beforeend',
            `<div style="margin-top:.35rem;word-break:break-all"><a href="${item.direct}" target="_blank" rel="noopener">${item.direct}</a></div>`,
          );
          actions.innerHTML = `
          <button class="rfu-btn rfu-btn--ok" type="button" data-act="insert">Вставить</button>
          <button class="rfu-btn" type="button" data-act="remove">Удалить</button>`;
        } catch (err) {
          item.status = 'error';
          item.row
            .querySelector('.rfu-meta')
            .insertAdjacentHTML(
              'beforeend',
              `<div class="rfu-error">Ошибка: ${String(
                err.message || err,
              )}</div>`,
            );
          actions.innerHTML = `
          <button class="rfu-btn rfu-btn--ok" type="button" data-act="upload">Загрузить</button>
          <button class="rfu-btn" type="button" data-act="remove">Удалить</button>`;
        } finally {
          item.ctrl = null;
        }
      }

      $('#rfu-insert-all', modal).addEventListener('click', () => {
        const fmtSel = $('#rfu-fmt', modal);
        const parts = [];
        items.forEach((it) => {
          if (it.status === 'done' && it.direct) {
            parts.push(
              rfu.bb({
                fmt: fmtSel.value,
                direct: it.direct,
                thumb: it.thumb,
                name: it.file.name,
              }),
            );
          }
        });
        if (parts.length) rfu.insertAtCaret(parts.join('\n\n'));
      });

      $('#rfu-clear', modal).addEventListener('click', () => {
        items.clear();
        fileSeen.clear();
        $('#rfu-list', modal).innerHTML = '';
      });

      $('#rfu-list', modal).addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const row = e.target.closest('.rfu-item');
        if (!row) return;
        const item = items.get(row.id);
        if (!item) return;
        const act = btn.dataset.act;
        if (act === 'upload') {
          doUpload(item);
        }
        if (act === 'insert') {
          const fmtSel = $('#rfu-fmt', modal);
          rfu.insertAtCaret(
            rfu.bb({
              fmt: fmtSel.value,
              direct: item.direct,
              thumb: item.thumb,
              name: item.file.name,
            }),
          );
        }
        if (act === 'remove') {
          if (item.ctrl) {
            try {
              item.ctrl.abort();
            } catch {}
          }
          const sig = [
            item.file.name,
            item.file.size,
            item.file.lastModified,
          ].join(':');
          fileSeen.delete(sig);
          items.delete(item.id);
          row.remove();
        }
        if (act === 'cancel') {
          if (item.ctrl) {
            try {
              item.ctrl.abort();
            } catch {}
          }
        }
      });

      rfu.addFiles = async (files) => {
        const pack = files
          .filter(rfu.inTypes)
          .slice(0, rfu.CONFIG.maxFilesPerBatch);
        if (!pack.length) return;
        const list = $('#rfu-list', modal);
        for (const f of pack) {
          const key = [f.name, f.size, f.lastModified].join(':');
          if (fileSeen.has(key)) continue;
          fileSeen.add(key);
          const it = await createRow(f);
          items.set(it.id, it);
          list.prepend(it.row);
        }
      };

      rfu.openUI = () => {
        modal.classList.add('rfu-open');
      };
      rfu.closeUI = () => {
        modal.classList.remove('rfu-open');
      };
    },
    ensureMount() {
      if (!rfu.mounted) rfu.mountUI();
    },
    handleIncomingFiles(files) {
      if (!files?.length) return;
      rfu.ensureMount();
      rfu.openUI && rfu.openUI();
      rfu.addFiles && rfu.addFiles(files);
    },
    extractPastedFiles(e) {
      const items = [...(e.clipboardData?.items || [])]
        .map((i) => i.getAsFile())
        .filter(Boolean);
      return items.filter(rfu.inTypes);
    },
    extractDragFiles(e) {
      const files = [...(e.dataTransfer?.files || [])].filter(Boolean);
      return files.filter(rfu.inTypes);
    },
  };

  rfu.HOSTS = { forum: rfu.host_forum, imgbb: rfu.host_imgbb };

  function init() {
    document.addEventListener('paste', (e) => {
      if (!rfu.CONFIG.showOnDemand) return;
      const files = rfu.extractPastedFiles(e);
      if (files.length) {
        rfu.handleIncomingFiles(files);
      }
    });
    document.addEventListener('drop', (e) => {
      if (!rfu.CONFIG.showOnDemand) return;
      const files = rfu.extractDragFiles(e);
      if (files.length) {
        e.preventDefault();
        rfu.handleIncomingFiles(files);
      }
    });
    document.addEventListener('dragover', (e) => {
      if (!rfu.CONFIG.showOnDemand) return;
      const dt = e.dataTransfer;
      if (!dt) return;
      const types = [...(dt.items || [])].map((i) => i.type || '');
      const hasImage = types.some((t) => /^image\//.test(t));
      if (hasImage) e.preventDefault();
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('imageUploader', rfu);
})();
