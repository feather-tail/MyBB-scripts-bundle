(() => {
  'use strict';

  const NO_RIGHTS_TEXT = 'Вы не имеете прав для доступа к этой странице.';
  const isPostPage = /\/post\.php$/i.test(location.pathname);
  if (!isPostPage) return;

  const params = new URLSearchParams(location.search);
  const tid = params.get('tid');
  if (!tid) return;

  const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  if (!bodyText.includes(NO_RIGHTS_TEXT)) return;

  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  };

  const reserveText = lsGet('ReservePost') || '';
  if (!reserveText.trim()) return;

  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_` +
    `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;

  const safeKey1 = `topic${tid}`;
  const safeKey2 = `topic${tid}_closed_backup_${stamp}`;

  lsSet(safeKey1, reserveText);
  lsSet(safeKey2, reserveText);

  const existing = document.getElementById('ks-closed-topic-recovery');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'ks-closed-topic-recovery';
  overlay.innerHTML = `
    <div class="ks-ctr__panel" role="dialog" aria-modal="true" aria-label="Восстановление текста поста">
      <div class="ks-ctr__header">
        <div class="ks-ctr__title">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          Тема закрыта — текст сохранён
        </div>
        <button type="button" class="ks-ctr__iconbtn" data-act="close" aria-label="Закрыть">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>

      <div class="ks-ctr__desc">
        Вы попытались отправить пост в закрытую тему (<b>tid=${tid}</b>).<br>
        Текст найден в <code>localStorage.ReservePost</code> и скопирован в:
        <ul class="ks-ctr__ul">
          <li><code>${safeKey1}</code></li>
          <li><code>${safeKey2}</code></li>
        </ul>
        На всякий случай скопируйте или скачайте текст ниже.
      </div>

      <textarea class="ks-ctr__ta" spellcheck="false"></textarea>

      <div class="ks-ctr__btns">
        <button type="button" class="ks-ctr__btn" data-act="copy">
          <i class="fa-regular fa-copy" aria-hidden="true"></i>
          Скопировать
        </button>
        <button type="button" class="ks-ctr__btn" data-act="download">
          <i class="fa-regular fa-file-lines" aria-hidden="true"></i>
          Скачать .txt
        </button>
      </div>

      <div class="ks-ctr__hint" data-hint></div>
    </div>
  `;

  const ta = overlay.querySelector('.ks-ctr__ta');
  const hint = overlay.querySelector('[data-hint]');
  const setHint = (msg) => {
    if (hint) hint.textContent = msg || '';
  };

  const mount = () => {
    document.body.appendChild(overlay);
    ta.value = reserveText;
    ta.focus();
    ta.setSelectionRange(0, 0);
  };

  const copyText = async () => {
    const text = ta.value || '';
    try {
      await navigator.clipboard.writeText(text);
      setHint('Скопировано в буфер обмена.');
    } catch {
      ta.focus();
      ta.select();
      setHint('Автокопирование недоступно — текст выделен, нажмите Ctrl+C.');
    }
  };

  const downloadTxt = () => {
    try {
      const text = ta.value || '';
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `post_tid_${tid}_${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setHint('Файл скачан.');
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setHint('Не удалось скачать файл — лучше скопируйте текст.');
    }
  };

  overlay.addEventListener('click', (e) => {
    const btn = e.target?.closest('button[data-act]');
    if (!btn) return;

    const act = btn.dataset.act;
    if (act === 'close') {
      overlay.remove();
      return;
    }
    if (act === 'copy') {
      copyText();
      return;
    }
    if (act === 'download') {
      downloadTxt();
      return;
    }
  });

  const onKeyDown = (e) => {
    if (
      e.key === 'Escape' &&
      document.getElementById('ks-closed-topic-recovery')
    ) {
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown, true);
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  mount();
})();
