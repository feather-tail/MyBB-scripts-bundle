(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, copyToClipboard } = helpers;
  const config = helpers.getConfig('copyCode', {});

  function init() {
    $$('.code-box').forEach((box, i) => {
      const legend = $('.legend', box);
      if (legend) {
        const link = document.createElement('a');
        link.className = 'copy-code-btn';
        link.dataset.codeIdx = i;
        link.href = '#';
        link.textContent = config.buttonText;
        legend.append(link);
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
