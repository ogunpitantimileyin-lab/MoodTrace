// auth.js — Authentication service, session manager, and UI binder for MoodTrace
(function() {
  'use strict';

  const auth = window.auth || (window.firebase && window.firebase.auth ? window.firebase.auth() : null);

  function getFriendlyError(err) {
    if (!err) return 'An unknown error occurred.';
    const code = err.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up first.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completing.';
      case 'auth/cancelled-popup-request':
        return 'Popup sign-in was cancelled.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled in the Firebase console. Please enable it in Authentication -> Sign-in method.';
      case 'auth/operation-not-supported-in-this-environment':
        return 'Google Sign-In cannot run directly from a file:// URL. Please run via a local server (http://localhost) or test on your hosted Vercel deployment (https://).';
      default:
        return err.message || 'Authentication error. Please try again.';
    }
  }

  const api = {
    auth,

    getCurrentUser() {
      return window.currentUser || (auth ? auth.currentUser : null);
    },

    isGuest() {
      return !api.getCurrentUser() && localStorage.getItem('moodtrace_guest_mode') === 'true';
    },

    setGuestMode(active) {
      if (active) {
        localStorage.setItem('moodtrace_guest_mode', 'true');
      } else {
        localStorage.removeItem('moodtrace_guest_mode');
      }
      api.updateNavAuthUI();
    },

    async signUp(email, password, displayName) {
      if (!auth) throw new Error('Firebase Auth is not available.');
      const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
      const user = cred.user;

      if (displayName && displayName.trim()) {
        await user.updateProfile({ displayName: displayName.trim() }).catch(e => console.warn(e));
      }

      // Save user record to Firestore
      if (window.db) {
        try {
          await window.db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            displayName: displayName ? displayName.trim() : (user.email.split('@')[0]),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn('Could not create user document:', e);
        }
      }

      api.setGuestMode(false);
      if (window.storageAPI && typeof window.storageAPI.syncWithCloud === 'function') {
        await window.storageAPI.syncWithCloud(user);
      }
      return user;
    },

    async signIn(email, password) {
      if (!auth) throw new Error('Firebase Auth is not available.');
      const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
      const user = cred.user;
      api.setGuestMode(false);

      if (window.storageAPI && typeof window.storageAPI.syncWithCloud === 'function') {
        await window.storageAPI.syncWithCloud(user);
      }
      return user;
    },

    async signInWithGoogle() {
      if (!auth) throw new Error('Firebase Auth is not available.');
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await auth.signInWithPopup(provider);
      const user = cred.user;

      if (window.db) {
        try {
          await window.db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn('Google user doc save error:', e);
        }
      }

      api.setGuestMode(false);
      if (window.storageAPI && typeof window.storageAPI.syncWithCloud === 'function') {
        await window.storageAPI.syncWithCloud(user);
      }
      return user;
    },

    async signOut() {
      if (!auth) return;
      await auth.signOut();
      window.currentUser = null;
      window.firestoreEntriesCache = null;
      window.firestoreGoalsCache = null;
      window.firestoreCustomCatsCache = null;
      api.setGuestMode(true);
      api.updateNavAuthUI();
      window.dispatchEvent(new CustomEvent('moodtrace-auth-changed', { detail: { user: null } }));
      if (typeof triggerAppRerender === 'function') triggerAppRerender();
    },

    async sendPasswordReset(email) {
      if (!auth) throw new Error('Firebase Auth is not available.');
      return auth.sendPasswordResetEmail(email.trim());
    },

    async updateProfile(updates) {
      const user = api.getCurrentUser();
      if (!user) throw new Error('No authenticated user.');
      await user.updateProfile(updates);
      if (window.db) {
        await window.db.collection('users').doc(user.uid).set({
          ...updates,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      api.updateNavAuthUI();
      return user;
    },

    updateNavAuthUI() {
      const user = api.getCurrentUser();
      const isGuest = api.isGuest();

      // Top nav profile pill
      const navAvatar = document.getElementById('navProfileAvatar');
      const navName   = document.getElementById('navProfileName');
      const navBtn    = document.getElementById('navProfileBtn');

      if (navAvatar && navName) {
        if (user) {
          const name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
          navName.textContent = name;
          navAvatar.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : '👤';
          if (navBtn) {
            navBtn.classList.add('logged-in');
            navBtn.title = `Signed in as ${user.email}`;
          }
        } else if (isGuest) {
          navName.textContent = 'Guest';
          navAvatar.textContent = '📴';
          if (navBtn) {
            navBtn.classList.remove('logged-in');
            navBtn.title = 'Guest Mode (Offline). Click to sign in or create account.';
          }
        } else {
          navName.textContent = 'Log In';
          navAvatar.textContent = '👤';
          if (navBtn) {
            navBtn.classList.remove('logged-in');
            navBtn.title = 'Sign in or create account';
          }
        }
      }

      // If page has a custom auth UI hook (e.g. settings.html or profile.html)
      if (typeof window.updateAuthUI === 'function') {
        window.updateAuthUI();
      }
    },

    getFriendlyError
  };

  // Listen to Firebase auth state changes
  if (auth) {
    auth.onAuthStateChanged(async (user) => {
      window.currentUser = user || null;
      if (user) {
        localStorage.removeItem('moodtrace_guest_mode');
        if (window.storageAPI) {
          if (typeof window.storageAPI.initRealtimeSync === 'function') {
            window.storageAPI.initRealtimeSync(user);
          }
          if (typeof window.storageAPI.syncWithCloud === 'function') {
            await window.storageAPI.syncWithCloud(user).catch(err => {
              console.warn('Initial cloud sync notice:', err);
            });
          }
        }
      }
      api.updateNavAuthUI();
      window.dispatchEvent(new CustomEvent('moodtrace-auth-changed', { detail: { user } }));
      if (typeof triggerAppRerender === 'function') triggerAppRerender();
    });
  }

  // Also update UI when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    api.updateNavAuthUI();
  });

  window.authAPI = api;
})();
