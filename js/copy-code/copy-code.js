(() => {
  'use strict';

  const { $, $$, copyToClipboard } = window.helpers;
  const config = helpers.getConfig('copyCode', {});

  function init() {
    $$('.code-box').forEach((box, i) => {
      const legend = $('.legend', box);
      if (legend) {
        legend.innerHTML = `<a class="copy-code-btn" data-code-idx="${i}" href="#">${config.buttonText}</a>`;
      }
    });

    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.copy-code-btn');
      if (!btn) return;
      e.preventDefault();

      const codeIdx = btn.dataset.codeIdx;
      const box = $(
        `.code-box .copy-code-btn[data-code-idx="${codeIdx}"]`,
      )?.closest('.code-box');
      if (!box) return;

      const code = $('.scrollbox pre', box);
      if (!code) return;

      const codeText = code.textContent.trim();

      await copyToClipboard(codeText);

      btn.textContent = config.doneText;
      box.classList.add('copied');

      setTimeout(() => {
        btn.textContent = config.buttonText;
        box.classList.remove('copied');
      }, config.resetTimeout);
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('copyCode', { config, init });
})();
