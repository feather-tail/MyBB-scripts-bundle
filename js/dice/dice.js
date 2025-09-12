(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, $$, createEl, showToast } = helpers;
  const config = helpers.getConfig('dice', {
    buttonSelector: '#dice-roll-btn',
    buttonAfterSelector: '#button-addition',
  });
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

  function injectButton() {
    const existing = $(config.buttonSelector);
    if (existing) {
      diceButton = existing;
      return;
    }

    const anchor = $(config.buttonAfterSelector);
    if (!anchor) return;

    const container = createEl('td', {
      id: config.buttonSelector.replace(/^#/, ''),
      title: 'Бросить кубики',
    });
    container.append(
      createEl('img', { src: '/i/blank.gif', style: 'cursor:pointer' }),
    );
    anchor.after(container);
    diceButton = container;
  }

  function openModal() {
    const { openModal: show } = window.helpers.modal;
    const modalContent = createEl('div', { className: 'dice-modal' });

    const title = createEl('h3', {
      id: 'dice-title',
      text: 'Бросить кубики',
    });

    const countLabel = createEl('label');
    const countInput = createEl('input', {
      type: 'number',
      id: 'dice-count',
      min: '1',
      max: String(config.maxDice),
      value: '1',
    });
    countLabel.append('Количество кубиков:', countInput);

    const sidesLabel = createEl('label');
    const sidesInput = createEl('input', {
      type: 'number',
      id: 'dice-sides',
      min: '2',
      max: String(config.maxSides),
      value: '6',
    });
    sidesLabel.append('Количество граней:', sidesInput);

    const actions = createEl('div', { className: 'actions' });
    const cancelBtn = createEl('button', {
      type: 'button',
      id: 'dice-cancel',
      text: 'Отмена',
    });
    const okBtn = createEl('button', {
      type: 'button',
      id: 'dice-ok',
      text: 'Бросить',
    });
    actions.append(cancelBtn, okBtn);

    modalContent.append(title, countLabel, sidesLabel, actions);
    const { close } = show(modalContent, {
      onClose: () => diceButton?.focus?.(),
    });
    cancelBtn.addEventListener('click', close);
    okBtn.addEventListener('click', () => {
      const cnt = parseInt(countInput.value, 10);
      const sides = parseInt(sidesInput.value, 10);
      if (!cnt || cnt < 1 || cnt > config.maxDice) {
        showToast(`Количество кубиков: от 1 до ${config.maxDice}`, {
          type: 'error',
        });
        return;
      }
      if (!sides || sides < 2 || sides > config.maxSides) {
        showToast(`Количество граней: от 2 до ${config.maxSides}`, {
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
    const cipher = rolls.map((r) => r * config.obfOffset).join('-') + '-';
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
        .map((n) => parseInt(n, 10) / config.obfOffset);
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
    injectButton();
    postContainer = $('#pun-viewtopic');
    if (!diceButton) return;

    diceButton.addEventListener('click', openModal);

    initDice();
    observePosts();
  }

  helpers.runOnceOnReady(init);
  helpers.register('dice', { init });
})();
