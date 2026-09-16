// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyDLayPndsrSgoaW2Voz08BWUTISRwtYKnU",
  authDomain: "moodtrace-fa9b3.firebaseapp.com",
  projectId: "moodtrace-fa9b3",
  storageBucket: "moodtrace-fa9b3.firebasestorage.app",
  messagingSenderId: "972782820639",
  appId: "1:972782820639:web:dd6b8fe31caadd5722e42a"
};

// Initialize Firebase with Auth, Firestore, and Storage
firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();
window.messaging = null;

try {
  if (firebase.messaging && firebase.messaging.isSupported()) {
    window.messaging = firebase.messaging();
  }
} catch (e) {
  console.log("Firebase Messaging not supported", e);
}

// Enable offline persistence (best-effort)
if (window.db && typeof window.db.enablePersistence === 'function') {
  window.db.enablePersistence()
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, offline persistence disabled for this tab');
      } else if (err.code == 'unimplemented') {
        console.warn('Browser does not support offline persistence');
      }
    });
}

window.currentUser = null;
window.firestoreEntriesCache = null;
window.firestoreGoalsCache = null;
window.firestoreCustomCatsCache = null;

function triggerAppRerender() {
  const page = document.body && document.body.dataset && document.body.dataset.page;
  if (!page) return;
  if (page === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
  if (page === 'history' && typeof renderHistory === 'function') renderHistory();
  if (page === 'analytics' && typeof renderAnalytics === 'function') renderAnalytics();
  if (page === 'journal' && typeof renderJournalEntries === 'function') renderJournalEntries();
}
