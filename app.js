// ─── CONSTANTS ──────────────────────────────────────────

const CATEGORY_LABELS = {
  work:   '💼 Work',
  money:  '💰 Money',
  rel:    '❤️ Relationships',
  health: '🏃 Health',
  school: '📚 School'
};

const BADGE_CLASSES = {
  work:   'badge-work',
  money:  'badge-money',
  rel:    'badge-relation',
  health: 'badge-health',
  school: 'badge-school'
};

const WELLBEING_LABELS = [
  { max: 2,   label: 'Very Low 😔' },
  { max: 4,   label: 'Low 😟' },
  { max: 6,   label: 'Okay 😐' },
  { max: 7.5, label: 'Good 😊' },
  { max: 9,   label: 'Great 😄' },
  { max: 10,  label: 'Excellent 🤩' }
];

const COPING_LABELS = {
  meditated:  '🧘 Meditated',
  exercised:  '🏃 Exercised',
  talked:     '💬 Talked to someone',
  journalled: '📖 Journalled',
  rested:     '😴 Rested',
  music:      '🎵 Music',
  walked:     '🚶 Walked',
  breathed:   '🌬️ Breathing',
  ate:        '🍽️ Ate well',
  nothing:    '🤷 Did nothing'
};

const HELPED_LABELS = {
  1: 'Not at all 😞',
  2: 'A little 😕',
  3: 'Somewhat 😐',
  4: 'Quite a bit 🙂',
  5: 'A lot! 😄'
};

// ─── THEME ──────────────────────────────────────────────

// ─── SIMPLE I18N ───────────────────────────────────────
const LANGS = {
  en: {
    settings_title: 'Settings',
    appearance: 'Appearance',
    language: 'Language',
    auto_theme: 'Auto (time of day)'
  },
  es: {
    settings_title: 'Configuración',
    appearance: 'Apariencia',
    language: 'Idioma',
    auto_theme: 'Automático (hora del día)'
  }
};

function getLang() {
  return localStorage.getItem('moodtrace_lang') || 'en';
}

function setLang(code) {
  if (!LANGS[code]) code = 'en';
  localStorage.setItem('moodtrace_lang', code);
  // re-render UI parts that use translations
  renderSettingsTranslations();
}

function t(key) {
  const lang = getLang();
  return (LANGS[lang] && LANGS[lang][key]) || LANGS['en'][key] || key;
}

function renderSettingsTranslations() {
  const el = document.querySelector('.page-title');
  if (el) el.innerHTML = `App <span class="accent-purple">${t('settings_title')}</span>`;
  const langLabel = document.getElementById('languageLabel');
  if (langLabel) langLabel.textContent = t('language');
}

function initTheme() {
  const saved = localStorage.getItem('moodtrace_theme') || 'auto';
  if (saved === 'auto') {
    // set theme based on hour if user prefers auto
    const hour = new Date().getHours();
    const prefer = (hour >= 7 && hour < 19) ? 'light' : 'dark';
    applyTheme(prefer);
  } else {
    applyTheme(saved);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('moodtrace_theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function setThemePreference(pref) {
  // pref: 'dark'|'light'|'auto'
  localStorage.setItem('moodtrace_theme', pref);
  if (pref === 'auto') return initTheme();
  applyTheme(pref);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── STORAGE ────────────────────────────────────────────

function getEntries() {
  if (window.storageAPI && typeof window.storageAPI.getEntries === 'function') {
    return window.storageAPI.getEntries();
  }
  if (window.currentUser && window.firestoreEntriesCache) {
    return window.firestoreEntriesCache;
  }
  try { return JSON.parse(localStorage.getItem('moodtrace_entries') || '[]'); } catch { return []; }
}

function saveEntries(entries) {
  if (window.storageAPI && typeof window.storageAPI.saveEntries === 'function') {
    return window.storageAPI.saveEntries(entries);
  }
  if (!window.currentUser) {
    localStorage.setItem('moodtrace_entries', JSON.stringify(entries));
  }
}

let deleteUndoStack = [];
let deleteRedoStack = [];

function addEntry(entry) {
  if (window.storageAPI && typeof window.storageAPI.addEntry === 'function') {
    const res = window.storageAPI.addEntry(entry);
    if (res && typeof res.then === 'function') {
      return res.then(e => {
        renderDashboard();
        return e;
      });
    }
    renderDashboard();
    return res;
  }
  entry.id = Date.now();
  entry.createdAt = new Date().toISOString();
  entry.updatedAt = entry.createdAt;
  entry.history = [];
  
  if (window.currentUser && window.db) {
    window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(entry.id)).set(entry);
  } else {
    const entries = getEntries();
    entries.unshift(entry);
    saveEntries(entries);
  }
}

function updateEntry(id, updates) {
  if (window.storageAPI && typeof window.storageAPI.updateEntry === 'function') {
    return window.storageAPI.updateEntry(id, updates);
  }
  const entries = getEntries();
  const existing = entries.find(e => e.id === id);
  if (!existing) return;
  const before = { ...existing };
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  if (JSON.stringify(before) !== JSON.stringify(updated)) {
    updated.history = [...(existing.history || []), { changedAt: new Date().toISOString(), snapshot: before }];
  }
  
  if (window.currentUser && window.db) {
    window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(id)).set(updated);
  } else {
    const nextEntries = entries.map(e => e.id === id ? updated : e);
    saveEntries(nextEntries);
  }
  return updated;
}

function deleteEntry(id) {
  const entries = getEntries();
  const entry = entries.find(e => String(e.id) === String(id));
  if (!entry || !confirm('Delete this entry?')) return;

  deleteUndoStack.push(entry);
  if (deleteUndoStack.length > 8) deleteUndoStack.shift();
  deleteRedoStack = [];

  if (window.storageAPI && typeof window.storageAPI.deleteEntry === 'function') {
    const res = window.storageAPI.deleteEntry(id);
    if (res && typeof res.then === 'function') {
      res.then(() => {
        const filter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
        renderHistory(filter);
        updateEntryCount(filter);
        renderDashboard();
        showToast('Entry removed. Undo available.', { actionLabel: 'Undo', action: () => undoDelete(filter) });
      });
      return;
    }
  }

  if (window.currentUser && window.db) {
    window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(id)).delete();
  } else {
    saveEntries(entries.filter(e => String(e.id) !== String(id)));
  }

  const filter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
  renderHistory(filter);
  updateEntryCount(filter);
  renderDashboard();
  showToast('Entry removed. Undo available.', { actionLabel: 'Undo', action: () => undoDelete(filter) });
}

function undoDelete(filter = 'all') {
  const entry = deleteUndoStack.pop();
  if (!entry) return;
  if (window.storageAPI && typeof window.storageAPI.addEntry === 'function') {
    const res = window.storageAPI.addEntry(entry);
    if (res && typeof res.then === 'function') {
      res.then(() => {
        deleteRedoStack.push(entry);
        renderHistory(filter);
        updateEntryCount(filter);
        renderDashboard();
        showToast('Entry restored.');
      });
      return;
    }
    deleteRedoStack.push(entry);
    renderHistory(filter);
    updateEntryCount(filter);
    renderDashboard();
    showToast('Entry restored.');
    return;
  }
  const entries = getEntries();
  entries.unshift(entry);
  saveEntries(entries);
  deleteRedoStack.push(entry);
  renderHistory(filter);
  updateEntryCount(filter);
  renderDashboard();
  showToast('Entry restored.');
}

function redoDelete(filter = 'all') {
  const entry = deleteRedoStack.pop();
  if (!entry) return;
  if (window.storageAPI && typeof window.storageAPI.deleteEntry === 'function') {
    const res = window.storageAPI.deleteEntry(entry.id);
    if (res && typeof res.then === 'function') {
      res.then(() => {
        deleteUndoStack.push(entry);
        renderHistory(filter);
        updateEntryCount(filter);
        renderDashboard();
        showToast('Delete reapplied.');
      });
      return;
    }
  }
  saveEntries(getEntries().filter(e => String(e.id) !== String(entry.id)));
  deleteUndoStack.push(entry);
  renderHistory(filter);
  updateEntryCount(filter);
  renderDashboard();
  showToast('Delete reapplied.');
}

// Consolidated custom categories helpers (single source of truth)
function getCustomCategories() {
  if (window.storageAPI && typeof window.storageAPI.getCustomCategories === 'function') {
    return window.storageAPI.getCustomCategories();
  }
  if (window.currentUser && window.firestoreCustomCatsCache) return window.firestoreCustomCatsCache || {};
  try { return JSON.parse(localStorage.getItem('moodtrace_custom_cats') || '{}'); }
  catch { return {}; }
}

function saveCustomCategories(categories) {
  if (window.storageAPI && typeof window.storageAPI.saveCustomCategories === 'function') {
    return window.storageAPI.saveCustomCategories(categories);
  }
  if (window.currentUser && window.db) {
    return window.db.collection('users').doc(window.currentUser.uid).collection('settings').doc('categories').set(categories);
  }
  localStorage.setItem('moodtrace_custom_cats', JSON.stringify(categories));
}

function addCustomCategory(id, label, emoji) {
  if (window.storageAPI && typeof window.storageAPI.addCustomCategory === 'function') {
    return window.storageAPI.addCustomCategory(id, label, emoji);
  }
  const cats = getCustomCategories() || {};
  cats[id] = { label, emoji };
  saveCustomCategories(cats);
}

function deleteCustomCategory(id) {
  if (window.storageAPI && typeof window.storageAPI.deleteCustomCategory === 'function') {
    return window.storageAPI.deleteCustomCategory(id);
  }
  const cats = getCustomCategories() || {};
  if (cats && cats[id]) delete cats[id];
  saveCustomCategories(cats);
}

function initDeleteListener() {
  const container = document.getElementById('historyList');
  if (!container) return;
  container.addEventListener('click', e => {
    const del  = e.target.closest('[data-delete-id]');
    const edit = e.target.closest('[data-edit-id]');
    if (del)  deleteEntry(Number(del.dataset.deleteId));
    if (edit) openEditModal(Number(edit.dataset.editId));
  });
}

function getAllCategories() {
  return { ...CATEGORY_LABELS, ...getCustomCategories() };
}

function getCategoryLabel(key) {
  const all = getAllCategories();
  const v = all[key];
  if (!v) return key;
  return typeof v === 'string' ? v : `${v.emoji} ${v.label}`;
}

function renderAddEntryCategories() {
  const container = document.getElementById('addEntryCategoryChips');
  if (!container) return;
  container.innerHTML = '';
  const categories = getAllCategories();
  Object.entries(categories).forEach(([id, value]) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.cat = id;
    chip.textContent = typeof value === 'string' ? value : `${value.emoji} ${value.label}`;
    chip.addEventListener('click', () => selectChip(chip, id));
    if (selectedCategory === id) chip.classList.add('selected-' + id);
    container.appendChild(chip);
  });
}

function renderEditCategoryChips(activeCategory = null) {
  const container = document.getElementById('editCategoryChips');
  if (!container) return;
  container.innerHTML = '';
  const categories = getAllCategories();
  Object.entries(categories).forEach(([id, value]) => {
    const chip = document.createElement('div');
    chip.className = 'chip edit-chip';
    chip.dataset.cat = id;
    chip.textContent = typeof value === 'string' ? value : `${value.emoji} ${value.label}`;
    chip.addEventListener('click', () => selectEditChip(chip, id));
    if ((activeCategory || selectedCategory) === id) chip.classList.add('selected-' + id);
    container.appendChild(chip);
  });
}

function renderCustomCategoryManager() {
  const container = document.getElementById('customCategoryList');
  if (!container) return;
  const custom = getCustomCategories();
  if (!Object.keys(custom).length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem">No custom categories yet.</div>';
    return;
  }
  container.innerHTML = Object.entries(custom).map(([id, {label, emoji}]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:var(--surface);border-radius:8px;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <span style="font-size:1.3rem">${emoji}</span>
        <div>
          <div style="font-weight:500;font-size:0.9rem">${escHtml(label)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">ID: ${id}</div>
        </div>
      </div>
      <button onclick="deleteCustomCategory('${id}');renderCustomCategoryManager();renderAddEntryCategories();renderEditCategoryChips(selectedCategory);showToast('✅ Category removed.');" style="background:none;border:none;color:var(--pink-light);cursor:pointer;font-size:0.9rem;padding:0.4rem">🗑 Delete</button>
    </div>
  `).join('');
}

function openCustomCategoryEditor() {
  const modal = document.getElementById('customCategoryModal');
  if (!modal) return;
  const emojiEl = document.getElementById('customCatEmoji');
  const emojiInput = document.getElementById('customCatEmojiInput');
  const labelEl = document.getElementById('customCatLabel');
  if (emojiEl) emojiEl.textContent = '📌';
  if (emojiInput) emojiInput.value = '📌';
  if (labelEl) labelEl.value = '';
  modal.style.display = 'flex';
}

function closeCustomCategoryModal() {
  const modal = document.getElementById('customCategoryModal');
  if (modal) modal.style.display = 'none';
}

function saveCustomCategory() {
  const label = document.getElementById('customCatLabel')?.value.trim();
  const emojiInput = document.getElementById('customCatEmojiInput');
  const emoji = (emojiInput?.value || document.getElementById('customCatEmoji')?.textContent || '📌').trim();
  if (!label) { alert('Please enter a category name.'); return; }
  if (!emoji) { alert('Please choose an emoji.'); return; }
  const id = 'custom_' + Date.now();
  addCustomCategory(id, label, emoji);
  renderCustomCategoryManager();
  renderAddEntryCategories();
  renderEditCategoryChips(selectedCategory);
  closeCustomCategoryModal();
  showToast(`✅ Added ${label} as a category.`);
}

function selectCategoryEmoji(emoji) {
  const el = document.getElementById('customCatEmoji');
  const input = document.getElementById('customCatEmojiInput');
  if (el) el.textContent = emoji;
  if (input) input.value = emoji;
}

// ─── CUSTOM COPING ACTIONS ──────────────────────────────

function getCustomCopingActions() {
  try {
    return JSON.parse(localStorage.getItem('moodtrace_custom_coping') || '[]');
  } catch { return []; }
}

function saveCustomCopingActions(actions) {
  localStorage.setItem('moodtrace_custom_coping', JSON.stringify(actions));
}

function addCustomCopingAction(label) {
  const actions = getCustomCopingActions();
  actions.push({ label, id: 'custom_' + Date.now() });
  saveCustomCopingActions(actions);
}

function removeCustomCopingAction(index) {
  const actions = getCustomCopingActions();
  actions.splice(index, 1);
  saveCustomCopingActions(actions);
}

function openCustomCopingEditor() {
  const label = document.getElementById('customCopingLabel');
  if (label) label.value = '';
  const modal = document.getElementById('customCopingModal');
  if (modal) modal.style.display = 'flex';
}

function closeCustomCopingModal() {
  const modal = document.getElementById('customCopingModal');
  if (modal) modal.style.display = 'none';
}

function saveCustomCopingAction() {
  const label = document.getElementById('customCopingLabel')?.value.trim();
  if (!label) { alert('Please enter an action name.'); return; }
  addCustomCopingAction(label);
  renderCustomCopingList();
  closeCustomCopingModal();
}

function renderCustomCopingList() {
  const container = document.getElementById('customCopingList');
  if (!container) return;
  const actions = getCustomCopingActions();
  if (!actions.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem">No custom actions yet.</div>';
    return;
  }
  container.innerHTML = actions.map((a, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:var(--surface);border-radius:8px;margin-bottom:0.5rem">
      <span style="font-size:0.9rem">${escHtml(a.label)}</span>
      <button onclick="removeCustomCopingAction(${i});renderCustomCopingList()" style="background:none;border:none;color:var(--pink-light);cursor:pointer;font-size:0.9rem">🗑</button>
    </div>
  `).join('');
}

// ─── SHARE LINK HELPERS ─────────────────────────────────

function openShareEditor() {
  const modal = document.getElementById('shareEditorModal');
  if (modal) modal.style.display = 'flex';
}

function closeShareEditor() {
  const modal = document.getElementById('shareEditorModal');
  if (modal) modal.style.display = 'none';
}

function generateAndDisplayShareLink() {
  const scope = document.querySelector('input[name="shareScope"]:checked')?.value || 'mood';
  const token = createShareLink(scope);
  const url = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '') + 'share.html?token=' + token;
  
  const container = document.getElementById('shareLinksContainer');
  if (container) {
    container.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <div style="font-weight:600;margin-bottom:0.5rem;font-size:0.9rem">Share link created!</div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
          <input type="text" value="${url}" readonly style="flex:1;padding:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:monospace">
          <button onclick="navigator.clipboard.writeText('${url}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000)" style="padding:0.5rem 1rem;background:var(--teal);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">Copy</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)">Expires in 30 days • Scope: ${scope}</div>
      </div>
    `;
  }
  closeShareEditor();
  renderShareLinks();
}

function renderShareLinks() {
  const container = document.getElementById('shareLinksContainer');
  if (!container) return;
  const shares = JSON.parse(localStorage.getItem('moodtrace_shares') || '{}');
  const now = new Date();
  const active = Object.entries(shares).filter(([,s]) => s.enabled && new Date(s.expires) > now);
  if (!active.length) return;
  
  container.innerHTML += active.map(([token, s]) => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.75rem;margin-top:0.5rem;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:0.8rem">
        <div>${s.scope}</div>
        <div style="color:var(--text-muted)">Expires ${new Date(s.expires).toLocaleDateString()}</div>
      </div>
      <button onclick="revokeShareLink('${token}');renderShareLinks()" style="background:none;border:none;color:var(--pink-light);cursor:pointer;font-size:0.9rem">🗑</button>
    </div>
  `).join('');
}

// ─── JOURNAL/NOTES ──────────────────────────────────────

function getJournalEntries() {
  try {
    return JSON.parse(localStorage.getItem('moodtrace_journal') || '[]');
  } catch { return []; }
}

function saveJournalEntries(entries) {
  localStorage.setItem('moodtrace_journal', JSON.stringify(entries));
}

function addJournalEntry(entry) {
  const entries = getJournalEntries();
  entry.id = Date.now();
  entries.unshift(entry);
  saveJournalEntries(entries);
}

function deleteJournalEntry(id) {
  if (!confirm('Delete this journal entry?')) return;
  saveJournalEntries(getJournalEntries().filter(e => e.id !== id));
  renderJournal();
}

function renderJournal() {
  const container = document.getElementById('journalList');
  if (!container) return;
  const entries = getJournalEntries();
  if (!entries.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)"><div style="font-size:2.5rem">📔</div><p>No journal entries yet. Start reflecting!</p></div>';
    return;
  }
  container.innerHTML = entries.map(e => {
    const { date, time } = formatDate(e.datetime);
    return `
      <div class="card" style="padding:1.5rem;margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:0.75rem">
          <div>
            <div style="font-weight:600;font-size:0.95rem">${escHtml(e.title)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${date} at ${time}</div>
          </div>
          <button onclick="deleteJournalEntry(${e.id})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.9rem">🗑</button>
        </div>
        <p style="color:var(--text);font-size:0.95rem;line-height:1.6;white-space:pre-wrap">${escHtml(e.body)}</p>
      </div>
    `;
  }).join('');
}

// ─── VOICE ENTRY ────────────────────────────────────────

function initVoiceEntry() {
  const btn = document.getElementById('voiceEntryBtn');
  if (!btn) return;
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    btn.style.display = 'none';
    return;
  }
  btn.addEventListener('click', startVoiceEntry);
}

function startVoiceEntry() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  const btn = document.getElementById('voiceEntryBtn');
  const descField = document.getElementById('description');
  
  btn.disabled = true;
  btn.textContent = '🎤 Listening...';
  
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (descField) descField.value = (descField.value + ' ' + transcript).trim();
    btn.disabled = false;
    btn.textContent = '🎤 Use Voice';
  };
  
  recognition.onerror = (event) => {
    console.error('Voice error:', event.error);
    btn.disabled = false;
    btn.textContent = '🎤 Use Voice';
    alert('Voice entry error: ' + event.error);
  };
  
  recognition.start();
}

// ─── GESTURE SHORTCUTS ──────────────────────────────────

function initGestureShortcuts() {
  let touchStart = null;
  const container = document.getElementById('historyList');
  if (!container) return;
  
  container.addEventListener('touchstart', e => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, target: e.target.closest('.history-card') };
  }, false);
  
  container.addEventListener('touchend', e => {
    if (!touchStart || !touchStart.target) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const diffX = touchStart.x - touchEnd.x;
    const diffY = Math.abs(touchStart.y - touchEnd.y);
    
    // Swipe left to delete/edit
    if (diffX > 80 && diffY < 40) {
      const editId = touchStart.target.querySelector('[data-edit-id]')?.dataset.editId;
      if (editId) openEditModal(Number(editId));
    }
    touchStart = null;
  }, false);
}

// ─── SOCIAL SHARING ─────────────────────────────────────

function generateShareToken() {
  return 'share_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

function createShareLink(scope = 'mood') {
  const token = generateShareToken();
  const shares = JSON.parse(localStorage.getItem('moodtrace_shares') || '{}');
  shares[token] = {
    created: new Date().toISOString(),
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    scope: scope, // 'mood' | 'mood_coping' | 'full'
    enabled: true
  };
  localStorage.setItem('moodtrace_shares', JSON.stringify(shares));
  return token;
}

function getSharedData(token) {
  const shares = JSON.parse(localStorage.getItem('moodtrace_shares') || '{}');
  const share = shares[token];
  if (!share || !share.enabled || new Date(share.expires) < new Date()) return null;
  
  const entries = getEntries();
  if (share.scope === 'mood') {
    return entries.map(e => ({ emoji: e.emoji, intensity: e.intensity, category: e.category, datetime: e.datetime }));
  } else if (share.scope === 'mood_coping') {
    return entries.map(e => ({ emoji: e.emoji, intensity: e.intensity, category: e.category, datetime: e.datetime, copingActions: e.copingActions }));
  }
  return entries;
}

// ─── ACHIEVEMENTS ──────────────────────────────────────
function getAchievements() {
  try { return JSON.parse(localStorage.getItem('moodtrace_achievements') || '{}'); } catch { return {}; }
}

function saveAchievements(a) {
  localStorage.setItem('moodtrace_achievements', JSON.stringify(a));
}

const ACHIEVEMENT_DEFS = {
  first_entry: { id: 'first_entry', title: 'First Entry', desc: 'Logged your first mood entry', icon: '🎉' },
  seven_day_streak: { id: 'seven_day_streak', title: '7‑Day Streak', desc: 'Log mood for 7 days in a row', icon: '🔥' },
  thirty_entries: { id: 'thirty_entries', title: '30 Entries', desc: 'Logged 30 entries', icon: '🏆' },
  avg_mood_8: { id: 'avg_mood_8', title: 'Average ≥8', desc: 'Maintain an average mood ≥8', icon: '🌟' }
};

function checkAchievements() {
  const entries = getEntries();
  const ach = getAchievements();
  const earned = { ...ach };

  if (entries.length >= 1 && !earned.first_entry) earned.first_entry = { earnedAt: new Date().toISOString() };

  const { streak } = calcStreak(entries);
  if (streak >= 7 && !earned.seven_day_streak) earned.seven_day_streak = { earnedAt: new Date().toISOString() };

  if (entries.length >= 30 && !earned.thirty_entries) earned.thirty_entries = { earnedAt: new Date().toISOString() };

  const avg = entries.length ? (entries.reduce((s,e)=>s+e.intensity,0)/entries.length) : 0;
  if (avg >= 8 && !earned.avg_mood_8) earned.avg_mood_8 = { earnedAt: new Date().toISOString() };

  // persist
  saveAchievements(earned);
  return earned;
}

function renderAchievements(containerId = 'achievementsSection') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const earned = getAchievements();
  const list = Object.values(ACHIEVEMENT_DEFS).map(d => {
    const e = earned[d.id];
    return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:${e? 'linear-gradient(90deg, rgba(124,58,237,0.04), rgba(94,234,212,0.02))' : 'transparent'}">
      <div style="font-size:1.25rem">${d.icon}</div>
      <div style="flex:1">
        <div style="font-weight:600">${d.title}</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">${d.desc}</div>
      </div>
      <div style="font-weight:700;color:${e? 'var(--teal-light)' : 'var(--text-muted)'}">${e? new Date(e.earnedAt).toLocaleDateString() : 'Locked'}</div>
    </div>`;
  }).join('');
  container.innerHTML = list;
}

function revokeShareLink(token) {
  const shares = JSON.parse(localStorage.getItem('moodtrace_shares') || '{}');
  delete shares[token];
  localStorage.setItem('moodtrace_shares', JSON.stringify(shares));
}

// ─── ENHANCED REMINDERS ─────────────────────────────────

function getReminders() {
  try {
    return JSON.parse(localStorage.getItem('moodtrace_reminders') || '[]');
  } catch { return []; }
}

function saveReminders(reminders) {
  localStorage.setItem('moodtrace_reminders', JSON.stringify(reminders));
}

function addReminder(time, days, enabled = true) {
  const reminders = getReminders();
  reminders.push({ id: Date.now(), time, days, enabled });
  saveReminders(reminders);
}

function deleteReminder(id) {
  saveReminders(getReminders().filter(r => r.id !== id));
}

function renderReminderManager() {
  const container = document.getElementById('checkInManager');
  if (!container) return;
  
  const reminders = getReminders();
  container.innerHTML = `
    <div class="section-title">Daily Check-ins</div>
    <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem">Get notifications to log your mood at set times.</p>
    <div id="remindersList" style="margin-bottom:1rem">${
      reminders.length ? reminders.map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;background:var(--surface);border-radius:8px;margin-bottom:0.5rem">
          <div style="display:flex;align-items:center;gap:1rem">
            <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleReminder(${r.id},this.checked);renderReminderManager()" style="width:18px;height:18px;cursor:pointer">
            <div>
              <div style="font-weight:500;font-size:0.9rem">${r.time}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${r.days.join(', ')}</div>
            </div>
          </div>
          <button onclick="deleteReminder(${r.id});renderReminderManager()" style="background:none;border:none;color:var(--pink-light);cursor:pointer;font-size:0.9rem">🗑</button>
        </div>
      `).join('') : '<div style="color:var(--text-muted);font-size:0.9rem">No reminders set.</div>'
    }</div>
    <button class="btn btn-teal" onclick="openReminderEditor()">＋ Add Reminder</button>
  `;
}

function toggleReminder(id, enabled) {
  const reminders = getReminders();
  const reminder = reminders.find(r => r.id === id);
  if (reminder) reminder.enabled = enabled;
  saveReminders(reminders);
}

function openReminderEditor() {
  const modal = document.getElementById('reminderModal');
  if (!modal) return;
  document.getElementById('reminderTime').value = '20:00';
  document.querySelectorAll('.day-checkbox').forEach(c => c.checked = false);
  modal.style.display = 'flex';
}

function closeReminderModal() {
  const modal = document.getElementById('reminderModal');
  if (modal) modal.style.display = 'none';
}

function saveReminder() {
  const time = document.getElementById('reminderTime')?.value;
  const days = Array.from(document.querySelectorAll('.day-checkbox:checked')).map(c => c.value);
  if (!time || !days.length) { alert('Please set a time and select at least one day.'); return; }
  addReminder(time, days);
  renderReminderManager();
  closeReminderModal();
  requestNotificationPermission();
}

function requestNotificationPermission() {
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function checkAndTriggerReminders() {
  if (Notification.permission !== 'granted') return;
  const reminders = getReminders().filter(r => r.enabled);
  const now = new Date();
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  
  reminders.forEach(r => {
    if (r.days.includes(dayName) && r.time === timeStr) {
      const todayEntries = getTodayEntries();
      if (!todayEntries.length) {
        new Notification('MoodTrace 🌙', {
          body: "Time to log your mood! How are you feeling?",
          icon: 'moodtrace-logo.svg',
          tag: 'mood-reminder',
          requireInteraction: false
        });
      }
    }
  });
}

// ─── ACCESSIBILITY ──────────────────────────────────────

function initAccessibility() {
  // Add ARIA labels to key elements
  const buttons = document.querySelectorAll('button:not([aria-label])');
  buttons.forEach(btn => {
    if (!btn.getAttribute('aria-label')) {
      const text = btn.textContent?.trim() || '';
      if (text) btn.setAttribute('aria-label', text);
    }
  });
  
  // Ensure all inputs have associated labels
  const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
  inputs.forEach(input => {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (!label && input.placeholder) {
      input.setAttribute('aria-label', input.placeholder);
    }
  });
  
  // Add keyboard navigation for modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeCustomCategoryModal();
      closeReminderModal();
      closeJournalEditor();
    }
  });
}

// ─── MOBILE PERFORMANCE ─────────────────────────────────

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  }
}

function lazyLoadAmbient() {
  const ambients = document.querySelectorAll('.ambient');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.willChange = 'auto';
        }
      });
    });
    ambients.forEach(a => observer.observe(a));
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatDate(datetimeStr) {
  const d = new Date(datetimeStr);
  return {
    day:    d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date:   d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time:   d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    hour:   d.getHours(),
    dayNum: d.getDate(),
    month:  d.getMonth(),
    year:   d.getFullYear()
  };
}

function nowFormatted() {
  return new Date().toISOString().slice(0, 16);
}

function getWellbeingLabel(avg) {
  return WELLBEING_LABELS.find(l => avg <= l.max)?.label || 'Excellent 🤩';
}

function calcStreak(entries) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const loggedDays = new Set(
    entries
      .filter(e => { const d = new Date(e.datetime); return d.getFullYear() === year && d.getMonth() === month; })
      .map(e => new Date(e.datetime).getDate())
  );

  let streak = 0;
  for (let d = today; d >= 1; d--) {
    if (loggedDays.has(d)) streak++;
    else break;
  }
  return { streak, loggedDays };
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTodayEntries() {
  const now = new Date();
  return getEntries().filter(e => {
    const d = new Date(e.datetime);
    return d.getDate() === now.getDate() &&
           d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
  });
}

// ─── ONBOARDING ─────────────────────────────────────────

function checkOnboarding() {
  if (localStorage.getItem('moodtrace_onboarded')) return;
  showOnboarding();
}

function showOnboarding() {
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.style.display = 'flex';
}

function nextOnboardingStep(step) {
  document.querySelectorAll('.onboarding-step').forEach(s => s.style.display = 'none');
  const next = document.getElementById(`onboardStep${step}`);
  if (next) {
    next.style.display = 'block';
    // Scroll the modal to top to show the new step
    const modal = document.getElementById('onboardingModal');
    if (modal) {
      // Use setTimeout to ensure DOM updates before scrolling
      setTimeout(() => {
        modal.scrollTo({ top: 0, behavior: 'smooth' });
      }, 10);
    }
  }
}

function finishOnboarding() {
  localStorage.setItem('moodtrace_onboarded', '1');
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.style.display = 'none';
}

function finishOnboardingAndLogin() {
  localStorage.setItem('moodtrace_onboarded', '1');
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.style.display = 'none';
  window.location.href = 'login.html';
}

function finishOnboardingGuest() {
  localStorage.setItem('moodtrace_onboarded', '1');
  if (window.authAPI) window.authAPI.setGuestMode(true);
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.style.display = 'none';
}

// ─── ADD ENTRY PAGE ─────────────────────────────────────

let selectedEmoji    = '😄';
let selectedCategory = 'work';
let selectedCoping   = new Set();
let selectedHelped   = null;

function selectEmoji(el) {
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedEmoji = el.dataset.emoji;
}

function selectChip(el, type) {
  const container = el.closest('.category-chips');
  if (container) {
    container.querySelectorAll('.chip').forEach(c => { c.className = 'chip'; });
  } else {
    document.querySelectorAll('.chip').forEach(c => { c.className = 'chip'; });
  }
  el.classList.add('selected-' + type);
  selectedCategory = type;
}

function toggleCoping(el) {
  const action = el.dataset.action;
  if (selectedCoping.has(action)) { selectedCoping.delete(action); el.classList.remove('selected'); }
  else { selectedCoping.add(action); el.classList.add('selected'); }
}

function selectHelped(el) {
  document.querySelectorAll('.helped-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedHelped = parseInt(el.dataset.value);
}

async function handleSubmit() {
  const intensity    = parseInt(document.getElementById('slider')?.value || 7);
  const datetime     = document.getElementById('entryDatetime')?.value;
  const description  = document.getElementById('description')?.value?.trim();
  const copingNotes  = document.getElementById('copingNotes')?.value?.trim() || '';
  const sleepHours   = parseFloat(document.getElementById('sleepHours')?.value || 7);
  const exerciseMinutes = parseInt(document.getElementById('exerciseMinutes')?.value || 0);
  const workload     = parseInt(document.getElementById('workload')?.value || 5);
  const stress       = parseInt(document.getElementById('stressLevel')?.value || 5);

  if (!datetime)    { alert('Please pick a date and time.'); return; }
  if (!description) { alert('Please write something about how you feel.'); return; }

  if (intensity <= 4 && selectedCoping.size === 0) {
    const suggestion = getCopingSuggestion();
    if (suggestion) {
      const toastEl = document.getElementById('copingSuggestionToast');
      if (toastEl) {
        document.getElementById('copingSuggestionText').textContent = suggestion;
        toastEl.style.display = 'block';
        setTimeout(() => { toastEl.style.display = 'none'; }, 6000);
      }
    }
  }

  const entry = {
    emoji: selectedEmoji, intensity, category: selectedCategory,
    datetime, description,
    copingActions: [...selectedCoping], copingNotes, helpedRating: selectedHelped,
    sleepHours, exerciseMinutes, workload, stress,
    id: Date.now()
  };

  const submitBtn = document.querySelector('.submit-area .btn-primary');
  const originalText = submitBtn.innerHTML;
  
  if (typeof uploadMediaFiles === 'function') {
    try {
      submitBtn.innerHTML = '⏳ Uploading...';
      submitBtn.disabled = true;
      const urls = await uploadMediaFiles(entry.id);
      if (urls.photoUrl) entry.photoUrl = urls.photoUrl;
      if (urls.audioUrl) entry.audioUrl = urls.audioUrl;
    } catch(e) {
      console.error("Media upload failed", e);
      alert("Failed to upload media attachments. Saving without them.");
    }
  }

  addEntry(entry);

  showToast('✅ Entry saved!');
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
}

function getCopingSuggestion() {
  // Find the highest-rated coping action from past entries
  const entries = getEntries();
  const copingMap = {};
  entries.forEach(e => {
    if (!e.copingActions?.length || !e.helpedRating) return;
    e.copingActions.forEach(action => {
      if (!copingMap[action]) copingMap[action] = [];
      copingMap[action].push(e.helpedRating);
    });
  });
  const sorted = Object.entries(copingMap)
    .map(([a, r]) => ({ action: a, avg: r.reduce((x, y) => x + y, 0) / r.length }))
    .sort((a, b) => b.avg - a.avg);
  if (!sorted.length) return null;
  const best = sorted[0];
  return `💡 Based on your history, "${COPING_LABELS[best.action]}" tends to help you most. Want to try it?`;
}

function handleClear() {
  document.querySelectorAll('.emoji-option').forEach(e => e.classList.remove('selected'));
  const first = document.querySelector('.emoji-option');
  if (first) { first.classList.add('selected'); selectedEmoji = first.dataset.emoji; }

  selectedCategory = 'work';
  renderAddEntryCategories();

  document.querySelectorAll('.coping-chip').forEach(c => c.classList.remove('selected'));
  selectedCoping = new Set();

  document.querySelectorAll('.helped-option').forEach(e => e.classList.remove('selected'));
  selectedHelped = null;

  const desc = document.getElementById('description');
  if (desc) desc.value = '';
  const cn = document.getElementById('copingNotes');
  if (cn) cn.value = '';
  const slider = document.getElementById('slider');
  if (slider) slider.value = 7;
  setText('sliderVal', '7');
  const sleepHours = document.getElementById('sleepHours');
  if (sleepHours) sleepHours.value = 7;
  const exerciseMinutes = document.getElementById('exerciseMinutes');
  if (exerciseMinutes) exerciseMinutes.value = 0;
  const workload = document.getElementById('workload');
  if (workload) workload.value = 5;
  const stress = document.getElementById('stressLevel');
  if (stress) stress.value = 5;
  initDatetime();
}

function showToast(message = '✅ Entry saved!', options = {}) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:1200;display:flex;flex-direction:column;gap:0.6rem;max-width:min(92vw, 360px)';
    document.body.appendChild(toast);
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'background:linear-gradient(135deg,var(--teal),#0F766E);color:white;padding:0.85rem 1rem;border-radius:12px;box-shadow:0 8px 30px rgba(13,148,136,0.25);font-weight:600;font-size:0.9rem';
  wrapper.innerHTML = `<div>${message}</div>`;

  if (options.actionLabel && options.action) {
    const btn = document.createElement('button');
    btn.textContent = options.actionLabel;
    btn.style.cssText = 'margin-top:0.5rem;background:rgba(255,255,255,0.2);border:none;border-radius:999px;padding:0.35rem 0.75rem;color:white;cursor:pointer';
    btn.onclick = options.action;
    wrapper.appendChild(btn);
  }

  toast.innerHTML = '';
  toast.appendChild(wrapper);
  toast.style.display = 'flex';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3200);
}

function initDatetime() {
  const input = document.getElementById('entryDatetime');
  if (input) input.value = nowFormatted();
}

// ─── EDIT MODAL ─────────────────────────────────────────

function openEditModal(id) {
  const entry = getEntries().find(e => e.id === id);
  if (!entry) return;

  document.getElementById('editEntryId').value         = id;
  document.getElementById('editDescription').value     = entry.description || '';
  document.getElementById('editDatetime').value        = entry.datetime || '';
  document.getElementById('editSlider').value          = entry.intensity || 7;
  document.getElementById('editSliderVal').textContent = entry.intensity || 7;
  document.getElementById('editSleepHours').value      = entry.sleepHours ?? 7;
  document.getElementById('editExerciseMinutes').value = entry.exerciseMinutes ?? 0;
  document.getElementById('editWorkload').value        = entry.workload ?? 5;
  document.getElementById('editStress').value          = entry.stress ?? 5;
  document.getElementById('editWorkloadVal').textContent = entry.workload ?? 5;
  document.getElementById('editStressVal').textContent = entry.stress ?? 5;

  document.querySelectorAll('.edit-emoji-option').forEach(e => {
    e.classList.toggle('selected', e.dataset.emoji === entry.emoji);
  });

  renderEditCategoryChips(entry.category);

  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
  const id          = Number(document.getElementById('editEntryId').value);
  const description = document.getElementById('editDescription').value.trim();
  const datetime    = document.getElementById('editDatetime').value;
  const intensity   = parseInt(document.getElementById('editSlider').value);
  const sleepHours  = parseFloat(document.getElementById('editSleepHours').value || 7);
  const exerciseMinutes = parseInt(document.getElementById('editExerciseMinutes').value || 0);
  const workload    = parseInt(document.getElementById('editWorkload').value || 5);
  const stress      = parseInt(document.getElementById('editStress').value || 5);

  const selectedEmojiEl = document.querySelector('.edit-emoji-option.selected');
  const emoji = selectedEmojiEl ? selectedEmojiEl.dataset.emoji : '😊';

  const selectedCatEl = document.querySelector('.edit-chip[class*="selected-"]');
  const category = selectedCatEl ? selectedCatEl.dataset.cat : 'work';

  if (!description) { alert('Description cannot be empty.'); return; }

  updateEntry(id, { description, datetime, intensity, emoji, category, sleepHours, exerciseMinutes, workload, stress });
  closeEditModal();
  const filter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
  renderHistory(filter);
  renderDashboard();
  showToast('Entry updated.');
}

function selectEditEmoji(el) {
  document.querySelectorAll('.edit-emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectEditChip(el, type) {
  const container = el.closest('.category-chips');
  if (container) {
    container.querySelectorAll('.chip').forEach(c => { c.className = 'chip edit-chip'; });
  } else {
    document.querySelectorAll('.edit-chip').forEach(c => { c.className = 'chip edit-chip'; });
  }
  el.classList.add('selected-' + type);
}

// ─── SEARCH ─────────────────────────────────────────────

let searchQuery = '';

function initSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    searchQuery = input.value.toLowerCase().trim();
    renderHistory(currentFilter);
  });
}

function applySearch(entries) {
  if (!searchQuery) return entries;
  return entries.filter(e =>
    e.description?.toLowerCase().includes(searchQuery) ||
    e.copingNotes?.toLowerCase().includes(searchQuery) ||
    getCategoryLabel(e.category).toLowerCase().includes(searchQuery)
  );
}

// ─── HISTORY PAGE ───────────────────────────────────────

const PAGE_SIZE = 10;
let currentPage   = 1;
let currentFilter = 'all';

function getFilteredEntries(filter) {
  let entries = getEntries();
  if (filter === 'high')  entries = entries.filter(e => e.intensity >= 7);
  else if (filter === 'low')  entries = entries.filter(e => e.intensity <= 4);
  else if (filter !== 'all')  entries = entries.filter(e => e.category === filter);
  return applySearch(entries);
}

function renderHistory(filter = 'all') {
  currentFilter = filter;
  currentPage   = 1;
  const container = document.getElementById('historyList');
  if (!container) return;

  const entries = getFilteredEntries(filter);
  updateEntryCount(filter);

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:1rem">📭</div>
        <p>${searchQuery ? 'No entries match your search.' : 'No entries found.'} <a href="add-entry.html" style="color:var(--purple-light)">Add one!</a></p>
      </div>`;
    return;
  }

  container.innerHTML = entries.slice(0, PAGE_SIZE).map(entryCard).join('');
  if (entries.length > PAGE_SIZE) {
    container.innerHTML += `<div style="text-align:center;margin-top:1.5rem"><button class="btn btn-ghost" onclick="loadMore()">Load more →</button></div>`;
  }
}

function loadMore() {
  currentPage++;
  const entries   = getFilteredEntries(currentFilter);
  const container = document.getElementById('historyList');
  if (!container) return;
  container.querySelector('.btn-ghost')?.parentElement?.remove();
  const start = (currentPage - 1) * PAGE_SIZE;
  container.innerHTML += entries.slice(start, start + PAGE_SIZE).map(entryCard).join('');
  if (entries.length > currentPage * PAGE_SIZE) {
    container.innerHTML += `<div style="text-align:center;margin-top:1.5rem"><button class="btn btn-ghost" onclick="loadMore()">Load more →</button></div>`;
  }
}

function entryCard(entry) {
  const { day, date, time } = formatDate(entry.datetime);
  const copingHtml = entry.copingActions?.length
    ? `<div class="coping-tags">${entry.copingActions.map(a => `<span class="coping-tag">${COPING_LABELS[a] || a}</span>`).join('')}</div>` : '';
  const copingNotesHtml = entry.copingNotes
    ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.35rem;font-style:italic">"${escHtml(entry.copingNotes)}"</div>` : '';
  const helpedHtml = entry.helpedRating
    ? `<span class="helped-badge">Helped: ${HELPED_LABELS[entry.helpedRating]}</span>` : '';
  const photoHtml = entry.photoUrl
    ? `<div style="margin-top:0.75rem"><img src="${entry.photoUrl}" style="max-width:100%;max-height:200px;border-radius:10px;border:1px solid var(--border);object-fit:cover;cursor:pointer" onclick="window.open('${entry.photoUrl}','_blank')"></div>` : '';
  const audioHtml = entry.audioUrl
    ? `<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--border)"><span style="font-size:0.8rem;color:var(--text-muted)">🎤 Voice note</span><audio src="${entry.audioUrl}" controls style="flex:1;height:32px"></audio></div>` : '';

  return `
    <div class="history-card">
      <div class="history-card-left">
        <div class="history-emoji">${entry.emoji}</div>
        <div class="mood-score">${entry.intensity}/10</div>
      </div>
      <div class="history-body">
        <div class="history-top">
          <span class="history-heading">${escHtml(entry.description)}</span>
          <span class="badge ${BADGE_CLASSES[entry.category] || 'badge-default'}">${getCategoryLabel(entry.category)}</span>
        </div>
        <div class="history-desc">${escHtml(entry.description)}</div>
        ${copingHtml}${copingNotesHtml}${helpedHtml}
        ${photoHtml}${audioHtml}
        ${entry.history?.length ? `<div class="version-pill">✏️ Edited ${entry.history.length} time${entry.history.length > 1 ? 's' : ''}</div>` : ''}
      </div>
      <div class="history-right">
        <div class="history-day">${day}</div>
        <div class="history-date">${date}<br>${time}</div>
        <div style="display:flex;gap:0.4rem;margin-top:0.6rem;justify-content:flex-end">
          <button data-edit-id="${entry.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;padding:0.2rem 0.4rem;border-radius:4px;transition:color 0.2s" onmouseover="this.style.color='#A78BFA'" onmouseout="this.style.color='var(--text-muted)'">✏️ edit</button>
          <button data-delete-id="${entry.id}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.75rem;padding:0.2rem 0.4rem;border-radius:4px;transition:color 0.2s" onmouseover="this.style.color='#F472B6'" onmouseout="this.style.color='var(--text-muted)'">🗑 delete</button>
        </div>
      </div>
    </div>`;
}

function updateEntryCount(filter) {
  const el = document.getElementById('entryCount');
  if (!el) return;
  const count = getFilteredEntries(filter).length;
  el.textContent = count === 0 ? '' : `${count} entr${count === 1 ? 'y' : 'ies'}`;
}

function initHistoryFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderHistory(chip.dataset.filter);
    });
  });
}

// ─── EXPORT ──────────────────────

function exportCSV() {
  const entries = getEntries();
  if (!entries.length) { alert('No entries to export.'); return; }
  const headers = ['Date', 'Time', 'Emoji', 'Mood Score', 'Category', 'Description', 'Coping Actions', 'Coping Notes', 'Helped Rating', 'Sleep Hours', 'Exercise Minutes', 'Workload', 'Stress'];
  const rows = entries.map(e => {
    const { date, time } = formatDate(e.datetime);
    return [
      date, time, e.emoji, e.intensity,
      getCategoryLabel(e.category),
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.copingActions || []).map(a => COPING_LABELS[a] || a).join(', ')}"`,
      `"${(e.copingNotes || '').replace(/"/g, '""')}"`,
      e.helpedRating ? HELPED_LABELS[e.helpedRating] : '',
      e.sleepHours ?? '',
      e.exerciseMinutes ?? '',
      e.workload ?? '',
      e.stress ?? ''
    ].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile('moodtrace-export.csv', csv, 'text/csv');
}

function exportJSON() {
  const backup = {
    exportedAt: new Date().toISOString(),
    entries: getEntries(),
    journalEntries: getJournalEntries(),
    goals: getGoals(),
    reminders: getReminders(),
    customCategories: getCustomCategories(),
    customCopingActions: getCustomCopingActions(),
    shares: JSON.parse(localStorage.getItem('moodtrace_shares') || '{}')
  };
  downloadFile('moodtrace-backup.json', JSON.stringify(backup, null, 2), 'application/json');
}

function importJSON(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.entries)) saveEntries(data.entries);
      if (Array.isArray(data.journalEntries)) saveJournalEntries(data.journalEntries);
      if (data.goals) saveGoals(data.goals);
      if (Array.isArray(data.reminders)) saveReminders(data.reminders);
      if (data.customCategories) saveCustomCategories(data.customCategories);
      if (Array.isArray(data.customCopingActions)) saveCustomCopingActions(data.customCopingActions);
      if (data.shares) localStorage.setItem('moodtrace_shares', JSON.stringify(data.shares));
      localStorage.setItem('moodtrace_onboarded', '1');
      alert('Backup restored successfully.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('That backup file could not be read.');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('Clear all local MoodTrace data? This cannot be undone.')) return;
  localStorage.removeItem('moodtrace_entries');
  localStorage.removeItem('moodtrace_journal');
  localStorage.removeItem('moodtrace_goals');
  localStorage.removeItem('moodtrace_reminders');
  localStorage.removeItem('moodtrace_custom_cats');
  localStorage.removeItem('moodtrace_custom_coping');
  localStorage.removeItem('moodtrace_shares');
  localStorage.removeItem('moodtrace_ai_msg');
  localStorage.removeItem('moodtrace_onboarded');
  window.location.reload();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── REMINDERS / NOTIFICATIONS ──────────────────────────

function initReminders() {
  const toggle = document.getElementById('reminderToggle');
  if (!toggle) return;
  const saved = localStorage.getItem('moodtrace_reminder');
  toggle.checked = saved === '1';
  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toggle.checked = false; return; }
      }
      if (Notification.permission === 'granted') {
        localStorage.setItem('moodtrace_reminder', '1');
        scheduleReminder();
        alert('✅ Daily reminder set for 8:00 PM!');
      } else {
        toggle.checked = false;
        alert('Notifications are blocked. Please enable them in your browser settings.');
      }
    } else {
      localStorage.removeItem('moodtrace_reminder');
    }
  });
}

function scheduleReminder() {
  // Check every minute if it's time to remind (8:00 PM)
  const interval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 20 && now.getMinutes() === 0) {
      const todayEntries = getTodayEntries();
      if (!todayEntries.length && Notification.permission === 'granted') {
        new Notification('MoodTrace 🌙', {
          body: "You haven't logged your mood today. How are you feeling?",
          icon: 'moodtrace-logo.svg'
        });
      }
    }
  }, 60000);
}

function checkReminderOnLoad() {
  if (localStorage.getItem('moodtrace_reminder') === '1' &&
      Notification.permission === 'granted') {
    scheduleReminder();
  }
}

// ─── STREAK CALENDAR ────────────────────────────────────

function renderStreak() {
  const grid = document.getElementById('streakGrid');
  if (!grid) return;

  const entries    = getEntries();
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth();
  const today      = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Count logs per day (multiple allowed)
  const dayLogs = {};
  entries.forEach(e => {
    const d = new Date(e.datetime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      dayLogs[day] = (dayLogs[day] || 0) + 1;
    }
  });

  const loggedDays = new Set(Object.keys(dayLogs).map(Number));
  const { streak }  = calcStreak(entries);

  setText('streakSub', `🔥 ${streak}-day streak · ${loggedDays.size} days logged this month`);

  grid.innerHTML = Array.from({ length: daysInMonth }, (_, i) => {
    const day   = i + 1;
    const count = dayLogs[day] || 0;
    let cls     = 'streak-day missed';
    if (day === today)        cls = 'streak-day today';
    else if (loggedDays.has(day)) cls = 'streak-day logged';
    const title = count > 1 ? `${count} entries` : count === 1 ? '1 entry' : 'no entry';
    return `<div class="${cls}" title="${title}">${day}${count > 1 ? `<span style="font-size:0.5rem;display:block;line-height:1">${count}x</span>` : ''}</div>`;
  }).join('');
}

// ─── AI MESSAGE CARD ────────────────────────────────────

function buildLocalInsightMessage() {
  const entries = getEntries();
  if (!entries.length) return null;
  const recent = entries.slice(0, 4);
  const avg = +(recent.reduce((s, e) => s + e.intensity, 0) / recent.length).toFixed(1);
  const lowDays = recent.filter(e => e.intensity <= 4).length;
  const sleepAvg = recent.reduce((s, e) => s + (e.sleepHours || 0), 0) / recent.length;
  if (avg <= 4) return `Your recent mood has been low. A gentle reset could help: try a short walk, a pause for breathing, or a quick check-in with someone you trust.`;
  if (lowDays >= 2) return `You seem to be having a few heavier days. The pattern suggests your routine may need more recovery, especially around sleep and rest.`;
  if (sleepAvg < 6.5) return `You have been carrying a lot lately. A little extra sleep or a calmer evening could make your mood feel steadier.`;
  return `You are showing a thoughtful, steady pattern lately. Keep noticing what helps you most and let that guide your next small step.`;
}

async function loadAIMessage() {
  const card = document.getElementById('aiMessageCard');
  if (!card) return;

  // Only generate once per day
  const today  = new Date().toDateString();
  const cached = JSON.parse(localStorage.getItem('moodtrace_ai_msg') || '{}');
  if (cached.date === today && cached.message) {
    renderAIMessage(cached.message, card);
    return;
  }

  const todayEntries = getTodayEntries();
  const allEntries   = getEntries();

  // Need at least one entry to personalise
  if (!allEntries.length) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--purple),var(--teal));display:flex;align-items:center;justify-content:center;font-size:1.1rem">✨</div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem">Your Daily Message</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Personalised just for you</div>
      </div>
    </div>
    <div style="color:var(--text-muted);font-size:0.9rem;display:flex;align-items:center;gap:0.5rem">
      <span style="animation:spin-slow 2s linear infinite;display:inline-block">✨</span> Generating your message…
    </div>`;

  try {
    const recentEntries = allEntries.slice(0, 5);
    const entrySummary  = recentEntries.map(e =>
      `- ${e.emoji} Mood ${e.intensity}/10 (${CATEGORY_LABELS[e.category]}): "${e.description}"${e.copingActions?.length ? ` | Coped with: ${e.copingActions.map(a => COPING_LABELS[a]).join(', ')}` : ''}`
    ).join('\n');

    const todaySummary = todayEntries.length
      ? `Today's entries:\n${todayEntries.map(e => `- ${e.emoji} ${e.intensity}/10: "${e.description}"`).join('\n')}`
      : "The user hasn't logged anything today yet.";

    const avgMood = +(recentEntries.reduce((s, e) => s + e.intensity, 0) / recentEntries.length).toFixed(1);

    const prompt = `You are a warm, empathetic friend who genuinely cares about someone's emotional wellbeing. 

Here is their recent mood data from MoodTrace, a personal mood tracking app:

Recent entries (newest first):
${entrySummary}

${todaySummary}

Their average mood recently: ${avgMood}/10

Write them a short, warm, personalised message (3-5 sentences) that:
- Acknowledges how they've actually been feeling based on their entries (don't be generic)
- Offers genuine empathy or a small celebration depending on their mood
- Gives one specific, practical, caring suggestion or encouragement
- Feels like it's coming from a close friend who has read their diary, not a robot
- Is uplifting but honest — don't dismiss real struggles with toxic positivity
- Ends with a gentle, caring nudge for the day

Do NOT use bullet points. Write in natural, warm prose. Keep it under 100 words.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data    = await response.json();
    const message = data.content?.[0]?.text?.trim();

    if (message) {
      localStorage.setItem('moodtrace_ai_msg', JSON.stringify({ date: today, message }));
      renderAIMessage(message, card);
    } else {
      card.style.display = 'none';
    }
  } catch (err) {
    console.error('AI message error:', err);
    const fallback = buildLocalInsightMessage();
    if (fallback) {
      localStorage.setItem('moodtrace_ai_msg', JSON.stringify({ date: today, message: fallback }));
      renderAIMessage(fallback, card);
    } else {
      card.style.display = 'none';
    }
  }
}

function renderAIMessage(message, card) {
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--purple),var(--teal));display:flex;align-items:center;justify-content:center;font-size:1.1rem">✨</div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem">Your Daily Message</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Personalised just for you</div>
      </div>
      <button onclick="refreshAIMessage()" title="Refresh" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:0.25rem;border-radius:6px;transition:color 0.2s" onmouseover="this.style.color='var(--purple-light)'" onmouseout="this.style.color='var(--text-muted)'">↻</button>
    </div>
    <p style="font-size:0.92rem;line-height:1.7;color:var(--text)">${escHtml(message)}</p>`;
}

function refreshAIMessage() {
  localStorage.removeItem('moodtrace_ai_msg');
  loadAIMessage();
}

// ─── ANALYTICS ──────────────────────────────────────────

function getAnalyticsData() {
  const entries    = getEntries();
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth();
  const monthName  = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const allScores = entries.map(e => e.intensity);
  const avgAll    = allScores.length ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : 0;
  const best      = entries.length ? entries.reduce((a, b) => a.intensity > b.intensity ? a : b) : null;
  const worst     = entries.length ? entries.reduce((a, b) => a.intensity < b.intensity ? a : b) : null;

  const catCount  = { work: 0, money: 0, rel: 0, health: 0, school: 0 };
  const catTotals = { work: [], money: [], rel: [], health: [], school: [] };
  entries.forEach(e => {
    if (catCount[e.category] !== undefined) {
      catCount[e.category]++;
      catTotals[e.category].push(e.intensity);
    }
  });
  const catAvgs = Object.fromEntries(
    Object.entries(catTotals).map(([k, v]) => [k, v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0])
  );
  const topCat  = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const total   = Object.values(catCount).reduce((a, b) => a + b, 0);
  const catPcts = Object.fromEntries(Object.entries(catCount).map(([k, v]) => [k, total ? Math.round((v / total) * 100) : 0]));

  // Daily trend (avg per day this month, multiple entries allowed)
  const dailyMap = {};
  entries.forEach(e => {
    const d = new Date(e.datetime);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dailyMap[day]) dailyMap[day] = [];
      dailyMap[day].push(e.intensity);
    }
  });
  const trendLabels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const trendData   = trendLabels.map(day =>
    dailyMap[day] ? +(dailyMap[day].reduce((a, b) => a + b, 0) / dailyMap[day].length).toFixed(1) : null
  );

  // Mood by time of day (Morning 6-12, Afternoon 12-18, Evening 18-24, Night 0-6)
  const timeSlots = { Morning: [], Afternoon: [], Evening: [], Night: [] };
  entries.forEach(e => {
    const h = new Date(e.datetime).getHours();
    if      (h >= 6  && h < 12) timeSlots.Morning.push(e.intensity);
    else if (h >= 12 && h < 18) timeSlots.Afternoon.push(e.intensity);
    else if (h >= 18 && h < 24) timeSlots.Evening.push(e.intensity);
    else                         timeSlots.Night.push(e.intensity);
  });
  const timeAvgs = Object.fromEntries(
    Object.entries(timeSlots).map(([k, v]) => [k, v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null])
  );

  // Coping effectiveness
  const copingMap = {};
  entries.forEach(e => {
    if (!e.copingActions?.length || !e.helpedRating) return;
    e.copingActions.forEach(a => {
      if (!copingMap[a]) copingMap[a] = [];
      copingMap[a].push(e.helpedRating);
    });
  });
  const copingEffectiveness = Object.entries(copingMap)
    .map(([action, ratings]) => ({ action, avg: +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1), count: ratings.length }))
    .sort((a, b) => b.avg - a.avg);

  return { avgAll, best, worst, topCat, catCount, catAvgs, catPcts, trendLabels, trendData, timeAvgs, monthName, entries, copingEffectiveness };
}

function renderLifestyleSummary() {
  const container = document.getElementById('lifestyleInsightsCard');
  if (!container) return;
  const entries = getEntries();
  if (!entries.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  const recent = entries.slice(0, 8);
  const avgSleep = +(recent.reduce((s, e) => s + (e.sleepHours || 0), 0) / recent.length).toFixed(1);
  const avgExercise = +(recent.reduce((s, e) => s + (e.exerciseMinutes || 0), 0) / recent.length).toFixed(0);
  const avgWorkload = +(recent.reduce((s, e) => s + (e.workload || 5), 0) / recent.length).toFixed(1);
  const avgStress = +(recent.reduce((s, e) => s + (e.stress || 5), 0) / recent.length).toFixed(1);
  container.innerHTML = `
    <div class="section-title">Lifestyle Trends</div>
    <div class="grid-4" style="margin-top:0.85rem">
      <div class="card" style="padding:1rem"><div class="stat-label">Sleep</div><div class="stat-value teal">${avgSleep}h</div></div>
      <div class="card" style="padding:1rem"><div class="stat-label">Exercise</div><div class="stat-value purple">${avgExercise}m</div></div>
      <div class="card" style="padding:1rem"><div class="stat-label">Workload</div><div class="stat-value orange">${avgWorkload}/10</div></div>
      <div class="card" style="padding:1rem"><div class="stat-label">Stress</div><div class="stat-value pink">${avgStress}/10</div></div>
    </div>`;
}

function renderAnalytics() {
  const { avgAll, best, worst, topCat, catCount, catAvgs, catPcts, trendLabels, trendData, timeAvgs, monthName, entries, copingEffectiveness } = getAnalyticsData();

  setText('analyticsSubtitle', `Patterns and trends from all your entries — ${monthName}`);

  if (!entries.length) {
    const noData  = document.getElementById('noDataMsg');
    const charts  = document.getElementById('chartsSection');
    if (noData) noData.style.display  = 'block';
    if (charts) charts.style.display  = 'none';
    return;
  }

  setText('aAvgMood',    avgAll ? `${avgAll} / 10` : '—');
  setText('aBestDay',    best  ? formatDate(best.datetime).date  : '—');
  setText('aWorstDay',   worst ? formatDate(worst.datetime).date : '—');
  setText('aTopTrigger', topCat?.[0] ? CATEGORY_LABELS[topCat[0]] : '—');

  renderLifestyleSummary();

  setText('pctWork',   `${catPcts.work}%`);
  setText('pctMoney',  `${catPcts.money}%`);
  setText('pctHealth', `${catPcts.health}%`);
  setText('pctRel',    `${catPcts.rel}%`);
  setText('pctSchool', `${catPcts.school || 0}%`);

  renderStreak();
  renderCharts({ trendLabels, trendData, catCount, catAvgs, timeAvgs, copingEffectiveness });
}

// ─── MONTHLY SUMMARY ────────────────────────────────────

function renderMonthlySummary() {
  const container = document.getElementById('monthlySummary');
  if (!container) return;

  const entries   = getEntries();
  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth();
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const monthEntries = entries.filter(e => {
    const d = new Date(e.datetime);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  if (!monthEntries.length) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)"><div style="font-size:2.5rem">📅</div><p>No entries for ${monthName} yet.</p></div>`;
    return;
  }

  const scores  = monthEntries.map(e => e.intensity);
  const avg     = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const bestE   = monthEntries.reduce((a, b) => a.intensity > b.intensity ? a : b);
  const worstE  = monthEntries.reduce((a, b) => a.intensity < b.intensity ? a : b);

  const catCount = {};
  monthEntries.forEach(e => { catCount[e.category] = (catCount[e.category] || 0) + 1; });
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  const copingCount = {};
  monthEntries.forEach(e => {
    (e.copingActions || []).forEach(a => { copingCount[a] = (copingCount[a] || 0) + 1; });
  });
  const topCoping = Object.entries(copingCount).sort((a, b) => b[1] - a[1])[0];

  const { streak, loggedDays } = calcStreak(monthEntries);

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:2rem">
      <div class="page-tag" style="display:inline-flex">📅 ${monthName}</div>
      <h2 style="font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;margin-top:0.5rem">Monthly Summary</h2>
    </div>
    <div class="grid-3" style="margin-bottom:1.5rem">
      <div class="card stat-card purple" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:0.5rem">${avg >= 7 ? '😄' : avg >= 5 ? '😊' : '😟'}</div>
        <div class="stat-label">Average Mood</div>
        <div class="stat-value purple">${avg}/10</div>
        <div class="stat-sub">${getWellbeingLabel(avg)}</div>
      </div>
      <div class="card stat-card teal" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:0.5rem">📝</div>
        <div class="stat-label">Total Entries</div>
        <div class="stat-value teal">${monthEntries.length}</div>
        <div class="stat-sub">${loggedDays.size} days logged · ${streak}-day streak</div>
      </div>
      <div class="card stat-card pink" style="text-align:center">
        <div style="font-size:3rem;margin-bottom:0.5rem">🔁</div>
        <div class="stat-label">Top Issue</div>
        <div class="stat-value pink" style="font-size:1.2rem">${CATEGORY_LABELS[topCat[0]]}</div>
        <div class="stat-sub">${topCat[1]} entries</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card" style="padding:1.5rem">
        <div class="section-title">Best Day</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-top:0.75rem">
          <div style="font-size:2.5rem">${bestE.emoji}</div>
          <div>
            <div style="font-weight:600">${formatDate(bestE.datetime).date}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${escHtml(bestE.description)}</div>
            <div style="font-size:0.82rem;color:var(--teal-light);margin-top:0.25rem">Score: ${bestE.intensity}/10</div>
          </div>
        </div>
      </div>
      <div class="card" style="padding:1.5rem">
        <div class="section-title">Toughest Day</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-top:0.75rem">
          <div style="font-size:2.5rem">${worstE.emoji}</div>
          <div>
            <div style="font-weight:600">${formatDate(worstE.datetime).date}</div>
            <div style="font-size:0.82rem;color:var(--text-muted)">${escHtml(worstE.description)}</div>
            <div style="font-size:0.82rem;color:var(--orange-light);margin-top:0.25rem">Score: ${worstE.intensity}/10</div>
          </div>
        </div>
      </div>
    </div>
    ${topCoping ? `
    <div class="card" style="padding:1.5rem;margin-top:1.25rem;text-align:center">
      <div style="font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.5rem">Most Used Coping Action</div>
      <div style="font-size:1.5rem;font-family:'Syne',sans-serif;font-weight:700;color:var(--teal-light)">${COPING_LABELS[topCoping[0]]}</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.25rem">Used ${topCoping[1]} times this month</div>
    </div>` : ''}
    <div style="text-align:center;margin-top:1.5rem">
      <button class="btn btn-teal" onclick="exportCSV()">📤 Export This Month</button>
    </div>`;
}

// ─── CHARTS ─────────────────────────────────────────────

let chartInstances = {};

function renderCharts({ trendLabels, trendData, catCount, catAvgs, timeAvgs, copingEffectiveness }) {
  if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }

  Chart.defaults.color       = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#9B8FBF';
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  // Trend line
  const trendCanvas = document.getElementById('trendChart');
  if (trendCanvas) {
    chartInstances.trend = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Mood', data: trendData,
          borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.12)',
          borderWidth: 2.5, pointBackgroundColor: '#A78BFA', pointBorderColor: '#0F0A1E',
          pointBorderWidth: 2, pointRadius: 5, tension: 0.4, fill: true, spanGaps: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2 }, grid: { color: 'rgba(167,139,250,0.08)' } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.raw !== null ? ` Score: ${ctx.raw}/10` : ' No entry' } } }
      }
    });
  }

  // Donut
  const donutCanvas = document.getElementById('donutChart');
  if (donutCanvas) {
    chartInstances.donut = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Work', 'Money', 'Relationships', 'Health', 'School'],
        datasets: [{ data: [catCount.work, catCount.money, catCount.rel, catCount.health, catCount.school], backgroundColor: ['#7C3AED','#5EEAD4','#FB923C','#F472B6','#6EE7B7'], borderWidth: 0, hoverOffset: 8 }]
      },
      options: { cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} entries` } } } }
    });
  }

  // Avg by category
  const avgCanvas = document.getElementById('avgChart');
  if (avgCanvas) {
    chartInstances.avg = new Chart(avgCanvas, {
      type: 'bar',
      data: {
        labels: ['💼 Work','💰 Money','❤️ Relationships','🏃 Health','📚 School'],
        datasets: [{ data: [catAvgs.work, catAvgs.money, catAvgs.rel, catAvgs.health, catAvgs.school], backgroundColor: ['rgba(124,58,237,0.75)','rgba(94,234,212,0.75)','rgba(244,114,182,0.75)','rgba(251,146,60,0.75)','rgba(110,231,183,0.75)'], borderRadius: 6, borderSkipped: false }]
      },
      options: { indexAxis: 'y', responsive: true, scales: { x: { min:0,max:10,grid:{color:'rgba(167,139,250,0.08)'} }, y: { grid:{display:false} } }, plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>` Avg: ${ctx.raw}/10`}} } }
    });
  }

  // Mood by time of day
  const timeCanvas = document.getElementById('timeChart');
  if (timeCanvas) {
    const timeData = [timeAvgs.Morning, timeAvgs.Afternoon, timeAvgs.Evening, timeAvgs.Night];
    chartInstances.time = new Chart(timeCanvas, {
      type: 'bar',
      data: {
        labels: ['🌅 Morning','☀️ Afternoon','🌆 Evening','🌙 Night'],
        datasets: [{ data: timeData, backgroundColor: ['rgba(251,146,60,0.75)','rgba(167,139,250,0.75)','rgba(94,234,212,0.75)','rgba(124,58,237,0.75)'], borderRadius: 6, borderSkipped: false }]
      },
      options: { responsive: true, scales: { y:{min:0,max:10,grid:{color:'rgba(167,139,250,0.08)'}}, x:{grid:{display:false}} }, plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>ctx.raw!==null?` Avg: ${ctx.raw}/10`:' No data'}} } }
    });
  }

  // Coping effectiveness
  const copingCanvas = document.getElementById('copingChart');
  const noCopingMsg  = document.getElementById('noCopingMsg');
  const copingWrap   = document.getElementById('copingChartWrap');
  if (copingCanvas) {
    if (!copingEffectiveness?.length) {
      if (copingWrap)  copingWrap.style.display  = 'none';
      if (noCopingMsg) noCopingMsg.style.display = 'block';
    } else {
      if (copingWrap)  copingWrap.style.display  = 'block';
      if (noCopingMsg) noCopingMsg.style.display = 'none';
      chartInstances.coping = new Chart(copingCanvas, {
        type: 'bar',
        data: {
          labels: copingEffectiveness.map(c => COPING_LABELS[c.action] || c.action),
          datasets: [{ data: copingEffectiveness.map(c => c.avg), backgroundColor: copingEffectiveness.map((_, i) => ['rgba(94,234,212,0.75)','rgba(167,139,250,0.75)','rgba(251,146,60,0.75)','rgba(244,114,182,0.75)','rgba(124,58,237,0.75)'][i%5]), borderRadius:6, borderSkipped:false }]
        },
        options: { indexAxis:'y', responsive:true, scales: { x:{min:0,max:5,ticks:{stepSize:1},grid:{color:'rgba(167,139,250,0.08)'},title:{display:true,text:'Avg helpfulness (1–5)',color:'#9B8FBF',font:{size:11}}}, y:{grid:{display:false}} }, plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>{ const item=copingEffectiveness[ctx.dataIndex]; return ` Avg: ${ctx.raw}/5 · used ${item.count} time${item.count>1?'s':''}`;}}} } }
      });
    }
  }
}

// ─── DASHBOARD ──────────────────────────────────────────

function renderCheckInPrompt() {
  const container = document.getElementById('checkinPromptCard');
  if (!container) return;
  const todayEntries = getTodayEntries();
  if (todayEntries.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:1rem">A quick check-in could help today</div>
        <div style="font-size:0.84rem;color:var(--text-muted);margin-top:0.25rem">You have not logged anything yet today. A short note can help you spot patterns early.</div>
      </div>
      <a href="add-entry.html" class="btn btn-primary">+ Check In</a>
    </div>`;
}

function renderWeeklySummaryCard() {
  const container = document.getElementById('weeklySummaryCard');
  if (!container) return;
  const entries = getEntries();
  if (!entries.length) {
    container.style.display = 'none';
    return;
  }
  const now = new Date();
  const last7 = entries.filter(e => new Date(e.datetime) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  if (!last7.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  const avg = +(last7.reduce((s, e) => s + e.intensity, 0) / last7.length).toFixed(1);
  const best = last7.reduce((a, b) => a.intensity > b.intensity ? a : b);
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
      <div>
        <div class="section-title" style="margin:0">Past 7 Days</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">A gentle snapshot of your recent mood patterns and habits.</div>
      </div>
      <div style="font-size:0.95rem;font-weight:700;color:var(--teal-light)">${avg}/10 avg mood</div>
    </div>
    <div class="grid-3">
      <div class="card" style="padding:1rem">
        <div class="stat-label">7-Day Average</div>
        <div class="stat-value teal">${avg}</div>
      </div>
      <div class="card" style="padding:1rem">
        <div class="stat-label">Brightest Day</div>
        <div class="stat-value purple">${best ? formatDate(best.datetime).date : '—'}</div>
      </div>
      <div class="card" style="padding:1rem">
        <div class="stat-label">Rest & Movement</div>
        <div style="font-size:0.88rem;color:var(--text-muted);margin-top:0.35rem">Sleep ${last7.length ? `${(last7.reduce((s, e) => s + (e.sleepHours || 0), 0) / last7.length).toFixed(1)}h` : '—'} · Exercise ${last7.length ? `${last7.reduce((s, e) => s + (e.exerciseMinutes || 0), 0)}m` : '—'}</div>
      </div>
    </div>`;
}

function renderDashboard() {
  // Prevent rapid consecutive renders which can cause visual flashing.
  const nowTick = Date.now();
  if (renderDashboard._last && (nowTick - renderDashboard._last) < 150) return;
  renderDashboard._last = nowTick;
  const entries = getEntries();
  const now     = new Date();
  const todayStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  setText('todayLabel', todayStr);

  if (!entries.length) {
    setText('welcomeMsg', 'Welcome to MoodTrace 🌿');
    setText('welcomeSub', 'Your private space to reflect, track how you feel, and discover quiet patterns.');
    renderCheckInPrompt();
    renderWeeklySummaryCard();
    renderGoals();
    loadAIMessage();
    return;
  }

  const scores = entries.map(e => e.intensity);
  const avg    = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const worst  = entries.reduce((a, b) => a.intensity < b.intensity ? a : b);
  const best   = entries.reduce((a, b) => a.intensity > b.intensity ? a : b);

  const catCount = {};
  entries.forEach(e => { catCount[e.category] = (catCount[e.category] || 0) + 1; });
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  const monthEntries = entries.filter(e => {
    const d = new Date(e.datetime);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const { streak } = calcStreak(entries);

  const avgMoodEl = document.getElementById('statAvgMood');
  if (avgMoodEl) avgMoodEl.innerHTML = `${avg}<span style="font-size:1.1rem;opacity:0.6">/10</span>`;
  setText('statAvgSub',      avg >= 7 ? '↑ Above baseline — feeling good!' : avg >= 5 ? 'Holding steady balance' : '↓ Below average — take it easy today');
  setText('statEntryCount',  monthEntries.length);
  setText('statStreakSub',   streak ? `${streak}-day streak 🔥` : 'Log today to start streak');
  setText('statWorstDay',    formatDate(worst.datetime).date);
  setText('statWorstSub',    `Score ${worst.intensity}/10 — ${getCategoryLabel(worst.category)}`);
  
  const topLabel = getCategoryLabel(topCat[0]);
  setText('statTopIssue',    topLabel.substring(topLabel.indexOf(' ') + 1).trim() || topCat[0]);
  setText('statTopIssueSub', `${topCat[1]} of ${entries.length} reflections`);
  setText('statBestDay',     formatDate(best.datetime).date);
  setText('statBestSub',     `Score ${best.intensity}/10 — ${getCategoryLabel(best.category)}`);
  setText('statWellbeing',   getWellbeingLabel(avg));

  const hour     = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  setText('welcomeMsg', `${greeting}! You're doing great.`);
  setText('welcomeSub',  `You've logged ${monthEntries.length} reflection${monthEntries.length === 1 ? '' : 's'} this month. Take a mindful breath.`);

  // Today's logs count
  const todayCount = getTodayEntries().length;
  const todayBadge = document.getElementById('todayLogCount');
  if (todayBadge) todayBadge.textContent = todayCount ? `${todayCount} log${todayCount > 1 ? 's' : ''} today` : 'Not logged today';

  const recentContainer = document.getElementById('recentEntries');
  if (recentContainer) {
    recentContainer.innerHTML = entries.slice(0, 4).map(entry => `
      <div class="entry-row">
        ${entry.photoUrl ? `<img src="${entry.photoUrl}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--border);flex-shrink:0">` : `<div class="entry-emoji">${entry.emoji}</div>`}
        <div class="entry-info">
          <div class="entry-title">${escHtml(entry.description)}</div>
          <div class="entry-meta">${formatDate(entry.datetime).date} · ${formatDate(entry.datetime).time}${entry.audioUrl ? ' · 🎤' : ''}</div>
        </div>
        <span class="badge ${BADGE_CLASSES[entry.category] || ''}">${getCategoryLabel(entry.category)}</span>
        <div class="entry-date">${entry.intensity}/10</div>
      </div>`).join('');
  }

  renderCheckInPrompt();
  renderWeeklySummaryCard();
  renderGoals();
  loadAIMessage();
  renderPatternAlerts('patternAlertsSection');
  renderDigestBanner('reflectionDigestBanner');
}

// ─── PAGE INIT ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Shared initialisation for all pages. Page-specific setup moved
  // to lightweight per-page init scripts (init-<page>.js).
  initTheme();
  initAccessibility();
  lazyLoadAmbient();
  initServiceWorker();
  initVoiceEntry();
  // Reminder scheduling check (best-effort)
  checkReminderOnLoad();
});



// ─── APP RATING ─────────────────────────────────────────

function initAppRating() {
  const widget = document.getElementById('appRatingWidget');
  if (!widget) return;

  // Show after 5+ entries, once per week
  const entries = getEntries();
  const lastRated = localStorage.getItem('moodtrace_last_rated');
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (entries.length < 5) return;
  if (lastRated && Number(lastRated) > oneWeekAgo) return;

  widget.style.display = 'block';

  widget.querySelectorAll('.rating-star').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = Number(star.dataset.val);
      widget.querySelectorAll('.rating-star').forEach(s => {
        s.textContent = Number(s.dataset.val) <= val ? '⭐' : '☆';
      });
    });
    star.addEventListener('mouseleave', () => {
      const saved = Number(localStorage.getItem('moodtrace_app_rating') || 0);
      widget.querySelectorAll('.rating-star').forEach(s => {
        s.textContent = Number(s.dataset.val) <= saved ? '⭐' : '☆';
      });
    });
    star.addEventListener('click', () => {
      const val = Number(star.dataset.val);
      localStorage.setItem('moodtrace_app_rating', val);
      localStorage.setItem('moodtrace_last_rated', Date.now());
      widget.querySelectorAll('.rating-star').forEach(s => {
        s.textContent = Number(s.dataset.val) <= val ? '⭐' : '☆';
      });
      setTimeout(() => {
        document.getElementById('ratingThanks').style.display = 'block';
        document.getElementById('ratingStars').style.display = 'none';
      }, 400);
    });
  });
}

// ─── GOAL SETTING ───────────────────────────────────────

function getGoals() {
  if (window.storageAPI && typeof window.storageAPI.getGoals === 'function') {
    return window.storageAPI.getGoals();
  }
  if (window.currentUser && window.firestoreGoalsCache) return window.firestoreGoalsCache;
  try { return JSON.parse(localStorage.getItem('moodtrace_goals') || '{}'); } catch { return {}; }
}

function saveGoals(goals) {
  if (window.storageAPI && typeof window.storageAPI.saveGoals === 'function') {
    return window.storageAPI.saveGoals(goals);
  }
  if (window.currentUser && window.db) {
    window.db.collection('users').doc(window.currentUser.uid).collection('settings').doc('goals').set(goals);
  } else {
    localStorage.setItem('moodtrace_goals', JSON.stringify(goals));
  }
}

function renderGoals() {
  const container = document.getElementById('goalsSection');
  if (!container) return;

  const goals   = getGoals();
  const entries = getEntries();
  const now     = new Date();

  const monthEntries = entries.filter(e => {
    const d = new Date(e.datetime);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const avgMood    = monthEntries.length ? +(monthEntries.reduce((s, e) => s + e.intensity, 0) / monthEntries.length).toFixed(1) : 0;
  const { streak } = calcStreak(entries);
  const { loggedDays } = calcStreak(entries);

  const moodGoal    = goals.mood    || 7;
  const streakGoal  = goals.streak  || 7;
  const entriesGoal = goals.entries || 20;

  const moodPct    = Math.min(100, Math.round((avgMood / moodGoal) * 100));
  const streakPct  = Math.min(100, Math.round((streak / streakGoal) * 100));
  const entriesPct = Math.min(100, Math.round((monthEntries.length / entriesGoal) * 100));

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
      <div class="section-title" style="margin:0">Monthly Goals</div>
      <button onclick="openGoalEditor()" class="btn btn-ghost" style="font-size:0.78rem;padding:0.35rem 0.85rem">⚙️ Edit Goals</button>
    </div>

    ${goalBar('🎯 Average Mood', avgMood, moodGoal, moodPct, '/10', 'var(--purple-light)')}
    ${goalBar('🔥 Day Streak', streak, streakGoal, streakPct, ' days', 'var(--orange-light)')}
    ${goalBar('📝 Entries Logged', monthEntries.length, entriesGoal, entriesPct, ' entries', 'var(--teal-light)')}

`;
}

// Create the goal editor modal once and append to body (prevents flashing when renderGoals
// is called frequently). This will noop if the modal already exists.
function ensureGoalModal() {
  if (document.getElementById('goalEditorModal')) return;
  const modalWrap = document.createElement('div');
  modalWrap.id = 'goalEditorModal';
  modalWrap.style.cssText = 'display:none;position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);align-items:flex-start;justify-content:center;padding:1rem;overflow-y:auto';
  modalWrap.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:2rem;max-width:400px;width:100%;max-height:calc(100vh - 2rem);overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <h3 style="font-family:'Syne',sans-serif;font-weight:700">Set Your Goals</h3>
        <button id="goalEditorCloseBtn" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem">✕</button>
      </div>
      <div class="form-section">
        <label class="form-label">Target Average Mood (1–10)</label>
        <input type="number" id="goalMood" class="form-input" min="1" max="10" value="7" style="width:100%">
      </div>
      <div class="form-section">
        <label class="form-label">Target Streak (days)</label>
        <input type="number" id="goalStreak" class="form-input" min="1" max="31" value="7" style="width:100%">
      </div>
      <div class="form-section">
        <label class="form-label">Target Entries This Month</label>
        <input type="number" id="goalEntries" class="form-input" min="1" max="100" value="20" style="width:100%">
      </div>
      <div style="display:flex;gap:0.75rem">
        <button class="btn btn-primary" id="goalEditorSaveBtn" style="flex:1">Save Goals</button>
        <button class="btn btn-ghost" id="goalEditorCancelBtn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modalWrap);

  // Wire up close/save handlers once
  modalWrap.querySelector('#goalEditorCloseBtn').addEventListener('click', closeGoalEditor);
  modalWrap.querySelector('#goalEditorCancelBtn').addEventListener('click', closeGoalEditor);
  modalWrap.querySelector('#goalEditorSaveBtn').addEventListener('click', saveGoalEditorFromModal);
}

function saveGoalEditorFromModal() {
  // Read the inputs from the modal and save
  const mood = Number(document.getElementById('goalMood').value) || 7;
  const streak = Number(document.getElementById('goalStreak').value) || 7;
  const entries = Number(document.getElementById('goalEntries').value) || 20;
  saveGoals({ mood, streak, entries });
  closeGoalEditor();
  renderGoals();
}

function goalBar(label, current, target, pct, unit, color) {
  const done = pct >= 100;
  return `
    <div style="margin-bottom:1.25rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
        <span style="font-size:0.85rem;font-weight:500">${label}</span>
        <span style="font-size:0.82rem;color:${color};font-weight:600">${current}${unit} <span style="color:var(--text-muted);font-weight:400">/ ${target}${unit}</span> ${done ? '✅' : ''}</span>
      </div>
      <div style="height:10px;background:var(--bg3);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.25rem">${done ? '🎉 Goal reached!' : `${pct}% there`}</div>
    </div>`;
}

function openGoalEditor() {
  ensureGoalModal();
  const goals = getGoals();
  // populate modal inputs with current goals
  const moodInput = document.getElementById('goalMood');
  const streakInput = document.getElementById('goalStreak');
  const entriesInput = document.getElementById('goalEntries');
  if (moodInput) moodInput.value = (goals.mood || 7);
  if (streakInput) streakInput.value = (goals.streak || 7);
  if (entriesInput) entriesInput.value = (goals.entries || 20);
  document.getElementById('goalEditorModal').style.display = 'flex';
}

function closeGoalEditor() {
  const el = document.getElementById('goalEditorModal');
  if (el) el.style.display = 'none';
}

function saveGoalEditor() {
  saveGoals({
    mood:    Number(document.getElementById('goalMood').value)    || 7,
    streak:  Number(document.getElementById('goalStreak').value)  || 7,
    entries: Number(document.getElementById('goalEntries').value) || 20
  });
  closeGoalEditor();
  renderGoals();
}

// ─── DATA INSIGHTS & CORRELATIONS ───────────────────────

function renderInsights() {
  const container = document.getElementById('insightsSection');
  if (!container) return;

  const entries = getEntries();
  if (entries.length < 3) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:0.5rem">📊</div><p>Log at least 3 entries to see your insights.</p></div>`;
    return;
  }

  const insights = [];

  // 1. Coping correlation — does exercise raise mood?
  const copingImpact = {};
  entries.forEach(e => {
    if (!e.copingActions?.length) return;
    e.copingActions.forEach(action => {
      if (!copingImpact[action]) copingImpact[action] = { with: [], without: [] };
      copingImpact[action].with.push(e.intensity);
    });
  });
  // entries without each coping action
  entries.forEach(e => {
    Object.keys(copingImpact).forEach(action => {
      if (!e.copingActions?.includes(action)) {
        copingImpact[action].without.push(e.intensity);
      }
    });
  });

  Object.entries(copingImpact).forEach(([action, data]) => {
    if (data.with.length < 2 || data.without.length < 2) return;
    const avgWith    = +(data.with.reduce((a, b) => a + b, 0) / data.with.length).toFixed(1);
    const avgWithout = +(data.without.reduce((a, b) => a + b, 0) / data.without.length).toFixed(1);
    const diff       = +(avgWith - avgWithout).toFixed(1);
    if (Math.abs(diff) >= 0.5) {
      insights.push({
        icon: diff > 0 ? '📈' : '📉',
        color: diff > 0 ? 'var(--teal-light)' : 'var(--orange-light)',
        text: diff > 0
          ? `Your mood is <strong>${diff} points higher</strong> on days you ${COPING_LABELS[action]?.replace(/[^\w\s]/gi, '').trim()}`
          : `Your mood tends to be <strong>${Math.abs(diff)} points lower</strong> on days you ${COPING_LABELS[action]?.replace(/[^\w\s]/gi, '').trim()}`
      });
    }
  });

  // 2. Category trend — has work stress improved?
  const now   = new Date();
  const thisMonth = entries.filter(e => new Date(e.datetime).getMonth() === now.getMonth());
  const lastMonth = entries.filter(e => new Date(e.datetime).getMonth() === (now.getMonth() - 1 + 12) % 12);

  Object.keys(CATEGORY_LABELS).forEach(cat => {
    const thisAvg = thisMonth.filter(e => e.category === cat);
    const lastAvg = lastMonth.filter(e => e.category === cat);
    if (thisAvg.length < 2 || lastAvg.length < 2) return;
    const thisScore = +(thisAvg.reduce((s, e) => s + e.intensity, 0) / thisAvg.length).toFixed(1);
    const lastScore = +(lastAvg.reduce((s, e) => s + e.intensity, 0) / lastAvg.length).toFixed(1);
    const diff      = +(thisScore - lastScore).toFixed(1);
    if (Math.abs(diff) >= 0.5) {
      const label = CATEGORY_LABELS[cat].replace(/[^\w\s]/gi, '').trim();
      insights.push({
        icon: diff > 0 ? '✅' : '⚠️',
        color: diff > 0 ? 'var(--purple-light)' : 'var(--pink-light)',
        text: diff > 0
          ? `Your ${label} mood has <strong>improved by ${diff} points</strong> compared to last month`
          : `Your ${label} mood has <strong>dropped ${Math.abs(diff)} points</strong> compared to last month`
      });
    }
  });

  // 3. Best time of day
  const timeSlots = { Morning: [], Afternoon: [], Evening: [], Night: [] };
  entries.forEach(e => {
    const h = new Date(e.datetime).getHours();
    if      (h >= 6  && h < 12) timeSlots.Morning.push(e.intensity);
    else if (h >= 12 && h < 18) timeSlots.Afternoon.push(e.intensity);
    else if (h >= 18 && h < 24) timeSlots.Evening.push(e.intensity);
    else                         timeSlots.Night.push(e.intensity);
  });
  const timeAvgs = Object.entries(timeSlots)
    .filter(([, v]) => v.length >= 2)
    .map(([k, v]) => ({ slot: k, avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }))
    .sort((a, b) => b.avg - a.avg);

  if (timeAvgs.length >= 2) {
    const best  = timeAvgs[0];
    const worst = timeAvgs[timeAvgs.length - 1];
    insights.push({
      icon: '🕐',
      color: 'var(--teal-light)',
      text: `You feel best in the <strong>${best.slot}</strong> (avg ${best.avg}/10) and lowest at <strong>${worst.slot}</strong> (avg ${worst.avg}/10)`
    });
  }

  // 4. Streak insight
  const { streak } = calcStreak(entries);
  if (streak >= 3) {
    insights.push({ icon: '🔥', color: 'var(--orange-light)', text: `You're on a <strong>${streak}-day logging streak</strong> — that's a great habit building!` });
  }

  // 5. Most triggering category
  const lowEntries   = entries.filter(e => e.intensity <= 4);
  const lowCatCount  = {};
  lowEntries.forEach(e => { lowCatCount[e.category] = (lowCatCount[e.category] || 0) + 1; });
  const topLowCat    = Object.entries(lowCatCount).sort((a, b) => b[1] - a[1])[0];
  if (topLowCat && topLowCat[1] >= 2) {
    insights.push({
      icon: '⚠️',
      color: 'var(--pink-light)',
      text: `<strong>${CATEGORY_LABELS[topLowCat[0]]}</strong> is your most common low-mood trigger (${topLowCat[1]} low entries)`
    });
  }

  if (!insights.length) {
    container.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.85rem">Keep logging! Insights appear as patterns emerge in your data.</div>`;
    return;
  }

  container.innerHTML = insights.map(i => `
    <div style="display:flex;align-items:flex-start;gap:0.85rem;padding:1rem 1.25rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.6rem">
      <div style="font-size:1.3rem;flex-shrink:0">${i.icon}</div>
      <div style="font-size:0.88rem;line-height:1.5;color:var(--text)">${i.text}</div>
    </div>`).join('');
}

// ─── INTELLIGENT PATTERN ALERTS ─────────────────────────

function detectIntelligentPatterns(entries) {
  if (!entries || !entries.length) return [];
  const alerts = [];
  const total = entries.length;
  const allScores = entries.map(e => e.intensity);
  const baselineAvg = +(allScores.reduce((a, b) => a + b, 0) / total).toFixed(1);

  // 1. Coping action percentage impact (e.g. Walking, Exercise, Music, Meditation)
  const copingMap = {};
  entries.forEach(e => {
    if (e.copingActions && Array.isArray(e.copingActions)) {
      e.copingActions.forEach(act => {
        if (!copingMap[act]) copingMap[act] = [];
        copingMap[act].push(e.intensity);
      });
    }
  });

  Object.entries(copingMap).forEach(([action, scoresWith]) => {
    if (scoresWith.length < 2) return;
    const scoresWithout = entries.filter(e => !e.copingActions?.includes(action)).map(e => e.intensity);
    if (scoresWithout.length < 2) return;

    const avgWith = scoresWith.reduce((a, b) => a + b, 0) / scoresWith.length;
    const avgWithout = scoresWithout.reduce((a, b) => a + b, 0) / scoresWithout.length;
    const pctDiff = Math.round(((avgWith - avgWithout) / avgWithout) * 100);

    const actionClean = COPING_LABELS[action]?.replace(/^[^\w\s]+\s*/, '') || action;

    if (pctDiff >= 15) {
      alerts.push({
        id: `coping-${action}`,
        type: 'positive',
        tag: 'Habit Lift',
        badge: `+${pctDiff}% Mood Boost`,
        icon: '🌱',
        title: `You report ${pctDiff}% higher mood on days you ${actionClean.toLowerCase()}`,
        desc: `Your mood averages ${avgWith.toFixed(1)}/10 when you engage in ${actionClean.toLowerCase()}, compared to ${avgWithout.toFixed(1)}/10 on days without.`,
        tip: `✨ Consistency matters more than duration. Keep this coping superpower in your toolkit!`
      });
    } else if (action === 'nothing' && pctDiff <= -15) {
      alerts.push({
        id: 'coping-nothing',
        type: 'notice',
        tag: 'Slump Notice',
        badge: `${pctDiff}% Dip`,
        icon: '⚠️',
        title: `Days with no coping action correlate with lower mood`,
        desc: `Taking no restorative action averages ${avgWith.toFixed(1)}/10 vs ${avgWithout.toFixed(1)}/10 when you take active steps.`,
        tip: `💡 Even a 3-minute stretch or listening to a favorite track can interrupt an emotional slump.`
      });
    }
  });

  // 2. Day-of-Week Rhythm ("Sunday Scaries" & Weekend Peaks)
  const dayBuckets = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  entries.forEach(e => {
    const d = new Date(e.datetime);
    dayBuckets[d.getDay()].push(e.intensity);
  });

  // Check Sunday Scaries (Day 0)
  const sundayScores = dayBuckets[0];
  if (sundayScores.length >= 2) {
    const sunAvg = +(sundayScores.reduce((a, b) => a + b, 0) / sundayScores.length).toFixed(1);
    if (sunAvg <= baselineAvg - 0.7) {
      const dropPct = Math.round(((baselineAvg - sunAvg) / baselineAvg) * 100);
      alerts.push({
        id: 'sunday-scaries',
        type: 'notice',
        tag: 'Rhythm Notice',
        badge: `-${dropPct}% Dip`,
        icon: '🌙',
        title: 'Notice: Sundays tend to have a mood dip (Sunday Scaries)',
        desc: `Sundays average ${sunAvg}/10 compared to your baseline of ${baselineAvg}/10. Anticipatory stress often peaks on Sunday evenings.`,
        tip: '🍵 Protect Sunday evenings with an intentional wind-down ritual, cozy dinner, or relaxing read.'
      });
    }
  }

  // Check Weekend Rebound (Fridays & Saturdays)
  const weekendScores = [...dayBuckets[5], ...dayBuckets[6]];
  if (weekendScores.length >= 2) {
    const weekendAvg = +(weekendScores.reduce((a, b) => a + b, 0) / weekendScores.length).toFixed(1);
    if (weekendAvg >= baselineAvg + 0.7) {
      const boostPct = Math.round(((weekendAvg - baselineAvg) / baselineAvg) * 100);
      alerts.push({
        id: 'weekend-surge',
        type: 'rhythm',
        tag: 'Weekly Rhythm',
        badge: `+${boostPct}% Weekend Surge`,
        icon: '⚡',
        title: 'End-of-week energy lifts your wellbeing',
        desc: `Fridays and Saturdays bring a ${boostPct}% surge in positive sentiment (avg ${weekendAvg}/10 vs ${baselineAvg}/10 weekday average).`,
        tip: '🎉 Notice what brings you freedom on weekends and weave a micro-dose of that into mid-week.'
      });
    }
  }

  // 3. Time of Day Pattern
  const timeBuckets = { Morning: [], Afternoon: [], Evening: [], Night: [] };
  entries.forEach(e => {
    const h = new Date(e.datetime).getHours();
    if (h >= 6 && h < 12) timeBuckets.Morning.push(e.intensity);
    else if (h >= 12 && h < 18) timeBuckets.Afternoon.push(e.intensity);
    else if (h >= 18 && h < 24) timeBuckets.Evening.push(e.intensity);
    else timeBuckets.Night.push(e.intensity);
  });

  if (timeBuckets.Evening.length >= 2 && (timeBuckets.Morning.length >= 2 || timeBuckets.Afternoon.length >= 2)) {
    const evAvg = timeBuckets.Evening.reduce((a, b) => a + b, 0) / timeBuckets.Evening.length;
    const dayScores = [...timeBuckets.Morning, ...timeBuckets.Afternoon];
    const dayAvg = dayScores.reduce((a, b) => a + b, 0) / dayScores.length;
    if (evAvg <= dayAvg - 0.8) {
      const dip = Math.round(((dayAvg - evAvg) / dayAvg) * 100);
      alerts.push({
        id: 'evening-slump',
        type: 'notice',
        tag: 'Time Rhythm',
        badge: `-${dip}% Evening Dip`,
        icon: '🌆',
        title: 'Notice: Mood dips around evening time',
        desc: `Your evening entries average ${evAvg.toFixed(1)}/10 vs ${dayAvg.toFixed(1)}/10 during daylight hours. Cognitive fatigue often compounds after 7 PM.`,
        tip: '🛋️ Lower your evening demands: dim bright lights and transition to restorative activities.'
      });
    }
  }

  // 4. Primary Stressor Concentration
  const lowEntries = entries.filter(e => e.intensity <= 4);
  if (lowEntries.length >= 2) {
    const catCounts = {};
    lowEntries.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topLow = sorted[0];
    const catPct = Math.round((topLow[1] / lowEntries.length) * 100);
    if (catPct >= 35) {
      const catLabel = getCategoryLabel(topLow[0]);
      alerts.push({
        id: `stressor-${topLow[0]}`,
        type: 'notice',
        tag: 'Trigger Focus',
        badge: `${catPct}% of Low Days`,
        icon: '🎯',
        title: `${catLabel} is your primary emotional trigger`,
        desc: `${catPct}% of your toughest moments trace back to ${catLabel}. Pinpointing this source helps focus your coping efforts.`,
        tip: '🛡️ Consider setting clearer mental or time boundaries around this area.'
      });
    }
  }

  // 5. Rest & Sleep impact (if sleep logged)
  const sleepEntries = entries.filter(e => typeof e.sleepHours === 'number' && e.sleepHours > 0);
  if (sleepEntries.length >= 4) {
    const goodSleep = sleepEntries.filter(e => e.sleepHours >= 7);
    const poorSleep = sleepEntries.filter(e => e.sleepHours < 7);
    if (goodSleep.length >= 2 && poorSleep.length >= 2) {
      const goodAvg = goodSleep.reduce((a, b) => a + b.intensity, 0) / goodSleep.length;
      const poorAvg = poorSleep.reduce((a, b) => a + b.intensity, 0) / poorSleep.length;
      const lift = Math.round(((goodAvg - poorAvg) / poorAvg) * 100);
      if (lift >= 15) {
        alerts.push({
          id: 'sleep-impact',
          type: 'positive',
          tag: 'Vital Habit',
          badge: `+${lift}% Sleep Boost`,
          icon: '🛌',
          title: `7+ hours of sleep elevates your daily resilience by ${lift}%`,
          desc: `You average ${goodAvg.toFixed(1)}/10 after restful sleep compared to ${poorAvg.toFixed(1)}/10 on nights under 7 hours.`,
          tip: '🌙 Going to bed just 30 minutes earlier is one of your strongest mood multipliers.'
        });
      }
    }
  }

  // Fallback demo/starter pattern if dataset is fresh
  if (!alerts.length && total >= 1) {
    alerts.push({
      id: 'starter-welcome',
      type: 'rhythm',
      tag: 'Pattern Learning',
      badge: `${total} Log${total > 1 ? 's' : ''} Collected`,
      icon: '🔍',
      title: 'MoodTrace is learning your personal rhythms',
      desc: 'As you log over the next few days, intelligent correlation cards will automatically appear here comparing your coping habits, weekly rhythms, and times of day.',
      tip: '✏️ Try logging in the morning and evening to help detect your daily energy curve.'
    });
  }

  return alerts;
}

function renderPatternAlerts(containerId = 'patternAlertsSection') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = getEntries();
  const alerts = detectIntelligentPatterns(entries);

  if (!alerts.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="pattern-alerts-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
        <div class="section-title" style="margin-bottom:0">Intelligent Pattern Alerts</div>
        <span style="font-size:0.78rem;color:var(--text-muted)">${alerts.length} discovery${alerts.length > 1 ? 's' : ''}</span>
      </div>
      <div class="pattern-alerts-grid">
        ${alerts.map(a => `
          <div class="pattern-card ${a.type}">
            <div>
              <div class="pattern-header">
                <span class="pattern-tag ${a.type}">${a.tag}</span>
                <span class="pattern-badge-stat">${a.badge}</span>
              </div>
              <div class="pattern-title">${a.title}</div>
              <div class="pattern-desc">${a.desc}</div>
            </div>
            <div class="pattern-tip">${a.tip}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// ─── GUIDED REFLECTION DIGEST WIZARD ────────────────────

window.digestState = {
  type: 'weekly',
  periodTitle: 'Weekly Reflection',
  step: 1,
  totalSteps: 6,
  data: {},
  intention: ''
};

function renderDigestBanner(containerId = 'reflectionDigestBanner') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = getEntries();
  if (entries.length < 2) {
    container.style.display = 'none';
    return;
  }

  const isSunday = new Date().getDay() === 0;
  const lastReview = localStorage.getItem('moodtrace_last_review');
  const daysSinceReview = lastReview ? (Date.now() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24) : 999;

  // Show if today is Sunday or it's been > 5 days since last review
  if (isSunday || daysSinceReview >= 5) {
    container.style.display = 'block';
    container.innerHTML = `
      <div class="digest-banner">
        <div class="digest-banner-content">
          <div class="digest-banner-icon">✨</div>
          <div>
            <div class="digest-banner-title">Your Weekly Reflection Digest is Ready</div>
            <div class="digest-banner-sub">Take 2 minutes to celebrate your high points, honor tough moments, and set a kind intention for next week.</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="openReflectionDigest('weekly')" style="white-space:nowrap;font-size:0.85rem">Start Review →</button>
      </div>`;
  } else {
    container.style.display = 'none';
  }
}

function openReflectionDigest(type = 'weekly') {
  const entries = getEntries();
  const now = new Date();
  let filtered = [];
  let periodTitle = '';

  if (type === 'weekly') {
    periodTitle = 'Weekly Reflection';
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = entries.filter(e => new Date(e.datetime) >= cutoff);
  } else {
    periodTitle = 'Monthly Reflection';
    filtered = entries.filter(e => {
      const d = new Date(e.datetime);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  // Calculate statistics
  const scores = filtered.map(e => e.intensity);
  const avg = scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
  const best = filtered.length ? filtered.reduce((a, b) => a.intensity > b.intensity ? a : b) : null;
  const worst = filtered.length ? filtered.reduce((a, b) => a.intensity < b.intensity ? a : b) : null;

  // Coping efficacy
  const copingStats = {};
  filtered.forEach(e => {
    if (e.copingActions && Array.isArray(e.copingActions)) {
      e.copingActions.forEach(act => {
        if (!copingStats[act]) copingStats[act] = { count: 0, helpedTotal: 0 };
        copingStats[act].count++;
        copingStats[act].helpedTotal += (e.helped || 3);
      });
    }
  });

  const rankedCoping = Object.entries(copingStats).map(([act, d]) => ({
    action: act,
    label: COPING_LABELS[act] || act,
    count: d.count,
    avgHelped: +(d.helpedTotal / d.count).toFixed(1)
  })).sort((a, b) => b.avgHelped - a.avgHelped);

  window.digestState = {
    type,
    periodTitle,
    step: 1,
    totalSteps: 6,
    data: {
      entriesCount: filtered.length,
      avg,
      best,
      worst,
      rankedCoping,
      filtered
    },
    intention: ''
  };

  renderDigestStep(1);
  const modal = document.getElementById('reflectionDigestModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function renderDigestStep(stepNum) {
  window.digestState.step = stepNum;
  const state = window.digestState;
  const data = state.data;

  // Update progress bar & badge
  const bar = document.getElementById('digestProgressBar');
  if (bar) bar.style.width = `${(stepNum / state.totalSteps) * 100}%`;
  const badge = document.getElementById('digestStepBadge');
  if (badge) badge.textContent = `Step ${stepNum} of ${state.totalSteps}`;

  const content = document.getElementById('digestStepContent');
  if (!content) return;

  if (stepNum === 1) {
    // Step 1: Pulse
    let trajectoryText = '🌱 A fresh start — start logging your moments to see your weekly pulse.';
    let trajectoryBadge = '🌱 Fresh Slate';
    if (data.avg !== null) {
      if (data.avg >= 7) {
        trajectoryBadge = '📈 Upward Momentum';
        trajectoryText = 'You navigated this period with noticeable lightness, resilience, and bright energy.';
      } else if (data.avg >= 5) {
        trajectoryBadge = '⚖️ Steady Balance';
        trajectoryText = 'You maintained grounded equilibrium and held steady through the weekly ebb and flow.';
      } else {
        trajectoryBadge = '🌧️ Tender Week';
        trajectoryText = 'It was a heavier stretch. Honor yourself for showing up and meeting each moment with patience.';
      }
    }

    content.innerHTML = `
      <div class="digest-step-title">The Emotional Pulse</div>
      <div class="digest-step-sub">A high-level view of your rhythm over the ${state.type === 'weekly' ? 'past 7 days' : 'current month'}.</div>
      
      <div class="digest-stat-block" style="background:linear-gradient(135deg,rgba(124,58,237,0.14),rgba(13,148,136,0.1))">
        <div style="font-size:2.8rem">🌊</div>
        <div style="flex:1">
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--text-muted);font-weight:700">Average Mood Score</div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:2.2rem;color:var(--purple-light);line-height:1.1">
            ${data.avg !== null ? `${data.avg}<span style="font-size:1.1rem;opacity:0.6">/10</span>` : '—'}
          </div>
          <div style="font-size:0.82rem;color:var(--teal-light);margin-top:0.25rem;font-weight:600">${trajectoryBadge}</div>
        </div>
      </div>

      <div style="padding:1rem 1.25rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem;color:var(--text);line-height:1.5;margin-bottom:1.5rem">
        ${trajectoryText}
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.5rem">Total reflections logged: <strong>${data.entriesCount}</strong></div>
      </div>

      <div class="digest-nav-row">
        <button class="btn btn-ghost" onclick="closeReflectionDigest()">Exit</button>
        <button class="btn btn-primary" onclick="nextDigestStep()">Continue: Bright Moments →</button>
      </div>`;
  } else if (stepNum === 2) {
    // Step 2: Highlights
    const b = data.best;
    content.innerHTML = `
      <div class="digest-step-title">Brightest Moments 🌟</div>
      <div class="digest-step-sub">Re-visiting positive experiences trains the brain to notice and savor genuine joy.</div>
      
      ${b ? `
        <div class="digest-stat-block" style="border-left:4px solid var(--teal-light)">
          <div style="font-size:2.5rem">${b.emoji}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <span style="font-weight:700;font-size:1.1rem">${b.intensity}/10</span>
              <span class="badge ${BADGE_CLASSES[b.category] || ''}">${getCategoryLabel(b.category)}</span>
              <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto">${formatDate(b.datetime).date}</span>
            </div>
            <div style="font-size:0.9rem;margin-top:0.5rem;color:var(--text);font-style:italic">
              "${escHtml(b.description || 'Felt joyful and content.')}"
            </div>
            ${b.copingActions?.length ? `<div style="font-size:0.75rem;color:var(--teal-light);margin-top:0.4rem">Supported by: ${b.copingActions.map(a => COPING_LABELS[a]).join(', ')}</div>` : ''}
          </div>
        </div>
      ` : `
        <div style="text-align:center;padding:2rem;color:var(--text-muted)">
          <p>No reflections recorded in this window yet.</p>
        </div>
      `}

      <div style="font-size:0.84rem;color:var(--text-muted);line-height:1.5;margin-bottom:1.5rem">
        💡 Take 10 seconds to remember the feeling behind this moment. Where were you? How did your body feel?
      </div>

      <div class="digest-nav-row">
        <button class="btn btn-ghost" onclick="prevDigestStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextDigestStep()">Next: Toughest Moments →</button>
      </div>`;
  } else if (stepNum === 3) {
    // Step 3: Toughest moments
    const w = data.worst;
    content.innerHTML = `
      <div class="digest-step-title">Honoring Difficult Waves 🌦️</div>
      <div class="digest-step-sub">Resilience isn't avoiding low moods — it's holding space for them with kindness and understanding.</div>
      
      ${w ? `
        <div class="digest-stat-block" style="border-left:4px solid var(--orange-light)">
          <div style="font-size:2.5rem">${w.emoji}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <span style="font-weight:700;font-size:1.1rem">${w.intensity}/10</span>
              <span class="badge ${BADGE_CLASSES[w.category] || ''}">${getCategoryLabel(w.category)}</span>
              <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto">${formatDate(w.datetime).date}</span>
            </div>
            <div style="font-size:0.9rem;margin-top:0.5rem;color:var(--text);font-style:italic">
              "${escHtml(w.description || 'A challenging emotional moment.')}"
            </div>
            ${w.copingActions?.length ? `<div style="font-size:0.75rem;color:var(--orange-light);margin-top:0.4rem">You responded with: ${w.copingActions.map(a => COPING_LABELS[a]).join(', ')}</div>` : ''}
          </div>
        </div>
      ` : `
        <div style="text-align:center;padding:2rem;color:var(--text-muted)">
          <p>No low entries logged in this period.</p>
        </div>
      `}

      <div style="padding:0.9rem 1.15rem;background:rgba(234,88,12,0.1);border:1px solid rgba(234,88,12,0.25);border-radius:var(--radius-sm);font-size:0.85rem;color:var(--text);line-height:1.5;margin-bottom:1.5rem">
        🛡️ <strong>Gentle Reminder:</strong> You made it through every single hard moment this week. Tough feelings always pass.
      </div>

      <div class="digest-nav-row">
        <button class="btn btn-ghost" onclick="prevDigestStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextDigestStep()">Next: Coping Superpowers →</button>
      </div>`;
  } else if (stepNum === 4) {
    // Step 4: Coping superpowers
    const copingList = data.rankedCoping;
    content.innerHTML = `
      <div class="digest-step-title">Your Coping Superpowers 🧘</div>
      <div class="digest-step-sub">These actions scored highest on your personal "Did it help?" rating this week:</div>
      
      <div style="margin-bottom:1.5rem">
        ${copingList && copingList.length ? copingList.slice(0, 3).map((c, idx) => `
          <div class="digest-coping-rank-item">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:1.1rem;font-weight:700;color:var(--teal-light)">#${idx + 1}</span>
              <div>
                <div style="font-weight:600;font-size:0.92rem">${c.label}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">Used ${c.count} time${c.count > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div style="font-weight:700;color:var(--teal-light);font-size:0.95rem">
              ${c.avgHelped}★ <span style="font-size:0.72rem;color:var(--text-muted);font-weight:400">/5</span>
            </div>
          </div>
        `).join('') : `
          <div style="text-align:center;padding:2rem;color:var(--text-muted);font-size:0.88rem">
            No coping actions tracked yet in this window. Try checking off what you did (walk, music, meditation) when you feel stressed!
          </div>
        `}
      </div>

      <div class="digest-nav-row">
        <button class="btn btn-ghost" onclick="prevDigestStep()">← Back</button>
        <button class="btn btn-primary" onclick="nextDigestStep()">Next: Set Intention →</button>
      </div>`;
  } else if (stepNum === 5) {
    // Step 5: Setting Intention
    content.innerHTML = `
      <div class="digest-step-title">Mindful Intention 🎯</div>
      <div class="digest-step-sub">What is one kind thought, healthy boundary, or focus you want to take into next week?</div>
      
      <div style="margin-bottom:1.25rem">
        <textarea id="digestIntentionInput" class="form-textarea" placeholder="e.g. When work feels overwhelming, I will take a 5-minute walk outside instead of pushing through. I will protect my sleep on Thursday." style="min-height:120px">${escHtml(state.intention || '')}</textarea>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem">
          🔒 This intention will be preserved directly in your private Journal.
        </div>
      </div>

      <div class="digest-nav-row">
        <button class="btn btn-ghost" onclick="prevDigestStep()">← Back</button>
        <button class="btn btn-primary" onclick="saveDigestAndFinish()">Complete & Save Reflection ✨</button>
      </div>`;
  } else if (stepNum === 6) {
    // Step 6: Celebration
    content.innerHTML = `
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:3.5rem;margin-bottom:0.75rem">✨</div>
        <div class="digest-step-title" style="font-size:1.6rem;margin-bottom:0.5rem">Review Complete!</div>
        <p style="color:var(--text-muted);font-size:0.92rem;line-height:1.6;max-width:420px;margin:0 auto 1.5rem">
          You've reflected with honesty and compassion. Your thoughts and weekly intention have been added to your Journal.
        </p>

        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1.25rem;text-align:left;margin-bottom:1.75rem">
          <div style="font-size:0.75rem;text-transform:uppercase;color:var(--teal-light);font-weight:700;margin-bottom:0.35rem">Saved to Journal</div>
          <div style="font-weight:700;font-size:1rem;margin-bottom:0.25rem">${state.periodTitle} &amp; Intention</div>
          <div style="font-size:0.85rem;color:var(--text-muted);font-style:italic">"${escHtml(state.intention || 'Mindful reflection completed.')}"</div>
        </div>

        <div style="display:flex;gap:0.75rem;justify-content:center">
          <a href="journal.html" class="btn btn-teal">📖 View in Journal</a>
          <button class="btn btn-primary" onclick="closeReflectionDigest()">Back to Dashboard</button>
        </div>
      </div>`;
  }
}

function nextDigestStep() {
  if (window.digestState.step < window.digestState.totalSteps) {
    renderDigestStep(window.digestState.step + 1);
  }
}

function prevDigestStep() {
  if (window.digestState.step > 1) {
    renderDigestStep(window.digestState.step - 1);
  }
}

function closeReflectionDigest() {
  const modal = document.getElementById('reflectionDigestModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function saveDigestAndFinish() {
  const input = document.getElementById('digestIntentionInput');
  const intention = input ? input.value.trim() : '';
  window.digestState.intention = intention;

  // Save to Journal
  const state = window.digestState;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const title = `${state.periodTitle} — ${dateStr}`;

  const avgStr = state.data.avg !== null ? `${state.data.avg}/10` : '—';
  const bestStr = state.data.best ? `${state.data.best.emoji} (${state.data.best.intensity}/10)` : 'None';
  const worstStr = state.data.worst ? `${state.data.worst.emoji} (${state.data.worst.intensity}/10)` : 'None';
  const topCopingStr = state.data.rankedCoping?.length ? state.data.rankedCoping[0].label : 'None logged';

  const body = `### Summary of ${state.type === 'weekly' ? 'the Week' : 'the Month'}\n` +
    `- **Average Mood**: ${avgStr}\n` +
    `- **Highlights**: ${bestStr}\n` +
    `- **Toughest Moments**: ${worstStr}\n` +
    `- **Top Coping Superpower**: ${topCopingStr}\n\n` +
    `### My Mindful Intention\n` +
    `${intention || 'Stay curious, grounded, and kind to myself.'}`;

  addJournalEntry({
    title,
    body,
    datetime: now.toISOString()
  });

  localStorage.setItem('moodtrace_last_review', now.toISOString());
  renderDigestStep(6);
  if (typeof renderJournal === 'function') renderJournal();
}

// ─── MOOD TRIGGERS ANALYSIS ─────────────────────────────

function renderTriggers() {
  const container = document.getElementById('triggersSection');
  if (!container) return;

  const entries = getEntries();
  if (entries.length < 3) { container.innerHTML = ''; return; }

  const catData = {};
  entries.forEach(e => {
    if (!catData[e.category]) catData[e.category] = { scores: [], count: 0 };
    catData[e.category].scores.push(e.intensity);
    catData[e.category].count++;
  });

  const overallAvg = +(entries.reduce((s, e) => s + e.intensity, 0) / entries.length).toFixed(1);

  const rows = Object.entries(catData)
    .map(([cat, data]) => {
      const avg  = +(data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
      const diff = +(avg - overallAvg).toFixed(1);
      const low  = data.scores.filter(s => s <= 4).length;
      return { cat, avg, diff, count: data.count, low };
    })
    .sort((a, b) => a.avg - b.avg);

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
      <thead>
        <tr style="color:var(--text-muted);font-size:0.75rem;letter-spacing:0.06em;text-transform:uppercase">
          <th style="text-align:left;padding:0.5rem 0.75rem">Category</th>
          <th style="text-align:center;padding:0.5rem 0.75rem">Avg Mood</th>
          <th style="text-align:center;padding:0.5rem 0.75rem">vs Overall</th>
          <th style="text-align:center;padding:0.5rem 0.75rem">Low Days</th>
          <th style="text-align:center;padding:0.5rem 0.75rem">Entries</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:0.75rem">${CATEGORY_LABELS[r.cat]}</td>
            <td style="text-align:center;padding:0.75rem;font-weight:600;color:${r.avg >= 7 ? 'var(--teal-light)' : r.avg >= 5 ? 'var(--text)' : 'var(--pink-light)'}">${r.avg}/10</td>
            <td style="text-align:center;padding:0.75rem;font-weight:600;color:${r.diff >= 0 ? 'var(--teal-light)' : 'var(--pink-light)'}">${r.diff >= 0 ? '+' : ''}${r.diff}</td>
            <td style="text-align:center;padding:0.75rem;color:var(--orange-light)">${r.low}</td>
            <td style="text-align:center;padding:0.75rem;color:var(--text-muted)">${r.count}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem;padding:0 0.75rem">Overall average: ${overallAvg}/10</div>`;
}

// ─── SHAREABLE IMAGE CARD ───────────────────────────────

function generateShareCard() {
  const entries = getEntries();
  if (!entries.length) { alert('Add some entries first!'); return; }

  const now        = new Date();
  const monthName  = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthEntries = entries.filter(e => {
    const d = new Date(e.datetime);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const avg     = monthEntries.length ? +(monthEntries.reduce((s, e) => s + e.intensity, 0) / monthEntries.length).toFixed(1) : 0;
  const { streak } = calcStreak(entries);
  const catCount   = {};
  monthEntries.forEach(e => { catCount[e.category] = (catCount[e.category] || 0) + 1; });
  const topCat   = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
  const wellbeing = getWellbeingLabel(avg);

  // Build canvas
  const canvas  = document.createElement('canvas');
  canvas.width  = 800;
  canvas.height = 480;
  const ctx     = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 800, 480);
  grad.addColorStop(0,   '#0F0A1E');
  grad.addColorStop(0.5, '#1A1130');
  grad.addColorStop(1,   '#231A3D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 480);

  // Purple glow top-left
  const glow = ctx.createRadialGradient(100, 100, 0, 100, 100, 300);
  glow.addColorStop(0,   'rgba(124,58,237,0.25)');
  glow.addColorStop(1,   'rgba(124,58,237,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 800, 480);

  // Teal glow bottom-right
  const glow2 = ctx.createRadialGradient(700, 400, 0, 700, 400, 250);
  glow2.addColorStop(0,  'rgba(13,148,136,0.2)');
  glow2.addColorStop(1,  'rgba(13,148,136,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, 800, 480);

  // Logo text
  ctx.font        = 'bold 22px sans-serif';
  ctx.fillStyle   = '#A78BFA';
  ctx.fillText('MoodTrace', 48, 58);

  // Month
  ctx.font        = '14px sans-serif';
  ctx.fillStyle   = '#9B8FBF';
  ctx.fillText(monthName, 48, 80);

  // Divider line
  ctx.strokeStyle = 'rgba(167,139,250,0.2)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(48, 96);
  ctx.lineTo(752, 96);
  ctx.stroke();

  // Big mood score
  ctx.font        = 'bold 88px sans-serif';
  ctx.fillStyle   = '#A78BFA';
  ctx.fillText(`${avg}`, 48, 210);

  ctx.font        = '20px sans-serif';
  ctx.fillStyle   = '#9B8FBF';
  ctx.fillText('/ 10 average mood', 48, 240);

  ctx.font        = '18px sans-serif';
  ctx.fillStyle   = '#5EEAD4';
  ctx.fillText(wellbeing, 48, 272);

  // Stats row
  const stats = [
    { label: 'Entries', value: `${monthEntries.length}` },
    { label: 'Streak',  value: `${streak} days` },
    { label: 'Top Issue', value: topCat ? CATEGORY_LABELS[topCat[0]].replace(/[^\w\s]/gi,'').trim() : '—' }
  ];

  stats.forEach((s, i) => {
    const x = 48 + i * 240;
    // Card bg
    ctx.fillStyle   = 'rgba(167,139,250,0.08)';
    roundRect(ctx, x, 310, 210, 90, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(167,139,250,0.2)';
    ctx.lineWidth   = 1;
    roundRect(ctx, x, 310, 210, 90, 12);
    ctx.stroke();

    ctx.font        = 'bold 28px sans-serif';
    ctx.fillStyle   = '#F1EEF9';
    ctx.fillText(s.value, x + 16, 352);

    ctx.font        = '13px sans-serif';
    ctx.fillStyle   = '#9B8FBF';
    ctx.fillText(s.label, x + 16, 376);
  });

  // Footer
  ctx.font        = '13px sans-serif';
  ctx.fillStyle   = 'rgba(155,143,191,0.5)';
  ctx.fillText('Track your mood at MoodTrace', 48, 450);

  // Watermark bar
  ctx.fillStyle   = 'rgba(124,58,237,0.15)';
  ctx.fillRect(0, 458, 800, 22);
  ctx.font        = '11px sans-serif';
  ctx.fillStyle   = 'rgba(167,139,250,0.6)';
  ctx.fillText('your mood at a glance', 320, 473);

  // Download
  const link    = document.createElement('a');
  link.download = `moodtrace-${monthName.replace(' ', '-').toLowerCase()}.png`;
  link.href     = canvas.toDataURL('image/png');
  link.click();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── CUSTOMIZABLE COPING ACTIONS ────────────────────────

function getCustomCopingActions() {
  try { return JSON.parse(localStorage.getItem('moodtrace_custom_coping') || '[]'); }
  catch { return []; }
}

function saveCustomCopingActions(actions) {
  localStorage.setItem('moodtrace_custom_coping', JSON.stringify(actions));
}

function renderCustomCopingChips() {
  const container = document.getElementById('copingChips');
  if (!container) return;

  const custom = getCustomCopingActions();
  custom.forEach(action => {
    const exists = container.querySelector(`[data-action="${action.id}"]`);
    if (exists) return;
    const chip = document.createElement('div');
    chip.className        = 'coping-chip';
    chip.dataset.action   = action.id;
    chip.textContent      = action.label;
    chip.onclick          = () => toggleCoping(chip);
    container.appendChild(chip);
  });

  // Add custom button
  let addBtn = container.querySelector('.add-coping-btn');
  if (!addBtn) {
    addBtn = document.createElement('div');
    addBtn.className = 'coping-chip add-coping-btn';
    addBtn.style.borderStyle = 'dashed';
    addBtn.textContent = '＋ Add custom';
    addBtn.onclick     = openCustomCopingEditor;
    container.appendChild(addBtn);
  }
}

function openCustomCopingEditor() {
  const label = prompt('Enter your custom coping action (e.g. "🧘 Yoga"):');
  if (!label || !label.trim()) return;
  const custom = getCustomCopingActions();
  const id     = 'custom_' + Date.now();
  custom.push({ id, label: label.trim() });
  saveCustomCopingActions(custom);

  // Add to COPING_LABELS so it shows in history/analytics
  COPING_LABELS[id] = label.trim();
  renderCustomCopingChips();
}

// ─── SCHEDULED CHECK-INS ────────────────────────────────

function getCheckInTimes() {
  try { return JSON.parse(localStorage.getItem('moodtrace_checkins') || '[]'); }
  catch { return []; }
}

function saveCheckInTimes(times) {
  localStorage.setItem('moodtrace_checkins', JSON.stringify(times));
}

function renderCheckInManager() {
  const container = document.getElementById('checkInManager');
  if (!container) return;

  const times = getCheckInTimes();

  container.innerHTML = `
    <div style="margin-bottom:1rem">
      <div style="font-weight:600;font-size:0.9rem;margin-bottom:0.25rem">Scheduled Check-ins</div>
      <div style="font-size:0.78rem;color:var(--text-muted)">Get reminded to log your mood at specific times each day</div>
    </div>
    ${times.length ? times.map((t, i) => `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 1rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.5rem">
        <span style="font-size:1rem">⏰</span>
        <span style="font-weight:500;flex:1">${t}</span>
        <button onclick="removeCheckIn(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onmouseover="this.style.color='var(--pink-light)'" onmouseout="this.style.color='var(--text-muted)'">✕ remove</button>
      </div>`).join('') : `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem">No check-ins set yet.</div>`}
    <div style="display:flex;gap:0.75rem;margin-top:0.75rem;flex-wrap:wrap">
      <input type="time" id="newCheckInTime" class="form-input" style="flex:1;min-width:120px">
      <button class="btn btn-teal" onclick="addCheckIn()" style="flex-shrink:0">+ Add Time</button>
    </div>`;
}

function addCheckIn() {
  const input = document.getElementById('newCheckInTime');
  if (!input?.value) return;
  const times = getCheckInTimes();
  if (times.includes(input.value)) { alert('That time is already added.'); return; }
  if (times.length >= 5) { alert('Maximum 5 check-in times allowed.'); return; }
  times.push(input.value);
  times.sort();
  saveCheckInTimes(times);
  scheduleCheckIns();
  renderCheckInManager();
  input.value = '';
}

function removeCheckIn(index) {
  const times = getCheckInTimes();
  times.splice(index, 1);
  saveCheckInTimes(times);
  renderCheckInManager();
}

function scheduleCheckIns() {
  if (Notification.permission !== 'granted') return;
  const times = getCheckInTimes();
  if (!times.length) return;

  setInterval(() => {
    const now     = new Date();
    const current = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (times.includes(current)) {
      new Notification('MoodTrace ✏️', {
        body: "Time for your mood check-in! How are you feeling right now?",
        icon: 'moodtrace-logo.svg'
      });
    }
  }, 60000);
}

function checkCheckInsOnLoad() {
  if (Notification.permission === 'granted') scheduleCheckIns();
}

// ─── UPDATE PAGE INIT ────────────────────────────────────

// Extend the existing DOMContentLoaded — patch init for new pages
// Page-specific DOMContentLoaded handlers were moved to separate
// init-<page>.js files to keep app.js focused on shared utilities.
// See init-dashboard.js, init-add-entry.js, init-history.js, etc.

// ─── MEDIA ATTACHMENTS ────────────────────────────────────

let currentPhotoData = null; // Base64 string
let currentAudioBlob = null; // Blob
let mediaRecorder = null;
let audioChunks = [];

function handlePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      let scaleSize = 1;
      if (img.width > MAX_WIDTH) {
        scaleSize = MAX_WIDTH / img.width;
      }
      canvas.width = img.width * scaleSize;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      currentPhotoData = dataUrl;
      
      const preview = document.getElementById('photoPreview');
      const container = document.getElementById('photoPreviewContainer');
      const wrap = document.getElementById('mediaPreview');
      if (preview && container && wrap) {
        preview.src = dataUrl;
        container.style.display = 'block';
        wrap.style.display = 'flex';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearPhoto() {
  currentPhotoData = null;
  document.getElementById('photoUpload').value = '';
  document.getElementById('photoPreviewContainer').style.display = 'none';
  checkMediaPreviewEmpty();
}

async function toggleAudioRecording() {
  const btn = document.getElementById('recordAudioBtn');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    btn.innerHTML = '🎤 Record Voice';
    btn.style.color = '';
    btn.style.borderColor = '';
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(currentAudioBlob);
      const preview = document.getElementById('audioPreview');
      const container = document.getElementById('audioPreviewContainer');
      const wrap = document.getElementById('mediaPreview');
      
      if (preview && container && wrap) {
        preview.src = audioUrl;
        container.style.display = 'flex';
        wrap.style.display = 'flex';
      }
      
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    btn.innerHTML = '⏹️ Stop Recording';
    btn.style.color = 'var(--pink-light)';
    btn.style.borderColor = 'var(--pink-light)';
  } catch (e) {
    console.error("Audio recording failed", e);
    alert("Could not access microphone.");
  }
}

function clearAudio() {
  currentAudioBlob = null;
  document.getElementById('audioPreviewContainer').style.display = 'none';
  checkMediaPreviewEmpty();
}

function checkMediaPreviewEmpty() {
  if (!currentPhotoData && !currentAudioBlob) {
    document.getElementById('mediaPreview').style.display = 'none';
  }
}

async function uploadMediaFiles(entryId) {
  if (!window.currentUser || !window.storage) return {};
  const urls = {};
  
  if (currentPhotoData) {
    const photoRef = window.storage.ref(`users/${window.currentUser.uid}/entries/${entryId}_photo.jpg`);
    await photoRef.putString(currentPhotoData, 'data_url');
    urls.photoUrl = await photoRef.getDownloadURL();
  }
  
  if (currentAudioBlob) {
    const audioRef = window.storage.ref(`users/${window.currentUser.uid}/entries/${entryId}_audio.webm`);
    await audioRef.put(currentAudioBlob);
    urls.audioUrl = await audioRef.getDownloadURL();
  }
  
  return urls;
}

// ─── PIN & BIOMETRIC APP LOCK ────────────────────────────

window._enteredPin = '';
window._pinSetupStep = 1;
window._pinSetupTemp = '';
window._pinSetupInput = '';

async function hashPin(pin, salt) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode(pin + ':' + salt);
      const buffer = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('SubtleCrypto error, falling back:', e);
  }
  let hash = 0;
  const str = pin + ':' + salt;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'mt_' + Math.abs(hash).toString(16);
}

function generatePinSalt() {
  const arr = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function isBiometricsSupported() {
  try {
    if (window.PublicKeyCredential && 
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn('Biometric support check error:', e);
  }
  return false;
}

async function registerBiometric() {
  if (!window.PublicKeyCredential) throw new Error('Biometric authentication is not supported by your browser.');
  const challenge = new Uint8Array(32);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(userId);
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "MoodTrace" },
      user: {
        id: userId,
        name: "user@moodtrace.local",
        displayName: "MoodTrace User"
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" }
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required"
      },
      timeout: 60000
    }
  });

  if (credential && credential.id) {
    localStorage.setItem('moodtrace_lock_credential_id', credential.id);
    localStorage.setItem('moodtrace_lock_biometric_enabled', 'true');
    return true;
  }
  return false;
}

async function verifyBiometric() {
  const credId = localStorage.getItem('moodtrace_lock_credential_id');
  if (!credId || !window.PublicKeyCredential) return false;
  
  const challenge = new Uint8Array(32);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(challenge);
  
  let rawId;
  try {
    rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
  } catch {
    rawId = new TextEncoder().encode(credId);
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: rawId, type: 'public-key' }],
      userVerification: "required",
      timeout: 60000
    }
  });

  return !!assertion;
}

function isAppLocked() {
  if (localStorage.getItem('moodtrace_lock_enabled') !== 'true') return false;
  if (sessionStorage.getItem('moodtrace_unlocked') !== 'true') return true;

  const timeoutMin = parseInt(localStorage.getItem('moodtrace_lock_timeout') || '0', 10);
  const lastActive = parseInt(sessionStorage.getItem('moodtrace_last_active') || '0', 10);
  
  if (timeoutMin > 0 && lastActive && (Date.now() - lastActive > timeoutMin * 60 * 1000)) {
    sessionStorage.removeItem('moodtrace_unlocked');
    return true;
  }
  return false;
}

function recordLockActivity() {
  sessionStorage.setItem('moodtrace_last_active', String(Date.now()));
}

function showLockScreen() {
  window._enteredPin = '';
  let overlay = document.getElementById('appLockScreen');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'appLockScreen';
    overlay.className = 'app-lock-overlay';
    document.body.appendChild(overlay);
  }

  const bioEnabled = localStorage.getItem('moodtrace_lock_biometric_enabled') === 'true';

  overlay.innerHTML = `
    <div class="app-lock-card" id="appLockCard">
      <div class="app-lock-icon">🔒</div>
      <div class="app-lock-title">MoodTrace Protected</div>
      <div class="app-lock-sub">Enter your 4-digit PIN to unlock your private space</div>
      
      <div class="pin-dots-container" id="pinDotsWrap">
        <div class="pin-dot" id="pinDot0"></div>
        <div class="pin-dot" id="pinDot1"></div>
        <div class="pin-dot" id="pinDot2"></div>
        <div class="pin-dot" id="pinDot3"></div>
      </div>

      <div class="pin-error-msg" id="pinErrorMsg"></div>

      <div class="pin-keypad">
        <button class="pin-key" onclick="enterLockDigit('1')">1</button>
        <button class="pin-key" onclick="enterLockDigit('2')">2</button>
        <button class="pin-key" onclick="enterLockDigit('3')">3</button>
        <button class="pin-key" onclick="enterLockDigit('4')">4</button>
        <button class="pin-key" onclick="enterLockDigit('5')">5</button>
        <button class="pin-key" onclick="enterLockDigit('6')">6</button>
        <button class="pin-key" onclick="enterLockDigit('7')">7</button>
        <button class="pin-key" onclick="enterLockDigit('8')">8</button>
        <button class="pin-key" onclick="enterLockDigit('9')">9</button>
        ${bioEnabled ? `
          <button class="pin-key ghost" onclick="handleLockBiometricClick()" title="Unlock with Biometrics" aria-label="Biometrics">🌿</button>
        ` : `<div style="width:68px;height:68px"></div>`}
        <button class="pin-key" onclick="enterLockDigit('0')">0</button>
        <button class="pin-key ghost" onclick="deleteLockDigit()" title="Delete" aria-label="Delete">⌫</button>
      </div>

      ${bioEnabled ? `
        <div style="margin-top:1.5rem">
          <button class="btn btn-ghost" onclick="handleLockBiometricClick()" style="font-size:0.84rem;padding:0.4rem 1rem">
            🌿 Unlock with Biometrics
          </button>
        </div>
      ` : ''}

      <div style="margin-top:1.5rem;font-size:0.75rem;color:var(--text-muted)">
        Need help? <a href="#" onclick="handleForgotPin(event)" style="color:var(--purple-light);text-decoration:underline">Forgot PIN?</a>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updatePinDots();

  if (bioEnabled) {
    setTimeout(() => {
      handleLockBiometricClick();
    }, 400);
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pinDot${i}`);
    if (dot) {
      if (i < window._enteredPin.length) dot.classList.add('filled');
      else dot.classList.remove('filled');
    }
  }
}

async function enterLockDigit(d) {
  if (window._enteredPin.length >= 4) return;
  window._enteredPin += d;
  updatePinDots();
  const errMsg = document.getElementById('pinErrorMsg');
  if (errMsg) errMsg.textContent = '';

  if (window._enteredPin.length === 4) {
    const entered = window._enteredPin;
    const storedHash = localStorage.getItem('moodtrace_lock_pin_hash');
    const storedSalt = localStorage.getItem('moodtrace_lock_pin_salt') || '';
    
    const computedHash = await hashPin(entered, storedSalt);
    if (computedHash === storedHash) {
      unlockApp();
    } else {
      const card = document.getElementById('appLockCard');
      if (card) {
        card.classList.remove('pin-shake');
        void card.offsetWidth;
        card.classList.add('pin-shake');
      }
      if (errMsg) errMsg.textContent = 'Incorrect PIN. Please try again.';
      setTimeout(() => {
        window._enteredPin = '';
        updatePinDots();
      }, 400);
    }
  }
}

function deleteLockDigit() {
  if (window._enteredPin.length > 0) {
    window._enteredPin = window._enteredPin.slice(0, -1);
    updatePinDots();
  }
  const errMsg = document.getElementById('pinErrorMsg');
  if (errMsg) errMsg.textContent = '';
}

async function handleLockBiometricClick() {
  const errMsg = document.getElementById('pinErrorMsg');
  try {
    const success = await verifyBiometric();
    if (success) {
      unlockApp();
    }
  } catch (e) {
    console.warn('Biometric verify failed or cancelled:', e);
    if (errMsg && e.name !== 'NotAllowedError') {
      errMsg.textContent = 'Biometric verification unavailable. Use your PIN.';
    }
  }
}

function unlockApp() {
  sessionStorage.setItem('moodtrace_unlocked', 'true');
  sessionStorage.setItem('moodtrace_last_active', String(Date.now()));
  const overlay = document.getElementById('appLockScreen');
  if (overlay) {
    overlay.style.display = 'none';
  }
  document.body.style.overflow = '';
}

function lockAppNow() {
  sessionStorage.removeItem('moodtrace_unlocked');
  showLockScreen();
}

function handleForgotPin(e) {
  e.preventDefault();
  if (confirm("Forgot your PIN?\n\nTo protect your privacy, resetting your PIN requires confirming that you want to disable App Lock on this device. Your mood data will remain intact.\n\nDisable App Lock now?")) {
    localStorage.removeItem('moodtrace_lock_enabled');
    localStorage.removeItem('moodtrace_lock_pin_hash');
    localStorage.removeItem('moodtrace_lock_pin_salt');
    localStorage.removeItem('moodtrace_lock_biometric_enabled');
    localStorage.removeItem('moodtrace_lock_credential_id');
    unlockApp();
    alert("App Lock has been disabled. You can set up a new PIN anytime in Settings.");
    if (window.location.pathname.endsWith('settings.html')) {
      location.reload();
    }
  }
}

function initAppLock() {
  if (isAppLocked()) {
    showLockScreen();
  }

  window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('appLockScreen');
    if (!overlay || overlay.style.display === 'none') return;

    if (e.key >= '0' && e.key <= '9') {
      enterLockDigit(e.key);
    } else if (e.key === 'Backspace') {
      deleteLockDigit();
    }
  });

  const handleActivity = () => {
    recordLockActivity();
  };
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
    window.addEventListener(evt, handleActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      recordLockActivity();
      const timeoutMin = parseInt(localStorage.getItem('moodtrace_lock_timeout') || '0', 10);
      if (timeoutMin === 0 && localStorage.getItem('moodtrace_lock_enabled') === 'true') {
        sessionStorage.removeItem('moodtrace_unlocked');
      }
    } else {
      if (isAppLocked()) {
        showLockScreen();
      }
    }
  });
}

// ─── PIN SETUP IN SETTINGS ────────────────────────────────

function openPinSetupModal() {
  window._pinSetupStep = 1;
  window._pinSetupTemp = '';
  window._pinSetupInput = '';

  let modal = document.getElementById('pinSetupModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pinSetupModal';
    modal.className = 'digest-modal-backdrop';
    document.body.appendChild(modal);
  }

  renderPinSetupStep();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePinSetupModal() {
  const modal = document.getElementById('pinSetupModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function renderPinSetupStep() {
  const modal = document.getElementById('pinSetupModal');
  if (!modal) return;
  const isConfirm = window._pinSetupStep === 2;

  modal.innerHTML = `
    <div class="digest-card" style="max-width:380px;text-align:center">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div class="digest-step-indicator">${isConfirm ? 'Step 2 of 2' : 'Step 1 of 2'}</div>
        <button onclick="closePinSetupModal()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.3rem" aria-label="Close">✕</button>
      </div>

      <div class="app-lock-icon">${isConfirm ? '🔐' : '🔑'}</div>
      <div class="digest-step-title" style="font-size:1.35rem">
        ${isConfirm ? 'Confirm Your 4-Digit PIN' : 'Create a 4-Digit PIN'}
      </div>
      <div class="digest-step-sub" style="margin-bottom:1.5rem">
        ${isConfirm ? 'Re-enter your PIN to verify.' : 'Choose a 4-digit code you can easily remember.'}
      </div>

      <div class="pin-dots-container">
        <div class="pin-dot" id="setupPinDot0"></div>
        <div class="pin-dot" id="setupPinDot1"></div>
        <div class="pin-dot" id="setupPinDot2"></div>
        <div class="pin-dot" id="setupPinDot3"></div>
      </div>

      <div class="pin-error-msg" id="setupPinError"></div>

      <div class="pin-keypad">
        <button class="pin-key" onclick="enterSetupDigit('1')">1</button>
        <button class="pin-key" onclick="enterSetupDigit('2')">2</button>
        <button class="pin-key" onclick="enterSetupDigit('3')">3</button>
        <button class="pin-key" onclick="enterSetupDigit('4')">4</button>
        <button class="pin-key" onclick="enterSetupDigit('5')">5</button>
        <button class="pin-key" onclick="enterSetupDigit('6')">6</button>
        <button class="pin-key" onclick="enterSetupDigit('7')">7</button>
        <button class="pin-key" onclick="enterSetupDigit('8')">8</button>
        <button class="pin-key" onclick="enterSetupDigit('9')">9</button>
        <div style="width:68px;height:68px"></div>
        <button class="pin-key" onclick="enterSetupDigit('0')">0</button>
        <button class="pin-key ghost" onclick="deleteSetupDigit()" title="Delete">⌫</button>
      </div>
    </div>
  `;

  updateSetupDots();
}

function updateSetupDots() {
  const len = (window._pinSetupInput || '').length;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`setupPinDot${i}`);
    if (dot) {
      if (i < len) dot.classList.add('filled');
      else dot.classList.remove('filled');
    }
  }
}

async function enterSetupDigit(d) {
  if (!window._pinSetupInput) window._pinSetupInput = '';
  if (window._pinSetupInput.length >= 4) return;
  window._pinSetupInput += d;
  updateSetupDots();
  const err = document.getElementById('setupPinError');
  if (err) err.textContent = '';

  if (window._pinSetupInput.length === 4) {
    if (window._pinSetupStep === 1) {
      window._pinSetupTemp = window._pinSetupInput;
      window._pinSetupInput = '';
      window._pinSetupStep = 2;
      setTimeout(() => {
        renderPinSetupStep();
      }, 250);
    } else {
      if (window._pinSetupInput === window._pinSetupTemp) {
        const salt = generatePinSalt();
        const hash = await hashPin(window._pinSetupInput, salt);
        localStorage.setItem('moodtrace_lock_pin_salt', salt);
        localStorage.setItem('moodtrace_lock_pin_hash', hash);
        localStorage.setItem('moodtrace_lock_enabled', 'true');
        sessionStorage.setItem('moodtrace_unlocked', 'true');
        sessionStorage.setItem('moodtrace_last_active', String(Date.now()));

        closePinSetupModal();
        alert('✅ 4-Digit PIN created and App Lock enabled!');
        if (typeof renderAppLockSettings === 'function') renderAppLockSettings();
      } else {
        if (err) err.textContent = "PINs didn't match. Let's try again.";
        setTimeout(() => {
          window._pinSetupStep = 1;
          window._pinSetupTemp = '';
          window._pinSetupInput = '';
          renderPinSetupStep();
        }, 800);
      }
    }
  }
}

function deleteSetupDigit() {
  if (window._pinSetupInput && window._pinSetupInput.length > 0) {
    window._pinSetupInput = window._pinSetupInput.slice(0, -1);
    updateSetupDots();
  }
}

async function renderAppLockSettings() {
  const container = document.getElementById('appLockSettingsContainer');
  if (!container) return;

  const isEnabled = localStorage.getItem('moodtrace_lock_enabled') === 'true';
  const bioEnabled = localStorage.getItem('moodtrace_lock_biometric_enabled') === 'true';
  const timeout = localStorage.getItem('moodtrace_lock_timeout') || '0';
  const bioAvailable = await isBiometricsSupported();

  if (isEnabled) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
        <div>
          <div style="font-weight:600;font-size:0.95rem;display:flex;align-items:center;gap:0.5rem">
            <span>🔒 App Lock is Active</span>
            <span style="font-size:0.75rem;padding:0.2rem 0.5rem;background:rgba(16,185,129,0.15);color:var(--teal-light);border-radius:100px;border:1px solid rgba(16,185,129,0.3)">Enabled</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem">Your journal notes and mood data are protected on this device.</div>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-ghost" onclick="openPinSetupModal()" style="font-size:0.82rem;padding:0.45rem 0.9rem">Change PIN</button>
          <button class="btn btn-ghost" onclick="lockAppNow()" style="font-size:0.82rem;padding:0.45rem 0.9rem">🔒 Lock Now</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:0.9rem;border-top:1px solid var(--border);padding-top:1rem">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem">
          <div>
            <div style="font-weight:500;font-size:0.88rem">Auto-Lock When Idle</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">Choose when the lock screen appears</div>
          </div>
          <select id="lockTimeoutSelect" class="form-input" style="padding:0.4rem 0.75rem;font-size:0.85rem;width:auto" onchange="handleLockTimeoutChange(this.value)">
            <option value="0" ${timeout === '0' ? 'selected' : ''}>Immediately upon leaving / tab switch</option>
            <option value="1" ${timeout === '1' ? 'selected' : ''}>After 1 minute of inactivity</option>
            <option value="5" ${timeout === '5' ? 'selected' : ''}>After 5 minutes of inactivity</option>
            <option value="15" ${timeout === '15' ? 'selected' : ''}>After 15 minutes of inactivity</option>
          </select>
        </div>

        ${bioAvailable ? `
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;border-top:1px solid var(--border);padding-top:0.9rem">
            <div>
              <div style="font-weight:500;font-size:0.88rem">🌿 Biometric Unlock</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">Unlock with Face ID, Fingerprint, or Windows Hello</div>
            </div>
            <label style="position:relative;display:inline-block;width:44px;height:24px">
              <input type="checkbox" id="lockBioToggle" ${bioEnabled ? 'checked' : ''} onchange="handleBiometricToggle(this.checked)" style="opacity:0;width:0;height:0">
              <span style="position:absolute;cursor:pointer;inset:0;background:${bioEnabled ? 'var(--purple)' : 'var(--surface2)'};border-radius:24px;transition:0.3s"></span>
            </label>
          </div>
        ` : ''}

        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;border-top:1px solid var(--border);padding-top:0.9rem">
          <div>
            <div style="font-weight:500;font-size:0.88rem;color:var(--pink-light)">Turn Off App Lock</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">Disable privacy lock on this device</div>
          </div>
          <button class="btn btn-ghost" onclick="disableAppLock()" style="border-color:var(--pink-light);color:var(--pink-light);font-size:0.82rem;padding:0.4rem 0.85rem">Turn Off</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div>
          <div style="font-weight:600;font-size:0.95rem">Protect with PIN &amp; Biometrics</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.25rem">Keep vulnerable thoughts, private journal notes, and history safe from curious eyes on shared devices.</div>
        </div>
        <button class="btn btn-teal" onclick="openPinSetupModal()">🔑 Enable App Lock</button>
      </div>
    `;
  }
}

function handleLockTimeoutChange(val) {
  localStorage.setItem('moodtrace_lock_timeout', val);
}

async function handleBiometricToggle(checked) {
  if (checked) {
    try {
      const ok = await registerBiometric();
      if (ok) {
        alert('✅ Biometric authentication linked successfully!');
      } else {
        localStorage.removeItem('moodtrace_lock_biometric_enabled');
      }
    } catch (e) {
      alert('Could not register biometrics: ' + (e.message || e));
      localStorage.removeItem('moodtrace_lock_biometric_enabled');
    }
  } else {
    localStorage.removeItem('moodtrace_lock_biometric_enabled');
    localStorage.removeItem('moodtrace_lock_credential_id');
  }
  renderAppLockSettings();
}

function disableAppLock() {
  if (confirm("Are you sure you want to turn off App Lock?")) {
    localStorage.removeItem('moodtrace_lock_enabled');
    localStorage.removeItem('moodtrace_lock_pin_hash');
    localStorage.removeItem('moodtrace_lock_pin_salt');
    localStorage.removeItem('moodtrace_lock_biometric_enabled');
    localStorage.removeItem('moodtrace_lock_credential_id');
    sessionStorage.removeItem('moodtrace_unlocked');
    renderAppLockSettings();
  }
}

// ─── CLINICAL / THERAPY PDF REPORT GENERATOR ─────────────

function computeClinicalReportData(daysRange = 30) {
  const allEntries = getEntries();
  const now = new Date();
  let entries = [];

  if (daysRange === 'all' || daysRange >= 9999) {
    entries = [...allEntries];
  } else {
    const cutoff = new Date(now.getTime() - daysRange * 24 * 60 * 60 * 1000);
    entries = allEntries.filter(e => new Date(e.datetime) >= cutoff);
  }

  entries.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const total = entries.length;
  if (!total) {
    return {
      entries,
      totalCount: 0,
      daysTracked: 0,
      meanMood: 0,
      sd: 0,
      labilityText: 'Insufficient Data',
      spectrum: { 
        severe: { count: 0, pct: 0 }, 
        mild: { count: 0, pct: 0 }, 
        euthymic: { count: 0, pct: 0 }, 
        elevated: { count: 0, pct: 0 } 
      },
      triggers: [],
      copingEfficacy: [],
      sleepAnalysis: { avgSleep: 0, delta: 0, hasData: false }
    };
  }

  const uniqueDays = new Set(entries.map(e => new Date(e.datetime).toDateString())).size;

  const scores = entries.map(e => e.intensity);
  const mean = scores.reduce((a, b) => a + b, 0) / total;
  const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / total;
  const sd = Math.sqrt(variance);

  let labilityText = 'Stable Affective Baseline';
  if (sd > 2.0) {
    labilityText = 'High Affective Lability (Elevated Fluctuations)';
  } else if (sd >= 1.2) {
    labilityText = 'Moderate Affective Variability';
  }

  let severeCount = 0, mildCount = 0, euthymicCount = 0, elevatedCount = 0;
  entries.forEach(e => {
    if (e.intensity <= 2) severeCount++;
    else if (e.intensity <= 4) mildCount++;
    else if (e.intensity <= 7) euthymicCount++;
    else elevatedCount++;
  });

  const spectrum = {
    severe: { count: severeCount, pct: Math.round((severeCount / total) * 100) },
    mild: { count: mildCount, pct: Math.round((mildCount / total) * 100) },
    euthymic: { count: euthymicCount, pct: Math.round((euthymicCount / total) * 100) },
    elevated: { count: elevatedCount, pct: Math.round((elevatedCount / total) * 100) }
  };

  const catCount = {};
  entries.forEach(e => {
    const c = e.category || 'general';
    catCount[c] = (catCount[c] || 0) + 1;
  });
  const triggers = Object.entries(catCount).map(([cat, cnt]) => ({
    category: cat,
    label: getCategoryLabel(cat),
    count: cnt,
    pct: Math.round((cnt / total) * 100)
  })).sort((a, b) => b.count - a.count);

  const copingMap = {};
  entries.forEach(e => {
    if (Array.isArray(e.copingActions)) {
      e.copingActions.forEach(act => {
        if (!copingMap[act]) copingMap[act] = { count: 0, helpedScores: [], moodScoresWith: [] };
        copingMap[act].count++;
        if (e.helped) copingMap[act].helpedScores.push(e.helped);
        copingMap[act].moodScoresWith.push(e.intensity);
      });
    }
  });

  const copingEfficacy = Object.entries(copingMap).map(([act, d]) => {
    const avgHelped = d.helpedScores.length ? +(d.helpedScores.reduce((a, b) => a + b, 0) / d.helpedScores.length).toFixed(1) : 0;
    const avgWith = d.moodScoresWith.reduce((a, b) => a + b, 0) / d.moodScoresWith.length;
    const entriesWithout = entries.filter(e => !e.copingActions?.includes(act));
    const avgWithout = entriesWithout.length ? entriesWithout.map(e => e.intensity).reduce((a, b) => a + b, 0) / entriesWithout.length : mean;
    const diffPct = Math.round(((avgWith - avgWithout) / avgWithout) * 100);

    return {
      action: act,
      label: COPING_LABELS[act] || act,
      count: d.count,
      avgHelped,
      avgWith: +avgWith.toFixed(1),
      diffPct
    };
  }).sort((a, b) => b.count - a.count);

  const withSleep = entries.filter(e => typeof e.sleepHours === 'number' && e.sleepHours > 0);
  let sleepAnalysis = { avgSleep: 0, delta: 0, goodAvg: 0, poorAvg: 0, hasData: false };
  if (withSleep.length >= 2) {
    const avgSleep = +(withSleep.reduce((a, b) => a + b.sleepHours, 0) / withSleep.length).toFixed(1);
    const goodSleep = withSleep.filter(e => e.sleepHours >= 7);
    const poorSleep = withSleep.filter(e => e.sleepHours < 7);
    const goodAvg = goodSleep.length ? +(goodSleep.reduce((a, b) => a + b.intensity, 0) / goodSleep.length).toFixed(1) : 0;
    const poorAvg = poorSleep.length ? +(poorSleep.reduce((a, b) => a + b.intensity, 0) / poorSleep.length).toFixed(1) : 0;
    const delta = (goodAvg && poorAvg) ? Math.round(((goodAvg - poorAvg) / poorAvg) * 100) : 0;

    sleepAnalysis = {
      avgSleep,
      goodAvg,
      poorAvg,
      delta,
      hasData: true
    };
  }

  return {
    entries,
    totalCount: total,
    daysTracked: uniqueDays,
    meanMood: +mean.toFixed(1),
    sd: +sd.toFixed(2),
    labilityText,
    spectrum,
    triggers,
    copingEfficacy,
    sleepAnalysis
  };
}

function openClinicalReportModal() {
  let modal = document.getElementById('clinicalReportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clinicalReportModal';
    modal.className = 'clinical-modal-backdrop';
    document.body.appendChild(modal);
  }

  const patientName = localStorage.getItem('moodtrace_user_name') || 'Anonymous Patient';

  modal.innerHTML = `
    <div class="clinical-modal-card">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:1rem">
        <div>
          <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--teal-light)">Clinical Documentation</div>
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.35rem">Therapy &amp; Clinical PDF Report</div>
        </div>
        <button onclick="closeClinicalReportModal()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.3rem" aria-label="Close">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:1rem;margin-top:1.25rem;background:var(--bg3);padding:1rem 1.25rem;border-radius:var(--radius-sm);border:1px solid var(--border)">
        <div>
          <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem">Timeframe</label>
          <select id="clinicalTimeframeSelect" class="form-input" style="padding:0.45rem 0.75rem;font-size:0.85rem" onchange="renderClinicalPreview()">
            <option value="7">Past 7 Days</option>
            <option value="14" selected>Past 14 Days (Standard Therapy)</option>
            <option value="30">Past 30 Days (Monthly Review)</option>
            <option value="90">Past 90 Days (Quarterly)</option>
            <option value="all">All Available History</option>
          </select>
        </div>

        <div>
          <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem">Patient Identifier / Name</label>
          <input type="text" id="clinicalPatientName" class="form-input" value="${escHtml(patientName)}" style="padding:0.45rem 0.75rem;font-size:0.85rem" oninput="renderClinicalPreview()">
        </div>

        <div>
          <label style="display:block;font-size:0.78rem;color:var(--text-muted);margin-bottom:0.3rem">Provider / Clinic (Optional)</label>
          <input type="text" id="clinicalProviderName" class="form-input" placeholder="e.g. Dr. Jane Smith" style="padding:0.45rem 0.75rem;font-size:0.85rem" oninput="renderClinicalPreview()">
        </div>

        <div style="display:flex;align-items:center;padding-top:1.2rem">
          <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;cursor:pointer">
            <input type="checkbox" id="clinicalIncludeNotes" checked onchange="renderClinicalPreview()">
            <span>Include patient notes</span>
          </label>
        </div>
      </div>

      <div class="clinical-preview-wrap" id="clinicalReportPreview">
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:1rem;gap:1rem;flex-wrap:wrap">
        <div style="font-size:0.8rem;color:var(--text-muted)">
          🔒 Formatted for direct medical and psychotherapeutic consultation.
        </div>
        <div style="display:flex;gap:0.75rem">
          <button class="btn btn-ghost" onclick="closeClinicalReportModal()">Cancel</button>
          <button class="btn btn-primary" onclick="generateAndPrintClinicalReport()">🖨️ Print / Save as PDF</button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderClinicalPreview();
}

function closeClinicalReportModal() {
  const modal = document.getElementById('clinicalReportModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function renderClinicalPreview() {
  const preview = document.getElementById('clinicalReportPreview');
  if (!preview) return;

  const tf = document.getElementById('clinicalTimeframeSelect')?.value || '14';
  const range = tf === 'all' ? 'all' : parseInt(tf, 10);
  const patient = document.getElementById('clinicalPatientName')?.value.trim() || 'Anonymous Patient';
  const provider = document.getElementById('clinicalProviderName')?.value.trim() || 'Licensed Healthcare Practitioner';
  const includeNotes = document.getElementById('clinicalIncludeNotes')?.checked ?? true;

  const data = computeClinicalReportData(range);
  const html = buildClinicalDocumentHtml(data, patient, provider, tf, includeNotes);
  preview.innerHTML = html;
}

function buildClinicalDocumentHtml(data, patient, provider, tfLabel, includeNotes) {
  const genDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const periodText = tfLabel === 'all' ? 'Entire Recorded History' : `Past ${tfLabel} Days`;

  return `
    <div style="color:#0f172a;line-height:1.45;font-size:13px;max-width:760px;margin:0 auto">
      <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569">CONFIDENTIAL HEALTHCARE RECORD</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">MoodTrace Clinical Affect &amp; Mood Report</div>
          <div style="font-size:12px;color:#475569;margin-top:2px">Structured Diagnostic &amp; Therapy Summary</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#334155">
          <div><strong>Patient:</strong> ${escHtml(patient)}</div>
          <div><strong>Provider:</strong> ${escHtml(provider)}</div>
          <div><strong>Generated:</strong> ${genDate}</div>
          <div><strong>Period:</strong> ${periodText}</div>
        </div>
      </div>

      <div style="background:#f1f5f9;border:1px solid #cbd5e1;padding:8px 12px;border-radius:4px;font-size:10px;color:#475569;margin-bottom:16px;line-height:1.4">
        ⚖️ <strong>CLINICAL NOTICE:</strong> This document compiles patient-recorded mood assessments, affective stability markers, and intervention outcomes. Prepared strictly for diagnostic, psychotherapeutic, and psychiatric review.
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px">
          1. Affective Baseline &amp; Stability Metrics
        </div>

        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:12px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;text-align:center">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Mean Mood Score</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a">${data.meanMood} <span style="font-size:11px;color:#64748b;font-weight:400">/ 10</span></div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${data.meanMood >= 6 ? 'Positive Affect Range' : 'Depressed/Stressed Range'}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;text-align:center">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Affective Lability (SD)</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a">±${data.sd}</div>
            <div style="font-size:9px;font-weight:700;color:${data.sd > 2.0 ? '#b91c1c' : '#047857'}">${data.labilityText}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;text-align:center">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Total Observations</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a">${data.totalCount}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">Across ${data.daysTracked} tracked day${data.daysTracked > 1 ? 's' : ''}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;text-align:center">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Logging Frequency</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a">${data.daysTracked ? (data.totalCount / data.daysTracked).toFixed(1) : 0}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">entries / day</div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;border-radius:6px">
          <div style="font-size:11px;font-weight:700;color:#334155;margin-bottom:6px">Affect Spectrum Distribution:</div>
          <div style="display:flex;height:12px;border-radius:4px;overflow:hidden;margin-bottom:8px;background:#e2e8f0">
            <div style="width:${data.spectrum.severe.pct}%;background:#ef4444" title="Severe Low"></div>
            <div style="width:${data.spectrum.mild.pct}%;background:#f97316" title="Mild Low"></div>
            <div style="width:${data.spectrum.euthymic.pct}%;background:#10b981" title="Euthymic"></div>
            <div style="width:${data.spectrum.elevated.pct}%;background:#6366f1" title="Elevated"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#475569;flex-wrap:wrap;gap:6px">
            <span>🔴 Severe Low (1-2): <strong>${data.spectrum.severe.count}</strong> (${data.spectrum.severe.pct}%)</span>
            <span>🟠 Mild Low (3-4): <strong>${data.spectrum.mild.count}</strong> (${data.spectrum.mild.pct}%)</span>
            <span>🟢 Euthymic (5-7): <strong>${data.spectrum.euthymic.count}</strong> (${data.spectrum.euthymic.pct}%)</span>
            <span>🟣 Elevated (8-10): <strong>${data.spectrum.elevated.count}</strong> (${data.spectrum.elevated.pct}%)</span>
          </div>
        </div>
      </div>

      <div style="margin-bottom:18px;page-break-inside:avoid">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px">
          2. Coping Intervention &amp; Action Efficacy Table
        </div>

        ${data.copingEfficacy && data.copingEfficacy.length ? `
          <table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #e2e8f0">
            <thead>
              <tr style="background:#f1f5f9;color:#334155;text-align:left">
                <th style="padding:6px 10px;border-bottom:1px solid #cbd5e1">Action / Modality</th>
                <th style="padding:6px 10px;border-bottom:1px solid #cbd5e1">Usage Frequency</th>
                <th style="padding:6px 10px;border-bottom:1px solid #cbd5e1">Helpfulness Rating (1-5★)</th>
                <th style="padding:6px 10px;border-bottom:1px solid #cbd5e1">Mean Mood with Action</th>
                <th style="padding:6px 10px;border-bottom:1px solid #cbd5e1">Calculated Mood Lift</th>
              </tr>
            </thead>
            <tbody>
              ${data.copingEfficacy.map(c => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:6px 10px;font-weight:600;color:#0f172a">${c.label}</td>
                  <td style="padding:6px 10px;color:#475569">${c.count} time${c.count > 1 ? 's' : ''}</td>
                  <td style="padding:6px 10px;color:#0f172a">${c.avgHelped ? c.avgHelped + ' ★' : '—'}</td>
                  <td style="padding:6px 10px;color:#475569">${c.avgWith}/10</td>
                  <td style="padding:6px 10px;font-weight:700;color:${c.diffPct >= 0 ? '#047857' : '#b91c1c'}">
                    ${c.diffPct >= 0 ? '+' : ''}${c.diffPct}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div style="padding:10px;font-size:11px;color:#64748b;font-style:italic">No coping interventions recorded during this period.</div>
        `}
      </div>

      <div style="margin-bottom:18px;page-break-inside:avoid">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px">
          3. Sleep &amp; Somatic Correlation
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px">
            <div style="font-weight:700;font-size:11px;color:#0f172a;margin-bottom:4px">🛌 Sleep Duration Impact</div>
            ${data.sleepAnalysis.hasData ? `
              <div style="font-size:11px;color:#334155;line-height:1.4">
                Average Sleep: <strong>${data.sleepAnalysis.avgSleep} hours</strong><br>
                Days with ≥7h sleep average <strong>${data.sleepAnalysis.goodAvg}/10</strong> vs <strong>${data.sleepAnalysis.poorAvg}/10</strong> on &lt;7h nights.
                <div style="margin-top:4px;font-weight:700;color:${data.sleepAnalysis.delta >= 0 ? '#047857' : '#b91c1c'}">
                  Impact: ${data.sleepAnalysis.delta >= 0 ? '+' : ''}${data.sleepAnalysis.delta}% mood differential from sleep.
                </div>
              </div>
            ` : `
              <div style="font-size:11px;color:#64748b">Insufficient sleep data logged in this timeframe.</div>
            `}
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px">
            <div style="font-weight:700;font-size:11px;color:#0f172a;margin-bottom:4px">📊 Primary Stressor Categories</div>
            <div style="font-size:11px;color:#334155;line-height:1.4">
              ${data.triggers.slice(0, 3).map(t => `
                <div>• ${t.label}: <strong>${t.count}</strong> logs (${t.pct}%)</div>
              `).join('') || '<span style="color:#64748b">No category data.</span>'}
            </div>
          </div>
        </div>
      </div>

      ${includeNotes ? `
        <div style="margin-bottom:20px;page-break-before:auto">
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px">
            4. Detailed Chronological Affect &amp; Notes Log
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:10.5px;border:1px solid #e2e8f0">
            <thead>
              <tr style="background:#f1f5f9;color:#334155;text-align:left">
                <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:80px">Date/Time</th>
                <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:55px">Score</th>
                <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:75px">Trigger</th>
                <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1;width:95px">Coping Action</th>
                <th style="padding:6px 8px;border-bottom:1px solid #cbd5e1">Patient Notes &amp; Observations</th>
              </tr>
            </thead>
            <tbody>
              ${data.entries.slice(-25).map(e => {
                const dt = formatDate(e.datetime);
                const scoreColor = e.intensity <= 3 ? '#b91c1c' : e.intensity <= 5 ? '#d97706' : '#047857';
                return `
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:5px 8px;color:#475569">${dt.date}<br><span style="font-size:9px;color:#94a3b8">${dt.time}</span></td>
                    <td style="padding:5px 8px;font-weight:700;color:${scoreColor}">${e.intensity}/10 ${e.emoji || ''}</td>
                    <td style="padding:5px 8px;color:#334155">${getCategoryLabel(e.category)}</td>
                    <td style="padding:5px 8px;color:#475569">${(e.copingActions || []).map(a => COPING_LABELS[a] || a).join(', ') || '—'}</td>
                    <td style="padding:5px 8px;color:#0f172a;font-style:${e.description ? 'normal' : 'italic'}">${escHtml(e.description || '(No verbatim notes)')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${data.entries.length > 25 ? `
            <div style="font-size:10px;color:#64748b;margin-top:4px;text-align:right">
              Showing recent 25 of ${data.entries.length} entries for clinical brevity.
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="margin-top:24px;border-top:2px dashed #94a3b8;padding-top:16px;page-break-inside:avoid">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;margin-bottom:8px">
          5. Clinician Consultation &amp; Treatment Plan Notes
        </div>
        <div style="font-size:10px;color:#64748b;margin-bottom:12px">
          For the attending therapist or medical provider to document observations, therapeutic interventions, or medication adjustments:
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div style="border:1px solid #cbd5e1;border-radius:4px;height:70px;padding:6px;font-size:10px;color:#94a3b8">
            Mental Status Exam (MSE) &amp; Clinical Impressions:
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:4px;height:70px;padding:6px;font-size:10px;color:#94a3b8">
            Treatment Plan Modifications / Medication Changes:
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;color:#334155;padding-top:12px">
          <div>Clinician Signature: ___________________________</div>
          <div>Date: ________________</div>
          <div>Next Appointment: ________________</div>
        </div>
      </div>

      <div style="margin-top:20px;border-top:1px solid #cbd5e1;padding-top:8px;display:flex;justify-content:space-between;font-size:9.5px;color:#64748b">
        <span>MoodTrace Clinical Health Suite • Client-Side Secure Export</span>
        <span>Page 1 of 1 • Strictly Confidential</span>
      </div>
    </div>
  `;
}

function generateAndPrintClinicalReport() {
  const tf = document.getElementById('clinicalTimeframeSelect')?.value || '14';
  const range = tf === 'all' ? 'all' : parseInt(tf, 10);
  const patient = document.getElementById('clinicalPatientName')?.value.trim() || 'Anonymous Patient';
  const provider = document.getElementById('clinicalProviderName')?.value.trim() || 'Licensed Healthcare Practitioner';
  const includeNotes = document.getElementById('clinicalIncludeNotes')?.checked ?? true;

  const data = computeClinicalReportData(range);
  const bodyHtml = buildClinicalDocumentHtml(data, patient, provider, tf, includeNotes);

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert("Please allow popups to open the printable PDF report.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>MoodTrace Clinical Report — ${escHtml(patient)}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm 15mm 15mm;
        }
        body {
          margin: 0;
          padding: 20px;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
        button.print-bar-btn {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 20px;margin:-20px -20px 20px -20px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:#334155;font-weight:600">🖨️ Ready to Print / Save as PDF</span>
        <button class="print-bar-btn" onclick="window.print()">Print Document</button>
      </div>
      ${bodyHtml}
      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.print();
          }, 350);
        });
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Auto initialize App Lock on all pages
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppLock);
} else {
  initAppLock();
}

