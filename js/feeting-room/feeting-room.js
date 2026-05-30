(() => {
  'use strict';

  const CFG = {
    topicId: 13,
    tagSelector: '.custom_tag.custom_tag_fittingroom',
    fakePostId: 'ks-fittingroom-post',
    debug: false,
    shopJsonUrl: 'https://feathertail.ru/ks/characters/customize.json',
    characterPageBase: '/pages/',
    storageKeyPrefix: 'ks-fr-cart-v1:',
    createPrice: { icon: 300, plate: 800, background: 600 },
    moneyIcon: 'fa-dollar-sign',
  };

  const log = (...a) =>
    CFG.debug && console.log('%c[FittingRoom]', 'color:#8be9fd', ...a);
  const warn = (...a) => CFG.debug && console.warn('[FittingRoom]', ...a);

  const helpers = window.helpers || {};
  const getCfg = (k, d) =>
    helpers.getConfig ? helpers.getConfig(k, d) : window.ScriptConfig?.[k] || d;

  const hpCfg = getCfg('bbcodeHideProfile', {});
  const HIDE_PROFILE_CLASS = hpCfg.hideClass || 'hide-profile';

  const cssEsc = (s) =>
    window.CSS && CSS.escape
      ? CSS.escape(String(s))
      : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  const escAttr = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const ensureUnhideProfileCSS = () => {};

  const ensureFittingProfileCSS = () => {};

  const buildFakeAuthorFromTemplate = (profile, isLoggedIn) => {
    const tpl = document.querySelector(
      '.post-author:not([data-ks="fitting-profile"])',
    );
    if (!tpl) return null;

    const author = tpl.cloneNode(true);

    author.removeAttribute('id');
    author.setAttribute('data-ks', 'fitting-profile');
    author.classList.toggle('online', !!isLoggedIn);
    author.classList.add('topic-starter');

    author.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

    const fld2 = author.querySelector('.pa-fld2');
    const fld1 = author.querySelector('.pa-fld1');
    const fld3 = author.querySelector('.pa-fld3');
    const fld6 = author.querySelector('.pa-fld6');
    const paTitle = author.querySelector('.pa-title');
    const paAvatar = author.querySelector('.pa-avatar');
    const paAuthor = author.querySelector('.pa-author');
    const wrapResp = author.querySelector('.wrap-resp');

    if (
      !fld2 ||
      !fld1 ||
      !fld3 ||
      !fld6 ||
      !paTitle ||
      !paAvatar ||
      !paAuthor ||
      !wrapResp
    ) {
      return null;
    }

    fld2.id = 'ks-fr-fld2';
    fld1.id = 'ks-fr-fld1';
    fld3.id = 'ks-fr-fld3';
    fld6.id = 'ks-fr-fld6';

    paTitle.textContent = profile.userTitle || '';

    paAvatar.classList.add('item2');
    paAvatar.innerHTML = `<img id="ks-fr-avatar" src="${profile.userAvatar || '/i/default_avatar.jpg'}" alt="${escAttr(profile.userLogin)}" data-quicktip="${escAttr(profile.userLogin)}">`;

    const authorLink = paAuthor.querySelector('a');
    if (authorLink) {
      authorLink.id = 'ks-fr-user';
      authorLink.textContent = profile.userLogin;
      authorLink.setAttribute('href', 'javascript://');
      authorLink.setAttribute('rel', 'nofollow');
      authorLink.classList.toggle('online', !!isLoggedIn);
    } else {
      paAuthor.innerHTML = `<span class="acchide">Автор:&nbsp;</span><a href="javascript://" rel="nofollow" class="${isLoggedIn ? 'online' : ''}" id="ks-fr-user">${profile.userLogin}</a>`;
    }

    const posts = wrapResp.querySelector('.pa-posts');
    if (posts) {
      posts.innerHTML = `<span class="fld-name" data-quicktip="сообщения">Сообщений:</span> ${profile.userPosts}`;
    }

    const respect = wrapResp.querySelector('.pa-respect');
    if (respect) {
      respect.innerHTML = `<span class="fld-name" data-quicktip="репутация" style="cursor:pointer"><a href="/respect.php?id=${profile.userID}" rel="nofollow">Репутация</a>:</span><span>${profile.respectMinus > 0 ? `+${profile.respectPlus} / -${profile.respectMinus}` : `+${profile.respectPlus}`}</span>`;
    }

    const fld4 = wrapResp.querySelector('.pa-fld4');
    if (fld4) {
      fld4.innerHTML = `<span class="fld-name" data-quicktip="деньги">Деньги:</span> ${profile.fld4}`;
    }

    const fld5 = wrapResp.querySelector('.pa-fld5');
    if (fld5) {
      fld5.innerHTML = `<span class="fld-name" data-quicktip="игровые посты">Игровые посты:</span> <strong>${profile.fld5}</strong>`;
    }

    return author;
  };

  const onReady = (fn) => {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  const isViewTopicPage = () =>
    /viewtopic\.php/i.test(location.pathname) ||
    !!document.querySelector('.topic[id^="topic_t"]');

  const isTargetTopic = () => {
    try {
      const u = new URL(location.href);
      const id = u.searchParams.get('id');
      if (id && String(id) === String(CFG.topicId)) return true;
    } catch {}
    if (document.getElementById(`topic_t${CFG.topicId}`)) return true;
    const t = document.querySelector('.topic[id^="topic_t"]');
    if (t) {
      const m = t.id.match(/^topic_t(\d+)$/);
      if (m && String(m[1]) === String(CFG.topicId)) return true;
    }
    return false;
  };

  const decodeHtmlEntities = (str) => {
    const t = document.createElement('textarea');
    t.innerHTML = String(str ?? '');
    return t.value;
  };

  const buildAvatarUrl = (raw) => {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    if (typeof window.AvatarsURL === 'string' && window.AvatarsURL) {
      return window.AvatarsURL.replace(/\/$/, '') + v;
    }
    return v;
  };

  const setDecodedHTML = (el, htmlEsc) => {
    if (!el) return;
    el.innerHTML = decodeHtmlEntities(htmlEsc);
  };

  const fetchText = async (url, opts = {}) => {
    const r = await fetch(url, {
      method: 'GET',
      credentials: opts.credentials || 'same-origin',
      cache: opts.cache || 'no-store',
      headers: opts.headers || {},
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.text();
  };

  const fetchJson = async (url) => {
    const r = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.json();
  };

  const extractUrlFromCssBg = (bg) => {
    const s = String(bg || '').trim();
    if (!s) return '';
    const m = s.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
    return m ? String(m[2] || '').trim() : '';
  };

  const extractImgSrcFromHtml = (html) => {
    const s = String(html || '').trim();
    if (!s) return '';
    try {
      const doc = new DOMParser().parseFromString(s, 'text/html');
      return String(doc.querySelector('img')?.getAttribute('src') || '').trim();
    } catch {
      return '';
    }
  };

  const parseItemsFromCharacterPage = (htmlText) => {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    const root = doc.querySelector('.cm-appearance') || doc;

    const pickTitle = (btn) =>
      btn.getAttribute('data-title') ||
      btn.dataset?.title ||
      btn.title ||
      btn.getAttribute('aria-label') ||
      '';

    const pickId = (btn) =>
      btn.getAttribute('data-item-id') || btn.dataset?.itemId || '';

    const pickImg = (btn) => {
      const d = btn.getAttribute('data-img') || btn.dataset?.img;
      if (d) return d;
      const img = btn.querySelector('img')?.getAttribute('src');
      if (img) return img;
      const stEl = btn.querySelector('[style*="background-image"]');
      const st = stEl ? stEl.style.backgroundImage : btn.style.backgroundImage;
      const u = extractUrlFromCssBg(st);
      return u || '';
    };

    const icons = Array.from(root.querySelectorAll('.cm-icons .cm-icon'))
      .map((b) => ({
        id: pickId(b),
        img: pickImg(b),
        title: pickTitle(b),
        category: 'icon',
        owned: true,
      }))
      .filter((x) => x.img);

    const plates = Array.from(root.querySelectorAll('.cm-plates .cm-plate'))
      .map((b) => ({
        id: pickId(b),
        img: pickImg(b),
        title: pickTitle(b),
        category: 'plate',
        owned: true,
      }))
      .filter((x) => x.img);

    const bgFrame =
      root.querySelector('.cm-frame[data-kind="backgrounds"]') ||
      root.querySelector('.cm-frame[data-kind="background"]') ||
      null;

    const backgrounds = bgFrame
      ? uniqBy(
          Array.from(
            bgFrame.querySelectorAll('[data-img], [style*="background-image"]'),
          )
            .filter((b) => {
              if (b.hasAttribute('data-img')) return true;
              return !b.closest('[data-img]');
            })
            .map((b) => ({
              id: pickId(b),
              img: pickImg(b),
              title: pickTitle(b),
              category: 'background',
              owned: true,
            }))
            .filter((x) => x.img),
          (x) => x.img,
        )
      : [];

    return { icons, plates, backgrounds };
  };

  const normalizeShopItems = (arr) => {
    const icons = [];
    const plates = [];
    const backgrounds = [];

    (Array.isArray(arr) ? arr : []).forEach((x) => {
      const purchasable =
        typeof x?.purchasable === 'boolean' ? x.purchasable : true;
      const rawPrice = x?.price ?? x?.cost ?? x?.value;
      const priceNum =
        rawPrice === 0 || rawPrice === '0'
          ? 0
          : rawPrice !== null &&
              rawPrice !== undefined &&
              String(rawPrice).trim() !== ''
            ? Number(rawPrice)
            : null;
      const price =
        priceNum === 0 || Number.isFinite(priceNum) ? priceNum : null;

      const item = {
        id: String(x?.id || ''),
        img: String(x?.img || ''),
        title: String(x?.title || ''),
        category: String(x?.category || ''),
        owned: false,
        purchasable,
        price,
      };

      if (!item.img) return;
      if (!item.purchasable) return;

      if (item.category === 'icon') icons.push(item);
      else if (item.category === 'plate') plates.push(item);
      else if (item.category === 'background') backgrounds.push(item);
    });

    return { icons, plates, backgrounds };
  };

  const uniqBy = (arr, keyFn) => {
    const m = new Map();
    arr.forEach((x) => {
      const k = keyFn(x);
      if (!k) return;
      if (!m.has(k)) m.set(k, x);
    });
    return Array.from(m.values());
  };

  const initFittingUI = (fake) => {
    const content = fake.querySelector('#ks-fr-content');
    if (!content) return;

    const CUSTOM_ICON_PRICE = CFG.createPrice.icon;
    const CUSTOM_PLATE_PRICE = CFG.createPrice.plate;
    const CUSTOM_BACKGROUND_PRICE = CFG.createPrice.background;

    const fld2 = fake.querySelector('#ks-fr-fld2');
    const fld1 = fake.querySelector('#ks-fr-fld1');
    const fld3 = fake.querySelector('#ks-fr-fld3');
    const fld6 = fake.querySelector('#ks-fr-fld6');

    const initial = {
      fld2: fld2 ? fld2.innerHTML : '',
      fld1: fld1 ? fld1.innerHTML : '',
      fld3: fld3 ? fld3.innerHTML : '',
      fld6: fld6 ? fld6.innerHTML : '',
      bgImg: fld6 ? extractImgSrcFromHtml(fld6.innerHTML) : '',
    };

    const slug = (() => {
      const el = fake.querySelector('#ks-fr-fld3 .modal-link[id]');
      const id = el?.getAttribute('id') || '';
      return String(id || '').trim();
    })();

    const userKey = (() => {
      const uid =
        typeof window.UserID !== 'undefined' && Number(window.UserID) > 0
          ? Number(window.UserID)
          : 'guest';
      return CFG.storageKeyPrefix + String(uid);
    })();

    const frMoneyFmt = new Intl.NumberFormat('ru-RU');

    const frMoneyHTML = (n) => {
      const v = Number(n);
      const val = Number.isFinite(v) ? v : 0;
      return `<i class="fa-solid ${CFG.moneyIcon} ks-fr-moneyicon" aria-hidden="true"></i><span class="ks-fr-moneynum">${frMoneyFmt.format(val)}</span>`;
    };

    const normalizeColor = (c, fallback = '#ffffff') => {
      const v = String(c || '').trim();
      if (!v) return fallback;
      if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) return v;
      return fallback;
    };

    const clampSize = (n, fallback = 12) => {
      const v = Number(n);
      if (!Number.isFinite(v)) return fallback;
      return Math.max(8, Math.min(22, Math.round(v)));
    };

    const normalizeUrl = (u) => {
      const v = String(u || '').trim();
      if (!v) return '';
      return v;
    };

    const safeLineHtml = (t) =>
      escAttr(String(t ?? '')).replace(/\r\n|\r|\n/g, '<br>');

    const parseTwoLines = (text) => {
      const raw = String(text ?? '');
      const parts = raw.split(/\r\n|\r|\n/);
      const l1 = (parts[0] ?? '').trimEnd();
      const l2 = (parts[1] ?? '').trimEnd();
      return [l1, l2];
    };

    const parseSizesField = (val, fallback = 12) => {
      const s = String(val ?? '').trim();
      if (!s) return [fallback, fallback];
      const nums = s
        .split(/[,\s/|;]+/g)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n));
      if (!nums.length) return [fallback, fallback];
      const a = clampSize(nums[0], fallback);
      const b = clampSize(nums.length > 1 ? nums[1] : nums[0], a);
      return [a, b];
    };

    const state = {
      mode: 'owned',
      cat: 'icon',
      q: '',
      slug,
      loading: { owned: false, shop: false },
      loaded: { owned: false, shop: false },
      owned: { icon: [], plate: [], background: [] },
      shop: { icon: [], plate: [], background: [] },
      applied: {
        iconImg: '',
        plateImg: '',
        bgImg: initial.bgImg || '',
        plateColor: '',
        plateSize1: 12,
        plateSize2: 12,
        plateLeftImg: '',
        plateLine1: '',
        plateLine2: '',
      },
      cart: [],
      cartComment: '',
      toastTimer: null,
      customPlateColor: '#ffffff',
      customPlateSize1: 12,
      customPlateSize2: 12,
      customPlateLeftImg: '',
    };

    const toast = (msg) => {
      const el = ui.querySelector('#ks-fr-toast');
      if (!el) return;
      el.textContent = String(msg || '');
      el.classList.add('is-show');
      if (state.toastTimer) clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(() => el.classList.remove('is-show'), 1800);
    };

    const loadCart = () => {
      try {
        const raw = localStorage.getItem(userKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        let items = [];
        let comment = '';

        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.items)) items = parsed.items;
          if (typeof parsed.comment === 'string') comment = parsed.comment;
        }

        state.cartComment = comment;
        state.cart = items
          .map((x) => {
            const kind = typeof x?.kind === 'string' ? x.kind : '';
            const line1 =
              typeof x?.customLine1 === 'string'
                ? x.customLine1
                : typeof x?.customText === 'string'
                  ? parseTwoLines(x.customText)[0]
                  : '';
            const line2 =
              typeof x?.customLine2 === 'string'
                ? x.customLine2
                : typeof x?.customText === 'string'
                  ? parseTwoLines(x.customText)[1]
                  : '';
            const s1 =
              x?.customSize1 === 0 || Number.isFinite(Number(x?.customSize1))
                ? clampSize(x.customSize1, 12)
                : null;
            const s2 =
              x?.customSize2 === 0 || Number.isFinite(Number(x?.customSize2))
                ? clampSize(x.customSize2, 12)
                : null;
            const legacySize =
              x?.customSize === 0 || Number.isFinite(Number(x?.customSize))
                ? clampSize(x.customSize, 12)
                : 12;

            return {
              id: String(x?.id || ''),
              img: String(x?.img || ''),
              title: String(x?.title || ''),
              category: String(x?.category || ''),
              price:
                x?.price === 0 || Number.isFinite(Number(x?.price))
                  ? Number(x.price)
                  : 0,
              customLine1: line1,
              customLine2: line2,
              customColor:
                typeof x?.customColor === 'string' ? x.customColor : '',
              customSize1: s1 ?? legacySize,
              customSize2: s2 ?? legacySize,
              customLeftImg:
                typeof x?.customLeftImg === 'string' ? x.customLeftImg : '',
              kind,
            };
          })
          .filter((x) => x.id && x.img);
      } catch {}
    };

    const saveCart = () => {
      try {
        localStorage.setItem(
          userKey,
          JSON.stringify({ items: state.cart, comment: state.cartComment }),
        );
      } catch {}
    };

    const cartTotal = () =>
      state.cart.reduce(
        (s, x) => s + (Number.isFinite(Number(x.price)) ? Number(x.price) : 0),
        0,
      );

    const copyToClipboard = async (text) => {
      const t = String(text || '');
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(t);
          return true;
        }
      } catch {}
      try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
      } catch {
        return false;
      }
    };

    const cartAdd = (item) => {
      if (!item?.id) return;
      if (state.cart.some((x) => x.id === item.id)) {
        toast('Уже в корзине');
        return;
      }
      state.cart.push({
        id: String(item.id),
        img: String(item.img || ''),
        title: String(item.title || ''),
        category: String(item.category || ''),
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
        customLine1:
          typeof item.customLine1 === 'string' ? item.customLine1 : '',
        customLine2:
          typeof item.customLine2 === 'string' ? item.customLine2 : '',
        customColor:
          typeof item.customColor === 'string' ? item.customColor : '',
        customSize1:
          item.customSize1 === 0 || Number.isFinite(Number(item.customSize1))
            ? clampSize(item.customSize1, 12)
            : 12,
        customSize2:
          item.customSize2 === 0 || Number.isFinite(Number(item.customSize2))
            ? clampSize(item.customSize2, 12)
            : 12,
        customLeftImg:
          typeof item.customLeftImg === 'string' ? item.customLeftImg : '',
        kind: typeof item.kind === 'string' ? item.kind : '',
      });
      saveCart();
      renderCart();
      toast('Добавлено в корзину');
    };

    const cartRemove = (id) => {
      state.cart = state.cart.filter((x) => x.id !== id);
      saveCart();
      renderCart();
    };

    const cartClear = () => {
      state.cart = [];
      saveCart();
      renderCart();
      toast('Корзина очищена');
    };

    const buildRequestCode = () => {
      const lines = [];

      const codeWrap = (t) => {
        const s = String(t ?? '');
        if (!s.trim()) return '';
        return `[code]${s}[/code]`;
      };

      state.cart.forEach((it, idx) => {
        if (idx > 0) lines.push('[hr]');
        const priceVal = Number.isFinite(Number(it.price))
          ? Number(it.price)
          : 0;

        if (it.kind === 'custom_plate') {
          const title = it.title || it.id || '[u]Своя плашка[/u]';
          const l1 = String(it.customLine1 || '');
          const l2 = String(it.customLine2 || '');
          const s1 = clampSize(it.customSize1, 12);
          const s2 = clampSize(it.customSize2, s1);
          const color = String(it.customColor || '').trim();
          const left = String(it.customLeftImg || '').trim();

          lines.push(title);
          lines.push('');
          lines.push(`[b]Цена:[/b] ${priceVal}`);
          lines.push('');
          lines.push(`[b]Фон плашки:[/b] ${it.img}`);
          if (left) lines.push(`[b]Картинка слева:[/b] ${left}`);
          lines.push('');
          lines.push(`[b]Размеры текста:[/b] ${s1}px / ${s2}px`);
          lines.push('[b]Текст плашки:[/b]');
          if (l1.trim() || l2.trim()) {
            const textBlock = [l1, l2]
              .filter((x) => String(x).trim())
              .join('\n');
            lines.push(codeWrap(textBlock));
          } else {
            lines.push(codeWrap(''));
          }
          lines.push('');
          if (color) lines.push(`[b]Цвет:[/b] ${color}`);
          return;
        }

        lines.push(`[img]${it.img}[/img]`);
        lines.push(it.title || it.id);
        lines.push(`[b]Цена:[/b] ${priceVal}`);
      });

      const c = String(state.cartComment || '').trim();
      if (c) {
        lines.push('[hr]');
        lines.push('Комментарий:');
        lines.push(codeWrap(c));
      }

      lines.push('[hr][hr]');
      lines.push(`Итого: ${cartTotal()}`);
      return lines.join('\n');
    };

    const ui = document.createElement('div');
    ui.className = 'ks-fr-ui';
    ui.innerHTML =
      ` <div class="ks-fr-panel"> <div class="ks-fr-tabs"> <button type="button" data-mode="owned" aria-pressed="true">Куплено</button> <button type="button" data-mode="shop" aria-pressed="false">Магазин</button> <button type="button" data-mode="create" aria-pressed="false">Создать</button> </div> <div class="ks-fr-subtabs"> <button type="button" data-cat="icon" aria-pressed="true">Иконки</button> <button type="button" data-cat="plate" aria-pressed="false">Плашки</button> <button type="button" data-cat="background" aria-pressed="false">Фоны</button> </div> <div class="ks-fr-tools" data-ks="list-tools"> <input type="search" id="ks-fr-search" placeholder="Поиск…" autocomplete="off"> <button type="button" id="ks-fr-reset-current">Сбросить</button> </div> <div class="ks-fr-list" id="ks-fr-list"></div> <div class="ks-fr-create ks-fr-hidden" id="ks-fr-create"> <div class="ks-fr-create__block"> <div class="ks-fr-h">Свой фон</div> <div class="ks-fr-muted" style="margin-bottom:8px;">Вставь ссылку на изображение. Размер 238 на 190</div> <div class="ks-fr-row ks-fr-create__row"> <input type="url" id="ks-fr-custom-background-url" placeholder="https://..." autocomplete="off"> <button type="button" id="ks-fr-apply-custom-background">Примерить</button> <button type="button" id="ks-fr-reset-custom-background">Сбросить</button> </div> <div class="ks-fr-create__buy"> <span class="ks-fr-price" id="ks-fr-create-background-price"></span> <button type="button" class="ks-fr-pill ks-fr-create-add" data-kind="background" aria-label="В корзину"> <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> </button> </div> </div> <div class="ks-fr-create__block"> <div class="ks-fr-h">Своя иконка</div> <div class="ks-fr-muted" style="margin-bottom:8px;">Вставь ссылку на изображение. Отобразится 20&#215;20.</div> <div class="ks-fr-row ks-fr-create__row"> <input type="url" id="ks-fr-custom-icon-url" placeholder="https://..." autocomplete="off"> <button type="button" id="ks-fr-apply-custom-icon">Примерить</button> <button type="button" id="ks-fr-reset-custom-icon">Сбросить</button> </div> <div class="ks-fr-create__buy"> <span class="ks-fr-price" id="ks-fr-create-icon-price"></span> <button type="button" class="ks-fr-pill ks-fr-create-add" data-kind="icon" aria-label="В корзину"> <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> </button> </div> </div> <div class="ks-fr-create__block"> <div class="ks-fr-h">Текст в минипрофиле</div> <div class="ks-fr-muted" style="margin-bottom:8px;">Меняется только блок <span style="opacity:.9;">.lz-text</span> в поле pa-fld1.</div> <textarea id="ks-fr-text" spellcheck="false"></textarea> <div class="ks-fr-actions"> <button type="button" id="ks-fr-apply-text">Применить</button> <button type="button" id="ks-fr-reset-text">Сбросить текст</button> </div> </div> <div class="ks-fr-create__block"> <div class="ks-fr-h">Своя плашка</div> <div class="ks-fr-muted" style="margin-bottom:8px;">Изображение всегда 220&#215;32. Две строки друг под другом.</div> <div class="ks-fr-row ks-fr-create__row"> <input type="url" id="ks-fr-custom-plate-url" placeholder="Ссылка на фон плашки (https://...)" autocomplete="off"> </div> <div class="ks-fr-row ks-fr-create__row" style="margin-top:8px;"> <input type="url" id="ks-fr-custom-plate-left-url" placeholder="Ссылка на картинку слева (https://...)" autocomplete="off"> </div> <div class="ks-fr-row ks-fr-create__row" style="margin-top:8px;align-items:flex-start;flex-wrap:wrap;"> <textarea id="ks-fr-custom-plate-text" class="ks-fr-plate-ta" rows="2" placeholder="Строка 1 Строка 2" autocomplete="off"></textarea> <div class="ks-fr-mini"> <span class="ks-fr-mini__label">Цвет</span> <input type="color" id="ks-fr-custom-plate-color" value="#ffffff" aria-label="Цвет текста"> </div> <div class="ks-fr-mini"> <span class="ks-fr-mini__label">Размеры</span> <input type="text" id="ks-fr-custom-plate-sizes" value="12,12" inputmode="numeric" aria-label="Размеры строк" placeholder="12,10"> </div> <button type="button" id="ks-fr-apply-custom-plate">Примерить</button> <button type="button" id="ks-fr-reset-custom-plate">Сбросить</button> </div> <div class="ks-fr-create__buy"> <span class="ks-fr-price" id="ks-fr-create-plate-price"></span> <button type="button" class="ks-fr-pill ks-fr-create-add" data-kind="plate" aria-label="В корзину"> <i class="fa-solid fa-cart-plus" aria-hidden="true"></i> </button> </div> </div> </div> <div class="ks-fr-divider"></div> <div class="ks-fr-cart" id="ks-fr-cart"> <div class="ks-fr-cart__title">Корзина</div> <div class="ks-fr-cart__list" id="ks-fr-cart-list"></div> <div class="ks-fr-cart__comment"> <textarea id="ks-fr-cart-comment" rows="3" placeholder="Комментарий к заявке…" autocomplete="off"></textarea> </div> <div class="ks-fr-cart__footer"> <div class="ks-fr-cart__summary"> <span>Итого</span> <span class="ks-fr-price" id="ks-fr-cart-total"></span> </div> <div class="ks-fr-cart__actions"> <button type="button" id="ks-fr-cart-clear">Очистить</button> <button type="button" id="ks-fr-cart-copy">Создать заявку</button> </div> </div> </div> <div class="ks-fr-toast" id="ks-fr-toast" aria-live="polite" aria-atomic="true"></div> </div> `.trim();

    content.appendChild(ui);

    const elList = ui.querySelector('#ks-fr-list');
    const elSearch = ui.querySelector('#ks-fr-search');
    const elCreate = ui.querySelector('#ks-fr-create');
    const elListTools = ui.querySelector('[data-ks="list-tools"]');
    const elSubtabs = ui.querySelector('.ks-fr-subtabs');
    const elText = ui.querySelector('#ks-fr-text');
    const elCustomBackgroundUrl = ui.querySelector(
      '#ks-fr-custom-background-url',
    );
    const elCustomIconUrl = ui.querySelector('#ks-fr-custom-icon-url');
    const elCustomPlateUrl = ui.querySelector('#ks-fr-custom-plate-url');
    const elCustomPlateLeftUrl = ui.querySelector(
      '#ks-fr-custom-plate-left-url',
    );
    const elCustomPlateText = ui.querySelector('#ks-fr-custom-plate-text');
    const elCustomPlateColor = ui.querySelector('#ks-fr-custom-plate-color');
    const elCustomPlateSizes = ui.querySelector('#ks-fr-custom-plate-sizes');
    const elCartList = ui.querySelector('#ks-fr-cart-list');
    const elCartTotal = ui.querySelector('#ks-fr-cart-total');
    const elCartComment = ui.querySelector('#ks-fr-cart-comment');
    const elCreateBackgroundPrice = ui.querySelector(
      '#ks-fr-create-background-price',
    );
    const elCreateIconPrice = ui.querySelector('#ks-fr-create-icon-price');
    const elCreatePlatePrice = ui.querySelector('#ks-fr-create-plate-price');

    if (elCreateBackgroundPrice)
      elCreateBackgroundPrice.innerHTML = frMoneyHTML(CUSTOM_BACKGROUND_PRICE);
    if (elCreateIconPrice)
      elCreateIconPrice.innerHTML = frMoneyHTML(CUSTOM_ICON_PRICE);
    if (elCreatePlatePrice)
      elCreatePlatePrice.innerHTML = frMoneyHTML(CUSTOM_PLATE_PRICE);

    if (elCustomPlateColor) {
      state.customPlateColor = normalizeColor(
        elCustomPlateColor.value,
        '#ffffff',
      );
      elCustomPlateColor.addEventListener('input', () => {
        state.customPlateColor = normalizeColor(
          elCustomPlateColor.value,
          '#ffffff',
        );
      });
    }

    if (elCustomPlateSizes) {
      const [s1, s2] = parseSizesField(elCustomPlateSizes.value, 12);
      state.customPlateSize1 = s1;
      state.customPlateSize2 = s2;

      elCustomPlateSizes.addEventListener('input', () => {
        const [a, b] = parseSizesField(elCustomPlateSizes.value, 12);
        state.customPlateSize1 = a;
        state.customPlateSize2 = b;
      });

      elCustomPlateSizes.addEventListener('blur', () => {
        const [a, b] = parseSizesField(elCustomPlateSizes.value, 12);
        state.customPlateSize1 = a;
        state.customPlateSize2 = b;
        elCustomPlateSizes.value = `${a},${b}`;
      });
    }

    if (elCustomPlateLeftUrl) {
      state.customPlateLeftImg = normalizeUrl(elCustomPlateLeftUrl.value);
      elCustomPlateLeftUrl.addEventListener('input', () => {
        state.customPlateLeftImg = normalizeUrl(elCustomPlateLeftUrl.value);
      });
    }

    const getLzTextEl = () => {
      if (!fld1) return null;
      let lz = fld1.querySelector('.lz-text');
      if (!lz) {
        const wrap = document.createElement('div');
        wrap.className = 'lz-text';
        const name = fld1.querySelector('.lz-name');
        if (name) name.insertAdjacentElement('afterend', wrap);
        else fld1.appendChild(wrap);
        lz = wrap;
      }
      return lz;
    };

    const getCurrentLzHTML = () => {
      const lz = getLzTextEl();
      return lz ? lz.innerHTML : '';
    };

    if (elText) elText.value = getCurrentLzHTML();

    const setModeButtons = () => {
      ui.querySelectorAll('.ks-fr-tabs button[data-mode]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
      });

      ui.querySelectorAll('.ks-fr-subtabs button[data-cat]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat));
      });

      const inCreate = state.mode === 'create';
      if (elCreate) elCreate.classList.toggle('ks-fr-hidden', !inCreate);
      if (elList) elList.classList.toggle('ks-fr-hidden', inCreate);
      if (elListTools) elListTools.classList.toggle('ks-fr-hidden', inCreate);
      if (elSubtabs) elSubtabs.classList.toggle('ks-fr-hidden', inCreate);

      if (elList) {
        elList.dataset.cat = state.cat;
        elList.dataset.mode = state.mode;
      }
    };

    const applyIcon = (img, title) => {
      if (!fld2) return;
      state.applied.iconImg = img || '';
      fld2.innerHTML = img
        ? `<img class="ks-fr-applied-icon" src="${escAttr(img)}" alt="${escAttr(title || '')}" loading="lazy" decoding="async">`
        : initial.fld2;
      renderList();
    };

    const ensurePlateHost = () => {
      if (!fld3) return null;
      let outer = fld3.querySelector('.modal-link');

      if (!outer) {
        outer = document.createElement('pers-plah');
        outer.className = 'modal-link';
        if (state.slug) outer.setAttribute('id', state.slug);
        outer.setAttribute('role', 'button');
        outer.setAttribute('tabindex', '0');
        outer.style.cursor = 'pointer';
        fld3.innerHTML = '';
        fld3.appendChild(outer);
      }

      return outer;
    };

    const applyPlateImageOnly = (img, title) => {
      const outer = ensurePlateHost();
      if (!outer) return;

      state.applied.plateImg = img || '';
      state.applied.plateColor = '';
      state.applied.plateSize1 = 12;
      state.applied.plateSize2 = 12;
      state.applied.plateLeftImg = '';
      state.applied.plateLine1 = '';
      state.applied.plateLine2 = '';

      outer.innerHTML = img
        ? `<div class="pers-plah"><img class="ks-fr-applied-plate" src="${escAttr(img)}" alt="${escAttr(title || '')}" loading="lazy" decoding="async"></div>`
        : initial.fld3;

      renderList();
    };

    const applyPlateWithText = (img, text2lines, color, sizes2, leftImg) => {
      const outer = ensurePlateHost();
      if (!outer) return;

      const c = normalizeColor(color, '#ffffff');
      const li = normalizeUrl(leftImg);
      const [l1, l2] = Array.isArray(text2lines)
        ? text2lines
        : parseTwoLines(String(text2lines ?? ''));
      const s1 = clampSize(Array.isArray(sizes2) ? sizes2[0] : 12, 12);
      const s2 = clampSize(Array.isArray(sizes2) ? sizes2[1] : s1, s1);

      state.applied.plateImg = img || '';
      state.applied.plateColor = c;
      state.applied.plateSize1 = s1;
      state.applied.plateSize2 = s2;
      state.applied.plateLeftImg = li;
      state.applied.plateLine1 = l1;
      state.applied.plateLine2 = l2;

      const safeColor = escAttr(c);
      const safeLeftSpace = li ? '46px' : '0px';
      const line1Html = safeLineHtml(l1);
      const line2Html = safeLineHtml(l2);

      outer.innerHTML = img
        ? ` <div class="pers-plah ks-fr-platewrap" style="--ks-fr-platecolor:${safeColor};--ks-fr-leftspace:${safeLeftSpace}"> <img class="ks-fr-applied-plate" src="${escAttr(img)}" alt="" loading="lazy" decoding="async"> ${li ? `<img class="ks-fr-plateleft" src="${escAttr(li)}" alt="" loading="lazy" decoding="async">` : ''} <span class="ks-fr-plateoverlay"> <span class="ks-fr-plateoverlay__text"> <span class="ks-fr-plateoverlay__line" style="font-size:${escAttr(String(s1))}px;">${line1Html || '&nbsp;'}</span> <span class="ks-fr-plateoverlay__line" style="font-size:${escAttr(String(s2))}px;">${line2Html || '&nbsp;'}</span> </span> </span> </div> `.trim()
        : initial.fld3;

      renderList();
    };

    const applyBackground = (img) => {
      if (!fld6) return;

      const bgImg = String(img || '').trim();

      if (bgImg) {
        fld6.innerHTML = `<img src="${escAttr(bgImg)}" alt="" loading="lazy" decoding="async">`;
        state.applied.bgImg = bgImg;
      } else {
        fld6.innerHTML = initial.fld6;
        state.applied.bgImg = initial.bgImg || '';
      }

      fld6.style.display = 'block';
      fld6.style.visibility = 'visible';
      fld6.style.opacity = '1';

      renderList();
    };

    const resetCurrent = () => {
      if (state.cat === 'icon') applyIcon('', '');
      else if (state.cat === 'plate') applyPlateImageOnly('', '');
      else applyBackground('');
    };

    const resetText = () => {
      if (fld1) fld1.innerHTML = initial.fld1;
      if (elText) elText.value = getCurrentLzHTML();
    };

    const applyText = () => {
      const lz = getLzTextEl();
      if (!lz || !elText) return;
      lz.innerHTML = String(elText.value ?? '');
    };

    const renderCart = () => {
      if (elCartTotal) elCartTotal.innerHTML = frMoneyHTML(cartTotal());
      if (elCartComment) elCartComment.value = String(state.cartComment || '');

      if (!elCartList) return;
      elCartList.innerHTML = '';

      if (!state.cart.length) {
        const m = document.createElement('div');
        m.className = 'ks-fr-muted ks-fr-empty';
        m.textContent = 'Пока пусто.';
        elCartList.appendChild(m);
        return;
      }

      state.cart.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'ks-fr-cartitem';
        row.dataset.id = it.id;

        const thumb = document.createElement('span');
        thumb.className =
          'ks-fr-cartthumb ' + (it.category === 'icon' ? 'is-icon' : 'is-wide');

        if (it.category === 'icon') {
          const img = document.createElement('img');
          img.src = it.img;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          thumb.appendChild(img);
        } else {
          thumb.style.backgroundImage = `url('${String(it.img).replace(/'/g, '%27')}')`;
        }

        const title = document.createElement('div');
        title.className = 'ks-fr-carttitle';
        title.textContent = it.title || it.id;

        const right = document.createElement('div');
        right.className = 'ks-fr-cartright';

        const price = document.createElement('span');
        price.className = 'ks-fr-price';
        price.innerHTML = frMoneyHTML(it.price);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'ks-fr-pill ks-fr-cart-del';
        del.setAttribute('aria-label', 'Удалить');
        del.innerHTML = '&#215;';

        right.appendChild(price);
        right.appendChild(del);

        row.appendChild(thumb);
        row.appendChild(title);
        row.appendChild(right);

        elCartList.appendChild(row);
      });
    };

    const renderList = () => {
      if (!elList) return;

      const src = state.mode === 'owned' ? state.owned : state.shop;
      const items = src[state.cat] || [];
      const q = String(state.q || '')
        .trim()
        .toLowerCase();

      const filtered = !q
        ? items
        : items.filter((it) => {
            const t = String(it.title || '').toLowerCase();
            const id = String(it.id || '').toLowerCase();
            return t.includes(q) || id.includes(q);
          });

      elList.innerHTML = '';

      filtered.forEach((it) => {
        const row = document.createElement('div');
        row.className =
          'ks-fr-item ' +
          (it.category === 'icon' ? 'ks-fr-item--icon' : 'ks-fr-item--wide');
        row.dataset.category = it.category;
        row.dataset.img = it.img || '';
        row.dataset.title = it.title || '';
        row.dataset.itemId = it.id || '';
        if (it.price === 0 || Number.isFinite(Number(it.price)))
          row.dataset.price = String(it.price);
        row.setAttribute('role', 'button');
        row.tabIndex = 0;

        const pressed =
          it.category === 'icon'
            ? state.applied.iconImg && it.img === state.applied.iconImg
            : it.category === 'plate'
              ? state.applied.plateImg && it.img === state.applied.plateImg
              : state.applied.bgImg && it.img === state.applied.bgImg;

        row.setAttribute('aria-pressed', String(!!pressed));

        const thumb = document.createElement('span');
        thumb.className =
          'ks-fr-thumb ' +
          (it.category === 'icon' ? 'ks-fr-thumb--icon' : 'ks-fr-thumb--wide');

        if (it.category === 'icon') {
          const img = document.createElement('img');
          img.src = it.img;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          thumb.appendChild(img);
        } else {
          thumb.style.backgroundImage = `url('${String(it.img).replace(/'/g, '%27')}')`;
        }

        const cap = document.createElement('div');
        cap.className = 'ks-fr-cap';

        const showTitle = !(
          state.mode === 'shop' ||
          (state.mode === 'owned' && it.category === 'plate')
        );

        if (showTitle) cap.textContent = it.title || it.id || '';
        else cap.classList.add('ks-fr-hidden');

        const controls = document.createElement('div');
        controls.className = 'ks-fr-controls';

        const showPrice =
          state.mode === 'shop' &&
          (it.price === 0 || Number.isFinite(Number(it.price)));

        if (showPrice) {
          const price = document.createElement('span');
          price.className = 'ks-fr-price';
          price.innerHTML = frMoneyHTML(it.price);
          controls.appendChild(price);

          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'ks-fr-pill ks-fr-add';
          add.setAttribute('aria-label', 'В корзину');
          add.innerHTML =
            '<i class="fa-solid fa-cart-plus" aria-hidden="true"></i>';
          controls.appendChild(add);
        }

        row.appendChild(thumb);
        row.appendChild(cap);
        row.appendChild(controls);
        elList.appendChild(row);
      });

      if (!filtered.length) {
        const m = document.createElement('div');
        m.className = 'ks-fr-muted ks-fr-empty';
        m.textContent =
          state.mode === 'owned'
            ? state.loaded.owned
              ? 'Ничего не найдено.'
              : 'Загрузка…'
            : state.loaded.shop
              ? 'Ничего не найдено.'
              : 'Загрузка…';
        elList.appendChild(m);
      }
    };

    const loadShop = async () => {
      if (state.loaded.shop || state.loading.shop) return;
      state.loading.shop = true;
      renderList();

      try {
        const json = await fetchJson(CFG.shopJsonUrl);
        const { icons, plates, backgrounds } = normalizeShopItems(json);
        state.shop.icon = uniqBy(icons, (x) => x.id || x.img);
        state.shop.plate = uniqBy(plates, (x) => x.id || x.img);
        state.shop.background = uniqBy(backgrounds, (x) => x.id || x.img);
        state.loaded.shop = true;
      } catch (e) {
        warn('shop load error', e);
        state.loaded.shop = true;
      } finally {
        state.loading.shop = false;
        renderList();
      }
    };

    const loadOwned = async () => {
      if (state.loaded.owned || state.loading.owned) return;
      state.loading.owned = true;

      if (!state.slug) {
        state.loaded.owned = true;
        state.loading.owned = false;
        renderList();
        return;
      }

      renderList();

      try {
        const url =
          CFG.characterPageBase.replace(/\/$/, '') +
          '/' +
          encodeURIComponent(state.slug);
        const html = await fetchText(url, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const { icons, plates, backgrounds } =
          parseItemsFromCharacterPage(html);
        state.owned.icon = uniqBy(icons, (x) => x.id || x.img);
        state.owned.plate = uniqBy(plates, (x) => x.id || x.img);
        state.owned.background = uniqBy(backgrounds, (x) => x.img);
        state.loaded.owned = true;
      } catch (e) {
        warn('owned load error', e);
        state.loaded.owned = true;
      } finally {
        state.loading.owned = false;
        renderList();
      }
    };

    const ensureModeLoaded = async () => {
      if (state.mode === 'shop') await loadShop();
      else if (state.mode === 'owned') await loadOwned();
    };

    const applyCustomBackground = () => {
      const url = normalizeUrl(elCustomBackgroundUrl?.value);
      if (!url) return;
      applyBackground(url);
    };

    const resetCustomBackground = () => {
      if (elCustomBackgroundUrl) elCustomBackgroundUrl.value = '';
      applyBackground('');
    };

    const applyCustomIcon = () => {
      const url = normalizeUrl(elCustomIconUrl?.value);
      if (!url) return;
      applyIcon(url, 'custom');
    };

    const resetCustomIcon = () => {
      if (elCustomIconUrl) elCustomIconUrl.value = '';
      applyIcon('', '');
    };

    const applyCustomPlate = () => {
      const url = normalizeUrl(elCustomPlateUrl?.value);
      if (!url) return;
      const [l1, l2] = parseTwoLines(elCustomPlateText?.value);
      const color = normalizeColor(elCustomPlateColor?.value, '#ffffff');
      const [s1, s2] = parseSizesField(elCustomPlateSizes?.value, 12);
      const leftImg = normalizeUrl(elCustomPlateLeftUrl?.value);

      state.customPlateColor = color;
      state.customPlateSize1 = s1;
      state.customPlateSize2 = s2;
      state.customPlateLeftImg = leftImg;

      if (elCustomPlateSizes) elCustomPlateSizes.value = `${s1},${s2}`;
      applyPlateWithText(url, [l1, l2], color, [s1, s2], leftImg);
    };

    const resetCustomPlate = () => {
      if (elCustomPlateUrl) elCustomPlateUrl.value = '';
      if (elCustomPlateLeftUrl) elCustomPlateLeftUrl.value = '';
      if (elCustomPlateText) elCustomPlateText.value = '';
      if (elCustomPlateColor) elCustomPlateColor.value = '#ffffff';
      if (elCustomPlateSizes) elCustomPlateSizes.value = '12,12';

      state.customPlateColor = '#ffffff';
      state.customPlateSize1 = 12;
      state.customPlateSize2 = 12;
      state.customPlateLeftImg = '';

      applyPlateImageOnly('', '');
    };

    const addCustomToCart = (kind) => {
      if (kind === 'background') {
        const url = normalizeUrl(elCustomBackgroundUrl?.value);
        if (!url) return toast('Вставь ссылку на фон');
        cartAdd({
          id: `custom_background:${url}`,
          img: url,
          title: 'Свой фон',
          category: 'background',
          price: CUSTOM_BACKGROUND_PRICE,
          kind: 'custom_background',
        });
      } else if (kind === 'icon') {
        const url = normalizeUrl(elCustomIconUrl?.value);
        if (!url) return toast('Вставь ссылку на иконку');
        cartAdd({
          id: `custom_icon:${url}`,
          img: url,
          title: 'Своя иконка',
          category: 'icon',
          price: CUSTOM_ICON_PRICE,
          kind: 'custom_icon',
        });
      } else if (kind === 'plate') {
        const url = normalizeUrl(elCustomPlateUrl?.value);
        if (!url) return toast('Вставь ссылку на плашку');

        const [l1, l2] = parseTwoLines(elCustomPlateText?.value);
        const color = normalizeColor(elCustomPlateColor?.value, '#ffffff');
        const [s1, s2] = parseSizesField(elCustomPlateSizes?.value, 12);
        const leftImg = normalizeUrl(elCustomPlateLeftUrl?.value);

        cartAdd({
          id: `custom_plate:${url}::${l1}::${l2}::${color}::${s1},${s2}::${leftImg}`,
          img: url,
          title: 'Своя плашка',
          category: 'plate',
          price: CUSTOM_PLATE_PRICE,
          customLine1: l1,
          customLine2: l2,
          customColor: color,
          customSize1: s1,
          customSize2: s2,
          customLeftImg: leftImg,
          kind: 'custom_plate',
        });
      }
    };

    ui.addEventListener('click', async (e) => {
      const t = e.target;

      const modeBtn = t?.closest?.('button[data-mode]');
      if (modeBtn) {
        state.mode = modeBtn.dataset.mode;
        setModeButtons();
        ensureModeLoaded();
        renderList();
        if (state.mode === 'create') {
          if (elText) elText.value = getCurrentLzHTML();
        }
        return;
      }

      const catBtn = t?.closest?.('button[data-cat]');
      if (catBtn && state.mode !== 'create') {
        state.cat = catBtn.dataset.cat;
        setModeButtons();
        ensureModeLoaded();
        renderList();
        return;
      }

      if (t?.closest?.('#ks-fr-reset-current')) {
        resetCurrent();
        return;
      }

      if (t?.closest?.('#ks-fr-reset-text')) {
        resetText();
        return;
      }

      if (t?.closest?.('#ks-fr-apply-text')) {
        applyText();
        return;
      }

      if (t?.closest?.('#ks-fr-apply-custom-background')) {
        applyCustomBackground();
        return;
      }

      if (t?.closest?.('#ks-fr-reset-custom-background')) {
        resetCustomBackground();
        return;
      }

      if (t?.closest?.('#ks-fr-apply-custom-icon')) {
        applyCustomIcon();
        return;
      }

      if (t?.closest?.('#ks-fr-reset-custom-icon')) {
        resetCustomIcon();
        return;
      }

      if (t?.closest?.('#ks-fr-apply-custom-plate')) {
        applyCustomPlate();
        return;
      }

      if (t?.closest?.('#ks-fr-reset-custom-plate')) {
        resetCustomPlate();
        return;
      }

      const createAdd = t?.closest?.('.ks-fr-create-add');
      if (createAdd) {
        addCustomToCart(String(createAdd.dataset.kind || ''));
        return;
      }

      if (t?.closest?.('#ks-fr-cart-clear')) {
        cartClear();
        return;
      }

      if (t?.closest?.('#ks-fr-cart-copy')) {
        if (!state.cart.length) return toast('Корзина пуста');
        const code = buildRequestCode();
        const ok = await copyToClipboard(code);
        toast(ok ? 'Заявка скопирована' : 'Не удалось скопировать');
        return;
      }

      const delBtn = t?.closest?.('.ks-fr-cart-del');
      if (delBtn) {
        const row = delBtn.closest('.ks-fr-cartitem');
        const id = row?.dataset?.id || '';
        if (id) cartRemove(id);
        return;
      }

      const addBtn = t?.closest?.('.ks-fr-add');
      if (addBtn) {
        const row = addBtn.closest('.ks-fr-item');
        if (!row) return;
        const price = row.dataset.price;
        const priceNum =
          price === '0' || Number.isFinite(Number(price)) ? Number(price) : 0;

        cartAdd({
          id: String(row.dataset.itemId || row.dataset.img || ''),
          img: String(row.dataset.img || ''),
          title: String(row.dataset.title || ''),
          category: String(row.dataset.category || ''),
          price: priceNum,
          kind: 'shop',
        });
        return;
      }

      const itemRow = t?.closest?.('.ks-fr-item');
      if (itemRow) {
        const cat = itemRow.dataset.category;
        const img = itemRow.dataset.img || '';
        const title = itemRow.dataset.title || '';

        if (cat === 'icon') applyIcon(img, title);
        else if (cat === 'plate') applyPlateImageOnly(img, title);
        else if (cat === 'background') applyBackground(img);
      }
    });

    ui.addEventListener('keydown', (e) => {
      const row = e.target?.closest?.('.ks-fr-item');
      if (!row) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;

      e.preventDefault();

      const cat = row.dataset.category;
      const img = row.dataset.img || '';
      const title = row.dataset.title || '';

      if (cat === 'icon') applyIcon(img, title);
      else if (cat === 'plate') applyPlateImageOnly(img, title);
      else if (cat === 'background') applyBackground(img);
    });

    elSearch?.addEventListener('input', () => {
      state.q = elSearch.value || '';
      renderList();
    });

    elCartComment?.addEventListener('input', () => {
      state.cartComment = String(elCartComment.value ?? '');
      saveCart();
    });

    loadCart();
    setModeButtons();
    ensureModeLoaded();
    renderList();
    renderCart();
  };

  const renderOnce = () => {
    const tagEl = document.querySelector(CFG.tagSelector);
    if (!tagEl) {
      log('tag not found yet');
      return false;
    }

    ensureUnhideProfileCSS();
    ensureFittingProfileCSS();

    tagEl.querySelector(`#${CFG.fakePostId}`)?.remove?.();
    tagEl.innerHTML = '';

    const isLoggedIn =
      typeof window.UserID !== 'undefined' && Number(window.UserID) > 0;

    const profile = {
      userID: isLoggedIn ? Number(window.UserID) : 0,
      userLogin: isLoggedIn ? String(window.UserLogin || '') : 'Гость',
      userTitle: isLoggedIn ? String(window.UserTitle || '') : '',
      userAvatar: isLoggedIn ? buildAvatarUrl(window.UserAvatar) : '',
      userPosts: isLoggedIn ? Number(window.UserPosts || 0) : 0,
      respectPlus: isLoggedIn ? Number(window.UserRespectPlus || 0) : 0,
      respectMinus: isLoggedIn ? Number(window.UserRespectMinus || 0) : 0,
      fld1: isLoggedIn ? String(window.UserFld1 || '') : '',
      fld2: isLoggedIn ? String(window.UserFld2 || '') : '',
      fld3: isLoggedIn ? String(window.UserFld3 || '') : '',
      fld4: isLoggedIn ? String(window.UserFld4 || '') : '',
      fld5: isLoggedIn ? String(window.UserFld5 || '') : '',
      fld6: isLoggedIn ? String(window.UserFld6 || '') : '',
    };

    const fake = document.createElement('div');
    fake.className = 'post';
    fake.id = CFG.fakePostId;
    fake.classList.remove(HIDE_PROFILE_CLASS);
    fake.innerHTML = `<h3><span><strong>&#9733;</strong> Примерочная</span></h3>
     <div class="container">
       <div class="post-body">
         <div class="post-box">
           <div class="post-content" id="ks-fr-content"></div>
         </div>
       </div>
     </div>`.trim();

    const fakeAuthor = buildFakeAuthorFromTemplate(profile, isLoggedIn);
    if (!fakeAuthor) {
      warn('failed to build fake author from template');
      return false;
    }

    const container = fake.querySelector('.container');
    container.insertBefore(fakeAuthor, container.firstChild);

    tagEl.appendChild(fake);

    setDecodedHTML(fake.querySelector('#ks-fr-fld2'), profile.fld2);
    setDecodedHTML(fake.querySelector('#ks-fr-fld1'), profile.fld1);
    setDecodedHTML(fake.querySelector('#ks-fr-fld3'), profile.fld3);
    setDecodedHTML(fake.querySelector('#ks-fr-fld6'), profile.fld6);

    fake.querySelector('#ks-fr-user')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.to === 'function' && profile.userLogin) {
        window.to(profile.userLogin);
      }
    });

    initFittingUI(fake);
    log('rendered ok', { tagEl, fake });
    return true;
  };

  const boot = () => {
    if (!isViewTopicPage()) return;
    if (!isTargetTopic()) return;

    log('boot ok', location.href);

    if (renderOnce()) return;

    const root =
      document.getElementById(`topic_t${CFG.topicId}`) || document.body;

    const obs = new MutationObserver(() => {
      if (renderOnce()) obs.disconnect();
    });

    obs.observe(root, { childList: true, subtree: true });
  };

  onReady(boot);
  window.KS_FittingRoom = { boot, renderOnce };
})();
