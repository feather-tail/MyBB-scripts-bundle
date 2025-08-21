(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const allowedGroups = [1, 2, 4];

    if (typeof GroupID !== 'undefined' && allowedGroups.includes(GroupID)) {
      const navMenu = document.querySelector('#pun-navlinks ul.container');
      if (navMenu) {
        const li = document.createElement('li');
        li.id = 'navprofiles';
        const a = document.createElement('a');
        a.href = '#';
        a.innerHTML = '<span>Аккаунты</span>';
        li.appendChild(a);

        const profileMenu = document.createElement('ul');
        profileMenu.className = 'multiacc-profilemenu';
        profileMenu.style.display = 'none';
        li.appendChild(profileMenu);

        a.addEventListener('click', function (e) {
          e.preventDefault();
          profileMenu.style.display =
            profileMenu.style.display === 'none' ? 'block' : 'none';
        });

        const logoutItem = document.querySelector('#navlogout');
        if (logoutItem && logoutItem.parentNode === navMenu) {
          navMenu.insertBefore(li, logoutItem);
        } else {
          navMenu.appendChild(li);
        }

        let accounts =
          JSON.parse(localStorage.getItem('multiacc_accounts')) || [];
        let activeUsername = localStorage.getItem('multiacc_active_user');

        async function getEncryptionKey() {
          let keyData = localStorage.getItem('multiacc_key');
          if (!keyData) {
            const key = await crypto.subtle.generateKey(
              { name: 'AES-GCM', length: 256 },
              true,
              ['encrypt', 'decrypt'],
            );
            const exported = await crypto.subtle.exportKey('raw', key);
            localStorage.setItem(
              'multiacc_key',
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

          accounts.forEach(function (account, index) {
            const accountLi = document.createElement('li');
            const accountA = document.createElement('a');
            accountA.href = '#';
            accountA.textContent = account.username;

            if (account.username === activeUsername) {
              accountA.classList.add('multiacc-active');
            }

            accountA.addEventListener('click', async function (e) {
              e.preventDefault();
              const password = await decryptPassword(account.password);
              localStorage.setItem('multiacc_active_user', account.username);
              loginToAccount(account.username, password);
            });

            accountLi.appendChild(accountA);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.className = 'multiacc-delete-btn';
            deleteBtn.style.marginLeft = '10px';
            deleteBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              e.preventDefault();
              accounts.splice(index, 1);
              localStorage.setItem(
                'multiacc_accounts',
                JSON.stringify(accounts),
              );
              updateProfileMenu();
            });
            accountLi.appendChild(deleteBtn);
            profileMenu.appendChild(accountLi);
          });

          const addAccountLi = document.createElement('li');
          const addAccountA = document.createElement('a');
          addAccountA.href = '#';
          addAccountA.textContent = 'Добавить аккаунт';
          addAccountA.addEventListener('click', function (e) {
            e.preventDefault();
            showAddAccountDialog();
          });
          addAccountLi.append(addAccountA);
          profileMenu.prepend(addAccountLi);
        }

        function showAddAccountDialog() {
          const overlay = document.createElement('div');
          overlay.className = 'multiacc-overlay';
          overlay.style.position = 'fixed';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.width = '100%';
          overlay.style.height = '100%';
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
          overlay.style.display = 'flex';
          overlay.style.justifyContent = 'center';
          overlay.style.alignItems = 'center';
          overlay.style.zIndex = '1000';

          const dialog = document.createElement('div');
          dialog.className = 'multiacc-dialog';
          dialog.style.backgroundColor = '#fff';
          dialog.style.padding = '20px';
          dialog.style.borderRadius = '5px';
          dialog.style.width = '300px';

          const form = document.createElement('form');

          const divLoginLabel = document.createElement('div');
          const usernameLabel = document.createElement('label');
          usernameLabel.textContent = 'Логин:';
          usernameLabel.htmlFor = 'multiacc-username-input';
          const usernameInput = document.createElement('input');
          usernameInput.type = 'text';
          usernameInput.id = 'multiacc-username-input';
          usernameInput.required = true;
          divLoginLabel.append(usernameLabel, usernameInput);

          const divPasswordLabel = document.createElement('div');
          const passwordLabel = document.createElement('label');
          passwordLabel.textContent = 'Пароль:';
          passwordLabel.htmlFor = 'multiacc-password-input';
          const passwordInput = document.createElement('input');
          passwordInput.type = 'password';
          passwordInput.id = 'multiacc-password-input';
          passwordInput.required = true;
          divPasswordLabel.append(passwordLabel, passwordInput);

          const buttonContainer = document.createElement('div');
          buttonContainer.style.marginTop = '10px';

          const addButton = document.createElement('button');
          addButton.type = 'submit';
          addButton.textContent = 'Добавить';

          const cancelButton = document.createElement('button');
          cancelButton.type = 'button';
          cancelButton.textContent = 'Отмена';
          cancelButton.style.marginLeft = '10px';
          cancelButton.addEventListener('click', function () {
            document.body.removeChild(overlay);
          });

          buttonContainer.append(addButton, cancelButton);

          form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (accounts.find((acc) => acc.username === username)) {
              alert('Аккаунт с таким логином уже существует!');
              return;
            }

            const encrypted = await encryptPassword(password);
            const newAccount = {
              username,
              password: encrypted,
            };

            accounts.push(newAccount);
            localStorage.setItem('multiacc_accounts', JSON.stringify(accounts));
            updateProfileMenu();
            document.body.removeChild(overlay);
          });

          form.append(
            divLoginLabel,
            document.createElement('br'),
            divPasswordLabel,
            buttonContainer,
          );
          dialog.appendChild(form);
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
        }

        function loginToAccount(username, password) {
          const form = document.createElement('form');
          form.method = 'post';
          form.action = 'login.php?action=in';

          const inputFormSent = document.createElement('input');
          inputFormSent.type = 'hidden';
          inputFormSent.name = 'form_sent';
          inputFormSent.value = '1';

          const inputRedirectURL = document.createElement('input');
          inputRedirectURL.type = 'hidden';
          inputRedirectURL.name = 'redirect_url';
          inputRedirectURL.value = '';

          const inputUsername = document.createElement('input');
          inputUsername.type = 'hidden';
          inputUsername.name = 'req_username';
          inputUsername.value = username;

          const inputPassword = document.createElement('input');
          inputPassword.type = 'hidden';
          inputPassword.name = 'req_password';
          inputPassword.value = password;

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
  });
})();
