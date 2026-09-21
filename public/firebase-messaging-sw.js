importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "ค่าจาก NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "ค่าจาก NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "ค่าจาก NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "ค่าจาก NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "ค่าจาก NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "ค่าจาก NEXT_PUBLIC_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Background message:",
    payload
  );

  const title =
    payload.notification?.title || "แจ้งเตือน";

  const options = {
    body: payload.notification?.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };

  self.registration.showNotification(
    title,
    options
  );
});