(function () {
  'use strict';

  var STORAGE_KEY = 'postFontSize';
  var MIN = 10;
  var MAX = 38;
  var DEFAULT = 14;

  try {
    var v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (isNaN(v)) v = DEFAULT;

    var size = Math.max(MIN, Math.min(MAX, v));

    var css = '' +
      '.post-content, #main-reply,' +
      '.post-box .custom_tag_katexttext,' +
      '.post-box .custom_tag_katext,' +
      '.post-box .custom_tag_kindredaca' +
      '{ font-size:' + size + 'px; }';

    var style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  } catch (e) {}
})();
