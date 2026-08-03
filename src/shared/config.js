import { t } from "./i18n.js";

export const STORAGE_KEY = "headersConfig";
export const DEFAULT_FONT = "ComicShannsMono Nerd Font, Hannotate SC";

export function createDefaultConfig() {
  return {
    version: 1,
    enabled: true,
    activeSpaceId: "feature-a",
    spaces: [
      {
        id: "feature-a",
        name: "Feature A",
        headers: [
          { id: "feature-env", enabled: true, key: "x-tt-env", value: "feature_a" },
          { id: "feature-language", enabled: true, key: "accept-language", value: "zh-CN" },
          { id: "feature-debug", enabled: false, key: "x-debug-mode", value: "true" }
        ]
      },
      {
        id: "ppe",
        name: "PPE",
        headers: [
          { id: "ppe-enabled", enabled: true, key: "x-use-ppe", value: "1" }
        ]
      },
      {
        id: "daily",
        name: t("defaultSpaceDaily"),
        headers: []
      }
    ],
    predefinedKeys: ["x-tt-env", "x-use-ppe", "x-debug-mode", "accept-language"],
    ignoredDomains: ["*.google.com", "analytics-*.example.com"],
    appearance: {
      theme: "system",
      fontFamily: DEFAULT_FONT
    }
  };
}

export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createHeader() {
  return {
    id: createId("header"),
    enabled: true,
    key: "",
    value: ""
  };
}

export function createSpace(name) {
  return {
    id: createId("space"),
    name,
    headers: []
  };
}

export function normalizeConfig(value) {
  const defaults = createDefaultConfig();
  const config = value && typeof value === "object" ? value : defaults;
  const spaces = Array.isArray(config.spaces) && config.spaces.length > 0
    ? config.spaces.map((space) => ({
        id: String(space.id || createId("space")),
        name: String(space.name || t("unnamedSpace")),
        headers: Array.isArray(space.headers)
          ? space.headers.map((header) => ({
              id: String(header.id || createId("header")),
              enabled: Boolean(header.enabled),
              key: String(header.key || ""),
              value: String(header.value ?? "")
            }))
          : []
      }))
    : defaults.spaces;

  const activeSpaceId = spaces.some((space) => space.id === config.activeSpaceId)
    ? config.activeSpaceId
    : spaces[0].id;

  return {
    version: 1,
    enabled: config.enabled !== false,
    activeSpaceId,
    spaces,
    predefinedKeys: Array.isArray(config.predefinedKeys)
      ? config.predefinedKeys.map(String)
      : defaults.predefinedKeys,
    ignoredDomains: Array.isArray(config.ignoredDomains)
      ? config.ignoredDomains.map(String)
      : defaults.ignoredDomains,
    appearance: {
      theme: ["system", "light", "dark"].includes(config.appearance?.theme)
        ? config.appearance.theme
        : defaults.appearance.theme,
      fontFamily: String(config.appearance?.fontFamily || DEFAULT_FONT)
    }
  };
}

export function getActiveSpace(config) {
  return config.spaces.find((space) => space.id === config.activeSpaceId) || config.spaces[0];
}

export function applyAppearance(appearance) {
  const theme = appearance?.theme || "system";
  const fontFamily = appearance?.fontFamily || DEFAULT_FONT;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty(
    "--app-font",
    `${fontFamily}, ui-monospace, monospace`
  );
}
