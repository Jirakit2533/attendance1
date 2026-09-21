"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { firebaseApp } from "./firebase";

export async function registerPushNotification() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!("Notification" in window)) {
    console.error("Browser ไม่รองรับ Notification");
    return null;
  }

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    console.log("ผู้ใช้ไม่อนุญาต Notification");
    return null;
  }

  const registration =
    await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

  const messaging = getMessaging(firebaseApp);

  const token = await getToken(messaging, {
    vapidKey:
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  console.log("FCM Token:", token);

  return token;
}