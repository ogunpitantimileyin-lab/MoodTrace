document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'history') return;
  try {
    initDeleteListener();
    initSearch();
    renderEditCategoryChips();
    renderHistory();
    initHistoryFilters();
  } catch (e) {
    console.error('init-history error', e);
  }
});
