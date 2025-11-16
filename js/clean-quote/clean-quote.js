(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl } = helpers;
  const config = helpers.getConfig('cleanQuote', {});

  const getSelectedText = () => {
    let sel = '';
    if (window.getSelection) {
      sel = window.getSelection().toString();
    } else if (document.getSelection) {
      sel = document.getSelection().toString();
    } else if (document.selection) {
      sel = document.selection.createRange().text;
    }
    return sel ? sel.trim() : '';
  };

  function quote(userName, postIdNum) {
    const postElement = $(config.selectors.post(postIdNum));
    if (!postElement) return;

    let snippet = getSelectedText();

    if (!snippet) {
      const signatureEl = $(config.selectors.signature, postElement);
      const lastEditEl = $(config.selectors.lastEdit, postElement);

      const originalSignature = signatureEl ? signatureEl.innerHTML : '';
      const originalLastEdit = lastEditEl ? lastEditEl.innerHTML : '';

      if (signatureEl) signatureEl.innerHTML = '';
      if (lastEditEl) lastEditEl.innerHTML = '';

      const contentEl = $(config.selectors.content, postElement);
      if (!contentEl) {
        // вернём подпись/редактирование, если не нашли контент
        if (signatureEl) signatureEl.innerHTML = originalSignature;
        if (lastEditEl) lastEditEl.innerHTML = originalLastEdit;
        return;
      }

      let contentHtml = contentEl.innerHTML;

      (config.replacements || []).forEach(({ from, to }) => {
        contentHtml = contentHtml.replace(from, to);
      });

      const tempWrapper = createEl('div');
      tempWrapper.innerHTML = contentHtml;
      snippet = (tempWrapper.textContent || '').trim();

      if (signatureEl) signatureEl.innerHTML = originalSignature;
      if (lastEditEl) lastEditEl.innerHTML = originalLastEdit;
    }

    if (!snippet) return;

    const bbCode = `[quote=${userName}]${snippet}[/quote]\n`;

    if (typeof insert === 'function') {
      insert(bbCode);
    } else if (typeof smile === 'function') {
      smile(bbCode);
    } else {
      const textarea = $(config.selectors.textarea);
      if (textarea) {
        textarea.value += '\n' + bbCode;
        textarea.focus();
      }
    }
  }

  helpers.register('cleanQuote', { quote });
})();
