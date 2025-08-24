(() => {
  'use strict';

  const helpers = window.helpers;
  const { $, createEl, showToast } = helpers;
  const config = helpers.getConfig('multiaccount', {});

  function init() {
    if (
      typeof GroupID !== 'undefined' &&
      config.allowedGroups.includes(GroupID)
    ) {
      const navMenu = $(config.selectors.navMenu);
      if (navMenu) {
        const li = createEl('li', { id: config.ids.navProfiles });
        const a = createEl('a', {
          href: '#',
          html: `<span>${config.texts.menuTitle}</span>`,
        });
        li.appendChild(a);

        const profileMenu = createEl('ul', {
          className: config.classes.profileMenu,
          style: 'display:none;',
        });
        li.appendChild(profileMenu);

        a.addEventListener('click', (e) => {
          e.preventDefault();
          profileMenu.style.display =
            profileMenu.style.display === 'none' ? 'block' : 'none';
        });

        const logoutItem = $(config.selectors.logout);
        if (logoutItem && logoutItem.parentNode === navMenu)
          navMenu.insertBefore(li, logoutItem);
        else navMenu.appendChild(li);

        let accounts =
          JSON.parse(localStorage.getItem(config.storageKeys.accounts)) || [];
        let activeUsername = localStorage.getItem(config.storageKeys.active);

        async function getEncryptionKey() {
          let keyData = localStorage.getItem(config.storageKeys.key);
          if (!keyData) {
            const key = await crypto.subtle.generateKey(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt'],
            );
            const exported = await crypto.subtle.exportKey('raw', key);
            localStorage.setItem(
              config.storageKeys.key,
              btoa(String.fromCharCode(...new Uint8Array(exported))),
            );
            return key;
          } else {
            const binary = Uint8Array.from(atob(keyData), (c) =>
              c.charCodeAt(0),
            );
            return await crypto.subtle.importKey(
              'raw',
              binary,
              'AES-GCM',
              true,
              ['encrypt', 'decrypt'],
            );
          }
        }

        async function encryptPassword(password) {
          const key = await getEncryptionKey();
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(password),
          );
          return {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted)),
          };
        }

        async function decryptPassword(encrypted) {
          const key = await getEncryptionKey();
          const iv = new Uint8Array(encrypted.iv);
          const data = new Uint8Array(encrypted.data);
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data,
          );
          return new TextDecoder().decode(decrypted);
        }

        function updateProfileMenu() {
          profileMenu.innerHTML = '';

          accounts.sort((a, b) => a.username.localeCompare(b.username));

          accounts.forEach((account, index) => {
            const accountLi = createEl('li');
            const accountA = createEl('a', {
              href: '#',
              text: account.username,
            });

            if (account.username === activeUsername) {
              accountA.classList.add(config.classes.active);
            }

            accountA.addEventListener('click', async (e) => {
              e.preventDefault();
              const password = await decryptPassword(account.password);
              localStorage.setItem(config.storageKeys.active, account.username);
              loginToAccount(account.username, password);
            });

            accountLi.appendChild(accountA);

            const deleteBtn = createEl('button', {
              text: config.texts.deleteButton,
              className: config.classes.deleteBtn,
              style: 'margin-left:10px;',
            });
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              accounts.splice(index, 1);
              localStorage.setItem(
                config.storageKeys.accounts,
                JSON.stringify(accounts),
              );
              updateProfileMenu();
            });
            accountLi.appendChild(deleteBtn);
            profileMenu.appendChild(accountLi);
          });

          const addAccountLi = createEl('li');
          const addAccountA = createEl('a', {
            href: '#',
            text: config.texts.addAccount,
          });
          addAccountA.addEventListener('click', (e) => {
            e.preventDefault();
            showAddAccountDialog();
          });
          addAccountLi.append(addAccountA);
          profileMenu.prepend(addAccountLi);
        }

        function showAddAccountDialog() {
          const overlay = createEl('div', {
            className: config.classes.overlay,
          });
          Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '1000',
          });

          const dialog = createEl('div', { className: config.classes.dialog });
          Object.assign(dialog.style, {
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '5px',
            width: '300px',
          });

          const form = createEl('form');

          const divLoginLabel = createEl('div');
          const usernameLabel = createEl('label', {
            text: config.texts.usernameLabel,
            htmlFor: config.ids.usernameInput,
          });
          const usernameInput = createEl('input', {
            type: 'text',
            id: config.ids.usernameInput,
            required: true,
          });
          divLoginLabel.append(usernameLabel, usernameInput);

          const divPasswordLabel = createEl('div');
          const passwordLabel = createEl('label', {
            text: config.texts.passwordLabel,
            htmlFor: config.ids.passwordInput,
          });
          const passwordInput = createEl('input', {
            type: 'password',
            id: config.ids.passwordInput,
            required: true,
          });
          divPasswordLabel.append(passwordLabel, passwordInput);

          const buttonContainer = createEl('div', {
            style: 'margin-top:10px;',
          });

          const addButton = createEl('button', {
            type: 'submit',
            text: config.texts.addButton,
          });

          const cancelButton = createEl('button', {
            type: 'button',
            text: config.texts.cancelButton,
            style: 'margin-left:10px;',
          });
          cancelButton.addEventListener('click', () =>
            document.body.removeChild(overlay),
          );

          buttonContainer.append(addButton, cancelButton);

          form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (accounts.find((acc) => acc.username === username)) {
              showToast(config.texts.duplicateAccount, { type: 'error' });
              return;
            }

            const encrypted = await encryptPassword(password);
            const newAccount = {
              username,
              password: encrypted,
            };

            accounts.push(newAccount);
            localStorage.setItem(
              config.storageKeys.accounts,
              JSON.stringify(accounts),
            );
            updateProfileMenu();
            document.body.removeChild(overlay);
          });

          form.append(
            divLoginLabel,
            createEl('br'),
            divPasswordLabel,
            buttonContainer,
          );
          dialog.appendChild(form);
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
        }

        function loginToAccount(username, password) {
          const form = createEl('form', {
            method: 'post',
            action: config.loginUrl,
          });

          const inputFormSent = createEl('input', {
            type: 'hidden',
            name: config.formFields.formSent,
            value: '1',
          });

          const inputRedirectURL = createEl('input', {
            type: 'hidden',
            name: config.formFields.redirectUrl,
            value: '',
          });

          const inputUsername = createEl('input', {
            type: 'hidden',
            name: config.formFields.username,
            value: username,
          });

          const inputPassword = createEl('input', {
            type: 'hidden',
            name: config.formFields.password,
            value: password,
          });

          form.append(
            inputFormSent,
            inputRedirectURL,
            inputUsername,
            inputPassword,
          );
          document.body.appendChild(form);
          form.submit();
        }

        updateProfileMenu();
      }
    }
  }

  helpers.runOnceOnReady(init);
  helpers.register('multiaccount', { init });
})();
