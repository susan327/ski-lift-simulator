const button = document.querySelector('#install-app');
const guide = document.querySelector('#install-guide');
const standalone = matchMedia('(display-mode: standalone)');
let installPrompt;

function updateVisibility() {
  button.hidden = standalone.matches || navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  button.hidden = true;
});
standalone.addEventListener('change', updateVisibility);
updateVisibility();

button.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = undefined;
    try {
      await prompt.prompt();
      return;
    } catch {
      // The browser's menu remains available if its inline prompt expires.
    }
  }
  const agent = navigator.userAgent;
  const apple = /iPad|iPhone|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(agent);
  document.querySelector('#install-apple').hidden = android;
  document.querySelector('#install-android').hidden = apple;
  guide.showModal();
});
