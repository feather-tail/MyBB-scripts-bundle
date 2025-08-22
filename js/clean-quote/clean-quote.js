(() => {
  'use strict';

  const { $, createEl } = window.helpers;
  const CFG = window.ScriptConfig.cleanQuote;

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
    const postElement = $(CFG.selectors.post(postIdNum));
    if (!postElement) return;

    let snippet = getSelectedText();

    if (!snippet) {
      const signatureEl = $(CFG.selectors.signature, postElement);
      const lastEditEl = $(CFG.selectors.lastEdit, postElement);

      const originalSignature = signatureEl ? signatureEl.innerHTML : '';
      const originalLastEdit = lastEditEl ? lastEditEl.innerHTML : '';

      if (signatureEl) signatureEl.innerHTML = '';
      if (lastEditEl) lastEditEl.innerHTML = '';

      const contentEl = $(CFG.selectors.content, postElement);
      if (!contentEl) return;
      let contentHtml = contentEl.innerHTML;

      CFG.replacements.forEach(({ from, to }) => {
        contentHtml = contentHtml.replace(from, to);
      });

      const tempWrapper = createEl('div');
      tempWrapper.innerHTML = contentHtml;
      snippet = tempWrapper.textContent.trim();

      if (signatureEl) signatureEl.innerHTML = originalSignature;
      if (lastEditEl) lastEditEl.innerHTML = originalLastEdit;
    }

    const bbCode = `[quote=${userName}]${snippet}[/quote]\n`;

    if (typeof insert === 'function') {
      insert(bbCode);
    } else if (typeof smile === 'function') {
      smile(bbCode);
    } else {
      const textarea = $(CFG.selectors.textarea);
      if (textarea) {
        textarea.value += '\n' + bbCode;
        textarea.focus();
      }
    }
  }

  window.quote = quote;
})();
