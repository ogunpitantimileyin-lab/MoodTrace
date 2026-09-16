document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'settings') return;
  try {
    renderCheckInManager();
    if (typeof renderAppLockSettings === 'function') renderAppLockSettings();
  } catch (e) {
    console.error('init-settings error', e);
  }
});
