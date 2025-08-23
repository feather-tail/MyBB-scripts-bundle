(() => {
  'use strict';

  const { $, $$, createEl, showToast } = window.helpers;
  const CFG = helpers.getConfig('dice', {});
  const bbRe = /\[dice=((?:\d+-)+)(\d+):(\d+)\]/g;

  let diceButton = null;
  let postContainer = null;

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

  function openModal() {
    const { openModal: show } = window.helpers.modal;
    const modalContent = createEl('div', {
      className: 'dice-modal',
      html: `
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
          </div>`,
    });
    const { close } = show(modalContent, { onClose: () => diceButton.focus() });
    const countInput = $('#dice-count', modalContent);
    const sidesInput = $('#dice-sides', modalContent);
    const cancelBtn = $('#dice-cancel', modalContent);
    const okBtn = $('#dice-ok', modalContent);
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const cnt = parseInt(countInput.value, 10);
      const sides = parseInt(sidesInput.value, 10);
      if (!cnt || cnt < 1 || cnt > CFG.maxDice) {
        showToast(`Количество кубиков: от 1 до ${CFG.maxDice}`, {
          type: 'error',
        });
        return;
      }
      if (!sides || sides < 2 || sides > CFG.maxSides) {
        showToast(`Количество граней: от 2 до ${CFG.maxSides}`, {
          type: 'error',
        });
        return;
      }
      close();
      handleRoll(cnt, sides);
    });
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

  function init() {
    diceButton = $('#dice-roll-btn');
    postContainer = $('#pun-viewtopic');
    if (!diceButton) return;

    diceButton.addEventListener('click', openModal);

    initDice();
    observePosts();
  }

  helpers.ready(helpers.once(init));
})();
