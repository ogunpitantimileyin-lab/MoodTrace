// storage.js — small abstraction for settings and custom categories
(function(){
  function getCustomCategoriesLocal() {
    try { return JSON.parse(localStorage.getItem('moodtrace_custom_cats') || '{}'); }
    catch { return {}; }
  }

  const api = {
    getCustomCategories() {
      if (window.currentUser && window.firestoreCustomCatsCache) return window.firestoreCustomCatsCache || {};
      return getCustomCategoriesLocal();
    },

    saveCustomCategories(categories) {
      if (window.currentUser && window.db) {
        return window.db.collection('users').doc(window.currentUser.uid).collection('settings').doc('categories').set(categories);
      }
      localStorage.setItem('moodtrace_custom_cats', JSON.stringify(categories));
    },

    addCustomCategory(id, label, emoji) {
      const cats = api.getCustomCategories() || {};
      cats[id] = { label, emoji };
      return api.saveCustomCategories(cats);
    },

    deleteCustomCategory(id) {
      const cats = api.getCustomCategories() || {};
      if (cats && cats[id]) delete cats[id];
      return api.saveCustomCategories(cats);
    }
    ,
    // Entries
    getEntries() {
      if (window.currentUser && window.firestoreEntriesCache) return window.firestoreEntriesCache || [];
      try { return JSON.parse(localStorage.getItem('moodtrace_entries') || '[]'); } catch { return []; }
    },

    saveEntries(entries) {
      if (window.currentUser && window.db) {
        // Persist all entries to Firestore (overwrites by id)
        const batch = window.db.batch ? window.db.batch() : null;
        if (batch) {
          const userRef = window.db.collection('users').doc(window.currentUser.uid);
          entries.forEach(e => {
            const docRef = userRef.collection('entries').doc(String(e.id));
            batch.set(docRef, e);
          });
          return batch.commit().catch(()=>{});
        }
        // Fallback: write individually
        const userRef2 = window.db.collection('users').doc(window.currentUser.uid);
        const promises = entries.map(e => userRef2.collection('entries').doc(String(e.id)).set(e));
        return Promise.all(promises).catch(()=>{});
      }
      localStorage.setItem('moodtrace_entries', JSON.stringify(entries || []));
    },

    addEntry(entry) {
      entry.id = entry.id || Date.now();
      entry.createdAt = entry.createdAt || new Date().toISOString();
      entry.updatedAt = entry.updatedAt || entry.createdAt;
      entry.history = entry.history || [];
      if (window.currentUser && window.db) {
        return window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(entry.id)).set(entry).then(()=>entry).catch(()=>entry);
      }
      const entries = api.getEntries();
      entries.unshift(entry);
      api.saveEntries(entries);
      return entry;
    },

    updateEntry(id, updates) {
      const entries = api.getEntries();
      const existing = entries.find(e => e.id === id || String(e.id) === String(id));
      if (!existing) return null;
      const before = { ...existing };
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      if (JSON.stringify(before) !== JSON.stringify(updated)) {
        updated.history = [...(existing.history || []), { changedAt: new Date().toISOString(), snapshot: before }];
      }
      if (window.currentUser && window.db) {
        return window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(id)).set(updated).then(()=>updated).catch(()=>updated);
      }
      const next = entries.map(e => (String(e.id) === String(id) ? updated : e));
      api.saveEntries(next);
      return updated;
    },

    deleteEntry(id) {
      const entries = api.getEntries();
      const entry = entries.find(e => String(e.id) === String(id));
      if (!entry) return null;
      if (window.currentUser && window.db) {
        return window.db.collection('users').doc(window.currentUser.uid).collection('entries').doc(String(id)).delete().then(()=>entry).catch(()=>entry);
      }
      const next = entries.filter(e => String(e.id) !== String(id));
      api.saveEntries(next);
      return entry;
    },

    // Goals
    getGoals() {
      if (window.currentUser && window.firestoreGoalsCache) return window.firestoreGoalsCache || {};
      try { return JSON.parse(localStorage.getItem('moodtrace_goals') || '{}'); } catch { return {}; }
    },

    saveGoals(goals) {
      if (window.currentUser && window.db) {
        return window.db.collection('users').doc(window.currentUser.uid).collection('settings').doc('goals').set(goals).catch(()=>{});
      }
      localStorage.setItem('moodtrace_goals', JSON.stringify(goals || {}));
    }
  };

  window.storageAPI = api;
})();
