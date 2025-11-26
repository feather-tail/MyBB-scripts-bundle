/* в HTML-верх */
(function() {
  try {
    var storageKey = 'mybb.display.v1';
    var raw = localStorage.getItem(storageKey);
    var scheme = 'light';

    if (raw) {
      try {
        var obj = JSON.parse(raw);
        if (obj && (obj.scheme === 'dark' || obj.scheme === 'light')) {
          scheme = obj.scheme;
        }
      } catch (e) {}
    }

    var html = document.documentElement;
    html.setAttribute('data-scheme', scheme);
    var body = document.body;
    if (body) {
      body.classList.remove('light', 'dark');
      body.classList.add(scheme);
    }
  } catch (e) {}
})();
