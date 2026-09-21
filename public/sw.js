// /public/sw.js
console.log("✅ Service Worker loaded");

self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  event.waitUntil(self.clients.claim());
});

// 📨 รับข้อความจาก client และแสดง notification
self.addEventListener("message", (event) => {
  console.log("📨 Service Worker received message:", event.data);

  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;

    self.registration.showNotification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...options,
    });
  }
});

// 🚀 ดึงข้อมูลจาก server (push notifications)
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "แจ้งเตือนการลงเวลา",
      body: event.data?.text() || "",
    };
  }

  const title = data.title || "แจ้งเตือนการลงเวลา";

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/employee",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🖱️ จัดการการคลิก notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/employee";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientList) => {
      // หาหน้าต่างเดิมที่เปิดอยู่
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }

      // ถ้าไม่มี เปิดหน้าต่างใหม่
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});