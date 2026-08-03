import { STORAGE_KEY } from "../shared/config.js";
import { getConfig } from "../shared/storage.js";
import { buildDynamicRules } from "../shared/rules.js";

let syncQueue = Promise.resolve();

async function syncRules() {
  const config = await getConfig();
  const { rules, errors } = buildDynamicRules(config);
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRules.map((rule) => rule.id),
    addRules: rules
  });
  return { ok: true, errors };
}

function scheduleSync() {
  const task = syncQueue.then(syncRules);
  syncQueue = task.catch(() => undefined);
  return task;
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleSync();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleSync();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    scheduleSync();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "sync-rules") return false;
  scheduleSync()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
