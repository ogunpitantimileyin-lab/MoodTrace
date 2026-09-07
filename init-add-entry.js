document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'add-entry') return;
  try {
    initDatetime();
    renderAddEntryCategories();
    selectedCategory = 'work';
    renderCustomCopingChips();
  } catch (e) {
    console.error('init-add-entry error', e);
  }
});
