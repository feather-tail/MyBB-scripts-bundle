<script>
(() => {
  const ALLOWED_PARENT = /^https:\/\/kindredspirits\.ru$/;

  const ensureCssList = (arr) => {
    if (!Array.isArray(arr)) return;
    const head = document.head || document.documentElement;
    arr.forEach((href, i) => {
      if (!href) return;
      const id = 'ks-iframe-css-' + i;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      head.appendChild(link);
    });
  };

  const apply = (s) => {
    if (!s) return;
    const style  = String(s.style || 'classic');
    const scheme = (s.scheme === 'dark') ? 'dark' : 'light';
    const view   = (s.view === 'mobile') ? 'mobile' : 'desktop';

    const html = document.documentElement;
    html.setAttribute('data-style', style);
    html.setAttribute('data-scheme', scheme);
    html.setAttribute('data-view', view);

    html.classList.remove('classic','winter');
    html.classList.add(style);

    const body = document.body;
    if (body) {
      body.classList.remove('light','dark');
      body.classList.add(scheme);
    }

    html.classList.toggle('force-mobile', view === 'mobile');
  };

  window.addEventListener('message', (event) => {
    if (!ALLOWED_PARENT.test(event.origin)) return;
    const d = event.data || {};
    if (d.eventName !== 'displayChange') return;

    ensureCssList(d.iframeCss);

    apply(d.state);
  });
})();
</script>
