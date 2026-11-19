/* global importScripts, firebase */
// Web push receiver for Memskool. The app registers this worker with its public Firebase
// web config in the query string (the same values that ship in the page bundle), so no
// secrets live here. Pushes are sent by the app server (Admin SDK) — see
// src/lib/notifications.server.ts `sendPushToUsers`.
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  // Notification payloads are displayed by the SDK while the app is in the background;
  // `fcmOptions.link` opens the right page on click.
  firebase.messaging();
}

self.addEventListener("notificationclick", (event) => {
  const link = event.notification?.data?.FCM_MSG?.data?.link || event.notification?.data?.link;
  if (!link) return;
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin) && "focus" in win) {
          win.navigate(link);
          return win.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
