(() => {
  'use strict';

  const COPY_CODE_TEXT = 'Скопировать код';
  const COPY_CODE_DONE = 'Скопировано';
  const COPY_RESET_TIMEOUT = 1200;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.code-box').forEach((box, i) => {
      const legend = box.querySelector('.legend');
      if (legend) {
        legend.innerHTML = `<a class="copy-code-btn" data-code-idx="${i}" href="#">${COPY_CODE_TEXT}</a>`;
      }
    });

    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.copy-code-btn');
      if (!btn) return;
      e.preventDefault();

      const codeIdx = btn.dataset.codeIdx;
      const box = document
        .querySelector(`.code-box .copy-code-btn[data-code-idx="${codeIdx}"]`)
        ?.closest('.code-box');
      if (!box) return;

      const code = box.querySelector('.scrollbox pre');
      if (!code) return;

      const codeText = code.textContent.trim();

      try {
        await navigator.clipboard.writeText(codeText);
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = codeText;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textarea);
        }
      }

      btn.textContent = COPY_CODE_DONE;
      box.classList.add('copied');

      setTimeout(() => {
        btn.textContent = COPY_CODE_TEXT;
        box.classList.remove('copied');
      }, COPY_RESET_TIMEOUT);
    });
  });
})();
