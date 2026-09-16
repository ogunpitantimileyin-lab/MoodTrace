// storage.js — Offline-first abstraction for entries, journal, settings, and cloud sync
(function(){
  function getCustomCategoriesLocal() {
    try { return JSON.parse(localStorage.getItem('moodtrace_custom_cats') || '{}'); }
    catch { return {}; }
  }

  function getLocalEntries() {
    try { return JSON.parse(localStorage.getItem('moodtrace_entries') || '[]'); }
    catch { return []; }
  }

  function getLocalJournal() {
    try { return JSON.parse(localStorage.getItem('moodtrace_journal') || '[]'); }
    catch { return []; }
  }

  const api = {
    // Custom Categories
    getCustomCategories() {
      if (window.currentUser && window.firestoreCustomCatsCache) return window.firestoreCustomCatsCache;
      return getCustomCategoriesLocal();
    },

    saveCustomCategories(categories) {
      if (window.currentUser) window.firestoreCustomCatsCache = categories;
      localStorage.setItem('moodtrace_custom_cats', JSON.stringify(categories || {}));
      if (window.currentUser && window.db) {
        window.db.collection('users').doc(window.currentUser.uid).collection('settings').doc('categories').set(categories).catch(err => {
          console.warn('Firestore categories save error:', err);
        });
      }
      return categories;
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
    },

    // Entries
    getEntries() {
      if (window.currentUser && window.firestoreEntriesCache) return window.firestoreEntriesCache;
      return getLocalEntries();
    },

    saveEntries(entries) {
      const list = Array.isArray(entries) ? entries : [];
      if (window.currentUser) window.firestoreEntriesCache = list;
      localStorage.setItem('moodtrace_entries', JSON.stringify(list));

      if (window.currentUser && window.db) {
        const batch = window.db.batch ? window.db.batch() : null;
        if (batch) {
          const userRef = window.db.collection('users').doc(window.currentUser.uid);
          list.forEach(e => {
            const docRef = userRef.collection('entries').doc(String(e.id));
            batch.set(docRef, e);
          });
          return batch.commit().catch(err => console.warn('Batch commit error:', err));
        }
        const userRef2 = window.db.collection('users').doc(window.currentUser.uid);
        const promises = list.map(e => userRef2.collection('entries').doc(String(e.id)).set(e));
        return Promise.all(promises).catch(err => console.warn('Write error:', err));
      }
      return Promise.resolve(list);
    },

    addEntry(entry) {
      entry.id = entry.id || Date.now();
      entry.createdAt = entry.createdAt || new Date().toISOString();
      entry.updatedAt = entry.updatedAt || entry.createdAt;
      entry.history = entry.history || [];

      const current = api.getEntries();
      const next = [entry, ...current.filter(e => String(e.id) !== String(entry.id))];

      if (window.currentUser) window.firestoreEntriesCache = next;
      localStorage.setItem('moodtrace_entries', JSON.stringify(next));

      if (window.currentUser && window.db) {
        window.db.collection('users').doc(window.currentUser.uid)
          .collection('entries').doc(String(entry.id))
          .set(entry)
          .catch(err => console.warn('Firestore entry add error:', err));
      }
      return entry;
    },

    updateEntry(id, updates) {
      const entries = api.getEntries();
      const existing = entries.find(e => String(e.id) === String(id));
      if (!existing) return null;

      const before = { ...existing };
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      if (JSON.stringify(before) !== JSON.stringify(updated)) {
        updated.history = [...(existing.history || []), { changedAt: new Date().toISOString(), snapshot: before }];
      }

      const next = entries.map(e => (String(e.id) === String(id) ? updated : e));
      if (window.currentUser) window.firestoreEntriesCache = next;
      localStorage.setItem('moodtrace_entries', JSON.stringify(next));

      if (window.currentUser && window.db) {
        window.db.collection('users').doc(window.currentUser.uid)
          .collection('entries').doc(String(id))
          .set(updated)
          .catch(err => console.warn('Firestore entry update error:', err));
      }
      return updated;
    },

    deleteEntry(id) {
      const entries = api.getEntries();
      const entry = entries.find(e => String(e.id) === String(id));
      if (!entry) return null;

      const next = entries.filter(e => String(e.id) !== String(id));
      if (window.currentUser) window.firestoreEntriesCache = next;
      localStorage.setItem('moodtrace_entries', JSON.stringify(next));

      if (window.currentUser && window.db) {
        window.db.collection('users').doc(window.currentUser.uid)
          .collection('entries').doc(String(id))
          .delete()
          .catch(err => console.warn('Firestore entry delete error:', err));
      }
      return entry;
    },

    // Journal Entries
    getJournalEntries() {
      if (window.currentUser && window.firestoreJournalCache) return window.firestoreJournalCache;
      return getLocalJournal();
    },

    saveJournalEntries(entries) {
      const list = Array.isArray(entries) ? entries : [];
      if (window.currentUser) window.firestoreJournalCache = list;
      localStorage.setItem('moodtrace_journal', JSON.stringify(list));

      if (window.currentUser && window.db) {
        const batch = window.db.batch ? window.db.batch() : null;
        if (batch) {
          const userRef = window.db.collection('users').doc(window.currentUser.uid);
          list.forEach(j => {
            const docRef = userRef.collection('journal').doc(String(j.id));
            batch.set(docRef, j);
          });
          batch.commit().catch(err => console.warn('Journal batch save error:', err));
        }
      }
      return list;
    },

    addJournalEntry(journalEntry) {
      journalEntry.id = journalEntry.id || Date.now();
      journalEntry.createdAt = journalEntry.createdAt || new Date().toISOString();
      const list = api.getJournalEntries();
      const next = [journalEntry, ...list.filter(j => String(j.id) !== String(journalEntry.id))];
      return api.saveJournalEntries(next);
    },

    // Goals
    getGoals() {
      if (window.currentUser && window.firestoreGoalsCache) return window.firestoreGoalsCache;
      try { return JSON.parse(localStorage.getItem('moodtrace_goals') || '{}'); } catch { return {}; }
    },

    saveGoals(goals) {
      if (window.currentUser) window.firestoreGoalsCache = goals;
      localStorage.setItem('moodtrace_goals', JSON.stringify(goals || {}));
      if (window.currentUser && window.db) {
        window.db.collection('users').doc(window.currentUser.uid)
          .collection('settings').doc('goals')
          .set(goals)
          .catch(err => console.warn('Firestore goals save error:', err));
      }
      return goals;
    },

    // Full Cloud <-> Local Bi-directional Sync
    async syncWithCloud(user) {
      if (!user || !window.db) return { success: false, reason: 'No user or database' };
      try {
        const userDocRef = window.db.collection('users').doc(user.uid);

        // 1. Sync Entries
        const cloudSnap = await userDocRef.collection('entries').get();
        const cloudEntries = [];
        cloudSnap.forEach(doc => cloudEntries.push(doc.data()));

        const localEntries = getLocalEntries();
        const mergedMap = new Map();

        // Add cloud entries first
        cloudEntries.forEach(e => { if (e && e.id) mergedMap.set(String(e.id), e); });

        // Merge local entries: if local has entries not in cloud, or newer
        const toUpload = [];
        localEntries.forEach(localE => {
          if (!localE || !localE.id) return;
          const key = String(localE.id);
          const cloudE = mergedMap.get(key);
          if (!cloudE) {
            mergedMap.set(key, localE);
            toUpload.push(localE);
          } else {
            const localUpdated = new Date(localE.updatedAt || localE.createdAt || 0).getTime();
            const cloudUpdated = new Date(cloudE.updatedAt || cloudE.createdAt || 0).getTime();
            if (localUpdated > cloudUpdated) {
              mergedMap.set(key, localE);
              toUpload.push(localE);
            }
          }
        });

        // Batch upload any missing local entries to cloud
        if (toUpload.length > 0 && window.db.batch) {
          const batch = window.db.batch();
          toUpload.forEach(item => {
            const docRef = userDocRef.collection('entries').doc(String(item.id));
            batch.set(docRef, item);
          });
          await batch.commit().catch(e => console.warn('Batch upload failed:', e));
        }

        const mergedEntries = Array.from(mergedMap.values()).sort((a, b) => {
          return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
        });

        window.firestoreEntriesCache = mergedEntries;
        localStorage.setItem('moodtrace_entries', JSON.stringify(mergedEntries));

        // 2. Sync Goals
        try {
          const goalsDoc = await userDocRef.collection('settings').doc('goals').get();
          if (goalsDoc.exists) {
            window.firestoreGoalsCache = goalsDoc.data();
            localStorage.setItem('moodtrace_goals', JSON.stringify(goalsDoc.data()));
          } else {
            const localGoals = api.getGoals();
            if (Object.keys(localGoals).length > 0) {
              await userDocRef.collection('settings').doc('goals').set(localGoals);
              window.firestoreGoalsCache = localGoals;
            }
          }
        } catch (e) { console.warn('Goals sync issue:', e); }

        // 3. Sync Categories
        try {
          const catDoc = await userDocRef.collection('settings').doc('categories').get();
          if (catDoc.exists) {
            window.firestoreCustomCatsCache = catDoc.data();
            localStorage.setItem('moodtrace_custom_cats', JSON.stringify(catDoc.data()));
          } else {
            const localCats = api.getCustomCategories();
            if (Object.keys(localCats).length > 0) {
              await userDocRef.collection('settings').doc('categories').set(localCats);
              window.firestoreCustomCatsCache = localCats;
            }
          }
        } catch (e) { console.warn('Categories sync issue:', e); }

        localStorage.setItem('moodtrace_last_synced', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('moodtrace-synced', { detail: { count: mergedEntries.length } }));
        if (typeof triggerAppRerender === 'function') triggerAppRerender();

        return { success: true, count: mergedEntries.length };
      } catch (err) {
        console.error('Cloud sync error:', err);
        return { success: false, error: err };
      }
    }
  };

  window.storageAPI = api;
})();
