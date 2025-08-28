(() => {
  'use strict';

  function bootstrap() {
    const helpers = window.helpers;
    if (!helpers) {
      setTimeout(bootstrap, 25);
      return;
    }

    const { createEl } = helpers;
    const DEFAULT_CURSOR = [
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Cpolygon points="0,0 0,16 5,11 9,15 ',
      '11,13 6,8 16,8" fill="black"/%3E%3C/svg%3E',
    ].join('');
    const config = helpers.getConfig('cursorManager', {
      insertAfterSelector: '#pun-crumbs1',
      storageKey: 'selectedCursor',
      respectReducedMotion: true,
      defaultCursorImg: DEFAULT_CURSOR,
      cursors: [],
    });

    if (config.containerSelector && !config.insertAfterSelector) {
      config.insertAfterSelector = config.containerSelector;
    }

    const lists = [];

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
      let raw;
      try {
        raw = localStorage.getItem(config.storageKey);
      } catch (_) {
        return null;
      }
      if (!raw) return null;
      try {
        const obj = JSON.parse(raw);
        if (obj && (obj.value || obj.url || obj.type)) return obj;
      } catch (_) {}
      localStorage.removeItem(config.storageKey);
      return null;
    }

    function save(c) {
      try {
        localStorage.setItem(config.storageKey, JSON.stringify(c));
      } catch (err) {
        console.error('Failed to save cursor selection', err);
      }
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

    function safeNum(v, min, max, def) {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
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
        style: `color:${(opts && opts.color) || 'rgba(0,0,0,.7)'}`,
      });
      document.body.append(layer);

      const count = safeNum(opts && opts.dotCount, 4, 32, 10);
      const size = safeNum(opts && opts.size, 4, 32, 10);
      const decay = safeNum(opts && opts.decayMs, 200, 2000, 500);

      const dots = Array.from({ length: count }, () => {
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
        opts: { ...(opts || {}), dotCount: count, size, decayMs: decay },
      };

      trail.moveHandler = (e) => {
        trail.targetX = e.clientX;
        trail.targetY = e.clientY;
        if (dots[0]) dots[0].o = 1;
      };
      window.addEventListener('mousemove', trail.moveHandler, {
        passive: true,
      });

      let last = performance.now();
      const tick = (t) => {
        const dt = Math.min(32, t - last);
        last = t;

        let prevX = trail.targetX;
        let prevY = trail.targetY;
        for (let i = 0; i < dots.length; i++) {
          const cur = dots[i];
          const k = 0.25;
          cur.x += (prevX - cur.x) * k;
          cur.y += (prevY - cur.y) * k;
          cur.o += (1 - i / dots.length - cur.o) * 0.15;

          cur.el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) translate(-50%, -50%)`;
          cur.el.style.opacity = String(Math.max(0, Math.min(1, cur.o)));

          prevX = cur.x;
          prevY = cur.y;
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

    function clearActive(els) {
      els.forEach((el) => el.classList.remove('active'));
    }

    function selectCursor(cur) {
      applyCursor(cur);
      save(cur);
      const id = cur && cur.id;
      lists.forEach((list) => {
        clearActive(Array.from(list.children));
        if (id !== undefined) {
          const li = list.querySelector(`[data-id="${id}"]`);
          if (li) li.classList.add('active');
        }
      });
    }

    function setById(id) {
      const cur = config.cursors.find((c) => c.id === id);
      if (cur) selectCursor(cur);
    }

    function clearCursor() {
      selectCursor({ value: 'auto', id: 'auto' });
    }

    function initSection(ul, settingsMenuApi) {
      if (!ul || lists.includes(ul)) return;
      lists.push(ul);

      const saved = loadSaved();
      ul.textContent = '';

      const frag = document.createDocumentFragment();

      config.cursors.forEach((cur) => {
        const li = createEl('li', {
          title: cur.title,
          dataset: { id: cur.id },
        });

        li.tabIndex = 0;
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') selectCursor(cur);
        });

        if (isTrail(cur)) {
          li.classList.add('is-trail');
          const span = createEl('span', { className: 'trail-dot' });
          li.append(span);
        } else {
          li.style.cursor = toCssCursor(cur);
          const img = createEl('img', {
            src: cur.url || config.defaultCursorImg,
            alt: cur.title || '',
          });
          li.append(img);
        }

        const match =
          saved &&
          ((saved.id && saved.id === cur.id) ||
            (saved.type === cur.type &&
              saved.url === cur.url &&
              saved.value === cur.value));
        if (match) li.classList.add('active');

        li.addEventListener('click', () => selectCursor(cur));
        frag.append(li);
      });

      ul.append(frag);
    }

    function init() {
      const saved = loadSaved();
      if (saved) applyCursor(saved);

      if (!Array.isArray(config.cursors) || !config.cursors.length) return;

      const smCfg = helpers.getConfig('settingsMenu', {});
      if (smCfg?.sections?.cursors?.mount !== undefined) return;

      if (!lists.length && config.insertAfterSelector) {
        let anchor = document.querySelector(config.insertAfterSelector);

        const wrapper = createEl('div', { className: 'cursor-manager' });
        const list = createEl('ul');
        wrapper.append(list);

        if (!anchor) anchor = document.body;

        if (anchor === document.body || anchor === document.documentElement) {
          anchor.appendChild(wrapper);
        } else {
          anchor.insertAdjacentElement('afterend', wrapper);
        }

        initSection(list);
      }
    }

    if (helpers.runOnceOnReady) {
      helpers.runOnceOnReady(init);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    helpers.register &&
      helpers.register('cursorManager', {
        init,
        initSection,
        setById,
        clearCursor,
      });
  }

  bootstrap();
})();
