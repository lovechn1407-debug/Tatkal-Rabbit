import './assets/service-worker.ts-DpeeiJGi.js';

// Real-time Cloud Auth & Subscription Sync from Web Client
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "TATKAL_AUTH_SYNC") {
    chrome.storage.local.set({
      tatkal_auth_user: msg.user,
      tatkal_subscription: msg.subscription
    }, () => {
      sendResponse({ ok: true, message: "Tatkal Rabbit extension unlocked successfully!" });
    });
    return true;
  }
});

