(function () {
  try {
    var storageKey = 'mybb.display.v1';
    var raw = localStorage.getItem(storageKey);

    var s = { style: 'classic', scheme: 'light', view: 'desktop' };

    if (raw) {
      try {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          if (obj.style)  s.style  = String(obj.style);
          if (obj.scheme === 'dark' || obj.scheme === 'light') s.scheme = obj.scheme;
          if (obj.view === 'mobile' || obj.view === 'desktop') s.view = obj.view;
        }
      } catch (e) {}
    }

    var html = document.documentElement;
    html.setAttribute('data-style',  s.style);
    html.setAttribute('data-scheme', s.scheme);
    html.setAttribute('data-view',   s.view);

    var body = document.body;
    if (body) {
      body.classList.remove('light', 'dark');
      body.classList.add(s.scheme);
    }
  } catch (e) {}
})();
