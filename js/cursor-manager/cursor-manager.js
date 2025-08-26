(() => {
  'use strict';

  const helpers = window.helpers;
  const { createEl, $$ } = helpers;
  const config = helpers.getConfig('cursorManager', {
    containerSelector: '#pun-crumbs1',
    storageKey: 'selectedCursor',
    respectReducedMotion: true,
    cursors: [],
  });

  const isTrail = (c) => c && c.type === 'trail';
  const toCssCursor = (c) => {
    if (!c) return 'auto';
    if (c.url) {
      const x = Number.isFinite(c.x) ? c.x : 0;
      const y = Number.isFinite(c.y) ? c.y : 0;
      const fb = c.fallback || 'auto';
      return `url("${c.url}") ${x} ${y}, ${fb}`;
    }
    return c.value || 'auto';
  };

  function loadSaved() {
    const raw = localStorage.getItem(config.storageKey);
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (obj && (obj.value || obj.url || obj.type)) return obj;
    } catch (_) {
      return { id: 'custom', title: 'Custom', value: raw };
    }
    return null;
  }
  function save(c) {
    localStorage.setItem(config.storageKey, JSON.stringify(c));
  }

  let trail = {
    layer: null,
    dots: [],
    moveHandler: null,
    rafId: 0,
    targetX: 0,
    targetY: 0,
    opts: null,
  };

  function disableTrail() {
    document.documentElement.classList.remove('cursor-none');
    if (trail.moveHandler) {
      window.removeEventListener('mousemove', trail.moveHandler);
      trail.moveHandler = null;
    }
    if (trail.rafId) {
      cancelAnimationFrame(trail.rafId);
      trail.rafId = 0;
    }
    if (trail.layer) {
      trail.layer.remove();
      trail.layer = null;
      trail.dots = [];
    }
  }

  function enableTrail(opts) {
    if (
      config.respectReducedMotion &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.documentElement.style.cursor = 'auto';
      return;
    }

    disableTrail();
    document.documentElement.classList.add('cursor-none');

    const layer = createEl('div', {
      className: 'cursor-trail-layer',
      style: `color:${opts.color || 'rgba(0,0,0,.7)'}`,
    });
    document.body.append(layer);

    const count = Math.max(4, Math.min(32, opts.dotCount ?? 10));
    const size = Math.max(4, Math.min(32, opts.size ?? 10));
    const decay = Math.max(200, Math.min(2000, opts.decayMs ?? 500));

    const dots = Array.from({ length: count }).map(() => {
      const d = createEl('div', { className: 'cursor-dot' });
      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      d.style.opacity = '0';
      layer.append(d);
      return { el: d, x: 0, y: 0, o: 0 };
    });

    trail = {
      layer,
      dots,
      moveHandler: null,
      rafId: 0,
      targetX: 0,
      targetY: 0,
      opts,
    };

    trail.moveHandler = (e) => {
      trail.targetX = e.clientX;
      trail.targetY = e.clientY;
      if (dots[0]) dots[0].o = 1;
    };
    window.addEventListener('mousemove', trail.moveHandler);

    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(32, t - last);
      last = t;

      for (let i = 0; i < dots.length; i++) {
        const prev =
          i === 0 ? { x: trail.targetX, y: trail.targetY } : dots[i - 1];
        const cur = dots[i];
        const k = 0.25;
        cur.x += (prev.x - cur.x) * k;
        cur.y += (prev.y - cur.y) * k;
        cur.o += (1 - i / dots.length - cur.o) * 0.15;

        cur.el.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%, -50%)`;
        cur.el.style.opacity = String(Math.max(0, Math.min(1, cur.o)));
      }

      const fade = dt / decay;
      for (const d of dots) d.o = Math.max(0, d.o - fade);

      trail.rafId = requestAnimationFrame(tick);
    };
    trail.rafId = requestAnimationFrame(tick);
  }

  function applyCursor(cur) {
    disableTrail();

    if (!cur) {
      document.documentElement.style.cursor = '';
      return;
    }

    if (isTrail(cur)) {
      enableTrail(cur);
    } else {
      document.documentElement.classList.remove('cursor-none');
      document.documentElement.style.cursor = toCssCursor(cur);
    }
  }

  function selectCursor(cur, li, wrapper) {
    applyCursor(cur);
    save(cur);
    if (wrapper) {
      $$('.cursor-manager li', wrapper).forEach((el) =>
        el.classList.toggle('active', el === li),
      );
    }
  }

  function init() {
    const saved = loadSaved();
    if (saved) applyCursor(saved);

    const container = document.querySelector(config.containerSelector);
    if (!container || !Array.isArray(config.cursors) || !config.cursors.length)
      return;

    const wrapper = createEl('div', { className: 'cursor-manager' });
    const list = createEl('ul');

    config.cursors.forEach((cur) => {
      const li = createEl('li', { title: cur.title, dataset: { id: cur.id } });

      if (isTrail(cur)) {
        li.classList.add('is-trail');
        li.innerHTML = '<span class="trail-dot"></span>';
      } else {
        li.style.cursor = toCssCursor(cur);
      }

      const match =
        saved &&
        ((saved.id && saved.id === cur.id) ||
          (saved.type === cur.type &&
            saved.url === cur.url &&
            saved.value === cur.value));
      if (match) li.classList.add('active');

      li.addEventListener('click', () => selectCursor(cur, li, wrapper));
      list.append(li);
    });

    wrapper.append(list);
    container.append(wrapper);

    helpers.register('cursorManager', {
      init,
      setById: (id) => {
        const cur = config.cursors.find((c) => c.id === id);
        if (cur) selectCursor(cur);
      },
      clearCursor: () => {
        selectCursor({ value: 'auto', id: 'auto' });
      },
    });
  }

  helpers.runOnceOnReady(init);
  helpers.register('cursorManager', { init });
})();
