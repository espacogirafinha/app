import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadServiceWorker() {
  const source = await fs.readFile(
    new URL("../artifacts/girafinha/public/sw.js", import.meta.url),
    "utf8",
  );
  const handlers = new Map();
  const notifications = [];
  const navigations = [];
  const context = {
    self: {
      skipWaiting() {},
      clients: {
        claim() {},
        async matchAll() {
          return [
            {
              async focus() {},
              async navigate(url) {
                navigations.push(url);
              },
            },
          ];
        },
        async openWindow(url) {
          navigations.push(url);
        },
      },
      registration: {
        async showNotification(title, options) {
          notifications.push({ title, options });
        },
      },
      addEventListener(type, handler) {
        handlers.set(type, handler);
      },
    },
  };
  vm.runInNewContext(source, context);
  return { handlers, notifications, navigations };
}

test("push event displays privacy-safe payload", async () => {
  const { handlers, notifications } = await loadServiceWorker();
  let wait;
  handlers.get("push")({
    data: {
      json: () => ({
        title: "Nova reserva recebida",
        body: "05/11/2026 · Pack Essencial",
        url: "/venue-events?open=event-1",
        tag: "notification-1",
      }),
    },
    waitUntil(value) {
      wait = value;
    },
  });
  await wait;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "Nova reserva recebida");
  assert.equal(notifications[0].options.body, "05/11/2026 · Pack Essencial");
});

test("notification click focuses app and navigates to deep link", async () => {
  const { handlers, navigations } = await loadServiceWorker();
  let wait;
  handlers.get("notificationclick")({
    notification: {
      data: { url: "/google-forms-review?open=import-1" },
      close() {},
    },
    waitUntil(value) {
      wait = value;
    },
  });
  await wait;
  assert.deepEqual(navigations, ["/google-forms-review?open=import-1"]);
});
