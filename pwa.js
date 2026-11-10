'use strict';

(() => {
  const button = document.getElementById('installApp');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null;

  function updateInstallButton() {
    button.hidden = standalone.matches || !installPrompt;
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButton();
  });
  standalone.addEventListener('change', updateInstallButton);

  button.addEventListener('click', async () => {
    if (!installPrompt || standalone.matches) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      showError('インストールを開始できませんでした。Chromeのメニューからインストールしてください。');
    } finally {
      button.disabled = false;
      updateInstallButton();
    }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(error => {
      console.warn('App installation worker could not be registered.', error);
    });
  }
})();
