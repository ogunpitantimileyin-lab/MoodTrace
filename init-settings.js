document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'settings') return;
  try {
    renderCheckInManager();
  } catch (e) {
    console.error('init-settings error', e);
  }
});
