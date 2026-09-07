document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'dashboard') return;
  try {
    checkOnboarding();
    renderDashboard();
    initReminders();
    renderGoals();
    initAppRating();
  } catch (e) {
    console.error('init-dashboard error', e);
  }
});
