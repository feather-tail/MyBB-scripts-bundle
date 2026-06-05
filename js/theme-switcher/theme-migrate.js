(function () {
  try {
    var baseKey = 'mybb.display.v1';
    var newKey = baseKey + ':summer2026';
    var oldKey = baseKey;

    var rawNew = localStorage.getItem(newKey);

    var s = { style: 'summer', scheme: 'light', view: 'desktop' };

    if (!rawNew) {
      var rawOld = localStorage.getItem(oldKey);
      if (rawOld) {
        try {
          var o = JSON.parse(rawOld);
          if (o && (o.scheme === 'dark' || o.scheme === 'light'))
            s.scheme = o.scheme;
          if (o && (o.view === 'mobile' || o.view === 'desktop'))
            s.view = o.view;
        } catch (e) {}
      }
    } else {
      try {
        s = JSON.parse(rawNew) || s;
      } catch (e) {}
    }

    s.style = 'summer';

    try {
      localStorage.setItem(newKey, JSON.stringify(s));
    } catch (e) {}

    var html = document.documentElement;
    html.setAttribute('data-style', s.style || 'summer');
    html.setAttribute('data-scheme', s.scheme || 'light');
    html.setAttribute('data-view', s.view || 'desktop');

    document.addEventListener(
      'DOMContentLoaded',
      function () {
        if (!document.body) return;
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(s.scheme === 'dark' ? 'dark' : 'light');
      },
      { once: true },
    );
  } catch (e) {}
})();
