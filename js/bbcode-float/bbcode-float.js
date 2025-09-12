(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl } = helpers;
  const config = helpers.getConfig('bbcodeFloat', {});
  const BB_INSERT_FN = window.bbcode || (() => {});

  function injectUI() {
    const ref = $(config.buttonAfterSelector);
    if (!ref || $(`#${config.floatButtonId}`)) return;

    const td = createEl('td', {
      id: config.floatButtonId,
      title: config.buttonTitle,
    });
    td.append(
      createEl('img', { src: config.buttonIcon, style: 'cursor:pointer' }),
    );
    ref.after(td);

    let bar = $(`#${config.toolbarId}`);
    if (!bar) {
      bar = createEl('div', {
        id: config.toolbarId,
        className: 'float-toolbar',
      });
      bar.style.display = 'none';

      const title = createEl('strong', { text: config.toolbarTitle });

      const leftBtn = createEl('span', {
        className: 'float-btn',
        title: config.buttons.left.title,
      });
      leftBtn.dataset.dir = 'left';
      leftBtn.append(
        createEl('i', { className: config.buttons.left.iconClass }),
      );

      const rightBtn = createEl('span', {
        className: 'float-btn',
        title: config.buttons.right.title,
      });
      rightBtn.dataset.dir = 'right';
      const rightIconProps = { className: config.buttons.right.iconClass };
      if (config.buttons.right.iconStyle)
        rightIconProps.style = config.buttons.right.iconStyle;
      rightBtn.append(createEl('i', rightIconProps));

      bar.append(title, leftBtn, rightBtn);
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

  const run = helpers.once(init);
  helpers.ready(run);
  document.addEventListener('pun_main_ready', run);
  document.addEventListener('pun_preview', run);
})();
