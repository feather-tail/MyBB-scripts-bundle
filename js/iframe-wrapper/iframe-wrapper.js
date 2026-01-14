document.addEventListener('DOMContentLoaded', function () {
  document
    .querySelectorAll('.post-content iframe[src*="youtube.com"]')
    .forEach(function (iframe) {
      if (iframe.closest('.post-video__inner')) return;

      var inner = document.createElement('div');
      inner.className = 'post-video__inner';

      var outer = document.createElement('div');
      outer.className = 'post-video';

      iframe.parentNode.insertBefore(outer, iframe);
      outer.appendChild(inner);
      inner.appendChild(iframe);
    });
});
