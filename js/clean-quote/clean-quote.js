(function () {
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
    const postElement = document.getElementById(`p${postIdNum}`);
    if (!postElement) return;

    let snippet = getSelectedText();

    if (!snippet) {
      const signatureEl = postElement.querySelector('.post-sig');
      const lastEditEl = postElement.querySelector('p.lastedit');

      const originalSignature = signatureEl ? signatureEl.innerHTML : '';
      const originalLastEdit = lastEditEl ? lastEditEl.innerHTML : '';

      if (signatureEl) signatureEl.innerHTML = '';
      if (lastEditEl) lastEditEl.innerHTML = '';

      let contentHtml = postElement.querySelector('.post-content').innerHTML;
      contentHtml = contentHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<strong>/gi, '[b]')
        .replace(/<\/strong>/gi, '[/b]');

      const tempWrapper = document.createElement('div');
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
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value += '\n' + bbCode;
        textarea.focus();
      }
    }
  }

  window.quote = quote;
})();
