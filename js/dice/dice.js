(() => {
  'use strict';

  const { $, $$, createEl } = window.helpers;
  const CFG = window.ScriptConfig.dice;
  const bbRe = /\[dice=((?:\d+-)+)(\d+):(\d+)\]/g;

  let diceButton = null;
  let postContainer = null;
  let modalOverlay = null;
  let countInput, sidesInput, cancelBtn, okBtn;

  function numword(s, one, two, many) {
    const n = Math.abs(s) % 100;
    if (n >= 11 && n <= 14) return many;
    const rem = n % 10;
    if (rem === 1) return one;
    if (rem >= 2 && rem <= 4) return two;
    return many;
  }

  function rollOne(n) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % n) + 1;
  }

  function createModal() {
    modalOverlay = createEl('div');
    modalOverlay.className = 'dice-overlay';
    modalOverlay.setAttribute('aria-hidden', 'true');
    modalOverlay.innerHTML = `
        <div class="dice-modal" role="dialog" aria-modal="true" aria-labelledby="dice-title">
          <h3 id="dice-title">Бросить кубики</h3>
          <label>
            Количество кубиков:
            <input type="number" id="dice-count" min="1" max="${CFG.maxDice}" value="1">
          </label>
          <label>
            Количество граней:
            <input type="number" id="dice-sides" min="2" max="${CFG.maxSides}" value="6">
          </label>
          <div class="actions">
            <button type="button" id="dice-cancel">Отмена</button>
            <button type="button" id="dice-ok">Бросить</button>
          </div>
        </div>
      `;
    document.body.appendChild(modalOverlay);

    countInput = $('#dice-count', modalOverlay);
    sidesInput = $('#dice-sides', modalOverlay);
    cancelBtn = $('#dice-cancel', modalOverlay);
    okBtn = $('#dice-ok', modalOverlay);

    function closeModal() {
      modalOverlay.classList.remove('active');
      modalOverlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      diceButton.focus();
    }

    cancelBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        e.preventDefault();
        closeModal();
      }
    });

    modalOverlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = $$('input, button', modalOverlay);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    okBtn.addEventListener('click', () => {
      const cnt = parseInt(countInput.value, 10);
      const sides = parseInt(sidesInput.value, 10);
      if (!cnt || cnt < 1 || cnt > CFG.maxDice) {
        alert(`Количество кубиков: от 1 до ${CFG.maxDice}`);
        return;
      }
      if (!sides || sides < 2 || sides > CFG.maxSides) {
        alert(`Количество граней: от 2 до ${CFG.maxSides}`);
        return;
      }
      closeModal();
      handleRoll(cnt, sides);
    });
  }

  function openModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.add('active');
    modalOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    countInput.focus();
  }

  function handleRoll(count, sides) {
    const rolls = Array.from({ length: count }, () => rollOne(sides));
    const cipher = rolls.map((r) => r * CFG.obfOffset).join('-') + '-';
    const code = `[dice=${cipher}${count}:${sides}]`;

    if (typeof smile === 'function') {
      smile(code);
    } else if (typeof insert === 'function') {
      insert(' ' + code + ' ');
    } else {
      const ta = $('textarea');
      if (ta) {
        ta.value += '\n' + code;
        ta.focus();
      }
    }
  }

  function renderDiceInPost(node) {
    node.innerHTML = node.innerHTML.replace(bbRe, (_, cipher, c, s) => {
      const rolls = cipher
        .split('-')
        .filter(Boolean)
        .map((n) => parseInt(n, 10) / CFG.obfOffset);
      const total = rolls.reduce((a, b) => a + b, 0);

      const count = parseInt(c, 10);
      const sides = parseInt(s, 10);
      const cubeWord = numword(count, 'куб', 'куба', 'кубов');
      const sideWord = numword(sides, 'гранью', 'гранями', 'гранями');

      return `
          <div class="quote-box"><blockquote>
            <p><b>Игрок кинул ${count} ${cubeWord} с ${sides} ${sideWord}</b></p>
            <p>Результат броска: <b>${total}</b></p>
          </blockquote></div>`;
    });
  }

  function initDice() {
    $$('.post-content').forEach((pc) => {
      if (pc.textContent.includes('[dice=')) {
        renderDiceInPost(pc);
      }
    });
  }

  const pending = new Set();
  let scheduled = false;
  function scheduleRender() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        pending.forEach(renderDiceInPost);
        pending.clear();
        scheduled = false;
      });
    }
  }

  function observePosts() {
    if (!postContainer) return;
    new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && n.matches('.post-content')) {
            pending.add(n);
          }
        });
      });
      if (pending.size) scheduleRender();
    }).observe(postContainer, { childList: true, subtree: true });
  }

  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;

    diceButton = $('#dice-roll-btn');
    postContainer = $('#pun-viewtopic');
    if (!diceButton) return;

    createModal();
    diceButton.addEventListener('click', openModal);

    initDice();
    observePosts();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
