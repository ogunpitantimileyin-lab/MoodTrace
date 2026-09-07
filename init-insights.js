document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'insights') return;
  try {
    renderInsights();
    renderTriggers();
    renderGoals();
    initAppRating();
  } catch (e) {
    console.error('init-insights error', e);
  }
});
