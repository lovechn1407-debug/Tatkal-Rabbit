import './assets/service-worker.ts-DpeeiJGi.js';

// Real-time Cloud Auth & Subscription Sync from Web Client
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "TATKAL_AUTH_SYNC") {
    const dataToSave = {
      tatkal_auth_user: msg.user,
      tatkal_subscription: msg.subscription
    };
    if (msg.pricing) {
      dataToSave.tatkal_custom_pricing = msg.pricing;
    }
    chrome.storage.local.set(dataToSave, () => {
      sendResponse({ ok: true, message: "Tatkal Rabbit extension unlocked successfully!" });
    });
    return true;
  }
});

