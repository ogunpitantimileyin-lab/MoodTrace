// firebase-messaging-sw.js
// This service worker handles background FCM push messages.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDLayPndsrSgoaW2Voz08BWUTISRwtYKnU",
  authDomain: "moodtrace-fa9b3.firebaseapp.com",
  projectId: "moodtrace-fa9b3",
  storageBucket: "moodtrace-fa9b3.firebasestorage.app",
  messagingSenderId: "972782820639",
  appId: "1:972782820639:web:dd6b8fe31caadd5722e42a"
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'MoodTrace', {
    body: body || "Time to log your mood! 📝",
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'moodtrace-reminder',
    renotify: true,
    actions: [
      { action: 'log', title: 'Log Mood' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'log' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('add-entry.html') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/add-entry.html');
        }
      })
    );
  }
});
