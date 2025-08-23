(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const config = helpers.getConfig('bbcodeFloat', {});
  const BB_INSERT_FN = window.bbcode || (() => {});

  function injectUI() {
    const ref = $(config.buttonAfterSelector);
    if (!ref || $(`#${config.floatButtonId}`)) return;

    const td = createEl('td');
    td.id = config.floatButtonId;
    td.title = 'Обтекание';
    td.innerHTML = '<img src="/i/blank.gif" style="cursor:pointer">';
    ref.after(td);

    let bar = $(`#${config.toolbarId}`);
    if (!bar) {
      bar = createEl('div');
      bar.id = config.toolbarId;
      bar.className = 'float-toolbar';
      bar.style.display = 'none';
      bar.innerHTML = `␊
        <strong>Обтекание</strong>␊
        <span class="float-btn" data-dir="left"  title="Слева"><i class="fa-solid fa-indent"></i></span>␊
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

    $$('.float-btn', bar).forEach((btn) => {
      btn.addEventListener('click', () => {
        BB_INSERT_FN(`[float=${btn.dataset.dir}]`, '[/float]');
        bar.style.display = 'none';
      });
    });
  }

  function transformFloats(root) {
    const rx = config.floatRx;
    $$(
      `${config.postContentSelector}, ${config.previewSelector}`,
      root,
    ).forEach((el) => {
      rx.lastIndex = 0;
      if (rx.test(el.innerHTML)) {
        el.innerHTML = el.innerHTML.replace(
          rx,
          (_, dir, html) =>
            `<span style="${config.floatStyles[dir]}">${html}</span>`,
        );
      }
    });
  }

  let previewObserver;
  function watchPreview() {
    const box = $(config.previewSelector);
    if (box && !previewObserver) {
      previewObserver = new MutationObserver(() => transformFloats(document));
      previewObserver.observe(box, { childList: true, subtree: true });
    }
  }

  function init() {
    injectUI();
    transformFloats(document);
    watchPreview();
  }

  helpers.ready(init);
  document.addEventListener('pun_main_ready', init);
  document.addEventListener('pun_preview', init);
})();
