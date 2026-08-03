import { STORAGE_KEY, createDefaultConfig, normalizeConfig } from "./config.js";

export async function getConfig() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    const config = createDefaultConfig();
    await saveConfig(config);
    return config;
  }
  return normalizeConfig(stored[STORAGE_KEY]);
}

export async function saveConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeConfig(config) });
}
