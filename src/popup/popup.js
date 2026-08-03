import {
  applyAppearance,
  createHeader,
  createSpace,
  getActiveSpace
} from "../shared/config.js";
import { localizeDocument, t } from "../shared/i18n.js";
import { HEADER_NAME_PATTERN, isValidDomainPattern } from "../shared/rules.js";
import { getConfig, saveConfig } from "../shared/storage.js";

localizeDocument();

const elements = {
  mainView: document.querySelector("#mainView"),
  settingsView: document.querySelector("#settingsView"),
  globalEnabled: document.querySelector("#globalEnabled"),
  statusDot: document.querySelector("#statusDot"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  spaceTabs: document.querySelector("#spaceTabs"),
  headerList: document.querySelector("#headerList"),
  addHeader: document.querySelector("#addHeader"),
  addSpace: document.querySelector("#addSpace"),
  openSettings: document.querySelector("#openSettings"),
  backToMain: document.querySelector("#backToMain"),
  saveStatus: document.querySelector("#saveStatus"),
  keyList: document.querySelector("#keyList"),
  addKey: document.querySelector("#addKey"),
  themeToggle: document.querySelector("#themeToggle"),
  themeLabel: document.querySelector("#themeLabel"),
  themeMenu: document.querySelector("#themeMenu"),
  fontFamily: document.querySelector("#fontFamily"),
  domainList: document.querySelector("#domainList"),
  addDomain: document.querySelector("#addDomain")
};

let config = await getConfig();
let saveTimer;

function createTrashIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(namespace, "path");
  path.setAttribute(
    "d",
    "M3.5 4.5h9M6 4.5V3h4v1.5m-5.5 0 .6 8.5h5.8l.6-8.5M6.5 7v3.5M9.5 7v3.5"
  );
  svg.append(path);
  return svg;
}

function closeHeaderKeyMenus() {
  for (const menu of document.querySelectorAll(".header-key-menu:not([hidden])")) {
    menu.hidden = true;
    menu.parentElement.querySelector(".header-key-toggle")?.setAttribute("aria-expanded", "false");
  }
}

function closeThemeMenu() {
  elements.themeMenu.hidden = true;
  elements.themeToggle.setAttribute("aria-expanded", "false");
}

function closeMenus() {
  closeHeaderKeyMenus();
  closeThemeMenu();
}

function render() {
  applyAppearance(config.appearance);
  elements.globalEnabled.checked = config.enabled;
  renderStatus();
  renderSpaces();
  renderHeaders();
}

function renderStatus(message, isError = false) {
  const activeSpace = getActiveSpace(config);
  elements.statusDot.className = "status-dot";
  elements.runtimeStatus.className = "runtime-status";
  if (isError) {
    elements.statusDot.classList.add("error");
    elements.runtimeStatus.classList.add("error");
    elements.runtimeStatus.textContent = message;
    return;
  }
  if (!config.enabled) {
    elements.statusDot.classList.add("off");
    elements.runtimeStatus.classList.add("inactive");
  }
  elements.runtimeStatus.textContent = message || (
    config.enabled ? t("activeSpaceStatus", [activeSpace.name]) : t("rulesPaused")
  );
}

function renderSpaces() {
  elements.spaceTabs.replaceChildren();
  for (const space of config.spaces) {
    const item = document.createElement("div");
    item.className = "space-tab-item";
    item.dataset.spaceId = space.id;
    item.classList.add(`space-color-${getSpaceColorIndex(space.id)}`);
    item.classList.toggle("active", space.id === config.activeSpaceId);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "space-tab-select";
    select.role = "tab";
    select.ariaSelected = String(space.id === config.activeSpaceId);
    select.textContent = space.name;
    select.addEventListener("click", async () => {
      if (config.activeSpaceId === space.id) return;
      config.activeSpaceId = space.id;
      updateSpaceSelection();
      renderStatus();
      renderHeaders();
      await persistNow();
    });
    select.addEventListener("dblclick", (event) => {
      event.preventDefault();
      beginSpaceRename(item, space);
    });
    item.append(select);

    if (config.spaces.length > 1) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "space-tab-close";
      close.setAttribute("aria-label", t("deleteSpace", [space.name]));
      close.textContent = "×";
      close.addEventListener("click", async () => {
        await deleteSpace(space.id);
      });
      item.append(close);
    }
    elements.spaceTabs.append(item);
  }
}

function updateSpaceSelection() {
  for (const item of elements.spaceTabs.querySelectorAll(".space-tab-item")) {
    const selected = item.dataset.spaceId === config.activeSpaceId;
    item.classList.toggle("active", selected);
    item.querySelector(".space-tab-select")?.setAttribute("aria-selected", String(selected));
  }
}

function beginSpaceRename(item, space) {
  if (item.querySelector(".rename-space-input")) return;
  item.classList.add("editing-space-tab");
  item.replaceChildren();

  const input = document.createElement("input");
  input.className = "rename-space-input";
  input.value = space.name;
  input.maxLength = 32;
  input.setAttribute("aria-label", t("renameSpace", [space.name]));
  let settled = false;

  const finish = async (save) => {
    if (settled) return;
    settled = true;
    const name = input.value.trim();
    if (save && name) {
      space.name = name;
      renderStatus();
      renderHeaders();
      await persistNow();
    }
    renderSpaces();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void finish(true);
    if (event.key === "Escape") void finish(false);
  });
  input.addEventListener("blur", () => void finish(true));
  item.append(input);
  input.focus();
  input.select();
}

function getSpaceColorIndex(spaceId) {
  let hash = 0;
  for (const character of spaceId) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash % 6) + 1;
}

function beginSpaceCreation() {
  const existingInput = elements.spaceTabs.querySelector(".new-space-input");
  if (existingInput) {
    existingInput.focus();
    return;
  }

  const item = document.createElement("div");
  item.className = "space-tab-item new-space-tab";
  const input = document.createElement("input");
  input.className = "new-space-input";
  input.placeholder = t("spaceName");
  input.maxLength = 32;
  input.setAttribute("aria-label", t("newSpaceName"));
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      item.remove();
      elements.addSpace.focus();
      return;
    }
    if (event.key !== "Enter") return;
    const name = input.value.trim();
    if (!name) return;
    const space = createSpace(name);
    config.spaces.push(space);
    config.activeSpaceId = space.id;
    render();
    await persistNow();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => item.remove(), 0);
  });
  item.append(input);
  elements.spaceTabs.append(item);
  input.focus();
  item.scrollIntoView({ inline: "end", block: "nearest" });
}

async function deleteSpace(spaceId) {
  if (config.spaces.length === 1) return;
  const index = config.spaces.findIndex((space) => space.id === spaceId);
  if (index < 0) return;
  const deletingActiveSpace = config.activeSpaceId === spaceId;
  config.spaces.splice(index, 1);
  if (deletingActiveSpace) {
    config.activeSpaceId = config.spaces[Math.min(index, config.spaces.length - 1)].id;
  }
  render();
  await persistNow();
}

function renderHeaders() {
  const activeSpace = getActiveSpace(config);
  elements.headerList.replaceChildren();
  elements.headerList.setAttribute(
    "aria-label",
    t("headerSettingsForSpace", [activeSpace.name])
  );

  if (activeSpace.headers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("noHeaders");
    elements.headerList.append(empty);
    return;
  }

  activeSpace.headers.forEach((header) => {
    const row = document.createElement("div");
    row.className = "header-row";
    row.dataset.headerId = header.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "header-enabled";
    checkbox.checked = header.enabled;
    checkbox.setAttribute("aria-label", t("enableHeader", [header.key || t("header")]));
    checkbox.addEventListener("change", () => {
      header.enabled = checkbox.checked;
      validateHeaderRows();
      scheduleSave();
    });

    const keyInput = document.createElement("input");
    keyInput.className = "field";
    keyInput.value = header.key;
    keyInput.placeholder = t("headerKey");
    keyInput.setAttribute("aria-label", t("headerKey"));
    keyInput.addEventListener("input", () => {
      header.key = keyInput.value;
      validateHeaderRows();
      scheduleSave();
    });

    const keyField = document.createElement("div");
    keyField.className = "header-key-field";
    keyField.append(keyInput);

    const predefinedKeys = [
      ...new Set(config.predefinedKeys.map((key) => key.trim()).filter(Boolean))
    ];
    if (predefinedKeys.length > 0) {
      const keyToggle = document.createElement("button");
      keyToggle.type = "button";
      keyToggle.className = "header-key-toggle";
      keyToggle.setAttribute("aria-label", t("choosePredefinedHeaderKey"));
      keyToggle.setAttribute("aria-haspopup", "listbox");
      keyToggle.setAttribute("aria-expanded", "false");

      const keyMenu = document.createElement("div");
      keyMenu.id = `${header.id}-key-menu`;
      keyMenu.className = "header-key-menu";
      keyMenu.setAttribute("role", "listbox");
      keyMenu.hidden = true;
      keyToggle.setAttribute("aria-controls", keyMenu.id);

      for (const key of predefinedKeys) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "header-key-option";
        option.dataset.key = key;
        option.textContent = key;
        option.title = key;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(key === header.key));
        option.addEventListener("click", () => {
          keyInput.value = key;
          keyInput.dispatchEvent(new Event("input"));
          closeMenus();
          keyInput.focus();
        });
        keyMenu.append(option);
      }

      keyToggle.addEventListener("click", () => {
        const shouldOpen = keyMenu.hidden;
        closeMenus();
        if (!shouldOpen) return;
        for (const option of keyMenu.querySelectorAll(".header-key-option")) {
          option.setAttribute("aria-selected", String(option.dataset.key === keyInput.value));
        }
        keyMenu.hidden = false;
        keyToggle.setAttribute("aria-expanded", "true");
      });
      keyField.append(keyToggle, keyMenu);
    }

    const valueInput = document.createElement("input");
    valueInput.className = "field";
    valueInput.value = header.value;
    valueInput.placeholder = t("headerValue");
    valueInput.setAttribute("aria-label", t("headerValue"));
    valueInput.addEventListener("input", () => {
      header.value = valueInput.value;
      scheduleSave();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-icon-button remove-header";
    remove.setAttribute("aria-label", t("deleteHeader", [header.key || t("header")]));
    remove.append(createTrashIcon());
    remove.addEventListener("click", async () => {
      activeSpace.headers = activeSpace.headers.filter((item) => item.id !== header.id);
      renderHeaders();
      await persistNow();
    });

    row.append(checkbox, keyField, valueInput, remove);
    elements.headerList.append(row);
  });
  validateHeaderRows();
}

function validateHeaderRows() {
  const activeSpace = getActiveSpace(config);
  const counts = new Map();
  for (const header of activeSpace.headers) {
    const key = header.key.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (const row of elements.headerList.querySelectorAll(".header-row")) {
    const header = activeSpace.headers.find((item) => item.id === row.dataset.headerId);
    const key = header.key.trim();
    const invalid = header.enabled && Boolean(key) && (
      !HEADER_NAME_PATTERN.test(key) || counts.get(key.toLowerCase()) > 1
    );
    row.querySelector(".field").classList.toggle("invalid", invalid);
  }
}

function showSettings() {
  elements.mainView.hidden = true;
  elements.settingsView.hidden = false;
  renderSettings();
}

function showMain() {
  elements.settingsView.hidden = true;
  elements.mainView.hidden = false;
  render();
}

function renderSettings() {
  applyAppearance(config.appearance);
  renderThemePicker();
  elements.fontFamily.value = config.appearance.fontFamily;
  renderEditableList(elements.keyList, config.predefinedKeys, t("headerKey"), false);
  renderEditableList(
    elements.domainList,
    config.ignoredDomains,
    t("ignoredDomainExample"),
    true
  );
}

function renderThemePicker() {
  const themeLabelKeys = {
    system: "themeSystem",
    light: "themeLight",
    dark: "themeDark"
  };
  elements.themeLabel.textContent = t(themeLabelKeys[config.appearance.theme]);
  for (const option of elements.themeMenu.querySelectorAll(".theme-option")) {
    option.setAttribute(
      "aria-selected",
      String(option.dataset.themeValue === config.appearance.theme)
    );
  }
}

function renderEditableList(container, values, placeholder, validateDomain) {
  container.replaceChildren();
  values.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "editable-row";

    const input = document.createElement("input");
    input.className = "field";
    input.value = value;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    const invalid = validateDomain
      ? Boolean(value) && !isValidDomainPattern(value)
      : Boolean(value) && !HEADER_NAME_PATTERN.test(value.trim());
    input.classList.toggle("invalid", invalid);
    input.addEventListener("input", () => {
      values[index] = input.value;
      const currentInvalid = validateDomain
        ? Boolean(input.value) && !isValidDomainPattern(input.value)
        : Boolean(input.value) && !HEADER_NAME_PATTERN.test(input.value.trim());
      input.classList.toggle("invalid", currentInvalid);
      scheduleSave();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small-icon-button remove-setting";
    remove.setAttribute("aria-label", t("deleteItem", [value || placeholder]));
    remove.append(createTrashIcon());
    remove.addEventListener("click", async () => {
      values.splice(index, 1);
      renderSettings();
      await persistNow();
    });

    row.append(input, remove);
    container.append(row);
  });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  if (!elements.settingsView.hidden) setSaveStatus(t("saving"));
  saveTimer = setTimeout(persistNow, 220);
}

function setSaveStatus(message, isError = false) {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("error", isError);
}

async function persistNow() {
  clearTimeout(saveTimer);
  await saveConfig(config);
  try {
    const result = await chrome.runtime.sendMessage({ type: "sync-rules" });
    const error = result?.errors?.[0] || result?.error;
    if (!result?.ok || error) {
      if (elements.settingsView.hidden) renderStatus(error || t("rulesApplyFailed"), true);
      else setSaveStatus(error || t("applyFailed"), true);
      return;
    }
    if (elements.settingsView.hidden) renderStatus();
    else setSaveStatus(t("saved"));
  } catch (error) {
    if (elements.settingsView.hidden) {
      renderStatus(error.message || t("rulesApplyFailed"), true);
    } else {
      setSaveStatus(error.message || t("applyFailed"), true);
    }
  }
}

elements.globalEnabled.addEventListener("change", async () => {
  config.enabled = elements.globalEnabled.checked;
  renderStatus();
  await persistNow();
});

elements.addHeader.addEventListener("click", () => {
  const activeSpace = getActiveSpace(config);
  activeSpace.headers.push(createHeader());
  renderHeaders();
  elements.headerList.querySelector(".header-row:last-child .field")?.focus();
  scheduleSave();
});

elements.addSpace.addEventListener("click", beginSpaceCreation);
elements.openSettings.addEventListener("click", showSettings);
elements.backToMain.addEventListener("click", async () => {
  await persistNow();
  showMain();
});

elements.themeToggle.addEventListener("click", () => {
  const shouldOpen = elements.themeMenu.hidden;
  closeMenus();
  if (!shouldOpen) return;
  elements.themeMenu.hidden = false;
  elements.themeToggle.setAttribute("aria-expanded", "true");
});

for (const option of elements.themeMenu.querySelectorAll(".theme-option")) {
  option.addEventListener("click", () => {
    config.appearance.theme = option.dataset.themeValue;
    applyAppearance(config.appearance);
    renderThemePicker();
    closeMenus();
    elements.themeToggle.focus();
    scheduleSave();
  });
}

elements.fontFamily.addEventListener("input", () => {
  config.appearance.fontFamily = elements.fontFamily.value;
  applyAppearance(config.appearance);
  scheduleSave();
});

elements.addKey.addEventListener("click", () => {
  config.predefinedKeys.push("");
  renderSettings();
  elements.keyList.querySelector(".editable-row:last-child .field")?.focus();
});

elements.addDomain.addEventListener("click", () => {
  config.ignoredDomains.push("");
  renderSettings();
  elements.domainList.querySelector(".editable-row:last-child .field")?.focus();
});

document.addEventListener("click", (event) => {
  if (
    event.target instanceof Element
    && event.target.closest(".header-key-field, .theme-picker")
  ) return;
  closeMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenus();
});

window.addEventListener("pagehide", () => {
  void saveConfig(config);
});

render();
