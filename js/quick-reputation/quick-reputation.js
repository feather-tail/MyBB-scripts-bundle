(() => {
  'use strict';

  const cfgRoot =
    (window.ScriptConfig && window.ScriptConfig.quickReputation) || {};
  if (cfgRoot.enabled === false) return;

  const sel = cfgRoot.selectors || {};
  const cls = cfgRoot.classes || {};
  const txt = cfgRoot.texts || {};
  const ids = cfgRoot.ids || {};
  const behaviorCfg = cfgRoot.behavior || {};

  const POST_SELECTOR = sel.post || '.post';
  const POSTBOX_SELECTOR = sel.postBox || '.post-box';
  const RATING_LINK_SELECTOR = sel.ratingLink || '.post-rating p > a';
  const POSTVOTE_BLOCK_SELECTOR = sel.postVoteBlock || 'div.post-vote';
  const POSTVOTE_LINK_SELECTOR = sel.postVoteLink || 'div.post-vote p > a';
  const EMAIL_PROFILE_SELECTOR =
    sel.emailProfileLink || '.pl-email a[href*="profile.php?"]';
  const RESPECT_FIELD_SELECTOR = sel.respectField || '.pa-respect';
  const POSITIVE_FIELD_SELECTOR = sel.positiveField || '.pa-positive';
  const REPUTATION_OVERLAY_SELECTOR =
    sel.reputationOverlay || '#pun-reputation';
  const REPUTATION_SEND_BTN_SELECTOR =
    sel.reputationSendBtn || '#reputationButtonSend';
  const NONULL_CLASS = cls.noNull || 'noNull';
  const IGNORE_ALERT_PART =
    txt.ignoreAlertSubstring || 'Мы не смогли сохранить ваше сообщение';
  const TITLE_PLUS_NO_COMMENT =
    txt.plusNoCommentTitle || 'Плюс без комментария';
  const TITLE_PLUS_WITH_COMMENT =
    txt.plusWithCommentTitle || 'Плюсики с комментарием';
  const POSTVOTE_PREFIX = ids.postVotePrefix || 'post-';
  const addCommentEnabled = cfgRoot.addComment !== false;

  const ratingClickMode = behaviorCfg.ratingClickMode || 'ajax-only';
  const openDefaultWithCtrlClick =
    behaviorCfg.openDefaultWithCtrlClick !== false;

  const LONG_PRESS_MS = (() => {
    const n = parseInt(behaviorCfg.longPressMs, 10);
    return Number.isFinite(n) && n >= 150 ? n : 450;
  })();

  const isCoarsePointer = (() => {
    try {
      return (
        window.matchMedia &&
        window.matchMedia('(pointer: coarse)').matches
      );
    } catch (e) {
      return false;
    }
  })();

  const originalAlert =
    typeof window.alert === 'function' ? window.alert.bind(window) : null;
  if (originalAlert) {
    window.alert = (msg) => {
      if (typeof msg === 'string' && msg.indexOf(IGNORE_ALERT_PART) !== -1) {
        return;
      }
      originalAlert(msg);
    };
  }

  const normalizeRatingDigit = (el) => {
    if (!el) return;
    const raw = (el.textContent || '').trim();
    let n = parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    el.textContent = String(n);
    if (n > 0) el.classList.add(NONULL_CLASS);
    else el.classList.remove(NONULL_CLASS);
  };

  const notifyError = (message) => {
    if (!message) return;
    if (window.jQuery && window.jQuery.jGrowl) {
      window.jQuery.jGrowl(message);
    } else if (originalAlert) {
      originalAlert(message);
    }
  };

  const findPostRoot = (el) => (el ? el.closest(POST_SELECTOR) : null);

  const getUserIdFromProfileLink = (href) => {
    if (!href) return null;
    const m = href.match(/\?id=(\d+)$/);
    return m ? m[1] : null;
  };

  const getPostIdFromHref = (href) => {
    if (!href) return null;
    const m = href.match(/\?id=(\d+)/);
    return m ? m[1] : null;
  };

  const getVoteValueFromHref = (href) => {
    if (!href) return 1;
    const m = href.match(/&v=(\d+)/);
    if (!m) return 1;
    const vRaw = parseInt(m[1], 10);
    return vRaw === 0 ? -1 : 1;
  };

  const getUidForPost = (postEl) => {
    if (!postEl) return null;
    const profileLink = postEl.querySelector(EMAIL_PROFILE_SELECTOR);
    if (!profileLink) return null;
    return getUserIdFromProfileLink(profileLink.getAttribute('href') || '');
  };

  const collectRespectFieldsForUser = (uid) => {
    const result = [];
    if (!uid) return result;

    const anchors = document.querySelectorAll(
      `.pl-email a[href$="profile.php?id=${uid}"]`,
    );
    anchors.forEach((a) => {
      const post = a.closest(POST_SELECTOR);
      if (!post) return;
      const respect = post.querySelector(RESPECT_FIELD_SELECTOR);
      if (respect) result.push(respect);
    });

    return result;
  };

  const collectPositiveFieldsForCurrentUser = () => {
    const result = [];
    const myId = window.UserID;
    if (!myId) return result;

    const anchors = document.querySelectorAll(
      `.pl-email a[href$="profile.php?id=${myId}"]`,
    );
    anchors.forEach((a) => {
      const post = a.closest(POST_SELECTOR);
      if (!post) return;
      const pos = post.querySelector(POSITIVE_FIELD_SELECTOR);
      if (pos) result.push(pos);
    });

    return result;
  };

  const applyBracketRatingChange = (nodes, v, revert) => {
    if (!nodes || !nodes.length) return;

    nodes.forEach((node) => {
      let html = node.innerHTML;
      let delta = v;
      if (revert) delta = delta > 0 ? -1 : 1;

      if (v > 0) {
        html = html.replace(/\[\+(\d+)\//g, (str, p1) => {
          const num = parseInt(p1, 10) + delta;
          return `[+${num}/`;
        });
      } else {
        html = html.replace(/\/-(\d+)\]/g, (str, p1) => {
          const num = parseInt(p1, 10) - delta;
          return `/-${num}]`;
        });
      }

      node.innerHTML = html;
    });
  };

  const applyPlainRatingChange = (nodes, v) => {
    if (!nodes || !nodes.length) return;

    nodes.forEach((node) => {
      const span = node.querySelector('span:not(.fld-name)');
      if (!span) return;
      const raw = (span.textContent || '').trim();
      let current = parseInt(raw, 10);
      if (Number.isNaN(current)) current = 0;

      const next = current + v;
      span.textContent = !next ? '0' : (next > 0 ? '+' : '') + String(next);
    });
  };

  const updateReputationFields = (uid, v, delta) => {
    const respectNodes = collectRespectFieldsForUser(uid);
    const posNodes = collectPositiveFieldsForCurrentUser();
    if (!respectNodes.length && !posNodes.length) return;

    const hasBracketFormat = respectNodes.some(
      (el) => el.innerHTML.indexOf('[') !== -1,
    );

    if (hasBracketFormat) {
      applyBracketRatingChange(respectNodes, v, false);
      applyBracketRatingChange(posNodes, v, false);

      if (Math.abs(delta) === 2) {
        const v2 = v > 0 ? -1 : 1;
        applyBracketRatingChange(respectNodes, v2, true);
        applyBracketRatingChange(posNodes, v2, true);
      }
    } else {
      applyPlainRatingChange(respectNodes, v);
      applyPlainRatingChange(posNodes, v);
    }
  };

  const sendQuickPlus = (post, ratingLink) => {
    if (!post) return;

    const voteLink = post.querySelector(POSTVOTE_LINK_SELECTOR);
    if (!voteLink) return;

    const href = voteLink.getAttribute('href');
    if (!href) return;

    const pid = getPostIdFromHref(href);
    if (!pid) return;

    const uid = getUidForPost(post);
    const v = getVoteValueFromHref(href);

    const postVoteBlock = document.getElementById(`${POSTVOTE_PREFIX}${pid}-vote`);
    if (postVoteBlock) postVoteBlock.style.display = 'none';

    const url = href.indexOf('format=json') !== -1 ? href : `${href}&format=json`;

    const handleResponse = (data) => {
      if (!data) return;

      if (data.error && data.error.message) notifyError(data.error.message);
      if (!data.delta) return;

      const ratingEl = document.querySelector(`#p${pid} .post-rating p > a`);
      if (ratingEl) {
        let pr = data.response;
        if (typeof pr === 'number') pr = pr.toString();
        const n = parseInt(pr, 10);
        ratingEl.textContent = Number.isNaN(n) ? String(pr) : String(n);
        if (!Number.isNaN(n) && n > 0) ratingEl.classList.add(NONULL_CLASS);
        else ratingEl.classList.remove(NONULL_CLASS);
      }

      if (uid) updateReputationFields(uid, v, data.delta);
    };

    if (window.jQuery && window.jQuery.get) {
      window.jQuery
        .get(url, handleResponse)
        .fail((xhr, status, err) => {
          console.error('quickReputation jQuery error:', status, err);
        });
    } else if (window.fetch) {
      fetch(url, { credentials: 'same-origin' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(handleResponse)
        .catch((err) => {
          console.error('quickReputation fetch error:', err);
        });
    } else {
      const img = new Image();
      img.src = url;
    }
  };

  let pendingRatingLink = null;

  const onDocumentClick = (e) => {
    const target = e.target;
    if (!target) return;

    const link = target.closest('a');
    const href = link && link.getAttribute('href');

    const isRelationLink = link && href && href.indexOf('/relation.php?id=') !== -1;
    const isPostVotePlus = link && link.closest(POSTVOTE_BLOCK_SELECTOR || 'div.post-vote');
    const isRespectLink =
      link && link.closest(RESPECT_FIELD_SELECTOR || '.pa-respect') && isRelationLink;

    if (isRespectLink || isPostVotePlus) {
      const post = link.closest(POST_SELECTOR);
      if (post) {
        const rating = post.querySelector(RATING_LINK_SELECTOR);
        if (rating) pendingRatingLink = rating;
      }
      return;
    }

    if (
      target.matches(REPUTATION_SEND_BTN_SELECTOR) ||
      target.closest(REPUTATION_SEND_BTN_SELECTOR)
    ) {
      if (pendingRatingLink) {
        const el = pendingRatingLink;
        pendingRatingLink = null;
        setTimeout(() => normalizeRatingDigit(el), 500);
      }
    }
  };

  const init = () => {
    if (addCommentEnabled) {
      const voteBlocks = document.querySelectorAll(POSTVOTE_BLOCK_SELECTOR);
      voteBlocks.forEach((el) => {
        el.style.display = '';
      });
    }

    const ratingLinks = document.querySelectorAll(RATING_LINK_SELECTOR);
    ratingLinks.forEach((link) => {
      normalizeRatingDigit(link);
      link.title = TITLE_PLUS_NO_COMMENT;

      const post = findPostRoot(link);
      if (post && addCommentEnabled) {
        const voteLink = post.querySelector(POSTVOTE_LINK_SELECTOR);
        if (voteLink && !voteLink.title) {
          voteLink.title = TITLE_PLUS_WITH_COMMENT;
        }
      }

      let pressTimer = null;
      let startX = 0;
      let startY = 0;
      let longPressFired = false;

      const clearPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      const startPress = (e) => {
        if (ratingClickMode === 'default-only') return;

        longPressFired = false;
        clearPress();

        const p = (e.touches && e.touches[0]) || e;
        startX = p.clientX || 0;
        startY = p.clientY || 0;

        pressTimer = setTimeout(() => {
          pressTimer = null;
          longPressFired = true;
          const postEl = findPostRoot(link);
          if (postEl) sendQuickPlus(postEl, link);
        }, LONG_PRESS_MS);
      };

      const movePress = (e) => {
        if (!pressTimer) return;
        const p = (e.touches && e.touches[0]) || e;
        const dx = (p.clientX || 0) - startX;
        const dy = (p.clientY || 0) - startY;
        if (dx * dx + dy * dy > 100) {
          clearPress();
        }
      };

      const endPress = () => clearPress();

      if (isCoarsePointer) {
        if (window.PointerEvent) {
          link.addEventListener('pointerdown', startPress);
          link.addEventListener('pointermove', movePress);
          link.addEventListener('pointerup', endPress);
          link.addEventListener('pointercancel', endPress);
          link.addEventListener('pointerleave', endPress);
        } else {
          link.addEventListener('touchstart', startPress, { passive: true });
          link.addEventListener('touchmove', movePress, { passive: true });
          link.addEventListener('touchend', endPress);
          link.addEventListener('touchcancel', endPress);
        }

        link.addEventListener('contextmenu', (e) => {
          if (pressTimer || longPressFired) e.preventDefault();
        });
      }

      link.onclick = (e) => {
        e = e || window.event;

        if (isCoarsePointer) {
          if (e && e.preventDefault) e.preventDefault();
          return false;
        }

        const postEl = findPostRoot(link);
        if (!postEl) return true;

        const modifierPressed =
          openDefaultWithCtrlClick && (e.ctrlKey || e.metaKey);

        let doAjax = true;
        let cancelDefault = false;

        if (modifierPressed) {
          doAjax = false;
          cancelDefault = false;
        } else {
          if (ratingClickMode === 'ajax-only') {
            cancelDefault = true;
            doAjax = true;
          } else if (ratingClickMode === 'ajax+default') {
            cancelDefault = false;
            doAjax = true;
          } else if (ratingClickMode === 'default-only') {
            cancelDefault = false;
            doAjax = false;
          }
        }

        if (doAjax) sendQuickPlus(postEl, link);

        if (cancelDefault) {
          if (e && e.preventDefault) e.preventDefault();
          return false;
        }

        return true;
      };
    });

    document.addEventListener('click', onDocumentClick);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
