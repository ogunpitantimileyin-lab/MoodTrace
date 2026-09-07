document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'monthly') return;
  try {
    renderMonthlySummary();
  } catch (e) {
    console.error('init-monthly error', e);
  }
});
