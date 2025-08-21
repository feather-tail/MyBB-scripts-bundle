(() => {
  const BUTTON_AFTER = 'td#button-link';
  const POST_CONTENT_SEL = '.post-content';
  const PREVIEW_SEL = '#post-preview .post-content';
  const TOOLBAR_ID = 'float-toolbar';
  const FLOAT_BTN_ID = 'button-float';
  const BB_INSERT_FN = window.bbcode || (() => {});

  const FLOAT_STYLES = {
    left: 'float:left;margin:25px;text-align:left;display:inline-block;max-width:90%',
    right:
      'float:right;margin:25px;text-align:right;display:inline-block;max-width:90%',
  };
  const FLOAT_RX = /\[float=(left|right)\]([\s\S]{1,11000}?)\[\/float\]/gi;

  function injectUI() {
    const ref = document.querySelector(BUTTON_AFTER);
    if (!ref || document.getElementById(FLOAT_BTN_ID)) return;

    const td = document.createElement('td');
    td.id = FLOAT_BTN_ID;
    td.title = 'Обтекание';
    td.innerHTML = '<img src="/i/blank.gif" style="cursor:pointer">';
    ref.after(td);

    let bar = document.getElementById(TOOLBAR_ID);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = TOOLBAR_ID;
      bar.className = 'float-toolbar';
      bar.style.display = 'none';
      bar.innerHTML = `
        <strong>Обтекание</strong>
        <span class="float-btn" data-dir="left"  title="Слева"><i class="fa-solid fa-indent"></i></span>
        <span class="float-btn" data-dir="right" title="Справа"><i class="fa-solid fa-indent" style="transform:scaleX(-1)"></i></span>`;
      document.body.append(bar);
    }

    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = td.getBoundingClientRect();
      bar.style.left = `${r.left + scrollX}px`;
      bar.style.top = `${r.bottom + scrollY + 4}px`;
      bar.style.display = bar.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!bar.contains(e.target) && e.target !== td)
        bar.style.display = 'none';
    });
    bar.addEventListener('click', (e) => e.stopPropagation());

    bar.querySelectorAll('.float-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        BB_INSERT_FN(`[float=${btn.dataset.dir}]`, '[/float]');
        bar.style.display = 'none';
      });
    });
  }

  function transformFloats(root) {
    root
      .querySelectorAll(`${POST_CONTENT_SEL}, ${PREVIEW_SEL}`)
      .forEach((el) => {
        if (FLOAT_RX.test(el.innerHTML)) {
          el.innerHTML = el.innerHTML.replace(
            FLOAT_RX,
            (_, dir, html) =>
              `<span style="${FLOAT_STYLES[dir]}">${html}</span>`,
          );
        }
      });
  }

  let previewObserver;
  function watchPreview() {
    const box = document.querySelector(PREVIEW_SEL);
    if (box && !previewObserver) {
      previewObserver = new MutationObserver(() => transformFloats(document));
      previewObserver.observe(box, { childList: true, subtree: true });
    }
  }

  function initAll() {
    injectUI();
    transformFloats(document);
    watchPreview();
  }

  document.addEventListener('DOMContentLoaded', initAll);
  document.addEventListener('pun_main_ready', initAll);
  document.addEventListener('pun_preview', initAll);
})();
