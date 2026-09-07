document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'analytics') return;
  try {
    renderAnalytics();
  } catch (e) {
    console.error('init-analytics error', e);
  }
});
