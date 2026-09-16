document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'insights') return;
  try {
    if (typeof renderPatternAlerts === 'function') renderPatternAlerts('patternAlertsSection');
    if (typeof renderDigestBanner === 'function') renderDigestBanner('reflectionDigestBanner');
    renderInsights();
    renderTriggers();
    renderGoals();
    initAppRating();
  } catch (e) {
    console.error('init-insights error', e);
  }
});
